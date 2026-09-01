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

## Pontos de atenção

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
