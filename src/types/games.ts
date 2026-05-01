export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Game {
  id: string;
  title: string;
  description: string;
  price: number; // in cents
  min_players: number;
  max_players: number;
  min_play_time: number; // in minutes
  max_play_time: number; // in minutes
  min_age: number; // minimum age recommendation
  publisher: string;
  year_published: number;
  image_url: string | null;
  stock: number;
  game_type: string;
  authors: string[];
  illustrators: string[];
  designers: string[];
  artists: string[];
  added_by: string | null;
  created_at: string; // ISO date string
  categories: Category[];
}

export interface CreateGameInput {
  title: string;
  description: string;
  price: number; // in cents
  min_players: number;
  max_players: number;
  min_play_time: number; // in minutes
  max_play_time: number; // in minutes
  min_age: number; // minimum age recommendation
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
  min_age?: number; // minimum age recommendation
  publisher?: string;
  year_published?: number;
  image_url?: string | null;
  stock?: number;
  category_ids?: string[];
}

export interface CreateGameOutput {
  game: Game;
}

export interface UpdateGameOutput {
  game: Game;
}

export interface GetGameParams {
  id: string;
}

export interface GetGameOutput {
  game: Game;
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
  games: Game[];
  pagination: Pagination;
}

export interface ListCategoriesOutput {
  categories: Category[];
}

