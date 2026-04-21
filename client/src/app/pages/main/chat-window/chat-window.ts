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
import { FileUploadComponent, UploadedFile } from '../../../shared/components/file-upload/file-upload.component';
import { UploadService } from '../../../core/services/upload.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule, DatePipe, FileUploadComponent],
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
  showUpload = false;
  shouldScroll = false;

  private subs: Subscription[] = [];
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private socketService: SocketService,
    private uploadService: UploadService) {}

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
          this.messages.push(msg);
          if (this.isImageKey(msg.content)) {
            this.loadImage(this.getImageKey(msg.content));
          }
      }})
    );

    this.subs.push(
      this.socketService.onHistory().subscribe(data => {
        if (data.chatId === this.chatId) {
          this.messages = data.messages;
          this.preloadImages(data.messages);
          this.shouldScroll = true;
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

    this.subs.push(
      this.socketService.onMessagesRead().subscribe(data => {
        if (data.chatId === this.chatId && data.readBy !== this.currentUserId) {
          this.messages.forEach(m => {
            if (m.senderId === this.currentUserId) m.isRead = true;
          });
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

  private preloadImages(messages: Message[]): void {
    messages
      .filter(m => this.isImageKey(m.content))
      .forEach(m => this.loadImage(this.getImageKey(m.content)));
  }

  
  isMyMessage(msg: any): boolean {
    const senderId = msg.senderId || msg.sender?.id;
    return String(senderId) === String(this.currentUserId);
  }

  private isUserAtBottom(): boolean {
    const threshold = 100;
    const position = this.messagesEnd.nativeElement.parentElement.scrollTop + this.messagesEnd.nativeElement.parentElement.offsetHeight;
    const height = this.messagesEnd.nativeElement.parentElement.scrollHeight;
    return height - position < threshold;
  }
  handleNewMessage(msg: Message) {
    const atBottom = this.isUserAtBottom();
    this.messages.push(msg);
    if (atBottom || msg.senderId === this.currentUserId) {
      this.shouldScroll = true;
    }
  }

  imageUrls = new Map<string, string>(); // кэш url по key

  isImageKey(content: string): boolean {
    return content.startsWith('[image]:');
  }

  getImageKey(content: string): string {
    return content.replace('[image]:', '');
  }

  loadImage(key: string): void {
    if (this.imageUrls.has(key)) return; // уже загружен

    this.uploadService.getImageUrl(key).subscribe(url => {
      this.imageUrls.set(key, url);
    });
  }

  onFileUploaded(file: UploadedFile): void {
    this.socketService.sendMessage(this.chatId, `[image]:${file.key}`);
    this.showUpload = false;
  }

  isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
  }

  toggleUpload(): void {
    this.showUpload = !this.showUpload;
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.socketService.leaveRoom(this.chatId);
  }
}