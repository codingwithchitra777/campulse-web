import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portfolio.html'
})
export class PortfolioComponent implements OnInit {
  readonly apiService = inject(ApiService);

  readonly portfolio = signal<any[]>([]);
  readonly loadingPortfolio = signal<boolean>(false);

  readonly selectedHolding = signal<any | null>(null);
  readonly holdingDetails = signal<any | null>(null);
  readonly loadingDetails = signal<boolean>(false);

  ngOnInit() {
    this.loadPortfolio();
  }

  loadPortfolio() {
    this.loadingPortfolio.set(true);
    this.apiService.getPortfolio().subscribe({
      next: (data) => {
        this.portfolio.set(data);
        this.loadingPortfolio.set(false);
      },
      error: () => this.loadingPortfolio.set(false)
    });
  }

  selectHolding(holding: any) {
    this.selectedHolding.set(holding);
    this.loadingDetails.set(true);
    this.apiService.getPosition(holding.ticker).subscribe({
      next: (data) => {
        this.holdingDetails.set(data);
        this.loadingDetails.set(false);
      },
      error: () => this.loadingDetails.set(false)
    });
  }
}
