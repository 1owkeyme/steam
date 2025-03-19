import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('tags')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('name', 'varchar', (col) => col.notNull().unique())
		.execute();

	await db.schema
		.createTable('games_tags')
		.addColumn('game_id', 'integer', (col) =>
			col.notNull().references('games.id').onDelete('cascade')
		)
		.addColumn('tag_id', 'integer', (col) =>
			col.notNull().references('tags.id').onDelete('cascade')
		)
		.addPrimaryKeyConstraint('pk_games_tags', ['game_id', 'tag_id'])
		.execute();

	await db.schema
		.createTable('features')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('name', 'varchar', (col) => col.notNull().unique())
		.execute();

	await db.schema
		.createTable('games_features')
		.addColumn('game_id', 'integer', (col) =>
			col.notNull().references('games.id').onDelete('cascade')
		)
		.addColumn('feature_id', 'integer', (col) =>
			col.notNull().references('features.id').onDelete('cascade')
		)
		.addPrimaryKeyConstraint('pk_games_features', ['game_id', 'feature_id'])
		.execute();

	await db.schema
		.createTable('genres')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('name', 'varchar', (col) => col.notNull().unique())
		.execute();

	await db.schema
		.createTable('games_genres')
		.addColumn('game_id', 'integer', (col) =>
			col.notNull().references('games.id').onDelete('cascade')
		)
		.addColumn('genre_id', 'integer', (col) =>
			col.notNull().references('genres.id').onDelete('cascade')
		)
		.addPrimaryKeyConstraint('pk_games_genres', ['game_id', 'genre_id'])
		.execute();

	await db.schema
		.createTable('languages')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('name', 'varchar', (col) => col.notNull().unique())
		.execute();

	await db.schema
		.createTable('games_languages')
		.addColumn('game_id', 'integer', (col) =>
			col.notNull().references('games.id').onDelete('cascade')
		)
		.addColumn('language_id', 'integer', (col) =>
			col.notNull().references('languages.id').onDelete('cascade')
		)
		.addPrimaryKeyConstraint('pk_games_languages', ['game_id', 'language_id'])
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable('games_tags').execute();
	await db.schema.dropTable('games_features').execute();
	await db.schema.dropTable('games_genres').execute();
	await db.schema.dropTable('games_languages').execute();

	await db.schema.dropTable('tags').execute();
	await db.schema.dropTable('features').execute();
	await db.schema.dropTable('genres').execute();
	await db.schema.dropTable('languages').execute();
}
