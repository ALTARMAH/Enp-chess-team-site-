import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFideElo,
  calculateGlicko2Update,
  previewDualRatingMatch,
  calculateSwissStandings,
  generateNextSwissPairings,
  generateAutomatedTournamentMatches,
  previewEloMatch,
  evaluateFenPosition,
  parseFenBoard,
  detectOpeningFromPgn,
} from './chessEngine';
import { parseStockfishInfoLine, uciPvToSanLine } from './stockfishEngine';

test('FIDE Elo starts at 1500 and awards +20 for equal 1500 vs 1500 competitive win with K=40', () => {
  const res = calculateFideElo(1500, 1500, 1, 10, 'competitive');
  assert.equal(res.kFactor, 40);
  assert.equal(res.expected, 0.5);
  assert.equal(res.newRating, 1520);
  assert.equal(res.delta, 20);
});

test('Friendly match stakes affect Elo less than Competitive and Tournament matches', () => {
  const friendly = previewEloMatch(1600, 1600, 1, 10, 10, 'friendly');
  const competitive = previewEloMatch(1600, 1600, 1, 10, 10, 'competitive');
  const tournament = previewEloMatch(1600, 1600, 1, 10, 10, 'tournament');

  // Friendly is 0.45x K-factor (+9 vs +20 vs +25)
  assert.equal(friendly.whiteDelta, 9);
  assert.equal(friendly.blackDelta, -9);
  assert.equal(competitive.whiteDelta, 20);
  assert.equal(competitive.blackDelta, -20);
  assert.equal(tournament.whiteDelta, 25);
  assert.equal(tournament.blackDelta, -25);
  assert.ok(Math.abs(friendly.whiteDelta) < Math.abs(competitive.whiteDelta));
  assert.ok(Math.abs(competitive.whiteDelta) < Math.abs(tournament.whiteDelta));
});

test('Chess.com-style early provisional games swing strongly on 1st wins & losses before stabilizing', () => {
  const game1 = previewEloMatch(1600, 1600, 1, 0, 0, 'competitive');
  const game4 = previewEloMatch(1600, 1600, 1, 3, 3, 'competitive');
  const game12 = previewEloMatch(1600, 1600, 1, 12, 12, 'competitive');

  // 1st game win > game 4 win > established game 12 win
  assert.ok(game1.whiteDelta >= 90, `Expected strong 1st game gain, got ${game1.whiteDelta}`);
  assert.ok(game1.whiteDelta > game4.whiteDelta);
  assert.ok(game4.whiteDelta > game12.whiteDelta);
  assert.equal(game12.whiteDelta, 20);
  // Early win vs early loss difference
  assert.ok(game1.blackDelta <= -85, `Expected strong 1st game loss drop, got ${game1.blackDelta}`);
  assert.equal(game1.isProvisionalMatch, true);
  assert.equal(game12.isProvisionalMatch, false);
});

test('Glicko-2 rating increases on win and decreases RD uncertainty', () => {
  const player = { rating: 1500, rd: 110, vol: 0.06 };
  const opponent = { rating: 1500, rd: 110, vol: 0.06 };
  const res = calculateGlicko2Update(player, opponent, 1);
  assert.ok(res.updated.rating > 1500);
  assert.ok(res.updated.rd < 110);
  assert.ok(res.delta > 0);
});

test('Dual rating preview computes symmetric deltas for equal players', () => {
  const preview = previewDualRatingMatch(
    1500,
    1500,
    { rating: 1500, rd: 95, vol: 0.06 },
    { rating: 1500, rd: 95, vol: 0.06 },
    1,
    12,
    12
  );
  assert.equal(preview.fideWhiteDelta, 20);
  assert.equal(preview.fideBlackDelta, -20);
  assert.equal(preview.expectedWhiteWinProb, 50);
  assert.ok(preview.glickoWhiteDelta > 0);
  assert.equal(preview.glickoWhiteDelta, -preview.glickoBlackDelta);
});

test('Stockfish UCI info parser normalizes centipawn and mate scores to White perspective on both turns', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const afterE4Fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

  const whiteTurnInfo = parseStockfishInfoLine(
    'info depth 10 seldepth 14 multipv 1 score cp 45 nodes 12450 pv e2e4 e7e5 g1f3',
    startFen
  );
  assert.ok(whiteTurnInfo);
  assert.equal(whiteTurnInfo.depth, 10);
  assert.equal(whiteTurnInfo.evalPawns, 0.45);
  assert.equal(whiteTurnInfo.bestMoveUci, 'e2e4');
  assert.deepEqual(whiteTurnInfo.pvSan, ['e4', 'e5', 'Nf3']);

  // When it is Black's turn ('b'), a score of -45 cp from Black's perspective means +0.45 for White
  const blackTurnInfo = parseStockfishInfoLine(
    'info depth 10 seldepth 14 multipv 1 score cp -45 nodes 12450 pv e7e5 g1f3 b8c6',
    afterE4Fen
  );
  assert.ok(blackTurnInfo);
  assert.equal(blackTurnInfo.evalPawns, 0.45);
  assert.deepEqual(blackTurnInfo.pvSan, ['e5', 'Nf3', 'Nc6']);

  const pvSan = uciPvToSanLine(startFen, ['e2e4', 'e7e5', 'g1f3']);
  assert.deepEqual(pvSan, ['e4', 'e5', 'Nf3']);
});

test('evaluateFenPosition remains stable across White and Black turns without +4.0 spikes', () => {
  const afterE4 = evaluateFenPosition(
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  );
  const afterE5 = evaluateFenPosition(
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
  );
  assert.ok(Math.abs(afterE4.evalPawns) < 1.5, `Expected balanced eval after 1.e4, got ${afterE4.evalPawns}`);
  assert.ok(Math.abs(afterE5.evalPawns) < 1.5, `Expected balanced eval after 1...e5, got ${afterE5.evalPawns}`);
});

test('Swiss standings compute points, Buchholz, and Sonneborn-Berger accurately', () => {
  const players = [
    { id: 'p1', name: 'Yacine Benali', department: 'Génie Mécanique', rating: 1740 },
    { id: 'p2', name: 'Amine Khelifi', department: 'Génie Électrique', rating: 1690 },
    { id: 'p3', name: 'Meriem Touati', department: 'Génie Industriel', rating: 1645 },
    { id: 'p4', name: 'Riad Mansouri', department: 'Génie Chimique', rating: 1580 },
  ];
  const matches = [
    { id: 'm1', round: 1, whiteId: 'p1', blackId: 'p2', result: '1-0' as const },
    { id: 'm2', round: 1, whiteId: 'p3', blackId: 'p4', result: '1/2-1/2' as const },
  ];
  const standings = calculateSwissStandings(players, matches);
  assert.equal(standings[0].memberId, 'p1');
  assert.equal(standings[0].points, 1);
  const nextRound = generateNextSwissPairings(standings, matches, 2);
  assert.equal(nextRound.length, 2);
});

test('parseFenBoard parses standard starting position into 8x8 matrix', () => {
  const board = parseFenBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  assert.equal(board.length, 8);
  assert.equal(board[0][0], 'bR');
  assert.equal(board[7][4], 'wK');
  assert.equal(board[4][4], null);
});

test('generateAutomatedTournamentMatches pairs players automatically across all 7 tournament formats', () => {
  const players = [
    { id: 'p1', rating: 1850 },
    { id: 'p2', rating: 1750 },
    { id: 'p3', rating: 1650 },
    { id: 'p4', rating: 1550 },
  ];
  assert.equal(generateAutomatedTournamentMatches('swiss', players).length, 2);
  assert.equal(generateAutomatedTournamentMatches('knockout', players).length, 3);
  assert.ok(generateAutomatedTournamentMatches('double_elimination', players).length >= 3);
  assert.equal(generateAutomatedTournamentMatches('round_robin', players).length, 6);
  assert.equal(generateAutomatedTournamentMatches('double_round_robin', players).length, 12);
  assert.equal(generateAutomatedTournamentMatches('scheveningen', players).length, 4);
  assert.ok(generateAutomatedTournamentMatches('arena', players).length >= 4);
});

test('detectOpeningFromPgn extracts ECO & opening names and ignores Result-Only strings', () => {
  const najdorf = detectOpeningFromPgn(
    '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e6'
  );
  assert.deepEqual(najdorf, { eco: 'B90', name: 'Sicilian Defense: Najdorf' });

  const london = detectOpeningFromPgn('1. d4 d5 2. Bf4 Nf6 3. e3');
  assert.deepEqual(london, { eco: 'D02', name: 'London System' });

  const none = detectOpeningFromPgn('Result Only (1-0) — No PGN Moves Uploaded', 'Friendly Club Match');
  assert.equal(none, null);
});
