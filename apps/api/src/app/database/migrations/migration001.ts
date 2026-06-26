import { Kysely, sql } from 'kysely';
import { Database } from '../types';

async function up(db: Kysely<Database>) {
  await db.schema
    .createTable('user')
    .addColumn('userId', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('firstName', 'text')
    .addColumn('lastName', 'text')
    .addColumn('age', 'integer')
    .addColumn('emailAddress', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updatedAt', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db
    .insertInto('user')
    .values({
      userId: 1,
      emailAddress: 'home.gardener@example.com',
      firstName: 'Home',
      lastName: 'Gardener',
    })
    .execute();

  await db.schema
    .createTable('garden')
    .addColumn('gardenId', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('gardenName', 'text', (col) => col.notNull())
    .addColumn('totalSurfaceArea', 'real', (col) => col.notNull())
    .addColumn('targetHumidity', 'real', (col) => col.notNull())
    .addColumn('locationDescription', 'text')
    .addColumn('latitude', 'real')
    .addColumn('longitude', 'real')
    .addColumn('userId', 'integer', (col) =>
      col.references('user.userId').onDelete('cascade').notNull(),
    )
    .addColumn('createdAt', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updatedAt', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema.createIndex('garden_user_id_index').on('garden').column('userId').execute();

  await db.schema
    .createTable('plant')
    .addColumn('plantId', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('plantName', 'text', (col) => col.notNull())
    .addColumn('species', 'text', (col) => col.notNull())
    .addColumn('plantType', 'text', (col) =>
      col.notNull().check(sql`plantType IN ('vegetable', 'fruit', 'flower')`),
    )
    .addColumn('plantationDate', 'text', (col) => col.notNull())
    .addColumn('surfaceAreaRequired', 'real', (col) => col.notNull())
    .addColumn('idealHumidityLevel', 'real', (col) => col.notNull())
    .addColumn('gardenId', 'integer', (col) =>
      col.references('garden.gardenId').onDelete('cascade').notNull(),
    )
    .addColumn('createdAt', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updatedAt', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema.createIndex('plant_garden_id_index').on('plant').column('gardenId').execute();
}

async function down(db: Kysely<Database>) {
  await db.schema.dropTable('plant').execute();
  await db.schema.dropTable('garden').execute();
  await db.schema.dropTable('user').execute();
}

export const migration001 = {
  up,
  down,
};
