import {
  COACHMARK_STORAGE,
  LocalStorageCoachmarkStorage,
  provideCoachmarkStorage,
} from './coachmark-storage';

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('LocalStorageCoachmarkStorage', () => {

  it('has not been seen when nothing was stored yet', async () => {
    const storage = new LocalStorageCoachmarkStorage();
    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });

  it('blocks re-showing within the configured period right after being marked as seen', async () => {
    const storage = new LocalStorageCoachmarkStorage();

    await storage.markAsSeen('tour');

    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(true);
  });

  it('allows showing again once the period has elapsed, below the max count', async () => {
    const storage = new LocalStorageCoachmarkStorage();
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(0);
    await storage.markAsSeen('tour');

    now.mockReturnValue(30 * DAY_MS + 1);
    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });

  it('never shows again once the max number of times has been reached, even after the period elapses', async () => {
    const storage = new LocalStorageCoachmarkStorage();
    const now = jest.spyOn(Date, 'now');

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
    localStorage.setItem('coachmark:tour:seen', '{not-json');
    const storage = new LocalStorageCoachmarkStorage();

    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });

  it('treats a record with an unexpected shape as never seen', async () => {
    localStorage.setItem('coachmark:tour:seen', JSON.stringify({ foo: 'bar' }));
    const storage = new LocalStorageCoachmarkStorage();

    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });

  it('does not throw when reading from storage fails (e.g. private browsing)', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const storage = new LocalStorageCoachmarkStorage();

    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });

  it('does not throw when writing to storage fails (e.g. storage full)', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const storage = new LocalStorageCoachmarkStorage();

    await expect(storage.markAsSeen('tour')).resolves.toBeUndefined();
  });

  it('tracks each tour id independently', async () => {
    const storage = new LocalStorageCoachmarkStorage();

    await storage.markAsSeen('tour-a');

    await expect(storage.hasSeenRecently('tour-a', 30, 3)).resolves.toBe(true);
    await expect(storage.hasSeenRecently('tour-b', 30, 3)).resolves.toBe(false);
  });

  it('lets each call use its own cadence for the same stored record', async () => {
    const storage = new LocalStorageCoachmarkStorage();
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(0);
    await storage.markAsSeen('tour');

    // 20 dias depois: já passou da janela de 15 dias, mas não da de 30.
    now.mockReturnValue(20 * DAY_MS);

    await expect(storage.hasSeenRecently('tour', 15, 3)).resolves.toBe(false);
    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(true);
  });
});

describe('provideCoachmarkStorage', () => {
  it('provides the COACHMARK_STORAGE token via a factory that returns a working instance', async () => {
    const provider = provideCoachmarkStorage() as unknown as {
      provide: unknown;
      useFactory: () => LocalStorageCoachmarkStorage;
    };

    expect(provider.provide).toBe(COACHMARK_STORAGE);

    const storage = provider.useFactory();
    expect(storage).toBeInstanceOf(LocalStorageCoachmarkStorage);
    await expect(storage.hasSeenRecently('tour', 30, 3)).resolves.toBe(false);
  });
});
