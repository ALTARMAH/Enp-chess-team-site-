import React, { useState, useEffect, useRef } from 'react';
import { TAL_BLED_1965_COMBINATION, ClubThemeConfig } from '../utils/clubData';
import { parseFenBoard } from '../utils/chessEngine';
import { ChessPieceSvg, playChessSound } from './ChessPieceSvg';
import { ClubLogoBadge } from './ClubLogoBadge';
import { Zap, Play, Pause, SkipBack, SkipForward, Upload, Clock, Eye } from 'lucide-react';

interface BroadcastHeroProps {
  clubConfig: ClubThemeConfig;
  isAdminOrOwner?: boolean;
  onUpdateHeroArt: (url: string) => void;
  onOpenStudioWithCombination: () => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const BroadcastHero: React.FC<BroadcastHeroProps> = ({
  clubConfig,
  isAdminOrOwner = false,
  onUpdateHeroArt,
  onOpenStudioWithCombination,
}) => {
  const [stepIndex, setStepIndex] = useState<number>(TAL_BLED_1965_COMBINATION.sacrificeMoveIndex);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [showOverlayBoard, setShowOverlayBoard] = useState<boolean>(true);
  const [liveSecTick, setLiveSecTick] = useState<number>(35);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStep =
    TAL_BLED_1965_COMBINATION.steps[stepIndex] || TAL_BLED_1965_COMBINATION.steps[0];
  const boardMatrix = parseFenBoard(currentStep.fen);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSecTick((prev) => (prev > 1 ? prev - 1 : 35));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setStepIndex((prev) => {
        const next = (prev + 1) % TAL_BLED_1965_COMBINATION.steps.length;
        playChessSound('move');
        return next;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handleJumpToKeySacrifice = () => {
    setIsAutoPlaying(false);
    setStepIndex(TAL_BLED_1965_COMBINATION.sacrificeMoveIndex);
    playChessSound('move');
  };

  const handleStep = (dir: -1 | 1) => {
    setIsAutoPlaying(false);
    const next = Math.max(
      0,
      Math.min(TAL_BLED_1965_COMBINATION.steps.length - 1, stepIndex + dir)
    );
    setStepIndex(next);
    playChessSound('move');
  };

  const handleHeroFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateHeroArt(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const whiteEvalPercent = Math.max(12, Math.min(92, Math.round(50 + currentStep.eval * 6.5)));

  return (
    <section
      aria-label="Mikhail Tal Bled 1965 Combination Broadcast Showcase"
      className="relative w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
    >
      {/* Full-Bleed 16:9 Mikhail Tal Background Art that flows seamlessly into the site theme */}
      <div className="relative w-full max-w-full min-w-0 min-h-[480px] sm:min-h-[540px] lg:min-h-[580px] flex flex-col justify-between p-3.5 sm:p-6 lg:p-8 overflow-hidden">
        <img
          src={clubConfig.customHeroUrl || '/src/assets/images/mikhail_tal_brilliant_1794618787096.jpg'}
          alt="Mikhail Tal reaching from the shadows to play his 16. Nd5 Knight sacrifice in Bled 1965"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-85 pointer-events-none select-none"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />

        {/* Seamless Multi-Directional Scrim */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(6,16,32,0.94) 0%, rgba(6,16,32,0.70) 38%, rgba(6,16,32,0.20) 65%, rgba(6,16,32,0.75) 100%), linear-gradient(180deg, rgba(6,16,32,0.35) 0%, rgba(6,16,32,0) 55%, #061020 100%)',
          }}
        />

        {/* Top Floating Broadcast Strip with Official ENP Chess Club + ENP School Logos */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 w-full max-w-full min-w-0">
          <div className="max-w-full min-w-0 flex items-center gap-2.5 sm:gap-3 bg-[#061020]/85 backdrop-blur-md border border-white/15 rounded-2xl px-3 sm:px-3.5 py-2 shadow-xl">
            <div className="flex items-center gap-2 shrink-0 max-w-full">
              <ClubLogoBadge
                customLogoUrl={clubConfig.customLogoUrl}
                accentColor={clubConfig.accentColor}
                size="md"
              />
              {clubConfig.schoolLogoUrl && (
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#061020] border border-[#26E6DE]/35 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={clubConfig.schoolLogoUrl}
                    alt={clubConfig.universityName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover scale-105"
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 max-w-full">
              <div className="text-[11px] sm:text-xs font-extrabold tracking-wide text-white truncate">
                {clubConfig.universityName}
              </div>
              <div className="text-[10px] sm:text-[11px] font-mono-tabular text-[#26E6DE] font-semibold truncate">
                {clubConfig.subtitleAr}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 max-w-full min-w-0">
            {isAdminOrOwner && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleHeroFileUpload}
                  className="hidden"
                  aria-label="Upload 4K Hero Art file"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium bg-[#061020]/75 hover:bg-[#061020] text-slate-200 border border-white/15 backdrop-blur-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span className="hidden sm:inline">Swap 4K Hero Art</span>
                  <span className="sm:hidden">4K Art</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowOverlayBoard((v) => !v)}
              className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#061020]/75 hover:bg-[#061020] text-[#26E6DE] border border-[#26E6DE]/30 backdrop-blur-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showOverlayBoard ? 'Full Tal Artwork' : '2D HUD Board'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenStudioWithCombination}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FF6B00] hover:bg-[#FF8533] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-[#FF6B00]/25"
            >
              Open in Studio
            </button>
          </div>
        </div>

        {/* Center Content: Left Editorial + Controls / Right Floating Glass Interactive Board */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-end my-auto pt-5 sm:pt-6 pb-3 w-full max-w-full min-w-0">
          <div className="lg:col-span-7 min-w-0 max-w-full flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono-tabular max-w-full min-w-0">
              <span className="text-[#FF6B00] font-bold">THE MAGICIAN FROM RIGA</span>
              <span className="text-white/40" aria-hidden="true">·</span>
              <span className="text-slate-300">BLED CANDIDATES 1965</span>
              <span className="text-white/40" aria-hidden="true">·</span>
              <span className="text-[#26E6DE] font-bold">
                STOCKFISH EVAL {currentStep.eval >= 0 ? `+${currentStep.eval.toFixed(2)}` : currentStep.eval.toFixed(2)}
              </span>
            </div>

            <h1
              className="text-2xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight leading-[1.1] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] break-words max-w-full"
              style={{ textWrap: 'balance' }}
            >
              Chess Has Never Looked Like This:{' '}
              <span className="font-serif-editorial italic font-normal text-[#26E6DE]">
                Mikhail Tal’s 16. Nd5
              </span>
            </h1>

            <p className="text-xs sm:text-base text-slate-200 max-w-xl leading-relaxed drop-shadow break-words">
              {currentStep.comment}
            </p>

            {/* Sleek Inline Clock & Strict Single-Turn Telemetry */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1 max-w-full min-w-0">
              <div className="flex items-center bg-[#061020]/85 backdrop-blur-md border border-[#FF6B00]/50 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-xl max-w-full min-w-0">
                <Clock className="w-4 h-4 text-[#FF6B00] mr-2 sm:mr-3 shrink-0" />
                <div className="flex items-center gap-2.5 sm:gap-4 font-mono-tabular max-w-full min-w-0">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      MIKHAIL TAL (W)
                    </div>
                    <div className="text-base sm:text-xl font-bold text-[#FF6B00]">
                      04:{liveSecTick.toString().padStart(2, '0')}
                    </div>
                  </div>
                  <span className="text-slate-600 text-base sm:text-xl">|</span>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      BENT LARSEN (B)
                    </div>
                    <div className="text-base sm:text-xl font-bold text-white">{currentStep.blackClock}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-xs text-slate-200 bg-[#061020]/80 backdrop-blur-md px-3 sm:px-4 py-2.5 rounded-2xl border border-white/10 max-w-full min-w-0">
                <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] uppercase font-bold text-[#26E6DE]">
                  {currentStep.movedBy}
                </span>
                <span className="text-sm sm:text-base font-bold text-white">{currentStep.moveLabel}</span>
                <span className="text-[#26E6DE] font-bold">
                  · Eval {currentStep.eval >= 0 ? `+${currentStep.eval.toFixed(2)}` : currentStep.eval.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Interactive Controls */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1 max-w-full min-w-0">
              <button
                type="button"
                onClick={handleJumpToKeySacrifice}
                className="w-full sm:w-auto max-w-full min-h-[46px] px-4 sm:px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm bg-[#FF6B00] hover:bg-[#FF8533] text-white shadow-[0_0_30px_rgba(255,107,0,0.45)] transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-current shrink-0" />
                <span>Jump to 16. Nd5 Knight Sacrifice</span>
              </button>

              <div className="w-full sm:w-auto max-w-full flex items-center justify-between sm:justify-start gap-1 bg-[#061020]/85 backdrop-blur-md p-1.5 rounded-2xl border border-white/15">
                <button
                  type="button"
                  onClick={() => handleStep(-1)}
                  disabled={stepIndex === 0}
                  aria-label="Previous combination move"
                  className="min-h-[40px] flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-40 transition-colors flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(1)}
                  disabled={stepIndex === TAL_BLED_1965_COMBINATION.steps.length - 1}
                  aria-label="Next combination move"
                  className="min-h-[40px] flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-40 transition-colors flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Next
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAutoPlaying((p) => !p)}
                  className={`min-h-[40px] flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    isAutoPlaying
                      ? 'bg-[#26E6DE] text-[#061020]'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isAutoPlaying ? 'Pause' : 'Auto-Replay'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Translucent HUD Interactive Board */}
          <div className="lg:col-span-5 min-w-0 max-w-full flex items-center justify-center lg:justify-end">
            {showOverlayBoard && (
              <div className="relative flex items-stretch gap-2.5 sm:gap-3 bg-[#061020]/70 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-[#26E6DE]/30 shadow-2xl max-w-full min-w-0">
                <div
                  className="w-6 sm:w-7 rounded-lg overflow-hidden bg-[#040B16] border border-white/15 flex flex-col justify-end relative shrink-0"
                  title={`Stockfish Evaluation: +${currentStep.eval.toFixed(2)}`}
                >
                  <div
                    className="w-full bg-gradient-to-t from-white via-slate-100 to-[#26E6DE] transition-all duration-300"
                    style={{ height: `${whiteEvalPercent}%` }}
                  />
                  <span className="absolute top-1.5 left-0 right-0 text-center text-[9px] font-mono-tabular font-bold text-[#26E6DE]">
                    +{currentStep.eval.toFixed(1)}
                  </span>
                </div>

                <div className="relative max-w-full">
                  <div className="w-[220px] h-[220px] sm:w-[252px] sm:h-[252px] rounded-xl overflow-hidden border border-white/20 grid grid-cols-8 grid-rows-8">
                    {boardMatrix.map((row, rIdx) =>
                      row.map((piece, cIdx) => {
                        const squareName = `${FILES[cIdx]}${RANKS[rIdx]}`;
                        const isLight = (rIdx + cIdx) % 2 === 0;
                        const isFrom = currentStep.fromSquare === squareName;
                        const isTo = currentStep.toSquare === squareName;

                        return (
                          <button
                            key={squareName}
                            type="button"
                            onClick={handleJumpToKeySacrifice}
                            aria-label={`Broadcast square ${squareName}`}
                            className="relative w-full h-full flex items-center justify-center select-none cursor-pointer"
                            style={{
                              backgroundColor:
                                isFrom || isTo
                                  ? 'rgba(255, 107, 0, 0.55)'
                                  : isLight
                                  ? 'rgba(232, 240, 248, 0.88)'
                                  : 'rgba(30, 86, 160, 0.88)',
                            }}
                          >
                            {piece && (
                              <div className="w-4/5 h-4/5 flex items-center justify-center">
                                <ChessPieceSvg code={piece} className="w-full h-full" />
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Combination Move Timeline */}
        <div className="relative z-10 min-w-0 w-full max-w-full pt-3 border-t border-white/10 overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 w-full max-w-full min-w-0">
            {TAL_BLED_1965_COMBINATION.steps.map((s, idx) => {
              const active = idx === stepIndex;
              return (
                <button
                  key={s.ply}
                  type="button"
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setStepIndex(idx);
                    playChessSound('move');
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-mono-tabular transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#FF6B00] text-white font-bold'
                      : 'bg-white/5 text-slate-300 hover:bg-white/15'
                  }`}
                >
                  {s.moveLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
