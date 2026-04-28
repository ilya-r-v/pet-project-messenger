import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { Message } from '../../models/chat.model';
import { ChatService } from './chat.service';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket!: Socket;
  private readonly WS_URL = 'http://localhost:3000';

  private lastMessageId: string | null = null;
  private activeChatId: string | null = null;

  private connectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.connectedSubject.asObservable();

  private onlineUsersSubject = new BehaviorSubject<string[]>([]);
  public onlineUsers$ = this.onlineUsersSubject.asObservable();

  private messageSubject = new Subject<Message>();

  constructor(
    private authService: AuthService, 
    private chatService: ChatService
  ) {}

  connect(): void {
    if (this.socket?.connected) return;
    const token = this.authService.getAccessToken();

    this.socket = io(this.WS_URL, {
      auth: { token },
      reconnection: true,
    });

    this.socket.on('connect', () => {
      this.connectedSubject.next(true);
      console.log('[WS] Connected');
      if (this.activeChatId && this.lastMessageId) this.syncMissedMessages();
    });

    this.socket.on('disconnect', () => {
      this.connectedSubject.next(false); 
    });

    this.socket.on('presenceUpdate', (users: string[]) => {
      this.onlineUsersSubject.next(users);
    });

    this.socket.on('newMessage', (msg: Message) => {
      this.lastMessageId = msg.id;
      this.messageSubject.next(msg);
      
      if (this.activeChatId !== msg.chatId) {
        this.chatService.incrementUnread(msg.chatId);
      }
    });

    this.socket.on('messagesRead', (data: { chatId: string; readerId: string }) => {
      console.log(`[WS] Messages in chat ${data.chatId} read by ${data.readerId}`);
      
      this.chatService.resetUnreadCount(data.chatId);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  joinRoom(chatId: string): void {
    this.activeChatId = chatId;
    this.lastMessageId = null;
    this.socket.emit('joinRoom', { chatId });
    
    this.markRead(chatId);
  }

  leaveRoom(chatId: string): void {
    this.activeChatId = null;
    this.socket.emit('leaveRoom', { chatId });
  }

  sendMessage(
    chatId: string, 
    content: string, 
    type: 'text' | 'image' | 'file' = 'text', 
    thumbnailUrl?: string
  ): void {  
    this.socket.emit('sendMessage', { 
      chatId, 
      content, 
      type, 
      thumbnailUrl 
    });
  }

  onMessage(): Observable<Message> {
    return this.messageSubject.asObservable();
  }

  getHistory(chatId: string, cursor?: string, limit = 50): void {
    this.socket.emit('getHistory', { chatId, cursor, limit });
  }

  onHistory(): Observable<{ chatId: string; messages: Message[] }> {
    return new Observable(observer => {
      this.socket.on('history', (data: { chatId: string; messages: Message[] }) => {
        if (data.messages.length > 0) {
          this.lastMessageId = data.messages[data.messages.length - 1].id;
        }
        observer.next(data);
      });
      return () => this.socket.off('history');
    });
  }

  sendTyping(chatId: string, isTyping: boolean): void {
    this.socket.emit('typing', { chatId, isTyping });
  }

  onTyping(): Observable<{ chatId: string; userId: string; isTyping: boolean }> {
    return new Observable(observer => {
      this.socket.on('userTyping', (data) => {
        observer.next(data);
      });
      return () => this.socket.off('userTyping');
    });
  }

  markRead(chatId: string): void {
    this.socket.emit('markRead', { chatId });
    this.chatService.resetUnreadCount(chatId);
  }

  onMessagesRead(): Observable<{ chatId: string; readBy: string }> {
    return new Observable(observer => {
      this.socket.on('messagesRead', (data) => observer.next(data));
      return () => this.socket.off('messagesRead');
    });
  }

  private syncMissedMessages(): void {
    if (!this.activeChatId || !this.lastMessageId) return;
    
    this.chatService.getMessages(this.activeChatId, this.lastMessageId)
      .subscribe(messages => {
        if (messages.length > 0) {
          messages.forEach(msg => {
            this.lastMessageId = msg.id;
            this.messageSubject.next(msg);
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}