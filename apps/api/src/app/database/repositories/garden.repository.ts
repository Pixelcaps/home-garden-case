import { Kysely } from 'kysely';
import { Database, Garden, GardenUpdate, NewGarden } from '../types';
import { BaseRepository } from './base.repository';

export class GardenRepository extends BaseRepository<'garden'> {
  constructor(db: Kysely<Database>) {
    super(db, 'garden');
  }

  /**
   * Find a garden by gardenId
   */
  async findById(gardenId: string): Promise<Garden | undefined> {
    return await this.db
      .selectFrom('garden')
      .where('gardenId', '=', gardenId)
      .selectAll()
      .executeTakeFirst();
  }

  /**
   * Find gardens by name (case-insensitive partial match)
   */
  async findByName(gardenName: string): Promise<Garden[]> {
    return await this.db
      .selectFrom('garden')
      .where('gardenName', 'ilike', `%${gardenName}%`)
      .selectAll()
      .execute();
  }

  /**
   * Create a new garden
   */
  async create(data: NewGarden): Promise<Garden> {
    const result = await this.db
      .insertInto('garden')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  /**
   * Update a garden by gardenId
   */
  async update(gardenId: string, data: GardenUpdate): Promise<Garden> {
    const result = await this.db
      .updateTable('garden')
      .set(data)
      .where('gardenId', '=', gardenId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  /**
   * Delete a garden by gardenId
   */
  async delete(gardenId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('garden')
      .where('gardenId', '=', gardenId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }
}
