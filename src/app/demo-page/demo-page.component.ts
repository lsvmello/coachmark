import { Component, AfterViewInit, inject } from '@angular/core';

import { CoachmarkService } from '../coachmark/coachmark.service';
import { CoachmarkTargetDirective } from '../coachmark/coachmark-target.directive';

@Component({
  selector: 'app-demo-page',
  standalone: true,
  imports: [CoachmarkTargetDirective],
  templateUrl: './demo-page.component.html',
  styleUrl: './demo-page.component.scss',
})
export class DemoPageComponent implements AfterViewInit {
  private readonly coachmark = inject(CoachmarkService);

  ngAfterViewInit(): void {
    this.startTour();
  }

  protected replayTour(): void {
    this.startTour({ force: true });
  }

  private startTour(options: { force?: boolean } = {}): void {
    this.coachmark.start(
      'dashboard-v1',
      [
        {
          title: 'Bem-vindo ao novo painel',
          description:
            'Reorganizamos a tela para você achar as informações mais rápido.',
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
      ],
      options,
    );
  }
}
