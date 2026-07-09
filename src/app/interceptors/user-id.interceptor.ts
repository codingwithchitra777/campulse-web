import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionService } from '../services/session.service';
import { API_BASE_URL } from '../app.constants';

/**
 * Attaches the X-User-Id header to every backend request, so no ApiService
 * method can forget it. The backend identifies users solely by this header.
 */
export const userIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE_URL)) {
    return next(req);
  }
  const session = inject(SessionService);
  return next(req.clone({ setHeaders: { 'X-User-Id': session.activeUserId() } }));
};
