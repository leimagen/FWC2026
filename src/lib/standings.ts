export type GroupId =
	| 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
	| 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export type Team = {
	id: string;
	group: GroupId;
	name: { es: string; en: string };
	code: string;
	flag: string;
	flagCode?: string;
	ranking: number;
	fairPlay?: number;
};

export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished';

export type Match = {
	id: string;
	group: GroupId;
	homeId: string;
	awayId: string;
	homeGoals: number;
	awayGoals: number;
	minute: number | null;
	status: MatchStatus;
	simulated?: boolean;
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
	fairPlay: number;
	position: number;
};

type Stats = Omit<Standing, 'team' | 'position'>;

const emptyStats = (fairPlay = 0): Stats => ({
	played: 0,
	won: 0,
	drawn: 0,
	lost: 0,
	goalsFor: 0,
	goalsAgainst: 0,
	goalDifference: 0,
	points: 0,
	fairPlay,
});

function isCounted(match: Match) {
	return match.status !== 'scheduled';
}

function applyMatch(stats: Map<string, Stats>, match: Match) {
	if (!isCounted(match)) return;
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

function statsFor(teams: Team[], matches: Match[]) {
	const stats = new Map(teams.map((team) => [team.id, emptyStats(team.fairPlay)]));
	for (const match of matches) applyMatch(stats, match);
	return stats;
}

function splitBy<T>(items: T[], value: (item: T) => string | number): T[][] {
	const groups: T[][] = [];
	for (const item of items) {
		const last = groups.at(-1);
		if (!last || value(last[0]) !== value(item)) groups.push([item]);
		else last.push(item);
	}
	return groups;
}

function rankTiedRows(rows: Standing[], matches: Match[]): Standing[] {
	if (rows.length < 2) return rows;
	const ids = new Set(rows.map((row) => row.team.id));
	const h2h = statsFor(
		rows.map((row) => row.team),
		matches.filter((match) => ids.has(match.homeId) && ids.has(match.awayId)),
	);

	const h2hSorted = [...rows].sort((a, b) => {
		const sa = h2h.get(a.team.id)!;
		const sb = h2h.get(b.team.id)!;
		return (
			sb.points - sa.points ||
			sb.goalDifference - sa.goalDifference ||
			sb.goalsFor - sa.goalsFor
		);
	});

	const h2hGroups = splitBy(
		h2hSorted,
		(row) => {
			const stat = h2h.get(row.team.id)!;
			return `${stat.points}:${stat.goalDifference}:${stat.goalsFor}`;
		},
	);

	return h2hGroups.flatMap((group) => {
		if (group.length > 1 && group.length < rows.length) {
			return rankTiedRows(group, matches);
		}
		return [...group].sort(
			(a, b) =>
				b.goalDifference - a.goalDifference ||
				b.goalsFor - a.goalsFor ||
				b.fairPlay - a.fairPlay ||
				a.team.ranking - b.team.ranking,
		);
	});
}

export function calculateStandings(teams: Team[], matches: Match[]): Standing[] {
	const stats = statsFor(teams, matches);
	const rows: Standing[] = teams.map((team) => ({
		team,
		...stats.get(team.id)!,
		position: 0,
	}));

	const byPoints = [...rows].sort((a, b) => b.points - a.points);
	const ranked = splitBy(byPoints, (row) => row.points).flatMap((group) =>
		rankTiedRows(group, matches),
	);

	return ranked.map((row, index) => ({ ...row, position: index + 1 }));
}

export type ThirdPlaceStanding = Standing & {
	group: GroupId;
	thirdPosition: number;
	qualifies: boolean;
};

export function rankThirdPlaced(
	groupStandings: Record<GroupId, Standing[]>,
): ThirdPlaceStanding[] {
	const thirds = (Object.keys(groupStandings) as GroupId[]).map((group) => ({
		...groupStandings[group][2],
		group,
		thirdPosition: 0,
		qualifies: false,
	}));

	thirds.sort(
		(a, b) =>
			b.points - a.points ||
			b.goalDifference - a.goalDifference ||
			b.goalsFor - a.goalsFor ||
			b.fairPlay - a.fairPlay ||
			a.team.ranking - b.team.ranking,
	);

	return thirds.map((row, index) => ({
		...row,
		thirdPosition: index + 1,
		qualifies: index < 8,
	}));
}
