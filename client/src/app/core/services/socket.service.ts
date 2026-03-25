import { Injectable, OnDestroy } from '@angular/core';
import { Observable, fromEvent } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { Message } from '../../models/chat.model';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket!: Socket;
  private readonly WS_URL = 'http://localhost:3000';

  constructor(private authService: AuthService) {}

  connect(): void {
    if (this.socket?.connected) return;

    const token = this.authService.getAccessToken();

    this.socket = io(this.WS_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('[WS] Connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    this.socket.on('error', (err) => {
      console.error('[WS] Error:', err);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  joinRoom(chatId: string): void {
    this.socket.emit('joinRoom', { chatId });
  }

  leaveRoom(chatId: string): void {
    this.socket.emit('leaveRoom', { chatId });
  }

  sendMessage(chatId: string, content: string): void {
    this.socket.emit('sendMessage', { chatId, content });
  }

  onMessage(): Observable<Message> {
    return new Observable(observer => {
      this.socket.on('newMessage', (msg: Message) => {
        observer.next(msg);
      });
      return () => this.socket.off('newMessage');
    });
  }

  getHistory(chatId: string, cursor?: string, limit = 50): void {
    this.socket.emit('getHistory', { chatId, cursor, limit });
  }

  onHistory(): Observable<{ chatId: string; messages: Message[] }> {
    return new Observable(observer => {
      this.socket.on('history', (data) => {
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
  }

  onMessagesRead(): Observable<{ chatId: string; readBy: string }> {
    return new Observable(observer => {
      this.socket.on('messagesRead', (data) => {
        observer.next(data);
      });
      return () => this.socket.off('messagesRead');
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}