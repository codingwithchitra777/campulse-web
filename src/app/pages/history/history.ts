import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { Trade } from '../../models';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.html'
})
export class HistoryComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  readonly trades = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getTrades(),
    defaultValue: [] as Trade[]
  });
}
