import { FastifyRequest, FastifyReply } from "fastify";
import type { SupabaseJwtPayload } from "../plugins/jwt";

export function requirePermission(permission: string) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const user = request.user as SupabaseJwtPayload;
    const permissions = user?.app_metadata?.permissions;

    if (!permissions || !permissions.includes(permission)) {
      throw reply.server.httpErrors.forbidden(`Missing required permission`);
    }
  };
}
