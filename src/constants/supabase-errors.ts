// Source references:
// - PostgREST error codes (PGRSTxxx):
//   https://docs.postgrest.org/en/stable/references/errors.html
// - PostgreSQL SQLSTATE error codes (23xxx):
//   https://www.postgresql.org/docs/current/errcodes-appendix.html
export const supabaseErrorCode = {
  rowNotFound: "PGRST116",
  uniqueConstraintViolation: "23505",
  foreignKeyViolation: "23503",
} as const;

export type SupabaseErrorCode =
  (typeof supabaseErrorCode)[keyof typeof supabaseErrorCode];
