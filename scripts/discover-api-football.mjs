import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const apiKey = process.env.API_FOOTBALL_KEY;
const baseUrl =
	process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io';

if (!apiKey) {
	console.error(
		'Missing API_FOOTBALL_KEY. Copy .env.example to .env and add your key locally.',
	);
	process.exit(1);
}

async function apiGet(path, params = {}) {
	const url = new URL(path, baseUrl);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, String(value));
	}

	const response = await fetch(url, {
		headers: {
			'x-apisports-key': apiKey,
		},
	});

	if (!response.ok) {
		throw new Error(`API-Football returned ${response.status} for ${url.pathname}`);
	}

	const payload = await response.json();
	if (payload.errors && Object.keys(payload.errors).length > 0) {
		throw new Error(`API-Football error: ${JSON.stringify(payload.errors)}`);
	}
	return payload;
}

function summarizeLeague(item) {
	return {
		id: item.league?.id,
		name: item.league?.name,
		type: item.league?.type,
		country: item.country?.name,
		code: item.country?.code,
		seasons: (item.seasons ?? []).map((season) => ({
			year: season.year,
			start: season.start,
			end: season.end,
			current: season.current,
			coverage: season.coverage,
		})),
	};
}

const outputDirectory = resolve('.data', 'api-football');
await mkdir(outputDirectory, { recursive: true });

console.log('Checking account status and searching for World Cup competitions…');

const [status, worldCupSearch, fifaSearch] = await Promise.all([
	apiGet('/status'),
	apiGet('/leagues', { search: 'World Cup', current: 'true' }),
	apiGet('/leagues', { search: 'FIFA', current: 'true' }),
]);

const leagues = [...worldCupSearch.response, ...fifaSearch.response]
	.map(summarizeLeague)
	.filter(
		(league, index, all) =>
			league.id && all.findIndex((candidate) => candidate.id === league.id) === index,
	);

const report = {
	generatedAt: new Date().toISOString(),
	account: status.response,
	leagues,
	raw: {
		worldCupSearch,
		fifaSearch,
	},
};

const reportPath = resolve(outputDirectory, 'discovery.json');
await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

console.log(`Found ${leagues.length} candidate competition(s):`);
for (const league of leagues) {
	const years = league.seasons.map((season) => season.year).join(', ');
	console.log(`- ${league.id}: ${league.name} (${league.country}) — seasons: ${years}`);
}
console.log(`Private report saved to ${reportPath}`);
