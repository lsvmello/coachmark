import { ComponentPortal } from '@angular/cdk/portal';
import {
  ConnectedPosition,
  Overlay,
  OverlayRef,
  PositionStrategy,
} from '@angular/cdk/overlay';
import { ElementRef, Injectable, Injector, NgZone, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

import {
  ArrowSide,
  CoachmarkActiveFn,
  CoachmarkState,
  CoachmarkStep,
  EMPTY_COACHMARK_STATE,
  SPOTLIGHT_PADDING,
} from '../models/coachmark.model';
import { COACHMARK_STORAGE } from './coachmark-storage';
import { CoachmarkBalloonComponent } from '../components/balloon/coachmark-balloon.component';
import { CoachmarkSpotlightComponent } from '../components/spotlight/coachmark-spotlight.component';

/** Distância entre a borda do alvo e o balão. */
const BALLOON_GAP = 16;

/** Cadência padrão de start(), usada quando a chamada não informa a própria. */
const DEFAULT_PERIOD_IN_DAYS = 30;
const DEFAULT_MAX_TIMES_SHOWN = 3;

/**
 * Distância entre a borda do recorte do spotlight e o balão. O recorte já
 * é maior que o alvo em SPOTLIGHT_PADDING, então soma-se aqui para o balão
 * não encostar visualmente no spotlight.
 */
const BALLOON_OFFSET = BALLOON_GAP + SPOTLIGHT_PADDING;

interface TargetRegistration {
  el: ElementRef<HTMLElement>;
  onActive?: CoachmarkActiveFn;
}

/** Alvo destacado cujo onActive já foi chamado e aguarda a limpeza. */
interface ActiveTarget {
  el: ElementRef<HTMLElement>;
  fn: CoachmarkActiveFn;
  cleanup?: () => void;
}

const POSITIONS: ConnectedPosition[] = [
  // Preferência: balão abaixo do alvo.
  {
    originX: 'center',
    originY: 'bottom',
    overlayX: 'center',
    overlayY: 'top',
    offsetY: BALLOON_OFFSET,
  },
  // Sem espaço embaixo: vai para cima.
  {
    originX: 'center',
    originY: 'top',
    overlayX: 'center',
    overlayY: 'bottom',
    offsetY: -BALLOON_OFFSET,
  },
];

@Injectable({ providedIn: 'root' })
export class CoachmarkService {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private readonly storage = inject(COACHMARK_STORAGE);
  private readonly zone = inject(NgZone);

  private readonly stateSubject = new BehaviorSubject<CoachmarkState>(
    EMPTY_COACHMARK_STATE,
  );
  readonly state$: Observable<CoachmarkState> = this.stateSubject.asObservable();

  private readonly targets = new Map<string, TargetRegistration>();
  private steps: CoachmarkStep[] = [];
  private index = 0;
  private arrowSide: ArrowSide = 'none';
  private targetRect: DOMRect | null = null;
  private activeTarget?: ActiveTarget;

  private spotlightRef?: OverlayRef;
  private balloonRef?: OverlayRef;
  private positionSub?: Subscription;
  private overlayDetachSub?: Subscription;
  private detachViewportListeners?: () => void;
  private syncResizeTarget?: () => void;
  private currentId = '';
  private opening = false;
  private finishing = false;

  get isOpen(): boolean {
    return !!this.balloonRef;
  }

  // ---------------------------------------------------------------- targets

  registerTarget(
    key: string,
    el: ElementRef<HTMLElement>,
    onActive?: CoachmarkActiveFn,
  ): void {
    this.targets.set(key, { el, onActive });
    // Se o alvo da dica atual acabou de aparecer, reposiciona.
    if (this.isOpen && this.currentStep?.targetKey === key) {
      this.applyStep();
    }
  }

  /**
   * @param el quando informado, só remove se ainda for o elemento
   * registrado para essa key — evita que uma key duplicada, já sobrescrita
   * por outro elemento, seja removida pela instância antiga ao ser destruída.
   */
  unregisterTarget(key: string, el?: ElementRef<HTMLElement>): void {
    const registration = this.targets.get(key);
    if (el && registration?.el !== el) return;

    this.targets.delete(key);

    // O alvo animado sumiu (destruído ou re-registrado): encerra a animação.
    if (registration && this.activeTarget?.el === registration.el) {
      this.setActiveTarget(undefined);
    }
  }

  // ------------------------------------------------------------------ fluxo

  /**
   * Abre o coachmark se o usuário não o viu no período configurado. Não
   * retorna nada: é no-op silencioso quando não há steps, quando outro tour
   * já está aberto, ou quando o storage diz que já foi visto.
   *
   * @param id identificador do tour (chave da persistência)
   * @param force ignora a regra de periodicidade — útil num link "ver dicas"
   * @param periodInDays janela entre exibições; padrão DEFAULT_PERIOD_IN_DAYS
   * @param maxTimesShown quantas vezes no total; padrão DEFAULT_MAX_TIMES_SHOWN
   */
  async start(
    id: string,
    steps: CoachmarkStep[],
    options: {
      force?: boolean;
      periodInDays?: number;
      maxTimesShown?: number;
    } = {},
  ): Promise<void> {
    // opening cobre a janela do await abaixo, em que isOpen ainda é false e
    // uma segunda chamada abriria um segundo par de overlays.
    if (!steps.length || this.isOpen || this.opening) return;

    this.opening = true;
    try {
      const periodInDays = options.periodInDays ?? DEFAULT_PERIOD_IN_DAYS;
      const maxTimesShown = options.maxTimesShown ?? DEFAULT_MAX_TIMES_SHOWN;

      if (
        !options.force &&
        (await this.storage.hasSeenRecently(id, periodInDays, maxTimesShown))
      ) {
        return;
      }

      this.currentId = id;
      this.steps = steps;
      this.index = 0;
      this.open();
    } finally {
      this.opening = false;
    }
  }

  next(): void {
    this.goTo(this.index + 1);
  }

  previous(): void {
    this.goTo(this.index - 1);
  }

  goTo(index: number): void {
    if (!this.isOpen || index < 0 || index >= this.steps.length) return;
    this.index = index;
    this.applyStep();
  }

  /** Conclui o tour e registra a exibição. */
  async finish(): Promise<void> {
    if (this.finishing || !this.isOpen) return;

    this.finishing = true;
    try {
      await this.storage.markAsSeen(this.currentId);
    } catch {
      // Falhar ao registrar não pode prender o usuário atrás do overlay:
      // fecha mesmo assim e o tour volta no próximo período.
    } finally {
      this.finishing = false;
      this.close();
    }
  }

  close(): void {
    this.setActiveTarget(undefined);

    // Desinscreve antes de dispose(): o dispose abaixo também aciona
    // detachments(), e não queremos reentrar em close() por causa disso.
    this.overlayDetachSub?.unsubscribe();
    this.overlayDetachSub = undefined;

    this.positionSub?.unsubscribe();
    this.positionSub = undefined;
    this.detachViewportListeners?.();
    this.detachViewportListeners = undefined;

    this.balloonRef?.dispose();
    this.spotlightRef?.dispose();
    this.balloonRef = undefined;
    this.spotlightRef = undefined;

    this.steps = [];
    this.index = 0;
    this.arrowSide = 'none';
    this.targetRect = null;
    this.stateSubject.next(EMPTY_COACHMARK_STATE);
  }

  // ---------------------------------------------------------------- interno

  private get currentStep(): CoachmarkStep | null {
    return this.steps[this.index] ?? null;
  }

  private get targetElement(): HTMLElement | null {
    return this.currentRegistration?.el.nativeElement ?? null;
  }

  private get currentRegistration(): TargetRegistration | null {
    const key = this.currentStep?.targetKey;
    if (!key) return null;
    return this.targets.get(key) ?? null;
  }

  private emit(): void {
    const total = this.steps.length;
    this.stateSubject.next({
      step: this.currentStep,
      index: this.index,
      total,
      isFirst: this.index === 0,
      isLast: total > 0 && this.index === total - 1,
      arrowSide: this.arrowSide,
      targetRect: this.targetRect,
    });
  }

  private open(): void {
    // 1) Camada do overlay cinza com o recorte. Cobre a tela inteira e
    //    bloqueia interação com a página.
    this.spotlightRef = this.overlay.create({
      positionStrategy: this.overlay.position().global(),
      width: '100vw',
      height: '100vh',
      panelClass: 'coachmark-spotlight-pane',
      disposeOnNavigation: true,
    });
    this.spotlightRef.attach(
      new ComponentPortal(CoachmarkSpotlightComponent, null, this.injector),
    );

    // 2) Camada do balão, reposicionada a cada dica.
    this.balloonRef = this.overlay.create({
      positionStrategy: this.centeredStrategy(),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      panelClass: 'coachmark-balloon-pane',
      disposeOnNavigation: true,
    });
    this.balloonRef.attach(
      new ComponentPortal(CoachmarkBalloonComponent, null, this.injector),
    );

    // disposeOnNavigation destrói os overlays sem passar por close(); sem isso,
    // isOpen ficaria travado em true e bloquearia qualquer tour futuro.
    this.overlayDetachSub = this.balloonRef.detachments().subscribe(() => {
      this.close();
    });

    this.listenToViewport();
    this.applyStep();
  }

  private applyStep(): void {
    if (!this.balloonRef) return;

    // Troca o alvo observado já aqui — sem isso, um resize por layout do novo
    // alvo só seria percebido no próximo scroll/resize da janela.
    this.syncResizeTarget?.();
    this.syncActiveTarget();

    const el = this.targetElement;

    this.positionSub?.unsubscribe();
    this.positionSub = undefined;

    if (!el) {
      this.arrowSide = 'none';
      this.targetRect = null;
      this.balloonRef.updatePositionStrategy(this.centeredStrategy());
      this.emit();
      return;
    }

    el.scrollIntoView({ block: 'center', behavior: 'smooth' });

    const strategy = this.overlay
      .position()
      .flexibleConnectedTo(el)
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(12)
      .withPositions(POSITIONS);

    // A posição que o CDK escolheu é o que define para onde a seta aponta:
    // balão colado pelo topo => alvo está embaixo => seta no topo do balão.
    this.positionSub = strategy.positionChanges.subscribe(
      ({ connectionPair }) => {
        this.arrowSide = connectionPair.overlayY === 'top' ? 'top' : 'bottom';
        this.emit();
      },
    );

    this.balloonRef.updatePositionStrategy(strategy);
    this.targetRect = el.getBoundingClientRect();
    this.emit();
  }

  /**
   * Chama o onActive do alvo da dica atual e encerra o anterior. Dicas
   * seguidas no mesmo alvo com a mesma função não reiniciam a animação.
   */
  private syncActiveTarget(): void {
    const registration = this.currentRegistration;
    const active = this.activeTarget;

    if (
      active &&
      active.el === registration?.el &&
      active.fn === registration.onActive
    ) {
      return;
    }

    this.setActiveTarget(
      registration?.onActive
        ? { el: registration.el, fn: registration.onActive }
        : undefined,
    );
  }

  private setActiveTarget(next?: ActiveTarget): void {
    const previous = this.activeTarget;
    this.activeTarget = next;

    try {
      previous?.cleanup?.();
      if (next) next.cleanup = next.fn() ?? undefined;
    } catch (error) {
      console.error('[coachmark] erro em coachmarkTargetActive', error);
    }
  }

  private centeredStrategy(): PositionStrategy {
    return this.overlay
      .position()
      .global()
      .centerHorizontally()
      .centerVertically();
  }

  /**
   * O recorte precisa acompanhar scroll, resize e mudanças de layout do alvo.
   * Rodamos fora da zone e voltamos para dentro só ao emitir o estado.
   */
  private listenToViewport(): void {
    let frame = 0;
    let observed: HTMLElement | null = null;

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = this.targetElement;
        const rect = el ? el.getBoundingClientRect() : null;
        this.zone.run(() => {
          this.targetRect = rect;
          this.emit();
        });
      });
    };

    const observer = new ResizeObserver(schedule);
    const observeTarget = () => {
      const el = this.targetElement;
      if (el === observed) return;
      if (observed) observer.unobserve(observed);
      if (el) observer.observe(el);
      observed = el;
    };

    this.syncResizeTarget = observeTarget;

    this.zone.runOutsideAngular(() => {
      const onViewportChange = () => {
        observeTarget();
        schedule();
      };

      // capture: true para pegar scroll de containers internos, não só window.
      window.addEventListener('scroll', onViewportChange, true);
      window.addEventListener('resize', onViewportChange);
      observeTarget();

      this.detachViewportListeners = () => {
        if (frame) cancelAnimationFrame(frame);
        window.removeEventListener('scroll', onViewportChange, true);
        window.removeEventListener('resize', onViewportChange);
        observer.disconnect();
        this.syncResizeTarget = undefined;
      };
    });
  }
}
