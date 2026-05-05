import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Delete,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Список чатов текущего пользователя' })
  getMyChats(@Request() req: { user: { id: string } }) {
    return this.chatService.getUserChats(req.user.id);
  }

  @Post('direct')
  @ApiOperation({ summary: 'Создать личный диалог с пользователем' })
  createDirect(
    @Request() req: { user: { id: string } },
    @Body() body: { targetUserId: string },
  ) {
    return this.chatService.createDirectChat(req.user.id, body.targetUserId);
  }

  @Post('group')
  @ApiOperation({ summary: 'Создать групповой чат (E2EE)' })
  createGroup(
    @Request() req: { user: { id: string } },
    @Body() body: { 
      name: string; 
      participants: { userId: string, encryptedRoomKey: string }[] 
    },
  ) {
    return this.chatService.createGroupChat(body.name, body.participants);
  }

  @Get('search')
  async search(
    @Query('chatId') chatId: string,
    @Query('query') query: string
  ) {
    return this.chatService.searchMessages(chatId, query);
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'История сообщений (курсорная пагинация)' })
  getMessages(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('afterId') afterId?: string,
  ) {
    return this.chatService.getMessages(chatId, req.user.id, limit, cursor);
  }

  @Delete(':chatId')
  @ApiOperation({ summary: 'Удалить чат' })
  deleteChat(
    @Request() req: { user: { id: string } },
    @Param('chatId') chatId: string,
  ) {
    return this.chatService.deleteChat(chatId, req.user.id);
  }
}