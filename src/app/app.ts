import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { SessionService } from './services/session.service';
import { GoogleAuthService } from './services/google-auth.service';
import { TelegramAuthService } from './services/telegram-auth.service';
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
  private readonly telegramAuth = inject(TelegramAuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  
  showProfileDropdown = false;
  currentLang = 'en';

  readonly sidebarCollapsed = signal(localStorage.getItem('sidebar_collapsed') === '1');
  
  // New State Signals for Layout Redesign
  premiumModalFeature = signal<string | null>(null);
  showNotifications = false;
  notifications = signal<any[]>([
    { title: 'Welcome to CamPulse Premium', time: 'Just now', read: false },
    { title: 'CSX Market is now open', time: '2 hours ago', read: false },
    { title: 'Lot matching complete', time: '1 day ago', read: true }
  ]);
  
  marketStatus = signal<{ open: boolean, text: string }>({ open: false, text: 'CSX Closed' });

  // Sidebar Menu State
  menuState = signal({
    home: true,
    markets: false,
    trading: false,
    analysis: false,
    records: false,
    finance: false,
    admin: false
  });

  toggleMenu(section: keyof ReturnType<typeof this.menuState>) {
    this.menuState.update(s => ({ ...s, [section]: !s[section] }));
  }

  mobileMoreMenuOpen = false;
  // Mobile-only account sheet (the 5th bottom-nav slot). Absorbs what used to be
  // the "More" popup + the top-right profile dropdown into one surface on phones.
  mobileAccountOpen = false;

  toggleMobileAccount(event?: Event) {
    event?.stopPropagation();
    this.mobileAccountOpen = !this.mobileAccountOpen;
    this.showNotifications = false;
    this.showProfileDropdown = false;
  }

  closeMobileAccount() {
    this.mobileAccountOpen = false;
  }

  toggleMobileMoreMenu() {
    this.mobileMoreMenuOpen = !this.mobileMoreMenuOpen;
  }

  toggleSidebar() {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
    localStorage.setItem('sidebar_collapsed', this.sidebarCollapsed() ? '1' : '0');
  }

  switchLanguage(lang: string) {
    this.translate.use(lang);
    this.currentLang = lang;
    localStorage.setItem('lang', lang);
    if (lang === 'km') {
      document.documentElement.classList.add('lang-km');
    } else {
      document.documentElement.classList.remove('lang-km');
    }
  }
  
  updateMarketStatus() {
    const now = new Date();
    // Convert to Cambodia time (UTC+7)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const cambodiaTime = new Date(utc + 3600000 * 7);
    
    const day = cambodiaTime.getDay(); // 0 = Sun, 6 = Sat
    const hour = cambodiaTime.getHours();
    
    const isWeekend = day === 0 || day === 6;
    const isWorkingHours = hour >= 8 && hour < 15; // 8:00 AM - 3:00 PM
    
    if (isWeekend) {
      this.marketStatus.set({ open: false, text: 'CSX Closed (Weekend)' });
    } else if (!isWorkingHours) {
      this.marketStatus.set({ open: false, text: 'CSX Closed' });
    } else {
      this.marketStatus.set({ open: true, text: 'CSX Open' });
    }
  }

  isLoginPage = signal(false);

  constructor() {
    const savedLang = localStorage.getItem('lang') || 'en';
    this.translate.setFallbackLang('en');
    this.translate.use(savedLang);

    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        this.isLoginPage.set(this.router.url.split('?')[0].endsWith('/login'));
      }
    });
    this.currentLang = savedLang;
    
    if (savedLang === 'km') {
      document.documentElement.classList.add('lang-km');
    } else {
      document.documentElement.classList.remove('lang-km');
    }
    
    this.updateMarketStatus();
    // Check status every minute
    setInterval(() => this.updateMarketStatus(), 60000);

    // Inside the Telegram Mini App, sign the user in from initData silently.
    this.telegramAuth.autoLoginFromWebApp();

    // A new profile (login / user switch) means a new avatar URL: clear any
    // stale broken-image flag so the picture gets a fresh chance to load.
    effect(() => {
      this.session.googleProfile();
      this.avatarBroken.set(false);
    });

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

  // --- New Nav Methods ---

  get unreadNotificationsCount(): number {
    return this.notifications().filter(n => !n.read).length;
  }

  toggleNotifications(event: Event) {
    event.stopPropagation();
    this.showNotifications = !this.showNotifications;
    this.showProfileDropdown = false;
  }

  markNotificationsRead() {
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
  }

  openPremiumModal(feature: string, event: Event) {
    event.preventDefault();
    this.premiumModalFeature.set(feature);
  }

  closePremiumModal() {
    this.premiumModalFeature.set(null);
  }
  
  onSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    console.log('Searching for:', target.value);
  }

  // --- Profile Methods ---

  toggleProfileDropdown(event: Event) {
    if (this.sidebarCollapsed()) {
      this.sidebarCollapsed.set(false);
      localStorage.setItem('sidebar_collapsed', '0');
    }
    this.showProfileDropdown = !this.showProfileDropdown;
    this.showNotifications = false;
    event.stopPropagation();
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

  // Set when the provider avatar URL fails to load, so we fall back to initials.
  // Reset on every auth change (see effect in constructor).
  readonly avatarBroken = signal(false);

  /** Provider avatar URL (Google/Telegram), or null to fall back to initials. */
  profilePicture(): string | null {
    if (this.avatarBroken()) return null;
    return this.session.googleProfile()?.picture ?? null;
  }

  onAvatarError() {
    this.avatarBroken.set(true);
  }

  logoutGoogle() {
    this.session.logout();
    this.closeProfileDropdown();
    this.router.navigate(['/login']);
  }

  refreshActivePage() {
    const currentUrl = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate([currentUrl]);
    });
  }
}
