import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { SessionService } from './session.service';
import { GOOGLE_CLIENT_ID } from '../app.constants';

/** Options accepted by google.accounts.id.renderButton. */
export type GsiButtonOptions = Record<string, string | number>;

/**
 * Single owner of the Google Identity Services (GSI) integration.
 * Previously the init + hardcoded client ID were duplicated in App and
 * LoginComponent; both now delegate here.
 */
@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  /**
   * Render the GSI sign-in button into the given element, retrying until the
   * async GSI script (loaded in index.html) is available.
   *
   * @param onSignedIn called after the credential is verified by the backend
   *                   and the session profile is set.
   */
  renderButton(elementId: string, options: GsiButtonOptions, onSignedIn?: () => void): void {
    this.tryRenderButton(elementId, options, onSignedIn, 0);
  }

  private tryRenderButton(
    elementId: string,
    options: GsiButtonOptions,
    onSignedIn: (() => void) | undefined,
    attempt: number
  ): void {
    setTimeout(() => {
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        // GSI script not loaded yet — retry (bounded, so tests/offline don't loop forever).
        if (attempt < 100) this.tryRenderButton(elementId, options, onSignedIn, attempt + 1);
        return;
      }
      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) =>
            this.handleCredential(response.credential, onSignedIn)
        });
        const el = document.getElementById(elementId);
        if (el) {
          google.accounts.id.renderButton(el, options);
        }
      } catch (err) {
        console.error('Failed to initialize Google Sign-In:', err);
      }
    }, attempt === 0 ? 100 : 300);
  }

  /** Demo login: mints a real backend-issued token for a caller-chosen user id, same as Google sign-in. */
  demoLogin(userId: string, name: string, onSignedIn?: () => void): void {
    this.api.demoLogin(userId, name).subscribe({
      next: (res) => {
        if (!res.success) return;
        this.session.setProfile({
          userId: res.userId,
          name: res.userName,
          email: res.email,
          token: res.token,
          role: res.role
        });
        onSignedIn?.();
      },
      error: (err) => {
        console.error('Demo login failed', err);
        const errMsg = err.error?.detail || err.error?.error || 'Demo login failed';
        alert('Demo Login Failed: ' + errMsg);
      }
    });
  }

  private handleCredential(credential: string, onSignedIn?: () => void): void {
    this.api.googleLogin(credential).subscribe({
      next: (res) => {
        if (!res.success) return;
        this.session.setProfile({
          userId: res.userId,
          name: res.userName,
          email: res.email,
          token: res.token,
          role: res.role
        });
        onSignedIn?.();
      },
      error: (err) => {
        console.error('Google Sign-In failed', err);
        const errMsg = err.error?.detail || err.error?.error || 'Invalid credentials';
        alert('Google Authentication Failed: ' + errMsg);
      }
    });
  }
}
