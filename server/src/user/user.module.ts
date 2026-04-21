import { Module } from '@nestjs/common';
import { UsersService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './user.controller';
import { UserGrpcController } from './user-grpc.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [UsersController, UserGrpcController],
  exports: [UsersService],
})
export class UsersModule {}