import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import {
  Category,
  CreateGameInput,
  CreateGameOutput,
  Game,
  GetGameParams,
  GetGameOutput,
  ListGamesQuery,
  ListGamesOutput,
  UpdateGameInput,
  UpdateGameOutput,
} from "../../../../../types/games";
import { HttpError } from "@fastify/sensible";
import { Type } from "@sinclair/typebox";
import { requirePermission } from "../../../../../hooks/authorize";
import { supabaseErrorCode } from "../../../../../constants/supabase-errors";

interface AddGameRoute extends RouteGenericInterface {
  Body: CreateGameInput;
  Reply: CreateGameOutput | HttpError;
}

const bodySchema = Type.Object({
  title: Type.String(),
  description: Type.String(),
  price: Type.Number(),
  min_players: Type.Number(),
  max_players: Type.Number(),
  min_play_time: Type.Number(),
  max_play_time: Type.Number(),
  min_age: Type.Number(),
  publisher: Type.String(),
  year_published: Type.Number(),
  stock: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
  image_url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  category_ids: Type.Optional(Type.Array(Type.String())),
});

const schema = {
  body: bodySchema,
};

interface GetGameRoute extends RouteGenericInterface {
  Params: GetGameParams;
  Reply: GetGameOutput | HttpError;
}

interface DeleteGameRoute extends RouteGenericInterface {
  Params: GetGameParams;
  Reply: void | HttpError;
}

const getGameParamsSchema = Type.Object({
  id: Type.String(),
});

interface ListGamesRoute extends RouteGenericInterface {
  Querystring: ListGamesQuery;
  Reply: ListGamesOutput | HttpError;
}

interface UpdateGameRoute extends RouteGenericInterface {
  Params: GetGameParams;
  Body: UpdateGameInput;
  Reply: UpdateGameOutput | HttpError;
}

const updateBodySchema = Type.Object({
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  price: Type.Optional(Type.Number()),
  min_players: Type.Optional(Type.Number()),
  max_players: Type.Optional(Type.Number()),
  min_play_time: Type.Optional(Type.Number()),
  max_play_time: Type.Optional(Type.Number()),
  min_age: Type.Optional(Type.Number()),
  publisher: Type.Optional(Type.String()),
  year_published: Type.Optional(Type.Number()),
  image_url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  stock: Type.Optional(Type.Number({ minimum: 0 })),
  category_ids: Type.Optional(Type.Array(Type.String())),
});

const listQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  size: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 })),
});

/** Attach categories to a list of game rows from Supabase. */
async function attachCategories(
  fastify: Parameters<FastifyPluginAsync>[0],
  gameIds: string[],
): Promise<Map<string, Category[]>> {
  const map = new Map<string, Category[]>();
  if (gameIds.length === 0) return map;

  const response = await fastify.supabase
    .from("game_categories")
    .select("game_id, categories(id, name, created_at)")
    .in("game_id", gameIds);

  if (response.error) {
    console.error("Error fetching categories for games:", response.error);
    return map;
  }

  for (const row of response.data ?? []) {
    const categories = Array.isArray(row.categories)
      ? (row.categories as Category[])
      : row.categories
        ? [row.categories as Category]
        : [];
    map.set(row.game_id, categories);
  }

  return map;
}

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

      const rows = response.data ?? [];
      const gameIds = rows.map((g) => g.id);
      const categoryMap = await attachCategories(fastify, gameIds);

      const total = response.count ?? 0;
      const totalPages = Math.ceil(total / size);

      const result: ListGamesOutput = {
        games: rows.map((row) => ({
          ...(row as unknown as Game),
          categories: categoryMap.get(row.id) ?? [],
        })),
        pagination: { page, size, total, totalPages },
      };

      reply.send(result);
    },
  );

  fastify.get<GetGameRoute>(
    "/:id",
    {
      schema: { params: getGameParamsSchema },
      preHandler: [fastify.authenticate, requirePermission("game_view")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const response = await fastify.supabase
        .from("games")
        .select("*")
        .eq("id", id)
        .single();

      if (response.error) {
        console.error("Error fetching game:", response.error);
        if (response.error.code === supabaseErrorCode.rowNotFound) {
          throw fastify.httpErrors.notFound(`Game with id ${id} not found`);
        }
        throw fastify.httpErrors.badRequest(response.error.message);
      }

      const categoryMap = await attachCategories(fastify, [id]);

      const result: GetGameOutput = {
        game: {
          ...(response.data as unknown as Game),
          categories: categoryMap.get(id) ?? [],
        },
      };

      reply.send(result);
    },
  );

  fastify.put<UpdateGameRoute>(
    "/:id",
    {
      schema: { params: getGameParamsSchema, body: updateBodySchema },
      preHandler: [fastify.authenticate, requirePermission("game_update")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { category_ids, ...fields } = request.body;

      if (Object.keys(fields).length === 0 && category_ids === undefined) {
        throw fastify.httpErrors.badRequest("At least one field must be provided");
      }

      if (Object.keys(fields).length > 0) {
        const updateResponse = await fastify.supabase
          .from("games")
          .update(fields)
          .eq("id", id)
          .select("*")
          .single();

        if (updateResponse.error) {
          console.error("Error updating game:", updateResponse.error);
          if (updateResponse.error.code === supabaseErrorCode.rowNotFound) {
            throw fastify.httpErrors.notFound(`Game with id ${id} not found`);
          }
          throw fastify.httpErrors.badRequest(updateResponse.error.message);
        }
      }

      if (category_ids !== undefined) {
        await fastify.supabase
          .from("game_categories")
          .delete()
          .eq("game_id", id);

        if (category_ids.length > 0) {
          const catResponse = await fastify.supabase
            .from("game_categories")
            .insert(category_ids.map((cid) => ({ game_id: id, category_id: cid })));

          if (catResponse.error) {
            console.error("Error updating game categories:", catResponse.error);
            throw fastify.httpErrors.badRequest(catResponse.error.message);
          }
        }
      }

      const gameResponse = await fastify.supabase
        .from("games")
        .select("*")
        .eq("id", id)
        .single();

      if (gameResponse.error) {
        if (gameResponse.error.code === supabaseErrorCode.rowNotFound) {
          throw fastify.httpErrors.notFound(`Game with id ${id} not found`);
        }
        throw fastify.httpErrors.badRequest(gameResponse.error.message);
      }

      const categoryMap = await attachCategories(fastify, [id]);

      const result: UpdateGameOutput = {
        game: {
          ...(gameResponse.data as unknown as Game),
          categories: categoryMap.get(id) ?? [],
        },
      };

      reply.send(result);
    },
  );

  fastify.delete<DeleteGameRoute>(
    "/:id",
    {
      schema: { params: getGameParamsSchema },
      preHandler: [fastify.authenticate, requirePermission("game_delete")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const response = await fastify.supabase
        .from("games")
        .delete()
        .eq("id", id)
        .select("*")
        .single();

      if (response.error) {
        console.error("Error deleting game:", response.error);
        if (response.error.code === supabaseErrorCode.rowNotFound) {
          throw fastify.httpErrors.notFound(`Game with id ${id} not found`);
        }
        throw fastify.httpErrors.badRequest(response.error.message);
      }

      reply.code(204).send(undefined);
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
        title,
        description,
        price,
        min_players,
        max_players,
        min_play_time,
        max_play_time,
        min_age,
        publisher,
        year_published,
        stock,
        image_url,
        category_ids,
      } = request.body;

      const response = await fastify.supabase
        .from("games")
        .insert({
          title,
          description,
          price,
          min_players,
          max_players,
          min_play_time,
          max_play_time,
          min_age,
          publisher,
          year_published,
          stock: stock ?? 0,
          image_url: image_url ?? null,
        })
        .select("*")
        .single();

      if (response.error) {
        console.error("Error adding game:", response.error);
        throw fastify.httpErrors.badRequest(response.error.message);
      }

      const newGameId: string = response.data.id;

      if (category_ids && category_ids.length > 0) {
        const catResponse = await fastify.supabase
          .from("game_categories")
          .insert(category_ids.map((cid) => ({ game_id: newGameId, category_id: cid })));

        if (catResponse.error) {
          console.error("Error inserting game categories:", catResponse.error);
          throw fastify.httpErrors.badRequest(catResponse.error.message);
        }
      }

      const categoryMap = await attachCategories(fastify, [newGameId]);

      const newGame: CreateGameOutput = {
        game: {
          ...(response.data as unknown as Game),
          categories: categoryMap.get(newGameId) ?? [],
        },
      };

      reply.send(newGame);
    },
  );
};

export default games;
