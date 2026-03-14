import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';
import { nanoid } from 'nanoid';

@Injectable()
export class UsersService {
  private users: User[] = [];

  async create(email: string, firstName: string, lastName: string, passwordHash: string): Promise<User> {
    const user: User = {
      id: nanoid(),
      email,
      firstName,
      lastName,
      password: passwordHash,
    };
    this.users.push(user);
    return user;
  }

  findByEmail(email: string): User | undefined {
    return this.users.find(u => u.email === email);
  }

  findById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }
}