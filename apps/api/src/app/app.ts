import AutoLoad from '@fastify/autoload';
import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix';
import bearerAuth from '@fastify/bearer-auth';
import { asClass, asFunction } from 'awilix';
import { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import * as path from 'path';
import { DatabaseConnection } from './database/connection';
import { MigratorService } from './database/migrator';
import { GardenRepository } from './database/repositories/garden.repository';
import { PlantRepository } from './database/repositories/plant.repository';
import { UserRepository } from './database/repositories/user.repository';
import { GardenService } from './services/garden.service';
import { PlantService } from './services/plant.service';
import { UserService } from './services/user.service';

/* eslint-disable-next-line */
export interface AppOptions {}

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  diContainer.register({
    dbConnection: asClass(DatabaseConnection).singleton(),
    db: asFunction((deps) => deps.dbConnection.db).singleton(),
    migratorService: asClass(MigratorService).singleton(),
    userRepository: asClass(UserRepository).singleton(),
    gardenRepository: asClass(GardenRepository).singleton(),
    plantRepository: asClass(PlantRepository).singleton(),
    userService: asClass(UserService).singleton(),
    gardenService: asClass(GardenService).singleton(),
    plantService: asClass(PlantService).singleton(),
  });

  // Register fastifyAwilixPlugin before routes so diContainer is available
  fastify.register(fastifyAwilixPlugin, {
    disposeOnClose: true,
    disposeOnResponse: true,
    strictBooleanEnforced: true,
  });

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: { ...opts },
  });

  // Gate all API routes behind a bearer token (the BFF service token).
  // Registered in an encapsulated scope so the Swagger UI at /docs stays open.
  fastify.register(async (scope) => {
    const apiToken = process.env.API_BEARER_TOKEN;
    if (apiToken) {
      await scope.register(bearerAuth, { keys: new Set([apiToken]), addHook: true });
    } else {
      scope.log.warn('API_BEARER_TOKEN not set — bearer auth gate disabled');
    }

    // This loads all plugins defined in routes
    // define your routes in one of these
    await scope.register(AutoLoad, {
      dir: path.join(__dirname, 'routes'),
      options: { ...opts },
    });
  });

  const migrator = diContainer.resolve<MigratorService>('migratorService');
  await migrator.migrateToLatest();
}
