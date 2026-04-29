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
import { Chat, Message } from '../../../models/chat.model';
import { SocketService } from '../../../core/services/socket.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { FileUploadComponent, UploadedFile } from '../../../shared/components/file-upload/file-upload.component';
import { UploadService } from '../../../core/services/upload.service';
import { SearchComponent } from './search/search.component';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule, DatePipe, FileUploadComponent, SearchComponent],
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.scss'],
})
export class ChatWindowComponent
  implements OnInit, OnDestroy, OnChanges, AfterViewChecked
{
  @Input() chatId!: string;
  @Input() chatName = '';
  @Input() currentUserId!: string;
  @Input() chat?: Chat;

  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  messages: Message[] = [];
  decryptedContents = new Map<string, string>();
  imageUrls = new Map<string, string>();

  newMessage = '';
  typingText = '';
  showUpload = false;
  shouldScroll = false;
  showSearch = false;

  private subs: Subscription[] = [];
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private sentPlaintexts = new Map<string, string>();

  constructor(
    private socketService: SocketService,
    private uploadService: UploadService,
    private cryptoService: CryptoService,
  ) {}

  ngOnInit(): void {
    this.initSocket();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chatId'] && !changes['chatId'].firstChange) {
      const prev = changes['chatId'].previousValue;
      if (prev) this.socketService.leaveRoom(prev);
      this.messages = [];
      this.decryptedContents.clear();
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
          this.decryptMessage(msg);
          if (this.isImageKey(msg.content)) {
            this.loadImage(this.getImageKey(msg.content));
          }
          this.shouldScroll = true;
        }
      })
    );

    this.subs.push(
      this.socketService.onHistory().subscribe(data => {
        if (data.chatId === this.chatId) {
          this.messages = data.messages;
          this.decryptAllMessages(data.messages);
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
            if (this.isMyMessage(m)) m.isRead = true;
          });
        }
      })
    );
  }

  async sendMessage(): Promise<void> {
    if (!this.newMessage.trim()) return;

    const plaintext = this.newMessage.trim();
    this.newMessage = '';
    this.socketService.sendTyping(this.chatId, false);

    if (this.chat?.type === 'direct') {
      try {
        const recipientId = this.getRecipientId();
        if (recipientId) {
          const publicKey = await this.cryptoService.getRecipientPublicKey(recipientId);

          if (!publicKey) {
            this.socketService.sendMessage(this.chatId, plaintext);
            return;
          }

          const encrypted = await this.cryptoService.encrypt(plaintext, publicKey);
          
          this.sentPlaintexts.set(encrypted, plaintext); 

          this.socketService.sendMessage(this.chatId, `[e2ee]:${encrypted}`);
          return;
        }
      } catch (err) {
        console.warn('[E2EE] Ошибка шифрования:', err);
      }
    }

    this.socketService.sendMessage(this.chatId, plaintext);
  }

  private async decryptMessage(msg: Message): Promise<void> {
    if (!msg.content.startsWith('[e2ee]:')) return;

    const cipher = msg.content.replace('[e2ee]:', '');

    if (this.isMyMessage(msg)) {
      const cachedText = this.sentPlaintexts.get(cipher);
      if (cachedText) {
        this.decryptedContents.set(msg.id, cachedText);
      } else {
        this.decryptedContents.set(msg.id, '[Зашифровано для получателя]');
      }
      return;
    }

    try {
      const myPublicKey = await this.cryptoService.getRecipientPublicKey(this.currentUserId);
      if (!myPublicKey) return;

      const decrypted = await this.cryptoService.decrypt(cipher, myPublicKey);
      this.decryptedContents.set(msg.id, decrypted ?? '[не удалось расшифровать]');
    } catch (err) {
      this.decryptedContents.set(msg.id, '[Ошибка дешифрования]');
    }
  }

  private decryptAllMessages(messages: Message[]): void {
    messages.forEach(msg => this.decryptMessage(msg));
  }

  getDisplayContent(msg: Message): string {
    if (this.isEncrypted(msg)) {
      return this.decryptedContents.get(msg.id) ?? '🔒 Расшифровка...';
    }
    return msg.content;
  }

  isEncrypted(msg: Message): boolean {
    return msg.content?.startsWith('[e2ee]:');
  }

  private getRecipientId(): string | null {
    if (!this.chat?.participants) return null;
    const recipient = this.chat.participants.find(p => p.id !== this.currentUserId);
    return recipient?.id ?? null;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {}
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

  onMessageSelected(messageId: string): void {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('message--highlighted');
      setTimeout(() => element.classList.remove('message--highlighted'), 2000);
    }
  }

  toggleSearch(): void {
    this.showSearch = !this.showSearch;
  }

  isImageKey(content: string): boolean {
    return content?.startsWith('[image]:');
  }

  getImageKey(content: string): string {
    return content?.replace('[image]:', '');
  }

  loadImage(key: string): void {
    if (this.imageUrls.has(key)) return;
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