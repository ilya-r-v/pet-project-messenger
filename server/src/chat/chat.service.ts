import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat, ChatType } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getUserChats(userId: string): Promise<Chat[]> {
    return this.chatRepository
      .createQueryBuilder('chat')
      .innerJoin('chat.participants', 'participant', 'participant.id = :userId', { userId })
      .leftJoinAndSelect('chat.participants', 'allParticipants')
      .leftJoinAndSelect(
        'chat.messages',
        'lastMessage',
        'lastMessage.createdAt = (SELECT MAX(m."createdAt") FROM messages m WHERE m."chatId" = chat.id)',
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

    // TODO [Фаза E2EE]: После создания группового чата —
    // сгенерировать симметричный ключ группы и зашифровать его
    // публичным ключом каждого участника
  }

  async isParticipant(chatId: string, userId: string): Promise<boolean> {
    const count = await this.chatRepository
      .createQueryBuilder('chat')
      .innerJoin('chat.participants', 'participant', 'participant.id = :userId', { userId })
      .where('chat.id = :chatId', { chatId })
      .getCount();

    return count > 0;
  }

  async saveMessage(chatId: string, senderId: string, content: string): Promise<Message> {
    const isParticipant = await this.isParticipant(chatId, senderId);
    if (!isParticipant) {
      throw new ForbiddenException('Вы не участник этого чата');
    }

    const message = this.messageRepository.create({ chatId, senderId, content });
    return this.messageRepository.save(message);
  }

  async getMessages(
    chatId: string,
    userId: string,
    limit = 50,
    cursor?: string,
  ): Promise<Message[]> {
    const isParticipant = await this.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('Вы не участник этого чата');
    }

    const query = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.chatId = :chatId', { chatId })
      .orderBy('message.createdAt', 'DESC')
      .take(limit);

    if (cursor) {
      query.andWhere('message.createdAt < :cursor', { cursor: new Date(cursor) });
    }

    const messages = await query.getMany();
    return messages.reverse(); 
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

    // TODO [Фаза 2]: после обновления — уведомить отправителя через WS
    // что его сообщения прочитаны (emit 'messagesRead' в комнату)
  }
}