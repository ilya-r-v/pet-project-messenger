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

  //TODO: протестить на постмане group

  @Post('group')
  @ApiOperation({ summary: 'Создать групповой чат' })
  createGroup(
    @Request() req: { user: { id: string } },
    @Body() body: { name: string; memberIds: string[] },
  ) {
    return this.chatService.createGroupChat(req.user.id, body.name, body.memberIds);
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