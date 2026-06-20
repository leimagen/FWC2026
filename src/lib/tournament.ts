import { calculateStandings, rankThirdPlaced } from './standings';
import type { GroupId, Match, Standing, Team, ThirdPlaceStanding } from './standings';

export type TournamentProjection = {
	groups: Record<GroupId, Standing[]>;
	thirds: ThirdPlaceStanding[];
	qualifiedTeamIds: Set<string>;
};

export function calculateTournament(
	teams: Team[],
	matches: Match[],
): TournamentProjection {
	const groupIds = [...new Set(teams.map((team) => team.group))] as GroupId[];
	const groups = Object.fromEntries(
		groupIds.map((group) => [
			group,
			calculateStandings(
				teams.filter((team) => team.group === group),
				matches.filter((match) => match.group === group),
			),
		]),
	) as Record<GroupId, Standing[]>;

	const thirds = rankThirdPlaced(groups);
	const qualifiedTeamIds = new Set<string>();
	for (const table of Object.values(groups)) {
		qualifiedTeamIds.add(table[0].team.id);
		qualifiedTeamIds.add(table[1].team.id);
	}
	for (const row of thirds.filter((row) => row.qualifies)) {
		qualifiedTeamIds.add(row.team.id);
	}

	return { groups, thirds, qualifiedTeamIds };
}

export type RoundOf32Slot = {
	match: number;
	home: string;
	away: string;
	homeTeamId?: string;
	awayTeamId?: string;
};

const thirdPool = (groups: string) => `3rd ${groups}`;

export function projectRoundOf32(
	groups: Record<GroupId, Standing[]>,
): RoundOf32Slot[] {
	const teamId = (group: GroupId, position: 1 | 2) =>
		groups[group][position - 1]?.team.id;

	return [
		{ match: 73, home: '2A', away: '2B', homeTeamId: teamId('A', 2), awayTeamId: teamId('B', 2) },
		{ match: 74, home: '1E', away: thirdPool('A/B/C/D/F'), homeTeamId: teamId('E', 1) },
		{ match: 75, home: '1F', away: '2C', homeTeamId: teamId('F', 1), awayTeamId: teamId('C', 2) },
		{ match: 76, home: '1C', away: '2F', homeTeamId: teamId('C', 1), awayTeamId: teamId('F', 2) },
		{ match: 77, home: '1I', away: thirdPool('C/D/F/G/H'), homeTeamId: teamId('I', 1) },
		{ match: 78, home: '2E', away: '2I', homeTeamId: teamId('E', 2), awayTeamId: teamId('I', 2) },
		{ match: 79, home: '1A', away: thirdPool('C/E/F/H/I'), homeTeamId: teamId('A', 1) },
		{ match: 80, home: '1L', away: thirdPool('E/H/I/J/K'), homeTeamId: teamId('L', 1) },
		{ match: 81, home: '1D', away: thirdPool('B/E/F/I/J'), homeTeamId: teamId('D', 1) },
		{ match: 82, home: '1G', away: thirdPool('A/E/H/I/J'), homeTeamId: teamId('G', 1) },
		{ match: 83, home: '2K', away: '2L', homeTeamId: teamId('K', 2), awayTeamId: teamId('L', 2) },
		{ match: 84, home: '1H', away: '2J', homeTeamId: teamId('H', 1), awayTeamId: teamId('J', 2) },
		{ match: 85, home: '1B', away: thirdPool('E/F/G/I/J'), homeTeamId: teamId('B', 1) },
		{ match: 86, home: '1J', away: '2H', homeTeamId: teamId('J', 1), awayTeamId: teamId('H', 2) },
		{ match: 87, home: '1K', away: thirdPool('D/E/I/J/L'), homeTeamId: teamId('K', 1) },
		{ match: 88, home: '2D', away: '2G', homeTeamId: teamId('D', 2), awayTeamId: teamId('G', 2) },
	];
}
