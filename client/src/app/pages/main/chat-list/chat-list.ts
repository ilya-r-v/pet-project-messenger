import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Chat } from '../../../models/chat.model';
import { ChatService } from '../../../core/services/chat.service';
import { SocketService } from '../../../core/services/socket.service';
import { Subscription } from 'rxjs';
import { User } from '../../../models/user.model';
import { CryptoService } from '../../../core/services/crypto.service';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [FormsModule, DatePipe], 
  templateUrl: './chat-list.html',
  styleUrls: ['./chat-list.scss'],
})
export class ChatListComponent implements OnInit, OnDestroy {
  @Input() chats: Chat[] = [];
  @Input() activeChatId: string | null = null;
  @Input() currentUserId: string = '';
  
  @Output() chatSelected = new EventEmitter<string>();
  @Output() chatDeleted = new EventEmitter<string>();
  @Output() chatCreated = new EventEmitter<Chat>();

  showForm = false;
  newChatUserId = '';
  errorMessage = '';
  private msgSub?: Subscription;
  onlineUsers: string[] = [];

  constructor(
    private chatService: ChatService, 
    private socketService: SocketService,
    private cryptoService: CryptoService
  ) {}

  ngOnInit(): void {
    this.msgSub = this.socketService.onMessage().subscribe(msg => {
      const chat = this.chats.find(c => c.id === msg.chatId);
      if (chat) {
        chat.lastMessage = msg;
        if (chat.id !== this.activeChatId) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
        }
        this.chats = [
          chat,
          ...this.chats.filter(c => c.id !== msg.chatId)
        ];
      }
    });
    this.socketService.onlineUsers$.subscribe(users => {
      this.onlineUsers = users;
    });
  }
  isOnline(chat: Chat): boolean {
    const otherParticipant = chat.participants?.find(p => p.id !== this.currentUserId);
    return otherParticipant ? this.onlineUsers.includes(otherParticipant.id) : false;
  }

  selectChat(chatId: string): void {
    const chat = this.chats.find(c => c.id === chatId);
    if (chat) {
      chat.unreadCount = 0;
    }
    this.chatSelected.emit(chatId);
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    this.newChatUserId = '';
    this.errorMessage = '';
  }

  createChat(): void {
    if (!this.newChatUserId.trim()) return;

    this.chatService.createDirect(this.newChatUserId.trim()).subscribe({
      next: (chat) => {
        this.chatCreated.emit(chat);
        this.chatSelected.emit(chat.id);
        this.toggleForm();
      },
      error: () => {
        this.errorMessage = 'Пользователь не найден';
      },
    });
  }

  deleteChat(event: Event, chatId: string): void {
    event.stopPropagation();
    this.chatService.deleteChat(chatId).subscribe({
      next: () => this.chatDeleted.emit(chatId),
    });
  }

  async createGroup(name: string, selectedUsers: User[]) {
    const sodium = await this.cryptoService.getSodium();
    const roomKey = await this.cryptoService.generateRoomKey();
    const roomKeyBase64 = sodium.to_base64(roomKey);

    const participantKeys = await Promise.all(selectedUsers.map(async (user) => {
      const pubKey = await this.cryptoService.getRecipientPublicKey(user.id);
      const encryptedK = await this.cryptoService.encrypt(roomKeyBase64, pubKey!);
      return {
        userId: user.id,
        encryptedRoomKey: encryptedK
      };
    }));

    this.chatService.createGroup(name, participantKeys).subscribe({
      next: (chat) => {
        this.chatCreated.emit(chat);
        this.chatSelected.emit(chat.id);
        this.toggleForm();
      },
      error: (err) => {
        this.errorMessage = 'Не удалось создать группу';
        console.error(err);
      }
    });
  }

  ngOnDestroy(): void {
    this.msgSub?.unsubscribe();
  }
}