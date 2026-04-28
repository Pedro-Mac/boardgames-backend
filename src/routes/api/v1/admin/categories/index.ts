import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { Category, ListCategoriesOutput } from "../../../../../types/games";
import { HttpError } from "@fastify/sensible";
import { requirePermission } from "../../../../../hooks/authorize";

interface ListCategoriesRoute extends RouteGenericInterface {
  Reply: ListCategoriesOutput | HttpError;
}

const categories: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<ListCategoriesRoute>(
    "/",
    {
      preHandler: [fastify.authenticate, requirePermission("game_view")],
    },
    async (_request, reply) => {
      const response = await fastify.supabase
        .from("categories")
        .select("*")
        .order("name");

      if (response.error) {
        console.error("Error listing categories:", response.error);
        throw fastify.httpErrors.badRequest(response.error.message);
      }

      const result: ListCategoriesOutput = {
        categories: (response.data ?? []) as Category[],
      };

      reply.send(result);
    },
  );
};

export default categories;
