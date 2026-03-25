import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chat } from '../../../models/chat.model';
import { ChatService } from '../../../core/services/chat.service';


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

  constructor(private chatService: ChatService) {}

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
    if (!chat.messages?.length) return 'Нет сообщений';
    const last = chat.messages[chat.messages.length - 1];
    return last.content.length > 30
      ? last.content.slice(0, 30) + '...'
      : last.content;
  }
}