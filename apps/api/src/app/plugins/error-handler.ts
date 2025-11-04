import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod/v4';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors';

export default fp(async function (fastify: FastifyInstance) {
  fastify.setErrorHandler(
    (error: FastifyError | ZodError | Error, request: FastifyRequest, reply: FastifyReply) => {
      // Handle ZodError (validation errors)
      if (hasZodFastifySchemaValidationErrors(error)) {
        return reply.code(400).send({
          error: 'Response Validation Error',
          message: "Request doesn't match the schema",
          statusCode: 400,
          details: {
            issues: error.validation,
            method: request.method,
            url: request.url,
          },
        });
      }

      if (isFastifyValidationError(error)) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.message.split(', '),
        });
      }

      if (isResponseSerializationError(error)) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: "Response doesn't match the schema",
          statusCode: 500,
          details: {
            issues: error.cause.issues,
            method: request.method,
            url: request.url,
          },
        });
      }

      // Handle Error instances with message-based detection
      if (error instanceof Error) {
        switch (error.constructor) {
          case NotFoundError:
            return reply.status(404).send({ error: 'Not found error', details: [error.message] });
          case ConflictError:
            return reply.status(409).send({ error: 'Conflict error', details: [error.message] });
          case ValidationError:
            return reply.status(400).send({ error: 'Validation error', details: [error.message] });
        }

        // Log the error for debugging
        fastify.log.error(error);

        // Default error response
        return reply.status(500).send({
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        });
      }

      // Unknown error type
      fastify.log.error({ error }, 'Unknown error type');
      return reply.status(500).send({
        error: 'Internal server error',
      });
    },
  );
});

function isFastifyValidationError(
  error: unknown,
): error is FastifyError & { validation: unknown[] } {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const validation = (error as Record<string, unknown>).validation;
  return 'validation' in error && Array.isArray(validation);
}
