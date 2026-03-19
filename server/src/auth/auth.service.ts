import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse } from './interfaces/auth-response.interface';
import { User } from '../user/entities/user.entity';

@Injectable()
export class AuthService {
  private refreshTokens = new Set<string>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private getJwtSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    return secret;
  }

  private getRefreshSecret(): string {
    const secret = this.configService.get<string>('REFRESH_SECRET');
    if (!secret) {
      throw new Error('REFRESH_SECRET is not defined');
    }
    return secret;
  }

  private getAccessExpiresIn(): string {
    return this.configService.get<string>('ACCESS_EXPIRES_IN') || '15m';
  }

  private getRefreshExpiresIn(): string {
    return this.configService.get<string>('REFRESH_EXPIRES_IN') || '7d';
  }

  async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
    const { email, firstName, lastName, password } = registerDto;

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new BadRequestException('Пользователь с таким email уже существует');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.create(email, firstName, lastName, hashedPassword);
    const { password: _, ...result } = user;
    return result;
  }

  async login(user: Omit<User, 'password'>): Promise<AuthResponse> {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.getJwtSecret(),
      expiresIn: this.getAccessExpiresIn() as any,
    });
    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.getRefreshSecret(),
        expiresIn: this.getRefreshExpiresIn() as any,
      },
    );
    this.refreshTokens.add(refreshToken);
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    if (!this.refreshTokens.has(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.getRefreshSecret(),
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      this.refreshTokens.delete(refreshToken);

      const newPayload = { sub: user.id, email: user.email };
      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.getJwtSecret(),
        expiresIn: this.getAccessExpiresIn() as any,
      });
      const newRefreshToken = this.jwtService.sign(
        { sub: user.id },
        {
          secret: this.getRefreshSecret(),
          expiresIn: this.getRefreshExpiresIn() as any,
        },
      );
      this.refreshTokens.add(newRefreshToken);

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async me(userId: string): Promise<Omit<User, 'password'>> {
    const user = this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    const { password, ...result } = user;
    return result;
  }
}