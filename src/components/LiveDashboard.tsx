import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { completedMatches, initialLiveMatches, teams } from '../lib/demoData';
import { calculateStandings, type Match, type Team } from '../lib/standings';

type Language = 'es' | 'en';

const copy = {
	es: {
		live: 'EN VIVO',
		title: 'La tabla se mueve con cada gol.',
		subtitle: 'Clasificación provisional del Mundial 2026, calculada con los marcadores de este instante.',
		group: 'Grupo demo',
		simulation: 'Simulación en vivo',
		simulationNote: 'Añade un gol y observa cómo ambos partidos alteran la tabla.',
		played: 'PJ',
		goalDifference: 'DG',
		points: 'PTS',
		qualified: 'Clasifica',
		third: 'Mejor 3.º',
		out: 'Fuera',
		events: 'Últimos eventos',
		goal: 'Gol',
		notifications: 'Avisarme',
		mute: 'Mutear partido',
		disclaimer: 'Demo con datos simulados · Sitio independiente, no afiliado a FIFA.',
		liveStatus: '2T',
	},
	en: {
		live: 'LIVE',
		title: 'The table moves with every goal.',
		subtitle: 'Provisional World Cup 2026 standings, calculated from the scores at this very moment.',
		group: 'Demo group',
		simulation: 'Live simulation',
		simulationNote: 'Add a goal and watch both matches reshape the table.',
		played: 'P',
		goalDifference: 'GD',
		points: 'PTS',
		qualified: 'Advances',
		third: 'Best 3rd',
		out: 'Out',
		events: 'Latest events',
		goal: 'Goal',
		notifications: 'Notify me',
		mute: 'Mute match',
		disclaimer: 'Demo using simulated data · Independent site, not affiliated with FIFA.',
		liveStatus: '2H',
	},
} as const;

function teamById(id: string): Team {
	return teams.find((team) => team.id === id)!;
}

export default function LiveDashboard({ initialLanguage }: { initialLanguage: Language }) {
	const [language, setLanguage] = useState<Language>(initialLanguage);
	const [matches, setMatches] = useState<Match[]>(initialLiveMatches);
	const [muted, setMuted] = useState<string[]>([]);
	const [lastEvent, setLastEvent] = useState<string>('jpn');
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);
	const t = copy[language];

	const standings = useMemo(
		() => calculateStandings(teams, [...completedMatches, ...matches]),
		[matches],
	);

	function updateScore(matchId: string, side: 'home' | 'away', change: number) {
		setMatches((current) =>
			current.map((match) => {
				if (match.id !== matchId) return match;
				const key = side === 'home' ? 'homeGoals' : 'awayGoals';
				const scorerId = side === 'home' ? match.homeId : match.awayId;
				const next = Math.max(0, match[key] + change);
				if (change > 0) setLastEvent(scorerId);
				return { ...match, [key]: next };
			}),
		);
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
					<img
						src="/brand/fwc2026live-logo.png"
						alt="FWC 2026 Live"
						width="1457"
						height="214"
					/>
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
					{matches.map((match) => (
						<div className="ticker-match" key={match.id}>
							<span>{teamById(match.homeId).flag} {teamById(match.homeId).code}</span>
							<strong>{match.homeGoals}–{match.awayGoals}</strong>
							<span>{teamById(match.awayId).code} {teamById(match.awayId).flag}</span>
							<small>{match.minute}' · {t.liveStatus}</small>
						</div>
					))}
				</div>
			</section>

			<section className="hero">
				<p className="eyebrow">WORLD CUP 2026 · LIVE PROJECTION</p>
				<h1>{t.title}</h1>
				<p>{t.subtitle}</p>
			</section>

			<div className="dashboard-grid">
				<section className="panel standings-panel">
					<div className="panel-heading">
						<div>
							<p className="section-kicker">{t.live} · 67'</p>
							<h2>{t.group}</h2>
						</div>
						<div className="legend">
							<span><i className="dot green" />{t.qualified}</span>
							<span><i className="dot amber" />{t.third}</span>
						</div>
					</div>

					<div className="table-head">
						<span>#</span><span>TEAM</span><span>{t.played}</span><span>{t.goalDifference}</span><span>{t.points}</span>
					</div>
					<div className="standings-list">
						<AnimatePresence initial={false}>
							{standings.map((row) => (
								<motion.div
									layout
									transition={{ type: 'spring', stiffness: 420, damping: 34 }}
									className={`standing-row position-${row.position}`}
									key={row.team.id}
								>
									<span className="position">{row.position}</span>
									<span className="team-name">
										<b className="flag">{row.team.flag}</b>
										<span><strong>{row.team.name[language]}</strong><small>{row.team.code}</small></span>
									</span>
									<span>{row.played}</span>
									<span>{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</span>
									<strong className="points">{row.points}</strong>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</section>

				<aside className="side-column">
					<section className="panel simulation-panel">
						<div className="panel-heading compact">
							<div><p className="section-kicker">CONTROL ROOM</p><h2>{t.simulation}</h2></div>
						</div>
						<p className="panel-note">{t.simulationNote}</p>
						{matches.map((match) => (
							<div className="match-control" key={match.id}>
								<div className="match-meta">
									<span className="pulse" /> {match.minute}' · {t.liveStatus}
									<button
										className={muted.includes(match.id) ? 'muted' : ''}
										onClick={() => setMuted((items) => items.includes(match.id) ? items.filter((id) => id !== match.id) : [...items, match.id])}
										title={t.mute}
									>⌁</button>
								</div>
								{(['home', 'away'] as const).map((side) => {
									const id = side === 'home' ? match.homeId : match.awayId;
									const score = side === 'home' ? match.homeGoals : match.awayGoals;
									const team = teamById(id);
									return (
										<div className="score-control" key={side}>
											<span>{team.flag} <strong>{team.name[language]}</strong></span>
											<div>
												<button onClick={() => updateScore(match.id, side, -1)} aria-label={`Remove ${team.code} goal`}>−</button>
												<b>{score}</b>
												<button onClick={() => updateScore(match.id, side, 1)} aria-label={`Add ${team.code} goal`}>+</button>
											</div>
										</div>
									);
								})}
							</div>
						))}
					</section>

					<section className="panel event-panel">
						<p className="section-kicker">{t.events}</p>
						<div className="event">
							<span className="event-icon">⚽</span>
							<div><strong>{t.goal} · {teamById(lastEvent).name[language]}</strong><small>67' · {teamById(lastEvent).code}</small></div>
						</div>
					</section>
				</aside>
			</div>

			<footer>{t.disclaimer}</footer>
		</main>
	);
}
