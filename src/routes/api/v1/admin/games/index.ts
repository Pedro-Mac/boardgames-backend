import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { CreateGameInput, CreateGameOutput } from "../../../../../types/games";
import { HttpError } from "@fastify/sensible";
import { Type } from "@sinclair/typebox";

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

const games: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<AddGameRoute>("/", { schema }, async (request, reply) => {
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

    const game = await fastify.supabase
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

    if (game.error) {
      console.error("Error adding game:", game.error);
      throw fastify.httpErrors.internalServerError("Failed to add game");
    }

    const newGame: CreateGameOutput = {
      game: {
        id: game.data?.[0].id || "",
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
        created_at: game.data?.[0].created_at || "",
        image_url: "", // This should be set to the URL of the uploaded image
        created_by: "", // This should be set to the user ID of the person who added the game
        updated_at: game.data?.[0].created_at || "",
      },
    };

    reply.send(newGame);
  });
};

export default games;
