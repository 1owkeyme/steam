import { kysely as db } from '$lib/db';
import { type Database as DB } from '$lib/types';
import winston from 'winston';

const logger = winston.createLogger({
	level: 'info',
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(winston.format.colorize(), winston.format.simple())
		}),
		new winston.transports.File({
			filename: 'logs/populateTagsDatabase.log',
			format: winston.format.combine(winston.format.timestamp(), winston.format.json())
		})
	]
});

const API_URL = `https://api.gamalytic.com/game`;
const MAX_RETRIES = 3;
const DELAY_BETWEEN_REQUESTS = 1 * 100;

async function fetchGameDetails(id: number) {
	let attempts = 0;
	let progressiveDelay = 60 * 1000;
	const params = new URLSearchParams({
		include_pre_release_history: 'true'
	});
	while (attempts < MAX_RETRIES) {
		try {
			const response = await fetch(`${API_URL}/${id}?${params.toString()}`, {
				headers: {
					'User-Agent': 'Mozilla/5.0',
					Accept: 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch details for game ${id}: ${response.statusText}`);
			}

			return response.json();
		} catch (error) {
			attempts += 1;
			logger.error(`Attempt ${attempts} failed for game ${id}:`, error);

			if (attempts >= MAX_RETRIES) {
				throw new Error(`Failed to fetch game ${id} after ${MAX_RETRIES} attempts`);
			}

			await delay(progressiveDelay);
			progressiveDelay *= 2;
		}
	}
}

async function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateGames() {
	const games = await db.selectFrom('games').select(['id', 'name']).execute();

	logger.info(`Found ${games.length} games to update.`);

	for (const game of games) {
		logger.info(`Fetching additional details for ${game.name} (id=${game.id})...`);

		const existing = await db
			.selectFrom('games_tags')
			.where('games_tags.game_id', '=', game.id)
			.select('games_tags.game_id')
			.executeTakeFirst();

		if (existing) {
			logger.info(`Game ${game.name} (id=${game.id}) already has additional details. Skipping...`);
			continue;
		}

		try {
			const gameDetails = await fetchGameDetails(game.id);

			await updateManyToMany('genres', 'games_genres', game.id, gameDetails.genres);
			await updateManyToMany('tags', 'games_tags', game.id, gameDetails.tags);
			await updateManyToMany('features', 'games_features', game.id, gameDetails.features);
			await updateManyToMany('languages', 'games_languages', game.id, gameDetails.languages);

			logger.info(`Updated ${game.name} (id=${game.id}).`);
		} catch (error) {
			logger.error(`Failed to update game ${game.id}:`, error);
		}

		await delay(DELAY_BETWEEN_REQUESTS);
	}

	logger.info('Games update process completed.');
	await db.destroy();
}

async function updateManyToMany(
	table: keyof DB & string,
	relationTable: keyof DB & string,
	gameId: number,
	values: string[]
) {
	if (!values || values.length === 0) return;

	for (const value of values) {
		const existing = await db
			.selectFrom(table)
			.where('name', '=', value)
			.select('id')
			.executeTakeFirst();

		let valueId: number;
		if (existing) {
			valueId = existing.id;
		} else {
			const insertRes = await db
				.insertInto(table)
				.values({ name: value })
				.returning('id')
				.executeTakeFirstOrThrow();
			valueId = insertRes.id;
			logger.info(`Added a new ${table.slice(0, -1)}: ${value} (id=${valueId}).`);
		}

		await db
			.insertInto(relationTable)
			.values({ game_id: gameId, [`${table.slice(0, -1)}_id`]: valueId })
			.onConflict((oc) => oc.doNothing())
			.execute();
	}
}

updateGames().catch((err) => {
	logger.error(err);
	db.destroy();
});
