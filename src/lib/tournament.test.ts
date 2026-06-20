import { describe, expect, it } from 'vitest';
import { tournamentMatches, tournamentTeams } from './tournamentData';
import { calculateTournament, projectRoundOf32 } from './tournament';

describe('tournament projection', () => {
	it('builds twelve groups and selects 32 provisional qualifiers', () => {
		const projection = calculateTournament(tournamentTeams, tournamentMatches);
		expect(Object.keys(projection.groups)).toHaveLength(12);
		expect(projection.thirds).toHaveLength(12);
		expect(projection.thirds.filter((row) => row.qualifies)).toHaveLength(8);
		expect(projection.qualifiedTeamIds.size).toBe(32);
	});

	it('creates all sixteen round-of-32 slots', () => {
		const projection = calculateTournament(tournamentTeams, tournamentMatches);
		const bracket = projectRoundOf32(projection.groups);
		expect(bracket).toHaveLength(16);
		expect(bracket[0]).toMatchObject({ match: 73, home: '2A', away: '2B' });
		expect(bracket.at(-1)).toMatchObject({ match: 88, home: '2D', away: '2G' });
	});

	it('matches known group leaders at the local data cutoff', () => {
		const projection = calculateTournament(tournamentTeams, tournamentMatches);
		expect(projection.groups.A[0].team.id).toBe('mex');
		expect(projection.groups.C[0].team.id).toBe('bra');
		expect(projection.groups.D[0].team.id).toBe('usa');
	});

	it('changes the global third-place ranking after a simulated goal', () => {
		const before = calculateTournament(tournamentTeams, tournamentMatches);
		const changed = tournamentMatches.map((match) =>
			match.id === 'e4' ? { ...match, homeGoals: 3 } : match,
		);
		const after = calculateTournament(tournamentTeams, changed);
		expect(after.thirds.map((row) => row.team.id)).not.toEqual(
			before.thirds.map((row) => row.team.id),
		);
	});
});
