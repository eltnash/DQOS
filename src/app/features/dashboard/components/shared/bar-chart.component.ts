import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { Chart, registerables, type ChartConfiguration } from 'chart.js';

import type { SeriesPoint } from '../../dashboard.types';

@Component({
  selector: 'app-dashboard-bar-chart',
  template: `<canvas #canvas></canvas>`,
  styles: `
    :host {
      display: block;
      height: 200px;
    }
    canvas {
      height: 200px !important;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardBarChartComponent implements AfterViewInit, OnDestroy {
  readonly points = input.required<SeriesPoint[]>();
  readonly colorBySign = input(false);
  readonly barColor = input('rgba(99, 102, 241, 0.75)');

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;
  private ready = false;

  constructor() {
    Chart.register(...registerables);
    effect(() => {
      this.points();
      if (this.ready) this.render();
    });
  }

  ngAfterViewInit(): void {
    this.ready = true;
    this.render();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(): void {
    const pts = this.points();
    const labels = pts.map((p) => p.date.slice(0, 7));
    const values = pts.map((p) => p.value);
    const colors = this.colorBySign()
      ? values.map((v) => (v >= 0 ? 'rgba(52, 211, 153, 0.75)' : 'rgba(248, 113, 113, 0.75)'))
      : this.barColor();

    this.chart?.destroy();
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderRadius: 4, borderSkipped: false }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: 'rgba(38,43,55,0.4)' } },
          y: {
            ticks: { color: '#9ca3af', font: { family: "'JetBrains Mono', monospace", size: 10 } },
            grid: { color: 'rgba(38,43,55,0.4)' },
          },
        },
      },
    };
    this.chart = new Chart(this.canvasRef().nativeElement, config);
  }
}
