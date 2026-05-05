import fp from "fastify-plugin";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../types/database";

export interface SupabasePluginOptions {}

export default fp<SupabasePluginOptions>(async (fastify) => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_KEY || "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
  fastify.decorate("supabase", supabase);
});

declare module "fastify" {
  export interface FastifyInstance {
    supabase: SupabaseClient<Database>;
  }
}
