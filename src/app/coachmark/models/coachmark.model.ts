/**
 * Folga entre o alvo e o recorte do spotlight. Compartilhada com o serviço
 * para que o balão sempre mantenha distância do recorte, não só do alvo.
 */
export const SPOTLIGHT_PADDING = 8;

export interface CoachmarkStep {
  /** Título exibido no balão. */
  title: string;
  /** Texto de apoio da dica. */
  description: string;
  /**
   * Chave registrada por [coachmarkTarget]. Quando ausente, o balão é
   * exibido centralizado e sem seta.
   */
  targetKey?: string;
}

/**
 * Chamada uma vez quando o alvo passa a ser o destacado. Pode iniciar uma
 * animação e devolver uma função de limpeza, que o serviço chama uma única vez
 * quando o alvo deixa de ser destacado. É na limpeza que o componente pode
 * restaurar o estado original.
 */
export type CoachmarkActiveFn = () => void | (() => void);

/** Lado do balão em que a seta aparece. 'none' = balão centralizado. */
export type ArrowSide = 'top' | 'bottom' | 'none';

/**
 * Estado completo do coachmark. Um objeto só, emitido inteiro a cada
 * mudança — evita orquestrar vários observables derivados no template.
 */
export interface CoachmarkState {
  step: CoachmarkStep | null;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  arrowSide: ArrowSide;
  targetRect: DOMRect | null;
}

export const EMPTY_COACHMARK_STATE: CoachmarkState = {
  step: null,
  index: 0,
  total: 0,
  isFirst: true,
  isLast: false,
  arrowSide: 'none',
  targetRect: null,
};
