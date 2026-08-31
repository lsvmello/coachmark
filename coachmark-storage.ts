import { InjectionToken, Provider } from '@angular/core';

/**
 * Contrato de persistência. É assíncrono de propósito: hoje resolve na hora
 * com localStorage, amanhã pode virar uma chamada HTTP sem mudar o serviço.
 */
export interface CoachmarkStorage {
  hasSeenRecently(id: string): Promise<boolean>;
  markAsSeen(id: string): Promise<void>;
}

export const COACHMARK_STORAGE = new InjectionToken<CoachmarkStorage>(
  'COACHMARK_STORAGE',
);

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class LocalStorageCoachmarkStorage implements CoachmarkStorage {
  constructor(private readonly periodMs: number = THIRTY_DAYS_MS) {}

  async hasSeenRecently(id: string): Promise<boolean> {
    const raw = this.read(id);
    if (raw === null) return false;

    const lastSeen = Number(raw);
    if (!Number.isFinite(lastSeen)) return false;

    return Date.now() - lastSeen < this.periodMs;
  }

  async markAsSeen(id: string): Promise<void> {
    try {
      localStorage.setItem(this.key(id), String(Date.now()));
    } catch {
      // Navegação privada ou storage cheio: exibir de novo é melhor que quebrar.
    }
  }

  private read(id: string): string | null {
    try {
      return localStorage.getItem(this.key(id));
    } catch {
      return null;
    }
  }

  private key(id: string): string {
    return `coachmark:${id}:lastSeen`;
  }
}

export function provideCoachmarkStorage(periodMs?: number): Provider {
  return {
    provide: COACHMARK_STORAGE,
    useFactory: () => new LocalStorageCoachmarkStorage(periodMs),
  };
}
