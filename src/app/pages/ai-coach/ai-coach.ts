import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { CoachInsight } from '../../models';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

/**
 * The Coach. The free rule-based readout loads via rxResource like every other
 * page; the AI pass is an optional extra behind an explicit button, because it
 * costs real money server-side — it must never fire on page load.
 */
@Component({
  selector: 'app-ai-coach',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './ai-coach.html'
})
export class AiCoachComponent {
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);
  protected readonly session = inject(SessionService);

  readonly coach = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getCoachInsight(),
    defaultValue: {
      insight: '', source: 'rules', disclaimer: '', aiEnabled: false, ai: null
    } as CoachInsight
  });

  readonly refreshing = signal(false);
  readonly refreshError = signal<string | null>(null);

  refreshAi(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.refreshError.set(null);
    this.api.refreshCoachInsight().subscribe({
      next: () => {
        this.refreshing.set(false);
        this.coach.reload(); // re-read GET so free + AI stay one source of truth
      },
      error: (err: HttpErrorResponse) => {
        this.refreshing.set(false);
        // 429 (daily limit, with retry time) and 409 (too few closed trades)
        // carry human-readable details from the backend; show those verbatim.
        const detail = err.error?.detail;
        this.refreshError.set(
          (err.status === 429 || err.status === 409) && detail
            ? detail
            : this.translate.instant('COACH.AI_ERROR')
        );
      }
    });
  }
}
