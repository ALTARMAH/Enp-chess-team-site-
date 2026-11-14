import { Chess } from 'chess.js';

export type TimeControl = 'rapid' | 'blitz' | 'classical';
export type MatchOutcome = 1 | 0.5 | 0; // 1 = White win, 0.5 = Draw, 0 = Black win
export type MatchStakes = 'friendly' | 'competitive' | 'tournament';

export function getStakesMultiplier(stakes: MatchStakes = 'competitive'): number {
  if (stakes === 'friendly') return 0.45; // Friendly games affect Elo by ~45% of a regular match
  if (stakes === 'tournament') return 1.25; // Championship tournament games carry 1.25x weight
  return 1.0; // Standard competitive club game
}

export interface Glicko2Rating {
  rating: number;
  rd: number;
  vol: number;
}

export interface RatingUpdatePreview {
  fideWhiteNew: number;
  fideWhiteDelta: number;
  fideBlackNew: number;
  fideBlackDelta: number;
  glickoWhiteNew: Glicko2Rating;
  glickoWhiteDelta: number;
  glickoBlackNew: Glicko2Rating;
  glickoBlackDelta: number;
  expectedWhiteWinProb: number;
}

/**
 * Determine Chess.com-style Provisional & FIDE Club Elo K-factor:
 * Early games carry high volatility so winning/losing your 1st games rapidly
 * places you toward your real strength before settling down:
 * - Games 1–2  (gamesPlayed < 2):  K = 160 (Opening Placement: ±80–96 on even match)
 * - Games 3–5  (gamesPlayed < 5):  K = 100 (Early Calibration: ±50–60 on even match)
 * - Games 6–9  (gamesPlayed < 10): K = 64  (Late Provisional: ±32–35 on even match)
 * - Games 10–29 (gamesPlayed < 30): K = 40 (Developing Player: ±20 on even match)
 * - Games 30+ & < 2400:            K = 20 (Established Player: ±10 on even match)
 * - Games 30+ & >= 2400:           K = 10 (Master Tier)
 */
export function getFideKFactor(rating: number, gamesPlayed: number): number {
  if (gamesPlayed < 2) return 160;
  if (gamesPlayed < 5) return 100;
  if (gamesPlayed < 10) return 64;
  if (gamesPlayed < 30) return 40;
  if (rating < 2400) return 20;
  return 10;
}

/**
 * Early-game win/loss result calibration (Chess.com placement curve):
 * In your first games, wins accelerate upward placement and losses drop faster
 * so new accounts settle cleanly instead of inching forward +/-10 pts.
 */
export function getEarlyGameResultMultiplier(
  gamesPlayed: number,
  score: MatchOutcome
): number {
  if (gamesPlayed < 5) {
    if (score === 1) return 1.2;
    if (score === 0) return 1.15;
    return 1.0;
  }
  if (gamesPlayed < 10) {
    if (score === 1) return 1.1;
    if (score === 0) return 1.05;
    return 1.0;
  }
  return 1.0;
}

export function getEarlyGamePhaseLabel(gamesPlayed: number): string {
  if (gamesPlayed < 2) return '1st Games Placement (High Swing)';
  if (gamesPlayed < 5) return 'Early Calibration (Games 3–5)';
  if (gamesPlayed < 10) return 'Late Provisional (Games 6–9)';
  if (gamesPlayed < 30) return 'Standard Club K=40';
  return 'Established K=20';
}

/**
 * Calculate Expected Score E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 */
export function calculateFideExpected(ratingA: number, ratingB: number): number {
  const diff = Math.max(-400, Math.min(400, ratingB - ratingA));
  return 1 / (1 + Math.pow(10, diff / 400));
}

/**
 * Calculate updated Elo rating (Rapid, Blitz, or Classical) with Chess.com-style
 * early-game provisional swings and MatchStakes multiplier
 */
export function calculateFideElo(
  ratingA: number,
  ratingB: number,
  scoreA: MatchOutcome,
  gamesPlayedA = 15,
  stakes: MatchStakes = 'competitive'
): { newRating: number; delta: number; expected: number; kFactor: number } {
  const baseK = getFideKFactor(ratingA, gamesPlayedA);
  const earlyResultMult = getEarlyGameResultMultiplier(gamesPlayedA, scoreA);
  const kFactor = Math.round(baseK * getStakesMultiplier(stakes) * earlyResultMult);
  const expected = calculateFideExpected(ratingA, ratingB);
  const rawDelta = kFactor * (scoreA - expected);
  const delta = Math.round(rawDelta * 10) / 10;
  const newRating = Math.max(100, Math.round(ratingA + delta));
  return {
    newRating,
    delta: newRating - ratingA,
    expected,
    kFactor,
  };
}

/**
 * Calculate single match Elo preview for White and Black
 */
export function previewEloMatch(
  whiteElo: number,
  blackElo: number,
  outcome: MatchOutcome,
  whiteGames = 15,
  blackGames = 15,
  stakes: MatchStakes = 'competitive'
): {
  whiteNew: number;
  whiteDelta: number;
  blackNew: number;
  blackDelta: number;
  expectedWhiteWinProb: number;
  effectiveKWhite: number;
  effectiveKBlack: number;
  isProvisionalMatch: boolean;
} {
  const scoreBlack: MatchOutcome = outcome === 1 ? 0 : outcome === 0 ? 1 : 0.5;
  const w = calculateFideElo(whiteElo, blackElo, outcome, whiteGames, stakes);
  const b = calculateFideElo(blackElo, whiteElo, scoreBlack, blackGames, stakes);
  return {
    whiteNew: w.newRating,
    whiteDelta: w.delta,
    blackNew: b.newRating,
    blackDelta: b.delta,
    expectedWhiteWinProb: Math.round(w.expected * 100),
    effectiveKWhite: w.kFactor,
    effectiveKBlack: b.kFactor,
    isProvisionalMatch: whiteGames < 10 || blackGames < 10,
  };
}

/**
 * Legacy Glicko-2 helper preserved for unit test compatibility
 */
export function calculateGlicko2Update(
  player: Glicko2Rating,
  opponent: Glicko2Rating,
  score: MatchOutcome
): { updated: Glicko2Rating; delta: number } {
  const SCALE = 173.7178;
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const muJ = (opponent.rating - 1500) / SCALE;
  const phiJ = opponent.rd / SCALE;

  const gPhiJ = 1 / Math.sqrt(1 + (3 * phiJ * phiJ) / (Math.PI * Math.PI));
  const eVal = 1 / (1 + Math.exp(-gPhiJ * (mu - muJ)));
  const v = 1 / (gPhiJ * gPhiJ * eVal * (1 - eVal));

  const deltaPerf = v * gPhiJ * (score - eVal);
  const newVol = Math.max(
    0.04,
    Math.min(0.09, Number((player.vol + Math.abs(deltaPerf) * 0.0005).toFixed(4)))
  );

  const phiStar = Math.sqrt(phi * phi + newVol * newVol);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * gPhiJ * (score - eVal);

  const newRating = Math.round(1500 + SCALE * newMu);
  const newRd = Math.max(35, Math.min(350, Math.round(SCALE * newPhi)));

  return {
    updated: {
      rating: newRating,
      rd: newRd,
      vol: newVol,
    },
    delta: newRating - player.rating,
  };
}

export function previewDualRatingMatch(
  whiteFide: number,
  blackFide: number,
  whiteGlicko: Glicko2Rating,
  blackGlicko: Glicko2Rating,
  outcome: MatchOutcome,
  whiteGames = 18,
  blackGames = 18
): RatingUpdatePreview {
  const scoreBlack: MatchOutcome = outcome === 1 ? 0 : outcome === 0 ? 1 : 0.5;
  const fideW = calculateFideElo(whiteFide, blackFide, outcome, whiteGames);
  const fideB = calculateFideElo(blackFide, whiteFide, scoreBlack, blackGames);
  const glickoW = calculateGlicko2Update(whiteGlicko, blackGlicko, outcome);
  const glickoB = calculateGlicko2Update(blackGlicko, whiteGlicko, scoreBlack);

  return {
    fideWhiteNew: fideW.newRating,
    fideWhiteDelta: fideW.delta,
    fideBlackNew: fideB.newRating,
    fideBlackDelta: fideB.delta,
    glickoWhiteNew: glickoW.updated,
    glickoWhiteDelta: glickoW.delta,
    glickoBlackNew: glickoB.updated,
    glickoBlackDelta: glickoB.delta,
    expectedWhiteWinProb: Math.round(fideW.expected * 100),
  };
}

const GENERIC_MATCH_LABELS = new Set([
  'campus library match',
  'friendly club match',
  'competitive club match',
  'championship tournament match',
  'friendly hangout match (result only)',
  'competitive club match (result only)',
]);

const OPENING_BOOK_PREFIXES: { moves: string[]; eco: string; name: string }[] = [
  { moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'], eco: 'B90', name: 'Sicilian Defense: Najdorf' },
  { moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'], eco: 'B70', name: 'Sicilian Defense: Dragon' },
  { moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4'], eco: 'B32', name: 'Sicilian Defense: Open' },
  { moves: ['e4', 'c5', 'c3'], eco: 'B22', name: 'Sicilian Defense: Alapin' },
  { moves: ['e4', 'c5', 'Nc3'], eco: 'B23', name: 'Sicilian Defense: Closed' },
  { moves: ['e4', 'c5'], eco: 'B20', name: 'Sicilian Defense' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], eco: 'C78', name: 'Ruy Lopez: Morphy Defense' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], eco: 'C60', name: 'Ruy Lopez' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'], eco: 'C51', name: 'Italian Game: Evans Gambit' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], eco: 'C50', name: 'Italian Game: Giuoco Piano' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], eco: 'C55', name: 'Italian Game: Two Knights Defense' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], eco: 'C50', name: 'Italian Game' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], eco: 'C44', name: 'Scotch Game' },
  { moves: ['e4', 'e5', 'Nf3', 'Nf6'], eco: 'C42', name: 'Petrov’s Defense' },
  { moves: ['e4', 'e5', 'Nc3'], eco: 'C25', name: 'Vienna Game' },
  { moves: ['e4', 'e5', 'f4'], eco: 'C30', name: 'King’s Gambit' },
  { moves: ['e4', 'e5', 'Bc4'], eco: 'C23', name: 'Bishop’s Opening' },
  { moves: ['e4', 'e5', 'Nf3'], eco: 'C40', name: 'King’s Knight Opening' },
  { moves: ['e4', 'c6', 'd4', 'd5'], eco: 'B12', name: 'Caro-Kann Defense' },
  { moves: ['e4', 'c6'], eco: 'B10', name: 'Caro-Kann Defense' },
  { moves: ['e4', 'e6', 'd4', 'd5'], eco: 'C01', name: 'French Defense' },
  { moves: ['e4', 'e6'], eco: 'C00', name: 'French Defense' },
  { moves: ['e4', 'd5'], eco: 'B01', name: 'Scandinavian Defense' },
  { moves: ['e4', 'd6'], eco: 'B07', name: 'Pirc Defense' },
  { moves: ['e4', 'g6'], eco: 'B06', name: 'Modern Defense' },
  { moves: ['e4', 'Nf6'], eco: 'B02', name: 'Alekhine’s Defense' },
  { moves: ['d4', 'd5', 'c4', 'c6'], eco: 'D10', name: 'Slav Defense' },
  { moves: ['d4', 'd5', 'c4', 'e6'], eco: 'D30', name: 'Queen’s Gambit Declined' },
  { moves: ['d4', 'd5', 'c4', 'dxc4'], eco: 'D20', name: 'Queen’s Gambit Accepted' },
  { moves: ['d4', 'd5', 'c4'], eco: 'D06', name: 'Queen’s Gambit' },
  { moves: ['d4', 'd5', 'Bf4'], eco: 'D02', name: 'London System' },
  { moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'], eco: 'D02', name: 'London System' },
  { moves: ['d4', 'Nf6', 'Nf3', 'd5', 'Bf4'], eco: 'D02', name: 'London System' },
  { moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'], eco: 'D80', name: 'Grünfeld Defense' },
  { moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'], eco: 'E60', name: 'King’s Indian Defense' },
  { moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], eco: 'E20', name: 'Nimzo-Indian Defense' },
  { moves: ['d4', 'Nf6', 'c4', 'e6', 'g3'], eco: 'E01', name: 'Catalan Opening' },
  { moves: ['d4', 'f5'], eco: 'A80', name: 'Dutch Defense' },
  { moves: ['d4', 'Nf6'], eco: 'A45', name: 'Indian Game' },
  { moves: ['d4', 'd5'], eco: 'D00', name: 'Queen’s Pawn Game' },
  { moves: ['c4'], eco: 'A10', name: 'English Opening' },
  { moves: ['Nf3'], eco: 'A04', name: 'Réti Opening' },
  { moves: ['f4'], eco: 'A02', name: 'Bird’s Opening' },
];

export function detectOpeningFromPgn(
  pgn?: string,
  hintName?: string
): { name: string; eco: string } | null {
  const cleanPgn = (pgn || '').trim();
  if (cleanPgn && !cleanPgn.startsWith('Result Only')) {
    const openingTag = cleanPgn.match(/\[Opening\s+"([^"]+)"\]/i)?.[1]?.trim();
    const ecoTag = cleanPgn.match(/\[ECO\s+"([^"]+)"\]/i)?.[1]?.trim();
    if (openingTag) {
      return { name: openingTag, eco: ecoTag || 'ECO' };
    }

    try {
      const chess = new Chess();
      chess.loadPgn(cleanPgn);
      const history = chess.history();
      if (history.length > 0) {
        for (const entry of OPENING_BOOK_PREFIXES) {
          if (
            history.length >= entry.moves.length &&
            entry.moves.every((mv, i) => history[i] === mv)
          ) {
            return { name: entry.name, eco: entry.eco };
          }
        }
        return { name: `1. ${history[0]} Opening`, eco: 'OTB' };
      }
    } catch {
      // ignore invalid PGN and fall back to hint check
    }
  }

  const cleanHint = (hintName || '').trim();
  if (
    cleanHint &&
    !GENERIC_MATCH_LABELS.has(cleanHint.toLowerCase()) &&
    !cleanHint.toLowerCase().endsWith(' match') &&
    !cleanHint.toLowerCase().endsWith(' official match')
  ) {
    const ecoMatch = cleanHint.match(/\(([A-E]\d{2})\)/i);
    return {
      name: cleanHint,
      eco: ecoMatch ? ecoMatch[1].toUpperCase() : 'OTB',
    };
  }

  return null;
}

export type TournamentFormat =
  | 'swiss'
  | 'knockout'
  | 'double_elimination'
  | 'round_robin'
  | 'double_round_robin'
  | 'scheveningen'
  | 'arena';

export interface TournamentMatch {
  id: string;
  round: number;
  stageLabel?: string;
  bracketCode?: string;
  bracketSlotIndex?: number;
  nextMatchId?: string;
  nextMatchSlot?: 'white' | 'black';
  loserNextMatchId?: string;
  loserNextMatchSlot?: 'white' | 'black';
  isDualAdvanceSeeding?: boolean;
  whiteId: string;
  blackId: string;
  result: '1-0' | '1/2-1/2' | '0-1' | null;
  pgn?: string;
  gameId?: string;
}

export interface SwissStandingRow {
  memberId: string;
  name: string;
  department: string;
  rating: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  buchholz: number;
  sonnebornBerger: number;
}

export function calculateSwissStandings(
  players: { id: string; name: string; department: string; rating: number }[],
  matches: TournamentMatch[]
): SwissStandingRow[] {
  const map = new Map<
    string,
    {
      memberId: string;
      name: string;
      department: string;
      rating: number;
      points: number;
      played: number;
      wins: number;
      draws: number;
      losses: number;
      opponents: { id: string; scoreAgainst: number }[];
    }
  >();

  for (const p of players) {
    map.set(p.id, {
      memberId: p.id,
      name: p.name,
      department: p.department,
      rating: p.rating,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      opponents: [],
    });
  }

  for (const m of matches) {
    if (!m.result) continue;
    const w = map.get(m.whiteId);
    const b = map.get(m.blackId);
    if (!w || !b) continue;

    w.played += 1;
    b.played += 1;

    if (m.result === '1-0') {
      w.points += 1;
      w.wins += 1;
      b.losses += 1;
      w.opponents.push({ id: b.memberId, scoreAgainst: 1 });
      b.opponents.push({ id: w.memberId, scoreAgainst: 0 });
    } else if (m.result === '0-1') {
      b.points += 1;
      b.wins += 1;
      w.losses += 1;
      w.opponents.push({ id: b.memberId, scoreAgainst: 0 });
      b.opponents.push({ id: w.memberId, scoreAgainst: 1 });
    } else {
      w.points += 0.5;
      b.points += 0.5;
      w.draws += 1;
      b.draws += 1;
      w.opponents.push({ id: b.memberId, scoreAgainst: 0.5 });
      b.opponents.push({ id: w.memberId, scoreAgainst: 0.5 });
    }
  }

  const rows: SwissStandingRow[] = [];
  for (const entry of map.values()) {
    let buchholz = 0;
    let sb = 0;
    for (const opp of entry.opponents) {
      const oppEntry = map.get(opp.id);
      if (oppEntry) {
        buchholz += oppEntry.points;
        sb += oppEntry.points * opp.scoreAgainst;
      }
    }
    rows.push({
      memberId: entry.memberId,
      name: entry.name,
      department: entry.department,
      rating: entry.rating,
      points: entry.points,
      played: entry.played,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      buchholz: Math.round(buchholz * 100) / 100,
      sonnebornBerger: Math.round(sb * 100) / 100,
    });
  }

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
    return b.rating - a.rating;
  });

  return rows;
}

export function generateNextSwissPairings(
  standings: SwissStandingRow[],
  existingMatches: TournamentMatch[],
  nextRoundNumber: number
): TournamentMatch[] {
  const playedSet = new Set<string>();
  for (const m of existingMatches) {
    playedSet.add(`${m.whiteId}-${m.blackId}`);
    playedSet.add(`${m.blackId}-${m.whiteId}`);
  }

  const unpaired = [...standings];
  const pairings: TournamentMatch[] = [];
  let idx = 1;

  while (unpaired.length >= 2) {
    const first = unpaired.shift()!;
    let partnerIndex = unpaired.findIndex(
      (candidate) => !playedSet.has(`${first.memberId}-${candidate.memberId}`)
    );
    if (partnerIndex === -1) partnerIndex = 0;
    const second = unpaired.splice(partnerIndex, 1)[0];

    const whiteFirst = (nextRoundNumber + idx) % 2 === 0;
    pairings.push({
      id: `swiss-r${nextRoundNumber}-m${idx}-${Date.now()}`,
      round: nextRoundNumber,
      stageLabel: `Swiss Round ${nextRoundNumber}`,
      whiteId: whiteFirst ? first.memberId : second.memberId,
      blackId: whiteFirst ? second.memberId : first.memberId,
      result: null,
    });
    idx++;
  }

  return pairings;
}

/**
 * Automatically advances the winner (and runner-up for Dual-Advance Seeding matches)
 * of an elimination bracket match into the next round's slot.
 */
export function advanceEliminationBracket(
  matches: TournamentMatch[],
  updatedMatchId: string,
  result: '1-0' | '1/2-1/2' | '0-1',
  pgn: string,
  gameId?: string
): TournamentMatch[] {
  let updatedList = matches.map((m) =>
    m.id === updatedMatchId ? { ...m, result, pgn, gameId: gameId || m.gameId } : { ...m }
  );

  const targetMatch = updatedList.find((m) => m.id === updatedMatchId);
  if (!targetMatch) return updatedList;

  const winnerId = result === '0-1' ? targetMatch.blackId : targetMatch.whiteId;
  const loserId = result === '0-1' ? targetMatch.whiteId : targetMatch.blackId;
  if (!winnerId || winnerId === 'TBD') return updatedList;

  // If this is a Dual-Advance Seeding match, also advance the runner-up into loserNextMatchId
  if (
    targetMatch.loserNextMatchId &&
    targetMatch.loserNextMatchSlot &&
    loserId &&
    loserId !== 'TBD'
  ) {
    updatedList = updatedList.map((m) => {
      if (m.id !== targetMatch.loserNextMatchId) return m;
      return targetMatch.loserNextMatchSlot === 'white'
        ? { ...m, whiteId: loserId }
        : { ...m, blackId: loserId };
    });
  }

  // 1. Explicit nextMatchId linkage for winner
  if (targetMatch.nextMatchId && targetMatch.nextMatchSlot) {
    return updatedList.map((m) => {
      if (m.id !== targetMatch.nextMatchId) return m;
      return targetMatch.nextMatchSlot === 'white'
        ? { ...m, whiteId: winnerId }
        : { ...m, blackId: winnerId };
    });
  }

  // 2. Fallback positional bracket advancement (round R slot S -> round R+1 slot floor(S/2))
  const currentRoundMatches = updatedList.filter((m) => m.round === targetMatch.round);
  const slotIdx =
    targetMatch.bracketSlotIndex !== undefined
      ? targetMatch.bracketSlotIndex
      : currentRoundMatches.findIndex((m) => m.id === targetMatch.id);

  if (slotIdx < 0) return updatedList;

  const nextRoundMatches = updatedList.filter((m) => m.round === targetMatch.round + 1);
  const targetNextIdx = Math.floor(slotIdx / 2);
  const nextMatch = nextRoundMatches[targetNextIdx];
  if (!nextMatch) return updatedList;

  const isWhiteSlot = slotIdx % 2 === 0;
  return updatedList.map((m) => {
    if (m.id !== nextMatch.id) return m;
    return isWhiteSlot ? { ...m, whiteId: winnerId } : { ...m, blackId: winnerId };
  });
}

/**
 * Helper describing how any player count N (including non-power-of-2 like 13 players)
 * is structured in an Elimination tournament so everyone plays with an equal chance.
 */
export function describeEliminationStructure(playerCount: number): {
  isPowerOfTwo: boolean;
  mainBracketSize: number;
  totalBracketRounds: number;
  playInEliminationGames: number;
  dualAdvanceSeedingGames: number;
  oddPlayerByes: number;
  summaryText: string;
} {
  if (playerCount < 2) {
    return {
      isPowerOfTwo: false,
      mainBracketSize: 2,
      totalBracketRounds: 1,
      playInEliminationGames: 0,
      dualAdvanceSeedingGames: 0,
      oddPlayerByes: 0,
      summaryText: 'Select at least 2 players to generate a bracket.',
    };
  }

  const logFloor = Math.floor(Math.log2(playerCount));
  const M = Math.pow(2, logFloor);
  const isPowerOfTwo = M === playerCount;

  if (isPowerOfTwo) {
    const totalBracketRounds = logFloor;
    return {
      isPowerOfTwo: true,
      mainBracketSize: M,
      totalBracketRounds,
      playInEliminationGames: 0,
      dualAdvanceSeedingGames: 0,
      oddPlayerByes: 0,
      summaryText: `Exact Power-of-2 (${playerCount} Players): Standard ${totalBracketRounds}-Round Elimination Bracket where all ${playerCount} players start directly in the main bracket.`,
    };
  }

  const E = playerCount - M; // Extra players to eliminate in Round 1 Play-In
  const R = M - E; // Remaining players who need seeding into the M-player Main Bracket
  const dualAdvanceSeedingGames = Math.floor(R / 2);
  const oddPlayerByes = R % 2;
  const totalBracketRounds = logFloor + 1; // +1 for Round 1 Play-In & Seeding stage
  const activeR1Players = 2 * E + 2 * dualAdvanceSeedingGames;

  return {
    isPowerOfTwo: false,
    mainBracketSize: M,
    totalBracketRounds,
    playInEliminationGames: E,
    dualAdvanceSeedingGames,
    oddPlayerByes,
    summaryText: `Fair Non-Power-of-2 Solution (${playerCount} Players → ${M}-Player Main Bracket): Round 1 pairs ${activeR1Players} players across ${E} Play-In Elimination game${
      E > 1 ? 's' : ''
    }${
      dualAdvanceSeedingGames > 0
        ? ` + ${dualAdvanceSeedingGames} Dual-Advance Seeding game${
            dualAdvanceSeedingGames > 1 ? 's' : ''
          } (both players advance to seed spots)`
        : ''
    }${
      oddPlayerByes > 0 ? ' + 1 odd-number seed slot in Round 2' : ''
    }, feeding cleanly into the ${M}-Player Main Knockout Bracket (${totalBracketRounds} rounds total)!`,
  };
}

/**
 * Automated Computer Pairing Generator when an Admin creates a new Tournament.
 * Supports custom round counts and fair Play-In + Dual-Advance Seeding for non-power-of-2 elimination player counts.
 */
export function generateAutomatedTournamentMatches(
  format: TournamentFormat,
  players: { id: string; rating: number }[],
  customRounds?: number
): TournamentMatch[] {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const n = sorted.length;
  if (n < 2) return [];

  if (format === 'swiss') {
    const half = Math.floor(n / 2);
    const matches: TournamentMatch[] = [];
    for (let i = 0; i < half; i++) {
      const topSeed = sorted[i];
      const bottomSeed = sorted[i + half];
      const topIsWhite = i % 2 === 0;
      matches.push({
        id: `auto-sw-r1-m${i + 1}-${Date.now()}`,
        round: 1,
        stageLabel: 'Swiss Round 1 (FIDE Dutch Seeded)',
        whiteId: topIsWhite ? topSeed.id : bottomSeed.id,
        blackId: topIsWhite ? bottomSeed.id : topSeed.id,
        result: null,
      });
    }
    return matches;
  }

  if (format === 'knockout' || format === 'double_elimination') {
    const ts = Date.now();
    const logFloor = Math.floor(Math.log2(n));
    const M = Math.pow(2, logFloor); // Main power-of-2 bracket size (2, 4, 8, 16, ...)
    const isPowerOfTwo = M === n;
    const roundOffset = isPowerOfTwo ? 0 : 1; // If non-power-of-2, Round 1 is Play-In & Seeding, Main Bracket starts at Round 2
    const mainRoundsCount = logFloor; // e.g. M=8 -> 3 rounds (QF, SF, Final)

    const getStageInfo = (matchesInRound: number) => {
      if (matchesInRound === 1) return { stageLabel: 'Final', prefix: 'Final' };
      if (matchesInRound === 2) return { stageLabel: 'Semi-Final', prefix: 'SF' };
      if (matchesInRound === 4) return { stageLabel: 'Quarter-Final', prefix: 'QF' };
      if (matchesInRound === 8) return { stageLabel: 'Round of 16', prefix: 'R16' };
      return { stageLabel: `Round of ${matchesInRound * 2}`, prefix: `R${matchesInRound * 2}` };
    };

    // Build Main Power-of-2 Bracket rounds (from M/2 matches down to 1 Final match)
    const mainRounds: TournamentMatch[][] = [];
    for (let rIdx = 0; rIdx < mainRoundsCount; rIdx++) {
      const matchesInRound = M / Math.pow(2, rIdx + 1);
      const roundNum = roundOffset + rIdx + 1;
      const { stageLabel, prefix } = getStageInfo(matchesInRound);
      const roundArr: TournamentMatch[] = [];

      for (let mIdx = 0; mIdx < matchesInRound; mIdx++) {
        roundArr.push({
          id: `ko-r${roundNum}-m${mIdx + 1}-${ts}`,
          round: roundNum,
          stageLabel,
          bracketCode:
            matchesInRound === 1 ? 'Final' : `${prefix} · Game ${mIdx + 1}`,
          bracketSlotIndex: mIdx,
          whiteId: 'TBD',
          blackId: 'TBD',
          result: null,
        });
      }
      mainRounds.push(roundArr);
    }

    // Wire nextMatchId and nextMatchSlot between main bracket rounds
    for (let rIdx = 0; rIdx < mainRounds.length - 1; rIdx++) {
      const currRound = mainRounds[rIdx];
      const nextRound = mainRounds[rIdx + 1];
      currRound.forEach((m, idx) => {
        const targetNext = nextRound[Math.floor(idx / 2)];
        if (targetNext) {
          m.nextMatchId = targetNext.id;
          m.nextMatchSlot = idx % 2 === 0 ? 'white' : 'black';
        }
      });
    }

    const firstMainRound = mainRounds[0];
    // List all M slots in the first main round: [ { match, slot: 'white' | 'black' }, ... ]
    // Order slots so white slots are filled first with top seeds / seeding winners, and black slots with play-in winners
    const mainEntrySlots: { match: TournamentMatch; slot: 'white' | 'black' }[] = [];
    firstMainRound.forEach((m) => {
      mainEntrySlots.push({ match: m, slot: 'white' });
    });
    firstMainRound.forEach((m) => {
      mainEntrySlots.push({ match: m, slot: 'black' });
    });

    if (isPowerOfTwo) {
      // Exact power-of-2: place all M players directly into firstMainRound with balanced seeding
      for (let i = 0; i < M / 2; i++) {
        firstMainRound[i].whiteId = sorted[i].id;
        firstMainRound[i].blackId = sorted[M - 1 - i].id;
      }
      return mainRounds.flat();
    }

    // NON-POWER-OF-2 (e.g., 13 players -> M = 8, E = 5 extra players, R = 3 remaining top seeds)
    // Everyone plays in Round 1 (Play-In Elimination + Dual-Advance Seeding)!
    const E = n - M; // Number of Play-In Elimination matches (2*E players)
    const R = M - E; // Remaining players (top seeds)
    const topRPlayers = sorted.slice(0, R);
    const playInPool = sorted.slice(R); // 2*E players

    const round1Matches: TournamentMatch[] = [];
    let slotCursor = 0;
    let r1GameNumber = 1;

    // 1. If R is odd (when N is odd, e.g. 13 players), 1 top seed is placed into the first Main Bracket slot
    let seedingPool = [...topRPlayers];
    if (seedingPool.length % 2 === 1) {
      const oddSeedPlayer = seedingPool.shift()!;
      const targetSlot = mainEntrySlots[slotCursor++];
      if (targetSlot.slot === 'white') {
        targetSlot.match.whiteId = oddSeedPlayer.id;
      } else {
        targetSlot.match.blackId = oddSeedPlayer.id;
      }
    }

    // 2. Pair all remaining top seeds in Dual-Advance Seeding Matches so they also play in Round 1!
    // Both winner and runner-up advance to the Main Bracket (winner gets higher slot, runner-up gets second slot)
    const numSeedingMatches = Math.floor(seedingPool.length / 2);
    for (let i = 0; i < numSeedingMatches; i++) {
      const pWhite = seedingPool[i];
      const pBlack = seedingPool[seedingPool.length - 1 - i];
      const winnerSlot = mainEntrySlots[slotCursor++];
      const loserSlot = mainEntrySlots[slotCursor++];

      round1Matches.push({
        id: `ko-r1-seed-${r1GameNumber}-${ts}`,
        round: 1,
        stageLabel: 'Play-In & Seeding Round',
        bracketCode: `Seeding · Game ${r1GameNumber} (Both Advance)`,
        bracketSlotIndex: r1GameNumber - 1,
        isDualAdvanceSeeding: true,
        nextMatchId: winnerSlot.match.id,
        nextMatchSlot: winnerSlot.slot,
        loserNextMatchId: loserSlot.match.id,
        loserNextMatchSlot: loserSlot.slot,
        whiteId: pWhite.id,
        blackId: pBlack.id,
        result: null,
      });
      r1GameNumber++;
    }

    // 3. Pair the 2*E Play-In players in E Play-In Elimination Matches
    // Each winner advances into one of the remaining E slots in the Main Bracket!
    for (let i = 0; i < E; i++) {
      const pWhite = playInPool[i];
      const pBlack = playInPool[playInPool.length - 1 - i];
      const targetSlot = mainEntrySlots[slotCursor++];

      round1Matches.push({
        id: `ko-r1-playin-${r1GameNumber}-${ts}`,
        round: 1,
        stageLabel: 'Play-In & Seeding Round',
        bracketCode: `Play-In · Game ${r1GameNumber}`,
        bracketSlotIndex: r1GameNumber - 1,
        nextMatchId: targetSlot.match.id,
        nextMatchSlot: targetSlot.slot,
        whiteId: pWhite.id,
        blackId: pBlack.id,
        result: null,
      });
      r1GameNumber++;
    }

    return [...round1Matches, ...mainRounds.flat()];
  }

  if (format === 'scheveningen') {
    const half = Math.max(1, Math.floor(n / 2));
    const teamA = sorted.slice(0, half);
    const teamB = sorted.slice(half);
    const matches: TournamentMatch[] = [];
    let matchCounter = 1;
    const totalR = customRounds && customRounds >= 1 ? customRounds : teamB.length;

    for (let r = 0; r < totalR; r++) {
      for (let i = 0; i < teamA.length; i++) {
        const playerA = teamA[i];
        const playerB = teamB[(i + r) % teamB.length];
        const aIsWhite = (r + i) % 2 === 0;
        matches.push({
          id: `auto-sch-r${r + 1}-m${matchCounter++}-${Date.now()}`,
          round: r + 1,
          stageLabel: `Scheveningen Team Clash — Round ${r + 1}`,
          whiteId: aIsWhite ? playerA.id : playerB.id,
          blackId: aIsWhite ? playerB.id : playerA.id,
          result: null,
        });
      }
    }
    return matches;
  }

  if (format === 'arena') {
    const totalWaves = customRounds && customRounds >= 1 ? customRounds : 3;
    const matches: TournamentMatch[] = [];
    let matchCounter = 1;
    const half = Math.floor(n / 2);
    for (let wave = 1; wave <= totalWaves; wave++) {
      for (let i = 0; i < half; i++) {
        const idxA = (i + wave - 1) % n;
        const idxB = (n - 1 - i + wave - 1) % n;
        if (idxA !== idxB) {
          const whiteFirst = (wave + i) % 2 === 0;
          matches.push({
            id: `auto-arena-w${wave}-m${matchCounter++}-${Date.now()}`,
            round: wave,
            stageLabel: `Arena Pairing Wave ${wave}`,
            whiteId: whiteFirst ? sorted[idxA].id : sorted[idxB].id,
            blackId: whiteFirst ? sorted[idxB].id : sorted[idxA].id,
            result: null,
          });
        }
      }
    }
    return matches;
  }

  // Round Robin (Single or Double Candidates Home & Away)
  const list = [...sorted.map((p) => p.id)];
  if (list.length % 2 !== 0) {
    list.push('BYE');
  }
  const numPlayers = list.length;
  const baseCycleRounds = numPlayers - 1;
  const half = numPlayers / 2;
  const matches: TournamentMatch[] = [];
  let matchCounter = 1;

  const targetRounds =
    customRounds && customRounds >= 1
      ? customRounds
      : format === 'double_round_robin'
      ? baseCycleRounds * 2
      : baseCycleRounds;

  const rotating = [...list];
  for (let round = 1; round <= targetRounds; round++) {
    const isSecondCycle = round > baseCycleRounds;
    for (let i = 0; i < half; i++) {
      const p1 = rotating[i];
      const p2 = rotating[numPlayers - 1 - i];
      if (p1 !== 'BYE' && p2 !== 'BYE') {
        const flip = ((round + i) % 2 === 0) !== isSecondCycle;
        matches.push({
          id: `auto-rr-r${round}-m${matchCounter++}-${Date.now()}`,
          round,
          stageLabel:
            format === 'double_round_robin'
              ? `Candidates Cycle ${isSecondCycle ? '2' : '1'} — Round ${round}`
              : `Round Robin — Round ${round}`,
          whiteId: flip ? p1 : p2,
          blackId: flip ? p2 : p1,
          result: null,
        });
      }
    }
    const last = rotating.pop()!;
    rotating.splice(1, 0, last);
  }

  return matches;
}

/**
 * Parse a FEN piece placement field into an 8x8 array of piece codes ('wK', 'bQ', etc. or null)
 */
export function parseFenBoard(fenPlacement: string): (string | null)[][] {
  const rows = fenPlacement.split(' ')[0].split('/');
  const board: (string | null)[][] = [];

  for (let r = 0; r < 8; r++) {
    const rowStr = rows[r] || '8';
    const rowArr: (string | null)[] = [];
    for (const ch of rowStr) {
      if (ch >= '1' && ch <= '8') {
        const count = parseInt(ch, 10);
        for (let k = 0; k < count; k++) rowArr.push(null);
      } else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        const piece = ch.toUpperCase();
        rowArr.push(`${color}${piece}`);
      }
    }
    while (rowArr.length < 8) rowArr.push(null);
    board.push(rowArr.slice(0, 8));
  }
  return board;
}

/**
 * Lightweight Stockfish-Style PeSTO + Alpha-Beta Minimax Evaluation (Depth 2)
 * Computes White advantage in pawns (e.g. +0.45, -1.80) and best legal continuation move.
 */
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 27, 27, 10, 5, 5],
  [0, 0, 0, 25, 25, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -25, -25, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 5, 5, 15, 15, 5, 5, -10],
  [-10, 0, 15, 15, 15, 15, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

function staticEvaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -9900 : 9900;
  }
  if (chess.isDraw()) return 0;

  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      const base = PIECE_VALUES[cell.type] || 0;
      const tableRow = cell.color === 'w' ? r : 7 - r;
      let positional = 0;
      if (cell.type === 'p') positional = PAWN_PST[tableRow][c];
      else if (cell.type === 'n') positional = KNIGHT_PST[tableRow][c];
      else if (cell.type === 'b' || cell.type === 'q') positional = BISHOP_PST[tableRow][c];
      else if (cell.type === 'r') positional = tableRow === 1 ? 25 : 0;

      if (cell.color === 'w') {
        score += base + positional;
      } else {
        score -= base + positional;
      }
    }
  }
  return score;
}

export function evaluateFenPosition(fen: string): {
  evalPawns: number;
  bestMoveSan: string;
  isMate: boolean;
} {
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        return {
          evalPawns: chess.turn() === 'w' ? -99 : 99,
          bestMoveSan: 'Checkmate',
          isMate: true,
        };
      }
      return { evalPawns: 0, bestMoveSan: 'Draw', isMate: false };
    }

    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) {
      return { evalPawns: 0, bestMoveSan: '-', isMate: false };
    }

    const isWhiteTurn = chess.turn() === 'w';
    let bestMove = moves[0].san;
    let bestScore = isWhiteTurn ? -Infinity : Infinity;

    // Prioritize captures and checks for alpha-beta pruning efficiency
    const sortedMoves = [...moves].sort((a, b) => (b.captured ? 10 : 0) - (a.captured ? 10 : 0));

    for (const move of sortedMoves.slice(0, 28)) {
      chess.move(move);
      let replyBest = staticEvaluateBoard(chess);

      // Stand-pat Quiescence Search: only consider opponent captures if they improve the opponent's score over standing pat
      const replies = chess
        .moves({ verbose: true })
        .filter((m) => m.captured)
        .slice(0, 10);

      for (const rep of replies) {
        chess.move(rep);
        const sc = staticEvaluateBoard(chess);
        chess.undo();
        if (isWhiteTurn) {
          if (sc < replyBest) replyBest = sc;
        } else {
          if (sc > replyBest) replyBest = sc;
        }
      }

      chess.undo();

      if (isWhiteTurn) {
        if (replyBest > bestScore) {
          bestScore = replyBest;
          bestMove = move.san;
        }
      } else {
        if (replyBest < bestScore) {
          bestScore = replyBest;
          bestMove = move.san;
        }
      }
    }

    const evalPawns = Math.max(-15, Math.min(15, Math.round((bestScore / 100) * 100) / 100));
    return {
      evalPawns,
      bestMoveSan: bestMove,
      isMate: Math.abs(bestScore) > 9000,
    };
  } catch {
    return { evalPawns: 0.2, bestMoveSan: '-', isMate: false };
  }
}
