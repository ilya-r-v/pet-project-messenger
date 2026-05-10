import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import * as microservices from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { USER_SERVICE_GRPC } from './grpc-client.module';

import {
  UserServiceClient,
  GetUserRequest,
  GetUsersBatchRequest,
  UserResponse,
  FindOneByEmailRequest,
} from './generated/user';

@Injectable()
export class UserGrpcClient implements OnModuleInit {
  private userService!: UserServiceClient;

  constructor(
    @Inject(USER_SERVICE_GRPC) private client: microservices.ClientGrpc,
  ) {}

  onModuleInit(): void {
    this.userService = this.client.getService<UserServiceClient>('UserService');
  }

  async getUser(id: string): Promise<UserResponse> {
    return firstValueFrom(
      this.userService.getUser({ id })
    );
  }

  async getUsersBatch(ids: string[]): Promise<UserResponse[]> {
    const response = await firstValueFrom(
      this.userService.getUsersBatch({ ids })
    );
    return response.users;
  }

  async findOneByEmail(email: string): Promise<UserResponse> {
    return firstValueFrom(
      this.userService.findOneByEmail({ email })
    );
  }

  async userExists(id: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.userService.userExists({ id })
    );
    return response.exists;
  }
}