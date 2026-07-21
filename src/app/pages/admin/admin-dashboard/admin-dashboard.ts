import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../../services/api.service';
import { SessionService } from '../../../services/session.service';
import { MoneyPipe } from '../../../utils/money';
import { AdminStats, ManualPrice } from '../../../models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MoneyPipe, TranslatePipe],
  templateUrl: './admin-dashboard.html'
})
export class AdminDashboardComponent {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  readonly stats = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getAdminStats(),
    defaultValue: { totalUsers: 0, totalTrades: 0, totalRealisedPnl: 0 } as AdminStats
  });

  // Local gold board (admin-set price for XAU-KH).
  readonly manualPrices = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getManualPrices(),
    defaultValue: { items: [] as ManualPrice[] }
  });
  goldBidPrice: number | null = null;
  goldAskPrice: number | null = null;
  readonly goldSaving = signal(false);
  readonly goldMsg = signal<string | null>(null);

  saveGoldPrice() {
    if (!this.goldBidPrice || !this.goldAskPrice || this.goldBidPrice <= 0 || this.goldAskPrice <= 0) {
      this.goldMsg.set('Enter positive Bid and Ask prices');
      return;
    }
    // Calculate nominal price as the mid price between bid and ask
    const nominalPrice = (this.goldBidPrice + this.goldAskPrice) / 2;

    this.goldSaving.set(true);
    this.goldMsg.set(null);
    this.api.setManualPrice({ 
      price: nominalPrice, 
      bidPrice: this.goldBidPrice,
      askPrice: this.goldAskPrice,
      market: 'GOLD_KH', 
      symbol: 'XAU-KH', 
      currency: 'USD' 
    }).subscribe({
      next: () => {
        this.goldSaving.set(false);
        this.goldMsg.set('Saved ✓');
        this.manualPrices.reload();
      },
      error: (err) => {
        this.goldSaving.set(false);
        this.goldMsg.set(err.error?.detail || 'Failed to save');
      }
    });
  }
}
