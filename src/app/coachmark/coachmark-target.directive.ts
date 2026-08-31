import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CoachmarkService } from './coachmark.service';

/**
 * Marca um elemento como alvo de destaque:
 *
 *   <button coachmarkTarget="filtro-data">Filtrar</button>
 *
 * A tela não precisa saber nada sobre o coachmark além dessa chave.
 */
@Directive({
  selector: '[coachmarkTarget]',
  standalone: true,
})
export class CoachmarkTargetDirective implements OnChanges, OnDestroy {
  @Input({ required: true, alias: 'coachmarkTarget' }) key!: string;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly coachmark = inject(CoachmarkService);

  private registeredKey: string | null = null;

  /**
   * ngOnChanges em vez de ngOnInit para cobrir a chave mudando em runtime
   * (ex.: *ngFor com trackBy trocando o item embaixo do mesmo nó).
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['key']) return;

    this.unregister();

    if (this.key) {
      this.coachmark.registerTarget(this.key, this.el);
      this.registeredKey = this.key;
    }
  }

  ngOnDestroy(): void {
    this.unregister();
  }

  private unregister(): void {
    if (this.registeredKey === null) return;
    this.coachmark.unregisterTarget(this.registeredKey);
    this.registeredKey = null;
  }
}
