import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { PagerComponent } from '../../components/pager/pager';
import { MoneyPipe } from '../../utils/money';
import { Paginated, Price, Trade } from '../../models';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

/** Backend caps page size at 200; used when the CSV export walks all pages. */
const EXPORT_PAGE_SIZE = 200;

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent, TranslatePipe, MoneyPipe],
  templateUrl: './history.html'
})
export class HistoryComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly translate = inject(TranslateService);

  readonly offset = signal(0);
  readonly limit = signal(50);
  readonly marketFilter = signal('');
  readonly tickerFilter = signal('');
  readonly exporting = signal(false);

  readonly trades = rxResource({
    params: () => ({
      userId: this.session.activeUserId(),
      offset: this.offset(),
      limit: this.limit(),
      ticker: this.tickerFilter(),
      market: this.marketFilter()
    }),
    stream: ({ params }) => this.api.getTrades(params.ticker || undefined, params.limit, params.offset, params.market || undefined),
    defaultValue: { items: [], total: 0, limit: 50, offset: 0 } as Paginated<Trade>
  });

  // Filter dropdown options — same source record-trade uses for its ticker select.
  readonly tickers = rxResource({
    stream: () => this.api.getPrices(),
    defaultValue: [] as Price[]
  });

  // Slide-in drawer, same pattern as PortfolioComponent.selectedHolding.
  readonly editingTrade = signal<Trade | null>(null);
  editTicker = '';
  editPrice = 0;
  editQty = 0;
  editCommission = 0;
  editDate = '';
  readonly today = new Date().toISOString().split('T')[0];

  constructor() {
    // Switching users mid-browse could otherwise leave the page on an offset
    // that's out of range for the new user's trade count.
    effect(() => {
      this.session.activeUserId();
      this.offset.set(0);
      this.tickerFilter.set('');
    });
  }

  setFilter(ticker: string) {
    this.tickerFilter.set(ticker);
    this.offset.set(0);
  }

  setMarketFilter(market: string) {
    this.marketFilter.set(market);
    if (market !== 'CSX') {
      this.tickerFilter.set('');
    }
    this.offset.set(0);
  }

  setLimit(limit: number) {
    this.limit.set(limit);
    this.offset.set(0);
  }

  exportCsv() {
    if (this.exporting()) return;
    this.exporting.set(true);
    const ticker = this.tickerFilter() || undefined;
    const market = this.marketFilter() || undefined;
    const rows: Trade[] = [];

    const fetchPage = (offset: number) => {
      this.api.getTrades(ticker, EXPORT_PAGE_SIZE, offset, market).subscribe({
        next: (page) => {
          rows.push(...page.items);
          if (rows.length < page.total && page.items.length > 0) {
            fetchPage(offset + EXPORT_PAGE_SIZE);
          } else {
            this.downloadCsv(rows);
            this.exporting.set(false);
          }
        },
        error: (err) => {
          this.exporting.set(false);
          alert('Failed to export trades: ' + (err.error?.detail || 'Unknown error'));
        }
      });
    };
    fetchPage(0);
  }

  private downloadCsv(rows: Trade[]) {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ['Seq', 'Ticker', 'Side', 'Qty', 'Price', 'Subtotal', 'Commission', 'OrderDate'];
    const lines = [
      header.join(','),
      ...rows.map((t) =>
        [t.seq, esc(t.ticker), t.side, t.qty, t.price, t.qty * t.price, t.commission, esc(t.orderDate)].join(',')
      )
    ];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const suffix = this.tickerFilter() ? `_${this.tickerFilter()}` : '';
    a.href = url;
    a.download = `trades${suffix}_${this.today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  startEdit(t: Trade) {
    this.editTicker = t.ticker;
    this.editPrice = t.price;
    this.editQty = t.qty;
    this.editCommission = t.commission;
    this.editDate = t.orderDate.slice(0, 10);
    this.editingTrade.set(t);
  }

  closeDrawer() {
    this.editingTrade.set(null);
  }

  saveEdit() {
    const tradeId = this.editingTrade()?.tradeId;
    if (!tradeId) return;
    this.api
      .updateTrade(tradeId, {
        ticker: this.editTicker,
        price: this.editPrice,
        qty: this.editQty,
        commission: this.editCommission,
        ...(this.editDate ? { orderDate: this.editDate } : {})
      })
      .subscribe({
        next: () => {
          this.editingTrade.set(null);
          this.trades.reload();
        },
        error: (err) => alert('Failed to update trade: ' + (err.error?.detail || 'Unknown error'))
      });
  }

  deleteTrade(t: Trade) {
    if (!confirm(this.translate.instant('HISTORY.CONFIRM_DELETE'))) return;
    this.api.deleteTrade(t.tradeId).subscribe({
      next: () => this.trades.reload(),
      error: (err) => alert('Failed to delete trade: ' + (err.error?.detail || 'Unknown error'))
    });
  }
}
