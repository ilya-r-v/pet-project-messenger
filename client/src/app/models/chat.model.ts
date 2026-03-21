import { User } from "./user.model";

export interface Chat {
    id: string;
    name: string;
    type: string;
    participants: User[];
    messages: Message[];
}

export interface Message {
    id: string;
    content: string;
    chatId: string;
    senderId: string;
    chat: Chat;
    sender: User;
    isRead: boolean;
}