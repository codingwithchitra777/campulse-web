import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { ThemeService } from '../../services/theme.service';
import { LinkCodeResponse, LinkedAccount } from '../../models';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Account settings — "Connected accounts". Lets a signed-in (Google) user link a
 * Telegram account: we mint a one-time code and open the bot deep link
 * (t.me/<bot>?start=<code>); the bot redeems it and links telegram_id -> this
 * account (see campulse-backend telegram_bot._start). Also lists/disconnects links.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class SettingsComponent {
  protected readonly session = inject(SessionService);
  protected readonly theme = inject(ThemeService);
  private readonly api = inject(ApiService);

  readonly connecting = signal(false);
  readonly linkCode = signal<LinkCodeResponse | null>(null);
  readonly error = signal<string | null>(null);

  readonly links = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getLinks(),
    defaultValue: { success: true, links: [] as LinkedAccount[] }
  });

  connectTelegram() {
    this.connecting.set(true);
    this.error.set(null);
    this.api.createLinkCode().subscribe({
      next: (res) => {
        this.linkCode.set(res);
        this.connecting.set(false);
        window.open(res.deepLink, '_blank');
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Failed to create a link code.');
        this.connecting.set(false);
      }
    });
  }

  disconnect(link: LinkedAccount) {
    const label = link.userName || link.aliasUserId;
    if (!confirm(`Disconnect Telegram account "${label}"? Its future bot activity will no longer post to this portfolio.`)) return;
    this.api.removeLink(link.aliasUserId).subscribe({
      next: () => this.links.reload(),
      error: (err) => alert('Failed to disconnect: ' + (err.error?.detail || 'Unknown error'))
    });
  }

  toggleMarketOverview() {
    const profile = this.session.googleProfile();
    if (!profile) return;
    const current = profile.marketOverviewEnabled ?? true;
    const next = !current;
    
    // Optimistic update
    this.session.setProfile({ ...profile, marketOverviewEnabled: next });
    
    this.api.updateMarketOverviewSettings(next).subscribe({
      error: (err) => {
        // Revert on error
        this.session.setProfile({ ...profile, marketOverviewEnabled: current });
        alert('Failed to update setting: ' + (err.error?.detail || 'Unknown error'));
      }
    });
  }
}
