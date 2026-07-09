import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionService } from '../services/session.service';
import { API_BASE_URL } from '../app.constants';

/**
 * Attaches the Authorization bearer token to every backend request, so no
 * ApiService method can forget it. Guests (no profile) send no header.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE_URL)) {
    return next(req);
  }
  const session = inject(SessionService);
  const token = session.googleProfile()?.token;
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
