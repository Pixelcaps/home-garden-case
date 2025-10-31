import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import {
  createUserSchema,
  emailParamsSchema,
  updateUserSchema,
  userIdParamsSchema,
} from '../schemas/user.schema';
import { UserService } from '../services/user.service';
import {
  conflictErrorResponse,
  internalServerErrorResponse,
  notFoundErrorResponse,
  validationErrorResponse,
} from '../specs/shared.specs';

const userRequest = {
  type: 'object',
  properties: {
    firstName: { type: 'string', nullable: true },
    lastName: { type: 'string', nullable: true },
    age: { type: 'number', nullable: true },
    emailAddress: { type: 'string', format: 'email' },
  },
};

const userResponse = {
  type: 'object',
  properties: {
    userId: { type: 'number' },
    firstName: { type: 'string', nullable: true },
    lastName: { type: 'string', nullable: true },
    age: { type: 'number', nullable: true },
    emailAddress: { type: 'string', format: 'email' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

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
          200: {
            description: 'List of users',
            type: 'array',
            items: userResponse,
          },
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const users = await userService.getAllUsers();
      return reply.send(users);
    },
  );

  /**
   * GET /users/:userId
   * Get a user by ID
   */
  fastify.get<{ Params: { userId: string } }>(
    '/users/:userId',
    {
      schema: {
        description: 'Get a user by ID',
        tags: ['users'],
        params: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
          },
          required: ['userId'],
        },
        response: {
          200: userResponse,
          400: validationErrorResponse,
          404: notFoundErrorResponse('User'),
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { userId } = userIdParamsSchema.parse({ userId: request.params.userId });
      const user = await userService.getUserById(userId);
      return reply.send(user);
    },
  );

  /**
   * GET /users/email/:emailAddress
   * Get a user by email address
   */
  fastify.get<{ Params: { emailAddress: string } }>(
    '/users/email/:emailAddress',
    {
      schema: {
        description: 'Get a user by email address',
        tags: ['users'],
        params: {
          type: 'object',
          properties: {
            emailAddress: { type: 'string' },
          },
          required: ['emailAddress'],
        },
        response: {
          200: userResponse,
          400: validationErrorResponse,
          404: notFoundErrorResponse('User'),
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { emailAddress } = emailParamsSchema.parse({
        emailAddress: request.params.emailAddress,
      });
      const user = await userService.getUserByEmail(emailAddress);
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
        body: userRequest,
        response: {
          201: userResponse,
          400: validationErrorResponse,
          409: conflictErrorResponse('User'),
          500: internalServerErrorResponse,
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
    Params: { userId: string };
    Body: z.infer<typeof updateUserSchema>;
  }>(
    '/users/:userId',
    {
      schema: {
        description: 'Update a user',
        tags: ['users'],
        params: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
          },
          required: ['userId'],
        },
        body: userRequest,
        response: {
          200: userResponse,
          400: validationErrorResponse,
          404: notFoundErrorResponse('User'),
          409: conflictErrorResponse('Email'),
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { userId } = userIdParamsSchema.parse({ userId: request.params.userId });
      const user = await userService.updateUser(userId, request.body);
      return reply.send(user);
    },
  );

  /**
   * DELETE /users/:userId
   * Delete a user
   */
  fastify.delete<{ Params: { userId: string } }>(
    '/users/:userId',
    {
      schema: {
        description: 'Delete a user',
        tags: ['users'],
        params: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
          },
          required: ['userId'],
        },
        response: {
          204: {
            description: 'User deleted successfully',
            type: 'null',
          },
          400: validationErrorResponse,
          404: notFoundErrorResponse('User'),
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { userId } = userIdParamsSchema.parse({ userId: request.params.userId });
      await userService.deleteUser(userId);
      return reply.status(204).send();
    },
  );
}
