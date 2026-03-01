import { FastifyPluginAsync } from "fastify";

const login: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post("/login", async (request, reply) => {
    try {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      const auth = await fastify.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (auth.error) {
        console.error("Error signing in:", auth.error);
        reply.status(401).send({ error: "Invalid credentials" });
        return;
      }

      const permissions = await fastify.supabase
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

      // @ts-ignore
      user.email = auth.data.user.email;

      console.log("obj", permissions);

      reply.send({ message: "Login successful", auth });
    } catch (error) {
      console.error("Error during login:", error);
      reply.status(500).send({ error: "Failed to login" });
    }
  });
};

export default login;
