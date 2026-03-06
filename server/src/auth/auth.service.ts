import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private userService: UserService,
        private jwtService: JwtService
    ) {}

    async signIn(username: string, pass: string): Promise<{access_token: string}> {
        const user = await this.userService.findOne(username);

        if (!user || !(await bcrypt.compare(pass, user.password))) {
            throw new UnauthorizedException('Неправильное имя пользователя или пароль');
        }

        const payload = {sub: user.userId, username: user.username};

        return {
            access_token: await this.jwtService.signAsync(payload)
        }
    }
}
