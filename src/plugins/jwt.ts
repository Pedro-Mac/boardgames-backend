import fp from "fastify-plugin";
import fastifyJwt, { TokenOrHeader } from "@fastify/jwt";
import { FastifyReply, FastifyRequest } from "fastify";
import buildGetJwks from "get-jwks";

export interface JwtPluginOptions {}

export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  app_metadata?: {
    permissions?: string[];
  };
  aud?: string;
  iat?: number;
  exp?: number;
}

export default fp<JwtPluginOptions>(async (fastify) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL environment variable is required");
  }

  const issuerDomain = `${supabaseUrl}/auth/v1`;

  const getJwks = buildGetJwks({
    issuersWhitelist: [issuerDomain],
  });

  fastify.register(fastifyJwt, {
    decode: { complete: true },
    secret: async (_request: FastifyRequest, token: TokenOrHeader) => {
      const { kid, alg } = "header" in token ? token.header : token;
      return getJwks.getPublicKey({ kid, alg, domain: issuerDomain });
    },
  });

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch (_err) {
        const error = new Error("Invalid or expired token");
        (error as Error & { statusCode: number }).statusCode = 401;
        throw error;
      }
    },
  );
});

declare module "fastify" {
  export interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: SupabaseJwtPayload;
    user: SupabaseJwtPayload;
  }
}
