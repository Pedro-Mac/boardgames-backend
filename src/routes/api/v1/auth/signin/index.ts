import { FastifyPluginAsync } from "fastify";
import { SigninRoute } from "./types";
import { VALIDATE } from "../../../../../utils/validations";

const signin: FastifyPluginAsync = async (fastify) => {
  fastify.post<SigninRoute>("/", async (request, reply) => {
    const { email, password } = request.body;

    if (!VALIDATE.EMAIL(email)) {
      request.log.warn({ email }, "Invalid email format");
      throw fastify.httpErrors.badRequest(`Invalid email format - ${email}`);
    }

    const signInRes = await fastify.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInRes.error) {
      request.log.error(signInRes.error, "Error signing in user");
      throw fastify.httpErrors.unauthorized("Invalid email or password");
    }

    if (!signInRes.data.user) {
      throw fastify.httpErrors.serviceUnavailable("No user data from database");
    }

    const profileRes = await fastify.supabase
      .from("users")
      .select("id, email, first_name, last_name")
      .eq("id", signInRes.data.user.id)
      .single();

    if (profileRes.error || !profileRes.data) {
      request.log.error(profileRes.error, "Error fetching user profile");
      throw fastify.httpErrors.internalServerError(
        "Error fetching user profile",
      );
    }

    reply.send({
      message: "User signed in successfully",
      user: {
        id: profileRes.data.id,
        email: profileRes.data.email,
        firstName: profileRes.data.first_name,
        lastName: profileRes.data.last_name,
      },
      session: signInRes.data.session,
    });
  });
};

export default signin;
