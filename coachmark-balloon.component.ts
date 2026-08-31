import { A11yModule } from '@angular/cdk/a11y';
import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnInit,
  inject,
} from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

import { CoachmarkService } from './coachmark.service';

const ARROW_HALF = 8;
const ARROW_MARGIN = 16;

@UntilDestroy()
@Component({
  selector: 'app-coachmark-balloon',
  standalone: true,
  imports: [A11yModule, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (coachmark.state$ | async; as vm) {
      @if (vm.step) {
        <div
          class="balloon"
          [class.balloon--arrow-top]="vm.arrowSide === 'top'"
          [class.balloon--arrow-bottom]="vm.arrowSide === 'bottom'"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="vm.step.title"
        >
          @if (vm.arrowSide !== 'none') {
            <span class="balloon__arrow" [style.left.px]="arrowLeft"></span>
          }

          <h2 class="balloon__title">{{ vm.step.title }}</h2>
          <p class="balloon__description">{{ vm.step.description }}</p>

          <div class="balloon__footer">
            @if (vm.isLast) {
              <button
                type="button"
                class="balloon__cta"
                (click)="coachmark.finish()"
              >
                {{ finishLabel }}
              </button>
            } @else {
              <nav class="pager" aria-label="Navegação das dicas">
                <button
                  type="button"
                  class="pager__step"
                  [disabled]="vm.isFirst"
                  (click)="coachmark.previous()"
                  aria-label="Dica anterior"
                >
                  &#8249;
                </button>

                <span class="pager__count" aria-live="polite">
                  {{ vm.index + 1 }} de {{ vm.total }}
                </span>

                <button
                  type="button"
                  class="pager__step"
                  (click)="coachmark.next()"
                  aria-label="Próxima dica"
                >
                  &#8250;
                </button>
              </nav>
            }
          </div>
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: min(320px, calc(100vw - 32px));
      }

      .balloon {
        position: relative;
        background: var(--coachmark-surface, #fff);
        color: var(--coachmark-text, #1f1f1f);
        border-radius: var(--coachmark-radius, 12px);
        padding: 20px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
      }

      .balloon__arrow {
        position: absolute;
        width: 16px;
        height: 16px;
        background: inherit;
        transform: rotate(45deg);
      }

      .balloon--arrow-top .balloon__arrow {
        top: -8px;
      }

      .balloon--arrow-bottom .balloon__arrow {
        bottom: -8px;
      }

      .balloon__title {
        margin: 0 0 8px;
        font-size: 1rem;
        font-weight: 600;
      }

      .balloon__description {
        margin: 0 0 20px;
        font-size: 0.875rem;
        line-height: 1.5;
        color: var(--coachmark-text-muted, #5c5c5c);
      }

      .balloon__footer {
        display: flex;
        justify-content: flex-end;
      }

      .balloon__cta {
        border: none;
        border-radius: 999px;
        padding: 10px 24px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        color: var(--coachmark-on-accent, #fff);
        background: var(--coachmark-accent, #1f1f1f);
      }

      .pager {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .pager__count {
        font-size: 0.8125rem;
        font-variant-numeric: tabular-nums;
        color: var(--coachmark-text-muted, #5c5c5c);
      }

      .pager__step {
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        border: 1px solid var(--coachmark-border, #d9d9d9);
        background: transparent;
        font-size: 1.25rem;
        line-height: 1;
        cursor: pointer;
        color: inherit;
      }

      .pager__step:disabled {
        opacity: 0.35;
        cursor: default;
      }

      .pager__step:focus-visible,
      .balloon__cta:focus-visible {
        outline: 2px solid var(--coachmark-accent, #1f1f1f);
        outline-offset: 2px;
      }
    `,
  ],
})
export class CoachmarkBalloonComponent implements OnInit {
  protected readonly coachmark = inject(CoachmarkService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Texto do botão da última dica. */
  @Input() finishLabel = 'Entendi';

  protected arrowLeft = 0;

  ngOnInit(): void {
    this.coachmark.state$
      .pipe(untilDestroyed(this))
      .subscribe(({ targetRect }) => {
        if (!targetRect) return;
        // Espera o CDK aplicar a posição antes de medir o balão.
        requestAnimationFrame(() => this.alignArrow(targetRect));
      });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    // Sai sem registrar: o usuário não completou o tour.
    this.coachmark.close();
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
