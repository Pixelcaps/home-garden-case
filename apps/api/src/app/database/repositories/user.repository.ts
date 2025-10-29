import { Kysely } from 'kysely';
import { Database, NewUser, User, UserUpdate } from '../types';
import { BaseRepository } from './base.repository';

export class UserRepository extends BaseRepository<'user'> {
  constructor(db: Kysely<Database>) {
    super(db, 'user');
  }

  /**
   * Find a user by userId
   */
  async findById(userId: string): Promise<User | undefined> {
    return await this.db
      .selectFrom('user')
      .where('userId', '=', userId)
      .selectAll()
      .executeTakeFirst();
  }

  /**
   * Find a user by email address
   */
  async findByEmail(emailAddress: string): Promise<User | undefined> {
    return await this.db
      .selectFrom('user')
      .where('emailAddress', '=', emailAddress)
      .selectAll()
      .executeTakeFirst();
  }

  /**
   * Create a new user
   */
  async create(data: NewUser): Promise<User> {
    const result = await this.db
      .insertInto('user')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  /**
   * Update a user by userId
   */
  async update(userId: string, data: UserUpdate): Promise<User> {
    const result = await this.db
      .updateTable('user')
      .set(data)
      .where('userId', '=', userId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  /**
   * Delete a user by userId
   */
  async delete(userId: string): Promise<boolean> {
    const result = await this.db.deleteFrom('user').where('userId', '=', userId).executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }
}
