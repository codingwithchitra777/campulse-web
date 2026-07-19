import { Injectable, effect, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'theme';

export type Theme = 'dark' | 'light' | 'glass';

/**
 * Theme state. Applied as a class on <body> (e.g. `body.light` or `body.glass`);
 * dark is the default and needs no class. Persisted across sessions.
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  readonly theme = signal<Theme>(restoreTheme());

  constructor() {
    // Sync with the Telegram theme only when actually running inside Telegram.
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
      document.body.classList.remove('light', 'glass');
      if (this.theme() !== 'dark') {
        document.body.classList.add(this.theme());
      }
      localStorage.setItem(THEME_STORAGE_KEY, this.theme());
    });
  }

  toggle() {
    this.theme.update((t) => {
      if (t === 'dark') return 'light';
      if (t === 'light') return 'glass';
      return 'dark';
    });
  }
}

function restoreTheme(): Theme {
  const t = localStorage.getItem(THEME_STORAGE_KEY);
  if (t === 'light' || t === 'glass') return t as Theme;
  return 'dark';
}
