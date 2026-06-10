import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';

import type { AssetSymbol, TradeDirection } from '../../../core/models/database.types';
import { ASSET_SYMBOL_OPTIONS, TRADE_DIRECTION_OPTIONS } from '../../../core/supabase/enum-options';
import { symbolRiskCalibration } from '../execution-block.constants';
import { computeRiskRewardMetrics, formatUsd } from '../execution-risk.utils';

@Component({
  selector: 'app-risk-reward-calculator',
  imports: [CurrencyPipe, FormsModule, SelectModule, InputNumberModule, MessageModule],
  templateUrl: './risk-reward-calculator.component.html',
  styleUrl: './risk-reward-calculator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskRewardCalculatorComponent {
  readonly defaultSymbol = input<AssetSymbol | null>(null);

  protected readonly symbolOptions = ASSET_SYMBOL_OPTIONS;
  protected readonly directionOptions = TRADE_DIRECTION_OPTIONS;
  protected readonly formatUsd = formatUsd;

  protected readonly symbol = signal<AssetSymbol>('EURUSD');
  protected readonly direction = signal<TradeDirection>('LONG');
  protected readonly entryPrice = signal<number | null>(null);
  protected readonly stopPrice = signal<number | null>(null);
  protected readonly targetPrice = signal<number | null>(null);
  protected readonly volume = signal<number | null>(1);

  protected readonly calibration = computed(() => symbolRiskCalibration(this.symbol()));

  protected readonly priceDecimals = computed(() => this.calibration().priceDecimals);

  protected readonly metrics = computed(() =>
    computeRiskRewardMetrics({
      symbol: this.symbol(),
      direction: this.direction(),
      entry_price: this.entryPrice(),
      stop_price: this.stopPrice(),
      target_price: this.targetPrice(),
      volume: this.volume(),
    }),
  );

  protected readonly rrLabel = computed(() => {
    const metrics = this.metrics();
    if (!metrics?.r_target) {
      return '—';
    }
    return `${metrics.r_target}R`;
  });

  constructor() {
    effect(() => {
      const next = this.defaultSymbol();
      if (next) {
        this.symbol.set(next);
      }
    });
  }

  protected onSymbolChange(value: AssetSymbol | null): void {
    if (value) {
      this.symbol.set(value);
    }
  }

  protected onDirectionChange(value: TradeDirection | null): void {
    if (value) {
      this.direction.set(value);
    }
  }
}
