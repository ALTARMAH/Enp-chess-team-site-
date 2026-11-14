import { Chess } from 'chess.js';
import { evaluateFenPosition } from './chessEngine';

export interface StockfishLiveEvaluation {
  fen: string;
  evalPawns: number; // Always normalized to White's perspective (+ is White advantage, - is Black advantage)
  isMate: boolean;
  mateIn: number | null; // Positive = White mates in N, Negative = Black mates in N
  depth: number;
  targetDepth: number;
  bestMoveUci: string;
  bestMoveSan: string;
  pvSan: string[];
  isComputing: boolean;
  engineLabel: string;
}

/**
 * Convert a UCI move (e.g. "e2e4", "e7e8q") into SAN (e.g. "e4", "e8=Q") for a given FEN
 */
export function uciMoveToSan(fen: string, uciMove: string): string {
  if (!uciMove || uciMove === '(none)' || uciMove.length < 4) return '-';
  try {
    const chess = new Chess(fen);
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length >= 5 ? uciMove[4].toLowerCase() : undefined;
    const moveObj = chess.move({ from, to, promotion });
    return moveObj ? moveObj.san : uciMove;
  } catch {
    return uciMove;
  }
}

/**
 * Convert a space-separated UCI PV array (e.g. ["e2e4", "c7c5", "g1f3"]) into an array of SAN moves
 */
export function uciPvToSanLine(fen: string, uciTokens: string[], maxPlies = 5): string[] {
  const sanLine: string[] = [];
  try {
    const chess = new Chess(fen);
    for (const uci of uciTokens.slice(0, maxPlies)) {
      if (!uci || uci.length < 4) break;
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length >= 5 ? uci[4].toLowerCase() : undefined;
      const moved = chess.move({ from, to, promotion });
      if (!moved) break;
      sanLine.push(moved.san);
    }
  } catch {
    // Ignore illegal trailing PV tokens
  }
  return sanLine;
}

/**
 * Parse a single Stockfish UCI "info depth ..." output line into normalized evaluation metrics.
 * Stockfish UCI always reports `score cp` and `score mate` from the side-to-move's perspective.
 * We strictly normalize to White's perspective using the exact FEN being searched.
 */
export function parseStockfishInfoLine(
  line: string,
  fen: string
): {
  depth: number;
  evalPawns: number;
  isMate: boolean;
  mateIn: number | null;
  bestMoveUci: string;
  bestMoveSan: string;
  pvSan: string[];
} | null {
  if (!line.startsWith('info ') || !line.includes(' score ')) {
    return null;
  }

  // Ignore upperbound/lowerbound aspiration window partial lines
  if (line.includes('upperbound') || line.includes('lowerbound')) {
    return null;
  }

  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  if (!depthMatch) return null;
  const depth = parseInt(depthMatch[1], 10);

  let isWhiteTurn = true;
  try {
    const trimmed = fen.trim();
    const turnToken = trimmed === 'w' || trimmed === 'b' ? trimmed : trimmed.split(/\s+/)[1];
    isWhiteTurn = turnToken !== 'b';
  } catch {
    isWhiteTurn = true;
  }

  let evalPawns = 0;
  let isMate = false;
  let mateIn: number | null = null;

  const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
  const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);

  if (mateMatch) {
    const rawMate = parseInt(mateMatch[1], 10);
    const whiteMate = isWhiteTurn ? rawMate : -rawMate;
    isMate = true;
    mateIn = whiteMate;
    evalPawns = whiteMate > 0 ? 15 : whiteMate < 0 ? -15 : 0;
  } else if (cpMatch) {
    const rawCp = parseInt(cpMatch[1], 10);
    const whiteCp = isWhiteTurn ? rawCp : -rawCp;
    evalPawns = Math.max(-15, Math.min(15, Math.round(whiteCp) / 100));
  } else {
    return null;
  }

  const pvIndex = line.indexOf(' pv ');
  const pvTokens =
    pvIndex !== -1
      ? line
          .slice(pvIndex + 4)
          .trim()
          .split(/\s+/)
          .filter(Boolean)
      : [];

  const bestMoveUci = pvTokens[0] || '';
  const pvSan = pvTokens.length > 0 ? uciPvToSanLine(fen, pvTokens, 5) : [];
  const bestMoveSan = pvSan[0] || (bestMoveUci ? uciMoveToSan(fen, bestMoveUci) : '-');

  return {
    depth,
    evalPawns,
    isMate,
    mateIn,
    bestMoveUci,
    bestMoveSan,
    pvSan,
  };
}

/**
 * Lightweight Web-Compatible Stockfish UCI Controller
 * - Uses a strict `stop` -> `bestmove` barrier before sending a new `position fen` command,
 *   because Emscripten `stockfish.js` runs iterative deepening on `setTimeout` ticks and
 *   responds to `isready` before the active search loop actually halts.
 * - Averages consecutive odd/even depth pairs (`d-1` and `d`) once depth >= 6 to eliminate
 *   classical alpha-beta odd/even ply horizon oscillation between White and Black turns.
 */
export class StockfishLiteController {
  private worker: Worker | null = null;
  private isEngineInitialized = false;
  private isSearching = false;
  private isStoppingSearch = false;
  private activeFen = '';
  private activeDepth = 10;
  private prevDepthEvalPawns: number | null = null;
  private queuedRequest: { fen: string; depth: number } | null = null;
  private onEvalCallback: ((evaluation: StockfishLiveEvaluation) => void) | null = null;
  private bestMoveResolver: ((uciMove: string) => void) | null = null;
  private latestEval: StockfishLiveEvaluation = {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    evalPawns: 0.3,
    isMate: false,
    mateIn: null,
    depth: 10,
    targetDepth: 10,
    bestMoveUci: 'e2e4',
    bestMoveSan: 'e4',
    pvSan: ['e4', 'e5', 'Nf3'],
    isComputing: false,
    engineLabel: 'Stockfish Web · Depth 10',
  };

  constructor(onEvalUpdate?: (evaluation: StockfishLiveEvaluation) => void) {
    if (onEvalUpdate) {
      this.onEvalCallback = onEvalUpdate;
    }
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      return;
    }

    try {
      this.worker = new Worker('/stockfish.js');
      this.worker.onmessage = (event: MessageEvent) => {
        const line = typeof event.data === 'string' ? event.data.trim() : '';
        if (!line) return;
        this.handleEngineLine(line);
      };
      this.worker.onerror = () => {
        this.worker = null;
      };

      // Configure Stockfish for objective, zero-contempt, low-memory analysis
      this.worker.postMessage('uci');
      this.worker.postMessage('setoption name Threads value 1');
      this.worker.postMessage('setoption name Hash value 16');
      this.worker.postMessage('setoption name Contempt value 0');
      this.worker.postMessage('setoption name Analysis Contempt value Off');
      this.worker.postMessage('setoption name UCI_AnalyseMode value true');
      this.worker.postMessage('isready');
    } catch {
      this.worker = null;
    }
  }

  private handleEngineLine(line: string) {
    if (line === 'readyok') {
      this.isEngineInitialized = true;
      if (!this.isSearching && !this.isStoppingSearch) {
        this.flushQueuedRequest();
      }
      return;
    }

    if (line.startsWith('bestmove ')) {
      this.isSearching = false;
      const wasStopping = this.isStoppingSearch;
      this.isStoppingSearch = false;

      // If this search was aborted via `stop` because a newer FEN was queued, start the queued search now
      if (wasStopping || this.queuedRequest) {
        this.flushQueuedRequest();
        return;
      }

      const parts = line.split(/\s+/);
      const bestUci = parts[1] || '';
      const bestSan =
        bestUci && bestUci !== '(none)'
          ? uciMoveToSan(this.activeFen, bestUci)
          : this.latestEval.bestMoveSan;

      const completed: StockfishLiveEvaluation = {
        ...this.latestEval,
        fen: this.activeFen,
        bestMoveUci: bestUci !== '(none)' ? bestUci : this.latestEval.bestMoveUci,
        bestMoveSan: bestSan,
        isComputing: false,
        engineLabel: `Stockfish Web · Depth ${this.latestEval.depth}`,
      };
      this.latestEval = completed;
      this.onEvalCallback?.(completed);

      if (this.bestMoveResolver) {
        const resolve = this.bestMoveResolver;
        this.bestMoveResolver = null;
        resolve(bestUci);
      }
      return;
    }

    // Ignore any trailing info lines while stopping a previous search
    if (this.isStoppingSearch || !this.isSearching || !this.activeFen) {
      return;
    }

    if (line.startsWith('info ')) {
      const parsed = parseStockfishInfoLine(line, this.activeFen);
      if (!parsed) return;

      // Smooth odd/even ply horizon oscillation by averaging consecutive depths once depth >= 6
      let smoothedEvalPawns = parsed.evalPawns;
      if (!parsed.isMate && parsed.depth >= 6 && this.prevDepthEvalPawns !== null) {
        smoothedEvalPawns =
          Math.round(((this.prevDepthEvalPawns + parsed.evalPawns) / 2) * 100) / 100;
      }
      if (!parsed.isMate) {
        this.prevDepthEvalPawns = parsed.evalPawns;
      }

      // Only update UI once search reaches depth >= 6 (or targetDepth / mate)
      const minDisplayDepth = Math.min(6, this.activeDepth);
      if (parsed.depth < minDisplayDepth && !parsed.isMate) {
        return;
      }

      const updated: StockfishLiveEvaluation = {
        fen: this.activeFen,
        evalPawns: smoothedEvalPawns,
        isMate: parsed.isMate,
        mateIn: parsed.mateIn,
        depth: parsed.depth,
        targetDepth: this.activeDepth,
        bestMoveUci: parsed.bestMoveUci || this.latestEval.bestMoveUci,
        bestMoveSan:
          parsed.bestMoveSan !== '-' ? parsed.bestMoveSan : this.latestEval.bestMoveSan,
        pvSan: parsed.pvSan.length > 0 ? parsed.pvSan : this.latestEval.pvSan,
        isComputing: parsed.depth < this.activeDepth,
        engineLabel: `Stockfish Web · d${parsed.depth}/${this.activeDepth}`,
      };
      this.latestEval = updated;
      this.onEvalCallback?.(updated);
    }
  }

  private flushQueuedRequest() {
    if (
      !this.worker ||
      !this.isEngineInitialized ||
      this.isSearching ||
      this.isStoppingSearch ||
      !this.queuedRequest
    ) {
      return;
    }
    const next = this.queuedRequest;
    this.queuedRequest = null;
    this.activeFen = next.fen;
    this.activeDepth = next.depth;
    this.prevDepthEvalPawns = null;
    this.isSearching = true;
    this.worker.postMessage(`position fen ${this.activeFen}`);
    this.worker.postMessage(`go depth ${this.activeDepth}`);
  }

  public evaluatePosition(fen: string, lowDepth = 10) {
    const clampedDepth = Math.max(6, Math.min(12, lowDepth));

    // Check terminal game states immediately via chess.js
    try {
      const chess = new Chess(fen);
      if (chess.isGameOver()) {
        const isMate = chess.isCheckmate();
        const whiteWon = isMate && chess.turn() === 'b';
        const blackWon = isMate && chess.turn() === 'w';
        const terminalEval: StockfishLiveEvaluation = {
          fen,
          evalPawns: whiteWon ? 15 : blackWon ? -15 : 0,
          isMate,
          mateIn: isMate ? 0 : null,
          depth: clampedDepth,
          targetDepth: clampedDepth,
          bestMoveUci: '',
          bestMoveSan: isMate ? 'Checkmate' : 'Draw',
          pvSan: [],
          isComputing: false,
          engineLabel: 'Stockfish Web · Terminal',
        };
        this.latestEval = terminalEval;
        this.onEvalCallback?.(terminalEval);
        return;
      }
    } catch {
      // ignore invalid fen
    }

    // Fallback when running in non-browser environment
    if (!this.worker) {
      const fb = evaluateFenPosition(fen);
      const fallbackEval: StockfishLiveEvaluation = {
        fen,
        evalPawns: fb.evalPawns,
        isMate: fb.isMate,
        mateIn: fb.isMate ? (fb.evalPawns > 0 ? 1 : -1) : null,
        depth: clampedDepth,
        targetDepth: clampedDepth,
        bestMoveUci: '',
        bestMoveSan: fb.bestMoveSan,
        pvSan: fb.bestMoveSan !== '-' ? [fb.bestMoveSan] : [],
        isComputing: false,
        engineLabel: `Stockfish Web · Depth ${clampedDepth}`,
      };
      this.latestEval = fallbackEval;
      this.onEvalCallback?.(fallbackEval);
      return;
    }

    // Keep previous smooth evaluation score while showing computing status until depth >= 6 arrives
    this.onEvalCallback?.({
      ...this.latestEval,
      fen,
      targetDepth: clampedDepth,
      isComputing: true,
      engineLabel: `Stockfish Web · Computing d${clampedDepth}...`,
    });

    this.queuedRequest = { fen, depth: clampedDepth };

    if (this.isSearching) {
      if (!this.isStoppingSearch) {
        this.isStoppingSearch = true;
        this.worker.postMessage('stop');
      }
    } else if (this.isEngineInitialized) {
      this.flushQueuedRequest();
    }
  }

  /**
   * Request a single best move from Stockfish at low depth (used for Vs. Stockfish Bot mode)
   */
  public getBestMove(fen: string, lowDepth = 8): Promise<{ uci: string; san: string }> {
    return new Promise((resolve) => {
      if (!this.worker) {
        const fb = evaluateFenPosition(fen);
        resolve({ uci: '', san: fb.bestMoveSan });
        return;
      }

      const timeout = setTimeout(() => {
        if (this.bestMoveResolver) {
          this.bestMoveResolver = null;
          const fb = evaluateFenPosition(fen);
          resolve({ uci: '', san: fb.bestMoveSan });
        }
      }, 2200);

      this.bestMoveResolver = (uciMove: string) => {
        clearTimeout(timeout);
        const san = uciMoveToSan(fen, uciMove);
        resolve({ uci: uciMove, san });
      };

      this.evaluatePosition(fen, Math.max(6, Math.min(10, lowDepth)));
    });
  }

  public terminate() {
    if (this.worker) {
      try {
        this.worker.postMessage('quit');
        this.worker.terminate();
      } catch {
        // ignore termination errors
      }
      this.worker = null;
    }
  }
}
