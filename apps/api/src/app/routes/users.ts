import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createUserSchema,
  emailParamsSchema,
  updateUserSchema,
  userIdParamsSchema,
} from '../schemas/user.schema';
import { UserService } from '../services/user.service';

export default async function (fastify: FastifyInstance) {
  const userService = fastify.diContainer.resolve<UserService>('userService');

  /**
   * GET /users
   * Get all users
   */
  fastify.get('/users', async (request, reply) => {
    try {
      const users = await userService.getAllUsers();
      return reply.send(users);
    } catch {
      reply.status(500).send({ error: 'Failed to fetch users' });
    }
  });

  /**
   * GET /users/:userId
   * Get a user by ID
   */
  fastify.get<{ Params: { userId: string } }>('/users/:userId', async (request, reply) => {
    try {
      const { userId } = userIdParamsSchema.parse({ userId: request.params.userId });
      const user = await userService.getUserById(userId);
      return reply.send(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      reply.status(500).send({ error: 'Failed to fetch user' });
    }
  });

  /**
   * GET /users/email/:emailAddress
   * Get a user by email address
   */
  fastify.get<{ Params: { emailAddress: string } }>(
    '/users/email/:emailAddress',
    async (request, reply) => {
      try {
        const { emailAddress } = emailParamsSchema.parse({
          emailAddress: request.params.emailAddress,
        });
        const user = await userService.getUserByEmail(emailAddress);
        return reply.send(user);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.issues });
        }
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        reply.status(500).send({ error: 'Failed to fetch user' });
      }
    },
  );

  /**
   * POST /users
   * Create a new user
   */
  fastify.post<{
    Body: z.infer<typeof createUserSchema>;
  }>('/users', async (request, reply) => {
    try {
      const user = await userService.createUser(request.body);
      return reply.status(201).send(user);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return reply.status(409).send({ error: error.message });
        }
        // Zod validation errors will have name 'ZodError'
        if (error.constructor.name === 'ZodError') {
          return reply.status(400).send({ error: 'Validation error', details: error });
        }
      }
      return reply.status(500).send({ error: 'Failed to create user' });
    }
  });

  /**
   * PUT /users/:userId
   * Update a user
   */
  fastify.put<{
    Params: { userId: string };
    Body: z.infer<typeof updateUserSchema>;
  }>('/users/:userId', async (request, reply) => {
    try {
      const { userId } = userIdParamsSchema.parse({ userId: request.params.userId });
      const user = await userService.updateUser(userId, request.body);
      return reply.send(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message.includes('already in use')) {
          return reply.status(409).send({ error: error.message });
        }
        if (error.constructor.name === 'ZodError') {
          return reply.status(400).send({ error: 'Validation error', details: error });
        }
      }
      return reply.status(500).send({ error: 'Failed to update user' });
    }
  });

  /**
   * DELETE /users/:userId
   * Delete a user
   */
  fastify.delete<{ Params: { userId: string } }>('/users/:userId', async (request, reply) => {
    try {
      const { userId } = userIdParamsSchema.parse({ userId: request.params.userId });
      await userService.deleteUser(userId);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to delete user' });
    }
  });
}
