import type {
	FootballDataProvider,
	LiveMatchStatus,
	MatchEventType,
	ProviderMatch,
	ProviderMatchEvent,
	ProviderTeam,
} from './types';

type ApiFootballResponse<T> = {
	errors: Record<string, string>;
	response: T[];
};

type ApiTeam = {
	id: number;
	name: string;
	logo: string | null;
};

type ApiFixture = {
	fixture: {
		id: number;
		date: string;
		status: { short: string; elapsed: number | null; extra: number | null };
		venue: { name: string | null } | null;
	};
	teams: { home: ApiTeam; away: ApiTeam };
	goals: { home: number | null; away: number | null };
	events?: ApiEvent[];
};

type ApiEvent = {
	time: { elapsed: number | null; extra: number | null };
	team: { id: number } | null;
	player: { name: string | null } | null;
	type: string;
	detail: string;
};

const statusMap: Record<string, LiveMatchStatus> = {
	TBD: 'scheduled',
	NS: 'scheduled',
	'1H': 'first-half',
	HT: 'halftime',
	'2H': 'second-half',
	ET: 'extra-time',
	BT: 'extra-time',
	P: 'penalties',
	SUSP: 'suspended',
	INT: 'suspended',
	FT: 'finished',
	AET: 'finished',
	PEN: 'finished',
	PST: 'postponed',
	CANC: 'cancelled',
	ABD: 'cancelled',
	AWD: 'finished',
	WO: 'finished',
};

function normalizeTeam(team: ApiTeam): ProviderTeam {
	return {
		providerId: team.id,
		name: team.name,
		code: null,
		crestUrl: team.logo,
	};
}

function normalizeEventType(event: ApiEvent): MatchEventType {
	if (event.type === 'Goal') {
		if (event.detail === 'Own Goal') return 'own-goal';
		if (event.detail === 'Penalty') return 'penalty-goal';
		if (event.detail === 'Missed Penalty') return 'missed-penalty';
		return 'goal';
	}
	if (event.type === 'Card') {
		return event.detail.includes('Red') ? 'red-card' : 'yellow-card';
	}
	if (event.type === 'subst') return 'substitution';
	if (event.type === 'Var') return 'var';
	return 'other';
}

function normalizeEvent(event: ApiEvent): ProviderMatchEvent {
	return {
		providerId: null,
		type: normalizeEventType(event),
		minute: event.time.elapsed,
		addedTime: event.time.extra,
		teamId: event.team?.id ?? null,
		playerName: event.player?.name ?? null,
		detail: event.detail || null,
	};
}

export function normalizeApiFootballFixture(fixture: ApiFixture): ProviderMatch {
	return {
		providerId: fixture.fixture.id,
		kickoff: fixture.fixture.date,
		status: statusMap[fixture.fixture.status.short] ?? 'unknown',
		elapsed: fixture.fixture.status.elapsed,
		addedTime: fixture.fixture.status.extra,
		venue: fixture.fixture.venue?.name ?? null,
		home: normalizeTeam(fixture.teams.home),
		away: normalizeTeam(fixture.teams.away),
		homeGoals: fixture.goals.home ?? 0,
		awayGoals: fixture.goals.away ?? 0,
		events: (fixture.events ?? []).map(normalizeEvent),
	};
}

export class ApiFootballProvider implements FootballDataProvider {
	constructor(
		private readonly apiKey: string,
		private readonly baseUrl = 'https://v3.football.api-sports.io',
	) {}

	private async get(path: string, params: Record<string, string | number> = {}) {
		const url = new URL(path, this.baseUrl);
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, String(value));
		}

		const response = await fetch(url, {
			headers: { 'x-apisports-key': this.apiKey },
		});
		if (!response.ok) {
			throw new Error(`API-Football request failed with ${response.status}`);
		}

		const payload = (await response.json()) as ApiFootballResponse<ApiFixture>;
		if (Object.keys(payload.errors ?? {}).length > 0) {
			throw new Error(`API-Football error: ${JSON.stringify(payload.errors)}`);
		}
		return payload.response.map(normalizeApiFootballFixture);
	}

	getLiveMatches() {
		return this.get('/fixtures', { live: 'all' });
	}

	getFixtures(leagueId: number, season: number) {
		return this.get('/fixtures', { league: leagueId, season });
	}
}
