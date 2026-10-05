import { getIpCacheKey } from './ip-cache.helper';

describe('getIpCacheKey', () => {
  it('creates different cache keys for different client IPs', () => {
    const first = getIpCacheKey({
      method: 'GET',
      headers: {},
      ip: '192.0.2.1',
      originalUrl: '/api/v1/product?page=1'
    });
    const second = getIpCacheKey({
      method: 'GET',
      headers: {},
      ip: '192.0.2.2',
      originalUrl: '/api/v1/product?page=1'
    });

    expect(first).not.toBe(second);
  });

  it.each([
    ['authenticated', { authorization: 'Bearer token' }],
    ['cookie-bearing', { cookie: 'session=value' }]
  ])('does not cache %s requests', (_name, headers) => {
    expect(
      getIpCacheKey({
        method: 'GET',
        headers,
        ip: '192.0.2.1',
        originalUrl: '/api/v1/auth/me'
      })
    ).toBeUndefined();
  });

  it('does not cache mutation requests', () => {
    expect(
      getIpCacheKey({
        method: 'POST',
        headers: {},
        ip: '192.0.2.1',
        originalUrl: '/api/v1/product'
      })
    ).toBeUndefined();
  });
});
