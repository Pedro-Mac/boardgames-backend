import { FastifyPluginAsync } from "fastify";
import { SignupRoute } from "./types";
import { VALIDATE } from "../../../../../utils/validations";

const signup: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<SignupRoute>("/", async (request, reply) => {
    const { email, password, firstName, lastName } = request.body;

    if (!VALIDATE.EMAIL) {
      request.log.warn({ email }, "Invalid email format");
      throw fastify.httpErrors.badRequest(`Invalid email format - ${email}`);
    }

    if (!firstName || !lastName) {
      request.log.warn(
        { firstName, lastName },
        "Missing first name or last name",
      );
      throw fastify.httpErrors.badRequest(
        "First name and last name are required",
      );
    }

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
        {
          email: email,
          id: signupRes.data.user.id,
          first_name: firstName,
          last_name: lastName,
        },
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
      session: signupRes.data.session,
    });
  });
};

export default signup;
