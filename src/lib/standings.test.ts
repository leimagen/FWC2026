import { describe, expect, it } from 'vitest';
import { calculateStandings, type Match, type Team } from './standings';

const teams: Team[] = [
	{ id: 'a', name: { es: 'A', en: 'A' }, code: 'AAA', flag: '', ranking: 1 },
	{ id: 'b', name: { es: 'B', en: 'B' }, code: 'BBB', flag: '', ranking: 2 },
	{ id: 'c', name: { es: 'C', en: 'C' }, code: 'CCC', flag: '', ranking: 3 },
];

describe('calculateStandings', () => {
	it('treats current live scores as provisional final results', () => {
		const matches: Match[] = [
			{ id: '1', homeId: 'a', awayId: 'b', homeGoals: 1, awayGoals: 0, minute: 52, status: 'live' },
			{ id: '2', homeId: 'c', awayId: 'a', homeGoals: 0, awayGoals: 0, minute: 90, status: 'finished' },
		];

		const table = calculateStandings(teams, matches);
		expect(table.map((row) => row.team.id)).toEqual(['a', 'c', 'b']);
		expect(table[0].points).toBe(4);
		expect(table[0].goalDifference).toBe(1);
	});

	it('reorders teams immediately after a simultaneous-match goal', () => {
		const before: Match[] = [
			{ id: '1', homeId: 'a', awayId: 'b', homeGoals: 0, awayGoals: 0, minute: 70, status: 'live' },
			{ id: '2', homeId: 'c', awayId: 'a', homeGoals: 0, awayGoals: 0, minute: 69, status: 'live' },
		];
		const after = before.map((match) => match.id === '1' ? { ...match, awayGoals: 1 } : match);

		expect(calculateStandings(teams, before)[0].team.id).toBe('a');
		expect(calculateStandings(teams, after)[0].team.id).toBe('b');
	});
});
