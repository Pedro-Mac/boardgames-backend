import { HttpError } from "@fastify/sensible";
import { Type } from "@sinclair/typebox";
import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { requirePermission } from "../../../../../hooks/authorize";
import {
  CreatePermissionInput,
  CreatePermissionOutput,
} from "../../../../../types/permissions";
import { supabaseErrorCode } from "../../../../../constants/supabase-errors";

interface CreatePermissionRoute extends RouteGenericInterface {
  Body: CreatePermissionInput;
  Reply: CreatePermissionOutput | HttpError;
}

const createPermissionBodySchema = Type.Object({
  name: Type.String({ minLength: 1 }),
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
};

export default permissions;
