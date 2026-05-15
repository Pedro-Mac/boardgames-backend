import { Type } from "@sinclair/typebox";
import { FastifyPluginAsync } from "fastify";
import { SupabaseJwtPayload } from "../../../../../plugins/jwt";
import { GetMeRoute, PatchMeRoute } from "./types";

const patchMeBodySchema = Type.Object(
  {
    firstName: Type.Optional(Type.String({ minLength: 1 })),
    lastName: Type.Optional(Type.String({ minLength: 1 })),
    email: Type.Optional(
      Type.String({
        format: "email",
        minLength: 1,
      }),
    ),
  },
  { additionalProperties: false },
);

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

  fastify.patch<PatchMeRoute>(
    "/",
    {
      schema: { body: patchMeBodySchema },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { sub } = request.user as SupabaseJwtPayload;
      const { firstName, lastName, email } = request.body;

      if (!firstName && !lastName && !email) {
        throw fastify.httpErrors.badRequest(
          "At least one field must be provided",
        );
      }

      const updates: Record<string, string> = {};
      if (firstName) updates.first_name = firstName;
      if (lastName) updates.last_name = lastName;
      if (email) updates.email = email;

      if (email) {
        const { error: authError } =
          await fastify.supabase.auth.admin.updateUserById(sub, { email });

        if (authError) {
          request.log.error(authError, "Error updating auth email");
          throw fastify.httpErrors.internalServerError(
            "Error updating user email",
          );
        }
      }

      const { data, error } = await fastify.supabase
        .from("users")
        .update(updates)
        .eq("id", sub)
        .select("id, email, first_name, last_name")
        .single();

      if (error) {
        request.log.error(error, "Error updating user profile");
        throw fastify.httpErrors.internalServerError(
          "Error updating user profile",
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
