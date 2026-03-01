import fp from "fastify-plugin";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface SupabasePluginOptions {}

export default fp<SupabasePluginOptions>(async (fastify) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_KEY || "",
  );
  fastify.decorate("supabase", supabase);
});

declare module "fastify" {
  export interface FastifyInstance {
    supabase: SupabaseClient;
  }
}
