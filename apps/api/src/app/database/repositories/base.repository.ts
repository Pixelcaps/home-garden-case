import { Kysely } from 'kysely';
import { Database } from '../types';

/**
 * Base repository class providing common infrastructure for repositories
 * Concrete repositories should extend this and implement their own CRUD methods
 */
export abstract class BaseRepository<TableName extends keyof Database> {
  constructor(
    protected readonly db: Kysely<Database>,
    protected readonly tableName: TableName,
  ) {}

  /**
   * Find all entities
   */
  async findAll(): Promise<Database[TableName][]> {
    return (await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .execute()) as Database[TableName][];
  }

  /**
   * Find a single entity by ID
   */
  abstract findById(id: string): Promise<unknown>;

  /**
   * Create a new entity
   */
  abstract create(data: unknown): Promise<unknown>;

  /**
   * Update an entity by ID
   */
  abstract update(id: string, data: unknown): Promise<unknown>;

  /**
   * Delete an entity by ID
   */
  abstract delete(id: string): Promise<boolean>;
}
