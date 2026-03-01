export interface Session {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  expiresAt: number;
  refreshToken: string;
}
