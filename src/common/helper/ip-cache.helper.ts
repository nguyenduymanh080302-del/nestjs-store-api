import { createHash } from 'node:crypto';
import { getClientIp } from './client-ip.helper';

interface CacheRequest {
  method?: string;
  headers?: {
    authorization?: string;
    cookie?: string;
  };
  originalUrl?: string;
  url?: string;
  ip?: string;
  ips?: string[];
  socket?: {
    remoteAddress?: string | null;
  };
}

export function getIpCacheKey(request: CacheRequest): string | undefined {
  if (
    request.method !== 'GET' ||
    request.headers?.authorization ||
    request.headers?.cookie
  ) {
    return undefined;
  }

  const url = request.originalUrl || request.url;
  if (!url) {
    return undefined;
  }

  const ipHash = createHash('sha256')
    .update(getClientIp(request))
    .digest('hex');

  return `http:${ipHash}:${url}`;
}
