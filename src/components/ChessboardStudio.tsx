import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { ClubMember, LoggedClubGame } from '../utils/clubData';
import {
  MatchOutcome,
  MatchStakes,
  TimeControl,
  parseFenBoard,
  previewEloMatch,
} from '../utils/chessEngine';
import {
  StockfishLiteController,
  StockfishLiveEvaluation,
} from '../utils/stockfishEngine';
import { BOARD_THEMES, ChessPieceSvg, playChessSound } from './ChessPieceSvg';
import {
  RotateCcw,
  CheckCircle2,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Database,
  Lock,
  Play,
  Cpu,
  Flame,
  Handshake,
  Trophy,
} from 'lucide-react';

interface ChessboardStudioProps {
  members: ClubMember[];
  loggedGames: LoggedClubGame[];
  activeGame: LoggedClubGame | null;
  currentUser: ClubMember | null;
  onOpenAuthModal: () => void;
  onSubmitGame: (payload: {
    whiteId: string;
    blackId: string;
    outcome: MatchOutcome;
    timeControl: TimeControl;
    matchStakes: MatchStakes;
    openingName: string;
    pgn: string;
  }) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const ChessboardStudio: React.FC<ChessboardStudioProps> = ({
  members,
  loggedGames,
  activeGame,
  currentUser,
  onOpenAuthModal,
  onSubmitGame,
}) => {
  const [boardThemeKey, setBoardThemeKey] = useState<keyof typeof BOARD_THEMES>('enp_royal');
  const [flipped, setFlipped] = useState(false);
  const [vsStockfishBot, setVsStockfishBot] = useState(false);
  const [engineDepth, setEngineDepth] = useState<8 | 10 | 12>(10);

  // Legal move history state (array of FENs and SANs)
  const [fenHistory, setFenHistory] = useState<string[]>([STARTING_FEN]);
  const [sanHistory, setSanHistory] = useState<string[]>([]);
  const [moveHighlightHistory, setMoveHighlightHistory] = useState<
    { from: string; to: string }[]
  >([{ from: '', to: '' }]);
  const [plyIndex, setPlyIndex] = useState<number>(0);

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pgnInput, setPgnInput] = useState<string>(
    activeGame?.pgn || '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6'
  );
  const [pgnNotice, setPgnNotice] = useState<string>('');

  // Real-time Stockfish Web Worker Evaluation State
  const stockfishRef = useRef<StockfishLiteController | null>(null);
  const [engineEval, setEngineEval] = useState<StockfishLiveEvaluation>({
    fen: STARTING_FEN,
    evalPawns: 0.35,
    isMate: false,
    mateIn: null,
    depth: 10,
    targetDepth: 10,
    bestMoveUci: 'e2e4',
    bestMoveSan: 'e4',
    pvSan: ['e4', 'c5', 'Nf3'],
    isComputing: false,
    engineLabel: 'Stockfish Web · Depth 10',
  });

  // Game Database Submitter State (Supports both Result-Only without PGN and Full PGN)
  const [submissionMode, setSubmissionMode] = useState<'result_only' | 'with_pgn'>('result_only');
  const [matchStakes, setMatchStakes] = useState<MatchStakes>('friendly');
  const [whiteId, setWhiteId] = useState<string>(
    currentUser?.id || members[0]?.id || 'enp-owner'
  );
  const [blackId, setBlackId] = useState<string>(
    members.find((m) => m.id !== (currentUser?.id || members[0]?.id))?.id ||
      members[1]?.id ||
      'enp-yasser-boureghda'
  );
  const [timeControl, setTimeControl] = useState<TimeControl>('rapid');
  const [outcome, setOutcome] = useState<MatchOutcome>(1);
  const [openingName, setOpeningName] = useState<string>('Campus Library Match');
  const [submissionBanner, setSubmissionBanner] = useState<string>('');
  const [archiveFilterTc, setArchiveFilterTc] = useState<'ALL' | TimeControl>('ALL');

  const formatPgnFromSanList = (sans: string[]) => {
    const formattedPgn: string[] = [];
    for (let i = 0; i < sans.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const wSan = sans[i];
      const bSan = sans[i + 1] ? ` ${sans[i + 1]}` : '';
      formattedPgn.push(`${moveNum}. ${wSan}${bSan}`);
    }
    return formattedPgn.join(' ');
  };

  // Initialize light web-compatible Stockfish worker on mount
  useEffect(() => {
    const controller = new StockfishLiteController((liveEvaluation) => {
      setEngineEval(liveEvaluation);
    });
    stockfishRef.current = controller;

    return () => {
      controller.terminate();
      stockfishRef.current = null;
    };
  }, []);

  const currentFen = fenHistory[plyIndex] || STARTING_FEN;

  // Trigger real-time low-depth Stockfish evaluation whenever FEN or target depth changes
  useEffect(() => {
    stockfishRef.current?.evaluatePosition(currentFen, engineDepth);
  }, [currentFen, engineDepth]);

  // Helper to load a PGN string into legal FEN steps using chess.js
  const loadPgnIntoBoard = (rawPgn: string, titleLabel?: string) => {
    const clean = rawPgn.trim();
    if (!clean || clean.startsWith('Result Only')) {
      setPgnNotice('Result-only match record (no PGN moves stored).');
      return false;
    }
    try {
      const tempChess = new Chess();
      try {
        tempChess.loadPgn(clean);
      } catch {
        tempChess.reset();
        const tokens = clean
          .replace(/\{[^}]*\}/g, '')
          .replace(/\d+\.+/g, ' ')
          .split(/\s+/)
          .filter((t) => t && !['1-0', '0-1', '1/2-1/2', '*'].includes(t));
        for (const tok of tokens) {
          const cleanedTok = tok.replace(/[!?]+/g, '');
          const moved = tempChess.move(cleanedTok);
          if (!moved) break;
        }
      }

      const verboseHistory = tempChess.history({ verbose: true });
      const replay = new Chess();
      const fens: string[] = [STARTING_FEN];
      const sans: string[] = [];
      const highlights: { from: string; to: string }[] = [{ from: '', to: '' }];

      for (const mv of verboseHistory) {
        replay.move(mv);
        fens.push(replay.fen());
        sans.push(mv.san);
        highlights.push({ from: mv.from, to: mv.to });
      }

      setFenHistory(fens);
      setSanHistory(sans);
      setMoveHighlightHistory(highlights);
      setPlyIndex(fens.length - 1);
      setSelectedSquare(null);
      if (titleLabel) {
        setPgnNotice(`Loaded: ${titleLabel} (${sans.length} legal plies)`);
      } else {
        setPgnNotice(`Loaded ${sans.length} legal moves.`);
      }
      return true;
    } catch {
      setPgnNotice('Invalid PGN or illegal move sequence detected.');
      return false;
    }
  };

  useEffect(() => {
    if (activeGame?.pgn && !activeGame.pgn.startsWith('Result Only')) {
      setPgnInput(activeGame.pgn);
      loadPgnIntoBoard(activeGame.pgn, activeGame.title);
    } else {
      loadPgnIntoBoard('1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6');
    }
  }, [activeGame]);

  const boardMatrix = useMemo(() => parseFenBoard(currentFen), [currentFen]);

  // Active chess.js instance at current ply
  const currentChess = useMemo(() => {
    try {
      return new Chess(currentFen);
    } catch {
      return new Chess();
    }
  }, [currentFen]);

  // Legal target squares for currently selected square
  const legalMovesFromSelected = useMemo(() => {
    if (!selectedSquare) return [];
    try {
      return currentChess.moves({
        square: selectedSquare as Parameters<Chess['moves']>[0]['square'],
        verbose: true,
      });
    } catch {
      return [];
    }
  }, [currentChess, selectedSquare]);

  const turnColor = currentChess.turn(); // 'w' or 'b'
  const isCheck = currentChess.inCheck();
  const isCheckmate = currentChess.isCheckmate();
  const isDraw = currentChess.isDraw();

  const handleSquareClick = async (r: number, c: number) => {
    const sqName = `${FILES[c]}${RANKS[r]}`;

    // If a square is already selected, check if sqName is a legal destination
    if (selectedSquare) {
      if (selectedSquare === sqName) {
        setSelectedSquare(null);
        return;
      }

      const legalMove = legalMovesFromSelected.find((m) => m.to === sqName);
      if (legalMove) {
        const nextChess = new Chess(currentFen);
        const executed = nextChess.move({
          from: selectedSquare,
          to: sqName,
          promotion: 'q',
        });

        if (executed) {
          const newFens = [...fenHistory.slice(0, plyIndex + 1), nextChess.fen()];
          const newSans = [...sanHistory.slice(0, plyIndex), executed.san];
          const newHighlights = [
            ...moveHighlightHistory.slice(0, plyIndex + 1),
            { from: selectedSquare, to: sqName },
          ];

          playChessSound(executed.captured ? 'capture' : 'move');

          setFenHistory(newFens);
          setSanHistory(newSans);
          setMoveHighlightHistory(newHighlights);
          setPlyIndex(newFens.length - 1);
          setSelectedSquare(null);
          setPgnInput(formatPgnFromSanList(newSans));

          // If Vs. Stockfish Bot is enabled and game is not over, ask Stockfish Web Worker for its best move at low depth
          if (vsStockfishBot && !nextChess.isGameOver()) {
            setPgnNotice(`You played ${executed.san} · Stockfish thinking (depth ${engineDepth})...`);
            const botBest = await stockfishRef.current?.getBestMove(
              nextChess.fen(),
              engineDepth
            );
            const legalReplies = nextChess.moves({ verbose: true });
            const chosenReply =
              legalReplies.find(
                (m) =>
                  `${m.from}${m.to}${m.promotion || ''}` === botBest?.uci ||
                  m.san === botBest?.san
              ) || legalReplies[0];

            if (chosenReply) {
              const botMoved = nextChess.move(chosenReply);
              if (botMoved) {
                playChessSound(botMoved.captured ? 'capture' : 'move');
                const updatedFens = [...newFens, nextChess.fen()];
                const updatedSans = [...newSans, botMoved.san];
                const updatedHighlights = [
                  ...newHighlights,
                  { from: botMoved.from, to: botMoved.to },
                ];
                setFenHistory(updatedFens);
                setSanHistory(updatedSans);
                setMoveHighlightHistory(updatedHighlights);
                setPlyIndex(updatedFens.length - 1);
                setPgnInput(formatPgnFromSanList(updatedSans));
                setPgnNotice(
                  `You played ${executed.san} · Stockfish replied ${botMoved.san}`
                );
              }
            }
          } else {
            setPgnNotice(
              `Played ${executed.san} — Now ${
                nextChess.turn() === 'w' ? 'White' : 'Black'
              } to move.`
            );
          }
          return;
        }
      }
    }

    // Otherwise, only allow selecting a piece that belongs to the current side to move!
    const pieceCode = boardMatrix[r]?.[c];
    if (pieceCode && pieceCode[0] === turnColor) {
      setSelectedSquare(sqName);
    } else if (pieceCode && pieceCode[0] !== turnColor) {
      setSelectedSquare(null);
      setPgnNotice(
        `Strict legal turns: It is ${
          turnColor === 'w' ? 'White' : 'Black'
        }'s turn to move! Select a ${
          turnColor === 'w' ? 'White' : 'Black'
        } piece or turn on "Vs. Stockfish Bot" above.`
      );
    } else {
      setSelectedSquare(null);
    }
  };

  const handleResetBoard = () => {
    setFenHistory([STARTING_FEN]);
    setSanHistory([]);
    setMoveHighlightHistory([{ from: '', to: '' }]);
    setPlyIndex(0);
    setSelectedSquare(null);
    setPgnInput('');
    setPgnNotice('Board reset to standard starting position (White to move).');
    playChessSound('move');
  };

  const theme = BOARD_THEMES[boardThemeKey];
  const whiteMember = members.find((m) => m.id === whiteId) || members[0];
  const blackMember =
    members.find((m) => m.id === blackId && m.id !== whiteMember?.id) ||
    members.find((m) => m.id !== whiteMember?.id) ||
    members[0];

  const eloPreview =
    whiteMember && blackMember
      ? previewEloMatch(
          whiteMember.fide[timeControl],
          blackMember.fide[timeControl],
          outcome,
          whiteMember.fide.gamesPlayed,
          blackMember.fide.gamesPlayed,
          matchStakes
        )
      : {
          whiteNew: 1600,
          whiteDelta: 0,
          blackNew: 1600,
          blackDelta: 0,
          expectedWhiteWinProb: 50,
          effectiveKWhite: 20,
          effectiveKBlack: 20,
          isProvisionalMatch: false,
        };

  const isAdminOrOwner =
    currentUser?.role === 'admin' || currentUser?.role === 'owner';

  const handleGameSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !whiteMember || !blackMember) return;

    const finalPgn =
      submissionMode === 'result_only'
        ? `Result Only (${outcome === 1 ? '1-0' : outcome === 0 ? '0-1' : '1/2-1/2'}) — No PGN Moves Uploaded`
        : pgnInput.trim() || '1. e4 e5';

    onSubmitGame({
      whiteId: whiteMember.id,
      blackId: blackMember.id,
      outcome,
      timeControl,
      matchStakes,
      openingName:
        openingName.trim() ||
        (matchStakes === 'friendly'
          ? 'Friendly Club Match'
          : matchStakes === 'tournament'
          ? 'Championship Tournament Match'
          : 'Competitive Club Match'),
      pgn: finalPgn,
    });

    const stakesLabel =
      matchStakes === 'friendly'
        ? 'Friendly (0.45x Elo)'
        : matchStakes === 'tournament'
        ? 'Tournament (1.25x Elo)'
        : 'Competitive (1.0x Elo)';

    if (isAdminOrOwner) {
      setSubmissionBanner(
        `${stakesLabel} result verified & published! ${whiteMember.name} (${
          eloPreview.whiteDelta >= 0 ? '+' : ''
        }${eloPreview.whiteDelta} ${timeControl.toUpperCase()} Elo) vs ${blackMember.name}.`
      );
    } else {
      setSubmissionBanner(
        `${stakesLabel} match submitted to the Admin Approval Queue! Once approved, ${timeControl.toUpperCase()} Elo ratings will update automatically.`
      );
    }
  };

  // Convert Stockfish centipawn / mate evaluation to evaluation bar percentage (White advantage height)
  const whiteEvalHeight = useMemo(() => {
    if (engineEval.isMate) {
      if (engineEval.mateIn !== null) {
        return engineEval.mateIn >= 0 ? 96 : 4;
      }
      return engineEval.evalPawns >= 0 ? 96 : 4;
    }
    return Math.max(6, Math.min(94, Math.round(50 + engineEval.evalPawns * 6.5)));
  }, [engineEval]);

  const formattedScoreText = useMemo(() => {
    if (engineEval.isMate) {
      if (engineEval.mateIn === 0) return 'Mate';
      if (engineEval.mateIn !== null) {
        return `${engineEval.mateIn > 0 ? '+' : '-'}M${Math.abs(engineEval.mateIn)}`;
      }
      return 'Mate';
    }
    return engineEval.evalPawns >= 0
      ? `+${engineEval.evalPawns.toFixed(2)}`
      : engineEval.evalPawns.toFixed(2);
  }, [engineEval]);

  const formattedBarScoreShort = useMemo(() => {
    if (engineEval.isMate) {
      if (engineEval.mateIn === 0) return 'M';
      if (engineEval.mateIn !== null) {
        return `M${Math.abs(engineEval.mateIn)}`;
      }
      return 'M';
    }
    return engineEval.evalPawns >= 0
      ? `+${engineEval.evalPawns.toFixed(1)}`
      : engineEval.evalPawns.toFixed(1);
  }, [engineEval]);

  const displayRows = flipped ? [...boardMatrix].reverse() : boardMatrix;
  const currentHighlight = moveHighlightHistory[plyIndex] || { from: '', to: '' };

  const approvedClubGames = loggedGames.filter(
    (g) =>
      g.status === 'approved' &&
      (archiveFilterTc === 'ALL' || g.timeControl === archiveFilterTc)
  );

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span className="text-xs font-mono-tabular text-[#26E6DE] tracking-wider uppercase">
            REAL-TIME STOCKFISH WEB WORKER (ZERO-CONTEMPT) · QUICK RESULT LOGGER · CLUB PGN ARCHIVE
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Chessboard Analysis Studio & Match Result Logger
          </h2>
        </div>

        <div className="flex items-center gap-1.5 bg-[#08172E] p-1 rounded-xl border border-white/10">
          {(Object.keys(BOARD_THEMES) as (keyof typeof BOARD_THEMES)[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setBoardThemeKey(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                boardThemeKey === key
                  ? 'bg-[#FF6B00] text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {BOARD_THEMES[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Studio + Game Submission */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Cols: Legal 8x8 Chessboard + Real-Time Stockfish Evaluation Bar */}
        <div className="lg:col-span-7 broadcast-panel p-4 sm:p-6 rounded-2xl space-y-5">
          {/* Turn Status & Real-Time Stockfish Engine Bar Header */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-white/10 pb-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`w-3.5 h-3.5 rounded-sm border shrink-0 ${
                  turnColor === 'w'
                    ? 'bg-white border-slate-400'
                    : 'bg-slate-900 border-white/40'
                }`}
              />
              <span className="text-xs sm:text-sm font-bold text-white">
                {isCheckmate
                  ? `Checkmate · ${turnColor === 'w' ? 'Black' : 'White'} Wins`
                  : isDraw
                  ? 'Draw Position'
                  : `${turnColor === 'w' ? 'White' : 'Black'} to Move${
                      isCheck ? ' (CHECK!)' : ''
                    }`}
              </span>
              <span className="text-xs font-mono-tabular text-[#26E6DE] bg-[#061020] px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                <Cpu
                  className={`w-3.5 h-3.5 ${
                    engineEval.isComputing ? 'animate-pulse text-[#FF6B00]' : 'text-[#26E6DE]'
                  }`}
                />
                <span>Eval: {formattedScoreText}</span>
                <span className="text-slate-400">· Best: {engineEval.bestMoveSan}</span>
                <span className="text-[10px] text-slate-500 hidden sm:inline">
                  ({engineEval.engineLabel})
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Low Depth Selector to prevent browser overload */}
              <div
                className="flex items-center bg-[#061020] p-0.5 rounded-lg border border-white/10 font-mono-tabular text-[11px]"
                title="Stockfish Search Depth (kept low for instant browser responsiveness)"
              >
                {([8, 10, 12] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setEngineDepth(d)}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                      engineDepth === d
                        ? 'bg-[#1E56A0] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    d{d}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setVsStockfishBot((v) => !v)}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  vsStockfishBot
                    ? 'bg-[#26E6DE] text-[#061020] shadow-md'
                    : 'bg-white/8 hover:bg-white/15 text-[#26E6DE] border border-[#26E6DE]/30'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{vsStockfishBot ? 'Bot Reply: ON' : 'Vs. Stockfish Bot'}</span>
              </button>
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/8 hover:bg-white/15 text-slate-200 cursor-pointer"
              >
                Flip Board
              </button>
              <button
                type="button"
                onClick={handleResetBoard}
                className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/8 hover:bg-white/15 text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

          {/* Real-Time Stockfish Principal Variation (PV) Line */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#061020]/70 border border-white/10 font-mono-tabular text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[#26E6DE] font-bold shrink-0">
                Stockfish Line (d{engineEval.depth}):
              </span>
              <span className="text-slate-200 truncate">
                {engineEval.pvSan.length > 0
                  ? engineEval.pvSan.join(' → ')
                  : engineEval.bestMoveSan}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 shrink-0">
              {engineEval.isComputing ? 'Calculating...' : 'Synchronized'}
            </span>
          </div>

          {/* Evaluation Bar + 8x8 Legal Board */}
          <div className="flex items-stretch justify-center gap-2 sm:gap-4">
            <div
              className="w-6 sm:w-8 rounded-xl overflow-hidden bg-[#1E293B] border border-white/20 flex flex-col justify-end relative shrink-0"
              title={`Stockfish Evaluation (Depth ${engineEval.depth}): ${formattedScoreText}`}
            >
              <div
                className="w-full bg-white transition-all duration-300"
                style={{ height: `${whiteEvalHeight}%` }}
              />
              <span
                className={`absolute top-2 left-0 right-0 text-center text-[9px] sm:text-[10px] font-mono-tabular font-extrabold ${
                  whiteEvalHeight > 85 ? 'text-slate-900' : 'text-white'
                }`}
              >
                {formattedBarScoreShort}
              </span>
            </div>

            <div className="w-full max-w-[318px] sm:max-w-[440px] aspect-square rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl grid grid-cols-8 grid-rows-8">
              {displayRows.map((row, displayR) => {
                const actualR = flipped ? 7 - displayR : displayR;
                const displayCols = flipped ? [...row].reverse() : row;

                return displayCols.map((piece, displayC) => {
                  const actualC = flipped ? 7 - displayC : displayC;
                  const sqName = `${FILES[actualC]}${RANKS[actualR]}`;
                  const isLight = (actualR + actualC) % 2 === 0;
                  const isSelected = selectedSquare === sqName;
                  const isLastMove =
                    currentHighlight.from === sqName || currentHighlight.to === sqName;
                  const legalTarget = legalMovesFromSelected.find((m) => m.to === sqName);

                  return (
                    <button
                      key={sqName}
                      type="button"
                      onClick={() => handleSquareClick(actualR, actualC)}
                      aria-label={`Studio board square ${sqName}`}
                      className="relative w-full h-full aspect-square flex items-center justify-center select-none cursor-pointer"
                      style={{
                        backgroundColor: isSelected
                          ? 'rgba(255, 107, 0, 0.78)'
                          : isLastMove
                          ? theme.highlight
                          : isLight
                          ? theme.light
                          : theme.dark,
                      }}
                    >
                      {displayC === 0 && (
                        <span
                          className={`absolute top-0.5 left-1 text-[9px] sm:text-[10px] font-mono-tabular font-bold ${
                            isLight ? 'text-slate-700' : 'text-white/80'
                          }`}
                        >
                          {RANKS[actualR]}
                        </span>
                      )}
                      {displayR === 7 && (
                        <span
                          className={`absolute bottom-0.5 right-1 text-[9px] sm:text-[10px] font-mono-tabular font-bold ${
                            isLight ? 'text-slate-700' : 'text-white/80'
                          }`}
                        >
                          {FILES[actualC]}
                        </span>
                      )}

                      {piece && (
                        <div className="w-[82%] h-[82%] flex items-center justify-center">
                          <ChessPieceSvg code={piece} className="w-full h-full" />
                        </div>
                      )}

                      {/* Legal move indicator dot or capture ring */}
                      {legalTarget && (
                        <span
                          className={
                            piece
                              ? 'absolute inset-1 rounded-full border-[3px] border-[#061020]/60 pointer-events-none'
                              : 'w-3 h-3 rounded-full bg-[#061020]/50 pointer-events-none'
                          }
                        />
                      )}
                    </button>
                  );
                });
              })}
            </div>
          </div>

          {/* Step Navigation Controls + Move List */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2 bg-[#061020]/80 p-2 rounded-xl border border-white/10">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setPlyIndex(0);
                    setSelectedSquare(null);
                  }}
                  disabled={plyIndex === 0}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                  title="First move"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlyIndex((p) => Math.max(0, p - 1));
                    setSelectedSquare(null);
                  }}
                  disabled={plyIndex === 0}
                  className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlyIndex((p) => Math.min(fenHistory.length - 1, p + 1));
                    setSelectedSquare(null);
                  }}
                  disabled={plyIndex >= fenHistory.length - 1}
                  className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlyIndex(fenHistory.length - 1);
                    setSelectedSquare(null);
                  }}
                  disabled={plyIndex >= fenHistory.length - 1}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                  title="Latest move"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-xs font-mono-tabular text-slate-400 pr-2">
                Ply {plyIndex} / {sanHistory.length}
              </span>
            </div>

            {/* Interactive Move Strip */}
            <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-xl bg-[#061020]/70 border border-white/10 font-mono-tabular text-xs max-h-28 overflow-y-auto">
              <span className="text-slate-400 font-semibold mr-1">Moves:</span>
              {sanHistory.length === 0 ? (
                <span className="text-slate-500">
                  Click any White piece on the board to play a legal move, or import a PGN below.
                </span>
              ) : (
                sanHistory.map((m, i) => {
                  const targetPly = i + 1;
                  const isCurrent = plyIndex === targetPly;
                  const moveNumberPrefix =
                    i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : '';
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPlyIndex(targetPly);
                        setSelectedSquare(null);
                      }}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-[#FF6B00] text-white font-bold'
                          : 'bg-white/5 text-slate-200 hover:bg-white/15'
                      }`}
                    >
                      {moveNumberPrefix}
                      {m}
                    </button>
                  );
                })
              )}
            </div>

            {/* PGN Importer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Import or Edit Legal PGN String
                </label>
                {pgnNotice && (
                  <span className="text-xs font-mono-tabular text-[#26E6DE] font-semibold">
                    {pgnNotice}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pgnInput}
                  onChange={(e) => setPgnInput(e.target.value)}
                  placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6..."
                  aria-label="PGN notation input"
                  className="flex-1 px-3 py-2 text-xs font-mono-tabular rounded-xl border border-white/15 bg-[#061020]/80 text-white"
                />
                <button
                  type="button"
                  onClick={() => loadPgnIntoBoard(pgnInput)}
                  className="px-4 py-2 rounded-xl bg-[#1E56A0] hover:bg-[#2563EB] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Load PGN
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Submit Game or Result-Only Match to Club Database */}
        <div className="lg:col-span-5 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-5">
          <div className="border-b border-white/10 pb-3">
            <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold">
              {isAdminOrOwner
                ? 'ADMIN DIRECT MATCH LOGGER (AUTO-APPROVED)'
                : 'MEMBER MATCH LOGGER (ADMIN APPROVAL QUEUE)'}
            </span>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
              <Database className="w-4 h-4 text-[#FF6B00]" />
              Log Match Result or Full PGN & Update Elo
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Log a quick result (just who won & lost—no PGN required!) or attach full PGN moves, and choose Friendly vs. Competitive Elo stakes.
            </p>
          </div>

          {!currentUser ? (
            <div className="p-5 rounded-2xl bg-[#061020]/90 border border-white/15 text-center space-y-3">
              <Lock className="w-8 h-8 text-[#FF6B00] mx-auto" />
              <div className="text-sm font-bold text-white">
                Account Sign-In Required to Log Matches
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                To record a match result or share a game against a club opponent, please sign in with your Club Account or Google.
              </p>
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold cursor-pointer"
              >
                Sign In to Log Match
              </button>
            </div>
          ) : (
            <form onSubmit={handleGameSubmitForm} className="space-y-4">
              {submissionBanner && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-200 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{submissionBanner}</span>
                </div>
              )}

              {/* Mode Toggle: Result Only (No PGN) vs With PGN */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  1. Recording Mode (No PGN Needed vs. Full PGN)
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#061020] p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSubmissionMode('result_only')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      submissionMode === 'result_only'
                        ? 'bg-[#FF6B00] text-white shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Result Only (Who Won/Lost)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmissionMode('with_pgn')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      submissionMode === 'with_pgn'
                        ? 'bg-[#1E56A0] text-white shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Include PGN Moves
                  </button>
                </div>
              </div>

              {/* Match Stakes Selector: Friendly (0.45x Elo) vs Competitive (1.0x) vs Tournament (1.25x) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  2. Match Type & Elo Stakes
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMatchStakes('friendly')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      matchStakes === 'friendly'
                        ? 'bg-[#26E6DE]/15 border-[#26E6DE] text-white shadow'
                        : 'bg-[#061020]/70 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#26E6DE]">
                      <Handshake className="w-3.5 h-3.5 shrink-0" />
                      <span>Friendly</span>
                    </div>
                    <div className="text-[10px] font-mono-tabular text-slate-300 mt-0.5">
                      0.45x Light Elo
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMatchStakes('competitive')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      matchStakes === 'competitive'
                        ? 'bg-[#1E56A0]/30 border-[#3B82F6] text-white shadow'
                        : 'bg-[#061020]/70 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                      <Flame className="w-3.5 h-3.5 shrink-0" />
                      <span>Competitive</span>
                    </div>
                    <div className="text-[10px] font-mono-tabular text-slate-300 mt-0.5">
                      1.0x Full Elo
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMatchStakes('tournament')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      matchStakes === 'tournament'
                        ? 'bg-[#FF6B00]/20 border-[#FF6B00] text-white shadow'
                        : 'bg-[#061020]/70 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF6B00]">
                      <Trophy className="w-3.5 h-3.5 shrink-0" />
                      <span>Tournament</span>
                    </div>
                    <div className="text-[10px] font-mono-tabular text-slate-300 mt-0.5">
                      1.25x Cup Elo
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    White Player
                  </label>
                  <select
                    aria-label="Select White player"
                    value={whiteMember?.id || ''}
                    onChange={(e) => setWhiteId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.fide[timeControl]} Elo)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Black Player (Opponent)
                  </label>
                  <select
                    aria-label="Select Black player"
                    value={blackMember?.id || ''}
                    onChange={(e) => setBlackId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
                  >
                    {members
                      .filter((m) => m.id !== whiteMember?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.fide[timeControl]} Elo)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Elo Category (Time Control)
                  </label>
                  <div className="flex bg-[#061020] p-1 rounded-xl border border-white/10">
                    {(['rapid', 'blitz', 'classical'] as const).map((tc) => (
                      <button
                        key={tc}
                        type="button"
                        onClick={() => setTimeControl(tc)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                          timeControl === tc ? 'bg-[#1E56A0] text-white' : 'text-slate-400'
                        }`}
                      >
                        {tc}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Who Won? (Match Outcome)
                  </label>
                  <div className="flex bg-[#061020] p-1 rounded-xl border border-white/10 font-mono-tabular">
                    {[
                      { val: 1 as MatchOutcome, label: 'White Won (1-0)' },
                      { val: 0.5 as MatchOutcome, label: 'Draw (½-½)' },
                      { val: 0 as MatchOutcome, label: 'Black Won (0-1)' },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setOutcome(opt.val)}
                        className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          outcome === opt.val ? 'bg-[#FF6B00] text-white' : 'text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {submissionMode === 'with_pgn' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Event / Opening Name
                  </label>
                  <input
                    type="text"
                    value={openingName}
                    onChange={(e) => setOpeningName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                  />
                </div>
              )}

              {/* Unified Elo Rating Delta Preview */}
              {whiteMember && blackMember && (
                <div className="p-4 rounded-2xl bg-[#040B16]/90 border border-[#26E6DE]/25 text-white space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono-tabular text-slate-300">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span>
                        {timeControl.toUpperCase()} ELO ·{' '}
                        <strong className="text-[#26E6DE] uppercase">{matchStakes}</strong> (White K=
                        {eloPreview.effectiveKWhite} / Black K={eloPreview.effectiveKBlack})
                      </span>
                      {eloPreview.isProvisionalMatch && (
                        <span className="px-1.5 py-0.5 rounded bg-[#FF6B00]/20 text-[#FF6B00] font-bold text-[10px]">
                          ⚡ 1ST GAMES PLACEMENT BOOST
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400">
                      Win Prob: {eloPreview.expectedWhiteWinProb}% /{' '}
                      {100 - eloPreview.expectedWhiteWinProb}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-mono-tabular">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs font-sans font-bold text-white truncate">
                        ⬜ {whiteMember.name}
                      </div>
                      <div className="text-sm mt-1">
                        {timeControl.toUpperCase()}:{' '}
                        <span className="font-bold">{eloPreview.whiteNew}</span>{' '}
                        <span
                          className={
                            eloPreview.whiteDelta >= 0
                              ? 'text-emerald-400 font-bold'
                              : 'text-rose-400 font-bold'
                          }
                        >
                          ({eloPreview.whiteDelta >= 0 ? '+' : ''}
                          {eloPreview.whiteDelta})
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs font-sans font-bold text-white truncate">
                        ⬛ {blackMember.name}
                      </div>
                      <div className="text-sm mt-1">
                        {timeControl.toUpperCase()}:{' '}
                        <span className="font-bold">{eloPreview.blackNew}</span>{' '}
                        <span
                          className={
                            eloPreview.blackDelta >= 0
                              ? 'text-emerald-400 font-bold'
                              : 'text-rose-400 font-bold'
                          }
                        >
                          ({eloPreview.blackDelta >= 0 ? '+' : ''}
                          {eloPreview.blackDelta})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#FF6B00]/25 transition-colors cursor-pointer"
              >
                {isAdminOrOwner
                  ? `Save & Approve ${matchStakes.toUpperCase()} ${timeControl.toUpperCase()} Result Immediately`
                  : `Submit ${matchStakes.toUpperCase()} ${timeControl.toUpperCase()} Result for Admin Approval`}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Club Verified Games Database Archive */}
      <div className="broadcast-panel p-5 sm:p-6 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
              VERIFIED CLUB MATCH & PGN ARCHIVE
            </span>
            <h3 className="text-lg font-bold text-white">
              Club Games Database ({approvedClubGames.length} Matches)
            </h3>
          </div>

          <div className="flex items-center gap-1 bg-[#061020] p-1 rounded-xl border border-white/10">
            {(['ALL', 'rapid', 'blitz', 'classical'] as const).map((tc) => (
              <button
                key={tc}
                type="button"
                onClick={() => setArchiveFilterTc(tc)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                  archiveFilterTc === tc ? 'bg-[#1E56A0] text-white' : 'text-slate-400'
                }`}
              >
                {tc === 'ALL' ? 'All Time Controls' : tc}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {approvedClubGames.map((g) => {
            const isResultOnly = g.pgn.startsWith('Result Only');
            return (
              <div
                key={g.id}
                className="p-4 rounded-xl bg-[#061020]/75 border border-white/10 flex items-center justify-between gap-3 hover:border-[#26E6DE]/50 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono-tabular uppercase text-[#26E6DE] font-bold">
                      {g.timeControl}
                    </span>
                    {g.matchStakes && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular uppercase font-bold ${
                          g.matchStakes === 'friendly'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : g.matchStakes === 'tournament'
                            ? 'bg-[#FF6B00]/20 text-[#FF6B00]'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {g.matchStakes}
                      </span>
                    )}
                    <span className="text-xs font-bold text-white truncate">{g.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-tabular truncate">
                    {g.event} · Result: {g.result} · {g.date}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono-tabular truncate">
                    {g.pgn}
                  </div>
                </div>

                {!isResultOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setPgnInput(g.pgn);
                      loadPgnIntoBoard(g.pgn, g.title);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#1E56A0] hover:bg-[#FF6B00] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Replay
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
