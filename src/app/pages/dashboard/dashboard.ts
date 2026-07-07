import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html'
})
export class DashboardComponent implements OnInit {
  readonly apiService = inject(ApiService);

  readonly loadingPrices = signal<boolean>(false);
  readonly prices = signal<any[]>([]);
  
  readonly portfolio = signal<any[]>([]);
  readonly topTickers = signal<any[]>([]);
  readonly topOrders = signal<any[]>([]);

  ngOnInit() {
    this.loadPrices();
    if (!this.apiService.isGuest()) {
      this.loadPersonalDashboardData();
    }
  }

  loadPrices() {
    this.loadingPrices.set(true);
    this.apiService.getPrices().subscribe({
      next: (data) => {
        this.prices.set(data);
        this.loadingPrices.set(false);
      },
      error: () => this.loadingPrices.set(false)
    });
  }

  loadPersonalDashboardData() {
    this.apiService.getPortfolio().subscribe({
      next: (data) => this.portfolio.set(data)
    });
    this.apiService.getTopTickers().subscribe({
      next: (data) => this.topTickers.set(data)
    });
    this.apiService.getTopOrders().subscribe({
      next: (data) => this.topOrders.set(data)
    });
  }

  get totalRealisedPnl(): number {
    return this.portfolio().reduce((sum, h) => sum + (h.realisedPnl || 0), 0);
  }

  get totalUnrealisedPnl(): number {
    return this.portfolio().reduce((sum, h) => sum + (h.unrealisedPnl || 0), 0);
  }

  get totalPnl(): number {
    return this.totalRealisedPnl + this.totalUnrealisedPnl;
  }
}
