export const supabaseErrorCode = {
  rowNotFound: "PGRST116",
  uniqueConstraintViolation: "23505",
} as const;

export type SupabaseErrorCode =
  (typeof supabaseErrorCode)[keyof typeof supabaseErrorCode];
