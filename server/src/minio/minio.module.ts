import { Module } from '@nestjs/common';
import { MinioService } from './minio.service';
import { UploadController } from './upload.controller';

@Module({
  providers: [MinioService],
  controllers: [UploadController],
  exports: [MinioService],
})
export class MinioModule {}