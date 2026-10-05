import { getClientIp } from './client-ip.helper';

describe('getClientIp', () => {
  it('uses the first address resolved by a trusted proxy', () => {
    expect(
      getClientIp({
        ip: '10.0.0.1',
        ips: ['203.0.113.5', '10.0.0.1']
      })
    ).toBe('203.0.113.5');
  });

  it('normalizes IPv4-mapped IPv6 addresses', () => {
    expect(getClientIp({ ip: '::ffff:192.0.2.1' })).toBe('192.0.2.1');
  });

  it('falls back to the socket address', () => {
    expect(getClientIp({ socket: { remoteAddress: '2001:db8::1' } })).toBe(
      '2001:db8::1'
    );
  });

  it('uses a stable fallback when no address is available', () => {
    expect(getClientIp({})).toBe('unknown');
  });
});
