import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { User } from '../user/entities/user.entity';
import { GrpcClientModule } from '../grpc-client.module';
import { UserGrpcClient } from '../user-grpc.client';
import { ChatParticipant } from './entities/chat-participant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, Message, User, ChatParticipant]),
    GrpcClientModule,
    JwtModule,
  ],
  providers: [ChatService, ChatGateway, UserGrpcClient],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}