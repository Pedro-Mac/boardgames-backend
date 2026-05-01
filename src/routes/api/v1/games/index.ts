import { Type } from "@sinclair/typebox";
import { FastifyPluginAsync } from "fastify";
import { ListGamesRoute } from "./types";

const listQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  size: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 })),
});

const games: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<ListGamesRoute>(
    "/",
    {
      schema: {
        querystring: listQuerySchema,
      },
    },
    async (request, reply) => {
      const page = request.query.page ?? 1;
      return { message: "List of games" };
    },
  );
};

export default games;
