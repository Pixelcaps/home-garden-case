import { Kysely } from 'kysely';
import { Database, NewPlant, Plant, PlantUpdate } from '../types';
import { BaseRepository } from './base.repository';

export class PlantRepository extends BaseRepository<'plant'> {
  constructor(db: Kysely<Database>) {
    super(db, 'plant');
  }

  /**
   * Find a plant by plantId
   */
  async findById(plantId: string): Promise<Plant | undefined> {
    return await this.db
      .selectFrom('plant')
      .where('plantId', '=', plantId)
      .selectAll()
      .executeTakeFirst();
  }

  /**
   * Find all plants in a specific garden
   */
  async findByGardenId(gardenId: string): Promise<Plant[]> {
    return await this.db.selectFrom('plant').where('gardenId', '=', gardenId).selectAll().execute();
  }

  /**
   * Find plants by type
   */
  async findByType(plantType: 'vegetable' | 'fruit' | 'flower'): Promise<Plant[]> {
    return await this.db
      .selectFrom('plant')
      .where('plantType', '=', plantType)
      .selectAll()
      .execute();
  }

  /**
   * Find plants by species
   */
  async findBySpecies(species: string): Promise<Plant[]> {
    return await this.db.selectFrom('plant').where('species', '=', species).selectAll().execute();
  }

  /**
   * Create a new plant
   */
  async create(data: NewPlant): Promise<Plant> {
    const result = await this.db
      .insertInto('plant')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  /**
   * Update a plant by plantId
   */
  async update(plantId: string, data: PlantUpdate): Promise<Plant> {
    const result = await this.db
      .updateTable('plant')
      .set(data)
      .where('plantId', '=', plantId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  /**
   * Delete a plant by plantId
   */
  async delete(plantId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('plant')
      .where('plantId', '=', plantId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }
}
