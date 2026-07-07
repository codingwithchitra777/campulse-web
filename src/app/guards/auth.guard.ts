import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../services/api.service';

export const authGuard: CanActivateFn = (route, state) => {
  const apiService = inject(ApiService);
  const router = inject(Router);

  if (apiService.isGuest()) {
    // Redirect to login page and keep target path as returnUrl
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  return true;
};
