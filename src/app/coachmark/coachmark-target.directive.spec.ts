import { Component, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CoachmarkTargetDirective } from './coachmark-target.directive';
import { CoachmarkService } from './coachmark.service';

@Component({
  standalone: true,
  imports: [CoachmarkTargetDirective],
  template: `@if (show) {<button [coachmarkTarget]="key"></button>}`,
})
class HostComponent {
  show = true;
  key = 'filtro-data';
}

describe('CoachmarkTargetDirective', () => {
  let coachmarkSpy: { registerTarget: jest.Mock; unregisterTarget: jest.Mock };

  beforeEach(() => {
    coachmarkSpy = { registerTarget: jest.fn(), unregisterTarget: jest.fn() };
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: CoachmarkService, useValue: coachmarkSpy },
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
        CoachmarkTargetDirective,
      ],
    });
  });

  it('registers the target with its key on init', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(coachmarkSpy.registerTarget).toHaveBeenCalledWith(
      'filtro-data',
      expect.anything(),
    );
  });

  it('re-registers when the key changes at runtime', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.key = 'resumo';
    fixture.detectChanges();

    expect(coachmarkSpy.unregisterTarget).toHaveBeenCalledWith('filtro-data');
    expect(coachmarkSpy.registerTarget).toHaveBeenCalledWith(
      'resumo',
      expect.anything(),
    );
  });

  it('unregisters when the host element is destroyed', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.show = false;
    fixture.detectChanges();

    expect(coachmarkSpy.unregisterTarget).toHaveBeenCalledWith('filtro-data');
  });

  it('does not register when the key is falsy', () => {
    const directive = TestBed.inject(CoachmarkTargetDirective);

    directive.key = '' as unknown as string;
    directive.ngOnChanges({
      key: {
        previousValue: undefined,
        currentValue: '',
        firstChange: true,
        isFirstChange: () => true,
      },
    });

    expect(coachmarkSpy.registerTarget).not.toHaveBeenCalled();
  });

  it('ignores ngOnChanges calls unrelated to the key input', () => {
    const directive = TestBed.inject(CoachmarkTargetDirective);

    directive.ngOnChanges({});

    expect(coachmarkSpy.registerTarget).not.toHaveBeenCalled();
  });

  it('does nothing when destroyed without ever registering a key', () => {
    const directive = TestBed.inject(CoachmarkTargetDirective);

    expect(() => directive.ngOnDestroy()).not.toThrow();
    expect(coachmarkSpy.unregisterTarget).not.toHaveBeenCalled();
  });
});
