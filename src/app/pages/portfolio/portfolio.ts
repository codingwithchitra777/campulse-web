import { Component, computed, inject, signal, effect, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { Holding, HoldingView, PositionSell } from '../../models';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './portfolio.html'
})
export class PortfolioComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);
  private readonly translateService = inject(TranslateService);

  // View query for the Chart canvas
  readonly performanceCanvas = viewChild<ElementRef<HTMLCanvasElement>>('performanceCanvas');

  readonly portfolio = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getPortfolio().pipe(map((holdings) => holdings.map(toHoldingView))),
    defaultValue: [] as HoldingView[]
  });

  readonly selectedHolding = signal<HoldingView | null>(null);

  // Loads whenever a holding is selected; idle while nothing is selected.
  // Switching selection cancels the in-flight request automatically.
  readonly holdingDetails = rxResource({
    params: () => this.selectedHolding()?.ticker,
    stream: ({ params: ticker }) => this.api.getPosition(ticker)
  });

  // Timeline chart resource
  readonly timelineResource = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getChartsTimeline(),
    defaultValue: null as any
  });

  readonly activePeriod = signal<'1W' | '1M' | '3M' | '6M' | 'ALL'>('3M');
  private chartInstance: any = null;

  constructor() {
    // Setup reactive effect to automatically build/rebuild the chart
    effect(() => {
      const canvasRef = this.performanceCanvas();
      const rawData = this.timelineResource.value();
      const period = this.activePeriod();
      // Re-trigger chart build when language changes
      const lang = this.translateService.currentLang;
      
      if (canvasRef && rawData) {
        this.buildChart(canvasRef.nativeElement, rawData, period);
      }
    });
  }

  ngOnDestroy() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }

  setPeriod(period: '1W' | '1M' | '3M' | '6M' | 'ALL') {
    this.activePeriod.set(period);
  }

  selectHolding(holding: HoldingView) {
    this.selectedHolding.set(holding);
  }

  /**
   * Unrealised P/L of a single buy lot: what the still-open quantity gains or
   * loses at the current market price vs its buy price. Null when the lot is
   * fully sold or no market price is available.
   */
  lotPnl(lot: { qtyOpen: number; price: number }): number | null {
    const lastPrice = this.selectedHolding()?.lastPrice ?? null;
    if (lastPrice === null || lot.qtyOpen <= 0) return null;
    return lot.qtyOpen * (lastPrice - lot.price);
  }

  /** Price move of an open buy lot vs the current market price, in percent. */
  lotPnlPercent(lot: { qtyOpen: number; price: number }): number | null {
    const lastPrice = this.selectedHolding()?.lastPrice ?? null;
    if (lastPrice === null || lot.qtyOpen <= 0 || lot.price <= 0) return null;
    return ((lastPrice - lot.price) / lot.price) * 100;
  }

  /** Realised P/L of a sell over the cost basis of its LIFO-matched buy lots, in percent. */
  sellPnlPercent(sell: PositionSell): number | null {
    const costBasis = sell.matched.reduce((sum, m) => sum + m.qty * m.price, 0);
    if (costBasis <= 0) return null;
    return (sell.pnl / costBasis) * 100;
  }

  private translate(key: string, defaultValue: string): string {
    const val = this.translateService.instant(key);
    return val === key ? defaultValue : val;
  }

  private mergeTimeline(data: any): { dates: string[], invested: number[], equity: number[] } {
    if (!data) {
      return { dates: [], invested: [], equity: [] };
    }

    const investment = data.investment || [];
    const pnl = data.pnl || [];

    const dateSet = new Set<string>();
    investment.forEach((item: any) => { if (item.date) dateSet.add(item.date); });
    pnl.forEach((item: any) => { if (item.date) dateSet.add(item.date); });

    const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const dates: string[] = [];
    const invested: number[] = [];
    const equity: number[] = [];

    let lastInvested = 0;
    let lastRecovered = 0;
    let lastPnl = 0;

    sortedDates.forEach((dateStr) => {
      const invItem = investment.find((x: any) => x.date === dateStr);
      if (invItem) {
        lastInvested = invItem.invested ?? lastInvested;
        lastRecovered = invItem.recovered ?? lastRecovered;
      }

      const pnlItem = pnl.find((x: any) => x.date === dateStr);
      if (pnlItem) {
        lastPnl = pnlItem.cumulativePnl ?? lastPnl;
      }

      const activePrincipal = Math.max(0, lastInvested - lastRecovered);
      const activeEquity = Math.max(0, activePrincipal + lastPnl);

      dates.push(dateStr);
      invested.push(activePrincipal);
      equity.push(activeEquity);
    });

    const activePositions = this.portfolio.value();
    if (activePositions && activePositions.length > 0) {
      let livePrincipal = 0;
      let liveEquity = 0;

      activePositions.forEach((h) => {
        if (h.avgCostRemaining && h.remainingQty) {
          const cost = h.avgCostRemaining * h.remainingQty;
          livePrincipal += cost;
          liveEquity += (h.lastPrice ?? h.avgCostRemaining) * h.remainingQty;
        }
      });

      const todayStr = new Date().toISOString().split('T')[0];
      
      if (dates.length > 0 && dates[dates.length - 1] === todayStr) {
        invested[invested.length - 1] = livePrincipal;
        equity[equity.length - 1] = liveEquity;
      } else {
        dates.push(todayStr);
        invested.push(livePrincipal);
        equity.push(liveEquity);
      }
    }

    return { dates, invested, equity };
  }

  private filterByPeriod(dates: string[], invested: number[], equity: number[], period: string) {
    if (dates.length === 0) return { dates, invested, equity };

    const cutoffDate = new Date();
    if (period === '1W') cutoffDate.setDate(cutoffDate.getDate() - 7);
    else if (period === '1M') cutoffDate.setMonth(cutoffDate.getMonth() - 1);
    else if (period === '3M') cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    else if (period === '6M') cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    else return { dates, invested, equity }; // 'ALL'

    const cutoffTime = cutoffDate.getTime();
    const startIndex = dates.findIndex(d => new Date(d).getTime() >= cutoffTime);

    if (startIndex === -1) {
      return {
        dates: [dates[dates.length - 1]],
        invested: [invested[invested.length - 1]],
        equity: [equity[equity.length - 1]]
      };
    }

    return {
      dates: dates.slice(startIndex),
      invested: invested.slice(startIndex),
      equity: equity.slice(startIndex)
    };
  }

  private buildChart(canvas: HTMLCanvasElement, rawData: any, period: string) {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const { dates: fullDates, invested: fullInvested, equity: fullEquity } = this.mergeTimeline(rawData);
    const { dates, invested, equity } = this.filterByPeriod(fullDates, fullInvested, fullEquity, period);

    if (dates.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const equityGradient = ctx.createLinearGradient(0, 0, 0, 320);
    equityGradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    equityGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    const formattedLabels = dates.map(d => {
      const date = new Date(d);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: formattedLabels,
        datasets: [
          {
            label: this.translate('DASHBOARD.CHART_LEGEND_EQUITY', 'Portfolio Equity (Value)'),
            data: equity,
            borderColor: '#10b981',
            borderWidth: 3,
            backgroundColor: equityGradient,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#10b981',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
          },
          {
            label: this.translate('DASHBOARD.CHART_LEGEND_PRINCIPAL', 'Total Principal (Invested)'),
            data: invested,
            borderColor: '#3b82f6',
            borderWidth: 2,
            borderDash: [5, 5],
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: '#3b82f6',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#f3f4f6',
              font: {
                family: "'Outfit', 'Kantumruy Pro', sans-serif",
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: '#111827',
            titleColor: '#f3f4f6',
            bodyColor: '#9ca3af',
            borderColor: '#1e293b',
            borderWidth: 1,
            titleFont: { family: "'Outfit', 'Kantumruy Pro', sans-serif", weight: 'bold' },
            bodyFont: { family: "'Outfit', 'Kantumruy Pro', sans-serif" },
            callbacks: {
              title: (items) => {
                const index = items[0].dataIndex;
                const dateVal = new Date(dates[index]);
                return dateVal.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
              },
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat().format(context.parsed.y) + ' ៛';
                }
                return label;
              },
              footer: (tooltipItems) => {
                const equityVal = tooltipItems[0].parsed.y ?? 0;
                const principalVal = tooltipItems[1] ? (tooltipItems[1].parsed.y ?? 0) : equityVal;
                const netPnl = equityVal - principalVal;
                const pnlPercent = principalVal > 0 ? ((netPnl / principalVal) * 100).toFixed(1) : '0.0';
                const sign = netPnl >= 0 ? '+' : '';
                const titleStr = this.translate('DASHBOARD.CHART_NET_PNL', 'Net P/L');
                return `${titleStr}: ${sign}${new Intl.NumberFormat().format(netPnl)} ៛ (${sign}${pnlPercent}%)`;
              }
            },
            footerFont: { family: "'Outfit', 'Kantumruy Pro', sans-serif", weight: 'bold' },
            footerColor: (tooltipItems) => {
              const equityVal = tooltipItems.tooltipItems[0].parsed.y ?? 0;
              const principalVal = tooltipItems.tooltipItems[1] ? (tooltipItems.tooltipItems[1].parsed.y ?? 0) : equityVal;
              return equityVal >= principalVal ? '#10b981' : '#ef4444';
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: '#1e293b',
              drawOnChartArea: true,
              drawTicks: false
            },
            ticks: {
              color: '#9ca3af',
              maxTicksLimit: 8,
              font: { family: "'Outfit', 'Kantumruy Pro', sans-serif" }
            }
          },
          y: {
            grid: {
              color: '#1e293b',
              drawOnChartArea: true,
              drawTicks: false
            },
            ticks: {
              color: '#9ca3af',
              font: { family: "'Outfit', 'Kantumruy Pro', sans-serif" },
              callback: (value) => {
                const valNum = Number(value);
                if (valNum >= 1000000) {
                  return (valNum / 1000000).toFixed(1) + 'M ៛';
                }
                return new Intl.NumberFormat().format(valNum) + ' ៛';
              }
            }
          }
        }
      }
    });
  }
}

/**
 * Guarantee a numeric totalPnlPercent: prefer the backend-provided value,
 * falling back to a client-side derivation over the remaining cost basis.
 */
function toHoldingView(h: Holding): HoldingView {
  if (typeof h.totalPnlPercent === 'number') {
    return { ...h, totalPnlPercent: h.totalPnlPercent };
  }
  const costBasis = (h.avgCostRemaining ?? 0) * h.remainingQty;
  return {
    ...h,
    totalPnlPercent: costBasis > 0 ? (h.totalPnl / costBasis) * 100 : 0
  };
}

