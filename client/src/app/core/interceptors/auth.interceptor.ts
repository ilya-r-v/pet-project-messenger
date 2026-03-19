import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, filter, switchMap, take, throwError } from 'rxjs';
import { Router } from '@angular/router';

const AUTH_URLS = ['/auth/refresh', '/auth/login', '/auth/register'];

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (AUTH_URLS.some((url) => req.url.includes(url))) {
    return next(req);
  }

  const authReq = addToken(req, authService.getAccessToken());

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      if (authService.isRefreshing) {
        return authService.refreshSubject$.pipe(
          filter((token): token is string => token !== null),
          take(1),
          switchMap((token) => next(addToken(req, token))),
        );
      }
      const refreshToken = authService.getRefreshToken();

      if (!refreshToken) {
        authService.logout();
        router.navigate(['/auth/login']);
        return throwError(() => error);
      }

      return authService.executeRefresh(refreshToken).pipe(
        switchMap((newAccessToken) => next(addToken(req, newAccessToken))),
        catchError((refreshError) => {
          authService.logout();
          router.navigate(['/auth/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function addToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token) return req;
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}