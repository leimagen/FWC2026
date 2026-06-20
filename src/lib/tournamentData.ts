import type { GroupId, Match, Team } from './standings';

const team = (
	id: string, group: GroupId, es: string, en: string, code: string,
	flag: string, ranking: number, fairPlay = 0,
): Team => ({ id, group, name: { es, en }, code, flag, ranking, fairPlay });

export const tournamentTeams: Team[] = [
	team('mex','A','México','Mexico','MEX','🇲🇽',15), team('rsa','A','Sudáfrica','South Africa','RSA','🇿🇦',61),
	team('kor','A','Corea del Sur','South Korea','KOR','🇰🇷',22), team('cze','A','Chequia','Czechia','CZE','🇨🇿',44),
	team('can','B','Canadá','Canada','CAN','🇨🇦',27), team('bih','B','Bosnia y Herzegovina','Bosnia & Herzegovina','BIH','🇧🇦',71),
	team('qat','B','Catar','Qatar','QAT','🇶🇦',51), team('sui','B','Suiza','Switzerland','SUI','🇨🇭',17),
	team('bra','C','Brasil','Brazil','BRA','🇧🇷',5), team('mar','C','Marruecos','Morocco','MAR','🇲🇦',11),
	team('sco','C','Escocia','Scotland','SCO','🏴',38), team('hai','C','Haití','Haiti','HAI','🇭🇹',83),
	team('usa','D','Estados Unidos','United States','USA','🇺🇸',14), team('par','D','Paraguay','Paraguay','PAR','🇵🇾',39),
	team('aus','D','Australia','Australia','AUS','🇦🇺',26), team('tur','D','Turquía','Türkiye','TUR','🇹🇷',25),
	team('ger','E','Alemania','Germany','GER','🇩🇪',10), team('civ','E','Costa de Marfil',"Côte d'Ivoire",'CIV','🇨🇮',42),
	team('ecu','E','Ecuador','Ecuador','ECU','🇪🇨',23), team('cuw','E','Curazao','Curaçao','CUW','🇨🇼',82),
	team('ned','F','Países Bajos','Netherlands','NED','🇳🇱',7), team('jpn','F','Japón','Japan','JPN','🇯🇵',18),
	team('swe','F','Suecia','Sweden','SWE','🇸🇪',43), team('tun','F','Túnez','Tunisia','TUN','🇹🇳',40),
	team('bel','G','Bélgica','Belgium','BEL','🇧🇪',8), team('egy','G','Egipto','Egypt','EGY','🇪🇬',32),
	team('irn','G','Irán','Iran','IRN','🇮🇷',20), team('nzl','G','Nueva Zelanda','New Zealand','NZL','🇳🇿',86),
	team('esp','H','España','Spain','ESP','🇪🇸',1), team('cpv','H','Cabo Verde','Cabo Verde','CPV','🇨🇻',65),
	team('ksa','H','Arabia Saudita','Saudi Arabia','KSA','🇸🇦',58), team('uru','H','Uruguay','Uruguay','URU','🇺🇾',16),
	team('fra','I','Francia','France','FRA','🇫🇷',3), team('sen','I','Senegal','Senegal','SEN','🇸🇳',19),
	team('nor','I','Noruega','Norway','NOR','🇳🇴',29), team('irq','I','Irak','Iraq','IRQ','🇮🇶',57),
	team('arg','J','Argentina','Argentina','ARG','🇦🇷',2), team('alg','J','Argelia','Algeria','ALG','🇩🇿',36),
	team('aut','J','Austria','Austria','AUT','🇦🇹',24), team('jor','J','Jordania','Jordan','JOR','🇯🇴',62),
	team('por','K','Portugal','Portugal','POR','🇵🇹',6), team('cod','K','RD del Congo','DR Congo','COD','🇨🇩',48),
	team('col','K','Colombia','Colombia','COL','🇨🇴',13), team('uzb','K','Uzbekistán','Uzbekistan','UZB','🇺🇿',50),
	team('eng','L','Inglaterra','England','ENG','🏴',4), team('cro','L','Croacia','Croatia','CRO','🇭🇷',12),
	team('gha','L','Ghana','Ghana','GHA','🇬🇭',47), team('pan','L','Panamá','Panama','PAN','🇵🇦',35),
];

const result = (
	id: string, group: GroupId, homeId: string, awayId: string,
	homeGoals: number, awayGoals: number,
): Match => ({ id, group, homeId, awayId, homeGoals, awayGoals, minute: 90, status: 'finished' });

const upcoming = (
	id: string, group: GroupId, homeId: string, awayId: string,
): Match => ({ id, group, homeId, awayId, homeGoals: 0, awayGoals: 0, minute: null, status: 'scheduled' });

export const tournamentMatches: Match[] = [
	result('a1','A','mex','rsa',2,0), result('a2','A','kor','cze',2,1), result('a3','A','cze','rsa',1,1), result('a4','A','mex','kor',1,0), upcoming('a5','A','rsa','kor'), upcoming('a6','A','cze','mex'),
	result('b1','B','can','bih',1,1), result('b2','B','qat','sui',1,1), result('b3','B','sui','bih',4,1), result('b4','B','can','qat',6,0), upcoming('b5','B','sui','can'), upcoming('b6','B','bih','qat'),
	result('c1','C','bra','mar',1,1), result('c2','C','sco','hai',1,0), result('c3','C','mar','sco',1,0), result('c4','C','bra','hai',3,0), upcoming('c5','C','mar','hai'), upcoming('c6','C','sco','bra'),
	result('d1','D','usa','par',4,1), result('d2','D','aus','tur',2,0), result('d3','D','usa','aus',2,0), result('d4','D','par','tur',1,0), upcoming('d5','D','tur','usa'), upcoming('d6','D','par','aus'),
	result('e1','E','ger','cuw',7,1), result('e2','E','civ','ecu',1,0),
	{ id:'e3',group:'E',homeId:'ger',awayId:'civ',homeGoals:0,awayGoals:0,minute:67,status:'live',simulated:true },
	{ id:'e4',group:'E',homeId:'ecu',awayId:'cuw',homeGoals:0,awayGoals:0,minute:65,status:'live',simulated:true },
	upcoming('e5','E','cuw','civ'), upcoming('e6','E','ecu','ger'),
	result('f1','F','ned','jpn',2,2), result('f2','F','swe','tun',5,1), result('f3','F','ned','swe',5,1), upcoming('f4','F','tun','jpn'), upcoming('f5','F','tun','ned'), upcoming('f6','F','jpn','swe'),
	result('g1','G','bel','egy',1,1), result('g2','G','irn','nzl',2,2), upcoming('g3','G','bel','irn'), upcoming('g4','G','nzl','egy'), upcoming('g5','G','nzl','bel'), upcoming('g6','G','egy','irn'),
	result('h1','H','esp','cpv',0,0), result('h2','H','ksa','uru',1,1), upcoming('h3','H','esp','ksa'), upcoming('h4','H','uru','cpv'), upcoming('h5','H','cpv','ksa'), upcoming('h6','H','uru','esp'),
	result('i1','I','fra','sen',3,1), result('i2','I','nor','irq',4,1), upcoming('i3','I','fra','irq'), upcoming('i4','I','nor','sen'), upcoming('i5','I','nor','fra'), upcoming('i6','I','sen','irq'),
	result('j1','J','arg','alg',3,0), result('j2','J','aut','jor',3,1), upcoming('j3','J','arg','aut'), upcoming('j4','J','jor','alg'), upcoming('j5','J','alg','aut'), upcoming('j6','J','jor','arg'),
	result('k1','K','por','cod',1,1), result('k2','K','col','uzb',3,1), upcoming('k3','K','por','uzb'), upcoming('k4','K','col','cod'), upcoming('k5','K','col','por'), upcoming('k6','K','cod','uzb'),
	result('l1','L','eng','cro',4,2), result('l2','L','gha','pan',1,0), upcoming('l3','L','eng','gha'), upcoming('l4','L','pan','cro'), upcoming('l5','L','pan','eng'), upcoming('l6','L','cro','gha'),
];

export const groupIds: GroupId[] = ['A','B','C','D','E','F','G','H','I','J','K','L'];

export const dataCutoff = '2026-06-20T19:00:00Z';
