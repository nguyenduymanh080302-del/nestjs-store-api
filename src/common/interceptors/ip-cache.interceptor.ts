import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { getIpCacheKey } from 'common/helper/ip-cache.helper';
import type { Request } from 'express';

@Injectable()
export class IpCacheInterceptor extends CacheInterceptor {
  protected trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest<Request>();
    return getIpCacheKey(request);
  }
}
