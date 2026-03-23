import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthResponse, User } from '../../models/user.model';
import { Chat, Message } from '../../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
    private baseUrl = 'http://localhost:3000/api';

    constructor(private http: HttpClient) {}

    register(data: { email: string; firstName: string; lastName: string; password: string }): Observable<User> {
        return this.http.post<User>(`${this.baseUrl}/auth/register`, data);
    }

    login(credentials: { email: string; password: string }): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, credentials);
    }

    refresh(refreshToken: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.baseUrl}/auth/refresh`, { refreshToken });
    }

    getMe(): Observable<User> {
        return this.http.get<User>(`${this.baseUrl}/auth/me`);
    }

    getChats(): Observable<Chat[]> {
        return this.http.get<Chat[]>(`${this.baseUrl}/chat`);
    }

    createDirect(targetUserId: string): Observable<Chat> {
        return this.http.post<Chat>(`${this.baseUrl}/chat/direct`, {targetUserId});
    }

    createGroup(data: {name: string, memberIds: string[]}): Observable<Chat> {
        return this.http.post<Chat>(`${this.baseUrl}/chat/group`, data);
    }

    getMessages(id: Chat["id"]): Observable<Message[]> {
        return this.http.get<Message[]>(`${this.baseUrl}/${id}/messages`)
    }

}