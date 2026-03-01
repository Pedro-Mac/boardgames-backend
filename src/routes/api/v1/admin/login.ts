import { HttpError } from "@fastify/sensible";
import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { User } from "../../../../types/user";
import { Session } from "../../../../types/session";
import { LoginInput, LoginOutput } from "../../../../types/authentication";

interface LoginRoute extends RouteGenericInterface {
  Body: LoginInput;
  Reply: LoginOutput | HttpError;
}

const login: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<LoginRoute>("/login", async (request, reply) => {
    const { email, password } = request.body;

    const auth = await fastify.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (auth.error) {
      console.error("Error signing in:", auth.error);
      throw fastify.httpErrors.unauthorized("Invalid email or password");
    }

    const permissions = await fastify.supabase
      .from("user_permissions")
      .select("permissions(name)")
      .eq("user_id", auth.data.user.id)
      .single();

    if (permissions.error) {
      console.error("Error fetching permissions:", permissions.error);
      throw fastify.httpErrors.internalServerError(
        "Failed to fetch user permissions",
      );
    }

    if (!permissions.data) {
      throw fastify.httpErrors.forbidden("User does not have permissions");
    }

    // @ts-ignore
    if (permissions.data.permissions.name !== "backoffice_view") {
      throw fastify.httpErrors.forbidden(
        "User does not have the required permissions",
      );
    }

    const user = {};

    // @ts-ignore
    user.email = auth.data.user.email;

    console.log("obj", permissions);

    reply.send({ message: "Login successful", auth });
  });
};

export default login;
