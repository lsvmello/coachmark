import { InjectionToken, Provider } from '@angular/core';

/**
 * Contrato de persistência. É assíncrono de propósito:
 * hoje resolve na hora, amanhã pode virar uma chamada HTTP sem mudar o serviço.
 */
export interface CoachmarkStorage {
  hasSeenRecently(
    id: string,
    periodInDays: number,
    maxTimesShown: number,
  ): Promise<boolean>;
  markAsSeen(id: string): Promise<void>;
}

export const COACHMARK_STORAGE = new InjectionToken<CoachmarkStorage>(
  'COACHMARK_STORAGE',
);

const DAY_MS = 24 * 60 * 60 * 1000;

interface StorageRecord {
  /** Quantas vezes o tour já foi concluído. */
  timesShown: number;
  /** Timestamp da última exibição, para respeitar a janela de 1x por período. */
  lastSeenAt: number;
}

/**
 * Regra: mostra o tour no máximo 1x por período e no máximo maxTimesShown
 * vezes no total — depois disso, nunca mais aparece. periodInDays e
 * maxTimesShown vêm de cada chamada a start() (ver CoachmarkService), não
 * são fixos aqui: tours diferentes podem ter cadências diferentes.
 */
export class LocalStorageCoachmarkStorage implements CoachmarkStorage {
  async hasSeenRecently(
    id: string,
    periodInDays: number,
    maxTimesShown: number,
  ): Promise<boolean> {
    const record = this.read(id);
    if (!record) return false;

    if (record.timesShown >= maxTimesShown) return true;

    return Date.now() - record.lastSeenAt < periodInDays * DAY_MS;
  }

  async markAsSeen(id: string): Promise<void> {
    const record = this.read(id) ?? { timesShown: 0, lastSeenAt: 0 };

    this.write(id, {
      timesShown: record.timesShown + 1,
      lastSeenAt: Date.now(),
    });
  }

  private read(id: string): StorageRecord | null {
    try {
      const raw = localStorage.getItem(this.key(id));
      if (raw === null) return null;

      const parsed = JSON.parse(raw) as Partial<StorageRecord>;
      if (
        typeof parsed.timesShown !== 'number' ||
        typeof parsed.lastSeenAt !== 'number'
      ) {
        return null;
      }

      return parsed as StorageRecord;
    } catch {
      return null;
    }
  }

  private write(id: string, record: StorageRecord): void {
    try {
      localStorage.setItem(this.key(id), JSON.stringify(record));
    } catch {
      // Navegação privada ou storage cheio: exibir de novo é melhor que quebrar.
    }
  }

  private key(id: string): string {
    return `coachmark:${id}:seen`;
  }
}

export function provideCoachmarkStorage(): Provider {
  return {
    provide: COACHMARK_STORAGE,
    useFactory: () => new LocalStorageCoachmarkStorage(),
  };
}
