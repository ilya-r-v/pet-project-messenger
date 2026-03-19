import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '../user/entities/user.entity';

@UseInterceptors(ClassSerializerInterceptor)
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Регистрация нового пользователя' })
  @ApiResponse({ status: 201, type: User })
  @ApiResponse({ status: 400, description: 'Email уже занят' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход — возвращает пару токенов' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: '{ accessToken, refreshToken }' })
  @ApiResponse({ status: 401, description: 'Неверные учётные данные' })
  async login(@Request() req: { user: Omit<User, 'password'> }) {
    return this.authService.login(req.user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновить пару токенов по refreshToken' })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: 200, description: '{ accessToken, refreshToken }' })
  @ApiResponse({ status: 401, description: 'Токен невалиден или истёк' })
  async refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить текущего пользователя по токену' })
  @ApiResponse({ status: 200, type: User })
  @ApiResponse({ status: 401, description: 'Токен невалиден' })
  async me(@Request() req: { user: { id: string; email: string } }) {
    return this.authService.me(req.user.id);
  }
}