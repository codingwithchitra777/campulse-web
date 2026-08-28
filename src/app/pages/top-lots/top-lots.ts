import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { ClosedLot, OpenLot } from '../../models';
import { MoneyPipe } from '../../utils/money';
import { TranslatePipe } from '@ngx-translate/core';

type LotTab = 'open' | 'closed';
const PAGE = 10;

/**
 * Top Lots — the user's most profitable lots, two tabs:
 *  - Open:   currently-held buy lots ranked by unrealized P/L (needs live prices)
 *  - Closed: matched buy lots ranked by realized P/L (from allocations)
 *
 * Each tab loads 10 rows, then infinite-scrolls the next 10 via an
 * IntersectionObserver on a sentinel. Imperative (append-on-scroll), but the
 * user-switch reset is driven by an effect on session.activeUserId() so it
 * still refetches on login/logout like the rxResource pages.
 */
@Component({
  selector: 'app-top-lots',
  standalone: true,
  imports: [CommonModule, TranslatePipe, MoneyPipe],
  templateUrl: './top-lots.html'
})
export class TopLotsComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  readonly tab = signal<LotTab>('open');
  readonly error = signal<string | null>(null);

  // Open tab state
  readonly openItems = signal<OpenLot[]>([]);
  readonly openLoading = signal(false);
  readonly openTotal = signal(0);
  private openOffset = 0;
  private openHasMore = true;
  private openLoaded = false;

  // Closed tab state
  readonly closedItems = signal<ClosedLot[]>([]);
  readonly closedLoading = signal(false);
  readonly closedTotal = signal(0);
  private closedOffset = 0;
  private closedHasMore = true;
  private closedLoaded = false;

  @ViewChild('sentinel') sentinel?: ElementRef<HTMLElement>;
  private observer?: IntersectionObserver;

  constructor() {
    // Refetch everything when the user changes (login/logout/switch).
    effect(() => {
      this.session.activeUserId();
      this.resetAll();
      this.loadActive();
    });
  }

  ngAfterViewInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) this.loadMore();
      },
      { rootMargin: '200px' }
    );
    if (this.sentinel) this.observer.observe(this.sentinel.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  setTab(t: LotTab) {
    if (this.tab() === t) return;
    this.tab.set(t);
    this.error.set(null);
    this.loadActive();
  }

  /** Load the current tab's first page if it hasn't been loaded yet. */
  private loadActive() {
    if (this.tab() === 'open') {
      if (!this.openLoaded) this.loadOpen();
    } else {
      if (!this.closedLoaded) this.loadClosed();
    }
  }

  /** Called by the sentinel — fetch the next page of whichever tab is active. */
  loadMore() {
    if (this.tab() === 'open') {
      if (this.openHasMore && !this.openLoading()) this.loadOpen();
    } else {
      if (this.closedHasMore && !this.closedLoading()) this.loadClosed();
    }
  }

  private loadOpen() {
    this.openLoading.set(true);
    this.error.set(null);
    this.api.getOpenLots(PAGE, this.openOffset).subscribe({
      next: (page) => {
        this.openItems.update((cur) => [...cur, ...page.items]);
        this.openTotal.set(page.total);
        this.openHasMore = page.hasMore;
        this.openOffset += PAGE;
        this.openLoaded = true;
        this.openLoading.set(false);
      },
      error: (err) => {
        this.openLoading.set(false);
        this.openLoaded = true;
        this.error.set(err.error?.detail || 'Failed to load open lots.');
      }
    });
  }

  private loadClosed() {
    this.closedLoading.set(true);
    this.error.set(null);
    this.api.getClosedLots(PAGE, this.closedOffset).subscribe({
      next: (page) => {
        this.closedItems.update((cur) => [...cur, ...page.items]);
        this.closedTotal.set(page.total);
        this.closedHasMore = page.hasMore;
        this.closedOffset += PAGE;
        this.closedLoaded = true;
        this.closedLoading.set(false);
      },
      error: (err) => {
        this.closedLoading.set(false);
        this.closedLoaded = true;
        this.error.set(err.error?.detail || 'Failed to load closed lots.');
      }
    });
  }

  private resetAll() {
    this.openItems.set([]);
    this.openOffset = 0;
    this.openHasMore = true;
    this.openLoaded = false;
    this.openTotal.set(0);
    this.closedItems.set([]);
    this.closedOffset = 0;
    this.closedHasMore = true;
    this.closedLoaded = false;
    this.closedTotal.set(0);
  }

  // template helpers
  get isOpen(): boolean {
    return this.tab() === 'open';
  }
  get activeHasMore(): boolean {
    return this.isOpen ? this.openHasMore : this.closedHasMore;
  }
  get activeLoading(): boolean {
    return this.isOpen ? this.openLoading() : this.closedLoading();
  }
  trackLot = (_: number, l: { buyTradeId: string }) => l.buyTradeId;
}
