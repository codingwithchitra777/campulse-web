import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-trades',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './trades.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradesComponent {
  activeTab: 'record' | 'history' = 'record';

  constructor(private router: Router) {
    // Sync active tab with current route
    this.updateActiveTab(this.router.url);
    
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateActiveTab(event.urlAfterRedirects);
    });
  }

  private updateActiveTab(url: string) {
    if (url.includes('/trades/history')) {
      this.activeTab = 'history';
    } else {
      this.activeTab = 'record';
    }
  }
}
