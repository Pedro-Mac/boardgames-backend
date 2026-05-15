import { Type } from "@sinclair/typebox";
import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { HttpError } from "@fastify/sensible";
import { SupabaseJwtPayload } from "../../../../../plugins/jwt";
import { AddressOutput, CreateAddressInput } from "./types";

interface CreateAddressRoute extends RouteGenericInterface {
  Body: CreateAddressInput;
  Reply: { address: AddressOutput } | HttpError;
}

const bodySchema = Type.Object(
  {
    fullName: Type.String({ minLength: 1 }),
    streetLine1: Type.String({ minLength: 1 }),
    streetLine2: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    city: Type.String({ minLength: 1 }),
    state: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    postalCode: Type.String({ minLength: 1 }),
    country: Type.String({ minLength: 1 }),
    phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    isDefault: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const addresses: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post<CreateAddressRoute>(
    "/",
    {
      schema: { body: bodySchema },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { sub } = request.user as SupabaseJwtPayload;
      const {
        fullName,
        streetLine1,
        streetLine2,
        city,
        state,
        postalCode,
        country,
        phone,
        isDefault,
      } = request.body;

      const { count, error: countError } = await fastify.supabase
        .from("addresses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", sub);

      if (countError) {
        request.log.error(countError, "Error counting user addresses");
        throw fastify.httpErrors.internalServerError("Error creating address");
      }

      const isFirstAddress = (count ?? 0) === 0;
      const shouldBeDefault = isFirstAddress || isDefault === true;

      const { data, error } = await fastify.supabase
        .from("addresses")
        .insert({
          user_id: sub,
          full_name: fullName,
          street_line_1: streetLine1,
          street_line_2: streetLine2 ?? null,
          city,
          state: state ?? null,
          postal_code: postalCode,
          country,
          phone: phone ?? null,
          is_default: shouldBeDefault,
        })
        .select("*")
        .single();

      if (error) {
        request.log.error(error, "Error inserting address");
        throw fastify.httpErrors.internalServerError("Error creating address");
      }

      reply.code(201).send({
        address: {
          id: data.id,
          fullName: data.full_name,
          streetLine1: data.street_line_1,
          streetLine2: data.street_line_2,
          city: data.city,
          state: data.state,
          postalCode: data.postal_code,
          country: data.country,
          phone: data.phone,
          isDefault: data.is_default,
          createdAt: data.created_at,
        },
      });
    },
  );
};

export default addresses;
