import { Controller, NotFoundException } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UsersService } from '../user/user.service';

interface GetUserRequest {
  id: string;
}

interface GetUsersBatchRequest {
  ids: string[];
}

interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

@Controller()
export class UserGrpcController {
  constructor(private usersService: UsersService) {}

  @GrpcMethod('UserService', 'GetUser')
  async getUser(request: GetUserRequest): Promise<UserResponse> {
    const user = await this.usersService.findById(request.id);
    if (!user) {
      throw new NotFoundException(`User ${request.id} not found`);
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
  async getUsersBatch(request: GetUsersBatchRequest): Promise<{ users: UserResponse[] }> {
    const users = await Promise.all(
      request.ids.map(id => this.usersService.findById(id))
    );

    const validUsers = users
      .filter(Boolean)
      .map(user => ({
        id: user!.id,
        email: user!.email,
        firstName: user!.firstName,
        lastName: user!.lastName,
        createdAt: user!.createdAt.toISOString(),
      }));

    return { users: validUsers };
  }

  @GrpcMethod('UserService', 'UserExists')
  async userExists(request: GetUserRequest): Promise<{ exists: boolean }> {
    const user = await this.usersService.findById(request.id);
    return { exists: !!user };
  }
}