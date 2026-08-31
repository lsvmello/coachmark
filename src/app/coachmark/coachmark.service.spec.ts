import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CoachmarkStep, CoachmarkState } from './coachmark.model';
import { COACHMARK_STORAGE, CoachmarkStorage } from './coachmark-storage';
import { CoachmarkService } from './coachmark.service';

function makeStorageMock(): jest.Mocked<CoachmarkStorage> {
  return {
    hasSeenRecently: jest.fn().mockResolvedValue(false),
    markAsSeen: jest.fn().mockResolvedValue(undefined),
  };
}

function makeTargetRef(rect: Partial<DOMRect> = {}): ElementRef<HTMLElement> {
  const el = document.createElement('div');
  el.getBoundingClientRect = jest.fn(
    () =>
      ({
        top: 0,
        left: 0,
        right: 100,
        bottom: 40,
        width: 100,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => ({}),
        ...rect,
      }) as DOMRect,
  );
  return new ElementRef(el);
}

const STEPS: CoachmarkStep[] = [
  { title: 'Passo 1', description: 'Descrição 1' },
  { title: 'Passo 2', description: 'Descrição 2', targetKey: 'alvo' },
];

describe('CoachmarkService', () => {
  let service: CoachmarkService;
  let storage: jest.Mocked<CoachmarkStorage>;

  function latestState(): CoachmarkState {
    let state!: CoachmarkState;
    service.state$.subscribe((s) => (state = s));
    return state;
  }

  beforeEach(() => {
    storage = makeStorageMock();
    TestBed.configureTestingModule({
      providers: [{ provide: COACHMARK_STORAGE, useValue: storage }],
    });
    service = TestBed.inject(CoachmarkService);
  });

  afterEach(() => {
    service.close();
  });

  it('does not start when there are no steps', async () => {
    await expect(service.start('empty', [])).resolves.toBe(false);
    expect(service.isOpen).toBe(false);
    expect(storage.hasSeenRecently).not.toHaveBeenCalled();
  });

  it('does not start twice while already open', async () => {
    await expect(service.start('tour', STEPS)).resolves.toBe(true);
    await expect(service.start('tour', STEPS)).resolves.toBe(false);
    expect(storage.hasSeenRecently).toHaveBeenCalledTimes(1);
  });

  it('does not start when storage says it was already seen recently', async () => {
    storage.hasSeenRecently.mockResolvedValue(true);

    await expect(service.start('tour', STEPS)).resolves.toBe(false);
    expect(service.isOpen).toBe(false);
  });

  it('starts anyway when force is true, even if seen recently', async () => {
    storage.hasSeenRecently.mockResolvedValue(true);

    await expect(
      service.start('tour', STEPS, { force: true }),
    ).resolves.toBe(true);
    expect(service.isOpen).toBe(true);
    expect(storage.hasSeenRecently).not.toHaveBeenCalled();
  });

  it('emits the first step as open state', async () => {
    await service.start('tour', STEPS);

    const state = latestState();
    expect(state.step).toEqual(STEPS[0]);
    expect(state.index).toBe(0);
    expect(state.total).toBe(2);
    expect(state.isFirst).toBe(true);
    expect(state.isLast).toBe(false);
    expect(state.arrowSide).toBe('none');
    expect(state.targetRect).toBeNull();
  });

  it('navigates forward and backward through the steps', async () => {
    await service.start('tour', STEPS);

    service.next();
    expect(latestState().index).toBe(1);
    expect(latestState().isLast).toBe(true);

    service.previous();
    expect(latestState().index).toBe(0);
    expect(latestState().isFirst).toBe(true);
  });

  it('ignores navigation when the tour is not open', () => {
    service.next();
    service.previous();
    service.goTo(0);

    expect(service.isOpen).toBe(false);
  });

  it('ignores goTo() with an out-of-range index', async () => {
    await service.start('tour', STEPS);

    service.goTo(99);
    expect(latestState().index).toBe(0);

    service.goTo(-1);
    expect(latestState().index).toBe(0);
  });

  it('positions the balloon against a target registered before the tour starts', async () => {
    service.registerTarget('alvo', makeTargetRef());
    await service.start('tour', STEPS);

    service.next();

    const state = latestState();
    expect(state.targetRect).toBeTruthy();
  });

  it('re-applies the step position once its target registers late', async () => {
    await service.start('tour', STEPS);
    service.next();

    expect(latestState().targetRect).toBeNull();
    expect(latestState().arrowSide).toBe('none');

    service.registerTarget('alvo', makeTargetRef());

    expect(latestState().targetRect).toBeTruthy();
  });

  it('does not reposition when an unrelated target registers', async () => {
    await service.start('tour', STEPS);
    const before = latestState();

    service.registerTarget('nao-e-o-alvo-atual', makeTargetRef());

    expect(latestState()).toBe(before);
  });

  it('unregisters a target without throwing', () => {
    service.registerTarget('alvo', makeTargetRef());
    expect(() => service.unregisterTarget('alvo')).not.toThrow();
  });

  it('marks the tour as seen and closes when finish() is called', async () => {
    await service.start('tour', STEPS);

    await service.finish();

    expect(storage.markAsSeen).toHaveBeenCalledWith('tour');
    expect(service.isOpen).toBe(false);
    expect(latestState().step).toBeNull();
  });

  it('closes without marking as seen', async () => {
    await service.start('tour', STEPS);

    service.close();

    expect(storage.markAsSeen).not.toHaveBeenCalled();
    expect(service.isOpen).toBe(false);
    expect(latestState().step).toBeNull();
  });

  it('is safe to call close() when nothing is open', () => {
    expect(() => service.close()).not.toThrow();
    expect(service.isOpen).toBe(false);
  });

  it('updates the target rect when the viewport changes while a target step is active', async () => {
    const targetRef = makeTargetRef();
    service.registerTarget('alvo', targetRef);
    await service.start('tour', STEPS);
    service.next();

    (targetRef.nativeElement.getBoundingClientRect as jest.Mock).mockReturnValue({
      top: 10,
      left: 10,
      right: 120,
      bottom: 60,
      width: 110,
      height: 50,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    });

    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(latestState().targetRect?.width).toBe(110);
  });

  it('stops observing the previous target and observes the new one once the step changes', async () => {
    const stepsWithTwoTargets: CoachmarkStep[] = [
      { title: 'Passo 1', description: 'D1', targetKey: 'primeiro' },
      { title: 'Passo 2', description: 'D2', targetKey: 'segundo' },
    ];
    const first = makeTargetRef();
    const second = makeTargetRef();
    service.registerTarget('primeiro', first);
    service.registerTarget('segundo', second);

    await service.start('tour', stepsWithTwoTargets);
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    service.next();
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(latestState().targetRect).toBeTruthy();
  });

  it('cancels a pending viewport frame when the tour closes before it fires', async () => {
    const targetRef = makeTargetRef();
    service.registerTarget('alvo', targetRef);
    await service.start('tour', STEPS);
    service.next();

    window.dispatchEvent(new Event('resize'));
    expect(() => service.close()).not.toThrow();
  });

  it('falls back to null when the current index has no matching step (defensive)', () => {
    const internal = service as unknown as {
      steps: CoachmarkStep[];
      index: number;
      currentStep: CoachmarkStep | null;
    };
    internal.steps = [];
    internal.index = 0;

    expect(internal.currentStep).toBeNull();
  });

  it('applyStep is a no-op before the tour has ever been opened (defensive)', () => {
    const internal = service as unknown as { applyStep: () => void };
    expect(() => internal.applyStep()).not.toThrow();
  });
});
