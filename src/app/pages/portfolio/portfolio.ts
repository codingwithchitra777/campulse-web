import { Component, computed, inject, signal, effect, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { map, of } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { Holding, HoldingView, PositionSell, YearlyPnl } from '../../models';
import { MoneyPipe } from '../../utils/money';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Chart } from 'chart.js/auto';

interface CurrencySummary {
  currency: string;
  value: number;
  invested: number;
  unrealised: number;
  realised: number;
  unrealisedPct: number;
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, TranslatePipe, MoneyPipe],
  templateUrl: './portfolio.html'
})
export class PortfolioComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);
  private readonly translateService = inject(TranslateService);

  showComingSoon() {
    alert('Coming soon');
  }

  // View queries for canvases
  readonly performanceCanvas = viewChild<ElementRef<HTMLCanvasElement>>('performanceCanvas');
  readonly allocationCanvas = viewChild<ElementRef<HTMLCanvasElement>>('allocationCanvas');

  readonly portfolio = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getPortfolio().pipe(map((holdings) => holdings.map(toHoldingView))),
    defaultValue: [] as HoldingView[]
  });

  readonly selectedHolding = signal<HoldingView | null>(null);
  
  // Layout state
  readonly activeTab = signal<'holdings' | 'performance'>('holdings');

  // Filters
  marketFilter = signal<'ALL' | 'CSX' | 'GOLD_KH' | 'US'>('ALL');
  baseCurrency = signal<'KHR' | 'USD'>('KHR');

  readonly exchangeRate = rxResource({
    stream: () => this.api.getLatestExchangeRate('USD', 'KHR')
  });

  readonly filteredPortfolio = computed(() => {
    const filter = this.marketFilter();
    return (this.portfolio.value() || []).filter(h => filter === 'ALL' || h.market === filter);
  });

  private convertToTarget(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency || !amount) return amount;
    const rateWrapper = this.exchangeRate.value();
    if (!rateWrapper?.rate) return amount; 
    
    const rate = rateWrapper.rate;
    if (fromCurrency === 'USD' && toCurrency === 'KHR') {
      return amount * rate.bidRate; 
    }
    if (fromCurrency === 'KHR' && toCurrency === 'USD') {
      return amount / rate.askRate;
    }
    return amount;
  }

  // Computed Portfolio Metrics
  readonly totalValue = computed(() => {
    return this.filteredPortfolio().reduce((sum, h) => sum + this.convertToTarget((h.lastPrice || 0) * h.remainingQty, h.currency, this.baseCurrency()), 0) || 0;
  });

  readonly investedCapital = computed(() => {
    return this.filteredPortfolio().reduce((sum, h) => sum + this.convertToTarget((h.avgCostRemaining || 0) * h.remainingQty, h.currency, this.baseCurrency()), 0) || 0;
  });

  readonly totalUnrealizedPnl = computed(() => {
    return this.filteredPortfolio().reduce((sum, h) => sum + this.convertToTarget(h.unrealisedPnl, h.currency, this.baseCurrency()), 0) || 0;
  });

  readonly activeHoldings = computed(() => {
    const active = this.filteredPortfolio().filter(h => h.remainingQty > 0);
    return active.sort((a, b) => ((b.lastPrice || 0) * b.remainingQty) - ((a.lastPrice || 0) * a.remainingQty));
  });

  readonly closedHoldings = computed(() => {
    const closed = this.filteredPortfolio().filter(h => h.remainingQty <= 0);
    return closed.sort((a, b) => b.realisedPnl - a.realisedPnl);
  });

  readonly totalUnrealizedPnlPercent = computed(() => {
    const invested = this.investedCapital();
    return invested > 0 ? (this.totalUnrealizedPnl() / invested) * 100 : 0;
  });

  readonly totalRealizedPnl = computed(() => {
    return this.filteredPortfolio().reduce((sum, h) => sum + this.convertToTarget(h.realisedPnl, h.currency, this.baseCurrency()), 0) || 0;
  });

  /**
   * Per-currency roll-up based on the filtered portfolio.
   */
  readonly currencySummaries = computed<CurrencySummary[]>(() => {
    const groups = new Map<string, CurrencySummary>();
    for (const h of this.filteredPortfolio()) {
      if (h.remainingQty <= 0 && h.realisedPnl === 0) continue;
      const cur = h.currency || 'KHR';
      const g = groups.get(cur) || { currency: cur, value: 0, invested: 0, unrealised: 0, realised: 0, unrealisedPct: 0 };
      g.value += (h.lastPrice || 0) * h.remainingQty;
      g.invested += (h.avgCostRemaining || 0) * h.remainingQty;
      g.unrealised += h.unrealisedPnl;
      g.realised += h.realisedPnl;
      groups.set(cur, g);
    }
    const out = Array.from(groups.values());
    for (const g of out) g.unrealisedPct = g.invested > 0 ? (g.unrealised / g.invested) * 100 : 0;
    // KHR first, then others alphabetically.
    return out.sort((a, b) => (a.currency === 'KHR' ? -1 : b.currency === 'KHR' ? 1 : a.currency.localeCompare(b.currency)));
  });

  // Loads whenever a holding is selected; idle while nothing is selected.
  // Switching selection cancels the in-flight request automatically.
  readonly holdingDetails = rxResource({
    params: () => this.selectedHolding()?.ticker,
    stream: ({ params: ticker }) => this.api.getPosition(ticker)
  });

  // Timeline chart resource
  readonly timelineResource = rxResource({
    params: () => ({ user: this.session.activeUserId(), market: this.marketFilter(), currency: this.baseCurrency() }),
    stream: ({ params }) => {
      if (!params.user) return of(null);
      const marketParam = params.market === 'ALL' ? undefined : params.market;
      return this.api.getChartsTimeline(marketParam, params.currency);
    },
    defaultValue: null as any
  });

  readonly activePeriod = signal<'1W' | '1M' | '3M' | '6M' | 'ALL'>('3M');
  private performanceChartInstance: any = null;
  private allocationChartInstance: any = null;

  // Realized P/L by Year summary (moved here from the dashboard)
  readonly yearlyPnl = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getYearlyPnl(),
    defaultValue: [] as YearlyPnl[]
  });

  readonly expandedYear = signal<number | null>(null);

  toggleYear(year: number) {
    this.expandedYear.set(this.expandedYear() === year ? null : year);
  }

  getLegendColor(index: number): string {
    const backgroundColors = [
      '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899',
    ];
    return backgroundColors[index % backgroundColors.length];
  }

  constructor() {
    // Setup reactive effect to automatically build/rebuild the performance chart
    effect(() => {
      const canvasRef = this.performanceCanvas();
      const rawData = this.timelineResource.value();
      const period = this.activePeriod();
      // Re-trigger chart build when language changes
      const lang = this.translateService.currentLang;
      
      if (this.timelineResource.isLoading() || this.portfolio.isLoading()) return;
      
      if (canvasRef && rawData) {
        this.buildPerformanceChart(canvasRef.nativeElement, rawData, period);
      }
    });

    // Setup reactive effect for the allocation donut chart
    effect(() => {
      const canvasRef = this.allocationCanvas();
      const activeData = this.activeHoldings();
      // Re-trigger on language change
      const lang = this.translateService.currentLang;
      
      if (this.portfolio.isLoading()) return;
      
      if (canvasRef && activeData) {
        this.buildAllocationChart(canvasRef.nativeElement, activeData);
      }
    });
  }

  ngOnDestroy() {
    if (this.performanceChartInstance) {
      this.performanceChartInstance.destroy();
    }
    if (this.allocationChartInstance) {
      this.allocationChartInstance.destroy();
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

  /** Realised P/L of a sell over the cost basis of its matched buy lots, in percent. */
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
    const realEquity = data.equity || [];

    const dateSet = new Set<string>();
    investment.forEach((item: any) => { if (item.date) dateSet.add(item.date); });
    pnl.forEach((item: any) => { if (item.date) dateSet.add(item.date); });
    realEquity.forEach((item: any) => { if (item.date) dateSet.add(item.date); });

    const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const dates: string[] = [];
    const invested: number[] = [];
    const equity: number[] = [];

    let lastInvested = 0;
    let lastRecovered = 0;
    let lastPnl = 0;
    // Market-valued equity from daily price snapshots (backend `equity` series).
    // Forward-fills between snapshots and beats the synthetic estimate below.
    let lastRealEquity: number | null = null;

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

      const realItem = realEquity.find((x: any) => x.date === dateStr);
      if (realItem) {
        lastRealEquity = realItem.value ?? lastRealEquity;
      }

      const activePrincipal = Math.max(0, lastInvested - lastRecovered);
      const activeEquity = lastRealEquity ?? Math.max(0, activePrincipal + lastPnl);

      dates.push(dateStr);
      invested.push(activePrincipal);
      equity.push(activeEquity);
    });

      const activePositions = this.filteredPortfolio();
      if (activePositions && activePositions.length > 0) {
        let livePrincipal = 0;
        let liveEquity = 0;

        activePositions.forEach((h) => {
          if (h.avgCostRemaining && h.remainingQty) {
            const cost = this.convertToTarget(h.avgCostRemaining * h.remainingQty, h.currency, this.baseCurrency());
            livePrincipal += cost;
            liveEquity += this.convertToTarget((h.lastPrice ?? h.avgCostRemaining) * h.remainingQty, h.currency, this.baseCurrency());
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

  private buildPerformanceChart(canvas: HTMLCanvasElement, rawData: any, period: string) {
    if (this.performanceChartInstance) {
      this.performanceChartInstance.destroy();
      this.performanceChartInstance = null;
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

    this.performanceChartInstance = new Chart(ctx, {
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
                if (!tooltipItems || tooltipItems.length === 0) return '';
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
            footerColor: (context) => {
              const dataPoints = context.tooltip?.dataPoints;
              if (!dataPoints || dataPoints.length === 0) return '#f3f4f6';
              const equityVal = dataPoints[0].parsed.y ?? 0;
              const principalVal = dataPoints[1] ? (dataPoints[1].parsed.y ?? 0) : equityVal;
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

  private buildAllocationChart(canvas: HTMLCanvasElement, activeHoldings: HoldingView[]) {
    if (this.allocationChartInstance) {
      this.allocationChartInstance.destroy();
      this.allocationChartInstance = null;
    }

    if (!activeHoldings || activeHoldings.length === 0) return;

    const labels = activeHoldings.map(h => h.ticker);
    const data = activeHoldings.map(h => (h.lastPrice || 0) * h.remainingQty);
    
    const backgroundColors = [
      '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899',
    ];

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.allocationChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors.slice(0, data.length),
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            titleColor: '#f3f4f6',
            bodyColor: '#9ca3af',
            borderColor: '#1e293b',
            borderWidth: 1,
            titleFont: { family: "'Outfit', 'Kantumruy Pro', sans-serif", weight: 'bold' },
            bodyFont: { family: "'Outfit', 'Kantumruy Pro', sans-serif" },
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                const total = context.dataset.data.reduce((a: any, b: any) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(2) + '%';
                return ` ៛ ${value.toLocaleString()} (${percentage})`;
              }
            }
          }
        }
      },
      plugins: [{
        id: 'centerText',
        beforeDraw: (chart) => {
          const width = chart.width;
          const height = chart.height;
          const ctx = chart.ctx;
          ctx.save();
          
          const totalHoldings = activeHoldings.length;
          
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          
          ctx.font = 'bold 24px "Outfit", sans-serif';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(totalHoldings.toString(), width / 2, (height / 2) - 10);
          
          ctx.font = '14px "Outfit", sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('Holdings', width / 2, (height / 2) + 15);
          ctx.restore();
        }
      }]
    });
  }
}

/**
 * Derived holding view with guaranteed totalPnlPercent.
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

