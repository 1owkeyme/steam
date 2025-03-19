import { kysely as db } from '$lib/db';
import winston from 'winston';

const logger = winston.createLogger({
	level: 'info',
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(winston.format.colorize(), winston.format.simple())
		}),
		new winston.transports.File({
			filename: 'logs/populateDatabase.log',
			format: winston.format.combine(winston.format.timestamp(), winston.format.json())
		})
	]
});

const API_URL = `https://api.gamalytic.com/steam-games/list`;
const LIMIT = 50;
const MAX_RETRIES = 3;
async function fetchPage(page: number) {
	const params = new URLSearchParams({
		fields:
			'name,firstReleaseDate,earlyAccessExitDate,earlyAccess,copiesSold,price,revenue,avgPlaytime,reviewScore,publisherClass,publishers,developers,id,steamId',
		page: page.toString(),
		limit: LIMIT.toString()
	});

	let attempts = 0;
	let progressiveDelay = 60 * 1000;
	while (attempts < MAX_RETRIES) {
		try {
			const response = await fetch(`${API_URL}?${params.toString()}`, {
				headers: {
					'User-Agent': 'Mozilla/5.0',
					Accept: 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch page ${page}: ${response.statusText}`);
			}

			return response.json();
		} catch (error) {
			attempts += 1;
			logger.error(`Attempt ${attempts} failed for page ${page}:`, error);

			if (attempts >= MAX_RETRIES) {
				throw new Error(`Failed to fetch page ${page} after ${MAX_RETRIES} attempts`);
			}

			await delay(progressiveDelay);
			progressiveDelay *= 2;
		}
	}
}

async function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function populateDatabase(startingPage: number) {
	const firstPage = await fetchPage(0);
	const totalPages = Math.ceil(firstPage.total / LIMIT);

	logger.info(`Found ${totalPages} pages to fetch.`);

	for (let page = startingPage; page <= totalPages; page++) {
		logger.info(`Fetching page ${page}...`);
		const games = await fetchPage(page);

		for (const game of games.result) {
			const ret = await db
				.selectFrom('games')
				.where('id', '=', game.steamId)
				.select('id')
				.executeTakeFirst();

			if (ret) {
				logger.info(`Game ${game.name} (id=${game.steamId}) already exists.`);
			} else {
				const insertRes = await db
					.insertInto('games')
					.values({
						id: game.steamId,
						name: game.name,
						first_release_date: new Date(game.firstReleaseDate),
						early_access_exit_date: game.earlyAccessExitDate
							? new Date(game.earlyAccessExitDate)
							: undefined,
						early_access: game.earlyAccess,
						copies_sold: game.copiesSold,
						price: game.price,
						revenue: game.revenue,
						avg_playtime: game.avgPlaytime,
						review_score: game.reviewScore,
						publisher_class: game.publisherClass
					})
					.onConflict((oc) => oc.doNothing())
					.returning('id')
					.executeTakeFirstOrThrow();

				logger.info(`Added a game ${game.name} (id=${insertRes.id}).`);
			}

			for (const publisherName of game.publishers) {
				const existingPublisher = await db
					.selectFrom('publishers')
					.where('name', '=', publisherName)
					.select('id')
					.executeTakeFirst();

				let publisherId: number;
				if (existingPublisher) {
					publisherId = existingPublisher.id;
					logger.info(`Publisher ${publisherName} already exists (id=${publisherId}).`);
				} else {
					const insertRes = await db
						.insertInto('publishers')
						.values({ name: publisherName })
						.returning('id')
						.executeTakeFirstOrThrow();
					publisherId = insertRes.id;
					logger.info(`Added a new publisher ${publisherName} (id=${publisherId}).`);
				}

				await db
					.insertInto('game_publishers')
					.values({ game_id: game.steamId, publisher_id: publisherId })
					.onConflict((oc) => oc.doNothing())
					.execute();
			}

			for (const developerName of game.developers) {
				const existingDeveloper = await db
					.selectFrom('developers')
					.where('name', '=', developerName)
					.select('id')
					.executeTakeFirst();

				let developerId: number;
				if (existingDeveloper) {
					developerId = existingDeveloper.id;
					logger.info(`Developer ${developerName} already exists (id=${developerId}).`);
				} else {
					const insertRes = await db
						.insertInto('developers')
						.values({ name: developerName })
						.returning('id')
						.executeTakeFirstOrThrow();
					developerId = insertRes.id;
					logger.info(`Added a new developer ${developerName} (id=${developerId}).`);
				}

				await db
					.insertInto('game_developers')
					.values({ game_id: game.steamId, developer_id: developerId })
					.onConflict((oc) => oc.doNothing())
					.execute();
			}
		}

		await delay(1000);
	}

	logger.info('Database populated successfully.');
	await db.destroy();
}

const startingPage = 196;
populateDatabase(startingPage).catch((err) => {
	logger.error(err);
	db.destroy();
});
