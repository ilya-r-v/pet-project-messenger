import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, switchMap, tap, finalize, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Router } from '@angular/router';
import { AuthResponse, User } from '../../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'accessToken';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isReadySubject = new BehaviorSubject<boolean>(false);
  public isReady$ = this.isReadySubject.asObservable();

  public isRefreshing = false;
  public refreshSubject$ = new BehaviorSubject<string | null>(null);

  constructor(
    private apiService: ApiService,
    private router: Router,
  ) {}

  init(): Promise<void> {
    const token = this.getAccessToken();

    if (!token) {
      this.isReadySubject.next(true);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.apiService
        .getMe()
        .pipe(
          tap((user) => this.currentUserSubject.next(user)),
          catchError(() => {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) {
              this.clearTokens();
              return of(null);
            }
            return this.executeRefresh(refreshToken).pipe(
              switchMap(() => this.apiService.getMe()),
              tap((user) => this.currentUserSubject.next(user)),
              catchError(() => {
                this.clearTokens();
                return of(null);
              }),
            );
          }),
          finalize(() => {
            this.isReadySubject.next(true);
            resolve();
          }),
        )
        .subscribe();
    });
  }

  executeRefresh(refreshToken: string): Observable<string> {
    this.isRefreshing = true;
    this.refreshSubject$.next(null);

    return this.apiService.refresh(refreshToken).pipe(
      tap((response) => this.setTokens(response.accessToken, response.refreshToken)),
      map((response) => response.accessToken),
      tap((newToken) => this.refreshSubject$.next(newToken)),
      finalize(() => (this.isRefreshing = false)),
    );
  }

  login(credentials: { email: string; password: string }): Observable<User> {
    return this.apiService.login(credentials).pipe(
      switchMap((response) => {
        this.setTokens(response.accessToken, response.refreshToken);
        return this.apiService.getMe();
      }),
      tap((user) => this.currentUserSubject.next(user)),
    );
  }

  register(data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Observable<User> {
    return this.apiService.register(data);
  }

  logout(): void {
    this.clearTokens();
    this.router.navigate(['/auth/login']);
  }

  refreshToken(refreshToken: string): Observable<AuthResponse> {
    return this.apiService.refresh(refreshToken).pipe(
      tap((response) => this.setTokens(response.accessToken, response.refreshToken)),
    );
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    this.currentUserSubject.next(null);
  }
}