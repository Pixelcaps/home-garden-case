import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createGardenSchema,
  gardenIdParamsSchema,
  searchGardenQuerySchema,
  updateGardenSchema,
} from '../schemas/garden.schema';
import { GardenService } from '../services/garden.service';

export default async function (fastify: FastifyInstance) {
  const gardenService = fastify.diContainer.resolve<GardenService>('gardenService');

  /**
   * GET /gardens
   * Get all gardens
   */
  fastify.get('/gardens', async (request, reply) => {
    try {
      const gardens = await gardenService.getAllGardens();
      return reply.send(gardens);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Failed to fetch gardens' });
    }
  });

  /**
   * GET /gardens/:gardenId
   * Get a garden by ID
   */
  fastify.get<{ Params: { gardenId: string } }>('/gardens/:gardenId', async (request, reply) => {
    try {
      const { gardenId } = gardenIdParamsSchema.parse({ gardenId: request.params.gardenId });
      const garden = await gardenService.getGardenById(gardenId);
      return reply.send(garden);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      console.error(error);
      reply.status(500).send({ error: 'Failed to fetch garden' });
    }
  });

  /**
   * GET /gardens/search?name=:gardenName
   * Search gardens by name
   */
  fastify.get<{ Querystring: { name: string } }>('/gardens/search', async (request, reply) => {
    try {
      const { name } = searchGardenQuerySchema.parse({ name: request.query.name });
      const gardens = await gardenService.searchGardensByName(name);
      return reply.send(gardens);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      console.error(error);
      reply.status(500).send({ error: 'Failed to search gardens' });
    }
  });

  /**
   * POST /gardens
   * Create a new garden
   */
  fastify.post<{
    Body: z.infer<typeof createGardenSchema>;
  }>('/gardens', async (request, reply) => {
    try {
      const garden = await gardenService.createGarden(request.body);
      return reply.status(201).send(garden);
    } catch (error) {
      if (error instanceof Error) {
        if (error.constructor.name === 'ZodError') {
          return reply.status(400).send({ error: 'Validation error', details: error });
        }
      }
      console.error(error);
      return reply.status(500).send({ error: 'Failed to create garden' });
    }
  });

  /**
   * PUT /gardens/:gardenId
   * Update a garden
   */
  fastify.put<{
    Params: { gardenId: number };
    Body: z.infer<typeof updateGardenSchema>;
  }>('/gardens/:gardenId', async (request, reply) => {
    try {
      const { gardenId } = gardenIdParamsSchema.parse({ gardenId: request.params.gardenId });
      const garden = await gardenService.updateGarden(gardenId, request.body);
      return reply.send(garden);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.constructor.name === 'ZodError') {
          return reply.status(400).send({ error: 'Validation error', details: error });
        }
      }
      console.error(error);
      return reply.status(500).send({ error: 'Failed to update garden' });
    }
  });

  /**
   * DELETE /gardens/:gardenId
   * Delete a garden
   */
  fastify.delete<{ Params: { gardenId: number } }>('/gardens/:gardenId', async (request, reply) => {
    try {
      const { gardenId } = gardenIdParamsSchema.parse({ gardenId: request.params.gardenId });
      await gardenService.deleteGarden(gardenId);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      console.error(error);
      return reply.status(500).send({ error: 'Failed to delete garden' });
    }
  });
}
