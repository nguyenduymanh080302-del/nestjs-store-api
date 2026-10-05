import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';

export type ImageUploadInput =
  | string
  | {
      buffer: Buffer;
      mimeType?: string;
      originalName?: string;
    };

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
  endpointUrl: string;
};

const IMAGE_KEY_PREFIX = 'images';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/tiff': '.tiff',
  'image/webp': '.webp'
};

@Injectable()
export class R2StorageService {
  private client?: S3Client;
  private clientKey?: string;

  constructor(private readonly configService: ConfigService) {}

  private requireConfig(name: string): string {
    const value = this.configService.get<string>(name)?.trim();

    if (!value) {
      throw new Error(
        `Cloudflare R2 is not configured. Missing env var: ${name}`
      );
    }

    return value;
  }

  private getConfig(): R2Config {
    const publicUrl = this.requireConfig('R2_PUBLIC_URL').replace(/\/+$/, '');
    const accountId = this.requireConfig('R2_ACCOUNT_ID');
    const endpointUrl =
      this.configService.get<string>('R2_ENDPOINT_URL')?.trim() ||
      `https://${accountId}.r2.cloudflarestorage.com`;

    // Validate this eagerly so malformed URLs fail before an object is uploaded.
    new URL(publicUrl);
    new URL(endpointUrl);

    return {
      accountId,
      accessKeyId: this.requireConfig('R2_ACCESS_KEY_ID'),
      secretAccessKey: this.requireConfig('R2_SECRET_ACCESS_KEY'),
      bucket: this.requireConfig('R2_BUCKET'),
      publicUrl,
      endpointUrl
    };
  }

  private getClient(config: R2Config): S3Client {
    const clientKey = [
      config.accountId,
      config.endpointUrl,
      config.accessKeyId,
      config.secretAccessKey
    ].join(':');

    if (!this.client || this.clientKey !== clientKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: config.endpointUrl,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey
        }
      });
      this.clientKey = clientKey;
    }

    return this.client;
  }

  private decodeBase64Image(value: string): {
    buffer: Buffer;
    mimeType: string;
  } {
    const dataUri = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is);
    const mimeType = dataUri?.[1]?.toLowerCase() || 'image/jpeg';
    const encoded = (dataUri?.[2] || value).replace(/\s/g, '');

    if (!encoded || !/^[a-z0-9+/]*={0,2}$/i.test(encoded)) {
      throw new Error('Invalid base64 image');
    }

    const buffer = Buffer.from(encoded, 'base64');

    if (!buffer.length) {
      throw new Error('Image data is empty');
    }

    return { buffer, mimeType };
  }

  private normalizeInput(input: ImageUploadInput): {
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
  } {
    if (typeof input === 'string') {
      return this.decodeBase64Image(input);
    }

    if (!input.buffer?.length) {
      throw new Error('Image buffer is required');
    }

    const mimeType = (input.mimeType || 'image/jpeg').toLowerCase();

    if (!mimeType.startsWith('image/')) {
      throw new Error(`Unsupported image MIME type: ${mimeType}`);
    }

    return {
      buffer: input.buffer,
      mimeType,
      originalName: input.originalName
    };
  }

  private getExtension(mimeType: string, originalName?: string): string {
    const mimeExtension = MIME_EXTENSIONS[mimeType];

    if (mimeExtension) {
      return mimeExtension;
    }

    const originalExtension = originalName
      ? extname(originalName).toLowerCase()
      : '';

    return /^\.[a-z0-9]{1,10}$/.test(originalExtension)
      ? originalExtension
      : '';
  }

  private createObjectKey(mimeType: string, originalName?: string): string {
    const filename = `${randomUUID()}${this.getExtension(mimeType, originalName)}`;
    return `${IMAGE_KEY_PREFIX}/${filename}`;
  }

  private encodeObjectKey(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/');
  }

  private getObjectKeyFromUrl(
    imageUrl: string,
    publicUrl: string
  ): string | null {
    try {
      const objectUrl = new URL(imageUrl);
      const baseUrl = new URL(`${publicUrl}/`);

      if (objectUrl.origin !== baseUrl.origin) {
        return null;
      }

      const basePath = baseUrl.pathname.endsWith('/')
        ? baseUrl.pathname
        : `${baseUrl.pathname}/`;

      if (!objectUrl.pathname.startsWith(basePath)) {
        return null;
      }

      const encodedKey = objectUrl.pathname.slice(basePath.length);
      const key = encodedKey
        .split('/')
        .map((segment) => decodeURIComponent(segment))
        .join('/');

      if (!key.startsWith(`${IMAGE_KEY_PREFIX}/`) || key.includes('..')) {
        return null;
      }

      return key;
    } catch {
      return null;
    }
  }

  async upload(input: ImageUploadInput): Promise<string> {
    const config = this.getConfig();
    const { buffer, mimeType, originalName } = this.normalizeInput(input);
    const key = this.createObjectKey(mimeType, originalName);

    await this.getClient(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable'
      })
    );

    return `${config.publicUrl}/${this.encodeObjectKey(key)}`;
  }

  async delete(imageUrl: string): Promise<boolean> {
    const config = this.getConfig();
    const key = this.getObjectKeyFromUrl(imageUrl, config.publicUrl);

    // Imported or legacy images can be hosted elsewhere and must not be deleted.
    if (!key) {
      return false;
    }

    await this.getClient(config).send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key
      })
    );

    return true;
  }
}
