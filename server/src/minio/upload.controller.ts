import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MinioService } from './minio.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MAX_SIZE_MB = 10;

@ApiTags('Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private minioService: MinioService) {}

  @Post('presigned')
  @ApiOperation({ summary: 'Получить presigned URL для загрузки файла' })
  async getPresignedUrl(
    @Request() req: { user: { id: string } },
    @Body() body: { chatId: string; fileName: string; contentType: string; sizeBytes: number },
  ) {
    const { chatId, fileName, contentType, sizeBytes } = body;

    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new BadRequestException(
        `Тип файла не поддерживается. Разрешены: ${ALLOWED_TYPES.join(', ')}`,
      );
    }

    if (sizeBytes > MAX_SIZE_MB * 1024 * 1024) {
      throw new BadRequestException(`Файл слишком большой. Максимум ${MAX_SIZE_MB}MB`);
    }

    const { key, uploadUrl } = await this.minioService.getPresignedUploadUrl(
      chatId,
      fileName,
      contentType,
    );

    return { key, uploadUrl };
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Подтвердить загрузку, получить финальный URL' })
  async confirmUpload(
    @Body() body: { key: string; contentType: string },
  ) {
    const { key, contentType } = body;

    let thumbnailKey: string | null = null;

    if (this.minioService.isImage(contentType)) {
      thumbnailKey = await this.minioService.processImage(key);
    }

    const url = await this.minioService.getPresignedDownloadUrl(key);
    const thumbnailUrl = thumbnailKey
      ? await this.minioService.getPresignedDownloadUrl(thumbnailKey)
      : null;

    return { key, url, thumbnailKey, thumbnailUrl };
  }
}