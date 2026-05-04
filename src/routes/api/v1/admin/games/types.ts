export interface Category {
  id: string;
  name: string;
  created_at: string;
}

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

export interface CreateGameInput {
  title: string;
  description: string;
  price: number; // in cents
  min_players: number;
  max_players: number;
  min_play_time: number; // in minutes
  max_play_time: number; // in minutes
  age_recommendation: number; // minimum age recommendation
  publisher: string;
  year_published: number;
  stock?: number;
  image_url?: string | null;
  category_ids?: string[];
}

export interface UpdateGameInput {
  title?: string;
  description?: string;
  price?: number; // in cents
  min_players?: number;
  max_players?: number;
  min_play_time?: number; // in minutes
  max_play_time?: number; // in minutes
  age_recommendation?: number; // minimum age recommendation
  publisher?: string;
  year_published?: number;
  image_url?: string | null;
  stock?: number;
  category_ids?: string[];
}

export interface GetGameParams {
  id: string;
}

export interface ListGamesQuery {
  page?: number;
  size?: number;
}

export interface Pagination {
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface ListGamesOutput {
  games: GameOutput[];
  pagination: Pagination;
}

export interface ListCategoriesOutput {
  categories: Category[];
}
