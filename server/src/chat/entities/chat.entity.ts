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

  @ManyToMany(() => User)
  @JoinTable({
    name: 'chat_participants',
    joinColumn: { name: 'chatId' },
    inverseJoinColumn: { name: 'userId' },
  })
  participants!: User[];

  @OneToMany(() => Message, (message) => message.chat)
  messages!: Message[];

  @CreateDateColumn()
  createdAt!: Date;
}