import type { GroupId, Match, MatchStatus, Team } from './standings';

export type FeedEvent = {
	minute: number | null;
	addedTime: number | null;
	teamId: number | null;
	player: string | null;
	assist: string | null;
	type: string;
	detail: string;
	comments: string | null;
};

type FeedTeam = {
	id: number;
	name: string;
	logo: string;
	goals: number;
};

export type FeedFixture = {
	id: number;
	kickoff: string;
	round: string;
	status: string;
	statusLabel: string;
	elapsed: number | null;
	addedTime: number | null;
	venue: string | null;
	city: string | null;
	home: FeedTeam;
	away: FeedTeam;
	events: FeedEvent[];
};

export type LiveFeedSnapshot = {
	generatedAt: string;
	remainingRequests: number | null;
	fixtures: FeedFixture[];
};

export type SimulationOverrides = Record<string, {
	homeGoals: number;
	awayGoals: number;
}>;

const aliases: Record<string, string> = {
	'czech republic': 'cze',
	czechia: 'cze',
	'south korea': 'kor',
	'korea republic': 'kor',
	'bosnia & herzegovina': 'bih',
	'bosnia and herzegovina': 'bih',
	'ivory coast': 'civ',
	"cote d'ivoire": 'civ',
	curacao: 'cuw',
	curaçao: 'cuw',
	'cape verde': 'cpv',
	'cabo verde': 'cpv',
	'cape verde islands': 'cpv',
	'dr congo': 'cod',
	'congo dr': 'cod',
	turkey: 'tur',
	turkiye: 'tur',
	'usa': 'usa',
	'united states': 'usa',
};

function normalizeName(value: string) {
	return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function teamIdFor(name: string, teams: Team[]) {
	const normalized = normalizeName(name);
	const alias = aliases[normalized];
	if (alias) return alias;
	return teams.find((team) =>
		normalizeName(team.name.en) === normalized ||
		normalizeName(team.name.es) === normalized ||
		team.code.toLowerCase() === normalized
	)?.id;
}

function normalizeStatus(status: string): MatchStatus {
	if (['TBD', 'NS', 'PST'].includes(status)) return 'scheduled';
	if (status === 'HT') return 'halftime';
	if (['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD'].includes(status)) return 'finished';
	return 'live';
}

export function normalizeFeedMatches(snapshot: LiveFeedSnapshot, teams: Team[]): Match[] {
	return snapshot.fixtures.flatMap((fixture) => {
		const homeId = teamIdFor(fixture.home.name, teams);
		const awayId = teamIdFor(fixture.away.name, teams);
		if (!homeId || !awayId) return [];
		const group = teams.find((team) => team.id === homeId)?.group;
		if (!group || teams.find((team) => team.id === awayId)?.group !== group) return [];
		return [{
			id: `api-${fixture.id}`,
			group: group as GroupId,
			homeId,
			awayId,
			homeGoals: fixture.home.goals,
			awayGoals: fixture.away.goals,
			minute: fixture.elapsed,
			status: normalizeStatus(fixture.status),
		}];
	});
}

export function reconcileSimulationOverrides(
	previousMatches: Match[],
	nextMatches: Match[],
	overrides: SimulationOverrides,
): SimulationOverrides {
	const previousById = new Map(previousMatches.map((match) => [match.id, match]));
	const nextById = new Map(nextMatches.map((match) => [match.id, match]));
	let reconciled = overrides;

	for (const matchId of Object.keys(overrides)) {
		const previous = previousById.get(matchId);
		const next = nextById.get(matchId);
		if (!previous || !next) continue;

		const realScoreChanged =
			previous.homeGoals !== next.homeGoals ||
			previous.awayGoals !== next.awayGoals;
		const realMatchStarted =
			previous.status === 'scheduled' &&
			next.status !== 'scheduled';
		const realMatchFinished =
			previous.status !== 'finished' &&
			next.status === 'finished';

		if (realScoreChanged || realMatchStarted || realMatchFinished) {
			if (reconciled === overrides) reconciled = { ...overrides };
			delete reconciled[matchId];
		}
	}

	return reconciled;
}

export function contextualGroup(
	matches: Match[],
	fixtures: FeedFixture[],
	now = Date.now(),
): GroupId | null {
	const active = matches.find((match) =>
		match.status === 'live' || match.status === 'halftime',
	);
	if (active) return active.group;

	const kickoffByMatchId = new Map(
		fixtures.map((fixture) => [`api-${fixture.id}`, new Date(fixture.kickoff).getTime()]),
	);
	return matches
		.filter((match) => match.status === 'scheduled')
		.map((match) => ({ match, kickoff: kickoffByMatchId.get(match.id) ?? 0 }))
		.filter(({ kickoff }) => kickoff > now)
		.sort((a, b) => a.kickoff - b.kickoff)[0]?.match.group ?? null;
}
