import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UsersService } from '../user/user.service';

import {
  GetUserRequest,
  GetUsersBatchRequest,
  GetUsersBatchResponse,
  UserResponse,
  UserExistsResponse,
} from '../generated/user';

@Controller()
export class UserGrpcController {
  constructor(private usersService: UsersService) {}

  @GrpcMethod('UserService', 'GetUser')
  async getUser(request: GetUserRequest): Promise<UserResponse> {
    const user = await this.usersService.findById(request.id);

    if (!user) {
      throw new Error(`User ${request.id} not found`);
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt.toISOString(),
    };
  }

  @GrpcMethod('UserService', 'GetUsersBatch')
  async getUsersBatch(request: GetUsersBatchRequest): Promise<GetUsersBatchResponse> {
    const users = await Promise.all(
      request.ids.map(id => this.usersService.findById(id)),
    );

    return {
      users: users
        .filter(Boolean)
        .map(user => ({
          id: user!.id,
          email: user!.email,
          firstName: user!.firstName,
          lastName: user!.lastName,
          createdAt: user!.createdAt.toISOString(),
        })),
    };
  }

  @GrpcMethod('UserService', 'UserExists')
  async userExists(request: GetUserRequest): Promise<UserExistsResponse> {
    const user = await this.usersService.findById(request.id);
    return { exists: !!user };
  }
}