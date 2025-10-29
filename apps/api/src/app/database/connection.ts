import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Database } from './types';

const dialect = new SqliteDialect({
  database: new SQLite('db.sqlite'),
});

export class DatabaseConnection {
  public readonly db: Kysely<Database>;

  constructor() {
    this.db = new Kysely<Database>({
      dialect,
    });
  }
}
