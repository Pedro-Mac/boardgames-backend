import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import {
  CreateGameInput,
  GetGameParams,
  ListGamesQuery,
  ListGamesOutput,
  UpdateGameInput,
  GameOutput,
} from "./types";
import { HttpError } from "@fastify/sensible";
import { Type } from "@sinclair/typebox";
import { requirePermission } from "../../../../../hooks/authorize";
import { supabaseErrorCode } from "../../../../../constants/supabase-errors";
import { mapDbGameToGame } from "./mappers";

interface AddGameRoute extends RouteGenericInterface {
  Body: CreateGameInput;
  Reply: GameOutput | HttpError;
}

const bodySchema = Type.Object({
  title: Type.String(),
  description: Type.String(),
  price: Type.Number(),
  min_players: Type.Number(),
  max_players: Type.Number(),
  min_play_time: Type.Number(),
  max_play_time: Type.Number(),
  age_recommendation: Type.Number(),
  publisher: Type.String(),
  year_published: Type.Number(),
  stock: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
  image_url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

const schema = {
  body: bodySchema,
};

interface GetGameRoute extends RouteGenericInterface {
  Params: GetGameParams;
  Reply: GameOutput | HttpError;
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
  Reply: GameOutput | HttpError;
}

const updateBodySchema = Type.Object({
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  price: Type.Optional(Type.Number()),
  min_players: Type.Optional(Type.Number()),
  max_players: Type.Optional(Type.Number()),
  min_play_time: Type.Optional(Type.Number()),
  max_play_time: Type.Optional(Type.Number()),
  age_recommendation: Type.Optional(Type.Number()),
  publisher: Type.Optional(Type.String()),
  year_published: Type.Optional(Type.Number()),
  image_url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  stock: Type.Optional(Type.Number({ minimum: 0 })),
});

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

      const rows = response.data ?? [];

      const total = response.count ?? 0;
      const totalPages = Math.ceil(total / size);

      const result: ListGamesOutput = {
        games: rows.map((row) =>
          mapDbGameToGame(
            row as unknown as Record<string, unknown>,
          ),
        ),
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

      reply.send(
        mapDbGameToGame(
          response.data as unknown as Record<string, unknown>,
        ),
      );
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
      const { age_recommendation, ...fields } = request.body;

      if (
        Object.keys(fields).length === 0 &&
        age_recommendation === undefined
      ) {
        throw fastify.httpErrors.badRequest(
          "At least one field must be provided",
        );
      }

      const dbUpdate = {
        ...fields,
        ...(age_recommendation !== undefined
          ? { min_age: age_recommendation }
          : {}),
      };

      if (Object.keys(dbUpdate).length > 0) {
        const updateResponse = await fastify.supabase
          .from("games")
          .update(dbUpdate)
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

      reply.send(
        mapDbGameToGame(
          gameResponse.data as unknown as Record<string, unknown>,
        ),
      );
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
        age_recommendation,
        publisher,
        year_published,
        stock,
        image_url,
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
          min_age: age_recommendation,
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

      reply.send(
        mapDbGameToGame(
          response.data as unknown as Record<string, unknown>,
        ),
      );
    },
  );
};

export default games;
