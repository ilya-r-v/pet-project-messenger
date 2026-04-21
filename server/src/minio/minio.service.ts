import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

export interface UploadResult {
  key: string;
  url: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;
  private readonly logger = new Logger(MinioService.name);

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'messenger');

    this.client = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: false,
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }
  
  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Bucket "${this.bucket}" created`);
      } else {
        this.logger.log(`Bucket "${this.bucket}" already exists`);
      }
    } catch (err) {
      this.logger.error('MinIO init error:', err);
    }
  }

  async getPresignedUploadUrl(chatId: string, fileName: string, contentType: string) {
    const ext = fileName.split('.').pop();
    const key = `chats/${chatId}/${randomUUID()}.${ext}`;

    const uploadUrl = await this.client.presignedPutObject(this.bucket, key, 300);

    return { key, uploadUrl };
  }

  async getPresignedDownloadUrl(key: string): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, 3600);
  }
  
  async processImage(key: string, contentType = 'image/jpeg'): Promise<string | null> {
    try {
      const stream = await this.client.getObject(this.bucket, key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);

      const resized = await sharp(buffer)
        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();

      await this.client.putObject(
        this.bucket,
        key,
        resized,
        resized.length,
        { 'Content-Type': contentType },
      );

      const thumbnail = await sharp(resized)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailKey = key.replace(/(\.[^.]+)$/, '_thumb$1');
      await this.client.putObject(
        this.bucket,
        thumbnailKey,
        thumbnail,
        thumbnail.length,
        { 'Content-Type': 'image/jpeg' },
      );

      this.logger.log(`Thumbnail created: ${thumbnailKey}`);
      return thumbnailKey;
    } catch (err) {
      this.logger.error('Image processing error:', err);
      return null;
    }
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  isImage(contentType: string): boolean {
    return contentType.startsWith('image/');
  }
}