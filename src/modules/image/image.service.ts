import { Injectable } from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
};

@Injectable()
export class ImageService {
  constructor(private readonly storage: R2StorageService) {}

  async uploadImages(
    imageFiles: UploadedImageFile[] = [],
    base64Images: string[] = []
  ): Promise<string[]> {
    return Promise.all([
      ...imageFiles.map((file) =>
        this.storage.upload({
          buffer: file.buffer,
          mimeType: file.mimetype,
          originalName: file.originalname
        })
      ),
      ...base64Images.map((image) => this.storage.upload(image))
    ]);
  }

  async deleteImages(urls: string[]): Promise<void> {
    await Promise.all(urls.map((url) => this.storage.delete(url)));
  }
}
