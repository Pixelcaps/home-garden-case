import { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import {
  createGardenSchema,
  gardenIdParamsSchema,
  searchGardenQuerySchema,
  updateGardenSchema,
} from '../schemas/garden.schema';
import { GardenService } from '../services/garden.service';
import {
  internalServerErrorResponse,
  notFoundErrorResponse,
  validationErrorResponse,
} from '../specs/shared.specs';

const gardenRequest = {
  type: 'object',
  properties: {
    gardenName: { type: 'string' },
    totalSurfaceArea: { type: 'number', minimum: 0 },
    locationDescription: { type: 'string', nullable: true },
    latitude: { type: 'number', minimum: -90, maximum: 90, nullable: true },
    longitude: { type: 'number', minimum: -180, maximum: 180, nullable: true },
  },
  required: ['gardenName', 'totalSurfaceArea'],
};

const gardenResponse = {
  description: 'Garden object',
  type: 'object',
  properties: {
    gardenId: { type: 'number' },
    gardenName: { type: 'string' },
    totalSurfaceArea: { type: 'number' },
    locationDescription: { type: 'string', nullable: true },
    latitude: { type: 'number', nullable: true },
    longitude: { type: 'number', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

export default async function (fastify: FastifyInstance) {
  const gardenService = fastify.diContainer.resolve<GardenService>('gardenService');

  /**
   * GET /gardens
   * Get all gardens
   */
  fastify.get(
    '/gardens',
    {
      schema: {
        description: 'Get all gardens',
        tags: ['gardens'],
        response: {
          200: {
            description: 'List of gardens',
            type: 'array',
            items: gardenResponse,
          },
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const gardens = await gardenService.getAllGardens();
      return reply.send(gardens);
    },
  );

  /**
   * GET /gardens/:gardenId
   * Get a garden by ID
   */
  fastify.get<{ Params: { gardenId: number } }>(
    '/gardens/:gardenId',
    {
      schema: {
        description: 'Get a garden by ID',
        tags: ['gardens'],
        params: {
          type: 'object',
          properties: {
            gardenId: { type: 'string' },
          },
          required: ['gardenId'],
        },
        response: {
          200: gardenResponse,
          400: {
            description: 'Validation error',
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: { type: 'array' },
            },
          },
          404: {
            description: 'Garden not found',
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
      const { gardenId } = gardenIdParamsSchema.parse({ gardenId: request.params.gardenId });
      const garden = await gardenService.getGardenById(gardenId);
      return reply.send(garden);
    },
  );

  /**
   * GET /gardens/search?name=:gardenName
   * Search gardens by name
   */
  fastify.get<{ Querystring: { name: string } }>(
    '/gardens/search',
    {
      schema: {
        description: 'Search gardens by name',
        tags: ['gardens'],
        querystring: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        response: {
          200: {
            description: 'List of matching gardens',
            type: 'array',
            items: gardenResponse,
          },
          400: validationErrorResponse,
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { name } = searchGardenQuerySchema.parse({ name: request.query.name });
      const gardens = await gardenService.searchGardensByName(name);
      return reply.send(gardens);
    },
  );

  /**
   * POST /gardens
   * Create a new garden
   */
  fastify.post<{
    Body: z.infer<typeof createGardenSchema>;
  }>(
    '/gardens',
    {
      schema: {
        description: 'Create a new garden',
        tags: ['gardens'],
        body: gardenRequest,
        response: {
          201: gardenResponse,
          400: validationErrorResponse,
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const garden = await gardenService.createGarden(request.body);
      return reply.status(201).send(garden);
    },
  );

  /**
   * PUT /gardens/:gardenId
   * Update a garden
   */
  fastify.put<{
    Params: { gardenId: number };
    Body: z.infer<typeof updateGardenSchema>;
  }>(
    '/gardens/:gardenId',
    {
      schema: {
        description: 'Update a garden',
        tags: ['gardens'],
        params: {
          type: 'object',
          properties: {
            gardenId: { type: 'string' },
          },
          required: ['gardenId'],
        },
        body: gardenRequest,
        response: {
          200: gardenResponse,
          400: validationErrorResponse,
          404: notFoundErrorResponse('Garden'),
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { gardenId } = gardenIdParamsSchema.parse({ gardenId: request.params.gardenId });
      const garden = await gardenService.updateGarden(gardenId, request.body);
      return reply.send(garden);
    },
  );

  /**
   * DELETE /gardens/:gardenId
   * Delete a garden
   */
  fastify.delete<{ Params: { gardenId: number } }>(
    '/gardens/:gardenId',
    {
      schema: {
        description: 'Delete a garden',
        tags: ['gardens'],
        params: {
          type: 'object',
          properties: {
            gardenId: { type: 'string' },
          },
          required: ['gardenId'],
        },
        response: {
          204: {
            description: 'Garden deleted successfully',
            type: 'null',
          },
          400: validationErrorResponse,
          404: notFoundErrorResponse('Garden'),
          500: internalServerErrorResponse,
        },
      },
    },
    async (request, reply) => {
      const { gardenId } = gardenIdParamsSchema.parse({ gardenId: request.params.gardenId });
      await gardenService.deleteGarden(gardenId);
      return reply.status(204).send();
    },
  );
}
