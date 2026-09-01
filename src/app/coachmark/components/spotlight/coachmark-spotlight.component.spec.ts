import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { CoachmarkSpotlightComponent } from '../../components/spotlight/coachmark-spotlight.component';
import { CoachmarkState, EMPTY_COACHMARK_STATE } from '../../models/coachmark.model';
import { CoachmarkService } from '../../services/coachmark.service';

describe('CoachmarkSpotlightComponent', () => {
  let fixture: ComponentFixture<CoachmarkSpotlightComponent>;
  let state$: BehaviorSubject<CoachmarkState>;

  beforeEach(async () => {
    state$ = new BehaviorSubject<CoachmarkState>(EMPTY_COACHMARK_STATE);

    await TestBed.configureTestingModule({
      imports: [CoachmarkSpotlightComponent],
      providers: [{ provide: CoachmarkService, useValue: { state$ } }],
    }).compileComponents();

    fixture = TestBed.createComponent(CoachmarkSpotlightComponent);
  });

  it('renders a full-viewport rectangle with no hole when there is no target', () => {
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg');
    const path = fixture.nativeElement.querySelector('path');
    expect(svg?.getAttribute('width')).toBe(String(window.innerWidth));
    expect(svg?.getAttribute('height')).toBe(String(window.innerHeight));
    expect(path?.getAttribute('d')).toBe(
      `M0,0 H${window.innerWidth} V${window.innerHeight} H0 Z`,
    );
  });

  it('cuts a rounded hole around the target rect, padded by SPOTLIGHT_PADDING', () => {
    fixture.detectChanges();

    state$.next({
      ...EMPTY_COACHMARK_STATE,
      targetRect: {
        top: 100,
        left: 50,
        right: 150,
        bottom: 140,
        width: 100,
        height: 40,
        x: 50,
        y: 100,
        toJSON: () => ({}),
      } as DOMRect,
    });
    fixture.detectChanges();

    const d = fixture.nativeElement.querySelector('path')?.getAttribute('d');
    expect(d).toContain(`M0,0 H${window.innerWidth} V${window.innerHeight} H0 Z`);
    expect(d).toContain('M50,92');
    expect(d).toContain('H150');
    expect(d).toContain('A8,8 0 0 1 158,100');
    expect(d).toContain('Z');
  });

  it('recomputes the viewport size when the window is resized', async () => {
    fixture.detectChanges();

    Object.defineProperty(window, 'innerWidth', {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 300,
      configurable: true,
    });
    window.dispatchEvent(new Event('resize'));

    await new Promise((resolve) => setTimeout(resolve, 30));
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('500');
    expect(svg?.getAttribute('height')).toBe('300');
  });
});
