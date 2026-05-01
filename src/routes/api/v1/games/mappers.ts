import { Tables } from "../../../../types/database";
import { GameOutput } from "./types";

export const mapGameToOutput = (
  game: Tables<"games">,
  options: {
    categories?: string[];
    mechanics?: string[];
    baseGameIds?: string[];
    expansionIds?: string[];
  } = {},
): GameOutput => {
  const {
    categories = [],
    mechanics = [],
    baseGameIds = [],
    expansionIds = [],
  } = options;

  return {
    id: game.id,
    title: game.title,
    description: game.description,
    gameplay: {
      players: {
        min: game.min_players,
        max: game.max_players,
      },
      playtime: {
        min: game.min_play_time,
        max: game.max_play_time,
      },
      minAge: game.min_age,
    },
    attribution: {
      publisher: game.publisher,
      authors: game.authors,
      designers: game.designers,
      artists: game.artists,
    },
    taxonomy: {
      categories,
      mechanics,
    },
    relationships: {
      type: game.game_type as "base" | "expansion",
      baseGameIds,
      expansionIds,
    },
    commerce: {
      price: game.price,
      inStock: game.stock > 0,
    },
  };
};

