import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateTournament, projectRoundOf32 } from '../lib/tournament';
import { dataCutoff, groupIds, tournamentMatches, tournamentTeams } from '../lib/tournamentData';
import type { GroupId, Match, Team } from '../lib/standings';
import { contextualGroup, normalizeFeedMatches, type FeedEvent, type FeedFixture, type LiveFeedSnapshot } from '../lib/liveFeed';

type Language = 'es' | 'en';
type View = 'groups' | 'thirds' | 'bracket';
type AnalyticsConsent = 'accepted' | 'declined' | null;
type AnalyticsStatus = 'idle' | 'loading' | 'loaded' | 'blocked';

const GA_MEASUREMENT_ID = 'G-DP2FPQ0D8Z';
const ACTIVE_MATCH_STATUSES = new Set(['live', 'halftime']);
const ACTIVE_FEED_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'SUSP']);
const LIVE_REFRESH_MS = 5_000;
const RETRY_REFRESH_MS = 30_000;
const PRE_MATCH_WAKE_MS = 2 * 60_000;

const copy = {
	es: {
		live: 'SIMULACIÓN EN VIVO',
		title: 'Un gol mueve todo el Mundial.',
		subtitle: 'Clasificación provisional de los 12 grupos, mejores terceros y cruces recalculados al instante.',
		groups: 'Grupos',
		thirds: 'Mejores terceros',
		bracket: 'Cruces',
		group: 'Grupo',
		played: 'PJ',
		goalDifference: 'DG',
		points: 'PTS',
		qualified: 'Clasifica',
		bestThird: 'Mejor 3.º',
		out: 'Fuera',
		control: 'Control de simulación',
		controlNote: 'Ajusta los partidos activos o los próximos del grupo y proyecta cómo quedaría la tabla.',
		dataNote: 'Resultados locales con corte',
		updated: 'Actualizado',
		next: 'Próximos partidos',
		noLive: 'Este grupo no tiene una simulación activa.',
		thirdNote: 'Los ocho primeros avanzan provisionalmente a dieciseisavos.',
		round: 'Dieciseisavos proyectados',
		thirdPool: 'Mejor 3.º de',
		match: 'Partido',
		disclaimer: 'Modo simulación · Datos locales · Sitio independiente, no afiliado a FIFA.',
		notifications: 'Avisarme',
		notificationsOn: 'Avisos activos',
		testNotification: 'Probar aviso',
		testSent: 'Prueba enviada',
		testFailed: 'No se pudo enviar',
		disableNotifications: 'Desactivar avisos',
		enableNotifications: 'Activar avisos',
		notificationsBlocked: 'Bloqueadas',
		muteMatch: 'Mutear este partido',
		unmuteMatch: 'Activar avisos',
		resetSimulation: 'Restablecer marcador',
		connected: 'Datos en vivo',
		local: 'Modo local',
		supportPrompt: '¿Te resulta útil?',
		support: 'Apoya el proyecto',
		contribute: 'Contribuir con',
		analyticsTitle: 'Analítica opcional',
		analyticsText: 'Google Analytics nos ayuda a entender cómo se usa la app. Solo se carga si aceptas.',
		acceptAnalytics: 'Aceptar',
		declineAnalytics: 'No, gracias',
		privacySettings: 'Privacidad',
		analyticsLoading: 'Conectando con Google Analytics…',
		analyticsLoaded: 'Google Analytics conectado',
		analyticsBlocked: 'Google Analytics fue bloqueado por el navegador o una extensión',
		liveNow: 'EN VIVO',
		halftime: 'ENTRETIEMPO',
		firstHalf: '1T',
		secondHalf: '2T',
		extraTime: 'PRÓRROGA',
		penalties: 'PENALES',
		suspended: 'SUSPENDIDO',
		goalEvent: 'Gol',
		yellowCard: 'Tarjeta amarilla',
		redCard: 'Tarjeta roja',
		ownGoal: 'Autogol',
		penaltyGoal: 'Penal',
		assist: 'Asistencia',
	},
	en: {
		live: 'LIVE SIMULATION',
		title: 'One goal moves the whole World Cup.',
		subtitle: 'All 12 groups, best third-placed teams and knockout slots recalculated instantly.',
		groups: 'Groups',
		thirds: 'Best thirds',
		bracket: 'Bracket',
		group: 'Group',
		played: 'P',
		goalDifference: 'GD',
		points: 'PTS',
		qualified: 'Advances',
		bestThird: 'Best 3rd',
		out: 'Out',
		control: 'Simulation control',
		controlNote: 'Adjust live or upcoming group matches and project how the table would finish.',
		dataNote: 'Local results as of',
		updated: 'Updated',
		next: 'Upcoming matches',
		noLive: 'This group has no active simulation.',
		thirdNote: 'The top eight provisionally advance to the round of 32.',
		round: 'Projected round of 32',
		thirdPool: 'Best 3rd from',
		match: 'Match',
		disclaimer: 'Simulation mode · Local data · Independent site, not affiliated with FIFA.',
		notifications: 'Notify me',
		notificationsOn: 'Alerts on',
		testNotification: 'Test alert',
		testSent: 'Test sent',
		testFailed: 'Could not send',
		disableNotifications: 'Turn alerts off',
		enableNotifications: 'Turn alerts on',
		notificationsBlocked: 'Blocked',
		muteMatch: 'Mute this match',
		unmuteMatch: 'Enable alerts',
		resetSimulation: 'Reset score',
		connected: 'Live data',
		local: 'Local mode',
		supportPrompt: 'Finding it useful?',
		support: 'Support the project',
		contribute: 'Contribute with',
		analyticsTitle: 'Optional analytics',
		analyticsText: 'Google Analytics helps us understand how the app is used. It only loads if you accept.',
		acceptAnalytics: 'Accept',
		declineAnalytics: 'No thanks',
		privacySettings: 'Privacy',
		analyticsLoading: 'Connecting to Google Analytics…',
		analyticsLoaded: 'Google Analytics connected',
		analyticsBlocked: 'Google Analytics was blocked by the browser or an extension',
		liveNow: 'LIVE',
		halftime: 'HALF-TIME',
		firstHalf: '1H',
		secondHalf: '2H',
		extraTime: 'EXTRA TIME',
		penalties: 'PENALTIES',
		suspended: 'SUSPENDED',
		goalEvent: 'Goal',
		yellowCard: 'Yellow card',
		redCard: 'Red card',
		ownGoal: 'Own goal',
		penaltyGoal: 'Penalty',
		assist: 'Assist',
	},
} as const;

const teamMap = new Map(tournamentTeams.map((team) => [team.id, team]));
const teamById = (id: string) => teamMap.get(id)!;

function TeamLabel({ team, language }: { team: Team; language: Language }) {
	return <><TeamFlag team={team} /><span>{team.name[language]}</span></>;
}

function TeamFlag({ team, compact = false }: { team: Team; compact?: boolean }) {
	return team.flagCode
		? <img className={`country-flag ${compact ? 'compact' : ''}`} src={`/flags/${team.flagCode}.svg`} alt="" />
		: <span className="flag-plain">{team.flag}</span>;
}

export default function LiveDashboard({ initialLanguage }: { initialLanguage: Language }) {
	const [language, setLanguage] = useState<Language>(initialLanguage);
	const [selectedGroup, setSelectedGroup] = useState<GroupId>('E');
	const [view, setView] = useState<View>('groups');
	const [matches, setMatches] = useState<Match[]>(tournamentMatches);
	const [simulationOverrides, setSimulationOverrides] = useState<Record<string, {
		homeGoals: number;
		awayGoals: number;
	}>>({});
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);
	const [notificationsBlocked, setNotificationsBlocked] = useState(false);
	const [pushFeedback, setPushFeedback] = useState<string | null>(null);
	const [mutedFixtureIds, setMutedFixtureIds] = useState<number[]>([]);
	const [showAnalyticsConsent, setShowAnalyticsConsent] = useState(false);
	const [analyticsStatus, setAnalyticsStatus] = useState<AnalyticsStatus>('idle');
	const [feedGeneratedAt, setFeedGeneratedAt] = useState<string | null>(null);
	const [feedConnected, setFeedConnected] = useState(false);
	const [feedFixtures, setFeedFixtures] = useState<FeedFixture[]>([]);
	const groupSelectionInitialized = useRef(false);
	const t = copy[language];

	const effectiveMatches = useMemo(() => matches.map((match) => {
		const override = simulationOverrides[match.id];
		return override ? {
			...match,
			...override,
			status: match.status === 'scheduled' ? 'live' as const : match.status,
			minute: match.minute ?? 0,
			simulated: true,
		} : match;
	}), [matches, simulationOverrides]);
	const projection = useMemo(
		() => calculateTournament(tournamentTeams, effectiveMatches),
		[effectiveMatches],
	);
	const bracket = useMemo(() => projectRoundOf32(projection.groups), [projection.groups]);
	const selectedTable = projection.groups[selectedGroup];
	const selectedMatches = effectiveMatches.filter((match) => match.group === selectedGroup);
	const controlMatches = selectedMatches.some((match) => ACTIVE_MATCH_STATUSES.has(match.status))
		? selectedMatches.filter((match) => ACTIVE_MATCH_STATUSES.has(match.status))
		: selectedMatches.filter((match) => match.status === 'scheduled').slice(0, 2);
	const cutoff = new Intl.DateTimeFormat(language, {
		day: 'numeric', month: 'short', year: 'numeric',
		hour: '2-digit', minute: '2-digit',
	}).format(new Date(feedGeneratedAt ?? dataCutoff));

	useEffect(() => {
		let active = true;
		let timer: number | undefined;

		const scheduleNextRefresh = (snapshot: LiveFeedSnapshot) => {
			window.clearTimeout(timer);
			if (snapshot.fixtures.some((fixture) => ACTIVE_FEED_STATUSES.has(fixture.status))) {
				timer = window.setTimeout(refresh, LIVE_REFRESH_MS);
				return;
			}
			const now = Date.now();
			const nextKickoff = snapshot.fixtures
				.filter((fixture) => ['TBD', 'NS'].includes(fixture.status))
				.map((fixture) => new Date(fixture.kickoff).getTime())
				.filter((kickoff) => kickoff > now)
				.sort((a, b) => a - b)[0];
			if (nextKickoff) {
				timer = window.setTimeout(
					refresh,
					Math.max(1_000, nextKickoff - now - PRE_MATCH_WAKE_MS),
				);
			}
		};

		const refresh = async () => {
			try {
				const response = await fetch('https://feed.fwc2026live.com/v1/world-cup');
				if (!response.ok) throw new Error(`Feed ${response.status}`);
				const snapshot = await response.json() as LiveFeedSnapshot;
				const normalized = normalizeFeedMatches(snapshot, tournamentTeams);
				if (active && normalized.length === 72) {
					setMatches(normalized);
					setFeedGeneratedAt(snapshot.generatedAt);
					setFeedFixtures(snapshot.fixtures);
					setFeedConnected(true);
					if (!groupSelectionInitialized.current) {
						setSelectedGroup(contextualGroup(
							normalized,
							snapshot.fixtures,
						) ?? normalized[0].group);
						groupSelectionInitialized.current = true;
					}
					scheduleNextRefresh(snapshot);
				}
			} catch {
				if (active) {
					setFeedConnected(false);
					timer = window.setTimeout(refresh, RETRY_REFRESH_MS);
				}
			}
		};

		const refreshOnVisible = () => {
			if (document.visibilityState === 'visible') void refresh();
		};
		void refresh();
		document.addEventListener('visibilitychange', refreshOnVisible);
		return () => {
			active = false;
			window.clearTimeout(timer);
			document.removeEventListener('visibilitychange', refreshOnVisible);
		};
	}, []);

	useEffect(() => {
		const saved = window.localStorage.getItem('analyticsConsent') as AnalyticsConsent;
		if (saved === 'accepted') {
			setAnalyticsStatus('loading');
			void loadGoogleAnalytics().then(setAnalyticsStatus);
		} else if (saved !== 'declined') {
			setShowAnalyticsConsent(true);
		}
	}, []);

	useEffect(() => {
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
		void navigator.serviceWorker.ready
			.then((registration) => registration.pushManager.getSubscription())
			.then((subscription) => setNotificationsEnabled(Boolean(subscription)));
		setNotificationsBlocked(Notification.permission === 'denied');
		const saved = window.localStorage.getItem('mutedFixtureIds');
		if (saved) setMutedFixtureIds(JSON.parse(saved));
	}, []);

	function updateScore(matchId: string, side: 'home' | 'away', change: number) {
		const match = effectiveMatches.find((item) => item.id === matchId);
		if (!match) return;
		setSimulationOverrides((current) => ({
			...current,
			[matchId]: {
				homeGoals: side === 'home' ? Math.max(0, match.homeGoals + change) : match.homeGoals,
				awayGoals: side === 'away' ? Math.max(0, match.awayGoals + change) : match.awayGoals,
			},
		}));
	}

	function switchLanguage(next: Language) {
		setLanguage(next);
		window.history.replaceState({}, '', next === 'es' ? '/' : '/en/');
		document.documentElement.lang = next;
	}

	function chooseAnalytics(next: Exclude<AnalyticsConsent, null>) {
		window.localStorage.setItem('analyticsConsent', next);
		setShowAnalyticsConsent(false);
		if (next === 'accepted') {
			setAnalyticsStatus('loading');
			void loadGoogleAnalytics().then(setAnalyticsStatus);
		} else {
			setAnalyticsStatus('idle');
		}
	}

	async function requestNotifications() {
		if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') {
			setNotificationsBlocked(permission === 'denied');
			return;
		}
		const registration = await navigator.serviceWorker.ready;
		const keyResponse = await fetch('https://feed.fwc2026live.com/v1/push/public-key');
		const { publicKey } = await keyResponse.json() as { publicKey: string };
		if (!publicKey) throw new Error('Push key unavailable');
		const subscription = await registration.pushManager.getSubscription() ??
			await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey),
			});
		await fetch('https://feed.fwc2026live.com/v1/push/subscribe', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ subscription: subscription.toJSON(), language }),
		});
		setNotificationsEnabled(true);
		setNotificationsBlocked(false);
	}

	async function testNotification() {
		const registration = await navigator.serviceWorker.ready;
		await registration.update();
		const subscription = await registration.pushManager.getSubscription();
		if (!subscription) {
			setNotificationsEnabled(false);
			return;
		}
		const response = await fetch('https://feed.fwc2026live.com/v1/push/test', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ subscription: subscription.toJSON(), language }),
		});
		setPushFeedback(response.ok ? t.testSent : t.testFailed);
		window.setTimeout(() => setPushFeedback(null), 3500);
	}

	async function disableNotifications() {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		if (subscription) {
			await fetch('https://feed.fwc2026live.com/v1/push/subscribe', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ endpoint: subscription.endpoint }),
			});
			await subscription.unsubscribe();
		}
		setNotificationsEnabled(false);
		setMutedFixtureIds([]);
		window.localStorage.removeItem('mutedFixtureIds');
	}

	async function toggleNotifications() {
		if (notificationsEnabled) await disableNotifications();
		else await requestNotifications();
	}

	async function toggleMute(matchId: string) {
		const fixtureId = Number(matchId.replace('api-', ''));
		if (!Number.isFinite(fixtureId)) return;
		const next = mutedFixtureIds.includes(fixtureId)
			? mutedFixtureIds.filter((id) => id !== fixtureId)
			: [...mutedFixtureIds, fixtureId];
		setMutedFixtureIds(next);
		window.localStorage.setItem('mutedFixtureIds', JSON.stringify(next));
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		if (!subscription) return;
		await fetch('https://feed.fwc2026live.com/v1/push/preferences', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ endpoint: subscription.endpoint, mutedFixtureIds: next }),
		});
	}

	return (
		<main className="app-shell">
			<header className="topbar">
				<a className="brand" href={language === 'es' ? '/' : '/en/'} aria-label="Home">
					<img src="/brand/fwc2026live-logo.png" alt="FWC 2026 Live" width="1457" height="214" />
				</a>
				<div className="top-actions">
					<div className="notification-controls">
						<button className={`notification-toggle ${notificationsEnabled ? 'active' : ''}`} type="button"
							onClick={() => void toggleNotifications()} disabled={notificationsBlocked}
							role="switch" aria-checked={notificationsEnabled}
							title={notificationsEnabled ? t.disableNotifications : t.enableNotifications}>
							<span className="toggle-track"><i /></span>
							<b>{notificationsBlocked ? t.notificationsBlocked : notificationsEnabled ? t.notificationsOn : t.notifications}</b>
						</button>
						{notificationsEnabled && (
							<button className="notification-test" onClick={() => void testNotification()} title={t.testNotification}>
								{pushFeedback ?? '↗'}
							</button>
						)}
					</div>
					<div className="language-switch" aria-label="Language">
						<button className={language === 'es' ? 'active' : ''} onClick={() => switchLanguage('es')}>ES</button>
						<button className={language === 'en' ? 'active' : ''} onClick={() => switchLanguage('en')}>EN</button>
					</div>
				</div>
			</header>

			<section className="live-strip" aria-label={t.liveNow}>
				<div className="live-label"><span />{t.liveNow}</div>
				<div className="ticker">
					{feedFixtures
						.filter((fixture) => ['1H','HT','2H','ET','BT','P','INT','SUSP'].includes(fixture.status))
						.map((fixture) => {
							const match = effectiveMatches.find((item) => item.id === `api-${fixture.id}`);
							if (!match) return null;
							return (
								<LiveTickerMatch
									key={fixture.id}
									fixture={fixture}
									match={match}
									language={language}
									copy={t}
									onSelect={() => {
										groupSelectionInitialized.current = true;
										setSelectedGroup(match.group);
										setView('groups');
									}}
								/>
							);
						})}
				</div>
			</section>

			<section className="hero compact-hero">
				<p className="eyebrow">WORLD CUP 2026 · GLOBAL PROJECTION</p>
				<h1>{t.title}</h1>
				<p>{t.subtitle}</p>
				<small className={`data-cutoff ${feedConnected ? 'connected' : ''}`}>
					<span /> {feedConnected ? t.connected : t.local} · {feedConnected ? t.updated : t.dataNote}: {cutoff}
				</small>
			</section>

			<nav className="view-tabs" aria-label="Tournament views">
				<button className={view === 'groups' ? 'active' : ''} onClick={() => setView('groups')}>{t.groups}</button>
				<button className={view === 'thirds' ? 'active' : ''} onClick={() => setView('thirds')}>{t.thirds}</button>
				<button className={view === 'bracket' ? 'active' : ''} onClick={() => setView('bracket')}>{t.bracket}</button>
			</nav>

			{view === 'groups' && (
				<>
					<div className="group-tabs">
						{groupIds.map((group) => {
							const leader = projection.groups[group][0];
							return (
								<button key={group} className={selectedGroup === group ? 'active' : ''} onClick={() => {
									groupSelectionInitialized.current = true;
									setSelectedGroup(group);
								}}>
									<span>{group}</span><small><TeamFlag team={leader.team} compact /> {leader.team.code}</small>
								</button>
							);
						})}
					</div>

					<div className="dashboard-grid">
						<section className="panel standings-panel">
							<div className="panel-heading">
								<div><p className="section-kicker">48 TEAMS · 12 GROUPS</p><h2>{t.group} {selectedGroup}</h2></div>
								<div className="legend">
									<span><i className="dot green" />{t.qualified}</span>
									<span><i className="dot amber" />{t.bestThird}</span>
								</div>
							</div>
							<div className="table-head"><span>#</span><span>TEAM</span><span>{t.played}</span><span>{t.goalDifference}</span><span>{t.points}</span></div>
							<div className="standings-list">
								<AnimatePresence initial={false}>
									{selectedTable.map((row) => {
										const third = projection.thirds.find((item) => item.team.id === row.team.id);
										return (
											<motion.div layout transition={{ type: 'spring', stiffness: 420, damping: 34 }}
												className={`standing-row position-${row.position} ${third?.qualifies ? 'third-qualified' : ''}`} key={row.team.id}>
												<span className="position">{row.position}</span>
												<span className="team-name"><b className="flag"><TeamFlag team={row.team} /></b><span><strong>{row.team.name[language]}</strong><small>{row.team.code}</small></span></span>
												<span>{row.played}</span><span>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</span><strong className="points">{row.points}</strong>
											</motion.div>
										);
									})}
								</AnimatePresence>
							</div>
						</section>

						<aside className="side-column">
							<section className="panel simulation-panel">
								<div className="panel-heading compact"><div><p className="section-kicker">CONTROL ROOM</p><h2>{t.control}</h2></div></div>
								<p className="panel-note">{t.controlNote}</p>
								{controlMatches.map((match) => (
									<div className="match-control" key={match.id}>
										<div className="match-meta">
											<span className="pulse" /> {match.status === 'scheduled' ? t.next : match.status === 'halftime' ? t.halftime : `${match.minute}'`} · {t.group} {match.group}
											{simulationOverrides[match.id] && (
												<button
													onClick={() => setSimulationOverrides((current) => {
														const next = { ...current };
														delete next[match.id];
														return next;
													})}
													title={t.resetSimulation}
													aria-label={t.resetSimulation}
												>↺</button>
											)}
											{notificationsEnabled && match.id.startsWith('api-') && (
												<button
													className={mutedFixtureIds.includes(Number(match.id.replace('api-', ''))) ? 'muted' : ''}
													onClick={() => void toggleMute(match.id)}
													title={mutedFixtureIds.includes(Number(match.id.replace('api-', ''))) ? t.unmuteMatch : t.muteMatch}
													aria-label={mutedFixtureIds.includes(Number(match.id.replace('api-', ''))) ? t.unmuteMatch : t.muteMatch}
												>{mutedFixtureIds.includes(Number(match.id.replace('api-', ''))) ? '🔕' : '🔔'}</button>
											)}
										</div>
										{(['home', 'away'] as const).map((side) => {
											const id = side === 'home' ? match.homeId : match.awayId;
											const score = side === 'home' ? match.homeGoals : match.awayGoals;
											const team = teamById(id);
											return <div className="score-control" key={side}>
												<span><TeamLabel team={team} language={language} /></span>
												<div><button onClick={() => updateScore(match.id, side, -1)}>−</button><b>{score}</b><button onClick={() => updateScore(match.id, side, 1)}>+</button></div>
											</div>;
										})}
									</div>
								))}
								{controlMatches.length === 0 && selectedMatches.filter((match) => match.status === 'scheduled').slice(0, 2).map((match) => (
									<div className="upcoming-match" key={match.id}>
										<span>{teamById(match.homeId).code}</span><b>vs</b><span>{teamById(match.awayId).code}</span>
									</div>
								))}
							</section>
						</aside>
					</div>
				</>
			)}

			{view === 'thirds' && (
				<section className="panel wide-panel">
					<div className="panel-heading"><div><p className="section-kicker">8 OF 12 ADVANCE</p><h2>{t.thirds}</h2><p className="panel-note inline-note">{t.thirdNote}</p></div></div>
					<div className="thirds-grid">
						{projection.thirds.map((row) => (
							<motion.div layout className={`third-row ${row.qualifies ? 'qualifies' : ''}`} key={row.team.id}>
								<b>{row.thirdPosition}</b><span className="third-group">{row.group}</span>
								<span className="third-team"><TeamLabel team={row.team} language={language} /></span>
								<span>{row.points} pts</span><span>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</span>
								<small>{row.qualifies ? t.qualified : t.out}</small>
							</motion.div>
						))}
					</div>
				</section>
			)}

			{view === 'bracket' && (
				<section className="panel wide-panel">
					<div className="panel-heading"><div><p className="section-kicker">MATCHES 73–88</p><h2>{t.round}</h2></div></div>
					<div className="bracket-grid">
						{bracket.map((slot) => (
							<div className="bracket-match" key={slot.match}>
								<small>{t.match} {slot.match}</small>
								<div>{slot.homeTeamId ? <TeamLabel team={teamById(slot.homeTeamId)} language={language} /> : slot.home}</div>
								<i>vs</i>
								<div>{slot.awayTeamId ? <TeamLabel team={teamById(slot.awayTeamId)} language={language} /> : slot.away.replace('3rd ', `${t.thirdPool} `)}</div>
							</div>
						))}
					</div>
				</section>
			)}

			<section className="support-card" aria-label={t.support}>
				<div>
					<img src="/brand/ball-icon.png" alt="" width="204" height="207" />
					<span><small>{t.supportPrompt}</small><strong>{t.support}</strong></span>
				</div>
				<a href="https://paypal.me/fwc2026" target="_blank" rel="noopener noreferrer">
					<span>{t.contribute}</span>
					<b>PayPal</b>
				</a>
			</section>

			<footer>
				{t.disclaimer}
				<button className="privacy-button" onClick={() => setShowAnalyticsConsent(true)}>
					{t.privacySettings}
				</button>
			</footer>

			{showAnalyticsConsent && (
				<div className="consent-banner" role="dialog" aria-labelledby="analytics-consent-title">
					<div>
						<strong id="analytics-consent-title">{t.analyticsTitle}</strong>
						<p>{t.analyticsText}</p>
						{analyticsStatus !== 'idle' && (
							<small className={`analytics-status ${analyticsStatus}`}>
								{analyticsStatus === 'loading' ? t.analyticsLoading :
									analyticsStatus === 'loaded' ? t.analyticsLoaded : t.analyticsBlocked}
							</small>
						)}
					</div>
					<div className="consent-actions">
						<button className="secondary" onClick={() => chooseAnalytics('declined')}>{t.declineAnalytics}</button>
						<button className="primary" onClick={() => chooseAnalytics('accepted')}>{t.acceptAnalytics}</button>
					</div>
				</div>
			)}
		</main>
	);
}

type TickerCopy = {
	halftime: string;
	firstHalf: string;
	secondHalf: string;
	extraTime: string;
	penalties: string;
	suspended: string;
	goalEvent: string;
	yellowCard: string;
	redCard: string;
	ownGoal: string;
	penaltyGoal: string;
	assist: string;
};

function LiveTickerMatch({
	fixture,
	match,
	language,
	copy,
	onSelect,
}: {
	fixture: FeedFixture;
	match: Match;
	language: Language;
	copy: TickerCopy;
	onSelect: () => void;
}) {
	const home = teamById(match.homeId);
	const away = teamById(match.awayId);
	const events = fixture.events
		.filter((event) => event.type === 'Goal' || event.type === 'Card')
		.slice(-3)
		.reverse();

	return (
		<button className="ticker-match" onClick={onSelect}>
			<div className="ticker-scoreline">
				<span className="ticker-team">
					<span className="ticker-flag-wrap"><TeamFlag team={home} /></span>
					<b>{home.code}</b>
				</span>
				<strong>{fixture.home.goals}–{fixture.away.goals}</strong>
				<span className="ticker-team away">
					<span className="ticker-flag-wrap"><TeamFlag team={away} /></span>
					<b>{away.code}</b>
				</span>
				<small>{liveStatus(fixture, copy)}</small>
			</div>
			<div className="ticker-events" aria-live="polite">
				{events.length > 0 ? events.map((event, index) => (
					<div className="ticker-event" key={`${fixture.id}-${event.minute}-${event.player}-${index}`}>
						<span className={`event-mark ${eventClass(event)}`}>{eventIcon(event)}</span>
						<span>
							<b>{eventLabel(event, copy)}</b>
							<em>{event.minute}' · {event.player ?? (language === 'es' ? 'Jugador' : 'Player')}</em>
							{event.assist && <small>{copy.assist}: {event.assist}</small>}
						</span>
					</div>
				)) : (
					<div className="ticker-event quiet">
						<span className="event-mark">●</span>
						<span><b>{fixture.statusLabel}</b><em>{fixture.venue ?? fixture.city ?? ''}</em></span>
					</div>
				)}
			</div>
		</button>
	);
}

function liveStatus(fixture: FeedFixture, copy: TickerCopy) {
	const labels: Record<string, string> = {
		HT: copy.halftime,
		'1H': copy.firstHalf,
		'2H': copy.secondHalf,
		ET: copy.extraTime,
		BT: copy.extraTime,
		P: copy.penalties,
		INT: copy.suspended,
		SUSP: copy.suspended,
	};
	const phase = labels[fixture.status] ?? fixture.statusLabel;
	if (fixture.status === 'HT') return phase;
	const minute = fixture.elapsed != null
		? `${fixture.elapsed}${fixture.addedTime ? `+${fixture.addedTime}` : ''}'`
		: '';
	return `${phase}${minute ? ` · ${minute}` : ''}`;
}

function eventClass(event: FeedEvent) {
	if (event.type === 'Goal') return 'goal';
	if (event.detail.includes('Red')) return 'red';
	return 'yellow';
}

function eventIcon(event: FeedEvent) {
	if (event.type === 'Goal') return '⚽';
	return event.detail.includes('Red') ? '■' : '■';
}

function eventLabel(event: FeedEvent, copy: TickerCopy) {
	if (event.type === 'Goal') {
		if (event.detail === 'Own Goal') return copy.ownGoal;
		if (event.detail === 'Penalty') return copy.penaltyGoal;
		return copy.goalEvent;
	}
	return event.detail.includes('Red') ? copy.redCard : copy.yellowCard;
}

function urlBase64ToUint8Array(value: string) {
	const padding = '='.repeat((4 - value.length % 4) % 4);
	const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = window.atob(base64);
	return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function loadGoogleAnalytics(): Promise<AnalyticsStatus> {
	const analyticsWindow = window as Window & {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	};
	if (analyticsWindow.gtag && document.querySelector(`script[data-ga-id="${GA_MEASUREMENT_ID}"]`)) {
		analyticsWindow.gtag('event', 'page_view', {
			page_location: window.location.href,
			page_title: document.title,
			debug_mode: true,
		});
		return Promise.resolve('loaded');
	}
	analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
	analyticsWindow.gtag = function (..._args: unknown[]) {
		analyticsWindow.dataLayer!.push(arguments);
	};
	analyticsWindow.gtag('consent', 'update', {
		analytics_storage: 'granted',
		ad_storage: 'denied',
		ad_user_data: 'denied',
		ad_personalization: 'denied',
	});
	analyticsWindow.gtag('js', new Date());
	analyticsWindow.gtag('config', GA_MEASUREMENT_ID, {
		anonymize_ip: true,
		send_page_view: false,
	});
	return new Promise((resolve) => {
		const script = document.createElement('script');
		script.async = true;
		script.dataset.gaId = GA_MEASUREMENT_ID;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
		script.onload = () => {
			analyticsWindow.gtag?.('event', 'page_view', {
				page_location: window.location.href,
				page_title: document.title,
				debug_mode: true,
			});
			resolve('loaded');
		};
		script.onerror = () => resolve('blocked');
		document.head.appendChild(script);
	});
}
