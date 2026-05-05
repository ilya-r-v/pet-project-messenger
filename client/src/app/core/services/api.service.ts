import { HttpClient, HttpParams } from '@angular/common/http';
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

    createGroup(name: string, participants: any[]): Observable<Chat> {
        return this.http.post<Chat>(`${this.baseUrl}/chat/group`, { name, participants });
    }

    getMessages(id: Chat["id"], afterId?: string): Observable<Message[]> {
        let params = new HttpParams();
        if (afterId) params = params.set('afterId', afterId);
        return this.http.get<Message[]>(`${this.baseUrl}/chat/${id}/messages`, { params });
    }

    searchMessages(chatId: string, query: string): Observable<Message[]> {
        return this.http.get<Message[]>(`${this.baseUrl}/chat/search`, {
            params: {
                chatId: chatId,
                query: query
            }
        });
    }

    deleteChat(chatId: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/chat/${chatId}`);
    }

    savePublicKey(publicKey: string): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/users/public-key`, { publicKey });
    }

    getPublicKey(userId: string): Observable<{ publicKey: string }> {
        return this.http.get<{ publicKey: string }>(`${this.baseUrl}/users/${userId}/public-key`);
    }
}