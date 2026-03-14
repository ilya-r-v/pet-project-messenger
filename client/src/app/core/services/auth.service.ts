// auth.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Router } from '@angular/router';
import { AuthResponse, User } from '../../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessTokenKey = 'accessToken';
  private refreshTokenKey = 'refreshToken';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private isReadySubject = new BehaviorSubject<boolean>(false);
  public isReady$ = this.isReadySubject.asObservable();

  constructor(private apiService: ApiService, private router: Router) {}

  init(): Promise<void> {
    const token = this.getAccessToken();
    if (!token) {
      this.isReadySubject.next(true);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.apiService.getMe().pipe(
        tap(user => {
          this.currentUserSubject.next(user);
          this.isReadySubject.next(true);
          resolve();
        }),
        catchError(error => {
          this.clearTokens();
          this.isReadySubject.next(true);
          resolve();
          return of(null);
        })
      ).subscribe();
    });
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.accessTokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    this.currentUserSubject.next(null);
  }

  login(credentials: { email: string; password: string }): Observable<User> {
  return this.apiService.login(credentials).pipe(
    switchMap(response => {
      this.setTokens(response.accessToken, response.refreshToken);
      return this.apiService.getMe();
    }),
    tap(user => this.currentUserSubject.next(user))
  );
}

  register(data: any): Observable<User> {
    return this.apiService.register(data);
  }

  logout(): void {
    this.clearTokens();
    this.router.navigate(['/auth/login']);
  }

  refreshToken(refreshToken: string): Observable<AuthResponse> {
    return this.apiService.refresh(refreshToken).pipe(
      tap(response => {
        this.setTokens(response.accessToken, response.refreshToken);
      })
    );
  }
}