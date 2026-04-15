import { Injectable } from "@angular/core";
import { ApiService } from './api.service';
import { Observable } from "rxjs";
import { Chat, Message } from "../../models/chat.model";

@Injectable({providedIn: 'root'})
export class ChatService{
    private baseUrl = 'http://localhost:3000/api';
    constructor(private apiService: ApiService) {}

    getChats(): Observable<Chat[]> {
        return this.apiService.getChats()
    }

    createDirect(targetUserId: string): Observable<Chat> {
        return this.apiService.createDirect(targetUserId);
    }

    createGroup(data:{name: string, memberIds: string[]}): Observable<Chat>{
        return this.apiService.createGroup(data);
    }

    getMessages(chatId: string, afterId?: string): Observable<Message[]> {
        return this.apiService.getMessages(chatId, afterId);
    }

    deleteChat(chatId: string): Observable<void> {
        return this.apiService.deleteChat(chatId);
    }
}