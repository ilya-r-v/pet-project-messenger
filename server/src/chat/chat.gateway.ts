import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { WsAuthGuard } from '../auth/guards/ws-auth.guard';

interface SendMessageDto {
  chatId: string;
  content: string;
}

interface JoinRoomDto {
  chatId: string;
}

interface TypingDto {
  chatId: string;
  isTyping: boolean;
}

interface GetHistoryDto {
  chatId: string;
  cursor?: string;
  limit?: number;
}

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:4200',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Токен передаётся через socket.io auth object:
      const rawToken =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization;

      if (!rawToken) {
        client.emit('error', { message: 'No token provided' });
        client.disconnect();
        return;
      }

      const token = rawToken.startsWith('Bearer ')
        ? rawToken.slice(7)
        : rawToken;

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });

      client.data.user = { id: payload.sub, email: payload.email };

      client.join(`user_${payload.sub}`);

      console.log(`[WS] Connected: ${client.id} | user: ${payload.email}`);
    } catch (err) {
      console.log(`[WS] Unauthorized: ${client.id}`);
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    console.log(`[WS] Disconnected: ${client.id} | user: ${user?.email ?? 'unknown'}`);

    // TODO [Фаза 2]: обновить статус пользователя online → offline в БД
    // и уведомить его контакты: this.server.emit('userOffline', { userId })
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
  ) {
    const userId = client.data.user.id;

    const isParticipant = await this.chatService.isParticipant(dto.chatId, userId);
    if (!isParticipant) {
      throw new WsException('Вы не участник этого чата');
    }

    client.join(`chat_${dto.chatId}`);
    console.log(`[WS] User ${userId} joined chat_${dto.chatId}`);

    return { event: 'joinedRoom', data: { chatId: dto.chatId } };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const userId = client.data.user.id;

    const message = await this.chatService.saveMessage(
      dto.chatId,
      userId,
      dto.content,
    );

    this.server.to(`chat_${dto.chatId}`).emit('newMessage', {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
      isRead: message.isRead,
    });

    // TODO [E2EE]: content будет зашифрован на клиенте,
    // сервер сохраняет и рассылает blob не расшифровывая
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: TypingDto,
  ) {
    const userId = client.data.user.id;

    client.to(`chat_${dto.chatId}`).emit('userTyping', {
      userId,
      chatId: dto.chatId,
      isTyping: dto.isTyping,
    });
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('getHistory')
  async handleGetHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: GetHistoryDto,
  ) {
    const userId = client.data.user.id;

    const messages = await this.chatService.getMessages(
      dto.chatId,
      userId,
      dto.limit ?? 50,
      dto.cursor,
    );

    return { event: 'history', data: { chatId: dto.chatId, messages } };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { chatId: string },
  ) {
    const userId = client.data.user.id;
    await this.chatService.markAsRead(dto.chatId, userId);

    client.to(`chat_${dto.chatId}`).emit('messagesRead', {
      chatId: dto.chatId,
      readBy: userId,
    });
  }
}