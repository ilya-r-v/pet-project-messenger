import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Message } from './message.entity';
import { ChatParticipant } from './chat-participant.entity';

export enum ChatType {
  DIRECT = 'direct', 
  GROUP = 'group',
}

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true, length: 100 })
  name?: string;

  @Column({
    type: 'enum',
    enum: ChatType,
    default: ChatType.DIRECT,
  })
  type!: ChatType;

  @OneToMany(() => ChatParticipant, (cp) => cp.chat, { cascade: true })
  participantObjects: ChatParticipant[];

  participants!: User[];

  @OneToMany(() => Message, (message) => message.chat)
  messages!: Message[];

  @CreateDateColumn()
  createdAt!: Date;
}