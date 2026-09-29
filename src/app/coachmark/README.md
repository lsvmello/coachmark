# Coachmark

## Instalação

Versões alvo: Angular 17.3.x, `@angular/cdk` 17.0.6.

O CDK já está no `package.json` (17.0.6), então basta importar o CSS base.

No `styles.scss` global:

```scss
@import '@angular/cdk/overlay-prebuilt.css';

/* O overlay do CDK aplica pointer-events: none no container.
   O spotlight precisa capturar cliques para bloquear a página. */
.coachmark-spotlight-pane {
  pointer-events: auto;
}
```

No `app.config.ts`:

```ts
import { provideCoachmarkStorage } from './coachmark/services/coachmark-storage';

export const appConfig: ApplicationConfig = {
  providers: [provideCoachmarkStorage()],
};
```

## Uso

Marque os alvos na tela:

```html
<button coachmarkTarget="filtro-data">Filtrar por data</button>
<section coachmarkTarget="resumo">…</section>
```

E dispare o tour:

```ts
export class DashboardComponent implements AfterViewInit {
  private readonly coachmarkService = inject(CoachmarkService);

  ngAfterViewInit(): void {
    this.coachmarkService.start('dashboard-v1', [
      {
        title: 'Bem-vindo ao novo painel',
        description: 'Reorganizamos a tela para você achar as informações mais rápido.',
      },
      {
        title: 'Filtre pelo período',
        description: 'Escolha o intervalo de datas que quer analisar.',
        targetKey: 'filtro-data',
      },
      {
        title: 'Acompanhe o resumo',
        description: 'Os totais do período selecionado aparecem aqui.',
        targetKey: 'resumo',
      },
    ]);
  }
}
```

`start()` não retorna nada. É um no-op silencioso quando não há steps, quando
o storage diz que o tour já foi visto no período, ou quando já existe um tour
aberto — a ideia é **um tour por tela**, então basta chamar e seguir a vida.

## Animando o alvo

Um alvo pode se animar enquanto estiver destacado — por exemplo, um slider que
se mexe sozinho para mostrar que pode ser arrastado. Passe uma função em
`[coachmarkTargetActive]` (opcional); ela é chamada uma vez quando a dica do
alvo abre e pode devolver uma função de limpeza:

```html
<input type="range" [value]="zoom" coachmarkTarget="zoom" [coachmarkTargetActive]="animateZoom" />
```

```ts
protected readonly animateZoom: CoachmarkActiveFn = () => {
  const original = this.zoom;
  const id = setInterval(() => (this.zoom = (this.zoom + 10) % 110), 400);
  return () => {
    clearInterval(id);
    this.zoom = original;
  };
};
```

- A limpeza roda **uma única vez** quando o alvo deixa de ser destacado: troca
  de dica, `close()`/`finish()`, navegação ou destruição do alvo. É ali que o
  componente restaura o valor original.
- Dicas seguidas no mesmo alvo não reiniciam a animação.
- A função roda dentro da zone do Angular, então timers disparam change
  detection normalmente.
- O spotlight bloqueia a página, então o usuário não disputa o controle com a
  animação. Respeitar `prefers-reduced-motion` fica a cargo do componente.
- Erros na função ou na limpeza são logados e não interrompem o tour.

## Pontos de atenção

- **Acessibilidade.** Enquanto o tour está aberto, o resto da página recebe
  `inert`: leitores de tela e o teclado só alcançam o balão e o alvo da dica
  atual. Ao fechar, o `inert` é removido só de onde o coachmark colocou —
  elementos que já eram `inert` antes do tour continuam assim.

- **`ngAfterViewInit` é obrigatório.** Antes disso as diretivas ainda não
  registraram os alvos. Se o alvo estiver atrás de um `@if` ou de um request,
  o serviço reposiciona sozinho quando ele se registra.
- **Versionar o `id`** (`dashboard-v1`) permite reexibir o tour quando o
  conteúdo mudar, sem apagar o storage de ninguém.
- **Trocar para API** é só fornecer outra implementação de `CoachmarkStorage`
  no token `COACHMARK_STORAGE`; nada mais muda.
- **Regra de exibição**: o tour aparece no máximo 1x por período e no máximo
  N vezes no total — depois disso, `hasSeenRecently` passa a bloquear para
  sempre. Período e quantidade vêm de cada chamada a `start()`, não do
  provider: `start(id, steps, { periodInDays?, maxTimesShown? })`, com padrão
  30 dias / 3 vezes quando omitidos. Assim cada tela escolhe a própria
  cadência:

  ```ts
  this.coachmarkService.start('tour-quinzenal', steps, { periodInDays: 15 });
  ```

  `markAsSeen` só é chamado em `finish()` (última dica), então fechar no meio
  do tour não conta como exibição.
