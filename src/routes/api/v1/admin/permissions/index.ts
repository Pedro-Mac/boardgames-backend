import { HttpError } from "@fastify/sensible";
import { Type } from "@sinclair/typebox";
import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { requirePermission } from "../../../../../hooks/authorize";
import {
  CreatePermissionInput,
  CreatePermissionOutput,
  DeletePermissionParams,
} from "../../../../../types/permissions";
import { supabaseErrorCode } from "../../../../../constants/supabase-errors";

interface CreatePermissionRoute extends RouteGenericInterface {
  Body: CreatePermissionInput;
  Reply: CreatePermissionOutput | HttpError;
}

interface DeletePermissionRoute extends RouteGenericInterface {
  Params: DeletePermissionParams;
  Reply: void | HttpError;
}

const createPermissionBodySchema = Type.Object({
  name: Type.String({ minLength: 1 }),
});

const deletePermissionParamsSchema = Type.Object({
  id: Type.String(),
});

const permissions: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<CreatePermissionRoute>(
    "/",
    {
      schema: { body: createPermissionBodySchema },
      preHandler: [fastify.authenticate, requirePermission("permissions_manage")],
    },
    async (request, reply) => {
      const { name } = request.body;

      const response = await fastify.supabase
        .from("permissions")
        .insert({ name })
        .select("id, name")
        .single();

      if (response.error) {
        if (response.error.code === supabaseErrorCode.uniqueConstraintViolation) {
          throw fastify.httpErrors.conflict(
            "A permission with that name already exists",
          );
        }
        throw fastify.httpErrors.badRequest(response.error.message);
      }

      const result: CreatePermissionOutput = {
        permission: {
          id: response.data.id,
          name: response.data.name,
        },
      };

      reply.code(201).send(result);
    },
  );

  fastify.delete<DeletePermissionRoute>(
    "/:id",
    {
      schema: { params: deletePermissionParamsSchema },
      preHandler: [fastify.authenticate, requirePermission("permissions_manage")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const response = await fastify.supabase
        .from("permissions")
        .delete()
        .eq("id", id)
        .select("id")
        .single();

      if (response.error) {
        if (response.error.code === supabaseErrorCode.rowNotFound) {
          throw fastify.httpErrors.notFound(`Permission with id ${id} not found`);
        }

        if (response.error.code === supabaseErrorCode.foreignKeyViolation) {
          throw fastify.httpErrors.conflict(
            "Permission is assigned to users and cannot be deleted",
          );
        }

        throw fastify.httpErrors.badRequest(response.error.message);
      }

      reply.code(204).send(undefined);
    },
  );
};

export default permissions;
