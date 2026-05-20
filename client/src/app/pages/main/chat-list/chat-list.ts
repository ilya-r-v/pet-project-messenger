import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, SimpleChanges, OnChanges } from '@angular/core';
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
export class ChatListComponent implements OnInit, OnDestroy, OnChanges {
  @Input() chats: Chat[] = [];
  decryptedPreviews = new Map<string, string>();

  

  @Input() activeChatId: string | null = null;
  @Input() currentUserId: string = '';
  
  @Output() chatSelected = new EventEmitter<string>();
  @Output() chatDeleted = new EventEmitter<string>();
  @Output() chatCreated = new EventEmitter<Chat>();

  showForm = false;
  isGroupMode = false;
  
  newChatUserId = '';
  groupName = '';
  groupParticipants = ''; 
  
  errorMessage = '';
  private msgSub?: Subscription;
  onlineUsers: string[] = [];

  constructor(
    private chatService: ChatService, 
    private socketService: SocketService,
    private cryptoService: CryptoService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chats'] && this.chats) {
      this.decryptAllPreviews();
    }
  }

  ngOnInit(): void {
    this.msgSub = this.socketService.onMessage().subscribe(async msg => {
      const chat = this.chats.find(c => c.id === msg.chatId);
      if (chat) {
        chat.lastMessage = msg;
        
        await this.decryptPreview(chat);

        if (chat.id !== this.activeChatId) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
        }
        
        this.chats = [chat, ...this.chats.filter(c => c.id !== msg.chatId)];
      }
    });

    this.socketService.onlineUsers$.subscribe(users => {
      this.onlineUsers = users;
    });
  }

  private async decryptAllPreviews() {
    for (const chat of this.chats) {
      await this.decryptPreview(chat);
    }
  }

  private async decryptPreview(chat: Chat): Promise<void> {
    const msg = chat.lastMessage;
    if (!msg || !msg.content) return;
    
    if (msg.content.startsWith('[e2ee]:')) {
      try {
        const privKey = await this.cryptoService.loadPrivateKey();
        if (privKey) {
          const decrypted = await this.cryptoService.decrypt(msg.content, privKey);
          this.decryptedPreviews.set(chat.id, decrypted);
          return;
        }
      } catch (e) {
        this.decryptedPreviews.set(chat.id, '🔒 Зашифровано');
        return;
      }
    }

    try {
      const cleanBase64 = msg.content.replace('[e2ee]:', '');
      const decoded = decodeURIComponent(atob(cleanBase64));
      this.decryptedPreviews.set(chat.id, decoded);
    } catch {
      this.decryptedPreviews.set(chat.id, msg.content);
    }
  }

  getPreviewText(chat: Chat): string {
    if (!chat.lastMessage) return 'Нет сообщений';
    const decrypted = this.decryptedPreviews.get(chat.id);
    
    if (decrypted?.startsWith('[image]:')) return '📷 Фотография';
    return decrypted || 'Расшифровка...';
  }

  isOnline(chat: Chat): boolean {
    const participants = (chat as any).participantObjects;
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return false;
    }

    const otherParticipant = participants.find((p: any) => 
      p.userId && this.currentUserId && p.userId.toLowerCase() !== this.currentUserId.toLowerCase()
    );

    if (!otherParticipant || !otherParticipant.userId) {
      return false;
    }

    const targetId = otherParticipant.userId.toLowerCase();
    return this.onlineUsers.some(onlineUserId => onlineUserId.toLowerCase() === targetId);
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
    this.isGroupMode = false;
    this.newChatUserId = '';
    this.groupName = '';
    this.groupParticipants = '';
    this.errorMessage = '';
  }

  createChat(): void {
    if (!this.newChatUserId.trim()) return;

    const email = this.newChatUserId.trim();

    this.chatService.createDirectByEmail(email).subscribe({
      next: (chat) => {
        this.chatCreated.emit(chat);
        this.chatSelected.emit(chat.id);
        this.toggleForm();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Пользователь не найден';
      },
    });
  }

  private async decryptLastMessages() {
    const privKey = await this.cryptoService.loadPrivateKey();
    if (!privKey) return;

    for (const chat of this.chats) {
      if (chat.lastMessage && chat.lastMessage.content?.startsWith('[e2ee]:')) {
        try {
          const decrypted = await this.cryptoService.decrypt(
            chat.lastMessage.content, 
            privKey
          );
          chat.lastMessage.content = decrypted;
        } catch (e) {
          console.error(`[ChatList] Ошибка расшифровки чата ${chat.id}:`, e);
          chat.lastMessage.content = '🔒 Ошибка расшифровки';
        }
      }
    }
  }

  async onGroupSubmit() {
    if (!this.groupName.trim() || !this.groupParticipants.trim()) {
      this.errorMessage = 'Заполните название и список ID';
      return;
    }

    const ids = this.groupParticipants.split(',').map(id => id.trim()).filter(id => id.length > 0);
    const users: User[] = ids.map(id => ({ id } as User));

    if (!users.find(u => u.id === this.currentUserId)) {
      users.push({ id: this.currentUserId } as User);
    }

    await this.createGroup(this.groupName, users);
  }

  async createGroup(name: string, selectedUsers: User[]) {
    try {
      const sodium = await this.cryptoService.getSodium();
      const roomKey = await this.cryptoService.generateRoomKey();
      const roomKeyBase64 = sodium.to_base64(roomKey);

      const participantKeys = await Promise.all(selectedUsers.map(async (user) => {
        const pubKey = await this.cryptoService.getRecipientPublicKey(user.id);
        if (!pubKey) throw new Error(`Ключ для пользователя ${user.id} не найден`);
        
        const encryptedK = await this.cryptoService.encrypt(roomKeyBase64, pubKey);
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
          this.errorMessage = 'Не удалось создать группу на сервере';
          console.error(err);
        }
      });
    } catch (err: any) {
      this.errorMessage = err.message || 'Ошибка при подготовке ключей';
    }
  }

  deleteChat(event: Event, chatId: string): void {
    event.stopPropagation();
    this.chatService.deleteChat(chatId).subscribe({
      next: () => this.chatDeleted.emit(chatId),
    });
  }

  ngOnDestroy(): void {
    this.msgSub?.unsubscribe();
  }
}