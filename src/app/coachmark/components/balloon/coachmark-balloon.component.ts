import { A11yModule } from '@angular/cdk/a11y';
import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnInit,
  inject,
} from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

import { CoachmarkService } from '../../services/coachmark.service';

const ARROW_HALF = 8;
const ARROW_MARGIN = 16;

@UntilDestroy()
@Component({
  selector: 'app-coachmark-balloon',
  standalone: true,
  imports: [A11yModule, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coachmark-balloon.component.html',
  styleUrl: './coachmark-balloon.component.scss',
})
export class CoachmarkBalloonComponent implements OnInit {
  protected readonly coachmarkService = inject(CoachmarkService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Texto do botão da última dica. */
  @Input() finishLabel = 'Entendi';

  protected arrowLeft = 0;
  protected finishing = false;

  /**
   * Desabilita o CTA enquanto o storage salva — o guard de verdade contra
   * duplo registro está no finish() do serviço. Não precisa voltar pra false:
   * finish() sempre fecha o tour no fim, o que destrói este componente.
   */
  protected onFinish(): void {
    this.finishing = true;
    this.cdr.markForCheck();
    void this.coachmarkService.finish();
  }

  ngOnInit(): void {
    this.coachmarkService.state$
      .pipe(untilDestroyed(this))
      .subscribe(({ targetRect }) => {
        if (!targetRect) return;
        // Espera o CDK aplicar a posição antes de medir o balão.
        requestAnimationFrame(() => this.alignArrow(targetRect));
      });
  }

  /**
   * A seta acompanha o centro do alvo, não o centro do balão — importante
   * quando o withPush do CDK empurra o balão para caber na viewport.
   */
  private alignArrow(targetRect: DOMRect): void {
    const balloon = this.host.nativeElement.getBoundingClientRect();
    if (!balloon.width) return;

    const targetCenter = targetRect.left + targetRect.width / 2;
    const min = ARROW_MARGIN;
    const max = balloon.width - ARROW_MARGIN - ARROW_HALF * 2;
    const next = Math.max(
      min,
      Math.min(max, targetCenter - balloon.left - ARROW_HALF),
    );

    if (next === this.arrowLeft) return;
    this.arrowLeft = next;
    this.cdr.markForCheck();
  }
}
