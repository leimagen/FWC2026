import type { Match, Team } from './standings';

export const teams: Team[] = [
	{ id: 'esp', name: { es: 'España', en: 'Spain' }, code: 'ESP', flag: '🇪🇸', ranking: 1 },
	{ id: 'jpn', name: { es: 'Japón', en: 'Japan' }, code: 'JPN', flag: '🇯🇵', ranking: 18 },
	{ id: 'sen', name: { es: 'Senegal', en: 'Senegal' }, code: 'SEN', flag: '🇸🇳', ranking: 19 },
	{ id: 'can', name: { es: 'Canadá', en: 'Canada' }, code: 'CAN', flag: '🇨🇦', ranking: 28 },
];

export const completedMatches: Match[] = [
	{ id: 'm1', homeId: 'esp', awayId: 'sen', homeGoals: 2, awayGoals: 0, minute: 90, status: 'finished' },
	{ id: 'm2', homeId: 'jpn', awayId: 'can', homeGoals: 1, awayGoals: 0, minute: 90, status: 'finished' },
	{ id: 'm3', homeId: 'esp', awayId: 'jpn', homeGoals: 1, awayGoals: 1, minute: 90, status: 'finished' },
	{ id: 'm4', homeId: 'sen', awayId: 'can', homeGoals: 2, awayGoals: 1, minute: 90, status: 'finished' },
];

export const initialLiveMatches: Match[] = [
	{ id: 'live-1', homeId: 'esp', awayId: 'can', homeGoals: 0, awayGoals: 0, minute: 67, status: 'live' },
	{ id: 'live-2', homeId: 'jpn', awayId: 'sen', homeGoals: 1, awayGoals: 0, minute: 65, status: 'live' },
];
