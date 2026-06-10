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
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from 'lightweight-charts';

import type { RollingMetricPoint, SeriesPoint } from '../../dashboard.types';

@Component({
  selector: 'app-dashboard-line-chart',
  template: `<div #host class="dash-line-chart"></div>`,
  styles: `
    .dash-line-chart {
      width: 100%;
      height: 240px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardLineChartComponent implements AfterViewInit, OnDestroy {
  readonly points = input.required<SeriesPoint[] | RollingMetricPoint[]>();
  readonly color = input('#34d399');
  readonly height = input(240);

  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Line'> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      if (this.series) {
        this.series.setData(this.toData(this.points()));
        this.chart?.timeScale().fitContent();
      }
    });
  }

  ngAfterViewInit(): void {
    const host = this.hostRef().nativeElement;
    host.style.height = `${this.height()}px`;
    this.chart = createChart(host, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(38, 43, 55, 0.5)' },
        horzLines: { color: 'rgba(38, 43, 55, 0.5)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#262b37' },
      timeScale: { borderColor: '#262b37', timeVisible: true },
      width: host.clientWidth,
      height: this.height(),
    });
    this.series = this.chart.addSeries(LineSeries, {
      color: this.color(),
      lineWidth: 2,
      priceLineVisible: false,
    });
    this.series.setData(this.toData(this.points()));
    this.chart.timeScale().fitContent();
    this.resizeObserver = new ResizeObserver(() => {
      this.chart?.applyOptions({ width: host.clientWidth });
    });
    this.resizeObserver.observe(host);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.remove();
  }

  private toData(points: SeriesPoint[] | RollingMetricPoint[]): LineData<Time>[] {
    return points.map((p) => ({
      time: p.date as Time,
      value: p.value,
    }));
  }
}
