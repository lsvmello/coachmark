import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoachmarkService } from '../coachmark/coachmark.service';
import { DemoPageComponent } from './demo-page.component';

describe('DemoPageComponent', () => {
  let fixture: ComponentFixture<DemoPageComponent>;
  let coachmarkSpy: {
    start: jest.Mock;
    registerTarget: jest.Mock;
    unregisterTarget: jest.Mock;
  };

  beforeEach(async () => {
    coachmarkSpy = {
      start: jest.fn(),
      registerTarget: jest.fn(),
      unregisterTarget: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DemoPageComponent],
      providers: [{ provide: CoachmarkService, useValue: coachmarkSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(DemoPageComponent);
  });

  it('starts the tour once the view is ready', () => {
    fixture.detectChanges();

    expect(coachmarkSpy.start).toHaveBeenCalledWith(
      'dashboard-v1',
      expect.arrayContaining([
        expect.objectContaining({ targetKey: 'filtro-data' }),
        expect.objectContaining({ targetKey: 'resumo' }),
      ]),
      {},
    );
  });

  it('renders the filter button and the summary target', () => {
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Filtrar por data');
    expect(el.textContent).toContain('Resumo do período');
  });

  it('replays the tour, forcing it past the storage rule, when the button is clicked', () => {
    fixture.detectChanges();
    coachmarkSpy.start.mockClear();

    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector<HTMLButtonElement>('.dashboard__replay');
    button?.click();

    expect(coachmarkSpy.start).toHaveBeenCalledWith(
      'dashboard-v1',
      expect.any(Array),
      { force: true },
    );
  });
});
