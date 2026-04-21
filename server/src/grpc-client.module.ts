import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

export const USER_SERVICE_GRPC = 'USER_SERVICE_GRPC';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: USER_SERVICE_GRPC,
        transport: Transport.GRPC,
        options: {
          url: 'localhost:5001',
          package: 'user',
          protoPath: join(__dirname, '../../libs/shared/proto/user.proto'),
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientModule {}