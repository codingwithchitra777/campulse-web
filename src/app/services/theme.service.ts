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
