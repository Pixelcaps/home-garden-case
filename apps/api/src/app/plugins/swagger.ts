import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';

/**
 * This plugin adds Swagger/OpenAPI documentation support
 *
 * @see https://github.com/fastify/fastify-swagger
 * @see https://github.com/fastify/fastify-swagger-ui
 */
export default fp(async function (fastify: FastifyInstance) {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'ITP Home Garden API',
        description: 'API documentation for ITP Home Garden application',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT ?? 3000}`,
          description: 'Development server',
        },
      ],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  await fastify.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
});
