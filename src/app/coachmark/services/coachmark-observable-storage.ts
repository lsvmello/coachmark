import { InjectionToken, Provider, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import {
  COACHMARK_STORAGE,
  CoachmarkStorage,
  DAY_MS,
  StorageRecord,
  parseStorageRecord,
  storageKey,
} from './coachmark-storage';

/**
 * Mesmo formato de localStorage.getItem/setItem, mas getItem é assíncrono
 * (ex.: IndexedDB, storage nativo de app híbrido, etc.).
 */
export interface ObservableKeyValueStorage {
  getItem(key: string): Observable<string | null>;
  setItem(key: string, value: string): void;
}

export const OBSERVABLE_KEY_VALUE_STORAGE =
  new InjectionToken<ObservableKeyValueStorage>('OBSERVABLE_KEY_VALUE_STORAGE');

/**
 * Mesma regra de exibição da versão em localStorage (ver LocalStorageCoachmarkStorage);
 * só muda o backend de leitura/escrita.
 */
export class ObservableCoachmarkStorage implements CoachmarkStorage {
  constructor(private readonly storage: ObservableKeyValueStorage) {}

  async hasSeenRecently(
    id: string,
    periodInDays: number,
    maxTimesShown: number,
  ): Promise<boolean> {
    const record = await this.read(id);
    if (!record) return false;

    if (record.timesShown >= maxTimesShown) return true;

    return Date.now() - record.lastSeenAt < periodInDays * DAY_MS;
  }

  async markAsSeen(id: string): Promise<void> {
    const record = (await this.read(id)) ?? { timesShown: 0, lastSeenAt: 0 };

    this.write(id, {
      timesShown: record.timesShown + 1,
      lastSeenAt: Date.now(),
    });
  }

  private async read(id: string): Promise<StorageRecord | null> {
    try {
      const raw = await firstValueFrom(this.storage.getItem(storageKey(id)));
      return parseStorageRecord(raw);
    } catch {
      return null;
    }
  }

  private write(id: string, record: StorageRecord): void {
    try {
      this.storage.setItem(storageKey(id), JSON.stringify(record));
    } catch {
      // Mesmo raciocínio da versão em localStorage: exibir de novo é melhor que quebrar.
    }
  }
}

export function provideObservableCoachmarkStorage(): Provider {
  return {
    provide: COACHMARK_STORAGE,
    useFactory: () =>
      new ObservableCoachmarkStorage(inject(OBSERVABLE_KEY_VALUE_STORAGE)),
  };
}
