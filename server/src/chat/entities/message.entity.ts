import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  AfterLoad,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Chat } from './chat.entity';
import { Exclude, Expose } from 'class-transformer';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Exclude()
  @Column({ type: 'bytea' })
  content!: Buffer;

  @Expose()
  contentBase64?: string;

  @Column()
  chatId!: string;

  @Column({ type: 'varchar', default: 'text' })
  type!: 'text' | 'image' | 'file';

  @Column({ type: 'text', nullable: true })
  thumbnailUrl?: string;

  @Column()
  senderId!: string;

  @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat!: Chat;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender!: User;

  @Column({ default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @AfterLoad()
  convertContentToBase64() {
    if (this.content && Buffer.isBuffer(this.content)) {
      this.contentBase64 = this.content.toString('base64');
    }
  }
}