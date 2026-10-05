interface IpRequest {
  ip?: string;
  ips?: string[];
  socket?: {
    remoteAddress?: string | null;
  };
}

/**
 * Returns the canonical client address resolved by Express.
 *
 * Express only reads forwarded addresses when `trust proxy` is configured, so
 * callers cannot opt into spoofable forwarding headers independently.
 */
export function getClientIp(request: IpRequest): string {
  const address =
    request.ips?.[0] ?? request.ip ?? request.socket?.remoteAddress;

  if (!address) {
    return 'unknown';
  }

  // Node represents IPv4 peers on dual-stack sockets as IPv4-mapped IPv6.
  return address.startsWith('::ffff:') ? address.slice(7) : address;
}
