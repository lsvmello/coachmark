import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CoachmarkActiveFn } from '../../models/coachmark.model';
import { CoachmarkService } from '../../services/coachmark.service';

/**
 * Marca um elemento como alvo de destaque:
 *
 *   <button coachmarkTarget="filtro-data">Filtrar</button>
 *
 * A tela não precisa saber nada sobre o coachmark além dessa chave.
 *
 * Opcionalmente, o alvo pode se animar enquanto estiver destacado:
 *
 *   <input type="range" coachmarkTarget="zoom" [coachmarkTargetActive]="animar" />
 */
@Directive({
  selector: '[coachmarkTarget]',
  standalone: true,
})
export class CoachmarkTargetDirective implements OnChanges, OnDestroy {
  @Input({ required: true, alias: 'coachmarkTarget' }) key!: string;

  @Input('coachmarkTargetActive') onActive?: CoachmarkActiveFn;

  private readonly targetRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly coachmarkService = inject(CoachmarkService);

  private registeredKey: string | null = null;

  /**
   * ngOnChanges em vez de ngOnInit para cobrir a chave mudando em runtime
   * (ex.: *ngFor com trackBy trocando o item embaixo do mesmo nó).
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['key'] && !changes['onActive']) return;

    this.unregister();

    if (this.key) {
      this.coachmarkService.registerTarget(this.key, this.targetRef, this.onActive);
      this.registeredKey = this.key;
    }
  }

  ngOnDestroy(): void {
    this.unregister();
  }

  private unregister(): void {
    if (this.registeredKey === null) return;
    this.coachmarkService.unregisterTarget(this.registeredKey, this.targetRef);
    this.registeredKey = null;
  }
}
