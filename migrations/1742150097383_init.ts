import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('games')
		.addColumn('id', 'integer', (col) => col.primaryKey())
		.addColumn('name', 'varchar', (col) => col.notNull())
		.addColumn('first_release_date', 'timestamp', (col) => col.notNull())
		.addColumn('early_access_exit_date', 'timestamp')
		.addColumn('early_access', 'boolean', (col) => col.notNull().defaultTo(false))
		.addColumn('copies_sold', 'bigint', (col) => col.notNull().defaultTo(0))
		.addColumn('price', 'decimal', (col) => col.notNull().defaultTo(0))
		.addColumn('revenue', 'decimal', (col) => col.notNull().defaultTo(0))
		.addColumn('avg_playtime', 'decimal', (col) => col.notNull().defaultTo(0))
		.addColumn('review_score', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('publisher_class', 'varchar', (col) => col.notNull())
		.execute();

	await db.schema
		.createTable('publishers')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('name', 'varchar', (col) => col.notNull().unique())
		.execute();

	await db.schema
		.createTable('developers')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('name', 'varchar', (col) => col.notNull().unique())
		.execute();

	await db.schema
		.createTable('game_publishers')
		.addColumn('game_id', 'integer', (col) =>
			col.notNull().references('games.id').onDelete('cascade')
		)
		.addColumn('publisher_id', 'integer', (col) =>
			col.notNull().references('publishers.id').onDelete('cascade')
		)
		.execute();

	await db.schema
		.createTable('game_developers')
		.addColumn('game_id', 'integer', (col) =>
			col.notNull().references('games.id').onDelete('cascade')
		)
		.addColumn('developer_id', 'integer', (col) =>
			col.notNull().references('developers.id').onDelete('cascade')
		)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable('game_developers').execute();
	await db.schema.dropTable('game_publishers').execute();
	await db.schema.dropTable('developers').execute();
	await db.schema.dropTable('publishers').execute();
	await db.schema.dropTable('games').execute();
}
