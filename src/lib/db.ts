import { type Database } from '$lib/types';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';

export const dialect = new PostgresDialect({
	pool: new pg.Pool({
		database: process.env.DB_NAME,
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		port: Number(process.env.DB_PORT) || 5432,
		max: 10
	})
});

export const kysely = new Kysely<Database>({
	dialect
});
