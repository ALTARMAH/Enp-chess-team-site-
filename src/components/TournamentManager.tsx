import React, { useState } from 'react';
import { ClubMember, ClubTournament } from '../utils/clubData';
import {
  TournamentMatch,
  TournamentFormat,
  TimeControl,
  MatchOutcome,
  calculateSwissStandings,
  previewEloMatch,
  describeEliminationStructure,
} from '../utils/chessEngine';
import { resolveAssetUrl } from '../utils/assetUrls';
import {
  Trophy,
  PlusCircle,
  Cpu,
  FileText,
  Play,
  CheckCircle2,
  X,
  Users,
  Swords,
  Award,
  Sparkles,
  Layers,
  Trash2,
} from 'lucide-react';

interface TournamentManagerProps {
  members: ClubMember[];
  tournaments: ClubTournament[];
  currentUser: ClubMember | null;
  onOpenAuthModal: () => void;
  onCreateTournament: (payload: {
    name: string;
    format: TournamentFormat;
    timeControl: TimeControl;
    playerIds: string[];
    customTotalRounds?: number;
  }) => void;
  onRecordTournamentMatchPgn: (payload: {
    tournamentId: string;
    matchId: string;
    result: '1-0' | '1/2-1/2' | '0-1';
    pgn: string;
  }) => void;
  onPairNextSwissRound: (tournamentId: string) => void;
  onReplayMatchPgn: (match: TournamentMatch, tournament: ClubTournament) => void;
  onDeleteTournament?: (tournamentId: string) => void;
  onClearTournamentHistory?: () => void;
}

const FORMAT_LABELS: Record<
  TournamentFormat,
  { title: string; subtitle: string; isElimination: boolean }
> = {
  knockout: {
    title: 'Single-Elimination Knockout Bracket',
    subtitle:
      'Visual bracket rounds (Play-In & Seeding → Quarter-Final → Semi-Final → Final); winners advance automatically',
    isElimination: true,
  },
  double_elimination: {
    title: 'Double-Elimination Bracket',
    subtitle: 'Visual elimination bracket tree with automatic winner progression',
    isElimination: true,
  },
  swiss: {
    title: 'Swiss System (Ranking Based · FIDE Dutch Seeded)',
    subtitle:
      'Top half vs. bottom half seeded by Elo; when all round games finish, next round starts automatically',
    isElimination: false,
  },
  round_robin: {
    title: 'Single Round Robin (Ranking Based · All-Play-All)',
    subtitle: 'Every selected player faces every other player once with balanced colors',
    isElimination: false,
  },
  double_round_robin: {
    title: 'Double Round Robin (Candidates Home & Away)',
    subtitle: 'Every player plays every opponent twice — once as White and once as Black',
    isElimination: false,
  },
  scheveningen: {
    title: 'Scheveningen Team Clash (Squad A vs. Squad B)',
    subtitle:
      'Splits players into two balanced squads where every Squad A member plays every Squad B member',
    isElimination: false,
  },
  arena: {
    title: 'Timed Club Arena (Multi-Wave Speed Pairings)',
    subtitle: 'Continuous adjacent-Elo pairings across customizable rapid/blitz waves',
    isElimination: false,
  },
};

export const TournamentManager: React.FC<TournamentManagerProps> = ({
  members,
  tournaments,
  currentUser,
  onOpenAuthModal,
  onCreateTournament,
  onRecordTournamentMatchPgn,
  onPairNextSwissRound,
  onReplayMatchPgn,
  onDeleteTournament,
  onClearTournamentHistory,
}) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    tournaments[0]?.id || ''
  );

  // Create Tournament Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTourneyName, setNewTourneyName] = useState('ENP All-Departments Knockout Cup');
  const [newFormat, setNewFormat] = useState<TournamentFormat>('knockout');
  const [newTimeControl, setNewTimeControl] = useState<TimeControl>('rapid');
  const [newCustomRounds, setNewCustomRounds] = useState<number>(4);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(() =>
    members.map((m) => m.id)
  );
  const [createError, setCreateError] = useState('');

  // Inline Direct Match Controls State (Select Winner/Draw + Paste PGN String Directly on Any Active Match)
  const [inlineSelectedResults, setInlineSelectedResults] = useState<
    Record<string, '1-0' | '1/2-1/2' | '0-1'>
  >({});
  const [inlinePgnStrings, setInlinePgnStrings] = useState<Record<string, string>>({});

  // Modal State for Editing Completed Games or Detailed View
  const [activeMatchForPgn, setActiveMatchForPgn] = useState<TournamentMatch | null>(null);
  const [matchResultInput, setMatchResultInput] = useState<'1-0' | '1/2-1/2' | '0-1'>('1-0');
  const [matchPgnInput, setMatchPgnInput] = useState('');
  const [toastBanner, setToastBanner] = useState('');

  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  const activeTournament =
    tournaments.find((t) => t.id === selectedTournamentId) || tournaments[0] || null;

  const isEliminationFormat =
    activeTournament?.format === 'knockout' ||
    activeTournament?.format === 'double_elimination';

  const getMember = (id: string) => members.find((m) => m.id === id);
  const getMemberName = (id: string) => {
    if (!id || id === 'TBD') return 'TBD (Awaiting Winner)';
    return getMember(id)?.name || id;
  };
  const getMemberShortName = (id: string) => {
    if (!id || id === 'TBD') return 'TBD';
    const full = getMember(id)?.name || id;
    return full.split(' ')[0];
  };
  const getMemberElo = (id: string, tc: TimeControl = 'rapid') => {
    if (!id || id === 'TBD') return null;
    return getMember(id)?.fide[tc] || 1500;
  };

  const handleTogglePlayerSelection = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenCreateModal = () => {
    if (!isAdminOrOwner) {
      onOpenAuthModal();
      return;
    }
    setSelectedPlayerIds(members.map((m) => m.id));
    setCreateError('');
    setIsCreateModalOpen(true);
  };

  const eliminationStructurePreview = describeEliminationStructure(selectedPlayerIds.length);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTourneyName.trim()) {
      setCreateError('Please enter a tournament name.');
      return;
    }
    if (selectedPlayerIds.length < 2) {
      setCreateError('Please select at least 2 club members for computer pairing.');
      return;
    }
    const isNewElim = newFormat === 'knockout' || newFormat === 'double_elimination';
    const finalRounds = isNewElim
      ? eliminationStructurePreview.totalBracketRounds
      : Math.max(1, Math.min(12, newCustomRounds));

    onCreateTournament({
      name: newTourneyName.trim(),
      format: newFormat,
      timeControl: newTimeControl,
      playerIds: selectedPlayerIds,
      customTotalRounds: finalRounds,
    });
    setIsCreateModalOpen(false);
    setToastBanner(
      `Tournament "${newTourneyName.trim()}" (${selectedPlayerIds.length} players, ${finalRounds} rounds) created! Use the direct Winner/Draw buttons and PGN input on any active match.`
    );
  };

  // Unified handler for submitting match result + PGN (used by both inline match controls and modal)
  const submitMatchOutcomeAndPgn = (
    match: TournamentMatch,
    chosenResult: '1-0' | '1/2-1/2' | '0-1',
    pgnText: string
  ) => {
    if (!activeTournament) return;
    if (match.whiteId === 'TBD' || match.blackId === 'TBD') {
      setToastBanner(
        'This bracket slot is awaiting the winners from the previous round. Complete the earlier round game first!'
      );
      return;
    }

    const finalResult: '1-0' | '1/2-1/2' | '0-1' =
      isEliminationFormat && chosenResult === '1/2-1/2' ? '1-0' : chosenResult;

    const currentRoundNum = match.round;
    const unplayedInRoundBeforeSave = activeTournament.matches.filter(
      (m) => m.round === currentRoundNum && m.result === null
    );
    const willFinishRound =
      !isEliminationFormat &&
      unplayedInRoundBeforeSave.length === 1 &&
      unplayedInRoundBeforeSave[0].id === match.id;

    onRecordTournamentMatchPgn({
      tournamentId: activeTournament.id,
      matchId: match.id,
      result: finalResult,
      pgn: pgnText.trim(),
    });

    const wName = getMemberName(match.whiteId);
    const bName = getMemberName(match.blackId);
    const winnerName =
      finalResult === '1-0' ? wName : finalResult === '0-1' ? bName : 'Draw (½-½)';
    const loserName = finalResult === '1-0' ? bName : wName;

    setActiveMatchForPgn(null);

    if (isEliminationFormat) {
      if (match.isDualAdvanceSeeding) {
        setToastBanner(
          `Seeding Match Completed: ${winnerName} (${finalResult}) takes the higher Quarter-Final seed and ${loserName} advances to the second Quarter-Final seed! Leaderboard & Completed Games updated.`
        );
      } else {
        setToastBanner(
          `Bracket Match Completed: ${winnerName} wins (${finalResult}), moves to Completed Games, advances to the next elimination round, and updates the Live Leaderboard!`
        );
      }
    } else if (willFinishRound && currentRoundNum < activeTournament.totalRounds) {
      setToastBanner(
        `Game Completed (${wName} vs. ${bName}: ${finalResult})! All Round ${currentRoundNum} games are finished — Round ${
          currentRoundNum + 1
        } has started automatically and the Live Leaderboard is updated!`
      );
    } else {
      setToastBanner(
        `Game Completed (${wName} vs. ${bName}: ${finalResult})! Automatically moved to Completed Games and Live Leaderboard updated.`
      );
    }
  };

  const handleMatchCardClick = (match: TournamentMatch) => {
    if (match.whiteId === 'TBD' || match.blackId === 'TBD') {
      setToastBanner(
        'This bracket slot is awaiting the winners from the previous round. Complete an earlier round game first!'
      );
      return;
    }
    setActiveMatchForPgn(match);
    setMatchResultInput(match.result || inlineSelectedResults[match.id] || '1-0');
    setMatchPgnInput(match.pgn || inlinePgnStrings[match.id] || '');
  };

  const handleSaveMatchPgn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatchForPgn) return;
    submitMatchOutcomeAndPgn(activeMatchForPgn, matchResultInput, matchPgnInput);
  };

  const getPlayersForTournament = (t: ClubTournament) =>
    t.playerIds
      .map((id) => {
        const m = getMember(id);
        if (!m) return null;
        return {
          id: m.id,
          name: m.name,
          department: m.department,
          rating: m.fide[t.timeControl],
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

  const getFinalStandingsForTournament = (t: ClubTournament) => {
    const players = getPlayersForTournament(t);
    const baseStandings = calculateSwissStandings(players, t.matches);
    const isElim = t.format === 'knockout' || t.format === 'double_elimination';

    if (!isElim) {
      return baseStandings.map((row, index) => ({
        ...row,
        stageReached:
          index === 0
            ? '1st Place Champion'
            : index === 1
            ? '2nd Place Runner-Up'
            : index === 2
            ? '3rd Place Medalist'
            : `Rank #${index + 1}`,
      }));
    }

    const maxR = t.matches.reduce((acc, m) => Math.max(acc, m.round), 1);
    const finalMatch = t.matches.find((m) => m.round === maxR);
    const semiMatches = t.matches.filter((m) => m.round === maxR - 1);

    const championId =
      finalMatch?.result === '1-0'
        ? finalMatch.whiteId
        : finalMatch?.result === '0-1'
        ? finalMatch.blackId
        : null;
    const finalistId =
      finalMatch?.result === '1-0'
        ? finalMatch.blackId
        : finalMatch?.result === '0-1'
        ? finalMatch.whiteId
        : null;

    const semiLoserIds = new Set<string>();
    semiMatches.forEach((sm) => {
      if (sm.result === '1-0' && sm.blackId !== 'TBD') semiLoserIds.add(sm.blackId);
      if (sm.result === '0-1' && sm.whiteId !== 'TBD') semiLoserIds.add(sm.whiteId);
    });

    const getElimPriority = (memberId: string) => {
      if (memberId === championId) return 4;
      if (memberId === finalistId) return 3;
      if (semiLoserIds.has(memberId)) return 2;
      return 1;
    };

    const getElimStageLabel = (memberId: string) => {
      if (memberId === championId) return 'Champion (Won Final)';
      if (memberId === finalistId) return 'Finalist (2nd Place)';
      if (semiLoserIds.has(memberId)) return 'Semi-Finalist (3rd Place)';
      return 'Bracket Contender';
    };

    return [...baseStandings]
      .sort((a, b) => {
        const prioDiff = getElimPriority(b.memberId) - getElimPriority(a.memberId);
        if (prioDiff !== 0) return prioDiff;
        if (b.points !== a.points) return b.points - a.points;
        return b.rating - a.rating;
      })
      .map((row) => ({
        ...row,
        stageReached: getElimStageLabel(row.memberId),
      }));
  };

  const completedTournaments = tournaments.filter(
    (t) =>
      t.status === 'completed' ||
      (t.matches.length > 0 && t.matches.every((m) => m.result !== null))
  );

  const standings = activeTournament
    ? getFinalStandingsForTournament(activeTournament)
    : [];

  const maxRound = activeTournament
    ? activeTournament.matches.reduce((acc, m) => Math.max(acc, m.round), 1)
    : 1;

  // Split matches into "Active / Happening Now" and "Completed / Ended"
  const activeMatchesNow = activeTournament
    ? activeTournament.matches.filter(
        (m) => m.result === null && m.whiteId !== 'TBD' && m.blackId !== 'TBD'
      )
    : [];
  const endedMatchesArchive = activeTournament
    ? activeTournament.matches.filter((m) => m.result !== null)
    : [];

  // Elo preview for active match modal
  const modalWhite = activeMatchForPgn ? getMember(activeMatchForPgn.whiteId) : undefined;
  const modalBlack = activeMatchForPgn ? getMember(activeMatchForPgn.blackId) : undefined;
  const modalTc = activeTournament?.timeControl || 'rapid';
  const modalOutcome: MatchOutcome =
    matchResultInput === '1-0' ? 1 : matchResultInput === '0-1' ? 0 : 0.5;
  const modalEloPreview =
    modalWhite && modalBlack
      ? previewEloMatch(
          modalWhite.fide[modalTc],
          modalBlack.fide[modalTc],
          modalOutcome,
          modalWhite.fide.gamesPlayed,
          modalBlack.fide.gamesPlayed,
          'tournament'
        )
      : null;

  // Helper to render a single Visual Bracket Match Card with direct Winner buttons + PGN input
  const renderBracketMatchCard = (
    match: TournamentMatch,
    fallbackLabel: string,
    isFinalRound: boolean,
    isSemiFinalRound: boolean
  ) => {
    const isDecided = match.result !== null;
    const whiteWon = match.result === '1-0';
    const blackWon = match.result === '0-1';
    const isReadyToPlay = match.whiteId !== 'TBD' && match.blackId !== 'TBD';
    const wElo = getMemberElo(match.whiteId, activeTournament?.timeControl);
    const bElo = getMemberElo(match.blackId, activeTournament?.timeControl);

    const whiteScoreText = !isDecided ? (isReadyToPlay ? '•' : '—') : whiteWon ? '1' : '0';
    const blackScoreText = !isDecided ? (isReadyToPlay ? '•' : '—') : blackWon ? '1' : '0';

    const selectedInlineOutcome = inlineSelectedResults[match.id] || '1-0';
    const inlinePgn = inlinePgnStrings[match.id] ?? (match.pgn || '');

    return (
      <div key={match.id} className="w-[248px] sm:w-[312px] shrink-0 select-none">
        {/* Top Match Title */}
        <div className="flex items-center justify-between mb-1 px-0.5 gap-1">
          <span className="text-[11px] sm:text-xs font-extrabold tracking-tight text-[#3B82F6] dark:text-[#60A5FA] flex items-center gap-1 truncate">
            {isFinalRound && <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#F59E0B] shrink-0" />}
            <span className="truncate">{match.bracketCode || fallbackLabel}</span>
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {match.isDualAdvanceSeeding && (
              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-300 text-[9px] font-mono-tabular font-bold uppercase">
                Both Advance
              </span>
            )}
            {match.pgn && activeTournament && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReplayMatchPgn(match, activeTournament);
                }}
                className="px-1.5 py-0.5 rounded bg-[#1E56A0] hover:bg-[#2563EB] text-white text-[10px] font-mono-tabular font-bold flex items-center gap-0.5 cursor-pointer"
                title="Replay PGN in Studio"
              >
                <Play className="w-2.5 h-2.5" />
                PGN
              </button>
            )}
            {isDecided && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono-tabular font-bold uppercase">
                Completed
              </span>
            )}
          </div>
        </div>

        {/* Bracket Match Box (2 Stacked Player Rows + Center 'vs' Circle + Inline Direct Winner & PGN Controls) */}
        <div
          className={`rounded-xl overflow-hidden border transition-all shadow-md ${
            isReadyToPlay && !isDecided
              ? 'border-[#FF6B00] shadow-[#FF6B00]/10'
              : isDecided
              ? 'border-emerald-500/40'
              : 'opacity-75 border-slate-300 dark:border-white/10'
          }`}
        >
          <div
            onClick={() => handleMatchCardClick(match)}
            className={`relative ${
              isReadyToPlay ? 'cursor-pointer' : 'cursor-not-allowed'
            }`}
          >
            {/* Top Player Row (White) */}
            <div
              className={`flex items-center justify-between h-11 pl-3 pr-0 border-b border-black/10 transition-colors ${
                whiteWon
                  ? 'bg-[#FDE68A] text-slate-950 font-extrabold'
                  : 'bg-[#E2E8F0] dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 font-semibold'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 pr-5">
                <span className="text-xs sm:text-sm truncate">
                  {getMemberName(match.whiteId)}
                </span>
                {wElo && (
                  <span
                    className={`text-[10px] font-mono-tabular shrink-0 ${
                      whiteWon ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    ({wElo})
                  </span>
                )}
              </div>

              <div className="flex items-center h-full shrink-0">
                {isDecided && isFinalRound && whiteWon && (
                  <span className="w-5 h-5 rounded-full bg-[#F59E0B] text-white text-[10px] font-extrabold flex items-center justify-center mr-2 shadow-xs">
                    1
                  </span>
                )}
                {isDecided && isFinalRound && blackWon && (
                  <span className="w-5 h-5 rounded-full bg-slate-400 text-white text-[10px] font-extrabold flex items-center justify-center mr-2 shadow-xs">
                    2
                  </span>
                )}
                {isDecided && isSemiFinalRound && !whiteWon && (
                  <span className="w-5 h-5 rounded-full bg-[#D97706] text-white text-[10px] font-extrabold flex items-center justify-center mr-2 shadow-xs">
                    3
                  </span>
                )}

                <div className="w-10 h-full bg-[#090D16] text-white font-mono-tabular font-extrabold text-sm flex items-center justify-center border-b border-white/15">
                  {whiteScoreText}
                </div>
              </div>
            </div>

            {/* Center Floating 'vs' Circle Badge */}
            <div
              aria-hidden="true"
              className="absolute top-1/2 right-7 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/25 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-xs"
            >
              vs
            </div>

            {/* Bottom Player Row (Black) */}
            <div
              className={`flex items-center justify-between h-11 pl-3 pr-0 transition-colors ${
                blackWon
                  ? 'bg-[#FDE68A] text-slate-950 font-extrabold'
                  : 'bg-[#E2E8F0] dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 font-semibold'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 pr-5">
                <span className="text-xs sm:text-sm truncate">
                  {getMemberName(match.blackId)}
                </span>
                {bElo && (
                  <span
                    className={`text-[10px] font-mono-tabular shrink-0 ${
                      blackWon ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    ({bElo})
                  </span>
                )}
              </div>

              <div className="flex items-center h-full shrink-0">
                {isDecided && isFinalRound && blackWon && (
                  <span className="w-5 h-5 rounded-full bg-[#F59E0B] text-white text-[10px] font-extrabold flex items-center justify-center mr-2 shadow-xs">
                    1
                  </span>
                )}
                {isDecided && isFinalRound && whiteWon && (
                  <span className="w-5 h-5 rounded-full bg-slate-400 text-white text-[10px] font-extrabold flex items-center justify-center mr-2 shadow-xs">
                    2
                  </span>
                )}
                {isDecided && isSemiFinalRound && !blackWon && (
                  <span className="w-5 h-5 rounded-full bg-[#D97706] text-white text-[10px] font-extrabold flex items-center justify-center mr-2 shadow-xs">
                    3
                  </span>
                )}

                <div className="w-10 h-full bg-[#090D16] text-white font-mono-tabular font-extrabold text-sm flex items-center justify-center">
                  {blackScoreText}
                </div>
              </div>
            </div>
          </div>

          {/* VISIBLE DIRECT WINNER PICKER + INLINE PGN INPUT ON ACTIVE BRACKET GAMES */}
          {isReadyToPlay && !isDecided && (
            <div className="p-2.5 bg-[#0B162C] border-t border-white/15 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setInlineSelectedResults((prev) => ({ ...prev, [match.id]: '1-0' }))
                  }
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold font-mono-tabular truncate cursor-pointer border transition-all ${
                    selectedInlineOutcome === '1-0'
                      ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-xs'
                      : 'bg-[#061020] text-slate-300 border-white/15 hover:border-white/30'
                  }`}
                >
                  ⬜ {getMemberShortName(match.whiteId)} Won
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setInlineSelectedResults((prev) => ({ ...prev, [match.id]: '0-1' }))
                  }
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold font-mono-tabular truncate cursor-pointer border transition-all ${
                    selectedInlineOutcome === '0-1'
                      ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-xs'
                      : 'bg-[#061020] text-slate-300 border-white/15 hover:border-white/30'
                  }`}
                >
                  ⬛ {getMemberShortName(match.blackId)} Won
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  aria-label="Paste PGN string"
                  value={inlinePgn}
                  onChange={(e) =>
                    setInlinePgnStrings((prev) => ({ ...prev, [match.id]: e.target.value }))
                  }
                  placeholder="Paste PGN (optional, e.g. 1. e4 e5...)"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#061020] border border-white/15 text-[11px] font-mono-tabular text-white placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    submitMatchOutcomeAndPgn(match, selectedInlineOutcome, inlinePgn)
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 cursor-pointer shadow-xs"
                >
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-4 sm:space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2.5 sm:gap-4 border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-mono-tabular text-[#26E6DE] tracking-wider uppercase font-bold">
            ELIMINATION BRACKETS · SWISS · HISTORY
          </span>
          <h2 className="text-lg sm:text-3xl font-extrabold text-white mt-0.5 sm:mt-1">
            Club Tournaments &amp; Brackets
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
          <a
            href="#tournament-history-section"
            className="min-h-[32px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-[#061020]/90 hover:bg-[#1E56A0]/40 border border-[#26E6DE]/40 text-[#26E6DE] text-[11px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF6B00]" />
            <span>History ({completedTournaments.length})</span>
          </a>

          {isAdminOrOwner && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="min-h-[32px] sm:min-h-[42px] px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-[11px] sm:text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="sm:hidden">+ New Cup</span>
              <span className="hidden sm:inline">+ Create Tournament (Choose Rounds &amp; Players)</span>
            </button>
          )}
        </div>
      </div>

      {toastBanner && (
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-[11px] sm:text-sm text-emerald-200 font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastBanner('')}
            className="text-[11px] sm:text-xs underline text-emerald-300 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TOURNAMENT SELECTOR TABS */}
      {tournaments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {tournaments.map((t) => {
            const active = activeTournament?.id === t.id;
            const isElim = t.format === 'knockout' || t.format === 'double_elimination';
            const isDone =
              t.status === 'completed' ||
              (t.matches.length > 0 && t.matches.every((m) => m.result !== null));
            return (
              <div key={t.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedTournamentId(t.id)}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    active
                      ? 'bg-[#1E56A0] text-white border-[#26E6DE]/50 shadow-lg'
                      : 'bg-[#061020]/70 text-slate-300 border-white/10 hover:border-white/25'
                  }`}
                >
                  <Trophy
                    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${
                      isDone ? 'text-emerald-400' : 'text-[#FF6B00]'
                    }`}
                  />
                  <span className="truncate max-w-[140px] sm:max-w-none">{t.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono-tabular text-[9px] sm:text-[10px] uppercase shrink-0 ${
                      isDone
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : isElim
                        ? 'bg-[#FF6B00]/25 text-[#FF6B00]'
                        : 'bg-black/30 text-[#26E6DE]'
                    }`}
                  >
                    {isDone
                      ? 'Done'
                      : isElim
                      ? `KO · ${t.playerIds.length}P`
                      : `${t.totalRounds}R`}
                  </span>
                </button>
                {isAdminOrOwner && onDeleteTournament && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteTournament(t.id);
                      setToastBanner(`Deleted tournament "${t.name}".`);
                    }}
                    title={`Delete tournament "${t.name}"`}
                    className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!activeTournament ? (
        <div className="broadcast-panel p-8 rounded-2xl text-center space-y-3">
          <Trophy className="w-10 h-10 text-[#FF6B00] mx-auto" />
          <h3 className="text-lg font-bold text-white">No Active Tournaments for This Club</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Club tournaments paired by the automated seeding engine will appear here.
          </p>
        </div>
      ) : isEliminationFormat ? (
        /* ============================================================================
         * VIEW A: VISUAL ELIMINATION BRACKET ROUNDS + COMPLETED GAMES + LIVE LEADERBOARD
         * Clearly renders Play-In & Seeding (for non-power-of-2 like 13 players),
         * Quarter-Final, Semi-Final, and Final with direct Winner + PGN inputs!
         * ============================================================================ */
        <div className="space-y-6">
          <div className="broadcast-panel rounded-3xl overflow-hidden border border-white/15 shadow-2xl">
            {/* Deep Royal Banner Header */}
            <div className="bg-gradient-to-r from-[#1E1B4B] via-[#1E3A8A] to-[#0F172A] px-6 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1.5">
                <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {activeTournament.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200">
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <Trophy className="w-3.5 h-3.5" />
                    {activeTournament.status === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                  <span>·</span>
                  <span>Single Elimination ({activeTournament.totalRounds} Rounds)</span>
                  <span>·</span>
                  <span>{activeTournament.playerIds.length} Players</span>
                  <span>·</span>
                  <span className="text-[#FF6B00] font-mono-tabular uppercase">
                    {activeTournament.timeControl} Elo Rated
                  </span>
                </div>
                {!describeEliminationStructure(activeTournament.playerIds.length)
                  .isPowerOfTwo && (
                  <p className="text-[11px] text-[#26E6DE] max-w-3xl">
                    {
                      describeEliminationStructure(activeTournament.playerIds.length)
                        .summaryText
                    }
                  </p>
                )}
              </div>

              <div className="px-3.5 py-2 rounded-xl bg-black/30 border border-white/15 text-xs text-slate-200">
                Choose the winner & paste PGN directly on any active bracket game below, then click{' '}
                <strong className="text-emerald-400">Submit</strong>
              </div>
            </div>

            {/* Stage Column Headers Bar (BRKT | Play-In & Seeding | Quarter-Final | Semi-Final | Final) */}
            {(() => {
              const rounds = Array.from(
                new Set(activeTournament.matches.map((m) => m.round))
              ).sort((a, b) => a - b);

              const getRoundStageTitle = (rNum: number, totalR: number) => {
                const sampleMatch = activeTournament.matches.find((m) => m.round === rNum);
                if (sampleMatch?.stageLabel) return sampleMatch.stageLabel;
                if (rNum === totalR) return 'Final';
                if (rNum === totalR - 1) return 'Semi-Final';
                if (rNum === totalR - 2) return 'Quarter-Final';
                return `Round ${rNum} (Play-In)`;
              };

              return (
                <>
                  <div className="bg-slate-100 dark:bg-[#0B162C] border-b border-slate-200 dark:border-white/10 px-6 py-3 flex items-center gap-8 overflow-x-auto">
                    <div className="px-2 py-1 rounded border border-slate-400 dark:border-slate-600 text-[10px] font-mono-tabular font-extrabold uppercase text-slate-600 dark:text-slate-300 shrink-0 leading-none text-center">
                      <div>TABS</div>
                      <div className="border-t border-slate-400 dark:border-slate-600 mt-0.5 pt-0.5">
                        BRKT
                      </div>
                    </div>
                    <div className="flex items-center gap-8 sm:gap-14 min-w-max">
                      {rounds.map((rNum) => {
                        const rMatches = activeTournament.matches.filter(
                          (m) => m.round === rNum
                        );
                        const decidedCount = rMatches.filter((m) => m.result !== null).length;
                        return (
                          <div
                            key={rNum}
                            className="w-[248px] sm:w-[312px] text-center space-y-0.5"
                          >
                            <div className="text-[11px] sm:text-sm font-extrabold text-slate-700 dark:text-white">
                              R{rNum}: {getRoundStageTitle(rNum, rounds.length)}
                            </div>
                            <div className="text-[9px] sm:text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400">
                              {decidedCount}/{rMatches.length} Done
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Horizontal Bracket Tree Canvas */}
                  <div className="p-3 sm:p-8 overflow-x-auto bg-[#F8FAFC] dark:bg-[#061020]/90">
                    <div className="flex items-stretch gap-5 sm:gap-14 min-w-max">
                      {rounds.map((rNum, colIdx) => {
                        const roundMatches = activeTournament.matches.filter(
                          (m) => m.round === rNum
                        );
                        const isFinalRound = rNum === rounds.length;
                        const isSemiFinalRound = rNum === rounds.length - 1;

                        return (
                          <div
                            key={rNum}
                            className="flex flex-col justify-around gap-6 relative"
                          >
                            {roundMatches.map((m, idx) => (
                              <div key={m.id} className="relative flex items-center">
                                {colIdx > 0 && (
                                  <div
                                    aria-hidden="true"
                                    className="w-5 sm:w-8 h-[2px] bg-slate-300 dark:bg-slate-700 -ml-5 sm:-ml-8 shrink-0"
                                  />
                                )}

                                {renderBracketMatchCard(
                                  m,
                                  isFinalRound
                                    ? 'Final'
                                    : `${
                                        isSemiFinalRound ? 'SF' : 'QF'
                                      } · Game ${idx + 1}`,
                                  isFinalRound,
                                  isSemiFinalRound
                                )}

                                {colIdx < rounds.length - 1 && (
                                  <div
                                    aria-hidden="true"
                                    className="w-5 sm:w-8 h-[2px] bg-slate-300 dark:bg-slate-700 shrink-0"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* BELOW BRACKET: COMPLETED GAMES ARCHIVE + LIVE AUTO-UPDATING LEADERBOARD */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Completed Bracket Games */}
            <div className="lg:col-span-5 broadcast-panel p-4 sm:p-6 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <span className="text-xs font-mono-tabular uppercase text-emerald-400 font-bold">
                    COMPLETED BRACKET GAMES
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    Completed Matches ({endedMatchesArchive.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  Click any game to replay or edit PGN
                </span>
              </div>

              {endedMatchesArchive.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#061020]/50 text-xs text-slate-400 text-center">
                  No completed games yet. Select a winner and submit on any active bracket match above!
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {[...endedMatchesArchive].reverse().map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleMatchCardClick(m)}
                      className="p-3 rounded-xl bg-[#061020]/70 border border-white/10 hover:border-[#26E6DE]/50 transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                        <span className="text-[#26E6DE] font-bold">
                          {m.bracketCode || `Round ${m.round}`}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          COMPLETED · {m.result}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs font-bold text-white">
                        <span className={m.result === '1-0' ? 'text-[#FF6B00]' : ''}>
                          ⬜ {getMemberName(m.whiteId)}
                        </span>
                        <span className="font-mono-tabular text-slate-400">{m.result}</span>
                        <span className={m.result === '0-1' ? 'text-[#FF6B00]' : ''}>
                          ⬛ {getMemberName(m.blackId)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/8 text-[11px] font-mono-tabular text-slate-400">
                        <span className="truncate max-w-[200px]">
                          {m.pgn ? `PGN: ${m.pgn}` : 'Result Only (No PGN)'}
                        </span>
                        {m.pgn && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReplayMatchPgn(m, activeTournament);
                            }}
                            className="px-2 py-0.5 rounded bg-[#1E56A0] hover:bg-[#2563EB] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Play className="w-2.5 h-2.5" />
                            Replay
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Elimination Tournament Leaderboard */}
            <div className="lg:col-span-7 broadcast-panel p-4 sm:p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <span className="text-xs font-mono-tabular text-[#26E6DE] uppercase font-bold">
                    LIVE AUTO-UPDATING TOURNAMENT LEADERBOARD
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    {activeTournament.name} Standings ({activeTournament.timeControl.toUpperCase()})
                  </h3>
                </div>
                <span className="text-xs font-mono-tabular text-[#FF6B00] font-bold">
                  {standings.length} Players
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] font-mono-tabular uppercase text-slate-400 bg-[#061020]/60">
                      <th className="py-2.5 px-2.5">Rank</th>
                      <th className="py-2.5 px-2.5">Player</th>
                      <th className="py-2.5 px-2.5">Bracket Stage</th>
                      <th className="py-2.5 px-2.5 text-right">
                        {activeTournament.timeControl} Elo
                      </th>
                      <th className="py-2.5 px-2.5 text-right">Wins / Pts</th>
                      <th className="py-2.5 px-2.5 text-right">W-D-L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8 font-mono-tabular">
                    {standings.map((row, idx) => (
                      <tr key={row.memberId} className="hover:bg-white/5">
                        <td className="py-2.5 px-2.5 font-bold text-slate-300">#{idx + 1}</td>
                        <td className="py-2.5 px-2.5 font-sans">
                          <div className="font-bold text-white">{row.name}</div>
                          <div className="text-[11px] text-slate-400">{row.department}</div>
                        </td>
                        <td className="py-2.5 px-2.5 font-sans text-xs">
                          <span className="px-2 py-0.5 rounded bg-white/8 text-[#26E6DE] font-semibold">
                            {row.stageReached}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-slate-200">{row.rating}</td>
                        <td className="py-2.5 px-2.5 text-right font-extrabold text-[#FF6B00] text-sm">
                          {row.points.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-xs text-slate-300">
                          {row.wins}-{row.draws}-{row.losses}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================================
         * VIEW B: RANKING-BASED TOURNAMENT (Swiss, Round Robin, Scheveningen, Arena)
         * - Shows "Games Happening Now" with direct Winner/Draw buttons + PGN input field
         * - Automatically moves finished game to "Completed Games" & updates Leaderboard
         * - Automatically starts next round when all games in round finish
         * ============================================================================ */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: ACTIVE GAMES HAPPENING NOW + COMPLETED GAMES ARCHIVE */}
          <div className="lg:col-span-6 space-y-6">
            {/* Panel 1: Games Happening Now (Current Round Active Games) */}
            <div className="broadcast-panel p-4 sm:p-6 rounded-2xl space-y-4 border border-[#FF6B00]/40">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <span className="text-xs font-mono-tabular text-[#FF6B00] font-bold uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    ROUND {activeTournament.currentRound} OF {activeTournament.totalRounds} · GAMES HAPPENING NOW
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    Active Matches — Direct Winner / Draw & PGN Input
                  </h3>
                </div>

                {activeTournament.format === 'swiss' && activeMatchesNow.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onPairNextSwissRound(activeTournament.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Start Round {maxRound + 1}
                  </button>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#061020]/85 border border-[#26E6DE]/30 text-xs text-slate-200">
                For each active match below, click directly on <strong>White Won (1-0)</strong>,{' '}
                <strong>Draw (½-½)</strong>, or <strong>Black Won (0-1)</strong>, paste an optional PGN string in the input box, and click{' '}
                <strong className="text-emerald-400">Submit Result & PGN</strong>. The game moves automatically to Completed Games and updates the Leaderboard!
              </div>

              {activeMatchesNow.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#061020]/60 border border-emerald-400/30 text-center space-y-2">
                  <Award className="w-8 h-8 text-emerald-400 mx-auto" />
                  <div className="text-sm font-bold text-white">
                    All Games in This Tournament Are Completed!
                  </div>
                  <p className="text-xs text-slate-400">
                    Check the final standings on the Leaderboard or click any completed game below to review or edit its PGN.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activeMatchesNow.map((m, idx) => {
                    const wElo = getMemberElo(m.whiteId, activeTournament.timeControl);
                    const bElo = getMemberElo(m.blackId, activeTournament.timeControl);
                    const selectedOutcome = inlineSelectedResults[m.id] || '1-0';
                    const inlinePgn = inlinePgnStrings[m.id] ?? (m.pgn || '');

                    return (
                      <div
                        key={m.id}
                        className="p-4 rounded-xl bg-[#061020]/95 border-2 border-[#FF6B00]/60 shadow-lg space-y-3"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                          <span className="text-[#26E6DE] font-bold">
                            ROUND {m.round} OF {activeTournament.totalRounds} · BOARD #{idx + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-[#FF6B00]/20 border border-[#FF6B00]/50 text-[#FF6B00] font-bold">
                            ACTIVE MATCH
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-extrabold text-white">
                          <div className="truncate">
                            ⬜ {getMemberName(m.whiteId)}{' '}
                            <span className="font-mono-tabular text-xs text-slate-400 font-normal">
                              ({wElo})
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono-tabular text-[#FF6B00] shrink-0">
                            VS
                          </span>
                          <div className="truncate text-right">
                            ⬛ {getMemberName(m.blackId)}{' '}
                            <span className="font-mono-tabular text-xs text-slate-400 font-normal">
                              ({bElo})
                            </span>
                          </div>
                        </div>

                        {/* Direct Click to Choose Winner or Draw */}
                        <div className="grid grid-cols-3 gap-2 pt-1 font-mono-tabular">
                          <button
                            type="button"
                            onClick={() =>
                              setInlineSelectedResults((prev) => ({ ...prev, [m.id]: '1-0' }))
                            }
                            className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer truncate ${
                              selectedOutcome === '1-0'
                                ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-sm'
                                : 'bg-[#0B162C] text-slate-300 border-white/15 hover:border-white/30'
                            }`}
                          >
                            ⬜ {getMemberShortName(m.whiteId)} Won (1-0)
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setInlineSelectedResults((prev) => ({
                                ...prev,
                                [m.id]: '1/2-1/2',
                              }))
                            }
                            className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer truncate ${
                              selectedOutcome === '1/2-1/2'
                                ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-sm'
                                : 'bg-[#0B162C] text-slate-300 border-white/15 hover:border-white/30'
                            }`}
                          >
                            🤝 Draw (½-½)
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setInlineSelectedResults((prev) => ({ ...prev, [m.id]: '0-1' }))
                            }
                            className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer truncate ${
                              selectedOutcome === '0-1'
                                ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-sm'
                                : 'bg-[#0B162C] text-slate-300 border-white/15 hover:border-white/30'
                            }`}
                          >
                            ⬛ {getMemberShortName(m.blackId)} Won (0-1)
                          </button>
                        </div>

                        {/* Simple Inline Input Field to Paste PGN String + Submit */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                          <input
                            type="text"
                            aria-label="Paste PGN string"
                            value={inlinePgn}
                            onChange={(e) =>
                              setInlinePgnStrings((prev) => ({
                                ...prev,
                                [m.id]: e.target.value,
                              }))
                            }
                            placeholder="Paste PGN string here (optional, e.g. 1. e4 c5 2. Nf3 d6...)"
                            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#0B162C] border border-white/15 text-xs font-mono-tabular text-white placeholder:text-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              submitMatchOutcomeAndPgn(m, selectedOutcome, inlinePgn)
                            }
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 cursor-pointer shadow-md"
                          >
                            Submit Result & PGN
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Panel 2: Completed Games Archive */}
            <div className="broadcast-panel p-4 sm:p-6 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <span className="text-xs font-mono-tabular uppercase text-emerald-400 font-bold">
                    COMPLETED MATCH ARCHIVE
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    Completed Games ({endedMatchesArchive.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  Click any game to replay or edit PGN
                </span>
              </div>

              {endedMatchesArchive.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#061020]/50 text-xs text-slate-400 text-center">
                  No completed games yet. Submit an active game above to move it here!
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {[...endedMatchesArchive].reverse().map((m) => {
                    const wElo = getMemberElo(m.whiteId, activeTournament.timeControl);
                    const bElo = getMemberElo(m.blackId, activeTournament.timeControl);
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleMatchCardClick(m)}
                        className="p-3 rounded-xl bg-[#061020]/70 border border-white/10 hover:border-[#26E6DE]/50 transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                          <span className="text-slate-400">
                            Round {m.round} {m.stageLabel ? `· ${m.stageLabel}` : ''}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            COMPLETED · RESULT: {m.result}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-bold text-white">
                          <span
                            className={`truncate ${
                              m.result === '1-0' ? 'text-[#FF6B00]' : ''
                            }`}
                          >
                            ⬜ {getMemberName(m.whiteId)} ({wElo})
                          </span>
                          <span className="text-xs font-mono-tabular text-slate-400 shrink-0">
                            {m.result}
                          </span>
                          <span
                            className={`truncate text-right ${
                              m.result === '0-1' ? 'text-[#FF6B00]' : ''
                            }`}
                          >
                            ⬛ {getMemberName(m.blackId)} ({bElo})
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/8">
                          <span className="text-[11px] font-mono-tabular text-slate-400 truncate max-w-[220px]">
                            {m.pgn ? `PGN: ${m.pgn}` : 'Result Only (No PGN uploaded)'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {m.pgn && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReplayMatchPgn(m, activeTournament);
                                }}
                                className="px-2 py-1 rounded bg-[#1E56A0] hover:bg-[#2563EB] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Play className="w-2.5 h-2.5" />
                                Replay in Studio
                              </button>
                            )}
                            <span className="px-2 py-1 rounded bg-white/8 text-slate-300 text-[10px] font-semibold flex items-center gap-1">
                              <FileText className="w-2.5 h-2.5 text-[#FF6B00]" />
                              Edit Result / PGN
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: LIVE TOURNAMENT LEADERBOARD & TIEBREAKS */}
          <div className="lg:col-span-6 broadcast-panel p-4 sm:p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono-tabular text-[#26E6DE] uppercase font-bold">
                  LIVE AUTO-UPDATING LEADERBOARD · ROUND {activeTournament.currentRound} OF{' '}
                  {activeTournament.totalRounds}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  {activeTournament.name} Standings ({activeTournament.timeControl.toUpperCase()})
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-[#FF6B00] font-bold">
                {standings.length} Players
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-mono-tabular uppercase text-slate-400 bg-[#061020]/60">
                    <th className="py-2.5 px-2.5">Rank</th>
                    <th className="py-2.5 px-2.5">Player</th>
                    <th className="py-2.5 px-2.5 text-right">
                      {activeTournament.timeControl} Elo
                    </th>
                    <th className="py-2.5 px-2.5 text-right">Pts</th>
                    <th className="py-2.5 px-2.5 text-right">W-D-L</th>
                    <th className="py-2.5 px-2.5 text-right">Buchholz</th>
                    <th className="py-2.5 px-2.5 text-right">S-B</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 font-mono-tabular">
                  {standings.map((row, idx) => (
                    <tr key={row.memberId} className="hover:bg-white/5">
                      <td className="py-3 px-2.5 font-bold text-slate-400">#{idx + 1}</td>
                      <td className="py-3 px-2.5 font-sans">
                        <div className="font-bold text-white">{row.name}</div>
                        <div className="text-xs text-slate-400">{row.department}</div>
                      </td>
                      <td className="py-3 px-2.5 text-right text-slate-200">{row.rating}</td>
                      <td className="py-3 px-2.5 text-right font-extrabold text-[#FF6B00] text-base">
                        {row.points.toFixed(1)}
                      </td>
                      <td className="py-3 px-2.5 text-right text-xs text-slate-300">
                        {row.wins}-{row.draws}-{row.losses}
                      </td>
                      <td className="py-3 px-2.5 text-right font-semibold text-slate-200">
                        {row.buchholz.toFixed(1)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-semibold text-[#26E6DE]">
                        {row.sonnebornBerger.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
       * TOURNAMENT HISTORY: PAST COMPLETED TOURNAMENTS, WINNERS & FINAL STANDINGS
       * ============================================================================ */}
      <div
        id="tournament-history-section"
        className="broadcast-panel p-5 sm:p-7 rounded-3xl border border-white/15 space-y-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              OFFICIAL HALL OF CHAMPIONS & ARCHIVE
            </span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
              Tournament History — Past Completed Championships & Final Standings
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Complete record of finished club tournaments, crowned champions, podium medalists, and final standings. Any active tournament automatically moves here once all rounds conclude.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-[#061020]/80 border border-white/10 text-xs font-mono-tabular text-[#26E6DE] font-bold">
              {completedTournaments.length} Completed{' '}
              {completedTournaments.length === 1 ? 'Tournament' : 'Tournaments'}
            </div>

            {isAdminOrOwner && completedTournaments.length > 0 && onClearTournamentHistory && (
              <button
                type="button"
                onClick={() => {
                  onClearTournamentHistory();
                  setToastBanner('Cleared all completed tournaments from Tournament History.');
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Tournament History</span>
              </button>
            )}
          </div>
        </div>

        {completedTournaments.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#061020]/60 border border-white/10 text-center space-y-2">
            <Award className="w-9 h-9 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-white">No Completed Tournaments Yet</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Finish all rounds in an active tournament above to crown a champion and archive the final standings here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {completedTournaments.map((histTourney) => {
              const finalRows = getFinalStandingsForTournament(histTourney);
              const winnerRow = finalRows[0] || null;
              const runnerUpRow = finalRows[1] || null;
              const thirdPlaceRow = finalRows[2] || null;
              const winnerMember = winnerRow ? getMember(winnerRow.memberId) : undefined;
              const isElim =
                histTourney.format === 'knockout' ||
                histTourney.format === 'double_elimination';
              const isCurrentlySelected = activeTournament?.id === histTourney.id;

              return (
                <div
                  key={histTourney.id}
                  className="rounded-2xl bg-[#061020]/85 border border-white/12 overflow-hidden shadow-xl space-y-5 p-4 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono-tabular text-[10px] font-bold uppercase flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed Championship
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-[#1E56A0]/40 text-[#26E6DE] font-mono-tabular text-[10px] font-bold uppercase">
                          {FORMAT_LABELS[histTourney.format]?.title || histTourney.format}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-[#FF6B00]/20 text-[#FF6B00] font-mono-tabular text-[10px] font-bold uppercase">
                          {histTourney.timeControl} Elo
                        </span>
                        <span className="text-xs font-mono-tabular text-slate-400">
                          Concluded: {histTourney.createdAt}
                        </span>
                      </div>

                      <h4 className="text-lg sm:text-xl font-extrabold text-white">
                        {histTourney.name}
                      </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTournamentId(histTourney.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                          isCurrentlySelected
                            ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200'
                            : 'bg-[#1E56A0] hover:bg-[#2563EB] text-white shadow-md'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>
                          {isCurrentlySelected
                            ? 'Viewing Above'
                            : isElim
                            ? 'Inspect Full Bracket & PGNs'
                            : 'Inspect Games & PGNs'}
                        </span>
                      </button>

                      {isAdminOrOwner && onDeleteTournament && (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteTournament(histTourney.id);
                            setToastBanner(
                              `Deleted "${histTourney.name}" from Tournament History.`
                            );
                          }}
                          className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete from History</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {winnerRow && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                      <div className="lg:col-span-6 p-4 rounded-2xl bg-gradient-to-r from-[#F59E0B]/20 via-[#FF6B00]/15 to-[#0B1D36] border border-[#F59E0B]/50 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative shrink-0">
                            {winnerMember?.avatarUrl ? (
                              <img
                                src={resolveAssetUrl(winnerMember.avatarUrl)}
                                alt={winnerRow.name}
                                referrerPolicy="no-referrer"
                                className="w-14 h-14 rounded-2xl object-cover border-2 border-[#F59E0B] shadow-lg"
                              />
                            ) : (
                              <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-extrabold text-white border-2 border-[#F59E0B]"
                                style={{
                                  backgroundColor: winnerMember?.avatarColor || '#FF6B00',
                                }}
                              >
                                {winnerMember?.avatarInitials || 'CH'}
                              </div>
                            )}
                            <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#F59E0B] text-slate-950 font-mono-tabular font-extrabold text-xs flex items-center justify-center shadow">
                              1
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="text-[11px] font-mono-tabular uppercase font-extrabold text-[#F59E0B] flex items-center gap-1">
                              <Trophy className="w-3.5 h-3.5" />
                              TOURNAMENT WINNER · CHAMPION
                            </div>
                            <div className="text-base sm:text-lg font-extrabold text-white truncate">
                              {winnerRow.name}
                            </div>
                            <div className="text-xs text-slate-300 truncate">
                              {winnerRow.department} ·{' '}
                              <span className="font-mono-tabular text-[#26E6DE] font-semibold">
                                {winnerRow.rating} {histTourney.timeControl.toUpperCase()} Elo
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono-tabular shrink-0">
                          <div className="text-xl sm:text-2xl font-extrabold text-[#F59E0B]">
                            {winnerRow.points.toFixed(1)} pts
                          </div>
                          <div className="text-[11px] text-slate-300">
                            {winnerRow.wins}W-{winnerRow.draws}D-{winnerRow.losses}L
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {runnerUpRow && (
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-slate-400/30 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-mono-tabular font-extrabold text-xs flex items-center justify-center shrink-0">
                                2
                              </span>
                              <div className="min-w-0">
                                <div className="text-[10px] font-mono-tabular uppercase text-slate-300 font-bold">
                                  2ND PLACE · RUNNER-UP
                                </div>
                                <div className="text-sm font-bold text-white truncate">
                                  {runnerUpRow.name}
                                </div>
                                <div className="text-[11px] font-mono-tabular text-slate-400">
                                  {runnerUpRow.rating} Elo
                                </div>
                              </div>
                            </div>
                            <div className="text-right font-mono-tabular shrink-0">
                              <div className="text-sm font-extrabold text-white">
                                {runnerUpRow.points.toFixed(1)} pts
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {runnerUpRow.wins}W-{runnerUpRow.draws}D-{runnerUpRow.losses}L
                              </div>
                            </div>
                          </div>
                        )}

                        {thirdPlaceRow && (
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-[#D97706]/40 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-7 h-7 rounded-full bg-[#D97706] text-white font-mono-tabular font-extrabold text-xs flex items-center justify-center shrink-0">
                                3
                              </span>
                              <div className="min-w-0">
                                <div className="text-[10px] font-mono-tabular uppercase text-[#F59E0B] font-bold">
                                  3RD PLACE · BRONZE
                                </div>
                                <div className="text-sm font-bold text-white truncate">
                                  {thirdPlaceRow.name}
                                </div>
                                <div className="text-[11px] font-mono-tabular text-slate-400">
                                  {thirdPlaceRow.rating} Elo
                                </div>
                              </div>
                            </div>
                            <div className="text-right font-mono-tabular shrink-0">
                              <div className="text-sm font-extrabold text-white">
                                {thirdPlaceRow.points.toFixed(1)} pts
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {thirdPlaceRow.wins}W-{thirdPlaceRow.draws}D-{thirdPlaceRow.losses}L
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-[11px] font-mono-tabular uppercase text-slate-400 bg-[#0B162C]">
                          <th className="py-2.5 px-3">Final Rank</th>
                          <th className="py-2.5 px-3">Player</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Title / Stage</th>
                          <th className="py-2.5 px-3 text-right">
                            {histTourney.timeControl} Elo
                          </th>
                          <th className="py-2.5 px-3 text-right">Points</th>
                          <th className="py-2.5 px-3 text-right">W-D-L</th>
                          <th className="py-2.5 px-3 text-right">Buchholz</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/8 font-mono-tabular">
                        {finalRows.map((row, idx) => {
                          const isChamp = idx === 0;
                          return (
                            <tr
                              key={row.memberId}
                              className={
                                isChamp
                                  ? 'bg-[#F59E0B]/10 hover:bg-[#F59E0B]/15'
                                  : 'hover:bg-white/5'
                              }
                            >
                              <td className="py-2.5 px-3 font-extrabold">
                                {idx === 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[#F59E0B]">
                                    <Trophy className="w-3.5 h-3.5" /> #1
                                  </span>
                                ) : idx === 1 ? (
                                  <span className="text-slate-200">#2</span>
                                ) : idx === 2 ? (
                                  <span className="text-[#D97706]">#3</span>
                                ) : (
                                  <span className="text-slate-400">#{idx + 1}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-sans font-bold text-white">
                                {row.name}
                              </td>
                              <td className="py-2.5 px-3 font-sans text-xs text-slate-400">
                                {row.department}
                              </td>
                              <td className="py-2.5 px-3 font-sans text-xs">
                                <span
                                  className={`px-2 py-0.5 rounded font-semibold ${
                                    idx === 0
                                      ? 'bg-[#F59E0B]/25 text-[#F59E0B]'
                                      : idx === 1
                                      ? 'bg-slate-400/20 text-slate-200'
                                      : idx === 2
                                      ? 'bg-[#D97706]/20 text-[#F59E0B]'
                                      : 'bg-white/5 text-slate-400'
                                  }`}
                                >
                                  {row.stageReached}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-200">
                                {row.rating}
                              </td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-[#FF6B00]">
                                {row.points.toFixed(1)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-xs text-slate-300">
                                {row.wins}-{row.draws}-{row.losses}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-300">
                                {row.buchholz.toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE TOURNAMENT, CHOOSE NUMBER OF ROUNDS & FAIR NON-POWER-OF-2 SEEDING */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-tourney-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0B1D36] rounded-2xl border border-white/15 max-w-xl w-full p-6 space-y-4 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
                  COMPUTER SEEDING, CUSTOM ROUNDS & EQUAL-CHANCE PLAY-IN ENGINE
                </span>
                <h3 id="create-tourney-title" className="text-lg font-extrabold text-white">
                  Create Automated Club Tournament
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-xs text-rose-200 font-semibold">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tournament Name
                </label>
                <input
                  type="text"
                  value={newTourneyName}
                  onChange={(e) => setNewTourneyName(e.target.value)}
                  placeholder="e.g., ENP Spring Knockout Cup"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-white/15 bg-[#061020] text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tournament Format
                  </label>
                  <select
                    value={newFormat}
                    onChange={(e) => setNewFormat(e.target.value as TournamentFormat)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
                  >
                    <option value="knockout">
                      1. Single-Elimination Bracket (Play-In → QF → SF → Final)
                    </option>
                    <option value="swiss">2. Swiss Ranking System (Auto-Round 2, 3...)</option>
                    <option value="round_robin">
                      3. Single Round Robin (Ranking All-Play-All)
                    </option>
                    <option value="double_round_robin">
                      4. Double Round Robin (Home & Away)
                    </option>
                    <option value="scheveningen">5. Scheveningen Team Clash</option>
                    <option value="arena">6. Timed Club Arena</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Time Control (Elo Rating Used)
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-[#061020] p-1 rounded-xl border border-white/15">
                    {(['rapid', 'blitz', 'classical'] as const).map((tc) => (
                      <button
                        key={tc}
                        type="button"
                        onClick={() => setNewTimeControl(tc)}
                        className={`py-1.5 rounded-lg text-xs font-bold uppercase font-mono-tabular cursor-pointer ${
                          newTimeControl === tc
                            ? 'bg-[#FF6B00] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CHOOSE NUMBER OF ROUNDS CONTROL */}
              <div className="p-3.5 rounded-xl bg-[#061020] border border-white/15 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#FF6B00]" />
                    Number of Tournament Rounds
                  </label>
                  {newFormat === 'knockout' || newFormat === 'double_elimination' ? (
                    <span className="px-2 py-0.5 rounded bg-[#FF6B00]/20 text-[#FF6B00] font-mono-tabular text-[11px] font-bold">
                      {eliminationStructurePreview.totalBracketRounds} Bracket Rounds (Auto-Fair for{' '}
                      {selectedPlayerIds.length} Players)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-[#26E6DE]/20 text-[#26E6DE] font-mono-tabular text-[11px] font-bold">
                      {newCustomRounds} Rounds Selected
                    </span>
                  )}
                </div>

                {newFormat === 'knockout' || newFormat === 'double_elimination' ? (
                  <div className="p-2.5 rounded-lg bg-[#0B162C] border border-[#26E6DE]/35 text-[11px] text-slate-200 leading-relaxed">
                    <strong className="text-[#26E6DE]">
                      Equal-Chance Elimination Solution ({selectedPlayerIds.length} Players):
                    </strong>{' '}
                    {eliminationStructurePreview.summaryText}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((rCount) => (
                      <button
                        key={rCount}
                        type="button"
                        onClick={() => setNewCustomRounds(rCount)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono-tabular font-bold cursor-pointer border transition-all ${
                          newCustomRounds === rCount
                            ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                            : 'bg-[#0B162C] text-slate-300 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {rCount} Rounds
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#26E6DE]" />
                    Select Participating Players ({selectedPlayerIds.length} Selected)
                  </label>
                  <div className="flex items-center gap-3">
                    {members.length >= 8 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPlayerIds(members.slice(0, 8).map((m) => m.id))
                        }
                        className="text-[11px] font-semibold text-[#FF6B00] hover:underline cursor-pointer"
                      >
                        Top 8 Players
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPlayerIds(
                          selectedPlayerIds.length === members.length
                            ? []
                            : members.map((m) => m.id)
                        )
                      }
                      className="text-[11px] font-semibold text-[#26E6DE] hover:underline cursor-pointer"
                    >
                      {selectedPlayerIds.length === members.length
                        ? 'Clear All'
                        : `Select All (${members.length})`}
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto p-2 rounded-xl bg-[#061020] border border-white/15 space-y-1.5">
                  {members.map((m) => {
                    const checked = selectedPlayerIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          checked ? 'bg-[#1E56A0]/35 text-white' : 'text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleTogglePlayerSelection(m.id)}
                            className="rounded accent-[#FF6B00]"
                          />
                          <span className="font-bold">{m.name}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            ({m.department})
                          </span>
                        </div>
                        <span className="font-mono-tabular text-[#26E6DE] shrink-0">
                          {m.fide[newTimeControl]} {newTimeControl.toUpperCase()} Elo
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
                >
                  <Cpu className="w-4 h-4" />
                  Create Tournament ({selectedPlayerIds.length} Players)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT / RECORD MATCH RESULT & PGN */}
      {activeMatchForPgn && activeTournament && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-match-pgn-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0B1D36] rounded-2xl border border-white/15 max-w-lg w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold">
                  {activeTournament.name} ·{' '}
                  {activeMatchForPgn.bracketCode || `ROUND ${activeMatchForPgn.round}`}
                </span>
                <h3 id="record-match-pgn-title" className="text-lg font-extrabold text-white">
                  {isEliminationFormat
                    ? 'Choose Match Winner & Paste Optional PGN'
                    : 'Choose Winner or Draw & Paste Optional PGN'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveMatchForPgn(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMatchPgn} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#061020] border border-white/10 flex items-center justify-between text-xs sm:text-sm font-bold">
                <span>
                  ⬜ {getMemberName(activeMatchForPgn.whiteId)} (
                  {getMemberElo(activeMatchForPgn.whiteId, activeTournament.timeControl)})
                </span>
                <Swords className="w-4 h-4 text-[#FF6B00] shrink-0" />
                <span>
                  ⬛ {getMemberName(activeMatchForPgn.blackId)} (
                  {getMemberElo(activeMatchForPgn.blackId, activeTournament.timeControl)})
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isEliminationFormat
                    ? 'Select Elimination Match Winner (Advances to Next Bracket Round)'
                    : 'Select Match Result (Moves Game to Completed & Updates Leaderboard)'}
                </label>
                <div
                  className={`grid ${
                    isEliminationFormat ? 'grid-cols-2' : 'grid-cols-3'
                  } gap-2 font-mono-tabular`}
                >
                  <button
                    type="button"
                    onClick={() => setMatchResultInput('1-0')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      matchResultInput === '1-0'
                        ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-md'
                        : 'bg-[#061020] text-slate-300 border-white/15 hover:border-white/30'
                    }`}
                  >
                    ⬜ {getMemberShortName(activeMatchForPgn.whiteId)} Won (1-0)
                  </button>

                  {!isEliminationFormat && (
                    <button
                      type="button"
                      onClick={() => setMatchResultInput('1/2-1/2')}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        matchResultInput === '1/2-1/2'
                          ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-md'
                          : 'bg-[#061020] text-slate-300 border-white/15 hover:border-white/30'
                      }`}
                    >
                      🤝 Draw (½-½)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setMatchResultInput('0-1')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      matchResultInput === '0-1'
                        ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-md'
                        : 'bg-[#061020] text-slate-300 border-white/15 hover:border-white/30'
                    }`}
                  >
                    ⬛ {getMemberShortName(activeMatchForPgn.blackId)} Won (0-1)
                  </button>
                </div>
              </div>

              {modalEloPreview && modalWhite && modalBlack && (
                <div className="p-3 rounded-xl bg-[#061020]/90 border border-[#26E6DE]/30 flex items-center justify-between text-xs font-mono-tabular">
                  <div>
                    <span className="text-slate-400">⬜ {modalWhite.name}: </span>
                    <span className="font-bold text-white">{modalEloPreview.whiteNew}</span>
                    <span
                      className={`ml-1 font-bold ${
                        modalEloPreview.whiteDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ({modalEloPreview.whiteDelta >= 0 ? '+' : ''}
                      {modalEloPreview.whiteDelta})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">⬛ {modalBlack.name}: </span>
                    <span className="font-bold text-white">{modalEloPreview.blackNew}</span>
                    <span
                      className={`ml-1 font-bold ${
                        modalEloPreview.blackDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ({modalEloPreview.blackDelta >= 0 ? '+' : ''}
                      {modalEloPreview.blackDelta})
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Paste Game PGN (Optional — Leave blank if you only want to record the winner/draw)
                </label>
                <textarea
                  rows={3}
                  value={matchPgnInput}
                  onChange={(e) => setMatchPgnInput(e.target.value)}
                  placeholder="Optional: Paste PGN moves here (e.g. 1. e4 c5 2. Nf3 d6 ...) or leave empty for Result Only"
                  className="w-full px-3 py-2 text-xs font-mono-tabular rounded-xl border border-white/15 bg-[#061020] text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveMatchForPgn(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
                >
                  {isEliminationFormat
                    ? 'Save Winner & Advance Bracket'
                    : 'Save Result, Move to Completed & Update Leaderboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
