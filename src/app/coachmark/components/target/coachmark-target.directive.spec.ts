import { Component, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CoachmarkTargetDirective } from '../../components/target/coachmark-target.directive';
import { CoachmarkActiveFn } from '../../models/coachmark.model';
import { CoachmarkService } from '../../services/coachmark.service';

@Component({
  standalone: true,
  imports: [CoachmarkTargetDirective],
  template: `@if (show) {
    <button [coachmarkTarget]="key" [coachmarkTargetActive]="onActive"></button>
  }`,
})
class HostComponent {
  show = true;
  key = 'filtro-data';
  onActive?: CoachmarkActiveFn;
}

describe('CoachmarkTargetDirective', () => {
  let coachmarkServiceSpy: { registerTarget: jest.Mock; unregisterTarget: jest.Mock };

  beforeEach(() => {
    coachmarkServiceSpy = { registerTarget: jest.fn(), unregisterTarget: jest.fn() };
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: CoachmarkService, useValue: coachmarkServiceSpy },
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
        CoachmarkTargetDirective,
      ],
    });
  });

  it('registers the target with its key on init', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(coachmarkServiceSpy.registerTarget).toHaveBeenCalledWith(
      'filtro-data',
      expect.anything(),
      undefined,
    );
  });

  it('re-registers when the key changes at runtime', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.key = 'resumo';
    fixture.detectChanges();

    expect(coachmarkServiceSpy.unregisterTarget).toHaveBeenCalledWith(
      'filtro-data',
      expect.anything(),
    );
    expect(coachmarkServiceSpy.registerTarget).toHaveBeenCalledWith(
      'resumo',
      expect.anything(),
      undefined,
    );
  });

  it('passes coachmarkTargetActive along when registering', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const onActive = jest.fn();
    fixture.componentInstance.onActive = onActive;
    fixture.detectChanges();

    expect(coachmarkServiceSpy.registerTarget).toHaveBeenCalledWith(
      'filtro-data',
      expect.anything(),
      onActive,
    );
  });

  it('re-registers when coachmarkTargetActive changes at runtime', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const onActive = jest.fn();
    fixture.componentInstance.onActive = onActive;
    fixture.detectChanges();

    expect(coachmarkServiceSpy.unregisterTarget).toHaveBeenCalledWith(
      'filtro-data',
      expect.anything(),
    );
    expect(coachmarkServiceSpy.registerTarget).toHaveBeenLastCalledWith(
      'filtro-data',
      expect.anything(),
      onActive,
    );
  });

  it('unregisters when the host element is destroyed', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.show = false;
    fixture.detectChanges();

    expect(coachmarkServiceSpy.unregisterTarget).toHaveBeenCalledWith(
      'filtro-data',
      expect.anything(),
    );
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

    expect(coachmarkServiceSpy.registerTarget).not.toHaveBeenCalled();
  });

  it('ignores ngOnChanges calls unrelated to the key input', () => {
    const directive = TestBed.inject(CoachmarkTargetDirective);

    directive.ngOnChanges({});

    expect(coachmarkServiceSpy.registerTarget).not.toHaveBeenCalled();
  });

  it('does nothing when destroyed without ever registering a key', () => {
    const directive = TestBed.inject(CoachmarkTargetDirective);

    expect(() => directive.ngOnDestroy()).not.toThrow();
    expect(coachmarkServiceSpy.unregisterTarget).not.toHaveBeenCalled();
  });
});
