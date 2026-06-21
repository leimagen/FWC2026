import { describe, expect, it } from 'vitest';
import { contextualGroup, normalizeFeedMatches, type LiveFeedSnapshot } from './liveFeed';
import { tournamentTeams } from './tournamentData';

const snapshot: LiveFeedSnapshot = {
	generatedAt: '2026-06-20T20:00:00Z',
	remainingRequests: 7000,
	fixtures: [{
		id: 1,
		kickoff: '2026-06-20T20:00:00Z',
		round: 'Group Stage - 2',
		status: '1H',
		statusLabel: 'First Half',
		elapsed: 44,
		addedTime: null,
		venue: null,
		city: null,
		home: { id: 25, name: 'Germany', logo: '', goals: 0 },
		away: { id: 1501, name: 'Ivory Coast', logo: '', goals: 1 },
		events: [],
	}],
};

describe('live feed normalization', () => {
	it('maps API-Football aliases into the local tournament model', () => {
		const matches = normalizeFeedMatches(snapshot, tournamentTeams);
		expect(matches[0]).toMatchObject({
			group: 'E', homeId: 'ger', awayId: 'civ', status: 'live',
		});
	});

	it('selects an active group before the next scheduled group', () => {
		const matches = normalizeFeedMatches(snapshot, tournamentTeams);
		expect(contextualGroup(matches, snapshot.fixtures, Date.parse('2026-06-20T19:00:00Z'))).toBe('E');
	});
});
