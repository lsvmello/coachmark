import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CoachmarkStep, CoachmarkState } from '../models/coachmark.model';
import { COACHMARK_STORAGE, CoachmarkStorage } from '../services/coachmark-storage';
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
    await service.start('empty', []);

    expect(service.isOpen).toBe(false);
    expect(storage.hasSeenRecently).not.toHaveBeenCalled();
  });

  it('is a silent no-op when another tour is already open', async () => {
    await service.start('tour', STEPS);
    expect(service.isOpen).toBe(true);

    await service.start('outro-tour', STEPS);

    // Não reconsulta o storage nem troca o tour em exibição.
    expect(storage.hasSeenRecently).toHaveBeenCalledTimes(1);
    expect(latestState().step).toEqual(STEPS[0]);
  });

  it('checks storage with the default 30-day / 3x cadence when options omit them', async () => {
    await service.start('tour', STEPS);

    expect(storage.hasSeenRecently).toHaveBeenCalledWith('tour', 30, 3);
  });

  it('forwards a custom periodInDays/maxTimesShown to storage', async () => {
    await service.start('tour', STEPS, { periodInDays: 15, maxTimesShown: 1 });

    expect(storage.hasSeenRecently).toHaveBeenCalledWith('tour', 15, 1);
  });

  it('only opens one pair of overlays when start() is called twice across the storage check', async () => {
    let resolveHasSeenRecently!: (seen: boolean) => void;
    storage.hasSeenRecently.mockReturnValue(
      new Promise((resolve) => {
        resolveHasSeenRecently = resolve;
      }),
    );

    const first = service.start('tour', STEPS);
    const second = service.start('tour', STEPS);

    // A segunda chamada cai no guard `opening` e nem chega no storage.
    expect(storage.hasSeenRecently).toHaveBeenCalledTimes(1);

    resolveHasSeenRecently(false);
    await Promise.all([first, second]);

    expect(service.isOpen).toBe(true);
  });

  it('does not start when storage says it was already seen recently', async () => {
    storage.hasSeenRecently.mockResolvedValue(true);

    await service.start('tour', STEPS);

    expect(service.isOpen).toBe(false);
    expect(latestState().step).toBeNull();
  });

  it('starts anyway when force is true, even if seen recently', async () => {
    storage.hasSeenRecently.mockResolvedValue(true);

    await service.start('tour', STEPS, { force: true });

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

  it('removes the target, so a later tour no longer finds it', async () => {
    const targetRef = makeTargetRef();
    service.registerTarget('alvo', targetRef);
    service.unregisterTarget('alvo', targetRef);

    await service.start('tour', STEPS);
    service.next(); // passo 2 aponta para 'alvo'

    expect(latestState().targetRect).toBeNull();
    expect(latestState().arrowSide).toBe('none');
  });

  it('does not remove a target overwritten by a duplicate key when the stale instance unregisters', async () => {
    const stale = makeTargetRef({ left: 1 });
    const live = makeTargetRef({ left: 99 });
    const stepsWithDupKey: CoachmarkStep[] = [
      { title: 'T', description: 'D', targetKey: 'dup' },
    ];

    service.registerTarget('dup', stale);
    service.registerTarget('dup', live); // segundo elemento assume a mesma key

    // Instância antiga, já sobrescrita, tenta se desregistrar ao ser destruída.
    service.unregisterTarget('dup', stale);

    await service.start('tour', stepsWithDupKey);

    expect(latestState().targetRect?.left).toBe(99);
  });

  it('marks the tour as seen and closes when finish() is called', async () => {
    await service.start('tour', STEPS);

    await service.finish();

    expect(storage.markAsSeen).toHaveBeenCalledWith('tour');
    expect(service.isOpen).toBe(false);
    expect(latestState().step).toBeNull();
  });

  it('records the tour only once when finish() is called twice while the storage is still saving', async () => {
    let resolveMarkAsSeen!: () => void;
    storage.markAsSeen.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveMarkAsSeen = resolve;
      }),
    );
    await service.start('tour', STEPS);

    // Duplo clique no CTA: a segunda chamada cai no guard `finishing`.
    const first = service.finish();
    const second = service.finish();

    expect(storage.markAsSeen).toHaveBeenCalledTimes(1);

    resolveMarkAsSeen();
    await Promise.all([first, second]);

    expect(storage.markAsSeen).toHaveBeenCalledTimes(1);
    expect(service.isOpen).toBe(false);
  });

  it('does not re-record the previous tour when finish() is called with nothing open', async () => {
    await service.start('tour', STEPS);
    await service.finish();
    storage.markAsSeen.mockClear();

    await service.finish();

    expect(storage.markAsSeen).not.toHaveBeenCalled();
  });

  it('still closes the tour when the storage fails to record it', async () => {
    storage.markAsSeen.mockRejectedValue(new Error('offline'));
    await service.start('tour', STEPS);

    await expect(service.finish()).resolves.toBeUndefined();

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

  it('re-syncs the resize observer immediately when the step changes, without waiting for a window event', async () => {
    const ResizeObserverCtor = (
      globalThis as unknown as {
        ResizeObserver: { prototype: { observe: unknown; unobserve: unknown } };
      }
    ).ResizeObserver;
    const observeSpy = jest.spyOn(ResizeObserverCtor.prototype, 'observe' as never);
    const unobserveSpy = jest.spyOn(ResizeObserverCtor.prototype, 'unobserve' as never);

    const stepsWithTwoTargets: CoachmarkStep[] = [
      { title: 'Passo 1', description: 'D1', targetKey: 'primeiro' },
      { title: 'Passo 2', description: 'D2', targetKey: 'segundo' },
    ];
    const first = makeTargetRef();
    const second = makeTargetRef();
    service.registerTarget('primeiro', first);
    service.registerTarget('segundo', second);

    await service.start('tour', stepsWithTwoTargets);
    expect(observeSpy).toHaveBeenCalledWith(first.nativeElement);

    service.next();

    // No window resize/scroll dispatched: the switch must happen synchronously.
    expect(unobserveSpy).toHaveBeenCalledWith(first.nativeElement);
    expect(observeSpy).toHaveBeenCalledWith(second.nativeElement);

    observeSpy.mockRestore();
    unobserveSpy.mockRestore();
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

  it('resets its own state when the overlay is detached outside of close() (e.g. disposeOnNavigation)', async () => {
    await service.start('tour', STEPS);
    expect(service.isOpen).toBe(true);

    const internal = service as unknown as { balloonRef: { dispose: () => void } };
    internal.balloonRef.dispose();

    expect(service.isOpen).toBe(false);
    expect(latestState().step).toBeNull();
  });

  it('does not blow up when close() is called after the overlay already auto-disposed', async () => {
    await service.start('tour', STEPS);

    const internal = service as unknown as { balloonRef: { dispose: () => void } };
    internal.balloonRef.dispose();

    expect(() => service.close()).not.toThrow();
  });

  it('does not re-enter close() when disposing the overlay from within close() itself', async () => {
    await service.start('tour', STEPS);
    const closeSpy = jest.spyOn(service, 'close');

    service.close();

    expect(closeSpy).toHaveBeenCalledTimes(1);
    closeSpy.mockRestore();
  });
});
