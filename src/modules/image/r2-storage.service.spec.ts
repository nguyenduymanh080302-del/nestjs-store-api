import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { R2StorageService } from './r2-storage.service';

describe('R2StorageService', () => {
  const config: Record<string, string> = {
    R2_ACCOUNT_ID: 'account-id',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET: 'product-images',
    R2_PUBLIC_URL: 'https://images.example.com'
  };
  const configService = {
    get: jest.fn((name: string) => config[name])
  } as unknown as ConfigService;
  const send = jest
    .spyOn(S3Client.prototype, 'send')
    .mockResolvedValue({} as never);
  let storage: R2StorageService;

  beforeEach(() => {
    storage = new R2StorageService(configService);
    send.mockClear();
  });

  afterAll(() => {
    send.mockRestore();
  });

  it('uploads an image buffer under the images prefix', async () => {
    const url = await storage.upload({
      buffer: Buffer.from('image-content'),
      mimeType: 'image/png',
      originalName: 'photo.png'
    });

    expect(url).toMatch(
      /^https:\/\/images\.example\.com\/images\/[0-9a-f-]+\.png$/
    );

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'product-images',
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable'
    });
    expect(command.input.Key).toMatch(/^images\/[0-9a-f-]+\.png$/);
  });

  it('uploads a base64 data URI', async () => {
    const url = await storage.upload(
      `data:image/webp;base64,${Buffer.from('image-content').toString('base64')}`
    );

    expect(url).toMatch(/\.webp$/);
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command.input.ContentType).toBe('image/webp');
  });

  it('deletes an object under the images prefix', async () => {
    await expect(
      storage.delete('https://images.example.com/images/image-name.webp')
    ).resolves.toBe(true);

    const command = send.mock.calls[0][0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'product-images',
      Key: 'images/image-name.webp'
    });
  });

  it('does not delete an image outside the images prefix', async () => {
    await expect(
      storage.delete('https://images.example.com/products/image.jpg')
    ).resolves.toBe(false);

    expect(send).not.toHaveBeenCalled();
  });

  it('does not delete an image hosted outside the configured public URL', async () => {
    await expect(
      storage.delete('https://legacy.example.com/images/image.jpg')
    ).resolves.toBe(false);

    expect(send).not.toHaveBeenCalled();
  });
});
