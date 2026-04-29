import {
  Body, Controller, Delete, Get,
  Param, Post, Put, UseGuards, Request,
} from '@nestjs/common';
import { UsersService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto);
    }

    @Get()
    findAll() {
        return this.usersService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(id, updateUserDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.usersService.remove(id);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('public-key')
    @ApiOperation({ summary: 'Сохранить публичный ключ E2EE' })
    savePublicKey(
        @Request() req: { user: { id: string } },
        @Body() body: { publicKey: string },
    ) {
        return this.usersService.savePublicKey(req.user.id, body.publicKey);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get(':id/public-key')
    async getPublicKey(@Param('id') id: string) {
        const publicKey = await this.usersService.getPublicKey(id);
        if (!publicKey) {
            return { publicKey: null };
        }
        return { publicKey };
    }
}