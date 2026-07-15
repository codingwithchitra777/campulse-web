import { isDevMode } from '@angular/core';

/** Single source of truth for values that were previously duplicated across services/components. */
export const API_BASE_URL = isDevMode() ? 'http://localhost:8080' : 'https://campulse-backend.fastapicloud.dev';

export const GOOGLE_CLIENT_ID =
  '1048965896991-dirq98278c5cj312k2o0kq3f307e2krf.apps.googleusercontent.com';

/** Public username of the bot behind TELEGRAM_BOT_TOKEN (verified via getMe).
 * The Login Widget only renders on the domain registered with @BotFather (/setdomain). */
export const TELEGRAM_BOT_USERNAME = 'CamboPulseBot';

/** Local sentinel id for anonymous visitors; never sent to the backend (guests carry no token). */
export const GUEST_USER_ID = 'guest';

/** localStorage key holding the persisted GoogleProfile session. */
export const PROFILE_STORAGE_KEY = 'google_profile';
