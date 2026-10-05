import { Global, Module } from '@nestjs/common';
import { ImageService } from './image.service';
import { R2StorageService } from './r2-storage.service';

@Global()
@Module({
  providers: [ImageService, R2StorageService],
  exports: [ImageService]
})
export class ImageModule {}
