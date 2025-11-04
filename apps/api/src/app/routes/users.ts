import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import {
  conflictErrorResponseSchema,
  internalServerErrorResponseSchema,
  notFoundErrorResponseSchema,
  validationErrorResponseSchema,
} from '../schemas/error.schema';
import { emptyResponseSchema } from '../schemas/general.schema';
import {
  createUserSchema,
  emailParamsSchema,
  updateUserSchema,
  userIdParamsSchema,
  userResponseSchema,
  usersResponseSchema,
} from '../schemas/user.schema';
import { UserService } from '../services/user.service';

export default async function (fastify: FastifyInstance) {
  const userService = fastify.diContainer.resolve<UserService>('userService');

  /**
   * GET /users
   * Get all users
   */
  fastify.get(
    '/users',
    {
      schema: {
        description: 'Get all users',
        tags: ['users'],
        response: {
          200: usersResponseSchema,
          500: internalServerErrorResponseSchema,
        },
      },
    },
    async (_, reply) => {
      const users = await userService.getAllUsers();
      return reply.send(users);
    },
  );

  /**
   * GET /users/:userId
   * Get a user by ID
   */
  fastify.get<{ Params: z.infer<typeof userIdParamsSchema> }>(
    '/users/:userId',
    {
      schema: {
        description: 'Get a user by ID',
        tags: ['users'],
        params: userIdParamsSchema,
        response: {
          200: userResponseSchema,
          400: validationErrorResponseSchema,
          404: notFoundErrorResponseSchema,
          500: internalServerErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await userService.getUserById(request.params.userId);
      return reply.send(user);
    },
  );

  /**
   * GET /users/email/:emailAddress
   * Get a user by email address
   */
  fastify.get<{ Params: z.infer<typeof emailParamsSchema> }>(
    '/users/email/:emailAddress',
    {
      schema: {
        description: 'Get a user by email address',
        tags: ['users'],
        params: emailParamsSchema,
        response: {
          200: userResponseSchema,
          400: validationErrorResponseSchema,
          404: notFoundErrorResponseSchema,
          500: internalServerErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await userService.getUserByEmail(request.params.emailAddress);
      return reply.send(user);
    },
  );

  /**
   * POST /users
   * Create a new user
   */
  fastify.post<{
    Body: z.infer<typeof createUserSchema>;
  }>(
    '/users',
    {
      schema: {
        description: 'Create a new user',
        tags: ['users'],
        body: createUserSchema,
        response: {
          201: userResponseSchema,
          400: validationErrorResponseSchema,
          409: conflictErrorResponseSchema,
          500: internalServerErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = createUserSchema.parse(request.body);
      const user = await userService.createUser(body);
      return reply.status(201).send(user);
    },
  );

  /**
   * PUT /users/:userId
   * Update a user
   */
  fastify.put<{
    Params: z.infer<typeof userIdParamsSchema>;
    Body: z.infer<typeof updateUserSchema>;
  }>(
    '/users/:userId',
    {
      schema: {
        description: 'Update a user',
        tags: ['users'],
        params: userIdParamsSchema,
        body: updateUserSchema,
        response: {
          200: userResponseSchema,
          400: validationErrorResponseSchema,
          404: notFoundErrorResponseSchema,
          409: conflictErrorResponseSchema,
          500: internalServerErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await userService.updateUser(request.params.userId, request.body);
      return reply.send(user);
    },
  );

  /**
   * DELETE /users/:userId
   * Delete a user
   */
  fastify.delete<{ Params: z.infer<typeof userIdParamsSchema> }>(
    '/users/:userId',
    {
      schema: {
        description: 'Delete a user',
        tags: ['users'],
        params: userIdParamsSchema,
        response: {
          204: emptyResponseSchema,
          400: validationErrorResponseSchema,
          404: notFoundErrorResponseSchema,
          500: internalServerErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await userService.deleteUser(request.params.userId);
      return reply.status(204).send();
    },
  );
}
