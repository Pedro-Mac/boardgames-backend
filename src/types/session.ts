export interface Session {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  expiresAt: number | null;
  refreshToken: string;
}
