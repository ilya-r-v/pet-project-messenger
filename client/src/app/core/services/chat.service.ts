import { Injectable } from "@angular/core";
import { ApiService } from './api.service';
import { BehaviorSubject, Observable, tap } from "rxjs";
import { Chat, Message } from "../../models/chat.model";

@Injectable({providedIn: 'root'})
export class ChatService {
    private baseUrl = 'http://localhost:3000/api';
    
    private chatsSubject = new BehaviorSubject<Chat[]>([]);
    public chats$ = this.chatsSubject.asObservable();

    constructor(private apiService: ApiService) {}

    getChats(): Observable<Chat[]> {
        return this.apiService.getChats().pipe(
            tap(chats => this.chatsSubject.next(chats))
        );
    }

    incrementUnread(chatId: string) {
        const currentChats = this.chatsSubject.value;
        const chatIndex = currentChats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
            const updatedChat = { 
                ...currentChats[chatIndex], 
                unreadCount: (currentChats[chatIndex].unreadCount || 0) + 1 
            };
            currentChats[chatIndex] = updatedChat;
            this.chatsSubject.next([...currentChats]);
        }
    }

    resetUnreadCount(chatId: string) {
        const currentChats = this.chatsSubject.value;
        const chatIndex = currentChats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
            currentChats[chatIndex] = { ...currentChats[chatIndex], unreadCount: 0 };
            this.chatsSubject.next([...currentChats]);
        }
    }

    createDirect(targetUserId: string): Observable<Chat> {
        return this.apiService.createDirect(targetUserId);
    }

    createGroup(name: string, participants: { userId: string, encryptedRoomKey: string }[]): Observable<Chat> {
        return this.apiService.createGroup(name, participants).pipe(
            tap(newChat => {
                const currentChats = this.chatsSubject.value;
                this.chatsSubject.next([newChat, ...currentChats]);
            })
        );
    }

    getMessages(chatId: string, afterId?: string): Observable<Message[]> {
        return this.apiService.getMessages(chatId, afterId);
    }

    search(chatId: string, query: string): Observable<Message[]> {
        return this.apiService.searchMessages(chatId, query);
    }

    deleteChat(chatId: string): Observable<void> {
        return this.apiService.deleteChat(chatId);
    }
}