import { FastifyPluginAsync } from "fastify";
import { SigninRoute } from "./types";
import { VALIDATE } from "../../../../../utils/validations";

const signin: FastifyPluginAsync = async (fastify) => {
  fastify.post<SigninRoute>("/", async (request, reply) => {
    const { email, password } = request.body;

    const signInRes = await fastify.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!VALIDATE.EMAIL(email)) {
      request.log.warn({ email }, "Invalid email format");
      throw fastify.httpErrors.badRequest(`Invalid email format - ${email}`);
    }

    if (signInRes.error) {
      request.log.error(signInRes.error, "Error signing in user");
      throw fastify.httpErrors.unauthorized("Invalid email or password");
    }

    if (!signInRes.data.user) {
      throw fastify.httpErrors.serviceUnavailable("No user data from database");
    }

    reply.send({
      message: "User signed in successfully",
      user: signInRes.data.user,
      session: signInRes.data.session,
    });
  });
};

export default signin;
