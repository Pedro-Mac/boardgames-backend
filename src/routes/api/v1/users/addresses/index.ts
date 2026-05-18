import { Type } from "@sinclair/typebox";
import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { HttpError } from "@fastify/sensible";
import { SupabaseJwtPayload } from "../../../../../plugins/jwt";
import {
  AddressOutput,
  AddressInput,
  ListAddressesOutput,
  ListAddressesQuery,
} from "./types";

const PAGE_SIZE = 10;

interface ListAddressesRoute extends RouteGenericInterface {
  Querystring: ListAddressesQuery;
  Reply: ListAddressesOutput | HttpError;
}

interface CreateAddressRoute extends RouteGenericInterface {
  Body: AddressInput;
  Reply: AddressOutput | HttpError;
}

interface GetAddressByIdRoute extends RouteGenericInterface {
  Params: { id: string };
  Reply: AddressOutput | HttpError;
}

interface UpdateAddressRoute extends RouteGenericInterface {
  Params: { id: string };
  Body: AddressInput;
  Reply: AddressOutput | HttpError;
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
  const listQuerySchema = Type.Object({
    page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  });

  fastify.get<ListAddressesRoute>(
    "/",
    {
      schema: { querystring: listQuerySchema },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { sub } = request.user as SupabaseJwtPayload;
      const page = request.query.page ?? 1;
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count, error } = await fastify.supabase
        .from("addresses")
        .select("*", { count: "exact" })
        .eq("user_id", sub)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .range(from, to);

      if (error) {
        request.log.error(error, "Error fetching user addresses");
        throw fastify.httpErrors.serviceUnavailable("Error fetching addresses");
      }

      const total = count ?? 0;
      const rows = data ?? [];

      reply.send({
        addresses: rows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          streetLine1: row.street_line_1,
          streetLine2: row.street_line_2,
          city: row.city,
          state: row.state,
          postalCode: row.postal_code,
          country: row.country,
          phone: row.phone,
          isDefault: row.is_default,
          createdAt: row.created_at,
        })),
        pagination: {
          page,
          total,
          totalPages: Math.ceil(total / PAGE_SIZE),
        },
      });
    },
  );

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
        throw fastify.httpErrors.serviceUnavailable("Error creating address");
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
        throw fastify.httpErrors.serviceUnavailable("Error creating address");
      }

      reply.code(201).send({
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
      });
    },
  );

  fastify.get<GetAddressByIdRoute>(
    "/:id",
    {
      schema: bodySchema,
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { sub } = request.user as SupabaseJwtPayload;
      const { id } = request.params;

      const { data, error } = await fastify.supabase
        .from("addresses")
        .select("*")
        .eq("id", id)
        .eq("user_id", sub)
        .single();

      if (error) {
        request.log.error(error, "Error fetching address by ID");
        throw fastify.httpErrors.serviceUnavailable("Error fetching address");
      } else if (!data) {
        throw fastify.httpErrors.notFound("Address not found");
      }

      reply.send({
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
      });
    },
  );

  fastify.put<UpdateAddressRoute>(
    "/:id",
    {
      schema: bodySchema,
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { sub } = request.user as SupabaseJwtPayload;
      const { id } = request.params;
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

      // Check if the address belongs to the user
      const { data: existingAddress, error: fetchError } =
        await fastify.supabase
          .from("addresses")
          .select("*")
          .eq("id", id)
          .eq("user_id", sub)
          .single();

      if (fetchError) {
        request.log.error(fetchError, "Error fetching address for update");
        throw fastify.httpErrors.serviceUnavailable("Error updating address");
      } else if (!existingAddress) {
        throw fastify.httpErrors.notFound("Address not found");
      }

      const { data, error } = await fastify.supabase
        .from("addresses")
        .update({
          full_name: fullName,
          street_line_1: streetLine1,
          street_line_2: streetLine2 ?? null,
          city,
          state: state ?? null,
          postal_code: postalCode,
          country,
          phone: phone ?? null,
          is_default: isDefault ?? existingAddress.is_default,
        })
        .eq("id", id)
        .eq("user_id", sub)
        .select("*")
        .single();

      if (error) {
        throw fastify.httpErrors.serviceUnavailable(
          "Error updating address",
          error,
        );
      }

      reply.send({
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
      });
    },
  );
};

export default addresses;
