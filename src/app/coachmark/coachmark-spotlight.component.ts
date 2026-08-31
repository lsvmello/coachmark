import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable, combineLatest, fromEvent } from 'rxjs';
import { auditTime, map, startWith } from 'rxjs/operators';

import { SPOTLIGHT_PADDING } from './coachmark.model';
import { CoachmarkService } from './coachmark.service';

const RADIUS = 8;

interface SpotlightViewModel {
  width: number;
  height: number;
  path: string;
}

@Component({
  selector: 'app-coachmark-spotlight',
  standalone: true,
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coachmark-spotlight.component.html',
  styleUrl: './coachmark-spotlight.component.scss',
})
export class CoachmarkSpotlightComponent {
  private readonly coachmark = inject(CoachmarkService);

  private readonly viewportSize$ = fromEvent(window, 'resize').pipe(
    auditTime(16),
    startWith(null),
    map(() => ({ width: window.innerWidth, height: window.innerHeight })),
  );

  protected readonly vm$: Observable<SpotlightViewModel> = combineLatest([
    this.coachmark.state$,
    this.viewportSize$,
  ]).pipe(
    map(([state, { width, height }]) => {
      // Sem viewBox: 1 unidade SVG = 1px, então as coordenadas de viewport
      // do getBoundingClientRect entram direto no path.
      const full = `M0,0 H${width} V${height} H0 Z`;

      return {
        width,
        height,
        path: state.targetRect
          ? `${full} ${holePath(state.targetRect)}`
          : full,
      };
    }),
  );
}

/** Retângulo arredondado desenhado no sentido inverso — o evenodd fura. */
function holePath(rect: DOMRect): string {
  const x = rect.left - SPOTLIGHT_PADDING;
  const y = rect.top - SPOTLIGHT_PADDING;
  const w = rect.width + SPOTLIGHT_PADDING * 2;
  const h = rect.height + SPOTLIGHT_PADDING * 2;
  const r = Math.min(RADIUS, w / 2, h / 2);

  return [
    `M${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V${y + h - r}`,
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + h - r}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    'Z',
  ].join(' ');
}
