import { Type } from "@sinclair/typebox";
import { FastifyPluginAsync } from "fastify";
import { SupabaseJwtPayload } from "../../../../../../plugins/jwt";
import { PatchMePasswordRoute } from "./types";

const patchMePasswordBodySchema = Type.Object(
  {
    newPassword: Type.String({ minLength: 6 }),
  },
  { additionalProperties: false },
);

const password: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.patch<PatchMePasswordRoute>(
    "/",
    {
      schema: { body: patchMePasswordBodySchema },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { sub } = request.user as SupabaseJwtPayload;
      const { newPassword } = request.body;

      const { error } = await fastify.supabase.auth.admin.updateUserById(sub, {
        password: newPassword,
      });

      if (error) {
        request.log.error(error, "Error updating password");
        throw fastify.httpErrors.internalServerError("Error updating password");
      }

      reply.send({ message: "Password updated successfully" });
    },
  );
};

export default password;
