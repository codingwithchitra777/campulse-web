import { Injectable, effect, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'theme';

export type Theme = 'dark' | 'light';

/**
 * Dark/light theme state. Applied as a `light` class on <body> so the
 * `body.light ...` overrides in styles.css take effect; dark is the default
 * and needs no class. Persisted across sessions.
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  readonly theme = signal<Theme>(restoreTheme());

  constructor() {
    // Sync with the Telegram theme only when actually running inside Telegram.
    // telegram-web-app.js defines window.Telegram.WebApp in regular browsers too
    // (with colorScheme defaulting to 'light'), but initData is only populated
    // inside the Mini App — without this gate every refresh resets to light.
    const webApp = (window as any).Telegram?.WebApp;
    if (webApp?.initData) {
      if (webApp.colorScheme) {
        this.theme.set(webApp.colorScheme === 'light' ? 'light' : 'dark');
      }
      webApp.onEvent('themeChanged', () => {
        this.theme.set(webApp.colorScheme === 'light' ? 'light' : 'dark');
      });
    }

    effect(() => {
      document.body.classList.toggle('light', this.theme() === 'light');
      localStorage.setItem(THEME_STORAGE_KEY, this.theme());
    });
  }

  toggle() {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
}

function restoreTheme(): Theme {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}
