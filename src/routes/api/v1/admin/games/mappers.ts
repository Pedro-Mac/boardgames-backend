import { Category, GameOutput } from "./types";

/** Map a raw DB game row to the API Game shape (renames min_age → age_recommendation). */
export function mapDbGameToGame(
  row: Record<string, unknown>,
  categories: Category[] = [],
): GameOutput {
  const { min_age, ...rest } = row as Record<string, unknown> & {
    min_age: number;
  };
  return {
    ...(rest as unknown as Omit<
      GameOutput,
      "age_recommendation" | "categories"
    >),
    age_recommendation: min_age,
    categories,
  };
}
