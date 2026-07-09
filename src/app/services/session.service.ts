import { Injectable, computed, signal } from '@angular/core';
import { GoogleProfile } from '../models';
import { GUEST_USER_ID, PROFILE_STORAGE_KEY } from '../app.constants';

/**
 * Holds the auth/session state (previously mixed into ApiService).
 *
 * The profile signal is the single source of truth: activeUserId and isGuest
 * are derived from it, so they can never drift apart. Pages that key their
 * data on activeUserId() refetch automatically on login/logout — no page
 * reload needed.
 */
@Injectable({
  providedIn: 'root'
})
export class SessionService {
  readonly googleProfile = signal<GoogleProfile | null>(restoreProfile());

  readonly activeUserId = computed(() => this.googleProfile()?.userId ?? GUEST_USER_ID);

  readonly isGuest = computed(() => this.googleProfile() === null);

  readonly isAdmin = computed(() => this.googleProfile()?.role === 'admin');

  setProfile(profile: GoogleProfile) {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    this.googleProfile.set(profile);
  }

  logout() {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    this.googleProfile.set(null);
  }
}

/** Restore the cached session from localStorage, clearing it if corrupted. */
function restoreProfile(): GoogleProfile | null {
  const cached = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as GoogleProfile;
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    return null;
  }
}
