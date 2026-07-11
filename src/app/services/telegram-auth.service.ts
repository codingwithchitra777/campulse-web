import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { SessionService } from './session.service';
import { TelegramAuthPayload } from '../models';
import { TELEGRAM_BOT_USERNAME } from '../app.constants';

/**
 * Third login path alongside GoogleAuthService's GSI + demo flows.
 * The Telegram Login Widget is an injected <script> that renders its own
 * button and invokes a global callback with a signed user payload; the
 * backend verifies the HMAC with the bot token and mints the same JWT
 * profile shape as the other logins.
 *
 * Note: Telegram only renders the button on the domain registered with
 * @BotFather via /setdomain — on other origins the container stays empty.
 */
@Injectable({
  providedIn: 'root'
})
export class TelegramAuthService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  renderButton(elementId: string, onSignedIn?: () => void): void {
    const el = document.getElementById(elementId);
    if (!el || el.childElementCount > 0) return;

    (window as any).onTelegramAuth = (user: TelegramAuthPayload) =>
      this.handleAuth(user, onSignedIn);

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '20');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    el.appendChild(script);
  }

  /**
   * Mini App path: when the site is opened inside Telegram (launched from the
   * bot), telegram-web-app.js populates window.Telegram.WebApp.initData with a
   * signed payload identifying the user — log them in silently. No-op in a
   * regular browser or when already signed in.
   */
  autoLoginFromWebApp(): void {
    const webApp = (window as any).Telegram?.WebApp;
    const initData: string = webApp?.initData || '';
    if (!initData || !this.session.isGuest()) return;

    webApp.ready?.();
    this.api.telegramWebAppLogin(initData).subscribe({
      next: (res) => {
        if (!res.success) return;
        this.setProfileFromResponse(res);
      },
      error: (err) => console.error('Telegram Mini App auto-login failed', err)
    });
  }

  private handleAuth(user: TelegramAuthPayload, onSignedIn?: () => void): void {
    this.api.telegramLogin(user).subscribe({
      next: (res) => {
        if (!res.success) return;
        this.setProfileFromResponse(res);
        onSignedIn?.();
      },
      error: (err) => {
        console.error('Telegram Sign-In failed', err);
        const errMsg = err.error?.detail || err.error?.error || 'Invalid credentials';
        alert('Telegram Authentication Failed: ' + errMsg);
      }
    });
  }

  private setProfileFromResponse(res: {
    userId: string; userName: string; email: string | null; token: string; role: string;
  }): void {
    this.session.setProfile({
      userId: res.userId,
      name: res.userName,
      email: res.email,
      token: res.token,
      role: res.role
    });
  }
}
