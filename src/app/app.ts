import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SessionService } from './services/session.service';
import { GoogleAuthService } from './services/google-auth.service';
import { ThemeService } from './services/theme.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly session = inject(SessionService);
  protected readonly theme = inject(ThemeService);
  private readonly googleAuth = inject(GoogleAuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  
  showProfileDropdown = false;
  currentLang = 'en';

  readonly sidebarCollapsed = signal(localStorage.getItem('sidebar_collapsed') === '1');

  toggleSidebar() {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
    localStorage.setItem('sidebar_collapsed', this.sidebarCollapsed() ? '1' : '0');
  }

  switchLanguage(lang: string) {
    this.translate.use(lang);
    this.currentLang = lang;
    localStorage.setItem('lang', lang);
  }

  constructor() {
    const savedLang = localStorage.getItem('lang') || 'en';
    this.translate.setFallbackLang('en');
    this.translate.use(savedLang);
    this.currentLang = savedLang;

    // Re-render the header sign-in button whenever auth state changes
    // (the #googleBtn container only exists in the DOM while signed out).
    effect(() => {
      if (this.session.isGuest()) {
        this.googleAuth.renderButton('googleBtn', {
          type: 'standard',
          shape: 'rectangular',
          theme: 'dark',
          text: 'signin_with',
          size: 'medium',
          logo_alignment: 'left'
        });
        // No onSignedIn navigation needed: pages key their data on
        // activeUserId(), so they refetch automatically after login.
      }
    });
  }

  toggleProfileDropdown(event: Event) {
    event.stopPropagation();
    this.showProfileDropdown = !this.showProfileDropdown;
  }

  closeProfileDropdown() {
    this.showProfileDropdown = false;
  }

  getUserInitials(): string {
    const profile = this.session.googleProfile();
    if (!profile || !profile.name) return 'GP';
    const parts = profile.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  }

  logoutGoogle() {
    this.session.logout();
    this.router.navigate(['/dashboard']);
  }

  refreshActivePage() {
    const currentUrl = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate([currentUrl]);
    });
  }
}
