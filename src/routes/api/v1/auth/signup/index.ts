import { FastifyPluginAsync } from "fastify";
import { SignupRoute } from "./types";

const signup: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<SignupRoute>("/", async (request, reply) => {
    const { email, password } = request.body;

    const user = await fastify.supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (user.data) {
      request.log.warn({ email }, "Attempt to sign up with existing email");
      throw fastify.httpErrors.conflict("Email already in use");
    }

    const signupRes = await fastify.supabase.auth.signUp({
      email,
      password,
    });

    if (signupRes.error) {
      request.log.error(signupRes.error, "Error signing up user");
      throw fastify.httpErrors.badRequest("Error signing up user");
    }

    if (!signupRes.data.user) {
      throw fastify.httpErrors.serviceUnavailable("No user data from database");
    }

    const userRes = await fastify.supabase
      .from("users")
      .insert([
        { email: email, name: "some name", id: signupRes.data.user.id },
      ]);

    if (userRes.error) {
      request.log.error(userRes.error, "Error inserting user into database");
      throw fastify.httpErrors.serviceUnavailable(
        "Error adding user to database",
      );
    }

    reply.send({
      message: "User signed up successfully",
      user: signupRes.data.user,
    });
  });
};

export default signup;
