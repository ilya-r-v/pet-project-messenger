import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (req.url.includes('/auth/refresh') || req.url.includes('/auth/login') || req.url.includes('/auth/register')) {
        return next(req);
    }

    const accessToken = authService.getAccessToken();
    let authReq = req;
    if (accessToken) {
        authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${accessToken}` }
        });
    }

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !req.url.includes('/auth/me')) {
            const refreshToken = authService.getRefreshToken();
            if (refreshToken) {
                return authService.refreshToken(refreshToken).pipe(
                    switchMap((response) => {
                        authService.setTokens(response.accessToken, response.refreshToken);
                        const newReq = req.clone({
                        setHeaders: { Authorization: `Bearer ${response.accessToken}` }
                        });
                        return next(newReq);
                    }),
                    catchError(refreshError => {
                        authService.logout();
                        router.navigate(['/auth/login']);
                        return throwError(() => refreshError);
                    })
                );
            } else {
            authService.logout();
            router.navigate(['/auth/login']);
            }
        }
        return throwError(() => error);
        })
    );
};