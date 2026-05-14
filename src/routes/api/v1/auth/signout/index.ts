import { FastifyPluginAsync } from "fastify";
import { SignoutRoute } from "./types";

const signout: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<SignoutRoute>("/", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";

    const { error } = await fastify.supabase.auth.admin.signOut(token, "local");

    if (error) {
      throw fastify.httpErrors.serviceUnavailable("Failed to sign out");
    }

    reply.send({ message: "User signed out successfully" });
  });
};

export default signout;
