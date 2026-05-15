import { FastifyPluginAsync } from "fastify";
import { GetMeRoute } from "./types";
import { SupabaseJwtPayload } from "../../../../../plugins/jwt";

const me: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<GetMeRoute>(
    "/",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { sub } = request.user as SupabaseJwtPayload;

      const { data, error } = await fastify.supabase
        .from("users")
        .select("id, email, first_name, last_name")
        .eq("id", sub)
        .single();

      if (error) {
        request.log.error(error, "Error fetching user profile");
        throw fastify.httpErrors.internalServerError(
          "Error fetching user profile",
        );
      }

      if (!data) {
        throw fastify.httpErrors.notFound("User not found");
      }

      reply.send({
        id: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
      });
    },
  );
};

export default me;
