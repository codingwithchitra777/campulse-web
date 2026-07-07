import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.html'
})
export class HistoryComponent implements OnInit {
  readonly apiService = inject(ApiService);

  readonly trades = signal<any[]>([]);
  readonly loadingTrades = signal<boolean>(false);

  ngOnInit() {
    this.loadTrades();
  }

  loadTrades() {
    this.loadingTrades.set(true);
    this.apiService.getTrades().subscribe({
      next: (data) => {
        this.trades.set(data);
        this.loadingTrades.set(false);
      },
      error: () => this.loadingTrades.set(false)
    });
  }
}
