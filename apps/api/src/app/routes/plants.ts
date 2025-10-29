import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createPlantSchema,
  gardenIdParamsSchema,
  plantIdParamsSchema,
  plantTypeParamsSchema,
  speciesParamsSchema,
  updatePlantSchema,
} from '../schemas/plant.schema';
import { PlantService } from '../services/plant.service';

export default async function (fastify: FastifyInstance) {
  const plantService = fastify.diContainer.resolve<PlantService>('plantService');

  /**
   * GET /plants
   * Get all plants
   */
  fastify.get('/plants', async (request, reply) => {
    try {
      const plants = await plantService.getAllPlants();
      return reply.send(plants);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Failed to fetch plants' });
    }
  });

  /**
   * GET /plants/:plantId
   * Get a plant by ID
   */
  fastify.get<{ Params: { plantId: string } }>('/plants/:plantId', async (request, reply) => {
    try {
      const { plantId } = plantIdParamsSchema.parse({ plantId: request.params.plantId });
      const plant = await plantService.getPlantById(plantId);
      return reply.send(plant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      reply.status(500).send({ error: 'Failed to fetch plant' });
    }
  });

  /**
   * GET /plants/garden/:gardenId
   * Get all plants in a specific garden
   */
  fastify.get<{ Params: { gardenId: string } }>(
    '/plants/garden/:gardenId',
    async (request, reply) => {
      try {
        const { gardenId } = gardenIdParamsSchema.parse({ gardenId: request.params.gardenId });
        const plants = await plantService.getPlantsByGardenId(gardenId);
        return reply.send(plants);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.issues });
        }
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        reply.status(500).send({ error: 'Failed to fetch plants' });
      }
    },
  );

  /**
   * GET /plants/type/:plantType
   * Get plants by type (vegetable, fruit, or flower)
   */
  fastify.get<{ Params: { plantType: 'vegetable' | 'fruit' | 'flower' } }>(
    '/plants/type/:plantType',
    async (request, reply) => {
      try {
        const { plantType } = plantTypeParamsSchema.parse({ plantType: request.params.plantType });
        const plants = await plantService.getPlantsByType(plantType);
        return reply.send(plants);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.issues });
        }
        reply.status(500).send({ error: 'Failed to fetch plants' });
      }
    },
  );

  /**
   * GET /plants/species/:species
   * Get plants by species
   */
  fastify.get<{ Params: { species: string } }>(
    '/plants/species/:species',
    async (request, reply) => {
      try {
        const { species } = speciesParamsSchema.parse({ species: request.params.species });
        const plants = await plantService.getPlantsBySpecies(species);
        return reply.send(plants);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.issues });
        }
        reply.status(500).send({ error: 'Failed to fetch plants' });
      }
    },
  );

  /**
   * POST /plants
   * Create a new plant
   */
  fastify.post<{
    Body: z.infer<typeof createPlantSchema>;
  }>('/plants', async (request, reply) => {
    try {
      const plant = await plantService.createPlant(request.body);
      return reply.status(201).send(plant);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message.includes('would exceed')) {
          return reply.status(400).send({ error: error.message });
        }
        if (error.constructor.name === 'ZodError') {
          return reply.status(400).send({ error: 'Validation error', details: error });
        }
      }
      return reply.status(500).send({ error: 'Failed to create plant' });
    }
  });

  /**
   * PUT /plants/:plantId
   * Update a plant
   */
  fastify.put<{
    Params: { plantId: string };
    Body: z.infer<typeof updatePlantSchema>;
  }>('/plants/:plantId', async (request, reply) => {
    try {
      const { plantId } = plantIdParamsSchema.parse({ plantId: request.params.plantId });
      const plant = await plantService.updatePlant(plantId, request.body);
      return reply.send(plant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message.includes('would exceed')) {
          return reply.status(400).send({ error: error.message });
        }
        if (error.constructor.name === 'ZodError') {
          return reply.status(400).send({ error: 'Validation error', details: error });
        }
      }
      return reply.status(500).send({ error: 'Failed to update plant' });
    }
  });

  /**
   * DELETE /plants/:plantId
   * Delete a plant
   */
  fastify.delete<{ Params: { plantId: string } }>('/plants/:plantId', async (request, reply) => {
    try {
      const { plantId } = plantIdParamsSchema.parse({ plantId: request.params.plantId });
      await plantService.deletePlant(plantId);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.issues });
      }
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to delete plant' });
    }
  });
}
