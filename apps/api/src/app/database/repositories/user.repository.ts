import { Kysely } from 'kysely';
import { Database, NewUser, User, UserUpdate } from '../types';

export class UserRepository {
  private readonly db: Kysely<Database>;

  constructor(opts: { db: Kysely<Database> }) {
    this.db = opts.db;
  }

  /**
   * Find all users
   */
  async findAll(): Promise<User[]> {
    return await this.db.selectFrom('user').selectAll().execute();
  }

  /**
   * Find a user by userId
   */
  async findById(userId: number): Promise<User | undefined> {
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
  async update(userId: number, data: UserUpdate): Promise<User> {
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
  async delete(userId: number): Promise<boolean> {
    const result = await this.db.deleteFrom('user').where('userId', '=', userId).executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }
}
