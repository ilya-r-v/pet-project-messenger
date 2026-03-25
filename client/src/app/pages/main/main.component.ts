import { Component, OnInit } from '@angular/core';
import { ChatService } from '../../core/services/chat.service';
import { Chat } from '../../models/chat.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [FormsModule],
  styleUrls: ['./main.component.scss'],
  templateUrl: './main.component.html',
})
export class MainComponent implements OnInit {
  
  constructor(
    private chatService: ChatService,
  ) {}

  chats: Chat[] = [];

  targetUserId = '';
  formForGroup = { name: '', memberIds: '' };

  ngOnInit(): void {
    this.loadChats()
  }

  loadChats() {
    this.chatService.getChats().subscribe(data => {
      this.chats = data;
    });
  }

  createChat() {
    if (!this.targetUserId) return;

    this.chatService.createDirect(this.targetUserId).subscribe({
      next: (chat) => {
        this.targetUserId = '';
        this.loadChats();
      },
      error: (err) => console.error('Ошибка', err)
    })
  }

  createGroup() {
    const memberIds = this.formForGroup.memberIds.split(',').map(id => id.trim());

    this.chatService.createGroup({name: this.formForGroup.name, memberIds}).subscribe({
      next: (chat) => {
        this.loadChats();
        console.log('Группа создана:', chat );
      },
      error: (err) => console.log("Ошибка:", err)
    })
  }

  deleteChat(chatId: string) {
    this.chatService.deleteChat(chatId).subscribe({
      next: () => {
        this.chats = this.chats.filter(c => c.id !== chatId);
      },
      error: (err) => console.error(err)
    });
  }
}