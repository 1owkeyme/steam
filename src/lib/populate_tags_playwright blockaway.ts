import { kysely as db } from '$lib/db';
import { type Database as DB } from '$lib/types';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import winston from 'winston';

const logger = winston.createLogger({
	level: 'info',
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(winston.format.colorize(), winston.format.simple())
		}),
		new winston.transports.File({
			filename: 'logs/populateTagsPlaywrightDatabase.log',
			format: winston.format.combine(winston.format.timestamp(), winston.format.json())
		})
	]
});

const MAX_RETRIES = 3;
const DELAY_BETWEEN_REQUESTS = 1000;
const NUMBER_OF_BROWSERS = 10;
const MAX_GAMES_PER_BROWSER = 500;

async function scrapeGameDetails(id: number, page: any) {
	let attempts = 0;
	let progressiveDelay = 60000;
	const targetUrl = `https://gamalytic.com/game/${id}`;

	while (attempts < MAX_RETRIES) {
		try {
			// await page.goto('https://hidester.one/');
			await page.goto('https://www.suredns.nl/');
			const iframeElement = await page.waitForSelector('iframe#widget-frame');
			const iframe = await iframeElement.contentFrame();

			const inputSelector = 'input[placeholder="Enter an URL or a search query to access"]';
			const buttonSelector = 'button[type="button"]';

			await iframe.fill(inputSelector, targetUrl);
			await iframe.fill(inputSelector, targetUrl);
			await iframe.click(buttonSelector);

			await page.waitForNavigation({ waitUntil: 'domcontentloaded', url: RegExp(`game/${id}`) });

			await page.waitForSelector('b:has-text("Genres:")', { timeout: 20000 });

			const content = await page.content();
			const $ = cheerio.load(content);

			const extractText = (label: string) =>
				$(`b:contains("${label}")`)
					.parent()
					.find('div')
					.text()
					.split(',')
					.map((t) => t.trim())
					.filter((t) => t.length > 0);

			return {
				genres: extractText('Genres:'),
				tags: extractText('Tags:'),
				features: extractText('Features:'),
				languages: extractText('Languages:')
			};
		} catch (error) {
			attempts += 1;
			logger.error(`Attempt ${attempts} failed for game ${id}:`, error);

			if (attempts >= MAX_RETRIES) {
				throw new Error(`Failed to scrape game ${id} after ${MAX_RETRIES} attempts`);
			}

			await delay(progressiveDelay);
			progressiveDelay *= 2;
		}
	}
}

async function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processGameBatch(games: { id: number; name: string }[], browserIndex: number) {
	for (let i = 0; i < games.length; i += MAX_GAMES_PER_BROWSER) {
		const batch = games.slice(i, i + MAX_GAMES_PER_BROWSER);

		logger.info(`Browser ${browserIndex}: Launching browser for batch of ${batch.length} games...`);
		const browser = await chromium.launch({ headless: false });
		const context = await browser.newContext();
		const page = await context.newPage();

		for (const game of batch) {
			logger.info(`Browser ${browserIndex}: Scraping details for ${game.name} (id=${game.id})...`);

			const existing = await db
				.selectFrom('games_tags')
				.where('games_tags.game_id', '=', game.id)
				.select('games_tags.game_id')
				.executeTakeFirst();

			if (existing) {
				logger.info(
					`Browser ${browserIndex}: Game ${game.name} (id=${game.id}) already has details. Skipping...`
				);
				continue;
			}

			try {
				const gameDetails = await scrapeGameDetails(game.id, page);

				await updateManyToMany('genres', 'games_genres', game.id, gameDetails.genres);
				await updateManyToMany('tags', 'games_tags', game.id, gameDetails.tags);
				await updateManyToMany('features', 'games_features', game.id, gameDetails.features);
				await updateManyToMany('languages', 'games_languages', game.id, gameDetails.languages);

				logger.info(`Browser ${browserIndex}: Updated ${game.name} (id=${game.id}).`);
			} catch (error) {
				logger.error(`Browser ${browserIndex}: Failed to update game ${game.id}:`, error);
			}

			await delay(DELAY_BETWEEN_REQUESTS);
		}

		logger.info(`Browser ${browserIndex}: Closing browser after processing ${batch.length} games.`);
		await browser.close();
	}
}

async function processGamesWithRestarts() {
	const games = await db.selectFrom('games').select(['id', 'name']).execute();
	logger.info(`Found ${games.length} games to update.`);

	const chunkSize = Math.ceil(games.length / NUMBER_OF_BROWSERS);
	const gameChunks = [];
	for (let i = 0; i < games.length; i += chunkSize) {
		gameChunks.push(games.slice(i, i + chunkSize));
	}

	const browserPromises = gameChunks.map((chunk, index) => processGameBatch(chunk, index + 1));

	await Promise.all(browserPromises);

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

processGamesWithRestarts().catch(async (err) => {
	logger.error(err);
	await db.destroy();
});
