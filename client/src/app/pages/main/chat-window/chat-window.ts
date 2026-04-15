import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Message } from '../../../models/chat.model';
import { SocketService } from '../../../core/services/socket.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.scss'],
})
export class ChatWindowComponent
  implements OnInit, OnDestroy, OnChanges, AfterViewChecked
{
  @Input() chatId!: string;
  @Input() chatName = '';
  @Input() currentUserId!: string;

  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  messages: Message[] = [];
  newMessage = '';
  typingText = '';
  private shouldScroll = false;

  private subs: Subscription[] = [];
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private socketService: SocketService) {}

  ngOnInit(): void {
    this.initSocket();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chatId'] && !changes['chatId'].firstChange) {
      const prev = changes['chatId'].previousValue;
      if (prev) this.socketService.leaveRoom(prev);
      this.messages = [];
      this.typingText = '';
      this.initSocket();
    }
  }

  private initSocket(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];

    this.socketService.joinRoom(this.chatId);
    this.socketService.getHistory(this.chatId);

    this.subs.push(
      this.socketService.onMessage().subscribe(msg => {
        if (msg.chatId === this.chatId) {
          const exists = this.messages.some(m => m.id === msg.id);
          if (!exists) {
            this.messages.push(msg);
            this.shouldScroll = true;
            this.socketService.markRead(this.chatId);
          }
        }
      })
    );

    this.subs.push(
      this.socketService.onHistory().subscribe(data => {
        if (data.chatId === this.chatId) {
          this.messages = data.messages;
          this.shouldScroll = true;
          this.socketService.markRead(this.chatId);
        }
      })
    );

    this.subs.push(
      this.socketService.onTyping().subscribe(data => {
        if (data.chatId === this.chatId && data.userId !== this.currentUserId) {
          this.typingText = data.isTyping ? 'печатает...' : '';
        }
      })
    );
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  sendMessage(): void {
    if (!this.newMessage.trim()) return;
    this.socketService.sendMessage(this.chatId, this.newMessage.trim());
    this.newMessage = '';
    this.socketService.sendTyping(this.chatId, false);
  }

  onInput(): void {
    this.socketService.sendTyping(this.chatId, true);

    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.socketService.sendTyping(this.chatId, false);
    }, 2000);
  }

  isMyMessage(msg: Message): boolean {
    return msg.senderId === this.currentUserId;
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.socketService.leaveRoom(this.chatId);
  }
}