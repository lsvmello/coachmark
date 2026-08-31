import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { CoachmarkBalloonComponent } from './coachmark-balloon.component';
import { CoachmarkState, EMPTY_COACHMARK_STATE } from './coachmark.model';
import { CoachmarkService } from './coachmark.service';

function rect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 0,
    left: 0,
    right: 100,
    bottom: 40,
    width: 100,
    height: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}

describe('CoachmarkBalloonComponent', () => {
  let fixture: ComponentFixture<CoachmarkBalloonComponent>;
  let state$: BehaviorSubject<CoachmarkState>;
  let coachmarkSpy: {
    state$: BehaviorSubject<CoachmarkState>;
    finish: jest.Mock;
    next: jest.Mock;
    previous: jest.Mock;
  };

  beforeEach(async () => {
    state$ = new BehaviorSubject<CoachmarkState>(EMPTY_COACHMARK_STATE);
    coachmarkSpy = {
      state$,
      finish: jest.fn(),
      next: jest.fn(),
      previous: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CoachmarkBalloonComponent],
      providers: [{ provide: CoachmarkService, useValue: coachmarkSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(CoachmarkBalloonComponent);
  });

  it('renders nothing when there is no active step', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.balloon')).toBeNull();
  });

  it('renders the current step title and description', () => {
    state$.next({
      step: { title: 'Título', description: 'Descrição' },
      index: 0,
      total: 2,
      isFirst: true,
      isLast: false,
      arrowSide: 'none',
      targetRect: null,
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.balloon__title')?.textContent).toContain('Título');
    expect(el.querySelector('.balloon__description')?.textContent).toContain(
      'Descrição',
    );
    expect(el.querySelector('.balloon__arrow')).toBeNull();
  });

  it('shows the pager when it is not the last step and wires next/previous', () => {
    state$.next({
      step: { title: 'T', description: 'D' },
      index: 0,
      total: 2,
      isFirst: true,
      isLast: false,
      arrowSide: 'top',
      targetRect: null,
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.balloon--arrow-top')).not.toBeNull();
    expect(el.querySelector('.balloon__cta')).toBeNull();

    const buttons = el.querySelectorAll<HTMLButtonElement>('.pager__step');
    expect(buttons[0].disabled).toBe(true);

    buttons[1].click();
    expect(coachmarkSpy.next).toHaveBeenCalled();

    buttons[0].disabled = false;
    buttons[0].click();
    expect(coachmarkSpy.previous).toHaveBeenCalled();
  });

  it('shows the finish button on the last step and calls finish() on click', () => {
    state$.next({
      step: { title: 'T', description: 'D' },
      index: 1,
      total: 2,
      isFirst: false,
      isLast: true,
      arrowSide: 'bottom',
      targetRect: null,
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.balloon--arrow-bottom')).not.toBeNull();
    const cta = el.querySelector<HTMLButtonElement>('.balloon__cta');
    expect(cta).not.toBeNull();

    cta!.click();
    expect(coachmarkSpy.finish).toHaveBeenCalled();
  });

  it('uses a custom finish label when provided', () => {
    fixture.componentInstance.finishLabel = 'Concluir';
    state$.next({
      step: { title: 'T', description: 'D' },
      index: 0,
      total: 1,
      isFirst: true,
      isLast: true,
      arrowSide: 'none',
      targetRect: null,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.balloon__cta')?.textContent).toContain(
      'Concluir',
    );
  });

  it('aligns the arrow with the target center once the balloon has a measurable width', async () => {
    fixture.detectChanges();

    fixture.nativeElement.getBoundingClientRect = () =>
      rect({ left: 0, width: 320 });

    state$.next({
      step: { title: 'T', description: 'D' },
      index: 1,
      total: 2,
      isFirst: false,
      isLast: false,
      arrowSide: 'top',
      targetRect: rect({ left: 150, width: 50 }),
    });
    fixture.detectChanges();

    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect((fixture.componentInstance as unknown as { arrowLeft: number }).arrowLeft).toBeGreaterThan(0);
  });

  it('does not re-render when the arrow position is unchanged on the next alignment', async () => {
    fixture.detectChanges();
    fixture.nativeElement.getBoundingClientRect = () => rect({ left: 0, width: 320 });

    const targetRect = rect({ left: 150, width: 50 });
    state$.next({
      step: { title: 'T', description: 'D' },
      index: 1,
      total: 2,
      isFirst: false,
      isLast: false,
      arrowSide: 'top',
      targetRect,
    });
    fixture.detectChanges();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const arrowLeftAfterFirst = (
      fixture.componentInstance as unknown as { arrowLeft: number }
    ).arrowLeft;

    // Same target rect again: alignArrow recomputes the same value and bails out early.
    state$.next({
      step: { title: 'T', description: 'D' },
      index: 1,
      total: 2,
      isFirst: false,
      isLast: false,
      arrowSide: 'top',
      targetRect,
    });
    fixture.detectChanges();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(
      (fixture.componentInstance as unknown as { arrowLeft: number }).arrowLeft,
    ).toBe(arrowLeftAfterFirst);
  });

  it('does not move the arrow when the balloon has not been measured yet (width 0)', async () => {
    fixture.detectChanges();

    state$.next({
      step: { title: 'T', description: 'D' },
      index: 1,
      total: 2,
      isFirst: false,
      isLast: false,
      arrowSide: 'top',
      targetRect: rect({ left: 150, width: 50 }),
    });
    fixture.detectChanges();

    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect((fixture.componentInstance as unknown as { arrowLeft: number }).arrowLeft).toBe(0);
  });
});
