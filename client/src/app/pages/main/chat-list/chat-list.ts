import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chat } from '../../../models/chat.model';
import { ChatService } from '../../../core/services/chat.service';
import { SocketService } from '../../../core/services/socket.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-list.html',
  styleUrls: ['./chat-list.scss'],
})
export class ChatListComponent {
  @Input() chats: Chat[] = [];
  @Input() activeChatId: string | null = null;
  @Output() chatSelected = new EventEmitter<string>();
  @Output() chatDeleted = new EventEmitter<string>();
  @Output() chatCreated = new EventEmitter<Chat>();

  showForm = false;
  newChatUserId = '';
  errorMessage = '';
  private msgSub?: Subscription;

  constructor(private chatService: ChatService, private socketService: SocketService) {}

  ngOnInit(): void {
    this.msgSub = this.socketService.onMessage().subscribe(msg => {
      const chat = this.chats.find(c => c.id === msg.chatId);
      if (chat) {
        if (!chat.messages) chat.messages = [];
        
        if (!chat.messages.some(m => m.id === msg.id)) {
          chat.messages.push(msg);
          this.chats = [
            chat,
            ...this.chats.filter(c => c.id !== msg.chatId)
          ];
        }
      }
    });
  }

  selectChat(chatId: string): void {
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

  getLastMessage(chat: Chat): string {
    const messages = chat.messages || [];
    if (messages.length === 0) return 'Нет сообщений';
    
    const last = messages[messages.length - 1];
    const content = last.content || '';
    
    return content.length > 30
      ? content.slice(0, 30) + '...'
      : content;
  }

  ngOnDestroy(): void {
    this.msgSub?.unsubscribe();
  }
}