import { Data } from "@angular/router";
import { User } from "./user.model";

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  participants: User[];
  messages: Message[];
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}