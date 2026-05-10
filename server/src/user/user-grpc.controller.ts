import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { UsersService } from '../user/user.service';
import { status } from '@grpc/grpc-js';

import {
  GetUserRequest,
  GetUsersBatchRequest,
  GetUsersBatchResponse,
  UserResponse,
  UserExistsResponse,
  FindOneByEmailRequest,
} from '../generated/user';

@Controller()
export class UserGrpcController {
  constructor(private usersService: UsersService) {}

  @GrpcMethod('UserService', 'GetUser')
  async getUser(request: GetUserRequest): Promise<UserResponse> {
    const user = await this.usersService.findById(request.id);

    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `User ${request.id} not found`,
      });
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt.toISOString(),
      publicKey: user.publicKey || '',
    };
  }

  @GrpcMethod('UserService', 'FindOneByEmail')
  async findOneByEmail(request: FindOneByEmailRequest): Promise<UserResponse> {
    const user = await this.usersService.findByEmail(request.email);

    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `User with email ${request.email} not found`,
      });
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt.toISOString(),
      publicKey: user.publicKey || '',
    };
  }

  @GrpcMethod('UserService', 'GetUsersBatch')
  async getUsersBatch(request: GetUsersBatchRequest): Promise<GetUsersBatchResponse> {
    const users = await Promise.all(
      request.ids.map(id => this.usersService.findById(id)),
    );

    return {
      users: users
        .filter((u): u is any => !!u)
        .map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt.toISOString(),
          publicKey: user.publicKey || '',
        })),
    };
  }

  @GrpcMethod('UserService', 'UserExists')
  async userExists(request: GetUserRequest): Promise<UserExistsResponse> {
    const user = await this.usersService.findById(request.id);
    return { exists: !!user };
  }
}