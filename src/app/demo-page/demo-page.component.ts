import { Component, AfterViewInit, inject } from '@angular/core';

import { CoachmarkService } from '../coachmark/services/coachmark.service';
import { CoachmarkTargetDirective } from '../coachmark/components/target/coachmark-target.directive';
import { CoachmarkActiveFn } from '../coachmark/models/coachmark.model';

@Component({
  selector: 'app-demo-page',
  standalone: true,
  imports: [CoachmarkTargetDirective],
  templateUrl: './demo-page.component.html',
  styleUrl: './demo-page.component.scss',
})
export class DemoPageComponent implements AfterViewInit {
  private readonly coachmarkService = inject(CoachmarkService);

  protected zoom = 50;

  /** Mexe o slider enquanto ele está destacado e restaura o valor ao sair. */
  protected readonly animateZoom: CoachmarkActiveFn = () => {
    const original = this.zoom;
    const id = setInterval(() => (this.zoom = (this.zoom + 10) % 110), 400);
    return () => {
      clearInterval(id);
      this.zoom = original;
    };
  };

  ngAfterViewInit(): void {
    this.startTour();
  }

  protected replayTour(): void {
    this.startTour({ force: true });
  }

  private startTour(options: { force?: boolean } = {}): void {
    this.coachmarkService.start(
      'dashboard-v2',
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
          title: 'Exporte quando quiser',
          description: 'Baixe um resumo em PDF do período selecionado.',
          targetKey: 'exportar',
        },
        {
          title: 'Ajuste o zoom',
          description: 'Arraste para aproximar ou afastar o gráfico.',
          targetKey: 'zoom',
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
