import { Type } from "@sinclair/typebox";
import { FastifyPluginAsync } from "fastify";
import { GetGameRoute, ListGamesRoute } from "./types";
import { mapGameToOutput } from "./mappers";

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
      const size = request.query.size ?? 10;
      const from = (page - 1) * size;
      const to = from + size - 1;

      const res = await fastify.supabase
        .from("games")
        .select("*", { count: "exact" })
        .range(from, to);

      if (res.error) {
        request.log.error(res.error, "Error fetching games from database");
        throw fastify.httpErrors.serviceUnavailable("Database unavailable");
      }

      const output = res.data.map((game) => mapGameToOutput(game));

      reply.send(output);
    },
  );

  fastify.get<GetGameRoute>("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const res = await fastify.supabase
      .from("games")
      .select("*")
      .eq("id", id)
      .single();

    if (res.error) {
      if (res.status === 404) {
        throw fastify.httpErrors.notFound("Game not found");
      }
      request.log.error(res.error, "Error fetching game from database");
      throw fastify.httpErrors.serviceUnavailable("Database unavailable");
    }

    if (!res.data) {
      throw fastify.httpErrors.notFound("Game not found");
    }

    const output = mapGameToOutput(res.data);
    reply.send(output);
  });
};

export default games;
