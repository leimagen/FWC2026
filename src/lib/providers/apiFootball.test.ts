import { describe, expect, it } from 'vitest';
import { normalizeApiFootballFixture } from './apiFootball';

describe('API-Football normalization', () => {
	it('maps live state, score and match events to provider-neutral data', () => {
		const match = normalizeApiFootballFixture({
			fixture: {
				id: 2026,
				date: '2026-06-20T19:00:00+00:00',
				status: { short: '2H', elapsed: 67, extra: null },
				venue: { name: 'Demo Stadium' },
			},
			teams: {
				home: { id: 1, name: 'Spain', logo: 'https://example.com/1.png' },
				away: { id: 2, name: 'Japan', logo: 'https://example.com/2.png' },
			},
			goals: { home: 2, away: 1 },
			events: [
				{
					time: { elapsed: 67, extra: null },
					team: { id: 1 },
					player: { name: 'Player' },
					type: 'Goal',
					detail: 'Normal Goal',
				},
				{
					time: { elapsed: 44, extra: 1 },
					team: { id: 2 },
					player: { name: 'Defender' },
					type: 'Card',
					detail: 'Red Card',
				},
			],
		});

		expect(match.status).toBe('second-half');
		expect([match.homeGoals, match.awayGoals]).toEqual([2, 1]);
		expect(match.events.map((event) => event.type)).toEqual(['goal', 'red-card']);
	});
});
