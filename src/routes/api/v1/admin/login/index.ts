import { HttpError } from "@fastify/sensible";
import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { User } from "../../../../../types/user";
import { LoginInput, LoginOutput } from "../../../../../types/authentication";
import { Session } from "../../../../../types/session";

interface PermissionRow {
  permissions: { name: string };
}
interface LoginRoute extends RouteGenericInterface {
  Body: LoginInput;
  Reply: LoginOutput | HttpError;
}

const login: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<LoginRoute>("/", async (request, reply) => {
    const { email, password } = request.body;

    const auth = await fastify.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (auth.error) {
      console.error("Error signing in:", auth.error);
      throw fastify.httpErrors.unauthorized("Invalid email or password");
    }

    if (!auth.data.user.email) {
      throw fastify.httpErrors.unauthorized(
        "There was an issue with your account. Please contact support.",
      );
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

    // Sync permissions into JWT claims (app_metadata) so subsequent
    // requests can read permissions from the token without a DB query.
    const { error: claimsError } = await fastify.supabase.rpc(
      "set_user_claims",
      { uid: auth.data.user.id },
    );

    if (claimsError) {
      fastify.log.error(claimsError, "Failed to sync user claims");
    }

    // Refresh the session to pick up the updated app_metadata in the JWT.
    const { data: refreshData, error: refreshError } =
      await fastify.supabase.auth.refreshSession({
        refresh_token: auth.data.session.refresh_token,
      });

    const activeSession = refreshError ? auth.data.session : refreshData.session!;

    const session: Session = {
      tokenType: activeSession.token_type,
      accessToken: activeSession.access_token,
      refreshToken: activeSession.refresh_token,
      expiresAt: activeSession.expires_at || null,
      expiresIn: activeSession.expires_in,
    };

    user.email = auth.data.user.email;

    reply.send({ user, session });
  });
};

export default login;
