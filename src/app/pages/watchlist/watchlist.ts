import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { MoneyPipe } from '../../utils/money';
import { CurrencyCode, MarketKind, NewsItem, WatchlistItem } from '../../models';

/** Track symbols you don't own; live quotes per market + Finnhub news for US symbols. */
@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [CommonModule, FormsModule, MoneyPipe],
  templateUrl: './watchlist.html'
})
export class WatchlistComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);
  readonly GOLD_SYMBOL = 'XAU-KH';

  readonly watchlist = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getWatchlist(),
    defaultValue: { items: [] as WatchlistItem[] }
  });

  market: MarketKind = 'CSX';
  symbolInput = '';
  readonly adding = signal(false);
  readonly error = signal<string | null>(null);

  // News (US symbols only).
  readonly expandedKey = signal<string | null>(null);
  readonly news = signal<NewsItem[]>([]);
  readonly newsLoading = signal(false);

  get currency(): CurrencyCode {
    return this.market === 'CSX' ? 'KHR' : 'USD';
  }

  onMarketChange() {
    this.symbolInput = this.market === 'GOLD_KH' ? this.GOLD_SYMBOL : '';
  }

  add() {
    const symbol = (this.market === 'GOLD_KH' ? this.GOLD_SYMBOL : this.symbolInput).trim().toUpperCase();
    if (!symbol) {
      this.error.set('Enter a symbol');
      return;
    }
    this.adding.set(true);
    this.error.set(null);
    this.api.addWatchlist({ symbol, market: this.market, currency: this.currency }).subscribe({
      next: () => {
        this.adding.set(false);
        this.symbolInput = this.market === 'GOLD_KH' ? this.GOLD_SYMBOL : '';
        this.watchlist.reload();
      },
      error: (err) => {
        this.adding.set(false);
        this.error.set(err.error?.detail || 'Failed to add');
      }
    });
  }

  remove(item: WatchlistItem) {
    this.api.removeWatchlist(item.symbol, item.market).subscribe({
      next: () => this.watchlist.reload(),
      error: (err) => this.error.set(err.error?.detail || 'Failed to remove')
    });
  }

  recordTrade(item: WatchlistItem) {
    this.router.navigate(['/record-trade']);
  }

  keyOf(item: WatchlistItem): string {
    return `${item.market}:${item.symbol}`;
  }

  toggleNews(item: WatchlistItem) {
    const key = this.keyOf(item);
    if (this.expandedKey() === key) {
      this.expandedKey.set(null);
      return;
    }
    this.expandedKey.set(key);
    this.news.set([]);
    this.newsLoading.set(true);
    this.api.getSymbolNews(item.symbol).subscribe({
      next: (res) => {
        this.news.set(res.news || []);
        this.newsLoading.set(false);
      },
      error: () => this.newsLoading.set(false)
    });
  }
}
