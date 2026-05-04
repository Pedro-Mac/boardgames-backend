import { Category, GameOutput } from "./types";

interface DbGameRow {
  id: string;
  title: string;
  description: string;
  price: number;
  min_players: number;
  max_players: number;
  min_play_time: number;
  max_play_time: number;
  min_age: number;
  publisher: string;
  stock: number;
  [key: string]: unknown;
}

/** Map a raw DB game row to the API GameOutput shape. */
export function mapDbGameToGame(
  row: Record<string, unknown>,
  categories: Category[] = [],
): GameOutput {
  const r = row as DbGameRow;

  return {
    id: r.id,
    title: r.title,
    description: r.description,
    gameplay: {
      players: {
        min: r.min_players,
        max: r.max_players,
      },
      playtime: {
        min: r.min_play_time,
        max: r.max_play_time,
      },
      minAge: r.min_age,
    },
    attribution: {
      publisher: r.publisher,
      authors: [],
      designers: [],
      artists: [],
    },
    taxonomy: {
      categories: categories.map((c) => c.name),
      mechanics: [],
    },
    relationships: {
      type: "base",
      baseGameIds: [],
      expansionIds: [],
    },
    commerce: {
      price: r.price,
      inStock: r.stock > 0,
    },
  };
}
