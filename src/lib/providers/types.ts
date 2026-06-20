export type LiveMatchStatus =
	| 'scheduled'
	| 'first-half'
	| 'hydration-break'
	| 'halftime'
	| 'second-half'
	| 'extra-time'
	| 'penalties'
	| 'suspended'
	| 'finished'
	| 'postponed'
	| 'cancelled'
	| 'unknown';

export type MatchEventType =
	| 'goal'
	| 'own-goal'
	| 'penalty-goal'
	| 'missed-penalty'
	| 'yellow-card'
	| 'red-card'
	| 'substitution'
	| 'var'
	| 'other';

export type ProviderTeam = {
	providerId: number;
	name: string;
	code: string | null;
	crestUrl: string | null;
};

export type ProviderMatchEvent = {
	providerId: number | null;
	type: MatchEventType;
	minute: number | null;
	addedTime: number | null;
	teamId: number | null;
	playerName: string | null;
	detail: string | null;
};

export type ProviderMatch = {
	providerId: number;
	kickoff: string;
	status: LiveMatchStatus;
	elapsed: number | null;
	addedTime: number | null;
	venue: string | null;
	home: ProviderTeam;
	away: ProviderTeam;
	homeGoals: number;
	awayGoals: number;
	events: ProviderMatchEvent[];
};

export interface FootballDataProvider {
	getLiveMatches(): Promise<ProviderMatch[]>;
	getFixtures(leagueId: number, season: number): Promise<ProviderMatch[]>;
}
