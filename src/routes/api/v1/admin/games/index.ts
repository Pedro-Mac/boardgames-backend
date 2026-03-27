import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { CreateGameInput, CreateGameOutput } from "../../../../../types/games";
import { HttpError } from "@fastify/sensible";

interface AddGameRoute extends RouteGenericInterface {
  Body: CreateGameInput;
  Reply: CreateGameOutput | HttpError;
}

const games: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<AddGameRoute>("/", async (request, reply) => {
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
      throw fastify.httpErrors.badRequest(game.error.message);
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
