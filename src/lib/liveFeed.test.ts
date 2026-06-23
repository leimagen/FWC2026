import { describe, expect, it } from 'vitest';
import {
	contextualGroup,
	normalizeFeedMatches,
	reconcileSimulationOverrides,
	type LiveFeedSnapshot,
} from './liveFeed';
import { tournamentTeams } from './tournamentData';
import type { Match } from './standings';

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

	it('drops a stale simulation as soon as a real goal arrives', () => {
		const previous: Match[] = [{
			id: 'api-1', group: 'I', homeId: 'nor', awayId: 'sen',
			homeGoals: 0, awayGoals: 0, minute: 60, status: 'live',
		}];
		const next: Match[] = [{
			...previous[0], homeGoals: 1, minute: 61,
		}];

		expect(reconcileSimulationOverrides(previous, next, {
			'api-1': { homeGoals: 0, awayGoals: 0 },
		})).toEqual({});
	});

	it('keeps a simulation while only the live clock changes', () => {
		const previous: Match[] = [{
			id: 'api-1', group: 'I', homeId: 'nor', awayId: 'sen',
			homeGoals: 0, awayGoals: 0, minute: 60, status: 'live',
		}];
		const next: Match[] = [{
			...previous[0], minute: 61,
		}];
		const overrides = {
			'api-1': { homeGoals: 1, awayGoals: 0 },
		};

		expect(reconcileSimulationOverrides(previous, next, overrides)).toBe(overrides);
	});
});
