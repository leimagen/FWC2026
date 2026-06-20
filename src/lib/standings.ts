export type Team = {
	id: string;
	name: { es: string; en: string };
	code: string;
	flag: string;
	ranking: number;
};

export type Match = {
	id: string;
	homeId: string;
	awayId: string;
	homeGoals: number;
	awayGoals: number;
	minute: number;
	status: 'live' | 'halftime' | 'finished';
};

export type Standing = {
	team: Team;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDifference: number;
	points: number;
	position: number;
};

type HeadToHead = Map<string, Omit<Standing, 'team' | 'position'>>;

const emptyStats = () => ({
	played: 0,
	won: 0,
	drawn: 0,
	lost: 0,
	goalsFor: 0,
	goalsAgainst: 0,
	goalDifference: 0,
	points: 0,
});

function applyMatch(
	stats: Map<string, ReturnType<typeof emptyStats>>,
	match: Match,
) {
	const home = stats.get(match.homeId);
	const away = stats.get(match.awayId);
	if (!home || !away) return;

	home.played += 1;
	away.played += 1;
	home.goalsFor += match.homeGoals;
	home.goalsAgainst += match.awayGoals;
	away.goalsFor += match.awayGoals;
	away.goalsAgainst += match.homeGoals;

	if (match.homeGoals > match.awayGoals) {
		home.won += 1;
		away.lost += 1;
		home.points += 3;
	} else if (match.homeGoals < match.awayGoals) {
		away.won += 1;
		home.lost += 1;
		away.points += 3;
	} else {
		home.drawn += 1;
		away.drawn += 1;
		home.points += 1;
		away.points += 1;
	}

	home.goalDifference = home.goalsFor - home.goalsAgainst;
	away.goalDifference = away.goalsFor - away.goalsAgainst;
}

function headToHeadFor(teamIds: string[], matches: Match[]): HeadToHead {
	const stats = new Map(teamIds.map((id) => [id, emptyStats()]));
	for (const match of matches) {
		if (teamIds.includes(match.homeId) && teamIds.includes(match.awayId)) {
			applyMatch(stats, match);
		}
	}
	return stats;
}

export function calculateStandings(teams: Team[], matches: Match[]): Standing[] {
	const stats = new Map(teams.map((team) => [team.id, emptyStats()]));
	for (const match of matches) applyMatch(stats, match);

	const rows = teams.map((team) => ({ team, ...stats.get(team.id)! }));
	const h2hCache = new Map<string, HeadToHead>();

	rows.sort((a, b) => {
		if (a.points !== b.points) return b.points - a.points;

		const tiedIds = rows
			.filter((row) => row.points === a.points)
			.map((row) => row.team.id)
			.sort();
		const cacheKey = tiedIds.join(':');
		if (!h2hCache.has(cacheKey)) {
			h2hCache.set(cacheKey, headToHeadFor(tiedIds, matches));
		}
		const h2h = h2hCache.get(cacheKey)!;
		const h2hA = h2h.get(a.team.id)!;
		const h2hB = h2h.get(b.team.id)!;

		if (h2hA.points !== h2hB.points) return h2hB.points - h2hA.points;
		if (h2hA.goalDifference !== h2hB.goalDifference) {
			return h2hB.goalDifference - h2hA.goalDifference;
		}
		if (h2hA.goalsFor !== h2hB.goalsFor) return h2hB.goalsFor - h2hA.goalsFor;
		if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
		if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
		return a.team.ranking - b.team.ranking;
	});

	return rows.map((row, index) => ({ ...row, position: index + 1 }));
}
