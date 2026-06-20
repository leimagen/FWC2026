import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { calculateTournament, projectRoundOf32 } from '../lib/tournament';
import { dataCutoff, groupIds, tournamentMatches, tournamentTeams } from '../lib/tournamentData';
import type { GroupId, Match, Team } from '../lib/standings';
import { normalizeFeedMatches, type LiveFeedSnapshot } from '../lib/liveFeed';

type Language = 'es' | 'en';
type View = 'groups' | 'thirds' | 'bracket';

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
		controlNote: 'Los dos partidos del Grupo E se calculan como si terminaran con este marcador.',
		dataNote: 'Resultados locales con corte',
		next: 'Próximos partidos',
		noLive: 'Este grupo no tiene una simulación activa.',
		thirdNote: 'Los ocho primeros avanzan provisionalmente a dieciseisavos.',
		round: 'Dieciseisavos proyectados',
		thirdPool: 'Mejor 3.º de',
		match: 'Partido',
		disclaimer: 'Modo simulación · Datos locales · Sitio independiente, no afiliado a FIFA.',
		notifications: 'Avisarme',
		connected: 'Datos en vivo',
		local: 'Modo local',
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
		controlNote: 'Both Group E matches are calculated as if these scores held until full time.',
		dataNote: 'Local results as of',
		next: 'Upcoming matches',
		noLive: 'This group has no active simulation.',
		thirdNote: 'The top eight provisionally advance to the round of 32.',
		round: 'Projected round of 32',
		thirdPool: 'Best 3rd from',
		match: 'Match',
		disclaimer: 'Simulation mode · Local data · Independent site, not affiliated with FIFA.',
		notifications: 'Notify me',
		connected: 'Live data',
		local: 'Local mode',
	},
} as const;

const teamMap = new Map(tournamentTeams.map((team) => [team.id, team]));
const teamById = (id: string) => teamMap.get(id)!;

function TeamLabel({ team, language }: { team: Team; language: Language }) {
	return <><span className="flag-plain">{team.flag}</span><span>{team.name[language]}</span></>;
}

export default function LiveDashboard({ initialLanguage }: { initialLanguage: Language }) {
	const [language, setLanguage] = useState<Language>(initialLanguage);
	const [selectedGroup, setSelectedGroup] = useState<GroupId>('E');
	const [view, setView] = useState<View>('groups');
	const [matches, setMatches] = useState<Match[]>(tournamentMatches);
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);
	const [feedGeneratedAt, setFeedGeneratedAt] = useState<string | null>(null);
	const [feedConnected, setFeedConnected] = useState(false);
	const t = copy[language];

	const projection = useMemo(
		() => calculateTournament(tournamentTeams, matches),
		[matches],
	);
	const bracket = useMemo(() => projectRoundOf32(projection.groups), [projection.groups]);
	const selectedTable = projection.groups[selectedGroup];
	const selectedMatches = matches.filter((match) => match.group === selectedGroup);
	const liveMatches = matches.filter((match) => match.status === 'live');
	const cutoff = new Intl.DateTimeFormat(language, {
		day: 'numeric', month: 'short', year: 'numeric',
		hour: '2-digit', minute: '2-digit',
	}).format(new Date(feedGeneratedAt ?? dataCutoff));

	useEffect(() => {
		let active = true;
		const refresh = async () => {
			try {
				const response = await fetch('https://feed.fwc2026live.com/v1/world-cup');
				if (!response.ok) throw new Error(`Feed ${response.status}`);
				const snapshot = await response.json() as LiveFeedSnapshot;
				const normalized = normalizeFeedMatches(snapshot, tournamentTeams);
				if (active && normalized.length === 72) {
					setMatches(normalized);
					setFeedGeneratedAt(snapshot.generatedAt);
					setFeedConnected(true);
				}
			} catch {
				if (active) setFeedConnected(false);
			}
		};
		void refresh();
		const timer = window.setInterval(refresh, 30_000);
		return () => { active = false; window.clearInterval(timer); };
	}, []);

	function updateScore(matchId: string, side: 'home' | 'away', change: number) {
		setMatches((current) => current.map((match) => {
			if (match.id !== matchId) return match;
			const key = side === 'home' ? 'homeGoals' : 'awayGoals';
			return { ...match, [key]: Math.max(0, match[key] + change) };
		}));
	}

	function switchLanguage(next: Language) {
		setLanguage(next);
		window.history.replaceState({}, '', next === 'es' ? '/' : '/en/');
		document.documentElement.lang = next;
	}

	async function requestNotifications() {
		if (!('Notification' in window)) return;
		const permission = await Notification.requestPermission();
		setNotificationsEnabled(permission === 'granted');
	}

	return (
		<main className="app-shell">
			<header className="topbar">
				<a className="brand" href={language === 'es' ? '/' : '/en/'} aria-label="Home">
					<img src="/brand/fwc2026live-logo.png" alt="FWC 2026 Live" width="1457" height="214" />
				</a>
				<div className="top-actions">
					<button className="notify-button" type="button" onClick={requestNotifications}>
						<span aria-hidden="true">{notificationsEnabled ? '●' : '◉'}</span> {t.notifications}
					</button>
					<div className="language-switch" aria-label="Language">
						<button className={language === 'es' ? 'active' : ''} onClick={() => switchLanguage('es')}>ES</button>
						<button className={language === 'en' ? 'active' : ''} onClick={() => switchLanguage('en')}>EN</button>
					</div>
				</div>
			</header>

			<section className="live-strip" aria-label={t.live}>
				<div className="live-label"><span />{t.live}</div>
				<div className="ticker">
					{liveMatches.map((match) => (
						<button className="ticker-match" key={match.id} onClick={() => { setSelectedGroup(match.group); setView('groups'); }}>
							<span>{teamById(match.homeId).flag} {teamById(match.homeId).code}</span>
							<strong>{match.homeGoals}–{match.awayGoals}</strong>
							<span>{teamById(match.awayId).code} {teamById(match.awayId).flag}</span>
							<small>{match.minute}'</small>
						</button>
					))}
				</div>
			</section>

			<section className="hero compact-hero">
				<p className="eyebrow">WORLD CUP 2026 · GLOBAL PROJECTION</p>
				<h1>{t.title}</h1>
				<p>{t.subtitle}</p>
				<small className={`data-cutoff ${feedConnected ? 'connected' : ''}`}>
					<span /> {feedConnected ? t.connected : t.local} · {t.dataNote}: {cutoff}
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
								<button key={group} className={selectedGroup === group ? 'active' : ''} onClick={() => setSelectedGroup(group)}>
									<span>{group}</span><small>{leader.team.flag} {leader.team.code}</small>
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
												<span className="team-name"><b className="flag">{row.team.flag}</b><span><strong>{row.team.name[language]}</strong><small>{row.team.code}</small></span></span>
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
								<p className="panel-note">{selectedGroup === 'E' ? t.controlNote : t.noLive}</p>
								{selectedMatches.filter((match) => match.status === 'live').map((match) => (
									<div className="match-control" key={match.id}>
										<div className="match-meta"><span className="pulse" /> {match.minute}' · {t.group} {match.group}</div>
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
								{selectedMatches.filter((match) => match.status === 'scheduled').slice(0, 2).map((match) => (
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

			<footer>{t.disclaimer}</footer>
		</main>
	);
}
