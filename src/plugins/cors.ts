import fp from "fastify-plugin";
import cors from "@fastify/cors";

export default fp(async (fastify) => {
  fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
});
