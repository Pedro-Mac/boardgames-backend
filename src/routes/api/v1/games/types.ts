import { HttpError } from "@fastify/sensible";

export interface GameOutput {
  id: string;

  // Core identity
  title: string;
  description: string;

  // Gameplay characteristics
  gameplay: {
    players: {
      min: number;
      max: number;
    };
    playtime: {
      min: number;
      max: number;
    };
    minAge: number;
  };

  // People & companies
  attribution: {
    publisher: string;
    authors: string[];
    designers: string[];
    artists: string[];
  };

  // Classification
  taxonomy: {
    categories: string[];
    mechanics: string[];
  };

  // Relationships with other games
  relationships: {
    type: "base" | "expansion";
    baseGameIds: string[];
    expansionIds: string[];
  };

  // Commercial data (optional separation depending on your system)
  commerce: {
    price: number;
    inStock: boolean;
  };
}

export interface ListGamesRoute {
  Querystring: ListGamesQuery;
  Reply: GameOutput[] | HttpError;
}

interface ListGamesQuery {
  page?: number;
  size?: number;
}

export interface GetGameRoute {
  Params: {
    id: string;
  };
  Reply: GameOutput | HttpError;
}
