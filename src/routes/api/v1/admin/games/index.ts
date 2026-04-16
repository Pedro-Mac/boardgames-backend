import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { CreateGameInput, CreateGameOutput, Game, ListGamesQuery, ListGamesOutput } from "../../../../../types/games";
import { HttpError } from "@fastify/sensible";
import { Type } from "@sinclair/typebox";
import { requirePermission } from "../../../../../hooks/authorize";

interface AddGameRoute extends RouteGenericInterface {
  Body: CreateGameInput;
  Reply: CreateGameOutput | HttpError;
}

const bodySchema = Type.Object({
  name: Type.String(),
  description: Type.String(),
  price: Type.Number(),
  min_players: Type.Number(),
  max_players: Type.Number(),
  min_play_time: Type.Number(),
  max_play_time: Type.Number(),
  age_recommendation: Type.Number(),
  publisher: Type.String(),
  year_published: Type.Number(),
});

const schema = {
  body: bodySchema,
};

interface ListGamesRoute extends RouteGenericInterface {
  Querystring: ListGamesQuery;
  Reply: ListGamesOutput | HttpError;
}

const listQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  size: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 })),
});

const games: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<ListGamesRoute>(
    "/",
    {
      schema: { querystring: listQuerySchema },
      preHandler: [fastify.authenticate, requirePermission("game_view")],
    },
    async (request, reply) => {
      const page = request.query.page ?? 1;
      const size = request.query.size ?? 10;
      const from = (page - 1) * size;
      const to = from + size - 1;

      const response = await fastify.supabase
        .from("games")
        .select("*", { count: "exact" })
        .range(from, to);

      if (response.error) {
        console.error("Error listing games:", response.error);
        throw fastify.httpErrors.badRequest(response.error.message);
      }

      const total = response.count ?? 0;
      const totalPages = Math.ceil(total / size);

      const result: ListGamesOutput = {
        games: (response.data ?? []) as Game[],
        pagination: { page, size, total, totalPages },
      };

      reply.send(result);
    },
  );

  fastify.post<AddGameRoute>(
    "/",
    {
      schema,
      preHandler: [fastify.authenticate, requirePermission("game_create")],
    },
    async (request, reply) => {
    const {
      name,
      description,
      price,
      min_players,
      max_players,
      min_play_time,
      max_play_time,
      age_recommendation,
      publisher,
      year_published,
    } = request.body;

    const response = await fastify.supabase
      .from("games")
      .insert({
        name,
        description,
        price,
        min_players,
        max_players,
        min_play_time,
        max_play_time,
        age_recommendation,
        publisher,
        year_published,
      })
      .select("*");

    if (response.error) {
      console.error("Error adding game:", response.error);
      throw fastify.httpErrors.badRequest(response.error.message);
    }

    if (!response.data || response.data.length === 0) {
      throw fastify.httpErrors.failedDependency(
        `Failed to retrieve the newly added game ${name}`,
      );
    }

    if (!response.data?.[0].id) {
      throw fastify.httpErrors.failedDependency(
        `Failed to retrieve the ID of the newly added game ${name}`,
      );
    }

    const newGame: CreateGameOutput = {
      game: {
        id: response.data?.[0].id || "",
        name,
        description,
        price,
        min_players,
        max_players,
        min_play_time,
        max_play_time,
        age_recommendation,
        publisher,
        year_published,
        created_at: response.data?.[0].created_at || "",
        image_url: "", // This should be set to the URL of the uploaded image
        created_by: "", // This should be set to the user ID of the person who added the game
        updated_at: response.data?.[0].created_at || "",
      },
    };

    reply.send(newGame);
  });
};

export default games;
