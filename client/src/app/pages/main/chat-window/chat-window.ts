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
          this.shouldScroll = true;
        }
      })
    );

    this.subs.push(
      this.socketService.onHistory().subscribe(data => {
        if (data.chatId === this.chatId) {
          this.messages = data.messages.map(m => this.normalizeMessage(m));
          this.decryptAllMessages(data.messages);
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

          if (publicKey) {
            const encryptedBase64 = await this.cryptoService.encrypt(plaintext, publicKey);
            this.sentPlaintexts.set(encryptedBase64, plaintext); 
            this.socketService.sendMessage(this.chatId, `[e2ee]:${encryptedBase64}`);
            return;
          }
        }
      } catch (err) {
        console.warn('[E2EE] Ошибка шифрования:', err);
      }
    }

    const base64 = btoa(encodeURIComponent(plaintext));
    this.socketService.sendMessage(this.chatId, base64);
  }

  private async decryptMessage(msg: Message): Promise<void> {
    if (!msg.contentBase64) return;

    const isEncrypted = msg.contentBase64.startsWith('[e2ee]:');
    const cleanBase64 = isEncrypted 
        ? msg.contentBase64.replace('[e2ee]:', '') 
        : msg.contentBase64;

    if (this.isMyMessage(msg) && this.sentPlaintexts.has(cleanBase64)) {
        this.decryptedContents.set(msg.id, this.sentPlaintexts.get(cleanBase64)!);
        return;
    }

    if (isEncrypted && this.chat?.type === 'direct' && msg.type === 'text') {
        try {
            const myPrivateKey = await this.cryptoService.loadPrivateKey();
            if (myPrivateKey) {
                const decrypted = await this.cryptoService.decrypt(msg.contentBase64, myPrivateKey);
                if (decrypted && decrypted !== '🔒 Ошибка расшифровки') {
                    if (decrypted.startsWith('[image]:')) {
                        this.loadImage(decrypted.replace('[image]:', ''));
                    }
                    this.decryptedContents.set(msg.id, decrypted);
                    return;
                }
            }
        } catch (err) {
            console.error('[Crypto] Ошибка дешифрования:', err);
        }
    }

    try {
        const decoded = decodeURIComponent(atob(cleanBase64));
        
        if (decoded.startsWith('[image]:')) {
            this.loadImage(decoded.replace('[image]:', ''));
        }
        
        this.decryptedContents.set(msg.id, decoded);
    } catch (e) {
        this.decryptedContents.set(msg.id, cleanBase64);
    }
  }

  private decryptAllMessages(messages: Message[]): void {
    messages.forEach(msg => this.decryptMessage(msg));
  }

  private normalizeMessage(msg: Message): Message {
    if (msg.content && typeof msg.content === 'object' && 'type' in msg.content && msg.content.type === 'Buffer') {
      msg.contentBase64 = Buffer.from((msg.content as any).data).toString('base64');
    }
    return msg;
  }

  getDisplayContent(msg: Message): string {
    return this.decryptedContents.get(msg.id) ?? '🔒 Расшифровка...';
  }

  isEncrypted(msg: Message): boolean {
    return this.chat?.type === 'direct' && msg.type === 'text';
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

  getImageKey(msg: Message): string {
    const content = this.decryptedContents.get(msg.id) || '';
    return content.replace('[image]:', '');
  }

  isImage(msg: Message): boolean {
    return msg.type === 'image' || (this.decryptedContents.get(msg.id)?.startsWith('[image]:') ?? false);
  }

  loadImage(key: string): void {
    if (this.imageUrls.has(key)) return;
    this.uploadService.getImageUrl(key).subscribe(url => {
      this.imageUrls.set(key, url);
    });
  }

  onFileUploaded(file: UploadedFile): void {
    const base64 = btoa(encodeURIComponent(`[image]:${file.key}`));
    this.socketService.sendMessage(this.chatId, base64);
    this.showUpload = false;
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