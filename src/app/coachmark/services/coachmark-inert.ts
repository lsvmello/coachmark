/**
 * Elementos que o CDK põe direto no <body> e que precisam continuar
 * acessíveis: o LiveAnnouncer (anúncios via aria-live) e o container de
 * descrições do AriaDescriber.
 */
const ALWAYS_REACHABLE =
  '.cdk-live-announcer-element, .cdk-describedby-message-container';

/**
 * Deixa inert tudo que não é, nem contém, um dos elementos de `keep` —
 * na prática, remove a página da árvore de acessibilidade, preservando o
 * alvo e os overlays do coachmark.
 *
 * Retorna a função que desfaz exatamente o que foi feito: só remove o
 * `inert` dos elementos em que ela mesma colocou. Quem já era inert antes
 * não é tocado nem na ida nem na volta.
 */
export function inertOutside(keep: (Element | null | undefined)[]): () => void {
  const kept = keep.filter((el): el is Element => !!el);

  // Caminho de cada elemento mantido até o <body>: nada nele pode ficar
  // inert, senão o próprio elemento mantido ficaria inacessível.
  const onPath = new Set<Element>();
  for (const el of kept) {
    for (
      let node: Element | null = el;
      node && node !== document.body;
      node = node.parentElement
    ) {
      onPath.add(node);
    }
  }

  // Os irmãos de cada nó do caminho são o que precisa ficar inert.
  // Não descemos dentro de um elemento mantido: o conteúdo do alvo fica
  // inteiro acessível.
  const parents = new Set<Element>([document.body]);
  for (const node of onPath) {
    const parent = node.parentElement;
    if (parent && !kept.some((k) => k.contains(parent))) parents.add(parent);
  }

  const added: Element[] = [];
  for (const parent of parents) {
    for (const child of Array.from(parent.children)) {
      if (
        onPath.has(child) ||
        child.hasAttribute('inert') || // já era inert: não mexe
        child.matches(ALWAYS_REACHABLE)
      ) {
        continue;
      }
      child.setAttribute('inert', '');
      added.push(child);
    }
  }

  return () => {
    for (const el of added) el.removeAttribute('inert');
  };
}
