import { HttpError } from "@fastify/sensible";
import { Type } from "@sinclair/typebox";
import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { requirePermission } from "../../../../../hooks/authorize";
import {
  AssignPermissionToUserBody,
  AssignPermissionToUserParams,
} from "../../../../../types/permissions";
import { supabaseErrorCode } from "../../../../../constants/supabase-errors";

interface AssignPermissionRoute extends RouteGenericInterface {
  Params: AssignPermissionToUserParams;
  Body: AssignPermissionToUserBody;
  Reply: void | HttpError;
}

const assignPermissionParamsSchema = Type.Object({
  userId: Type.String(),
});

const assignPermissionBodySchema = Type.Object({
  permission_id: Type.String({ minLength: 1 }),
});

const users: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<AssignPermissionRoute>(
    "/:userId/permissions",
    {
      schema: {
        params: assignPermissionParamsSchema,
        body: assignPermissionBodySchema,
      },
      preHandler: [fastify.authenticate, requirePermission("permissions_manage")],
    },
    async (request, reply) => {
      const { userId } = request.params;
      const { permission_id } = request.body;

      const userResponse = await fastify.supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

      if (userResponse.error) {
        if (userResponse.error.code === supabaseErrorCode.rowNotFound) {
          throw fastify.httpErrors.notFound(`User with id ${userId} not found`);
        }
        throw fastify.httpErrors.badRequest(userResponse.error.message);
      }

      const permissionResponse = await fastify.supabase
        .from("permissions")
        .select("id")
        .eq("id", permission_id)
        .single();

      if (permissionResponse.error) {
        if (permissionResponse.error.code === supabaseErrorCode.rowNotFound) {
          throw fastify.httpErrors.notFound(
            `Permission with id ${permission_id} not found`,
          );
        }
        throw fastify.httpErrors.badRequest(permissionResponse.error.message);
      }

      const insertResponse = await fastify.supabase
        .from("user_permissions")
        .insert({ user_id: userId, permission_id })
        .select("user_id")
        .single();

      if (insertResponse.error) {
        if (
          insertResponse.error.code === supabaseErrorCode.uniqueConstraintViolation
        ) {
          throw fastify.httpErrors.conflict(
            "Permission is already assigned to this user",
          );
        }
        throw fastify.httpErrors.badRequest(insertResponse.error.message);
      }

      reply.code(201).send();
    },
  );
};

export default users;
