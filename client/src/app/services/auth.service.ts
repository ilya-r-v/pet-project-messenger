import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

@Injectable({
    providedIn: 'root'
})

export class AuthService {
    private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    public isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();

    login(username: string, password: string): boolean {
        if (username == 'user' && password == 'pass') {
            this.isAuthenticatedSubject.next(true);
            return true;
        }
        return false;
    }

    logout(): void {
        this.isAuthenticatedSubject.next(false);
    }

    get isAuthenticated(): boolean {
        return this.isAuthenticatedSubject.value;
    }
}