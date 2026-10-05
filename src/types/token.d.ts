export type Token = {
  accessToken: string;
  refreshToken: string;
};

export type JwtRole = {
  id: number;
  name: string;
  code: string;
  permissions: string[];
};

export type JwtPayload = {
  sub: number;
  sessionId: number;
  role: JwtRole;
  permissions?: string[];
};

export type AuthenticatedUser = {
  accountId: number;
  sessionId: number;
  role: JwtRole;
  permissions: string[];
  refreshToken?: string;
};

declare global {
  namespace Express {
    interface User {
      accountId: AuthenticatedUser['accountId'];
      sessionId: AuthenticatedUser['sessionId'];
      role: AuthenticatedUser['role'];
      permissions: AuthenticatedUser['permissions'];
      refreshToken?: AuthenticatedUser['refreshToken'];
    }
  }
}
