import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod/v4';

function isFastifyValidationError(
  error: unknown,
): error is FastifyError & { validation: unknown[] } {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const validation = (error as Record<string, unknown>).validation;
  return 'validation' in error && Array.isArray(validation);
}

function isZodError(error: unknown): error is ZodError {
  if (error instanceof ZodError) {
    return true;
  }
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as Record<string, unknown>;
  return (
    (err.name === 'ZodError' || err.type === 'ZodError') &&
    'issues' in err &&
    Array.isArray(err.issues)
  );
}

export default fp(async function (fastify: FastifyInstance) {
  fastify.setErrorHandler(
    (error: FastifyError | ZodError | Error, request: FastifyRequest, reply: FastifyReply) => {
      // Extract nested error if it's a FastifyError
      const actualError =
        error && typeof error === 'object' && 'err' in error && error.err ? error.err : error;

      // Handle ZodError (validation errors)
      if (isZodError(actualError)) {
        const zodError = actualError as ZodError;
        return reply.status(400).send({
          error: 'Validation error',
          details: zodError.issues,
        });
      }

      // Handle FastifyValidationError (schema validation errors)
      if (isFastifyValidationError(actualError)) {
        const validationError = actualError as FastifyError & { validation: unknown[] };
        return reply.status(400).send({
          error: 'Validation error',
          details: validationError.validation,
        });
      }

      // Handle FastifyError with statusCode (must check original error, not extracted one)
      // If error has a statusCode, use it directly - this handles Fastify's built-in errors
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
      ) {
        const statusCode = error.statusCode;
        const message = error.message || 'An error occurred';

        // Use the statusCode directly if it's a valid HTTP error code
        if (statusCode >= 400 && statusCode < 600) {
          return reply.status(statusCode).send({ error: message });
        }
      }

      // Handle Error instances with message-based detection
      if (actualError instanceof Error) {
        const message = actualError.message;

        // Not found errors
        if (message.toLowerCase().includes('not found')) {
          return reply.status(404).send({ error: message });
        }

        // Conflict errors (already exists, already in use)
        if (
          message.toLowerCase().includes('already exists') ||
          message.toLowerCase().includes('already in use')
        ) {
          return reply.status(409).send({ error: message });
        }

        // Business logic validation errors (would exceed, etc.)
        if (
          message.toLowerCase().includes('would exceed') ||
          message.toLowerCase().includes('exceeds') ||
          message.toLowerCase().includes('invalid')
        ) {
          return reply.status(400).send({ error: message });
        }

        // Log the error for debugging
        fastify.log.error(actualError);

        // Default error response
        return reply.status(500).send({
          error: process.env.NODE_ENV === 'development' ? message : 'Internal server error',
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
