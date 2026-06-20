import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const apiKey = process.env.API_FOOTBALL_KEY;
const baseUrl =
	process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io';
const leagueId = 1;
const season = 2026;

if (!apiKey) {
	console.error('Missing API_FOOTBALL_KEY in .env.');
	process.exit(1);
}

async function apiGet(path, params) {
	const url = new URL(path, baseUrl);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, String(value));
	}

	const response = await fetch(url, {
		headers: { 'x-apisports-key': apiKey },
	});
	const payload = await response.json();

	if (!response.ok || Object.keys(payload.errors ?? {}).length > 0) {
		if (payload.errors?.plan) {
			console.error(`Plan limitation: ${payload.errors.plan}`);
			console.error(
				'World Cup 2026 live data requires a paid API-Football subscription.',
			);
			process.exit(2);
		}
		throw new Error(
			`API-Football error for ${url.pathname}: ${JSON.stringify(payload.errors)}`,
		);
	}

	return {
		payload,
		rateLimit: {
			remaining: response.headers.get('x-ratelimit-requests-remaining'),
			limit: response.headers.get('x-ratelimit-requests-limit'),
		},
	};
}

console.log('Downloading World Cup 2026 fixtures, teams and standings…');

const fixtures = await apiGet('/fixtures', { league: leagueId, season });
const teams = await apiGet('/teams', { league: leagueId, season });
const standings = await apiGet('/standings', { league: leagueId, season });

const snapshot = {
	generatedAt: new Date().toISOString(),
	competition: { leagueId, season },
	rateLimit: standings.rateLimit,
	fixtures: fixtures.payload.response,
	teams: teams.payload.response,
	standings: standings.payload.response,
};

const outputDirectory = resolve('.data', 'api-football');
await mkdir(outputDirectory, { recursive: true });
const outputPath = resolve(outputDirectory, 'world-cup-2026.json');
await writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');

const statusCounts = Object.groupBy(
	snapshot.fixtures,
	(item) => item.fixture.status.short,
);

console.log(`Fixtures: ${snapshot.fixtures.length}`);
console.log(`Teams: ${snapshot.teams.length}`);
console.log(`Standings blocks: ${snapshot.standings.length}`);
console.log(
	`Fixture states: ${Object.entries(statusCounts)
		.map(([status, items]) => `${status}=${items.length}`)
		.join(', ')}`,
);
console.log(
	`Requests remaining today: ${snapshot.rateLimit.remaining ?? 'unknown'} / ${snapshot.rateLimit.limit ?? 'unknown'}`,
);
console.log(`Private snapshot saved to ${outputPath}`);
