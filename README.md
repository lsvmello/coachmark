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
import { provideCoachmarkStorage } from './coachmark/coachmark-storage';

export const appConfig: ApplicationConfig = {
  providers: [provideCoachmarkStorage()], // padrão: 30 dias
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
  private readonly coachmark = inject(CoachmarkService);

  ngAfterViewInit(): void {
    this.coachmark.start('dashboard-v1', [
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

`start()` é assíncrono e resolve `false` quando o coachmark não foi exibido —
útil para encadear com outros avisos da tela sem empilhar modais.

## Pontos de atenção

- **`ngAfterViewInit` é obrigatório.** Antes disso as diretivas ainda não
  registraram os alvos. Se o alvo estiver atrás de um `@if` ou de um request,
  o serviço reposiciona sozinho quando ele se registra.
- **Versionar o `id`** (`dashboard-v1`) permite reexibir o tour quando o
  conteúdo mudar, sem apagar o storage de ninguém.
- **Trocar para API** é só fornecer outra implementação de `CoachmarkStorage`
  no token `COACHMARK_STORAGE`; nada mais muda.
- **Rota trocando com o tour aberto**: os overlays usam `disposeOnNavigation`,
  mas chame `coachmark.close()` no `ngOnDestroy` da tela se o tour for específico dela.
- **Module federation**: `CoachmarkService` é `providedIn: 'root'`. Se o
  remote tiver o próprio injector raiz, cada MFE ganha uma instância — e a
  diretiva de um MFE não vai achar o serviço do outro. Mantenha o tour
  inteiro dentro de um mesmo MFE, ou promova o serviço para um pacote
  compartilhado (`shared` no webpack config) para garantir instância única.
