import { join } from "node:path";
import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import { FastifyPluginAsync, FastifyServerOptions } from "fastify";
import { createClient } from "@supabase/supabase-js";

export interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {};

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts,
): Promise<void> => {
  // Place here your custom code!
  const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_KEY || "",
  );

  fastify.post("/api/v1/admin/login", async (request, reply) => {
    try {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      const auth = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (auth.error) {
        console.error("Error signing in:", auth.error);
        reply.status(401).send({ error: "Invalid credentials" });
        return;
      }

      const permissions = await supabase
        .from("user_permissions")
        .select("permissions(name)")
        .eq("user_id", auth.data.user.id)
        .single();

      if (permissions.error) {
        console.error("Error fetching permissions:", permissions.error);
        reply.status(500).send({ error: "Failed to fetch permissions" });
        return;
      }

      if (!permissions.data) {
        reply.status(403).send({ error: "No permissions found for user" });
        return;
      }

      // @ts-ignore
      if (permissions.data.permissions.name !== "backoffice_view") {
        reply
          .status(403)
          .send({ error: "User does not have backoffice permissions" });
        return;
      }

      const user = {};

      user.email = auth.data.user.email;

      console.log("obj", permissions);

      reply.send({ message: "Login successful", user });
    } catch (error) {
      console.error("Error during login:", error);
      reply.status(500).send({ error: "Failed to login" });
    }
  });

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options: opts,
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: opts,
  });
};

export default app;
export { app, options };
