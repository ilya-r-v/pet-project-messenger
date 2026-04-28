import { Injectable, NotFoundException, ForbiddenException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat, ChatType } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { User } from '../user/entities/user.entity';
import { UserGrpcClient } from '../user-grpc.client';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private userGrpcClient: UserGrpcClient,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async getUserChats(userId: string): Promise<Chat[]> {
    return this.chatRepository
      .createQueryBuilder('chat')
      .innerJoin('chat.participants', 'participant', 'participant.id = :userId', { userId })
      .leftJoinAndSelect('chat.participants', 'allParticipants')
      .leftJoinAndSelect('chat.messages', 'lastMessage')
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('m.id')
          .from('messages', 'm')
          .where('m.chatId = chat.id')
          .orderBy('m.createdAt', 'DESC')
          .limit(1)
          .getQuery();
        return 'lastMessage.id = ' + subQuery + ' OR lastMessage.id IS NULL';
      })
      .leftJoinAndSelect('lastMessage.sender', 'sender')
      .loadRelationCountAndMap(
        'chat.unreadCount',
        'chat.messages',
        'unreadMsg',
        (qb) => qb.where('unreadMsg.isRead = false AND unreadMsg.senderId != :userId', { userId })
      )
      .orderBy('lastMessage.createdAt', 'DESC')
      .getMany();
  }

  async createDirectChat(userId: string, targetUserId: string): Promise<Chat> {
    const existing = await this.chatRepository
      .createQueryBuilder('chat')
      .innerJoin('chat.participants', 'p1', 'p1.id = :userId', { userId })
      .innerJoin('chat.participants', 'p2', 'p2.id = :targetUserId', { targetUserId })
      .where('chat.type = :type', { type: ChatType.DIRECT })
      .getOne();

    if (existing) return existing;

    const user = await this.userRepository.findOneBy({ id: userId });
    const target = await this.userRepository.findOneBy({ id: targetUserId });

    if (!user || !target) {
      throw new NotFoundException('Пользователь не найден');
    }

    const chat = this.chatRepository.create({
      type: ChatType.DIRECT,
      name: `${user.firstName} & ${target.firstName}`,
      participants: [user, target],
    });

    return this.chatRepository.save(chat);
  }

  async createGroupChat(userId: string, name: string, memberIds: string[]): Promise<Chat> {
    const allIds = [...new Set([userId, ...memberIds])];
    const users = await this.userRepository.findByIds(allIds);

    const chat = this.chatRepository.create({
      type: ChatType.GROUP,
      name,
      participants: users,
    });

    return this.chatRepository.save(chat);
  }

  async isParticipant(chatId: string, userId: string): Promise<boolean> {
    const count = await this.chatRepository
      .createQueryBuilder('chat')
      .innerJoin('chat.participants', 'participant', 'participant.id = :userId', { userId })
      .where('chat.id = :chatId', { chatId })
      .getCount();

    return count > 0;
  }

  async saveMessage(
    chatId: string, 
    senderId: string, 
    content: string, 
    type: 'text' | 'image' | 'file' = 'text',
    thumbnailUrl?: string
  ): Promise<Message> {
    const isParticipant = await this.isParticipant(chatId, senderId);
    if (!isParticipant) {
      throw new ForbiddenException('Вы не участник этого чата');
    }

    const message = this.messageRepository.create({ 
      chatId, 
      senderId, 
      content,
      type,
      thumbnailUrl 
    });
    
    return this.messageRepository.save(message);
  }

  async getMessages(
    chatId: string,
    userId: string,
    limit = 50,
    cursor?: string,
    afterId?: string,
  ): Promise<Message[]> {
    const isParticipant = await this.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Вы не участник этого чата');
    }

    const query = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.chatId = :chatId', { chatId })
      .take(limit);

    if (afterId) {
      query.andWhere('message.id > :afterId', { afterId });
      query.orderBy('message.createdAt', 'ASC'); 
    } else if (cursor) {
      query.andWhere('message.createdAt < :cursor', { cursor: new Date(cursor) });
      query.orderBy('message.createdAt', 'DESC');
    } else {
      query.orderBy('message.createdAt', 'DESC');
    }
    
    const messages = await query.getMany();
    return afterId ? messages : messages.reverse();
  }

  async markAsRead(chatId: string, userId: string): Promise<void> {
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('chatId = :chatId AND senderId != :userId AND isRead = false', {
        chatId,
        userId,
      })
      .execute();
    
    this.chatGateway.server.to(chatId).emit('messagesRead', {
      chatId,
      readerId: userId,
    });
  }
  
  async searchMessages(chatId: string, query: string) {
    if (!query || query.trim().length === 0) return [];

    return this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.chatId = :chatId', { chatId })
      .andWhere('message.content ILIKE :query', { query: `%${query}%` }) 
      .orderBy('message.createdAt', 'DESC')
      .limit(50)
      .getMany();
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    const isParticipant = await this.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Вы не участник этого чата');
    }

    await this.chatRepository.delete(chatId);
  }
}