import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import {
  createPlantSchema,
  gardenIdParamsSchema,
  plantIdParamsSchema,
  plantTypeParamsSchema,
  speciesParamsSchema,
  updatePlantSchema,
} from '../schemas/plant.schema';
import { PlantService } from '../services/plant.service';
import {
  internalServerErrorResponse,
  notFoundErrorResponse,
  validationErrorResponse,
} from '../specs/shared.specs';

const plantRequest = {
  type: 'object',
  properties: {
    plantName: { type: 'string' },
    species: { type: 'string' },
    plantType: { type: 'string', enum: ['vegetable', 'fruit', 'flower'] },
    plantationDate: { type: 'string', format: 'date-time' },
    surfaceAreaRequired: { type: 'number', minimum: 0 },
    idealHumidityLevel: { type: 'number', minimum: 0, maximum: 100 },
    gardenId: { type: 'number' },
  },
  required: [
    'plantName',
    'species',
    'plantType',
    'plantationDate',
    'surfaceAreaRequired',
    'idealHumidityLevel',
    'gardenId',
  ],
};

const plantResponse = {
  description: 'Plant object',
  type: 'object',
  properties: {
    plantId: { type: 'number' },
    plantName: { type: 'string' },
    species: { type: 'string' },
    plantType: { type: 'string', enum: ['vegetable', 'fruit', 'flower'] },
    plantationDate: { type: 'string', format: 'date-time' },
    surfaceAreaRequired: { type: 'number' },
    idealHumidityLevel: { type: 'number' },
    gardenId: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

export default async function (fastify: FastifyInstance) {
  const plantService = fastify.diContainer.resolve<PlantService>('plantService');

  /**
   * GET /plants
   * Get all plants
   */
  fastify.get(
    '/plants',
    {
      schema: {
        description: 'Get all plants',
        tags: ['plants'],
        response: {
          200: {
            description: 'List of plants',
            type: 'array',
            items: plantResponse,
          },
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const plants = await plantService.getAllPlants();
      return reply.send(plants);
    },
  );

  /**
   * GET /plants/:plantId
   * Get a plant by ID
   */
  fastify.get<{ Params: { plantId: number } }>(
    '/plants/:plantId',
    {
      schema: {
        description: 'Get a plant by ID',
        tags: ['plants'],
        params: {
          type: 'object',
          properties: {
            plantId: { type: 'string' },
          },
          required: ['plantId'],
        },
        response: {
          200: plantResponse,
          400: validationErrorResponse,
          404: notFoundErrorResponse('Plant'),
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { plantId } = plantIdParamsSchema.parse({ plantId: request.params.plantId });
      const plant = await plantService.getPlantById(plantId);
      return reply.send(plant);
    },
  );

  /**
   * GET /plants/garden/:gardenId
   * Get all plants in a specific garden
   */
  fastify.get<{ Params: { gardenId: number } }>(
    '/plants/garden/:gardenId',
    {
      schema: {
        description: 'Get all plants in a specific garden',
        tags: ['plants'],
        params: {
          type: 'object',
          properties: {
            gardenId: { type: 'string' },
          },
          required: ['gardenId'],
        },
        response: {
          200: {
            description: 'List of plants in the garden',
            type: 'array',
            items: plantResponse,
          },
          400: validationErrorResponse,
          404: notFoundErrorResponse('Garden'),
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { gardenId } = gardenIdParamsSchema.parse({ gardenId: request.params.gardenId });
      const plants = await plantService.getPlantsByGardenId(gardenId);
      return reply.send(plants);
    },
  );

  /**
   * GET /plants/type/:plantType
   * Get plants by type (vegetable, fruit, or flower)
   */
  fastify.get<{ Params: { plantType: 'vegetable' | 'fruit' | 'flower' } }>(
    '/plants/type/:plantType',
    {
      schema: {
        description: 'Get plants by type (vegetable, fruit, or flower)',
        tags: ['plants'],
        params: {
          type: 'object',
          properties: {
            plantType: { type: 'string', enum: ['vegetable', 'fruit', 'flower'] },
          },
          required: ['plantType'],
        },
        response: {
          200: {
            description: 'List of plants of the specified type',
            type: 'array',
            items: plantResponse,
          },
          400: validationErrorResponse,
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { plantType } = plantTypeParamsSchema.parse({ plantType: request.params.plantType });
      const plants = await plantService.getPlantsByType(plantType);
      return reply.send(plants);
    },
  );

  /**
   * GET /plants/species/:species
   * Get plants by species
   */
  fastify.get<{ Params: { species: string } }>(
    '/plants/species/:species',
    {
      schema: {
        description: 'Get plants by species',
        tags: ['plants'],
        params: {
          type: 'object',
          properties: {
            species: { type: 'string' },
          },
          required: ['species'],
        },
        response: {
          200: {
            description: 'List of plants of the specified species',
            type: 'array',
            items: plantResponse,
          },
          400: validationErrorResponse,
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { species } = speciesParamsSchema.parse({ species: request.params.species });
      const plants = await plantService.getPlantsBySpecies(species);
      return reply.send(plants);
    },
  );

  /**
   * POST /plants
   * Create a new plant
   */
  fastify.post<{
    Body: z.infer<typeof createPlantSchema>;
  }>(
    '/plants',
    {
      schema: {
        description: 'Create a new plant',
        tags: ['plants'],
        body: plantRequest,
        response: {
          201: plantResponse,
          400: validationErrorResponse,
          404: notFoundErrorResponse('Garden'),
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const plant = await plantService.createPlant(request.body);
      return reply.status(201).send(plant);
    },
  );

  /**
   * PUT /plants/:plantId
   * Update a plant
   */
  fastify.put<{
    Params: { plantId: string };
    Body: z.infer<typeof updatePlantSchema>;
  }>(
    '/plants/:plantId',
    {
      schema: {
        description: 'Update a plant',
        tags: ['plants'],
        params: {
          type: 'object',
          properties: {
            plantId: { type: 'string' },
          },
          required: ['plantId'],
        },
        body: plantRequest,
        response: {
          200: plantResponse,
          400: validationErrorResponse,
          404: notFoundErrorResponse('Plant'),
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { plantId } = plantIdParamsSchema.parse({ plantId: request.params.plantId });
      const plant = await plantService.updatePlant(plantId, request.body);
      return reply.send(plant);
    },
  );

  /**
   * DELETE /plants/:plantId
   * Delete a plant
   */
  fastify.delete<{ Params: { plantId: string } }>(
    '/plants/:plantId',
    {
      schema: {
        description: 'Delete a plant',
        tags: ['plants'],
        params: {
          type: 'object',
          properties: {
            plantId: { type: 'string' },
          },
          required: ['plantId'],
        },
        response: {
          204: {
            description: 'Plant deleted successfully',
            type: 'null',
          },
          400: {
            description: 'Validation error',
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: { type: 'array' },
            },
          },
          404: {
            description: 'Plant not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          500: {
            description: 'Internal server error',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { plantId } = plantIdParamsSchema.parse({ plantId: request.params.plantId });
      await plantService.deletePlant(plantId);
      return reply.status(204).send();
    },
  );
}
