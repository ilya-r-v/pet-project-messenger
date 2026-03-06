import { Injectable } from "@nestjs/common";


export type User = {
    userId: number;
    username: string;
    password: string;
}

@Injectable()

export class UserService {
    private readonly user: User[] = [
        {
            userId: 1,
            username: 'ilya',
            password:  ''
        },
    ];


    async findOne(username: string): Promise<User | undefined> {
        return this.user.find(user => user.username === username);
    }
}