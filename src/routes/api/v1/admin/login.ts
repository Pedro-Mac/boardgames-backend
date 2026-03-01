import { HttpError } from "@fastify/sensible";
import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { User } from "../../../../types/user";
import { LoginInput, LoginOutput } from "../../../../types/authentication";
import { Session } from "../../../../types/session";

interface PermissionRow {
  permissions: { name: string };
}
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

    const permissionsQuery = await fastify.supabase
      .from("user_permissions")
      .select("permissions(name)")
      .eq("user_id", auth.data.user.id);

    const permissionsData = permissionsQuery.data as PermissionRow[] | null;

    if (permissionsQuery.error) {
      console.error("Error fetching permissions:", permissionsQuery.error);
      throw fastify.httpErrors.internalServerError(
        "Failed to fetch user permissions",
      );
    }

    if (!permissionsData) {
      throw fastify.httpErrors.forbidden("User does not have permissions");
    }

    const hasBackofficePermission = permissionsData.some(
      (item) => item.permissions.name === "backoffice_view",
    );

    if (!hasBackofficePermission) {
      throw fastify.httpErrors.forbidden(
        "User does not have the required permissions",
      );
    }

    const user: User = {
      id: auth.data.user.id,
      email: auth.data.user.email || "",
      permissions: permissionsData.map((item) => item.permissions.name),
    };

    const session: Session = {
      tokenType: auth.data.session.token_type,
      accessToken: auth.data.session.access_token,
      refreshToken: auth.data.session.refresh_token,
      expiresAt: auth.data.session.expires_at || null,
      expiresIn: auth.data.session.expires_in,
    };

    // @ts-ignore
    user.email = auth.data.user.email;

    reply.send({ user, session });
  });
};

export default login;
