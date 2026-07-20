import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-market-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './market-calendar.html',
  styleUrl: './market-calendar.css'
})
export class MarketCalendarComponent {
  private readonly api = inject(ApiService);

  readonly marketEvents = rxResource({
    stream: () => this.api.getMarketEvents(),
    defaultValue: { success: true, items: [] }
  });

  // Helper to determine if a date is in the past
  isPast(dateString: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(dateString);
    return eventDate < today;
  }
}
