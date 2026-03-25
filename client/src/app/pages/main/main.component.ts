import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { Chat } from '../../models/chat.model';
import { User } from '../../models/user.model';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { ChatListComponent } from './chat-list/chat-list';
import { ChatWindowComponent } from './chat-window/chat-window';


@Component({
  selector: 'app-main',
  standalone: true,
  imports: [ChatListComponent, ChatWindowComponent],
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
export class MainComponent implements OnInit {
  chats: Chat[] = [];
  activeChatId: string | null = null;
  currentUser!: User;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private socketService: SocketService,
  ) {}

  ngOnInit(): void {
    this.socketService.connect();

    this.authService.currentUser$.subscribe(user => {
      if (user) this.currentUser = user;
    });

    this.loadChats();
  }

  loadChats(): void {
    this.chatService.getChats().subscribe(data => {
      this.chats = data;
    });
  }

  get activeChat(): Chat | undefined {
    return this.chats.find(c => c.id === this.activeChatId);
  }

  onChatSelect(chatId: string): void {
    this.activeChatId = chatId;
  }

  onChatDelete(chatId: string): void {
    this.chats = this.chats.filter(c => c.id !== chatId);
    if (this.activeChatId === chatId) {
      this.activeChatId = null;
    }
  }

  onChatCreated(chat: Chat): void {
    const exists = this.chats.find(c => c.id === chat.id);
    if (!exists) {
      this.chats = [chat, ...this.chats];
    }
  }
}