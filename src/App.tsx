import React, { useState, useEffect } from 'react';
import {
  ClubChatMessage,
  ClubGenerationRecord,
  ClubMember,
  ClubPost,
  ClubRoleDivision,
  ClubThemeConfig,
  ClubTournament,
  INITIAL_CHAT_MESSAGES,
  INITIAL_CLUB_POSTS,
  INITIAL_LOGGED_GAMES,
  INITIAL_MEMBERS,
  INITIAL_OWNERSHIP_LINEAGE,
  INITIAL_TOURNAMENTS,
  LoggedClubGame,
  MODULE_BACKGROUNDS_4K,
  MemberLiveStatus,
  UNIVERSITY_PRESETS,
  UserRole,
} from './utils/clubData';
import {
  MatchOutcome,
  MatchStakes,
  TimeControl,
  TournamentFormat,
  advanceEliminationBracket,
  calculateSwissStandings,
  generateAutomatedTournamentMatches,
  generateNextSwissPairings,
  previewEloMatch,
  detectOpeningFromPgn,
} from './utils/chessEngine';
import { BroadcastHero } from './components/BroadcastHero';
import { MemberProfileView } from './components/MemberProfileView';
import { ChessboardStudio } from './components/ChessboardStudio';
import { TournamentManager } from './components/TournamentManager';
import { FreeHourRadar } from './components/FreeHourRadar';
import { ClubChatHub } from './components/ClubChatHub';
import { ClubCustomizerSpec } from './components/ClubCustomizerSpec';
import { ClubLogoBadge } from './components/ClubLogoBadge';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  Grid,
  Trophy,
  Calendar,
  MessageSquare,
  Settings,
  Smartphone,
  ChevronRight,
  X,
  Shield,
  LogIn,
  LogOut,
  Megaphone,
  PlusCircle,
  CheckCircle2,
  Key,
  Lock,
  Sun,
  Moon,
  Monitor,
  Palette,
} from 'lucide-react';

type ActiveModule =
  | 'overview'
  | 'members'
  | 'studio'
  | 'tournaments'
  | 'lounge'
  | 'radar'
  | 'customizer';

export type SiteVisualTheme = 'dark' | 'light' | 'basic' | 'emerald';

const STORAGE_KEY_THEME = 'enp_chess_club_theme_v4';
const STORAGE_KEY_VISUAL_MODE = 'enp_chess_site_visual_theme_v1';

const VISUAL_THEME_OPTIONS: {
  id: SiteVisualTheme;
  label: string;
  shortLabel: string;
  desc: string;
}[] = [
  {
    id: 'dark',
    label: 'Polytechnic Dark',
    shortLabel: 'Dark',
    desc: 'ENP Midnight Navy & Orange',
  },
  {
    id: 'light',
    label: 'Daylight Paper',
    shortLabel: 'Light',
    desc: 'Clean Alabaster & Navy Ink',
  },
  {
    id: 'basic',
    label: 'Basic Minimal',
    shortLabel: 'Basic',
    desc: 'Flat Matte Slate (No Grid)',
  },
  {
    id: 'emerald',
    label: 'Tournament Green',
    shortLabel: 'Classic',
    desc: 'OTB Forest & Gold',
  },
];

export default function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('overview');
  const [showHeroInWorkspace, setShowHeroInWorkspace] = useState<boolean>(false);
  const [androidPreviewMode, setAndroidPreviewMode] = useState<boolean>(false);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);
  const [siteTheme, setSiteTheme] = useState<SiteVisualTheme>(() => {
    try {
      const savedMode = localStorage.getItem(STORAGE_KEY_VISUAL_MODE) as SiteVisualTheme | null;
      if (
        savedMode === 'dark' ||
        savedMode === 'light' ||
        savedMode === 'basic' ||
        savedMode === 'emerald'
      ) {
        return savedMode;
      }
    } catch {
      // ignore storage error
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', siteTheme);
    if (siteTheme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEY_VISUAL_MODE, siteTheme);
    } catch {
      // ignore
    }
  }, [siteTheme]);

  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  // Multi-Club State
  const [clubs, setClubs] = useState<ClubThemeConfig[]>(UNIVERSITY_PRESETS);
  const [clubConfig, setClubConfig] = useState<ClubThemeConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved) {
        const parsed = JSON.parse(saved);
        const isLegacyLogo =
          !parsed.customLogoUrl ||
          parsed.customLogoUrl.includes('image_86d0bd89') ||
          parsed.customLogoUrl.includes('image_0e881c10') ||
          parsed.customLogoUrl.includes('image_939bef2c');
        const isLegacySchoolLogo =
          !parsed.schoolLogoUrl || parsed.schoolLogoUrl.includes('image_2c67fe86');
        const isLegacyBanner =
          !parsed.clubBannerUrl || parsed.clubBannerUrl.includes('image_86d0bd89');

        const isDeletedOtherClub =
          parsed.clubId && parsed.clubId !== UNIVERSITY_PRESETS[0].clubId;
        if (isDeletedOtherClub) {
          return UNIVERSITY_PRESETS[0];
        }

        return {
          ...UNIVERSITY_PRESETS[0],
          ...parsed,
          customLogoUrl: isLegacyLogo
            ? UNIVERSITY_PRESETS[0].customLogoUrl
            : parsed.customLogoUrl,
          schoolLogoUrl: isLegacySchoolLogo
            ? UNIVERSITY_PRESETS[0].schoolLogoUrl
            : parsed.schoolLogoUrl,
          clubBannerUrl: isLegacyBanner
            ? UNIVERSITY_PRESETS[0].clubBannerUrl
            : parsed.clubBannerUrl,
        };
      }
    } catch {
      // ignore storage error
    }
    return UNIVERSITY_PRESETS[0];
  });

  // Core Data State
  const [members, setMembers] = useState<ClubMember[]>(INITIAL_MEMBERS);
  const [loggedGames, setLoggedGames] = useState<LoggedClubGame[]>(INITIAL_LOGGED_GAMES);
  const [posts, setPosts] = useState<ClubPost[]>(INITIAL_CLUB_POSTS);
  const [tournaments, setTournaments] = useState<ClubTournament[]>(INITIAL_TOURNAMENTS);
  const [chatMessages, setChatMessages] = useState<ClubChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [ownershipLineage, setOwnershipLineage] = useState<ClubGenerationRecord[]>(
    INITIAL_OWNERSHIP_LINEAGE
  );
  const [initialDmTargetId, setInitialDmTargetId] = useState<string | null>(null);

  // Auth & Role State (Default to Owner so user can immediately test all features, with 1-click Login/Role Switcher)
  const [currentUserId, setCurrentUserId] = useState<string | null>('enp-owner');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // Quick Home Post Modal State (for Admins on Overview)
  const [isQuickPostModalOpen, setIsQuickPostModalOpen] = useState<boolean>(false);
  const [quickPostTitle, setQuickPostTitle] = useState<string>('');
  const [quickPostCategory, setQuickPostCategory] = useState<ClubPost['category']>('Club News');
  const [quickPostBody, setQuickPostBody] = useState<string>('');

  const currentUser = members.find((m) => m.id === currentUserId) || null;
  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  // Scoped Data for the Active Club
  const clubMembers = members.filter((m) => m.clubId === clubConfig.clubId);
  const clubGames = loggedGames.filter((g) => g.clubId === clubConfig.clubId);
  const approvedClubGames = clubGames.filter((g) => g.status === 'approved');
  const pendingClubGames = clubGames.filter((g) => g.status === 'pending');
  const clubPosts = posts.filter((p) => p.clubId === clubConfig.clubId);
  const clubTournaments = tournaments.filter((t) => t.clubId === clubConfig.clubId);
  const clubChatMessages = chatMessages.filter((m) => m.clubId === clubConfig.clubId);

  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    clubMembers[0]?.id || INITIAL_MEMBERS[0].id
  );
  const [studioGame, setStudioGame] = useState<LoggedClubGame | null>(
    approvedClubGames[0] || INITIAL_LOGGED_GAMES[0] || null
  );

  // Ensure selectedMemberId stays within the active club when switching clubs
  useEffect(() => {
    const inClub = members.filter((m) => m.clubId === clubConfig.clubId);
    if (inClub.length > 0 && !inClub.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(inClub[0].id);
    }
  }, [clubConfig.clubId, members, selectedMemberId]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', clubConfig.primaryColor);
    root.style.setProperty('--brand-secondary', clubConfig.secondaryColor);
    root.style.setProperty('--brand-accent', clubConfig.accentColor);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify(clubConfig));
    } catch {
      // ignore storage quota errors
    }
  }, [clubConfig]);

  // Helper to persist to Firestore best-effort when authenticated
  const syncDocToFirestore = async (
    collectionPath: string,
    docId: string,
    data: Record<string, unknown>
  ) => {
    try {
      if (auth.currentUser) {
        await setDoc(doc(db, collectionPath, docId), data, { merge: true });
      }
    } catch {
      // fallback to local state when using club username/password session
    }
  };

  // --- AUTHENTICATION HANDLERS ---
  const handleCredentialLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const u = loginUsername.trim().toLowerCase();
    const p = loginPassword.trim();
    const found = members.find(
      (m) => m.username.toLowerCase() === u && m.passwordCode === p
    );
    if (!found) {
      setLoginError('Invalid username or password code. Check credentials or use Quick Switch below.');
      return;
    }
    setCurrentUserId(found.id);
    // Switch to the member's club if different
    const memberClub = clubs.find((c) => c.clubId === found.clubId);
    if (memberClub) {
      setClubConfig(memberClub);
    }
    setLoginUsername('');
    setLoginPassword('');
    setLoginError('');
    setIsAuthModalOpen(false);
  };

  const handleGoogleLogin = async () => {
    try {
      setLoginError('');
      const cred = await signInWithPopup(auth, googleProvider);
      const email = cred.user.email?.toLowerCase();
      if (email === 'fethallah2411@gmail.com') {
        setCurrentUserId('enp-owner');
      } else {
        const matched = members.find((m) => m.email?.toLowerCase() === email);
        if (matched) {
          setCurrentUserId(matched.id);
        } else {
          // Create a new member profile for Google user in the active club
          const newId = `google-${cred.user.uid.slice(0, 6)}`;
          const newMember: ClubMember = {
            id: newId,
            clubId: clubConfig.clubId,
            name: cred.user.displayName || 'Club Member',
            arabicName: 'عضو نادي الشطرنج',
            username: (cred.user.email?.split('@')[0] || 'member').toLowerCase(),
            passwordCode: 'google-auth',
            email: cred.user.email || undefined,
            role: 'member',
            university: clubConfig.universityName,
            department: 'Polytechnic Engineering',
            yearLevel: 'Ingénieur',
            titleBadge: 'Verified Member',
            liveStatus: 'online_ready',
            bio: 'Signed in via Google Authentication.',
            avatarUrl: cred.user.photoURL || undefined,
            avatarInitials: (cred.user.displayName || 'CM').slice(0, 2).toUpperCase(),
            avatarColor: clubConfig.accentColor,
            joinedDate: 'Nov 2026',
            fide: {
              rapid: 1500,
              blitz: 1500,
              classical: 1500,
              peak: 1500,
              delta30d: 0,
              gamesPlayed: 0,
            },
            glicko2: {
              rapid: { rating: 1500, rd: 110, vol: 0.06 },
              blitz: { rating: 1500, rd: 110, vol: 0.06 },
              classical: { rating: 1500, rd: 110, vol: 0.06 },
            },
            ratingHistory: [
              {
                date: '2026-11',
                event: 'Club Seed',
                fide: 1500,
                glicko: 1500,
                opponent: 'Baseline',
                result: 'D',
              },
            ],
            openings: [],
            freeSlots: ['0-11', '2-12'],
          };
          setMembers((prev) => [newMember, ...prev]);
          setCurrentUserId(newId);
        }
      }
      setIsAuthModalOpen(false);
    } catch {
      setLoginError('Google Sign-In popup was closed or blocked. You can also sign in with Club Username & Password.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setCurrentUserId(null);
    setIsAuthModalOpen(false);
  };

  // --- ELO, OPENING & GAME DATABASE HANDLERS ---
  const mergeMemberOpeningStat = (
    existingOpenings: ClubMember['openings'],
    opInfo: { name: string; eco: string } | null,
    color: 'white' | 'black',
    result: 'W' | 'D' | 'L'
  ): ClubMember['openings'] => {
    if (!opInfo) return existingOpenings;
    const list = [...existingOpenings];
    const idx = list.findIndex(
      (o) => o.name.toLowerCase() === opInfo.name.toLowerCase() && o.color === color
    );
    if (idx >= 0) {
      const cur = list[idx];
      list[idx] = {
        ...cur,
        wins: cur.wins + (result === 'W' ? 1 : 0),
        draws: cur.draws + (result === 'D' ? 1 : 0),
        losses: cur.losses + (result === 'L' ? 1 : 0),
      };
    } else {
      list.push({
        name: opInfo.name,
        eco: opInfo.eco,
        color,
        wins: result === 'W' ? 1 : 0,
        draws: result === 'D' ? 1 : 0,
        losses: result === 'L' ? 1 : 0,
      });
    }
    return list.sort((a, b) => b.wins + b.draws + b.losses - (a.wins + a.draws + a.losses));
  };

  const applyApprovedGameElo = (
    whiteId: string,
    blackId: string,
    outcome: MatchOutcome,
    timeControl: TimeControl,
    eventLabel: string,
    stakes: MatchStakes = 'competitive',
    pgn?: string,
    openingHint?: string
  ) => {
    const white = members.find((m) => m.id === whiteId);
    const black = members.find((m) => m.id === blackId);
    if (!white || !black) return { whiteDelta: 0, blackDelta: 0 };

    const preview = previewEloMatch(
      white.fide[timeControl],
      black.fide[timeControl],
      outcome,
      white.fide.gamesPlayed,
      black.fide.gamesPlayed,
      stakes
    );

    const detectedOpening = detectOpeningFromPgn(pgn, openingHint);
    const whiteRes: 'W' | 'D' | 'L' = outcome === 1 ? 'W' : outcome === 0 ? 'L' : 'D';
    const blackRes: 'W' | 'D' | 'L' = outcome === 0 ? 'W' : outcome === 1 ? 'L' : 'D';

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === white.id) {
          const nextOpenings = mergeMemberOpeningStat(m.openings, detectedOpening, 'white', whiteRes);
          const topOpening = nextOpenings[0]?.name;
          return {
            ...m,
            openings: nextOpenings,
            signatureOpening: topOpening || m.signatureOpening,
            fide: {
              ...m.fide,
              [timeControl]: preview.whiteNew,
              peak: Math.max(m.fide.peak, preview.whiteNew),
              delta30d: m.fide.delta30d + preview.whiteDelta,
              gamesPlayed: m.fide.gamesPlayed + 1,
            },
            ratingHistory: [
              ...m.ratingHistory,
              {
                date: '2026-11',
                event: eventLabel,
                fide: preview.whiteNew,
                glicko: preview.whiteNew,
                opponent: black.name,
                result: whiteRes,
                timeControl,
              },
            ],
          };
        }
        if (m.id === black.id) {
          const nextOpenings = mergeMemberOpeningStat(m.openings, detectedOpening, 'black', blackRes);
          const topOpening = nextOpenings[0]?.name;
          return {
            ...m,
            openings: nextOpenings,
            signatureOpening: topOpening || m.signatureOpening,
            fide: {
              ...m.fide,
              [timeControl]: preview.blackNew,
              peak: Math.max(m.fide.peak, preview.blackNew),
              delta30d: m.fide.delta30d + preview.blackDelta,
              gamesPlayed: m.fide.gamesPlayed + 1,
            },
            ratingHistory: [
              ...m.ratingHistory,
              {
                date: '2026-11',
                event: eventLabel,
                fide: preview.blackNew,
                glicko: preview.blackNew,
                opponent: white.name,
                result: blackRes,
                timeControl,
              },
            ],
          };
        }
        return m;
      })
    );

    return { whiteDelta: preview.whiteDelta, blackDelta: preview.blackDelta };
  };

  /**
   * Way 1: Member submits game (pending approval) OR Admin uploads game directly (approved immediately)
   * Supports both PGN upload AND Result-Only logging (Who Won/Lost) with Friendly (0.45x) or Competitive (1.0x) Elo stakes
   */
  const handleSubmitGame = (payload: {
    whiteId: string;
    blackId: string;
    outcome: MatchOutcome;
    timeControl: TimeControl;
    matchStakes?: MatchStakes;
    openingName: string;
    pgn: string;
  }) => {
    const white = members.find((m) => m.id === payload.whiteId);
    const black = members.find((m) => m.id === payload.blackId);
    if (!white || !black) return;

    const stakes: MatchStakes = payload.matchStakes || 'competitive';

    const resultStr: '1-0' | '1/2-1/2' | '0-1' =
      payload.outcome === 1 ? '1-0' : payload.outcome === 0 ? '0-1' : '1/2-1/2';

    const preview = previewEloMatch(
      white.fide[payload.timeControl],
      black.fide[payload.timeControl],
      payload.outcome,
      white.fide.gamesPlayed,
      black.fide.gamesPlayed,
      stakes
    );

    const autoApprove = isAdminOrOwner;
    const stakesLabel =
      stakes === 'friendly'
        ? 'Friendly'
        : stakes === 'tournament'
        ? 'Tournament'
        : 'Competitive';

    const detectedOp = detectOpeningFromPgn(payload.pgn, payload.openingName);

    if (autoApprove) {
      applyApprovedGameElo(
        white.id,
        black.id,
        payload.outcome,
        payload.timeControl,
        `${stakesLabel} ${payload.timeControl.toUpperCase()}`,
        stakes,
        payload.pgn,
        payload.openingName
      );
    }

    const newGame: LoggedClubGame = {
      id: `game-${Date.now()}`,
      clubId: clubConfig.clubId,
      title: `${white.name} vs. ${black.name} — ${stakesLabel} ${payload.timeControl.toUpperCase()}`,
      event: `${clubConfig.clubName} ${stakesLabel} ${payload.timeControl.toUpperCase()}`,
      date: new Date().toISOString().slice(0, 10),
      whiteId: white.id,
      blackId: black.id,
      result: resultStr,
      timeControl: payload.timeControl,
      matchStakes: stakes,
      eco: detectedOp?.eco || (payload.pgn.trim() && !payload.pgn.startsWith('Result Only') ? 'PGN' : 'OTB'),
      openingName: detectedOp?.name || payload.openingName,
      pgn: payload.pgn,
      status: autoApprove ? 'approved' : 'pending',
      submittedBy: currentUser?.id,
      whiteEloDelta: preview.whiteDelta,
      blackEloDelta: preview.blackDelta,
      moves: [],
    };

    setLoggedGames((prev) => [newGame, ...prev]);
    syncDocToFirestore(`clubs/${clubConfig.clubId}/games`, newGame.id, { ...newGame });
  };

  const handleApprovePendingGame = (gameId: string) => {
    if (!isAdminOrOwner) return;
    const target = loggedGames.find((g) => g.id === gameId);
    if (!target || target.status === 'approved') return;

    const outcome: MatchOutcome =
      target.result === '1-0' ? 1 : target.result === '0-1' ? 0 : 0.5;
    const stakes: MatchStakes = target.matchStakes || 'competitive';

    applyApprovedGameElo(
      target.whiteId,
      target.blackId,
      outcome,
      target.timeControl,
      `Approved ${target.timeControl.toUpperCase()}`,
      stakes,
      target.pgn,
      target.openingName
    );

    setLoggedGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, status: 'approved' } : g))
    );
  };

  const handleRejectOrDeleteGame = (gameId: string) => {
    if (!isAdminOrOwner) return;
    setLoggedGames((prev) => prev.filter((g) => g.id !== gameId));
  };

  /**
   * Way 2: Click Active Tournament Match -> Choose Winner/Draw & Optional PGN
   * - Automatically moves the game to Completed/Ended
   * - Updates Elo & Leaderboard immediately
   * - If Elimination: advances winner into next bracket slot (QF -> SF -> Final)
   * - If Ranking/Swiss & all games in current round ended: automatically starts Next Round!
   */
  const handleRecordTournamentMatchPgn = (payload: {
    tournamentId: string;
    matchId: string;
    result: '1-0' | '1/2-1/2' | '0-1';
    pgn: string;
  }) => {
    const tourney = tournaments.find((t) => t.id === payload.tournamentId);
    if (!tourney) return;
    const match = tourney.matches.find((m) => m.id === payload.matchId);
    if (!match) return;

    const white = members.find((m) => m.id === match.whiteId);
    const black = members.find((m) => m.id === match.blackId);
    if (!white || !black) return;

    const outcome: MatchOutcome =
      payload.result === '1-0' ? 1 : payload.result === '0-1' ? 0 : 0.5;

    const deltas = applyApprovedGameElo(
      white.id,
      black.id,
      outcome,
      tourney.timeControl,
      `${tourney.name} R${match.round}`,
      'tournament',
      payload.pgn,
      `${tourney.name} Official Match`
    );

    const detectedOp = detectOpeningFromPgn(payload.pgn);

    const newGameId = `tgame-${Date.now()}`;
    const newGame: LoggedClubGame = {
      id: newGameId,
      clubId: tourney.clubId,
      title: `${white.name} vs. ${black.name} — ${tourney.name} (R${match.round})`,
      event: `${tourney.name} · Round ${match.round}`,
      date: new Date().toISOString().slice(0, 10),
      whiteId: white.id,
      blackId: black.id,
      result: payload.result,
      timeControl: tourney.timeControl,
      matchStakes: 'tournament',
      eco: detectedOp?.eco || (payload.pgn.trim() ? 'PGN' : 'OTB'),
      openingName: detectedOp?.name || `${tourney.name} Official Match`,
      pgn: payload.pgn,
      status: 'approved',
      submittedBy: currentUser?.id,
      whiteEloDelta: deltas.whiteDelta,
      blackEloDelta: deltas.blackDelta,
      tournamentId: tourney.id,
      moves: [],
    };

    setLoggedGames((prev) => [newGame, ...prev]);

    setTournaments((prev) =>
      prev.map((t) => {
        if (t.id !== tourney.id) return t;

        // Case A: Elimination Tournament (Knockout / Double Elimination) -> Advance Bracket Slot
        if (t.format === 'knockout' || t.format === 'double_elimination') {
          const advancedMatches = advanceEliminationBracket(
            t.matches,
            payload.matchId,
            payload.result,
            payload.pgn,
            newGameId
          );
          const maxR = advancedMatches.reduce((acc, m) => Math.max(acc, m.round), 1);
          const finalMatches = advancedMatches.filter((m) => m.round === maxR);
          const allFinalDone =
            finalMatches.length > 0 && finalMatches.every((m) => m.result !== null);

          // Determine active round (lowest round with an unplayed match)
          const unplayedRounds = advancedMatches
            .filter((m) => m.result === null)
            .map((m) => m.round);
          const nextCurrentRound =
            unplayedRounds.length > 0 ? Math.min(...unplayedRounds) : maxR;

          return {
            ...t,
            status: allFinalDone ? 'completed' : 'active',
            currentRound: nextCurrentRound,
            matches: advancedMatches,
          };
        }

        // Case B: Ranking-Based Tournament (Swiss, Round Robin, Scheveningen, Arena)
        let updatedMatches = t.matches.map((m) =>
          m.id === payload.matchId
            ? { ...m, result: payload.result, pgn: payload.pgn, gameId: newGameId }
            : m
        );

        let nextCurrentRound = t.currentRound;
        let nextStatus = t.status;

        if (t.format === 'swiss') {
          const maxR = updatedMatches.reduce((acc, m) => Math.max(acc, m.round), 1);
          const currentRoundMatches = updatedMatches.filter((m) => m.round === maxR);
          const allCurrentRoundFinished =
            currentRoundMatches.length > 0 &&
            currentRoundMatches.every((m) => m.result !== null);

          if (allCurrentRoundFinished) {
            if (maxR < t.totalRounds) {
              // Automatically start the next Swiss round!
              const players = t.playerIds
                .map((id) => {
                  const mem = members.find((x) => x.id === id);
                  return mem
                    ? {
                        id: mem.id,
                        name: mem.name,
                        department: mem.department,
                        rating: mem.fide[t.timeControl],
                      }
                    : null;
                })
                .filter((x): x is NonNullable<typeof x> => x !== null);

              const standings = calculateSwissStandings(players, updatedMatches);
              const nextPairings = generateNextSwissPairings(
                standings,
                updatedMatches,
                maxR + 1
              );
              updatedMatches = [...updatedMatches, ...nextPairings];
              nextCurrentRound = maxR + 1;
            } else {
              nextStatus = 'completed';
            }
          }
        } else {
          // Pre-generated multi-round ranking formats (Round Robin, Scheveningen, Arena)
          const roundMatches = updatedMatches.filter((m) => m.round === t.currentRound);
          const allRoundFinished =
            roundMatches.length > 0 && roundMatches.every((m) => m.result !== null);
          if (allRoundFinished) {
            const hasNextRound = updatedMatches.some((m) => m.round === t.currentRound + 1);
            if (hasNextRound) {
              nextCurrentRound = t.currentRound + 1;
            } else if (updatedMatches.every((m) => m.result !== null)) {
              nextStatus = 'completed';
            }
          }
        }

        return {
          ...t,
          status: nextStatus,
          currentRound: nextCurrentRound,
          matches: updatedMatches,
        };
      })
    );
  };

  // --- AUTOMATED TOURNAMENT CREATION (COMPUTER PAIRED — 7 FORMATS) ---
  const handleCreateTournament = (payload: {
    name: string;
    format: TournamentFormat;
    timeControl: TimeControl;
    playerIds: string[];
    customTotalRounds?: number;
  }) => {
    if (!isAdminOrOwner) return;
    const seededPlayers = payload.playerIds
      .map((id) => {
        const m = members.find((mem) => mem.id === id);
        return m ? { id: m.id, rating: m.fide[payload.timeControl] } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const generatedMatches = generateAutomatedTournamentMatches(
      payload.format,
      seededPlayers,
      payload.customTotalRounds
    );

    const maxRound = generatedMatches.reduce((acc, m) => Math.max(acc, m.round), 1);
    const isElim =
      payload.format === 'knockout' || payload.format === 'double_elimination';
    const computedTotalRounds = isElim
      ? maxRound
      : payload.customTotalRounds && payload.customTotalRounds >= 1
      ? payload.customTotalRounds
      : payload.format === 'swiss'
      ? 4
      : maxRound;

    const newTourney: ClubTournament = {
      id: `tourney-${Date.now()}`,
      clubId: clubConfig.clubId,
      name: payload.name,
      format: payload.format,
      timeControl: payload.timeControl,
      status: 'active',
      currentRound: 1,
      totalRounds: computedTotalRounds,
      playerIds: payload.playerIds,
      matches: generatedMatches,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setTournaments((prev) => [newTourney, ...prev]);
    syncDocToFirestore(`clubs/${clubConfig.clubId}/tournaments`, newTourney.id, {
      ...newTourney,
    });
  };

  const handlePairNextSwissRound = (tournamentId: string) => {
    if (!isAdminOrOwner) return;
    const tourney = tournaments.find((t) => t.id === tournamentId);
    if (!tourney) return;

    const players = tourney.playerIds
      .map((id) => {
        const m = members.find((mem) => mem.id === id);
        return m
          ? {
              id: m.id,
              name: m.name,
              department: m.department,
              rating: m.fide[tourney.timeControl],
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const standings = calculateSwissStandings(players, tourney.matches);
    const maxR = tourney.matches.reduce((acc, m) => Math.max(acc, m.round), 1);
    const nextPairings = generateNextSwissPairings(standings, tourney.matches, maxR + 1);

    setTournaments((prev) =>
      prev.map((t) =>
        t.id === tournamentId
          ? {
              ...t,
              currentRound: maxR + 1,
              matches: [...t.matches, ...nextPairings],
            }
          : t
      )
    );
  };

  const handleDeleteTournament = (tournamentId: string) => {
    if (!isAdminOrOwner) return;
    setTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
    setLoggedGames((prev) => prev.filter((g) => g.tournamentId !== tournamentId));
  };

  const handleClearTournamentHistory = () => {
    if (!isAdminOrOwner) return;
    const completedIds = new Set(
      tournaments
        .filter((t) => t.clubId === clubConfig.clubId && t.status === 'completed')
        .map((t) => t.id)
    );
    setTournaments((prev) =>
      prev.filter((t) => !(t.clubId === clubConfig.clubId && t.status === 'completed'))
    );
    setLoggedGames((prev) =>
      prev.filter((g) => !g.tournamentId || !completedIds.has(g.tournamentId))
    );
  };

  // --- MEMBER ACCOUNT, ROLE, CHESS SPECIALTY & INHERITANCE HANDLERS ---
  const handleCreateMemberAccount = (payload: {
    name: string;
    arabicName: string;
    username: string;
    passwordCode: string;
    department: string;
    yearLevel: string;
    liveStatus: MemberLiveStatus;
    role: UserRole;
    clubRoleDivision?: ClubRoleDivision;
    chessSpecialty?: string;
    signatureOpening?: string;
    bringsEquipment?: boolean;
  }) => {
    if (!isAdminOrOwner) return;
    const initials = payload.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    const base = clubConfig.startingRating || 1200;
    const newId = `mem-${Date.now()}`;
    const primaryOpening = payload.signatureOpening?.trim() || undefined;
    const created: ClubMember = {
      id: newId,
      clubId: clubConfig.clubId,
      name: payload.name,
      arabicName: payload.arabicName,
      username: payload.username,
      passwordCode: payload.passwordCode,
      role: currentUser?.role === 'owner' ? payload.role : 'member',
      clubRoleDivision: payload.clubRoleDivision || 'Club Member',
      chessSpecialty: payload.chessSpecialty || 'Tactical All-Rounder',
      signatureOpening: primaryOpening,
      bringsEquipment: payload.bringsEquipment || false,
      university: clubConfig.universityName,
      department: payload.department,
      yearLevel: payload.yearLevel,
      titleBadge:
        payload.clubRoleDivision && payload.clubRoleDivision !== 'Club Member'
          ? payload.clubRoleDivision
          : payload.role === 'admin'
          ? 'Club Admin'
          : `Club Member (${base})`,
      liveStatus: payload.liveStatus,
      bio: `Official ${clubConfig.clubName} member (${
        payload.clubRoleDivision || 'Club Member'
      }) · Specialty: ${payload.chessSpecialty || 'Tactical All-Rounder'}.`,
      avatarInitials: initials || 'CM',
      avatarColor: clubConfig.accentColor,
      coverPhotoUrl: '/src/assets/images/chess_members_hall_bg_1794624757745.jpg',
      profilePhotos: [],
      joinedDate: 'Nov 2026',
      fide: {
        rapid: base,
        blitz: base,
        classical: base,
        peak: base,
        delta30d: 0,
        gamesPlayed: 0,
      },
      glicko2: {
        rapid: { rating: base, rd: 220, vol: 0.06 },
        blitz: { rating: base, rd: 220, vol: 0.06 },
        classical: { rating: base, rd: 220, vol: 0.06 },
      },
      ratingHistory: [
        {
          date: '2026-11',
          event: `Club Seed (${base})`,
          fide: base,
          glicko: base,
          opponent: 'Baseline',
          result: 'D',
          timeControl: 'rapid',
        },
      ],
      openings: [],
      freeSlots: [],
    };

    setMembers((prev) => [created, ...prev]);
    setSelectedMemberId(newId);
    syncDocToFirestore(`clubs/${clubConfig.clubId}/members`, created.id, { ...created });
  };

  const handleDeleteMemberAccount = (memberId: string) => {
    if (!isAdminOrOwner) return;
    const target = members.find((m) => m.id === memberId);
    if (!target || target.role === 'owner') return;
    setMembers((prev) => {
      const next = prev.filter((m) => m.id !== memberId);
      if (selectedMemberId === memberId && next.length > 0) {
        const nextInClub = next.find((m) => m.clubId === clubConfig.clubId);
        setSelectedMemberId(nextInClub?.id || next[0].id);
      }
      return next;
    });
  };

  const handleUpdateMemberRoleAndChessProfile = (
    memberId: string,
    payload: {
      clubRoleDivision?: ClubRoleDivision;
      chessSpecialty?: string;
      signatureOpening?: string;
      openings?: ClubMember['openings'];
      bringsEquipment?: boolean;
      willingToCoach?: boolean;
      willingToOrganize?: boolean;
    }
  ) => {
    if (!currentUser) return;
    if (!isAdminOrOwner && currentUser.id !== memberId) return;
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        return {
          ...m,
          clubRoleDivision: payload.clubRoleDivision ?? m.clubRoleDivision,
          chessSpecialty: payload.chessSpecialty ?? m.chessSpecialty,
          signatureOpening: payload.signatureOpening ?? m.signatureOpening,
          openings: payload.openings && payload.openings.length > 0 ? payload.openings : m.openings,
          bringsEquipment:
            payload.bringsEquipment !== undefined
              ? payload.bringsEquipment
              : m.bringsEquipment,
          willingToCoach:
            payload.willingToCoach !== undefined ? payload.willingToCoach : m.willingToCoach,
          willingToOrganize:
            payload.willingToOrganize !== undefined
              ? payload.willingToOrganize
              : m.willingToOrganize,
        };
      })
    );
  };

  const handleDesignateSuccessor = (heirId: string) => {
    if (!isAdminOrOwner) return;
    setMembers((prev) =>
      prev.map((m) =>
        m.clubId === clubConfig.clubId
          ? { ...m, isDesignatedSuccessor: m.id === heirId }
          : m
      )
    );
  };

  const handleTransferOwnershipToNextGen = (payload: {
    newOwnerId: string;
    generationLabel: string;
    mandatePeriod: string;
    legacyNote: string;
  }) => {
    if (!isAdminOrOwner) return;
    const newOwner = members.find((m) => m.id === payload.newOwnerId);
    if (!newOwner) return;
    const prevOwner =
      members.find((m) => m.role === 'owner' && m.clubId === clubConfig.clubId) ||
      currentUser;

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === payload.newOwnerId) {
          return {
            ...m,
            role: 'owner',
            clubRoleDivision: 'President & Founder',
            titleBadge: `Club President (${payload.mandatePeriod})`,
            isDesignatedSuccessor: true,
          };
        }
        if (m.role === 'owner' && m.clubId === clubConfig.clubId) {
          return {
            ...m,
            role: 'admin',
            titleBadge: 'Honorary Founding President (Owner Emeritus)',
          };
        }
        return m;
      })
    );

    const newRecord: ClubGenerationRecord = {
      id: `gen-${Date.now()}`,
      clubId: clubConfig.clubId,
      generationLabel: payload.generationLabel,
      MandatePeriod: payload.mandatePeriod,
      fromOwnerId: prevOwner?.id || 'enp-owner',
      fromOwnerName: prevOwner?.name || 'Fethallah (Founder)',
      toOwnerId: newOwner.id,
      toOwnerName: newOwner.name,
      toOwnerDepartment: newOwner.department,
      transferredAt: new Date().toISOString().slice(0, 10),
      legacyNote: payload.legacyNote,
    };

    setOwnershipLineage((prev) => [newRecord, ...prev]);
    setCurrentUserId(newOwner.id);
  };

  const handleReclaimFounderOwnership = () => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === 'enp-owner') {
          return {
            ...m,
            role: 'owner',
            clubRoleDivision: 'President & Founder',
            titleBadge: 'Platform Owner & Founder',
          };
        }
        if (m.role === 'owner' && m.id !== 'enp-owner') {
          return {
            ...m,
            role: 'admin',
          };
        }
        return m;
      })
    );
    setCurrentUserId('enp-owner');
  };

  const handleUpdateMemberRole = (memberId: string, nextRole: UserRole) => {
    if (currentUser?.role !== 'owner') return;
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId && m.role !== 'owner'
          ? {
              ...m,
              role: nextRole,
              titleBadge: nextRole === 'admin' ? 'Club Admin' : 'Club Member',
            }
          : m
      )
    );
  };

  const handleUpdateMemberPassword = (memberId: string, nextPassword: string) => {
    if (!isAdminOrOwner) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, passwordCode: nextPassword } : m))
    );
  };

  const handleUpdateMemberStatus = (id: string, status: MemberLiveStatus) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!isAdminOrOwner && currentUser.id !== id) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, liveStatus: status } : m))
    );
  };

  const handleUpdateMemberAvatar = (id: string, avatarUrl: string) => {
    if (!currentUser) return;
    if (!isAdminOrOwner && currentUser.id !== id) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, avatarUrl } : m))
    );
  };

  const handleUpdateMemberCoverPhoto = (id: string, coverPhotoUrl: string) => {
    if (!currentUser) return;
    if (!isAdminOrOwner && currentUser.id !== id) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, coverPhotoUrl } : m))
    );
  };

  const handleAddMemberPhotoPost = (id: string, imageUrl: string, caption: string) => {
    if (!currentUser) return;
    if (!isAdminOrOwner && currentUser.id !== id) return;
    const newPost = {
      id: `photo-${Date.now()}`,
      imageUrl,
      caption,
      date: new Date().toISOString().slice(0, 10),
      likes: 1,
    };
    setMembers((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, profilePhotos: [newPost, ...(m.profilePhotos || [])] }
          : m
      )
    );
  };

  const handleLikeMemberPhotoPost = (memberId: string, photoId: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        return {
          ...m,
          profilePhotos: (m.profilePhotos || []).map((p) =>
            p.id === photoId ? { ...p, likes: p.likes + 1 } : p
          ),
        };
      })
    );
  };

  const handleDeleteMemberPhotoPost = (memberId: string, photoId: string) => {
    if (!currentUser) return;
    if (!isAdminOrOwner && currentUser.id !== memberId) return;
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        return {
          ...m,
          profilePhotos: (m.profilePhotos || []).filter((p) => p.id !== photoId),
        };
      })
    );
  };

  const handleToggleMemberSlot = (memberId: string, slotKey: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!isAdminOrOwner && currentUser.id !== memberId) return;
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        const exists = m.freeSlots.includes(slotKey);
        return {
          ...m,
          freeSlots: exists
            ? m.freeSlots.filter((s) => s !== slotKey)
            : [...m.freeSlots, slotKey],
        };
      })
    );
  };

  const handleUpdateMemberMeetupZone = (memberId: string, zoneId: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!isAdminOrOwner && currentUser.id !== memberId) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, campusMeetupZoneId: zoneId } : m))
    );
  };

  const handleUpdateMemberGps = (
    memberId: string,
    gps: ClubMember['gpsLocation'] | null
  ) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!isAdminOrOwner && currentUser.id !== memberId) return;
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              liveStatus: gps ? 'campus_otb' : m.liveStatus,
              gpsLocation: gps || undefined,
            }
          : m
      )
    );
  };

  // --- HOME SCREEN POSTS HANDLERS ---
  const handleCreatePost = (payload: {
    title: string;
    category: ClubPost['category'];
    body: string;
    pinned: boolean;
  }) => {
    if (!isAdminOrOwner || !currentUser) return;
    const created: ClubPost = {
      id: `post-${Date.now()}`,
      clubId: clubConfig.clubId,
      title: payload.title,
      category: payload.category,
      body: payload.body,
      authorName: currentUser.name,
      authorRole: currentUser.role === 'owner' ? 'Owner' : 'Admin',
      createdAt: new Date().toISOString().slice(0, 10),
      pinned: payload.pinned,
    };
    setPosts((prev) => [created, ...prev]);
    syncDocToFirestore(`clubs/${clubConfig.clubId}/posts`, created.id, { ...created });
  };

  const handleDeletePost = (postId: string) => {
    if (!isAdminOrOwner) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  // --- MULTI-CLUB ADD (ADMIN/OWNER) & DELETE (OWNER ONLY) ---
  const handleAddClub = (newClub: ClubThemeConfig) => {
    if (!isAdminOrOwner) return;
    setClubs((prev) => [...prev, newClub]);
    setClubConfig(newClub);
    // Seed an initial club captain in the new club so it has a roster member immediately
    const seedMember: ClubMember = {
      id: `cap-${newClub.clubId}`,
      clubId: newClub.clubId,
      name: `${newClub.clubName} Captain`,
      arabicName: 'قائد النادي',
      username: newClub.clubId.split('-')[0] || 'captain',
      passwordCode: 'club2026',
      role: 'admin',
      university: newClub.universityName,
      department: 'Engineering & Sciences',
      yearLevel: 'Club Captain',
      titleBadge: 'Founding Club Admin',
      liveStatus: 'campus_otb',
      bio: `Founding captain of ${newClub.clubName} (${newClub.universityName}).`,
      avatarInitials: newClub.clubName.slice(0, 2).toUpperCase(),
      avatarColor: newClub.accentColor,
      coverPhotoUrl: '/src/assets/images/chess_members_hall_bg_1794624757745.jpg',
      profilePhotos: [],
      joinedDate: 'Nov 2026',
      fide: {
        rapid: 1650,
        blitz: 1650,
        classical: 1650,
        peak: 1650,
        delta30d: 0,
        gamesPlayed: 5,
      },
      glicko2: {
        rapid: { rating: 1650, rd: 80, vol: 0.06 },
        blitz: { rating: 1650, rd: 80, vol: 0.06 },
        classical: { rating: 1650, rd: 80, vol: 0.06 },
      },
      ratingHistory: [
        {
          date: '2026-11',
          event: 'Club Seed',
          fide: 1650,
          glicko: 1650,
          opponent: 'Baseline',
          result: 'W',
        },
      ],
      openings: [],
      freeSlots: ['0-10', '1-11', '2-12'],
    };
    setMembers((prev) => [...prev, seedMember]);
    syncDocToFirestore('clubs', newClub.clubId, { ...newClub });
  };

  const handleDeleteClub = async (clubIdToDelete: string) => {
    if (currentUser?.role !== 'owner') return;
    if (clubs.length <= 1) return;
    const remaining = clubs.filter((c) => c.clubId !== clubIdToDelete);
    setClubs(remaining);
    if (clubConfig.clubId === clubIdToDelete) {
      setClubConfig(remaining[0]);
    }
    try {
      if (auth.currentUser) {
        await deleteDoc(doc(db, 'clubs', clubIdToDelete));
      }
    } catch {
      // ignore
    }
  };

  const handleUpdateClubConfig = (next: ClubThemeConfig) => {
    setClubConfig(next);
    setClubs((prev) => prev.map((c) => (c.clubId === next.clubId ? next : c)));
  };

  // Automatically redirect away from Admin Center if user switches to a non-admin account
  useEffect(() => {
    if (!isAdminOrOwner && activeModule === 'customizer') {
      setActiveModule('overview');
    }
  }, [isAdminOrOwner, activeModule]);

  const sortedByRapid = [...clubMembers].sort((a, b) => b.fide.rapid - a.fide.rapid);
  const clubLeader = sortedByRapid[0];
  const freeNowPlayers = clubMembers.filter(
    (m) => m.liveStatus === 'campus_otb' || m.liveStatus === 'online_ready'
  );

  // --- TEAMS & PRIVATE CHAT HANDLER ---
  const handleSendChatMessage = (payload: {
    channelId: string;
    channelType: 'team' | 'dm';
    recipientId?: string;
    text: string;
    challengeTimeControl?: TimeControl;
    challengeStakes?: MatchStakes;
  }) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    const created: ClubChatMessage = {
      id: `msg-${Date.now()}`,
      clubId: currentUser.clubId,
      channelId: payload.channelId,
      channelType: payload.channelType,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: payload.recipientId,
      text: payload.text,
      challengeTimeControl: payload.challengeTimeControl,
      challengeStakes: payload.challengeStakes,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, created]);
    syncDocToFirestore(`clubs/${currentUser.clubId}/messages`, created.id, { ...created });
  };

  const handleOpenPrivateChatWithMember = (memberId: string) => {
    setInitialDmTargetId(memberId);
    setActiveModule('lounge');
  };

  const allNavItems: {
    id: ActiveModule;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }[] = [
    {
      id: 'overview',
      label: 'Home & Club Posts',
      shortLabel: 'Home',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'members',
      label: 'Members & Profiles',
      shortLabel: 'Profiles',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'studio',
      label: 'Board & Stockfish',
      shortLabel: 'Studio',
      icon: <Grid className="w-4 h-4" />,
    },
    {
      id: 'tournaments',
      label: 'Tournaments',
      shortLabel: 'Tournaments',
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: 'lounge',
      label: currentUser ? 'Teams & Private Chat' : 'Teams Chat (Members Only)',
      shortLabel: 'Teams Chat',
      icon: currentUser ? (
        <MessageSquare className="w-4 h-4" />
      ) : (
        <Lock className="w-4 h-4 text-[#FF6B00]" />
      ),
    },
    {
      id: 'radar',
      label: 'Free-Hour Radar',
      shortLabel: 'Free Hours',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'customizer',
      label: `Admin Center${pendingClubGames.length ? ` (${pendingClubGames.length})` : ''}`,
      shortLabel: 'Admin',
      icon: <Settings className="w-4 h-4" />,
      adminOnly: true,
    },
  ];

  // Strictly hide Admin Center tab from normal members and guests
  const navItems = allNavItems.filter((item) => !item.adminOnly || isAdminOrOwner);

  const activeModuleBg =
    MODULE_BACKGROUNDS_4K[activeModule] || MODULE_BACKGROUNDS_4K.overview;

  const ratingBuckets = [
    {
      range: '800 ELO (Under 800 Tier)',
      count: clubMembers.filter((m) => m.fide.rapid <= 800).length,
    },
    {
      range: '1200 ELO (800 – 1200 Tier)',
      count: clubMembers.filter((m) => m.fide.rapid > 800 && m.fide.rapid <= 1200).length,
    },
    {
      range: '1600 ELO (1200 – 1800 Tier)',
      count: clubMembers.filter((m) => m.fide.rapid > 1200 && m.fide.rapid <= 1800).length,
    },
    {
      range: '2000 ELO (1800+ Tier)',
      count: clubMembers.filter((m) => m.fide.rapid > 1800).length,
    },
  ];

  return (
    <div
      className={
        androidPreviewMode
          ? 'min-h-screen bg-[#040B16] py-6 px-2 flex flex-col items-center justify-center overflow-x-hidden'
          : 'min-h-screen theme-app-shell flex flex-col relative w-full max-w-full overflow-x-hidden cad-grid-dark'
      }
    >
      {/* Persistent 4K 16:9 Ambient Backdrop Glow (Changes dynamically per page module) */}
      {!androidPreviewMode && siteTheme !== 'basic' && (
        <div
          className={`pointer-events-none fixed inset-x-0 top-0 h-[580px] z-0 overflow-hidden ${
            siteTheme === 'light' ? 'opacity-10' : 'opacity-25'
          }`}
        >
          <img
            src={
              activeModule === 'overview'
                ? clubConfig.customHeroUrl || activeModuleBg.imageUrl
                : activeModuleBg.imageUrl
            }
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-top blur-2xl scale-105 transition-all duration-500"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                siteTheme === 'light'
                  ? 'linear-gradient(180deg, transparent 0%, rgba(238,243,249,0.85) 75%, #EEF3F9 100%)'
                  : siteTheme === 'emerald'
                  ? 'linear-gradient(180deg, transparent 0%, rgba(9,25,20,0.85) 75%, #091914 100%)'
                  : 'linear-gradient(180deg, transparent 0%, rgba(6,16,32,0.82) 75%, #061020 100%)',
            }}
          />
        </div>
      )}

      {androidPreviewMode && (
        <div className="mb-3 flex items-center gap-3 text-white text-xs font-mono-tabular">
          <span>ANDROID MOBILE SHELL PREVIEW (412×860)</span>
          <button
            type="button"
            onClick={() => setAndroidPreviewMode(false)}
            className="px-3 py-1 rounded-lg bg-[#FF6B00] text-white font-bold cursor-pointer"
          >
            Exit Phone Frame
          </button>
        </div>
      )}

      <div
        className={
          androidPreviewMode
            ? 'w-[412px] h-[860px] rounded-[36px] border-[8px] border-slate-800 theme-app-shell overflow-y-auto overflow-x-hidden shadow-2xl flex flex-col relative z-10'
            : 'flex-1 flex flex-col relative z-10 min-w-0 w-full max-w-full overflow-x-hidden'
        }
      >
        {quotaExceeded && (
          <div
            role="alert"
            className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
          >
            <span>
              <strong>Google Maps:</strong> Demo key quota reached — map tiles or data may not load. Replace it with your own API key in AI Studio settings to restore full functionality.
            </span>
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-medium underline hover:text-amber-700"
            >
              Learn how
            </a>
          </div>
        )}

        {/* 3-ZONE TOP BAR CONTRACT */}
        <header className="sticky top-0 z-30 bg-[#061020]/90 theme-header-surface backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-6 w-full max-w-full min-w-0 overflow-hidden">
          {/* Zone 1: Brand Logos (Minimalist Text-Free Emblem) & Active Club Name */}
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('overview');
            }}
            className="flex items-center gap-2.5 min-w-0 max-w-full shrink"
          >
            <div className="flex items-center gap-2 shrink-0 max-w-full">
              <ClubLogoBadge
                customLogoUrl={clubConfig.customLogoUrl}
                accentColor={clubConfig.accentColor}
                size="sm"
              />
              {clubConfig.schoolLogoUrl && (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#061020] border border-[#26E6DE]/35 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={clubConfig.schoolLogoUrl}
                    alt={clubConfig.universityName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover scale-105"
                  />
                </div>
              )}
            </div>
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-white theme-heading truncate">
              {clubConfig.clubName}
            </span>
          </a>

          {/* Zone 2: Primary Navigation */}
          {!androidPreviewMode && (
            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-4 lg:gap-5 text-sm font-medium text-slate-300 max-w-full min-w-0 overflow-x-auto no-scrollbar"
            >
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveModule(item.id)}
                  className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                    activeModule === item.id
                      ? 'text-[#26E6DE] font-bold border-b-2 border-[#FF6B00]'
                      : 'hover:opacity-80'
                  }`}
                >
                  {item.shortLabel}
                </button>
              ))}
            </nav>
          )}

          {/* Zone 3: Single Account / Role Button */}
          <div className="flex items-center shrink-0 max-w-full">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-bold text-white bg-[#1E56A0] hover:bg-[#2563EB] border border-[#26E6DE]/40 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 max-w-full cursor-pointer shadow-sm"
            >
              {currentUser ? (
                <>
                  <Shield className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>
                    {currentUser.name.split(' ')[0]} ({currentUser.role.toUpperCase()})
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5 text-[#26E6DE]" />
                  <span>Member / Admin Sign In</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <div className="flex-1 flex min-w-0 w-full max-w-full overflow-x-hidden">
          {!androidPreviewMode && (
            <aside
              aria-label="Workspace modules"
              className="hidden lg:flex w-64 shrink-0 flex-col justify-between bg-[#050D1A]/85 theme-sidebar-surface backdrop-blur-xl text-white p-5 border-r border-white/10 max-w-full"
            >
              <div className="space-y-5 max-w-full min-w-0">
                <div className="pb-4 border-b border-white/10 space-y-3 max-w-full">
                  {/* Official ENP 16:9 Royal Crest Banner — blended seamlessly into sidebar */}
                  {clubConfig.clubBannerUrl && (
                    <div className="rounded-xl overflow-hidden border border-[#26E6DE]/25 shadow-lg bg-gradient-to-b from-[#0A2552] to-[#061020] p-1 flex items-center justify-center max-w-full">
                      <img
                        src={clubConfig.clubBannerUrl}
                        alt={`${clubConfig.clubName} Official Crest Banner`}
                        referrerPolicy="no-referrer"
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    </div>
                  )}

                  {/* Quick Club Switcher */}
                  <div className="max-w-full min-w-0">
                    <label className="block text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400 mb-1">
                      Active University Club
                    </label>
                    <select
                      aria-label="Switch active university club"
                      value={clubConfig.clubId}
                      onChange={(e) => {
                        const found = clubs.find((c) => c.clubId === e.target.value);
                        if (found) setClubConfig(found);
                      }}
                      className="w-full max-w-full px-2.5 py-2 rounded-xl bg-[#061020] border border-white/15 text-xs font-bold text-white cursor-pointer truncate"
                    >
                      {clubs.map((c) => (
                        <option key={c.clubId} value={c.clubId}>
                          {c.clubName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1 max-w-full">
                  <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400 px-3 pb-1">
                    Platform Modules
                  </div>
                  {navItems.map((item) => {
                    const active = activeModule === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveModule(item.id)}
                        className={`w-full max-w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-[#FF6B00] text-white shadow-lg shadow-[#FF6B00]/25'
                            : 'text-slate-300 hover:bg-white/8'
                        }`}
                        style={active ? { backgroundColor: clubConfig.accentColor } : undefined}
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* SITE VISUAL THEME SWITCHER (DARK / LIGHT / BASIC / CLASSIC) */}
                <div className="pt-4 border-t border-white/10 space-y-2 max-w-full">
                  <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5 max-w-full">
                    <Palette className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Site Theme Mode</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-w-full">
                    {VISUAL_THEME_OPTIONS.map((t) => {
                      const isActive = siteTheme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSiteTheme(t.id)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 max-w-full transition-all cursor-pointer border ${
                            isActive
                              ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-sm'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {t.id === 'light' ? (
                            <Sun className="w-3.5 h-3.5 shrink-0" />
                          ) : t.id === 'basic' ? (
                            <Monitor className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Moon className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="truncate">{t.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-2 max-w-full">
                  <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400 px-3">
                    Viewport Controls
                  </div>
                  {activeModule !== 'overview' && (
                    <button
                      type="button"
                      onClick={() => setShowHeroInWorkspace((v) => !v)}
                      className="w-full max-w-full px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-[#26E6DE] flex items-center justify-between cursor-pointer"
                    >
                      <span>Mikhail Tal Hero</span>
                      <span>{showHeroInWorkspace ? 'Shown' : 'Hidden'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAndroidPreviewMode((v) => !v)}
                    className="w-full max-w-full px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-2 cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Android App Frame</span>
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 text-[11px] text-slate-400 space-y-1 max-w-full">
                <div className="font-semibold text-slate-300">{clubConfig.city}</div>
                <div>Unified Elo: Rapid · Blitz · Classical (1500)</div>
              </div>
            </aside>
          )}

          {/* MAIN CONTENT VIEWPORT — strictly contained within viewport with max-w-full & min-w-0 */}
          <main
            className={`flex-1 min-w-0 max-w-full p-3 sm:p-6 lg:p-8 overflow-x-hidden ${
              androidPreviewMode ? 'pb-8' : 'pb-24 lg:pb-10'
            }`}
          >
            <div className="w-full max-w-[1360px] mx-auto space-y-5 sm:space-y-8 min-w-0">
              {/* Quick Theme & Active University Club Bar */}
              <div className="broadcast-panel rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 w-full max-w-full min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0 max-w-full">
                  <span className="text-[11px] font-mono-tabular uppercase text-[#26E6DE] font-bold shrink-0">
                    Club:
                  </span>
                  <select
                    aria-label="Switch active university club"
                    value={clubConfig.clubId}
                    onChange={(e) => {
                      const found = clubs.find((c) => c.clubId === e.target.value);
                      if (found) setClubConfig(found);
                    }}
                    className="min-w-0 max-w-[220px] sm:max-w-[320px] truncate px-2.5 py-1.5 rounded-xl bg-[#061020] border border-white/15 text-xs font-bold text-white cursor-pointer"
                  >
                    {clubs.map((c) => (
                      <option key={c.clubId} value={c.clubId}>
                        {c.clubName} ({c.universityName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Instant 1-Click Theme Mode Bar (Dark / Light / Basic / Classic) */}
                <div className="flex items-center gap-1.5 flex-wrap max-w-full min-w-0">
                  <span className="text-[11px] font-mono-tabular uppercase text-slate-400 font-bold mr-1 flex items-center gap-1 max-w-full">
                    <Palette className="w-3.5 h-3.5 text-[#FF6B00]" />
                    Theme:
                  </span>
                  {VISUAL_THEME_OPTIONS.map((t) => {
                    const isActive = siteTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSiteTheme(t.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 max-w-full cursor-pointer ${
                          isActive
                            ? 'bg-[#FF6B00] text-white shadow-sm'
                            : 'bg-[#061020]/75 text-slate-300 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {t.id === 'light' ? (
                          <Sun className="w-3 h-3" />
                        ) : t.id === 'basic' ? (
                          <Monitor className="w-3 h-3" />
                        ) : (
                          <Moon className="w-3 h-3" />
                        )}
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(activeModule === 'overview' || showHeroInWorkspace) && (
                <BroadcastHero
                  clubConfig={clubConfig}
                  isAdminOrOwner={isAdminOrOwner}
                  onUpdateHeroArt={(url) =>
                    handleUpdateClubConfig({ ...clubConfig, customHeroUrl: url })
                  }
                  onOpenStudioWithCombination={() => {
                    setStudioGame(approvedClubGames[0] || INITIAL_LOGGED_GAMES[0] || null);
                    setActiveModule('studio');
                  }}
                />
              )}

              {/* 4K 16:9 CINEMATIC PAGE HERO BANNER FOR ALL OTHER PAGES (Members, Studio, Tournaments, Free-Hour Radar, Admin) */}
              {activeModule !== 'overview' && !showHeroInWorkspace && (
                <div className="relative w-full max-w-full min-w-0 h-40 sm:h-52 lg:h-60 rounded-3xl overflow-hidden border border-white/15 shadow-2xl flex flex-col justify-end p-4 sm:p-7">
                  <img
                    src={activeModuleBg.imageUrl}
                    alt={activeModuleBg.title}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover object-center opacity-85 pointer-events-none"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(6,16,32,0.92) 0%, rgba(6,16,32,0.65) 50%, rgba(6,16,32,0.35) 100%), linear-gradient(180deg, rgba(6,16,32,0.2) 0%, #061020 100%)',
                    }}
                  />
                  <div className="relative z-10 flex flex-wrap items-end justify-between gap-3 max-w-full min-w-0">
                    <div className="space-y-1 min-w-0 max-w-full">
                      <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow">
                        {activeModuleBg.title}
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-200 max-w-2xl line-clamp-2">
                        {activeModuleBg.subtitle}
                      </p>
                    </div>

                    <div className="hidden sm:flex items-center gap-2.5 max-w-full bg-[#061020]/85 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15">
                      <ClubLogoBadge
                        customLogoUrl={clubConfig.customLogoUrl}
                        accentColor={clubConfig.accentColor}
                        size="sm"
                      />
                      <div className="text-xs min-w-0">
                        <div className="font-bold text-white truncate">{clubConfig.clubName}</div>
                        <div className="text-[10px] font-mono-tabular text-[#26E6DE] truncate">
                          {clubConfig.universityName}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE 1: HOME / OVERVIEW DASHBOARD */}
              {activeModule === 'overview' && (
                <div className="space-y-6 sm:space-y-8 min-w-0 w-full max-w-full overflow-hidden">
                  {/* Enhanced Real School Campus Photo + School Introduction & Club Goal */}
                  <div className="broadcast-panel p-4 sm:p-6 rounded-2xl grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-w-0 w-full max-w-full overflow-hidden">
                    <div className="lg:col-span-5 min-w-0 max-w-full relative rounded-2xl overflow-hidden border border-[#26E6DE]/30 bg-[#08224A] shadow-xl min-h-[220px] sm:min-h-[260px] flex items-center justify-center">
                      <img
                        src={
                          clubConfig.clubId === 'enp-alger'
                            ? '/assets/enp_campus_enhanced.jpg'
                            : clubConfig.clubBannerUrl || '/assets/enp_campus_enhanced.jpg'
                        }
                        alt="École Nationale Polytechnique (ENP El Harrach, Algiers) Main Campus Gate"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-center"
                      />
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#061020]/90 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-white">
                        <span className="px-2.5 py-1 rounded-lg bg-[#061020]/85 border border-white/15 backdrop-blur-sm truncate">
                          📍 École Nationale Polytechnique · El Harrach, Algiers (Est. 1925)
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-7 min-w-0 max-w-full flex flex-col justify-between gap-4">
                      <div className="space-y-3 min-w-0 max-w-full flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-xl sm:text-2xl font-extrabold text-white break-words">
                            {clubConfig.clubName} · {clubConfig.universityName}
                          </h2>
                          <div className="flex items-center gap-2 shrink-0">
                            <ClubLogoBadge
                              customLogoUrl={clubConfig.customLogoUrl}
                              accentColor={clubConfig.accentColor}
                              size="sm"
                            />
                            {clubConfig.schoolLogoUrl && (
                              <div className="w-9 h-9 rounded-xl bg-[#061020] border border-[#26E6DE]/35 flex items-center justify-center overflow-hidden">
                                <img
                                  src={clubConfig.schoolLogoUrl}
                                  alt="École Nationale Polytechnique Logo"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover scale-105"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-[#26E6DE] font-semibold">
                          {clubConfig.subtitleAr}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                          <div className="p-3.5 rounded-xl bg-[#061020]/75 border border-white/10 space-y-1.5">
                            <div className="text-[11px] font-mono-tabular uppercase text-[#26E6DE] font-bold">
                              About École Nationale Polytechnique (ENP)
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              Founded in 1925 in El Harrach (Algiers), École Nationale Polytechnique is Algeria’s premier engineering institution—training top engineers and researchers across its Preparatory Cycle (CPST) and 13 specialized engineering departments.
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-[#061020]/75 border border-[#FF6B00]/30 space-y-1.5">
                            <div className="text-[11px] font-mono-tabular uppercase text-[#FF6B00] font-bold">
                              Goal of the ENP Chess Club
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              Unite polytechnic students from beginners (100–800) to advanced players (1600–2000) through casual over-the-board games on campus, structured coaching workshops, ranked Rapid & Elimination tournaments, and inter-university team representation.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 max-w-full min-w-0">
                          <button
                            type="button"
                            onClick={() => setActiveModule('lounge')}
                            className="px-3.5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold flex items-center gap-1.5 max-w-full shadow-lg shadow-[#FF6B00]/20 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Open Teams & Private Chat Lounge</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveModule('studio')}
                            className="px-3.5 py-2 rounded-xl bg-[#1E56A0] hover:bg-[#2563EB] text-white text-xs font-bold max-w-full cursor-pointer"
                          >
                            Board & Stockfish Studio
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveModule('tournaments')}
                            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-xs font-bold max-w-full cursor-pointer"
                          >
                            Live Tournaments
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4-Column KPI Grid (Scoped to Active Club) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-full min-w-0">
                    <div className="broadcast-panel p-4 sm:p-5 rounded-2xl min-w-0 max-w-full overflow-hidden">
                      <div className="text-[11px] sm:text-xs font-mono-tabular text-slate-400">
                        CLUB ROSTER
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mt-1 truncate">
                        {clubMembers.length} Players
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">
                        {clubConfig.clubName}
                      </div>
                    </div>

                    <div className="broadcast-panel p-4 sm:p-5 rounded-2xl min-w-0 max-w-full overflow-hidden">
                      <div className="text-[11px] sm:text-xs font-mono-tabular text-slate-400">
                        GAMES DATABASE
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-[#26E6DE] mt-1 truncate">
                        {approvedClubGames.length} Verified
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 font-mono-tabular mt-1 truncate">
                        {isAdminOrOwner
                          ? `${pendingClubGames.length} Pending Approval`
                          : 'Official PGN Archive'}
                      </div>
                    </div>

                    <div className="broadcast-panel p-4 sm:p-5 rounded-2xl min-w-0 max-w-full overflow-hidden">
                      <div className="text-[11px] sm:text-xs font-mono-tabular text-slate-400">
                        #1 CLUB LEADER
                      </div>
                      <div className="text-base sm:text-xl font-extrabold text-white mt-1 truncate">
                        {clubLeader ? clubLeader.name : '—'}
                      </div>
                      <div className="text-[11px] sm:text-xs font-mono-tabular text-[#FF6B00] font-bold mt-1 truncate">
                        {clubLeader
                          ? `Rapid ${clubLeader.fide.rapid} · Blitz ${clubLeader.fide.blitz}`
                          : '1500 Elo'}
                      </div>
                    </div>

                    <div className="broadcast-panel p-4 sm:p-5 rounded-2xl min-w-0 max-w-full overflow-hidden">
                      <div className="text-[11px] sm:text-xs font-mono-tabular text-slate-400">
                        ONLINE / OTB NOW
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-[#FF6B00] mt-1 truncate">
                        {freeNowPlayers.length} Ready
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">
                        In {clubConfig.clubName}
                      </div>
                    </div>
                  </div>

                  {/* CLUB NEWS & ADMIN ANNOUNCEMENTS FEED ON HOME SCREEN */}
                  <div className="broadcast-panel p-4 sm:p-6 rounded-2xl space-y-4 w-full max-w-full min-w-0 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 max-w-full min-w-0">
                      <div className="min-w-0 max-w-full">
                        <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold flex items-center gap-1.5 max-w-full">
                          <Megaphone className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            OFFICIAL {clubConfig.clubName.toUpperCase()} BULLETIN BOARD
                          </span>
                        </span>
                        <h3 className="text-lg font-bold text-white mt-0.5">
                          Club News, Tournament Calls & Admin Posts
                        </h3>
                      </div>

                      {isAdminOrOwner && (
                        <button
                          type="button"
                          onClick={() => setIsQuickPostModalOpen(true)}
                          className="px-3.5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold flex items-center gap-1.5 max-w-full cursor-pointer shadow-lg shadow-[#FF6B00]/20"
                        >
                          <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                          + Publish Home Post
                        </button>
                      )}
                    </div>

                    {clubPosts.length === 0 ? (
                      <div className="p-6 rounded-xl bg-[#061020]/70 text-center text-xs text-slate-400">
                        No announcements posted for {clubConfig.clubName} yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-full min-w-0">
                        {clubPosts.map((post) => (
                          <article
                            key={post.id}
                            className="p-4 rounded-xl bg-[#061020]/80 border border-white/10 space-y-2 flex flex-col justify-between max-w-full min-w-0 overflow-hidden"
                          >
                            <div className="space-y-1.5 min-w-0 max-w-full">
                              <div className="flex flex-wrap items-center gap-2 max-w-full min-w-0">
                                <span className="px-2 py-0.5 rounded bg-[#1E56A0]/40 text-[#26E6DE] font-mono-tabular text-[10px] font-bold uppercase">
                                  {post.category}
                                </span>
                                {post.pinned && (
                                  <span className="px-2 py-0.5 rounded bg-[#FF6B00]/20 text-[#FF6B00] font-mono-tabular text-[10px] font-bold uppercase">
                                    Pinned
                                  </span>
                                )}
                                <span className="text-[11px] font-mono-tabular text-slate-400">
                                  {post.createdAt}
                                </span>
                              </div>
                              <h4 className="text-sm sm:text-base font-bold text-white break-words">
                                {post.title}
                              </h4>
                              <p className="text-xs text-slate-300 leading-relaxed break-words">
                                {post.body}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-white/8 flex items-center justify-between text-[11px] text-slate-400 max-w-full min-w-0">
                              <span className="truncate">
                                Posted by{' '}
                                <strong className="text-slate-200">{post.authorName}</strong> (
                                {post.authorRole})
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rating Distribution & Club-Scoped Available Players */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-full min-w-0">
                    <div className="lg:col-span-6 broadcast-panel p-4 sm:p-6 rounded-2xl space-y-4 min-w-0 max-w-full overflow-hidden">
                      <div className="flex items-center justify-between gap-2 max-w-full min-w-0">
                        <div className="min-w-0">
                          <span className="text-xs font-mono-tabular uppercase text-slate-400 block truncate">
                            UNIFIED ELO DISTRIBUTION ({clubConfig.clubName.toUpperCase()})
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-white">
                            Club Rapid Elo Distribution
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveModule('members')}
                          className="min-h-[38px] px-2.5 text-xs font-bold text-[#26E6DE] hover:underline flex items-center gap-1 max-w-full shrink-0 cursor-pointer"
                        >
                          Full Roster <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-3 pt-2 max-w-full min-w-0">
                        {ratingBuckets.map((b) => {
                          const pctVal =
                            clubMembers.length > 0
                              ? Math.round((b.count / clubMembers.length) * 100)
                              : 0;
                          return (
                            <div key={b.range} className="space-y-1 max-w-full min-w-0">
                              <div className="flex items-center justify-between text-xs max-w-full min-w-0">
                                <span className="font-semibold text-slate-200">{b.range}</span>
                                <span className="font-mono-tabular text-slate-400">
                                  {b.count} members ({pctVal}%)
                                </span>
                              </div>
                              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[#1E56A0] to-[#26E6DE]"
                                  style={{ width: `${Math.max(8, pctVal)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="lg:col-span-6 broadcast-panel p-4 sm:p-6 rounded-2xl space-y-4 min-w-0 max-w-full overflow-hidden">
                      <div className="flex items-center justify-between gap-2 max-w-full min-w-0">
                        <div className="min-w-0">
                          <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold block truncate">
                            SCOPED TO {clubConfig.clubName.toUpperCase()}
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-white">
                            Club Members Online & OTB Right Now
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveModule('radar')}
                          className="min-h-[38px] px-2.5 text-xs font-bold text-[#26E6DE] hover:underline flex items-center gap-1 max-w-full shrink-0 cursor-pointer"
                        >
                          Free-Hour Radar <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2.5 max-w-full min-w-0">
                        {freeNowPlayers.slice(0, 4).map((p) => (
                          <div
                            key={p.id}
                            className="p-3 rounded-xl bg-[#061020]/70 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-full min-w-0 overflow-hidden"
                          >
                            <div className="min-w-0 max-w-full">
                              <div className="font-bold text-sm text-white truncate">
                                {p.name} ·{' '}
                                <span className="font-mono-tabular text-[#FF6B00]">
                                  Rapid {p.fide.rapid}
                                </span>{' '}
                                ·{' '}
                                <span className="font-mono-tabular text-[#26E6DE]">
                                  Blitz {p.fide.blitz}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 truncate">
                                {p.department} ·{' '}
                                {p.liveStatus === 'campus_otb'
                                  ? 'On Campus OTB'
                                  : 'Online Ready'}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 max-w-full shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMemberId(p.id);
                                  setActiveModule('members');
                                }}
                                className="min-h-[38px] flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/8 border border-white/15 text-slate-200 hover:bg-white/15 cursor-pointer"
                              >
                                Profile
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenPrivateChatWithMember(p.id)}
                                className="min-h-[38px] flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1E56A0] hover:bg-[#2563EB] text-white cursor-pointer"
                              >
                                DM / Play
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveModule('studio')}
                                className="min-h-[38px] flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#FF6B00] hover:bg-[#FF8533] text-white cursor-pointer"
                              >
                                Studio
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeModule === 'members' && (
                <MemberProfileView
                  members={clubMembers}
                  selectedMemberId={selectedMemberId}
                  currentUser={currentUser}
                  onSelectMember={(id) => setSelectedMemberId(id)}
                  onUpdateMemberStatus={handleUpdateMemberStatus}
                  onUpdateMemberAvatar={handleUpdateMemberAvatar}
                  onUpdateMemberCoverPhoto={handleUpdateMemberCoverPhoto}
                  onAddMemberPhotoPost={handleAddMemberPhotoPost}
                  onLikeMemberPhotoPost={handleLikeMemberPhotoPost}
                  onDeleteMemberPhotoPost={handleDeleteMemberPhotoPost}
                  onUpdateMemberRoleAndChessProfile={handleUpdateMemberRoleAndChessProfile}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onOpenAdminTab={() => setActiveModule('customizer')}
                  onOpenPrivateChat={handleOpenPrivateChatWithMember}
                  onSubmitGame={handleSubmitGame}
                  loggedGames={clubGames}
                  onLoadGameInStudio={(game) => {
                    setStudioGame(game);
                    setActiveModule('studio');
                  }}
                />
              )}

              {activeModule === 'studio' && (
                <ChessboardStudio
                  members={clubMembers}
                  loggedGames={approvedClubGames}
                  activeGame={studioGame}
                  currentUser={currentUser}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onSubmitGame={handleSubmitGame}
                />
              )}

              {activeModule === 'tournaments' && (
                <TournamentManager
                  members={clubMembers}
                  tournaments={clubTournaments}
                  currentUser={currentUser}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onCreateTournament={handleCreateTournament}
                  onRecordTournamentMatchPgn={handleRecordTournamentMatchPgn}
                  onPairNextSwissRound={handlePairNextSwissRound}
                  onDeleteTournament={handleDeleteTournament}
                  onClearTournamentHistory={handleClearTournamentHistory}
                  onReplayMatchPgn={(match, tourney) => {
                    const foundGame = loggedGames.find((g) => g.id === match.gameId);
                    if (foundGame) {
                      setStudioGame(foundGame);
                    } else if (match.pgn) {
                      setStudioGame({
                        id: `replay-${match.id}`,
                        clubId: tourney.clubId,
                        title: `${tourney.name} — Round ${match.round}`,
                        event: tourney.name,
                        date: tourney.createdAt,
                        whiteId: match.whiteId,
                        blackId: match.blackId,
                        result: match.result || '1-0',
                        timeControl: tourney.timeControl,
                        eco: 'C50',
                        openingName: `${tourney.name} Match`,
                        pgn: match.pgn,
                        status: 'approved',
                        moves: [],
                      });
                    }
                    setActiveModule('studio');
                  }}
                />
              )}

              {activeModule === 'lounge' && (
                <ClubChatHub
                  clubName={clubConfig.clubName}
                  clubs={clubs}
                  members={clubMembers}
                  allMembers={members}
                  currentUser={currentUser}
                  messages={chatMessages}
                  initialDmRecipientId={initialDmTargetId}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onSendMessage={handleSendChatMessage}
                  onQuickLogResult={handleSubmitGame}
                  onOpenStudioBoard={() => setActiveModule('studio')}
                />
              )}

              {activeModule === 'radar' && (
                <FreeHourRadar
                  members={clubMembers}
                  clubConfig={clubConfig}
                  currentUser={currentUser}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onToggleMemberSlot={handleToggleMemberSlot}
                  onUpdateMemberMeetupZone={handleUpdateMemberMeetupZone}
                  onUpdateMemberGps={handleUpdateMemberGps}
                  onChallengeMember={(member) => handleOpenPrivateChatWithMember(member.id)}
                />
              )}

              {activeModule === 'customizer' && isAdminOrOwner && (
                <ClubCustomizerSpec
                  clubs={clubs}
                  clubConfig={clubConfig}
                  onSelectClub={(c) => setClubConfig(c)}
                  onUpdateClubConfig={handleUpdateClubConfig}
                  onAddClub={handleAddClub}
                  onDeleteClub={handleDeleteClub}
                  members={clubMembers}
                  currentUser={currentUser}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onCreateMemberAccount={handleCreateMemberAccount}
                  onUpdateMemberRole={handleUpdateMemberRole}
                  onUpdateMemberPassword={handleUpdateMemberPassword}
                  onUpdateMemberRoleAndChessProfile={handleUpdateMemberRoleAndChessProfile}
                  onDeleteMemberAccount={handleDeleteMemberAccount}
                  ownershipLineage={ownershipLineage}
                  onDesignateSuccessor={handleDesignateSuccessor}
                  onTransferOwnershipToNextGen={handleTransferOwnershipToNextGen}
                  onReclaimFounderOwnership={handleReclaimFounderOwnership}
                  tournaments={clubTournaments}
                  onDeleteTournament={handleDeleteTournament}
                  onClearTournamentHistory={handleClearTournamentHistory}
                  pendingGames={pendingClubGames}
                  approvedGames={approvedClubGames}
                  onApprovePendingGame={handleApprovePendingGame}
                  onRejectPendingGame={handleRejectOrDeleteGame}
                  posts={clubPosts}
                  onCreatePost={handleCreatePost}
                  onDeletePost={handleDeletePost}
                  androidPreviewMode={androidPreviewMode}
                  onToggleAndroidPreview={() => setAndroidPreviewMode((v) => !v)}
                />
              )}
            </div>
          </main>
        </div>

        {/* BOTTOM MOBILE NAVIGATION BAR */}
        <nav
          aria-label="Mobile navigation"
          className={`${
            androidPreviewMode
              ? 'sticky bottom-0 flex'
              : 'fixed bottom-0 inset-x-0 flex lg:hidden'
          } bg-[#061020]/95 backdrop-blur-xl border-t border-white/15 px-1.5 py-1.5 justify-around items-center z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.6)]`}
        >
          {navItems.map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`min-h-[46px] flex-1 flex flex-col items-center justify-center gap-1 px-1 py-1 rounded-xl text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'text-[#26E6DE] bg-white/8 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="whitespace-nowrap">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ACCOUNT LOGIN & ROLE SWITCHER MODAL */}
      {isAuthModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0B1D36] text-white w-full max-w-md rounded-2xl border border-white/15 p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
                  CLUB AUTHENTICATION & ACCESS CONTROL
                </span>
                <h3 id="auth-modal-title" className="text-lg font-extrabold text-white">
                  Sign In to {clubConfig.clubName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {currentUser && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Signed in as {currentUser.name}
                  </div>
                  <div className="text-slate-300 font-mono-tabular mt-0.5">
                    Role: {currentUser.role.toUpperCase()} · @{currentUser.username}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out (Guest)
                </button>
              </div>
            )}

            {/* Option 1: Login with Admin-Issued Username & Password */}
            <form onSubmit={handleCredentialLogin} className="space-y-3">
              <div className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                Sign In with Admin-Issued Club Credentials
              </div>

              {loginError && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-xs text-rose-200">
                  {loginError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Club Username
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="e.g., fethallah, yasser, or wadjih"
                  className="w-full px-3 py-2 text-xs font-mono-tabular rounded-xl border border-white/15 bg-[#061020] text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password Code (Sent by Admin)
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="e.g., enp2026"
                  className="w-full px-3 py-2 text-xs font-mono-tabular rounded-xl border border-white/15 bg-[#061020] text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold cursor-pointer shadow-lg shadow-[#FF6B00]/25"
              >
                Sign In with Club Account
              </button>
            </form>

            {/* Option 2: Google Sign-In */}
            <div className="pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-[#061020] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue with Google Account</span>
              </button>
            </div>

            {/* Option 3: Instant Role / Account Switcher */}
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="text-[11px] font-mono-tabular uppercase text-slate-400">
                Quick Account Switcher (Owner / Member / Guest)
              </div>
              <div className="space-y-1.5">
                {[
                  {
                    id: 'enp-owner',
                    label: 'Fethallah (Platform Owner & Founder · ENP — All Permissions)',
                  },
                  {
                    id: 'enp-yasser-boureghda',
                    label: 'Boureghda Yasser (ENP Chimie · 1600 ELO · Member)',
                  },
                  {
                    id: 'enp-ahmed-wadjih',
                    label: 'Hammada Ahmed Wadjih (ENP 1CP · 1600 ELO · Member)',
                  },
                ].map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => {
                      setCurrentUserId(demo.id);
                      const foundMem = members.find((m) => m.id === demo.id);
                      const foundClub = clubs.find((c) => c.clubId === foundMem?.clubId);
                      if (foundClub) setClubConfig(foundClub);
                      setIsAuthModalOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold transition-colors cursor-pointer ${
                      currentUserId === demo.id
                        ? 'bg-[#1E56A0]/40 border-[#26E6DE] text-white'
                        : 'bg-[#061020]/70 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {demo.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold transition-colors cursor-pointer ${
                    currentUserId === null
                      ? 'bg-[#1E56A0]/40 border-[#26E6DE] text-white'
                      : 'bg-[#061020]/70 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  Browse as Unauthenticated Guest (Read-Only)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK PUBLISH POST MODAL (FROM HOME SCREEN) */}
      {isQuickPostModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-post-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0B1D36] text-white w-full max-w-md rounded-2xl border border-white/15 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold">
                  ADMIN HOME BULLETIN
                </span>
                <h3 id="quick-post-title" className="text-lg font-extrabold text-white">
                  Publish Post to {clubConfig.clubName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickPostModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!quickPostTitle.trim() || !quickPostBody.trim()) return;
                handleCreatePost({
                  title: quickPostTitle.trim(),
                  category: quickPostCategory,
                  body: quickPostBody.trim(),
                  pinned: true,
                });
                setQuickPostTitle('');
                setQuickPostBody('');
                setIsQuickPostModalOpen(false);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Headline
                </label>
                <input
                  type="text"
                  value={quickPostTitle}
                  onChange={(e) => setQuickPostTitle(e.target.value)}
                  placeholder="e.g., Registration Open for ENP Blitz Cup"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={quickPostCategory}
                  onChange={(e) =>
                    setQuickPostCategory(e.target.value as ClubPost['category'])
                  }
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
                >
                  <option value="Tournament">Tournament</option>
                  <option value="Club News">Club News</option>
                  <option value="Match Recap">Match Recap</option>
                  <option value="Campus Notice">Campus Notice</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Post Content
                </label>
                <textarea
                  rows={4}
                  value={quickPostBody}
                  onChange={(e) => setQuickPostBody(e.target.value)}
                  placeholder="Write details for club members..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickPostModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold cursor-pointer"
                >
                  Publish to Home Screen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
