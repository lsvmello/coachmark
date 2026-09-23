import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { COACHMARK_STORAGE } from './coachmark-storage';
import {
  OBSERVABLE_KEY_VALUE_STORAGE,
  ObservableCoachmarkStorage,
  ObservableKeyValueStorage,
  provideObservableCoachmarkStorage,
} from './coachmark-observable-storage';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Backend em memória — mesma forma de um IndexedDB/storage nativo real. */
class FakeObservableKeyValueStorage implements ObservableKeyValueStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): Observable<string | null> {
    return of(this.map.get(key) ?? null);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

let now: jest.SpiedFunction<typeof Date.now>;

beforeEach(() => {
  jest.restoreAllMocks();
  now = jest.spyOn(Date, 'now');
});

describe('ObservableCoachmarkStorage', () => {
  it('has not been seen when nothing was stored yet', async () => {
    const storage = new ObservableCoachmarkStorage(new FakeObservableKeyValueStorage());
    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });

  it('blocks re-showing within the configured period right after being marked as seen', async () => {
    const storage = new ObservableCoachmarkStorage(new FakeObservableKeyValueStorage());

    await storage.markAsSeen('tour');

    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(true);
  });

  it('allows showing again once the period has elapsed, below the max count', async () => {
    const storage = new ObservableCoachmarkStorage(new FakeObservableKeyValueStorage());

    now.mockReturnValue(0);
    await storage.markAsSeen('tour');

    now.mockReturnValue(30 * DAY_MS + 1);
    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });

  it('never shows again once the max number of times has been reached, even after the period elapses', async () => {
    const storage = new ObservableCoachmarkStorage(new FakeObservableKeyValueStorage());

    now.mockReturnValue(0);
    await storage.markAsSeen('tour');
    now.mockReturnValue(31 * DAY_MS);
    await storage.markAsSeen('tour');
    now.mockReturnValue(62 * DAY_MS);
    await storage.markAsSeen('tour');

    now.mockReturnValue(1000 * DAY_MS);
    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(true);
  });

  it('treats corrupted JSON in storage as never seen', async () => {
    const backend = new FakeObservableKeyValueStorage();
    backend.setItem('coachmark:tour:seen', '{not-json');
    const storage = new ObservableCoachmarkStorage(backend);

    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });

  it('treats a record with an unexpected shape as never seen', async () => {
    const backend = new FakeObservableKeyValueStorage();
    backend.setItem('coachmark:tour:seen', JSON.stringify({ foo: 'bar' }));
    const storage = new ObservableCoachmarkStorage(backend);

    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });

  it('does not throw when reading from storage fails (e.g. backend unavailable)', async () => {
    const backend = new FakeObservableKeyValueStorage();
    jest.spyOn(backend, 'getItem').mockReturnValue(throwError(() => new Error('blocked')));
    const storage = new ObservableCoachmarkStorage(backend);

    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });

  it('does not throw when writing to storage fails (e.g. quota exceeded)', async () => {
    const backend = new FakeObservableKeyValueStorage();
    jest.spyOn(backend, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const storage = new ObservableCoachmarkStorage(backend);

    await expect(storage.markAsSeen('tour')).resolves.toBeUndefined();
  });

  it('tracks each tour id independently', async () => {
    const storage = new ObservableCoachmarkStorage(new FakeObservableKeyValueStorage());

    await storage.markAsSeen('tour-a');

    await expect(storage.hasSeenRecently('tour-a', 30, 3)).resolves.toBe(true);
    await expect(storage.hasSeenRecently('tour-b', 30, 3)).resolves.toBe(false);
  });

  it('lets each call use its own cadence for the same stored record', async () => {
    const storage = new ObservableCoachmarkStorage(new FakeObservableKeyValueStorage());

    now.mockReturnValue(0);
    await storage.markAsSeen('tour');

    // 20 dias depois: já passou da janela de 15 dias, mas não da de 30.
    now.mockReturnValue(20 * DAY_MS);

    await expect(storage.hasSeenRecently('tour', 15, 3)).resolves.toBe(false);
    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(true);
  });
});

describe('provideObservableCoachmarkStorage', () => {
  it('provides the COACHMARK_STORAGE token via a factory that resolves the underlying backend from DI', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: OBSERVABLE_KEY_VALUE_STORAGE, useValue: new FakeObservableKeyValueStorage() },
        provideObservableCoachmarkStorage(),
      ],
    });

    const storage = TestBed.inject(COACHMARK_STORAGE);

    expect(storage).toBeInstanceOf(ObservableCoachmarkStorage);
    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });
});
