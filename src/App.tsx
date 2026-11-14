import React, { useState, useEffect, useRef } from 'react';
import {
  ClubChatMessage,
  ClubGenerationRecord,
  ClubMember,
  ClubPost,
  ClubRoleDivision,
  ClubThemeConfig,
  ClubTournament,
  ENP_CAMPUS_MEETUP_ZONES,
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
  isLiveGpsFresh,
  resolveLivePresenceStatus,
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
import {
  IMG_CHESS_MEMBERS_HALL_BG,
  IMG_ENP_CLUB_LOGO,
  IMG_ENP_CREST_BANNER,
  IMG_ENP_SCHOOL_LOGO,
  IMG_MIKHAIL_TAL_HERO,
  resolveAssetUrl,
} from './utils/assetUrls';
import {
  auth,
  db,
  googleProvider,
  buildClubAuthEmail,
  provisionClubMemberAuthAccount,
  OperationType,
  handleFirestoreError,
  stripUndefined,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  fbSignOut,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  where,
  writeBatch,
  deleteField,
  User,
} from './firebase';
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

function normalizeClubConfigAssets(c: ClubThemeConfig): ClubThemeConfig {
  return {
    ...c,
    customLogoUrl: resolveAssetUrl(c.customLogoUrl, IMG_ENP_CLUB_LOGO),
    schoolLogoUrl: resolveAssetUrl(c.schoolLogoUrl, IMG_ENP_SCHOOL_LOGO),
    clubBannerUrl: resolveAssetUrl(c.clubBannerUrl, IMG_ENP_CREST_BANNER),
    customHeroUrl: resolveAssetUrl(c.customHeroUrl, IMG_MIKHAIL_TAL_HERO),
  };
}

function normalizeMemberAssets(m: ClubMember): ClubMember {
  return {
    ...m,
    avatarUrl: m.avatarUrl ? resolveAssetUrl(m.avatarUrl) || undefined : undefined,
    coverPhotoUrl: m.coverPhotoUrl
      ? resolveAssetUrl(m.coverPhotoUrl) || undefined
      : undefined,
    profilePhotos: m.profilePhotos?.map((p) => ({
      ...p,
      imageUrl: resolveAssetUrl(p.imageUrl, p.imageUrl),
    })),
  };
}

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

        return normalizeClubConfigAssets({
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
        });
      }
    } catch {
      // ignore storage error
    }
    return normalizeClubConfigAssets(UNIVERSITY_PRESETS[0]);
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

  // Auth & Role State (Guest Read-Only by default; verified via Firebase Club Account or Google Auth)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [cloudClubExists, setCloudClubExists] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const isSeedingRef = useRef<boolean>(false);
  const legacyCloudMigratedRef = useRef<boolean>(false);
  const onlineInitializedForSessionRef = useRef<string | null>(null);

  // Automatic Network & Heartbeat Presence State
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [presenceClockMs, setPresenceClockMs] = useState<number>(() => Date.now());

  // Quick Home Post Modal State (for Admins on Overview)
  const [isQuickPostModalOpen, setIsQuickPostModalOpen] = useState<boolean>(false);
  const [quickPostTitle, setQuickPostTitle] = useState<string>('');
  const [quickPostCategory, setQuickPostCategory] = useState<ClubPost['category']>('Club News');
  const [quickPostBody, setQuickPostBody] = useState<string>('');

  const currentUserRaw = members.find((m) => m.id === currentUserId) || null;
  const currentUserRef = useRef<ClubMember | null>(null);
  currentUserRef.current = currentUserRaw;

  const withResolvedPresence = (m: ClubMember): ClubMember => {
    const isMeOfflineNow = m.id === currentUserId && !isNetworkOnline;
    const resolvedStatus = isMeOfflineNow
      ? 'offline'
      : resolveLivePresenceStatus(m, presenceClockMs);
    const gpsFresh =
      !isMeOfflineNow &&
      resolvedStatus !== 'offline' &&
      isLiveGpsFresh(m, presenceClockMs);
    return {
      ...m,
      liveStatus: resolvedStatus,
      gpsLocation: gpsFresh ? m.gpsLocation : undefined,
    };
  };

  // Scoped Data for the Active Club (presence-aware across Dashboard, Directory, Chat & Radar)
  const clubMembers = members
    .filter((m) => m.clubId === clubConfig.clubId)
    .map(withResolvedPresence);
  const currentUser = currentUserRaw ? withResolvedPresence(currentUserRaw) : null;
  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';
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

  // Helpers to persist / delete in Firestore with structured error tracking
  const syncDocToFirestore = async (
    collectionPath: string,
    docId: string,
    data: Record<string, unknown>
  ) => {
    if (!auth.currentUser) return;
    try {
      const cleanData = stripUndefined(data) as Record<string, unknown>;
      await setDoc(doc(db, collectionPath, docId), cleanData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${docId}`);
    }
  };

  const deleteDocFromFirestore = async (collectionPath: string, docId: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, collectionPath, docId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionPath}/${docId}`);
    }
  };

  // Seed or re-sync current active club data into Firestore (Owner only)
  // Writes parent /clubs/{clubId} document FIRST so subcollection clubExists() gates always succeed cleanly.
  const seedClubToFirestore = async (overrideOwnerUid?: string) => {
    const activeUid = overrideOwnerUid || auth.currentUser?.uid;
    if (!activeUid || isSeedingRef.current) return;
    isSeedingRef.current = true;
    const targetClubId = clubConfig.clubId;
    const now = new Date().toISOString();
    try {
      // Step 1: Commit parent club document first
      await setDoc(
        doc(db, 'clubs', targetClubId),
        stripUndefined({
          ...clubConfig,
          createdByUid: activeUid,
          updatedAt: now,
        }),
        { merge: true }
      );

      // Step 2: Queue subcollection documents in safe batches (< 400 writes each)
      const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];

      for (const m of members.filter((x) => x.clubId === targetClubId)) {
        ops.push({
          ref: doc(db, `clubs/${targetClubId}/members`, m.id),
          data: stripUndefined({
            ...m,
            authUid: m.id === 'enp-owner' ? activeUid : m.authUid,
            updatedAt: now,
          }) as Record<string, unknown>,
        });
      }
      for (const p of posts.filter((x) => x.clubId === targetClubId)) {
        ops.push({
          ref: doc(db, `clubs/${targetClubId}/posts`, p.id),
          data: stripUndefined(p) as unknown as Record<string, unknown>,
        });
      }
      for (const t of tournaments.filter((x) => x.clubId === targetClubId)) {
        ops.push({
          ref: doc(db, `clubs/${targetClubId}/tournaments`, t.id),
          data: stripUndefined(t) as unknown as Record<string, unknown>,
        });
      }
      for (const g of loggedGames.filter((x) => x.clubId === targetClubId)) {
        ops.push({
          ref: doc(db, `clubs/${targetClubId}/games`, g.id),
          data: stripUndefined(g) as unknown as Record<string, unknown>,
        });
      }
      for (const l of ownershipLineage.filter((x) => x.clubId === targetClubId)) {
        ops.push({
          ref: doc(db, `clubs/${targetClubId}/lineage`, l.id),
          data: stripUndefined(l) as unknown as Record<string, unknown>,
        });
      }

      for (let i = 0; i < ops.length; i += 350) {
        const batch = writeBatch(db);
        const chunk = ops.slice(i, i + 350);
        chunk.forEach((op) => batch.set(op.ref, op.data, { merge: true }));
        await batch.commit();
      }

      setCloudClubExists(true);
      setIsCloudSynced(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `clubs/${targetClubId}`);
    } finally {
      isSeedingRef.current = false;
    }
  };

  // --- FIREBASE AUTH LISTENER ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        onlineInitializedForSessionRef.current = null;
        setCurrentUserId(null);
      }
    });
    return () => unsub();
  }, []);

  // --- AUTOMATIC CONNECTION & HEARTBEAT PRESENCE ---
  useEffect(() => {
    const handleOnline = () => {
      setIsNetworkOnline(true);
      setPresenceClockMs(Date.now());
    };
    const handleOffline = () => {
      setIsNetworkOnline(false);
      setPresenceClockMs(Date.now());
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const clockInterval = window.setInterval(() => {
      setPresenceClockMs(Date.now());
    }, 30_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(clockInterval);
    };
  }, []);

  useEffect(() => {
    const markOfflineBestEffort = () => {
      const activeMember = currentUserRef.current;
      if (!auth.currentUser || !activeMember) return;
      const now = new Date().toISOString();
      setDoc(
        doc(db, `clubs/${activeMember.clubId}/members`, activeMember.id),
        {
          liveStatus: 'offline',
          gpsLocation: deleteField(),
          updatedAt: now,
        },
        { merge: true }
      ).catch(() => {});
    };

    window.addEventListener('pagehide', markOfflineBestEffort);
    window.addEventListener('beforeunload', markOfflineBestEffort);
    return () => {
      window.removeEventListener('pagehide', markOfflineBestEffort);
      window.removeEventListener('beforeunload', markOfflineBestEffort);
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser || !currentUserRaw || !isNetworkOnline) return;

    const sessionKey = `${firebaseUser.uid}:${currentUserRaw.id}`;
    const isInitialConnect = onlineInitializedForSessionRef.current !== sessionKey;
    if (isInitialConnect) {
      onlineInitializedForSessionRef.current = sessionKey;
    }

    const sendHeartbeat = (allowInitialOnlineFlip: boolean) => {
      const latestMember = currentUserRef.current;
      if (!auth.currentUser || !latestMember || !navigator.onLine) return;

      const isManualOffline = !allowInitialOnlineFlip && latestMember.liveStatus === 'offline';
      if (isManualOffline) return;

      const nextStatus: MemberLiveStatus =
        latestMember.liveStatus === 'offline' ? 'online_ready' : latestMember.liveStatus;
      const nowIso = new Date().toISOString();
      setPresenceClockMs(Date.now());

      setMembers((prev) =>
        prev.map((m) =>
          m.id === latestMember.id
            ? { ...m, liveStatus: nextStatus, updatedAt: nowIso }
            : m
        )
      );

      setDoc(
        doc(db, `clubs/${latestMember.clubId}/members`, latestMember.id),
        {
          liveStatus: nextStatus,
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
    };

    sendHeartbeat(isInitialConnect);

    const heartbeatTimer = window.setInterval(() => {
      sendHeartbeat(false);
    }, 60_000);

    return () => window.clearInterval(heartbeatTimer);
  }, [firebaseUser?.uid, currentUserRaw?.id, isNetworkOnline]);

  // Resolve active member profile cleanly whenever Firebase Auth user or members list updates
  useEffect(() => {
    if (!firebaseUser) {
      setCurrentUserId(null);
      return;
    }
    const email = firebaseUser.email?.toLowerCase() || '';
    if (email === 'fethallah2411@gmail.com' && firebaseUser.emailVerified) {
      setCurrentUserId('enp-owner');
      return;
    }
    const matched = members.find(
      (m) => m.authUid === firebaseUser.uid || m.id === firebaseUser.uid
    );
    if (matched) {
      setCurrentUserId(matched.id);
      return;
    }
    if (email.endsWith('.enpchess.app')) {
      const localPart = email.split('@')[0] || '';
      const suffix = `.${clubConfig.clubId.toLowerCase()}`;
      const uname = localPart.endsWith(suffix)
        ? localPart.slice(0, -suffix.length)
        : localPart.split('.')[0];
      const byUsername = members.find(
        (m) => m.clubId === clubConfig.clubId && m.username.toLowerCase() === uname
      );
      if (byUsername) {
        setCurrentUserId(byUsername.id);
      }
    }
  }, [firebaseUser?.uid, firebaseUser?.email, firebaseUser?.emailVerified, members, clubConfig.clubId]);

  // Automatically bootstrap Firestore once when Owner signs in if club doc does not exist yet
  useEffect(() => {
    if (
      !firebaseUser ||
      firebaseUser.email?.toLowerCase() !== 'fethallah2411@gmail.com' ||
      !firebaseUser.emailVerified
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'clubs', clubConfig.clubId));
        if (!cancelled && !snap.exists()) {
          await seedClubToFirestore(firebaseUser.uid);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `clubs/${clubConfig.clubId}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid, firebaseUser?.email, firebaseUser?.emailVerified, clubConfig.clubId]);

  // --- TWO-WAY FIRESTORE REAL-TIME LISTENERS ---
  useEffect(() => {
    const clubsQ = query(collection(db, 'clubs'), where('startingRating', '>=', 400));
    const unsubClubs = onSnapshot(
      clubsQ,
      (snapshot) => {
        if (!snapshot.empty) {
          const rawCloudClubs = snapshot.docs.map((d) => d.data() as ClubThemeConfig);
          const cloudClubs = rawCloudClubs.map(normalizeClubConfigAssets);
          setClubs(cloudClubs);
          const matchedActiveRaw = rawCloudClubs.find((c) => c.clubId === clubConfig.clubId);
          const matchedActive = cloudClubs.find((c) => c.clubId === clubConfig.clubId);
          setCloudClubExists(Boolean(matchedActive));
          if (matchedActive) {
            setClubConfig(matchedActive);
          }
          setIsCloudSynced(true);

          // Automatically upgrade legacy or dead asset URLs stored in Firestore when Owner connects
          const hasLegacyAssetUrl =
            matchedActiveRaw &&
            matchedActive &&
            (matchedActiveRaw.customLogoUrl !== matchedActive.customLogoUrl ||
              matchedActiveRaw.schoolLogoUrl !== matchedActive.schoolLogoUrl ||
              matchedActiveRaw.clubBannerUrl !== matchedActive.clubBannerUrl ||
              matchedActiveRaw.customHeroUrl !== matchedActive.customHeroUrl);
          if (
            hasLegacyAssetUrl &&
            !legacyCloudMigratedRef.current &&
            auth.currentUser?.email?.toLowerCase() === 'fethallah2411@gmail.com' &&
            auth.currentUser.emailVerified
          ) {
            legacyCloudMigratedRef.current = true;
            setDoc(
              doc(db, 'clubs', matchedActiveRaw.clubId),
              stripUndefined({
                ...matchedActive!,
                updatedAt: new Date().toISOString(),
              }),
              { merge: true }
            ).catch(() => {});
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'clubs')
    );
    return () => unsubClubs();
  }, [clubConfig.clubId]);

  useEffect(() => {
    const cid = clubConfig.clubId;
    const unsubMembers = onSnapshot(
      query(collection(db, `clubs/${cid}/members`), where('clubId', '==', cid)),
      (snapshot) => {
        if (!snapshot.empty || cloudClubExists) {
          const loaded = snapshot.docs.map((d) => normalizeMemberAssets(d.data() as ClubMember));
          if (loaded.length > 0) {
            setMembers((prev) => [...prev.filter((m) => m.clubId !== cid), ...loaded]);
            setIsCloudSynced(true);
            if (firebaseUser) {
              const isFounder =
                firebaseUser.email?.toLowerCase() === 'fethallah2411@gmail.com' &&
                firebaseUser.emailVerified;
              if (isFounder) {
                const ownerDoc = loaded.find((m) => m.id === 'enp-owner');
                if (ownerDoc) setCurrentUserId(ownerDoc.id);
              } else {
                const matched = loaded.find(
                  (m) => m.authUid === firebaseUser.uid || m.id === firebaseUser.uid
                );
                if (matched) setCurrentUserId(matched.id);
              }
            }
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `clubs/${cid}/members`)
    );

    const unsubGames = onSnapshot(
      query(collection(db, `clubs/${cid}/games`), where('clubId', '==', cid)),
      (snapshot) => {
        if (!snapshot.empty || cloudClubExists) {
          const loaded = snapshot.docs.map((d) => d.data() as LoggedClubGame);
          setLoggedGames((prev) => [...prev.filter((g) => g.clubId !== cid), ...loaded]);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `clubs/${cid}/games`)
    );

    const unsubTournaments = onSnapshot(
      query(collection(db, `clubs/${cid}/tournaments`), where('clubId', '==', cid)),
      (snapshot) => {
        if (!snapshot.empty || cloudClubExists) {
          const loaded = snapshot.docs.map((d) => d.data() as ClubTournament);
          setTournaments((prev) => [...prev.filter((t) => t.clubId !== cid), ...loaded]);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `clubs/${cid}/tournaments`)
    );

    const unsubPosts = onSnapshot(
      query(collection(db, `clubs/${cid}/posts`), where('clubId', '==', cid)),
      (snapshot) => {
        if (!snapshot.empty || cloudClubExists) {
          const loaded = snapshot.docs.map((d) => d.data() as ClubPost);
          setPosts((prev) => [...prev.filter((p) => p.clubId !== cid), ...loaded]);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `clubs/${cid}/posts`)
    );

    const unsubLineage = onSnapshot(
      query(collection(db, `clubs/${cid}/lineage`), where('clubId', '==', cid)),
      (snapshot) => {
        if (!snapshot.empty || cloudClubExists) {
          const loaded = snapshot.docs.map((d) => d.data() as ClubGenerationRecord);
          if (loaded.length > 0) {
            setOwnershipLineage((prev) => [
              ...prev.filter((l) => l.clubId !== cid),
              ...loaded,
            ]);
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `clubs/${cid}/lineage`)
    );

    const unsubTeamMessages = onSnapshot(
      query(
        collection(db, `clubs/${cid}/messages`),
        where('clubId', '==', cid),
        where('channelType', '==', 'team')
      ),
      (snapshot) => {
        if (!snapshot.empty || cloudClubExists) {
          const teamMsgs = snapshot.docs.map((d) => d.data() as ClubChatMessage);
          setChatMessages((prev) => {
            const others = prev.filter((m) => m.clubId !== cid || m.channelType === 'dm');
            return [...others, ...teamMsgs];
          });
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `clubs/${cid}/messages`)
    );

    let unsubDmMessages: (() => void) | null = null;
    if (firebaseUser?.uid) {
      unsubDmMessages = onSnapshot(
        query(
          collection(db, `clubs/${cid}/messages`),
          where('clubId', '==', cid),
          where('participantAuthUids', 'array-contains', firebaseUser.uid)
        ),
        (snapshot) => {
          const dmMsgs = snapshot.docs.map((d) => d.data() as ClubChatMessage);
          setChatMessages((prev) => {
            const others = prev.filter((m) => m.clubId !== cid || m.channelType !== 'dm');
            return [...others, ...dmMsgs];
          });
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `clubs/${cid}/messages`)
      );
    }

    return () => {
      unsubMembers();
      unsubGames();
      unsubTournaments();
      unsubPosts();
      unsubLineage();
      unsubTeamMessages();
      if (unsubDmMessages) unsubDmMessages();
    };
  }, [clubConfig.clubId, cloudClubExists, firebaseUser?.uid]);

  // --- AUTHENTICATION HANDLERS ---
  const handleClubAccountLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUser = loginUsername.trim();
    if (!rawUser || !loginPassword) {
      setLoginError('Please enter both your Club Username and Password.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const loginEmail = buildClubAuthEmail(rawUser, clubConfig.clubId);
      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const cleanUname = rawUser.toLowerCase().replace(/^@+/, '');
      const matched = members.find(
        (m) =>
          m.authUid === cred.user.uid ||
          m.id === cred.user.uid ||
          (m.linkedAuthUids && m.linkedAuthUids.includes(cred.user.uid)) ||
          (m.clubId === clubConfig.clubId && m.username.toLowerCase() === cleanUname)
      );
      if (matched) {
        setCurrentUserId(matched.id);
        if (matched.authUid !== cred.user.uid && (!matched.linkedAuthUids || !matched.linkedAuthUids.includes(cred.user.uid))) {
          const nowIso = new Date().toISOString();
          const updated = {
            ...matched,
            authUid: matched.authUid || cred.user.uid,
            linkedAuthUids: [...(matched.linkedAuthUids || []), cred.user.uid].filter((u, i, arr) => arr.indexOf(u) === i && u !== matched.authUid),
            updatedAt: nowIso,
          };
          setMembers((prev) => prev.map((m) => (m.id === matched.id ? updated : m)));
          await syncDocToFirestore(`clubs/${clubConfig.clubId}/members`, updated.id, updated);
        }
      }
      setLoginPassword('');
      setIsAuthModalOpen(false);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setLoginError(
          'Email/Password login is not enabled in Firebase Console yet. Owner: open Firebase Console -> Authentication -> Sign-in method -> enable Email/Password, or use Google Sign-In below.'
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setLoginError(
          'Invalid club username or password. Ask a Club Admin to issue or verify your account credentials.'
        );
      } else {
        setLoginError('Could not sign in with those credentials. Please check your username and password.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoginError('');
      const cred = await signInWithPopup(auth, googleProvider);
      const email = cred.user.email?.toLowerCase() || '';
      const googleName = (cred.user.displayName || '').trim().toLowerCase();
      const normGoogleName = googleName.replace(/[^a-z]/g, '');

      if (email === 'fethallah2411@gmail.com' || normGoogleName.includes('fethallah') || normGoogleName.includes('ouadah')) {
        setCurrentUserId('enp-owner');
        const clubSnap = await getDoc(doc(db, 'clubs', clubConfig.clubId));
        if (!clubSnap.exists()) {
          await seedClubToFirestore(cred.user.uid);
        } else {
          const ownerDoc = members.find((m) => m.id === 'enp-owner');
          if (ownerDoc) {
            const nowIso = new Date().toISOString();
            const existingLinks = ownerDoc.linkedAuthUids || [];
            const updatedOwner = {
              ...ownerDoc,
              authUid: ownerDoc.authUid || cred.user.uid,
              linkedAuthUids: ownerDoc.authUid && ownerDoc.authUid !== cred.user.uid && !existingLinks.includes(cred.user.uid) ? [...existingLinks, cred.user.uid] : existingLinks,
              liveStatus: 'online_ready' as MemberLiveStatus,
              updatedAt: nowIso,
            };
            setMembers((prev) => prev.map((m) => (m.id === 'enp-owner' ? updatedOwner : m)));
            await syncDocToFirestore(`clubs/${clubConfig.clubId}/members`, 'enp-owner', updatedOwner);
          }
        }
      } else {
        // Match existing member by authUid, linkedAuthUids, email username, or normalized full name (e.g. Yasser Boureghda / Ouadah Feth Allah)
        const emailUname = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        const matched = members.find((m) => {
          if (m.authUid === cred.user.uid || m.id === cred.user.uid || (m.linkedAuthUids && m.linkedAuthUids.includes(cred.user.uid))) {
            return true;
          }
          if (emailUname && m.username.toLowerCase().replace(/[^a-z0-9]/g, '') === emailUname) {
            return true;
          }
          const normMemberName = m.name.toLowerCase().replace(/[^a-z]/g, '');
          if (normGoogleName && normMemberName && (normMemberName.includes(normGoogleName) || normGoogleName.includes(normMemberName))) {
            return true;
          }
          return false;
        });

        if (matched) {
          setCurrentUserId(matched.id);
          if (matched.authUid !== cred.user.uid && (!matched.linkedAuthUids || !matched.linkedAuthUids.includes(cred.user.uid))) {
            const nowIso = new Date().toISOString();
            const updated = {
              ...matched,
              authUid: matched.authUid || cred.user.uid,
              linkedAuthUids: [...(matched.linkedAuthUids || []), cred.user.uid].filter((u, i, arr) => arr.indexOf(u) === i && u !== matched.authUid),
              updatedAt: nowIso,
            };
            setMembers((prev) => prev.map((m) => (m.id === matched.id ? updated : m)));
            await syncDocToFirestore(`clubs/${clubConfig.clubId}/members`, updated.id, updated);
          }
        } else {
          const newId = cred.user.uid;
          const nowIso = new Date().toISOString();
          const base = clubConfig.startingRating || 1200;
          const baseHandle =
            (cred.user.displayName || 'member')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '')
              .slice(0, 20) || `player${newId.slice(0, 5)}`;
          const newMember: ClubMember = {
            id: newId,
            clubId: clubConfig.clubId,
            authUid: cred.user.uid,
            name: cred.user.displayName || 'Club Member',
            arabicName: 'عضو نادي الشطرنج',
            username: baseHandle,
            role: 'member',
            clubRoleDivision: 'Club Member',
            university: clubConfig.universityName,
            department: 'Polytechnic Engineering',
            yearLevel: 'Ingénieur',
            titleBadge: 'Verified Member',
            liveStatus: 'online_ready',
            updatedAt: nowIso,
            bio: 'Signed in via verified Google Account.',
            avatarUrl: cred.user.photoURL || undefined,
            avatarInitials: (cred.user.displayName || 'CM').slice(0, 2).toUpperCase(),
            avatarColor: clubConfig.accentColor,
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
                event: 'Verified Google Onboarding',
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
          setMembers((prev) => [newMember, ...prev]);
          setCurrentUserId(newId);
          const clubSnap = await getDoc(doc(db, 'clubs', clubConfig.clubId));
          if (clubSnap.exists()) {
            await syncDocToFirestore(`clubs/${clubConfig.clubId}/members`, newId, newMember as unknown as Record<string, unknown>);
          }
        }
      }
      setIsAuthModalOpen(false);
    } catch {
      setLoginError('Google Sign-In popup was closed or blocked. Please allow popups and try again.');
    }
  };

  const handleSignOut = async () => {
    const signingOutMember = currentUserRef.current;
    const nowIso = new Date().toISOString();
    onlineInitializedForSessionRef.current = null;

    if (signingOutMember) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === signingOutMember.id
            ? { ...m, liveStatus: 'offline', gpsLocation: undefined, updatedAt: nowIso }
            : m
        )
      );
      if (auth.currentUser) {
        try {
          await setDoc(
            doc(db, `clubs/${signingOutMember.clubId}/members`, signingOutMember.id),
            {
              liveStatus: 'offline',
              gpsLocation: deleteField(),
              updatedAt: nowIso,
            },
            { merge: true }
          );
        } catch {
          // ignore offline write failure during sign-out
        }
      }
    }

    try {
      await fbSignOut(auth);
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

    const nextWhiteOpenings = mergeMemberOpeningStat(white.openings, detectedOpening, 'white', whiteRes);
    const updatedWhite: ClubMember = {
      ...white,
      openings: nextWhiteOpenings,
      signatureOpening: nextWhiteOpenings[0]?.name || white.signatureOpening,
      fide: {
        ...white.fide,
        [timeControl]: preview.whiteNew,
        peak: Math.max(white.fide.peak, preview.whiteNew),
        delta30d: white.fide.delta30d + preview.whiteDelta,
        gamesPlayed: white.fide.gamesPlayed + 1,
      },
      ratingHistory: [
        ...white.ratingHistory,
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

    const nextBlackOpenings = mergeMemberOpeningStat(black.openings, detectedOpening, 'black', blackRes);
    const updatedBlack: ClubMember = {
      ...black,
      openings: nextBlackOpenings,
      signatureOpening: nextBlackOpenings[0]?.name || black.signatureOpening,
      fide: {
        ...black.fide,
        [timeControl]: preview.blackNew,
        peak: Math.max(black.fide.peak, preview.blackNew),
        delta30d: black.fide.delta30d + preview.blackDelta,
        gamesPlayed: black.fide.gamesPlayed + 1,
      },
      ratingHistory: [
        ...black.ratingHistory,
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

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === updatedWhite.id) return updatedWhite;
        if (m.id === updatedBlack.id) return updatedBlack;
        return m;
      })
    );

    const now = new Date().toISOString();
    syncDocToFirestore(`clubs/${updatedWhite.clubId}/members`, updatedWhite.id, {
      ...updatedWhite,
      updatedAt: now,
    });
    syncDocToFirestore(`clubs/${updatedBlack.clubId}/members`, updatedBlack.id, {
      ...updatedBlack,
      updatedAt: now,
    });

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
      submittedByUid: auth.currentUser?.uid,
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

    const updatedGame: LoggedClubGame = { ...target, status: 'approved' };
    setLoggedGames((prev) =>
      prev.map((g) => (g.id === gameId ? updatedGame : g))
    );
    syncDocToFirestore(`clubs/${target.clubId}/games`, gameId, { ...updatedGame });
  };

  const handleRejectOrDeleteGame = (gameId: string) => {
    if (!isAdminOrOwner) return;
    const target = loggedGames.find((g) => g.id === gameId);
    setLoggedGames((prev) => prev.filter((g) => g.id !== gameId));
    deleteDocFromFirestore(`clubs/${target?.clubId || clubConfig.clubId}/games`, gameId);
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
      submittedByUid: auth.currentUser?.uid,
      whiteEloDelta: deltas.whiteDelta,
      blackEloDelta: deltas.blackDelta,
      tournamentId: tourney.id,
      moves: [],
    };

    setLoggedGames((prev) => [newGame, ...prev]);
    syncDocToFirestore(`clubs/${tourney.clubId}/games`, newGame.id, { ...newGame });

    let updatedTourney: ClubTournament = tourney;
    if (tourney.format === 'knockout' || tourney.format === 'double_elimination') {
      const advancedMatches = advanceEliminationBracket(
        tourney.matches,
        payload.matchId,
        payload.result,
        payload.pgn,
        newGameId
      );
      const maxR = advancedMatches.reduce((acc, m) => Math.max(acc, m.round), 1);
      const finalMatches = advancedMatches.filter((m) => m.round === maxR);
      const allFinalDone =
        finalMatches.length > 0 && finalMatches.every((m) => m.result !== null);

      const unplayedRounds = advancedMatches
        .filter((m) => m.result === null)
        .map((m) => m.round);
      const nextCurrentRound =
        unplayedRounds.length > 0 ? Math.min(...unplayedRounds) : maxR;

      updatedTourney = {
        ...tourney,
        status: allFinalDone ? 'completed' : 'active',
        currentRound: nextCurrentRound,
        matches: advancedMatches,
      };
    } else {
      let updatedMatches = tourney.matches.map((m) =>
        m.id === payload.matchId
          ? { ...m, result: payload.result, pgn: payload.pgn, gameId: newGameId }
          : m
      );

      let nextCurrentRound = tourney.currentRound;
      let nextStatus = tourney.status;

      if (tourney.format === 'swiss') {
        const maxR = updatedMatches.reduce((acc, m) => Math.max(acc, m.round), 1);
        const currentRoundMatches = updatedMatches.filter((m) => m.round === maxR);
        const allCurrentRoundFinished =
          currentRoundMatches.length > 0 &&
          currentRoundMatches.every((m) => m.result !== null);

        if (allCurrentRoundFinished) {
          if (maxR < tourney.totalRounds) {
            const players = tourney.playerIds
              .map((id) => {
                const mem = members.find((x) => x.id === id);
                return mem
                  ? {
                      id: mem.id,
                      name: mem.name,
                      department: mem.department,
                      rating: mem.fide[tourney.timeControl],
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
        const roundMatches = updatedMatches.filter((m) => m.round === tourney.currentRound);
        const allRoundFinished =
          roundMatches.length > 0 && roundMatches.every((m) => m.result !== null);
        if (allRoundFinished) {
          const hasNextRound = updatedMatches.some((m) => m.round === tourney.currentRound + 1);
          if (hasNextRound) {
            nextCurrentRound = tourney.currentRound + 1;
          } else if (updatedMatches.every((m) => m.result !== null)) {
            nextStatus = 'completed';
          }
        }
      }

      updatedTourney = {
        ...tourney,
        status: nextStatus,
        currentRound: nextCurrentRound,
        matches: updatedMatches,
      };
    }

    setTournaments((prev) =>
      prev.map((t) => (t.id === tourney.id ? updatedTourney : t))
    );
    syncDocToFirestore(`clubs/${tourney.clubId}/tournaments`, updatedTourney.id, {
      ...updatedTourney,
    });
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

    const updatedTourney: ClubTournament = {
      ...tourney,
      currentRound: maxR + 1,
      matches: [...tourney.matches, ...nextPairings],
    };

    setTournaments((prev) =>
      prev.map((t) => (t.id === tournamentId ? updatedTourney : t))
    );
    syncDocToFirestore(`clubs/${tourney.clubId}/tournaments`, tournamentId, {
      ...updatedTourney,
    });
  };

  const handleDeleteTournament = (tournamentId: string) => {
    if (!isAdminOrOwner) return;
    const target = tournaments.find((t) => t.id === tournamentId);
    const cid = target?.clubId || clubConfig.clubId;
    const removedGames = loggedGames.filter((g) => g.tournamentId === tournamentId);
    setTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
    setLoggedGames((prev) => prev.filter((g) => g.tournamentId !== tournamentId));
    deleteDocFromFirestore(`clubs/${cid}/tournaments`, tournamentId);
    removedGames.forEach((g) => deleteDocFromFirestore(`clubs/${cid}/games`, g.id));
  };

  const handleClearTournamentHistory = () => {
    if (!isAdminOrOwner) return;
    const completedTourneys = tournaments.filter(
      (t) => t.clubId === clubConfig.clubId && t.status === 'completed'
    );
    const completedIds = new Set(completedTourneys.map((t) => t.id));
    const removedGames = loggedGames.filter(
      (g) => g.tournamentId && completedIds.has(g.tournamentId)
    );
    setTournaments((prev) =>
      prev.filter((t) => !(t.clubId === clubConfig.clubId && t.status === 'completed'))
    );
    setLoggedGames((prev) =>
      prev.filter((g) => !g.tournamentId || !completedIds.has(g.tournamentId))
    );
    completedTourneys.forEach((t) =>
      deleteDocFromFirestore(`clubs/${clubConfig.clubId}/tournaments`, t.id)
    );
    removedGames.forEach((g) =>
      deleteDocFromFirestore(`clubs/${clubConfig.clubId}/games`, g.id)
    );
  };

  // --- MEMBER ACCOUNT, ROLE, CHESS SPECIALTY & INHERITANCE HANDLERS ---
  const handleProvisionMemberLogin = async (
    memberId: string,
    password: string
  ): Promise<{ ok: boolean; username: string; errorCode?: string; message: string }> => {
    if (!isAdminOrOwner) {
      return { ok: false, username: '', message: 'Admin privileges required.' };
    }
    const target = members.find((m) => m.id === memberId);
    if (!target) {
      return { ok: false, username: '', message: 'Member not found.' };
    }
    if (password.trim().length < 6) {
      return {
        ok: false,
        username: target.username,
        message: 'Password must be at least 6 characters.',
      };
    }

    try {
      const { uid } = await provisionClubMemberAuthAccount(
        target.clubId,
        target.username,
        password.trim()
      );
      const updated: ClubMember = { ...target, authUid: uid };
      setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
      await syncDocToFirestore(`clubs/${updated.clubId}/members`, updated.id, {
        ...updated,
        updatedAt: new Date().toISOString(),
      });
      if (updated.role === 'admin' && currentUser?.role === 'owner') {
        await syncDocToFirestore('admins', uid, {
          uid,
          role: 'admin',
          name: updated.name,
        });
      }
      return {
        ok: true,
        username: updated.username,
        message: `Issued Cloud Login for @${updated.username}`,
      };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        return {
          ok: false,
          username: target.username,
          errorCode: code,
          message:
            'Enable Email/Password in Firebase Console -> Authentication -> Sign-in method first.',
        };
      }
      if (code === 'auth/email-already-in-use') {
        return {
          ok: false,
          username: target.username,
          errorCode: code,
          message: `Login account for @${target.username} is already provisioned in Firebase Auth.`,
        };
      }
      return {
        ok: false,
        username: target.username,
        errorCode: code,
        message: 'Could not provision Firebase login account.',
      };
    }
  };

  const handleCreateMemberAccount = async (payload: {
    name: string;
    arabicName: string;
    username: string;
    initialPassword?: string;
    chessComUsername?: string;
    department: string;
    yearLevel: string;
    liveStatus: MemberLiveStatus;
    role: UserRole;
    clubRoleDivision?: ClubRoleDivision;
    chessSpecialty?: string;
    signatureOpening?: string;
    bringsEquipment?: boolean;
  }): Promise<{ authProvisioned: boolean; authErrorCode?: string; authMessage?: string }> => {
    if (!isAdminOrOwner) {
      return { authProvisioned: false, authMessage: 'Admin privileges required.' };
    }
    const initials = payload.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    const base = clubConfig.startingRating || 1200;
    const newId = `mem-${Date.now()}`;
    const primaryOpening = payload.signatureOpening?.trim() || undefined;
    let provisionedUid: string | undefined;
    let authErrorCode: string | undefined;
    let authMessage: string | undefined;

    if (payload.initialPassword && payload.initialPassword.trim().length >= 6) {
      try {
        const res = await provisionClubMemberAuthAccount(
          clubConfig.clubId,
          payload.username,
          payload.initialPassword.trim()
        );
        provisionedUid = res.uid;
      } catch (err: unknown) {
        authErrorCode = (err as { code?: string })?.code || '';
        authMessage =
          authErrorCode === 'auth/operation-not-allowed'
            ? 'Member profile saved, but Email/Password must be enabled in Firebase Console before students can sign in with passwords.'
            : 'Member profile saved, though password provisioning returned an Auth error.';
      }
    }

    const assignedRole: UserRole = currentUser?.role === 'owner' ? payload.role : 'member';
    const created: ClubMember = {
      id: newId,
      clubId: clubConfig.clubId,
      authUid: provisionedUid,
      name: payload.name,
      arabicName: payload.arabicName,
      username: payload.username,
      chessComUsername: payload.chessComUsername?.trim() || undefined,
      role: assignedRole,
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
          : assignedRole === 'admin'
          ? 'Club Admin'
          : `Club Member (${base})`,
      liveStatus: payload.liveStatus,
      bio: `Official ${clubConfig.clubName} member (${
        payload.clubRoleDivision || 'Club Member'
      }) · Specialty: ${payload.chessSpecialty || 'Tactical All-Rounder'}.`,
      avatarInitials: initials || 'CM',
      avatarColor: clubConfig.accentColor,
      coverPhotoUrl: IMG_CHESS_MEMBERS_HALL_BG,
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
    await syncDocToFirestore(`clubs/${clubConfig.clubId}/members`, created.id, {
      ...created,
      updatedAt: new Date().toISOString(),
    });
    if (provisionedUid && assignedRole === 'admin' && currentUser?.role === 'owner') {
      await syncDocToFirestore('admins', provisionedUid, {
        uid: provisionedUid,
        role: 'admin',
        name: created.name,
      });
    }
    return {
      authProvisioned: Boolean(provisionedUid),
      authErrorCode,
      authMessage,
    };
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
    deleteDocFromFirestore(`clubs/${target.clubId}/members`, memberId);
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
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const updated: ClubMember = {
      ...target,
      clubRoleDivision: payload.clubRoleDivision ?? target.clubRoleDivision,
      chessSpecialty: payload.chessSpecialty ?? target.chessSpecialty,
      signatureOpening: payload.signatureOpening ?? target.signatureOpening,
      openings: payload.openings && payload.openings.length > 0 ? payload.openings : target.openings,
      bringsEquipment:
        payload.bringsEquipment !== undefined
          ? payload.bringsEquipment
          : target.bringsEquipment,
      willingToCoach:
        payload.willingToCoach !== undefined ? payload.willingToCoach : target.willingToCoach,
      willingToOrganize:
        payload.willingToOrganize !== undefined
          ? payload.willingToOrganize
          : target.willingToOrganize,
    };
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    if (isAdminOrOwner || target.authUid === auth.currentUser?.uid) {
      syncDocToFirestore(`clubs/${updated.clubId}/members`, updated.id, {
        ...updated,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleDesignateSuccessor = (heirId: string) => {
    if (!isAdminOrOwner) return;
    const now = new Date().toISOString();
    const changed: ClubMember[] = [];
    setMembers((prev) =>
      prev.map((m) => {
        if (m.clubId !== clubConfig.clubId) return m;
        const nextVal = m.id === heirId;
        if (Boolean(m.isDesignatedSuccessor) !== nextVal) {
          const updated = { ...m, isDesignatedSuccessor: nextVal };
          changed.push(updated);
          return updated;
        }
        return m;
      })
    );
    changed.forEach((m) =>
      syncDocToFirestore(`clubs/${m.clubId}/members`, m.id, { ...m, updatedAt: now })
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

    const now = new Date().toISOString();
    const updatedNewOwner: ClubMember = {
      ...newOwner,
      role: 'owner',
      clubRoleDivision: 'President & Founder',
      titleBadge: `Club President (${payload.mandatePeriod})`,
      isDesignatedSuccessor: true,
    };
    const updatedPrevOwner: ClubMember | null =
      prevOwner && prevOwner.id !== newOwner.id
        ? {
            ...prevOwner,
            role: 'admin',
            titleBadge: 'Honorary Founding President (Owner Emeritus)',
          }
        : null;

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === updatedNewOwner.id) return updatedNewOwner;
        if (updatedPrevOwner && m.id === updatedPrevOwner.id) return updatedPrevOwner;
        return m;
      })
    );

    syncDocToFirestore(`clubs/${updatedNewOwner.clubId}/members`, updatedNewOwner.id, {
      ...updatedNewOwner,
      updatedAt: now,
    });
    if (updatedPrevOwner) {
      syncDocToFirestore(`clubs/${updatedPrevOwner.clubId}/members`, updatedPrevOwner.id, {
        ...updatedPrevOwner,
        updatedAt: now,
      });
    }

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
    syncDocToFirestore(`clubs/${clubConfig.clubId}/lineage`, newRecord.id, { ...newRecord });
    setCurrentUserId(newOwner.id);
  };

  const handleReclaimFounderOwnership = () => {
    const isFounderEmail =
      firebaseUser?.email?.toLowerCase() === 'fethallah2411@gmail.com' &&
      firebaseUser?.emailVerified;
    if (!isAdminOrOwner && !isFounderEmail) return;

    const now = new Date().toISOString();
    const changed: ClubMember[] = [];
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === 'enp-owner') {
          const updated: ClubMember = {
            ...m,
            role: 'owner',
            clubRoleDivision: 'President & Founder',
            titleBadge: 'Platform Owner & Founder',
          };
          changed.push(updated);
          return updated;
        }
        if (m.role === 'owner' && m.id !== 'enp-owner') {
          const updated: ClubMember = { ...m, role: 'admin' };
          changed.push(updated);
          return updated;
        }
        return m;
      })
    );
    changed.forEach((m) =>
      syncDocToFirestore(`clubs/${m.clubId}/members`, m.id, { ...m, updatedAt: now })
    );
    setCurrentUserId('enp-owner');
  };

  const handleUpdateMemberRole = (memberId: string, nextRole: UserRole) => {
    if (currentUser?.role !== 'owner') return;
    const target = members.find((m) => m.id === memberId);
    if (!target || target.role === 'owner') return;
    const updated: ClubMember = {
      ...target,
      role: nextRole,
      titleBadge: nextRole === 'admin' ? 'Club Admin' : 'Club Member',
    };
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    syncDocToFirestore(`clubs/${updated.clubId}/members`, updated.id, {
      ...updated,
      updatedAt: new Date().toISOString(),
    });
    if (updated.authUid) {
      if (nextRole === 'admin') {
        syncDocToFirestore('admins', updated.authUid, {
          uid: updated.authUid,
          role: 'admin',
          name: updated.name,
        });
      } else {
        deleteDocFromFirestore('admins', updated.authUid);
      }
    }
  };

  const handleUpdateMemberStatus = (id: string, status: MemberLiveStatus) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!isAdminOrOwner && currentUser.id !== id) return;
    const target = members.find((m) => m.id === id);
    if (!target) return;
    const nowIso = new Date().toISOString();
    setPresenceClockMs(Date.now());
    const updated: ClubMember = {
      ...target,
      liveStatus: status,
      gpsLocation: status === 'offline' ? undefined : target.gpsLocation,
      updatedAt: nowIso,
    };
    setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    if (!auth.currentUser) return;
    const cleanData = stripUndefined({ ...updated }) as Record<string, unknown>;
    if (status === 'offline') {
      cleanData.gpsLocation = deleteField();
    }
    setDoc(doc(db, `clubs/${updated.clubId}/members`, updated.id), cleanData, {
      merge: true,
    }).catch((error) =>
      handleFirestoreError(error, OperationType.WRITE, `clubs/${updated.clubId}/members/${updated.id}`)
    );
  };

  const handleUpdateMemberAvatar = (id: string, avatarUrl: string) => {
    if (!currentUser) return;
    if (!isAdminOrOwner && currentUser.id !== id) return;
    const target = members.find((m) => m.id === id);
    if (!target) return;
    const updated: ClubMember = { ...target, avatarUrl };
    setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    syncDocToFirestore(`clubs/${updated.clubId}/members`, updated.id, {
      ...updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateMemberCoverPhoto = (id: string, coverPhotoUrl: string) => {
    if (!currentUser) return;
    if (!isAdminOrOwner && currentUser.id !== id) return;
    const target = members.find((m) => m.id === id);
    if (!target) return;
    const updated: ClubMember = { ...target, coverPhotoUrl };
    setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    syncDocToFirestore(`clubs/${updated.clubId}/members`, updated.id, {
      ...updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddMemberPhotoPost = (id: string, imageUrl: string, caption: string) => {
    if (!currentUser) return;
    if (!isAdminOrOwner && currentUser.id !== id) return;
    const target = members.find((m) => m.id === id);
    if (!target) return;
    const newPost = {
      id: `photo-${Date.now()}`,
      imageUrl,
      caption,
      date: new Date().toISOString().slice(0, 10),
      likes: 1,
    };
    const updated: ClubMember = {
      ...target,
      profilePhotos: [newPost, ...(target.profilePhotos || [])],
    };
    setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    syncDocToFirestore(`clubs/${updated.clubId}/members`, updated.id, {
      ...updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleLikeMemberPhotoPost = (memberId: string, photoId: string) => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const updated: ClubMember = {
      ...target,
      profilePhotos: (target.profilePhotos || []).map((p) =>
        p.id === photoId ? { ...p, likes: p.likes + 1 } : p
      ),
    };
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    if (auth.currentUser && (isAdminOrOwner || target.authUid === auth.currentUser.uid)) {
      syncDocToFirestore(`clubs/${updated.clubId}/members`, updated.id, {
        ...updated,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleDeleteMemberPhotoPost = (memberId: string, photoId: string) => {
    if (!currentUser) return;
    if (!isAdminOrOwner && currentUser.id !== memberId) return;
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const updated: ClubMember = {
      ...target,
      profilePhotos: (target.profilePhotos || []).filter((p) => p.id !== photoId),
    };
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    syncDocToFirestore(`clubs/${updated.clubId}/members`, updated.id, {
      ...updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleToggleMemberSlot = (memberId: string, slotKey: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!isAdminOrOwner && currentUser.id !== memberId) return;
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const exists = target.freeSlots.includes(slotKey);
    const updated: ClubMember = {
      ...target,
      freeSlots: exists
        ? target.freeSlots.filter((s) => s !== slotKey)
        : [...target.freeSlots, slotKey],
    };
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    syncDocToFirestore(`clubs/${updated.clubId}/members`, updated.id, {
      ...updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateMemberMeetupZone = (memberId: string, zoneId: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!isAdminOrOwner && currentUser.id !== memberId) return;
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const nextZone = ENP_CAMPUS_MEETUP_ZONES.find((z) => z.id === zoneId);
    const updatedGps =
      nextZone && target.gpsLocation?.label?.startsWith('Campus Spot')
        ? {
            ...target.gpsLocation,
            lat: nextZone.lat,
            lng: nextZone.lng,
            label: `Campus Spot (${nextZone.shortTag})`,
            updatedAt: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          }
        : target.gpsLocation;
    const updated: ClubMember = {
      ...target,
      campusMeetupZoneId: zoneId,
      gpsLocation: updatedGps,
      updatedAt: nowIso,
    };
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    syncDocToFirestore(`clubs/${updated.clubId}/members`, updated.id, {
      ...updated,
      updatedAt: nowIso,
    });
  };

  const handleUpdateMemberGps = async (
    memberId: string,
    gps: ClubMember['gpsLocation'] | null
  ) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!isAdminOrOwner && currentUser.id !== memberId) return;
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    setPresenceClockMs(Date.now());
    const updated: ClubMember = {
      ...target,
      liveStatus: gps ? 'campus_otb' : target.liveStatus,
      gpsLocation: gps || undefined,
      updatedAt: nowIso,
    };
    setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    if (!auth.currentUser) return;
    try {
      const cleanData = stripUndefined({
        ...updated,
        updatedAt: nowIso,
      }) as Record<string, unknown>;
      if (!gps) {
        cleanData.gpsLocation = deleteField();
      }
      await setDoc(doc(db, `clubs/${updated.clubId}/members`, updated.id), cleanData, {
        merge: true,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `clubs/${updated.clubId}/members/${updated.id}`);
    }
  };

  const handleResetRosterStatusesOffline = async () => {
    if (!isAdminOrOwner) return;
    const targetClubId = clubConfig.clubId;
    const now = new Date().toISOString();
    setMembers((prev) =>
      prev.map((m) =>
        m.clubId === targetClubId
          ? { ...m, liveStatus: 'offline', gpsLocation: undefined }
          : m
      )
    );
    if (!auth.currentUser) return;
    try {
      const scoped = members.filter((m) => m.clubId === targetClubId);
      for (let i = 0; i < scoped.length; i += 350) {
        const batch = writeBatch(db);
        const chunk = scoped.slice(i, i + 350);
        chunk.forEach((m) => {
          batch.set(
            doc(db, `clubs/${targetClubId}/members`, m.id),
            {
              liveStatus: 'offline',
              gpsLocation: deleteField(),
              updatedAt: now,
            },
            { merge: true }
          );
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `clubs/${targetClubId}/members`);
    }
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
    const target = posts.find((p) => p.id === postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    deleteDocFromFirestore(`clubs/${target?.clubId || clubConfig.clubId}/posts`, postId);
  };

  // --- MULTI-CLUB ADD (ADMIN/OWNER) & DELETE (OWNER ONLY) ---
  const handleAddClub = async (newClub: ClubThemeConfig) => {
    if (!isAdminOrOwner) return;
    setClubs((prev) => [...prev, newClub]);
    setClubConfig(newClub);
    const seedMember: ClubMember = {
      id: `cap-${newClub.clubId}`,
      clubId: newClub.clubId,
      name: `${newClub.clubName} Captain`,
      arabicName: 'قائد النادي',
      username: newClub.clubId.split('-')[0] || 'captain',
      role: 'admin',
      university: newClub.universityName,
      department: 'Engineering & Sciences',
      yearLevel: 'Club Captain',
      titleBadge: 'Founding Club Admin',
      liveStatus: 'offline',
      bio: `Founding captain of ${newClub.clubName} (${newClub.universityName}).`,
      avatarInitials: newClub.clubName.slice(0, 2).toUpperCase(),
      avatarColor: newClub.accentColor,
      coverPhotoUrl: IMG_CHESS_MEMBERS_HALL_BG,
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
    await syncDocToFirestore('clubs', newClub.clubId, {
      ...newClub,
      createdByUid: auth.currentUser?.uid,
      updatedAt: new Date().toISOString(),
    });
    await syncDocToFirestore(`clubs/${newClub.clubId}/members`, seedMember.id, {
      ...seedMember,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteClub = async (clubIdToDelete: string) => {
    if (currentUser?.role !== 'owner') return;
    if (clubs.length <= 1) return;
    const remaining = clubs.filter((c) => c.clubId !== clubIdToDelete);
    setClubs(remaining);
    if (clubConfig.clubId === clubIdToDelete) {
      setClubConfig(remaining[0]);
    }
    await deleteDocFromFirestore('clubs', clubIdToDelete);
  };

  const handleUpdateClubConfig = (next: ClubThemeConfig) => {
    setClubConfig(next);
    setClubs((prev) => prev.map((c) => (c.clubId === next.clubId ? next : c)));
    syncDocToFirestore('clubs', next.clubId, {
      ...next,
      updatedAt: new Date().toISOString(),
    });
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
    const senderUid = auth.currentUser?.uid;
    const recipientMember = payload.recipientId
      ? members.find((m) => m.id === payload.recipientId)
      : undefined;
    const participantUids =
      payload.channelType === 'dm'
        ? Array.from(
            new Set([senderUid, recipientMember?.authUid].filter((x): x is string => Boolean(x)))
          )
        : undefined;

    const created: ClubChatMessage = {
      id: `msg-${Date.now()}`,
      clubId: currentUser.clubId,
      channelId: payload.channelId,
      channelType: payload.channelType,
      senderId: currentUser.id,
      senderAuthUid: senderUid,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: payload.recipientId,
      recipientAuthUid: recipientMember?.authUid,
      participantAuthUids: participantUids,
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
    mobileLabel: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }[] = [
    {
      id: 'overview',
      label: 'Home & Club Posts',
      shortLabel: 'Home',
      mobileLabel: 'Home',
      icon: <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    },
    {
      id: 'members',
      label: 'Members & Profiles',
      shortLabel: 'Profiles',
      mobileLabel: 'Players',
      icon: <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    },
    {
      id: 'studio',
      label: 'Board & Stockfish',
      shortLabel: 'Studio',
      mobileLabel: 'Board',
      icon: <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    },
    {
      id: 'tournaments',
      label: 'Tournaments',
      shortLabel: 'Tournaments',
      mobileLabel: 'Cups',
      icon: <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    },
    {
      id: 'lounge',
      label: currentUser ? 'Teams & Private Chat' : 'Teams Chat (Members Only)',
      shortLabel: 'Teams Chat',
      mobileLabel: 'Chat',
      icon: currentUser ? (
        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      ) : (
        <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF6B00]" />
      ),
    },
    {
      id: 'radar',
      label: 'Free-Hour Radar',
      shortLabel: 'Free Hours',
      mobileLabel: 'Radar',
      icon: <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
    },
    {
      id: 'customizer',
      label: `Admin Center${pendingClubGames.length ? ` (${pendingClubGames.length})` : ''}`,
      shortLabel: 'Admin',
      mobileLabel: 'Admin',
      icon: <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
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
                ? resolveAssetUrl(clubConfig.customHeroUrl || activeModuleBg.imageUrl, IMG_MIKHAIL_TAL_HERO)
                : resolveAssetUrl(activeModuleBg.imageUrl, IMG_MIKHAIL_TAL_HERO)
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
        {/* 3-ZONE TOP BAR CONTRACT */}
        <header className="sticky top-0 z-30 bg-[#061020]/90 theme-header-surface backdrop-blur-xl border-b border-white/10 px-2.5 sm:px-6 py-1.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-6 w-full max-w-full min-w-0 overflow-hidden">
          {/* Zone 1: Brand Logos (Minimalist Text-Free Emblem) & Active Club Name */}
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('overview');
            }}
            className="flex items-center gap-2 min-w-0 max-w-full shrink"
          >
            <div className="flex items-center gap-1.5 shrink-0 max-w-full">
              <ClubLogoBadge
                customLogoUrl={clubConfig.customLogoUrl}
                accentColor={clubConfig.accentColor}
                size="sm"
              />
              {clubConfig.schoolLogoUrl && (
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#061020] border border-[#26E6DE]/35 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={resolveAssetUrl(clubConfig.schoolLogoUrl, IMG_ENP_SCHOOL_LOGO)}
                    alt={clubConfig.universityName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      if (e.currentTarget.src !== IMG_ENP_SCHOOL_LOGO) {
                        e.currentTarget.src = IMG_ENP_SCHOOL_LOGO;
                      }
                    }}
                    className="w-full h-full object-cover scale-105"
                  />
                </div>
              )}
            </div>
            <span className="text-sm sm:text-lg font-extrabold tracking-tight text-white theme-heading truncate">
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
              className="min-h-[32px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold text-white bg-[#1E56A0] hover:bg-[#2563EB] border border-[#26E6DE]/40 rounded-lg sm:rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 max-w-full cursor-pointer shadow-sm"
            >
              {currentUser ? (
                <>
                  <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#FF6B00]" />
                  <span>
                    {currentUser.name.split(' ')[0]} ({currentUser.role.toUpperCase()})
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#26E6DE]" />
                  <span className="hidden sm:inline">Member / Admin Sign In</span>
                  <span className="sm:hidden">Sign In</span>
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
                        src={resolveAssetUrl(clubConfig.clubBannerUrl, IMG_ENP_CREST_BANNER)}
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
                      className="w-full max-w-full h-9 px-2.5 py-0 leading-normal rounded-xl bg-[#061020] border border-white/15 text-xs font-bold text-white cursor-pointer"
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
            className={`flex-1 min-w-0 max-w-full p-2.5 sm:p-6 lg:p-8 overflow-x-hidden ${
              androidPreviewMode ? 'pb-8' : 'pb-16 lg:pb-10'
            }`}
          >
            <div className="w-full max-w-[1360px] mx-auto space-y-3.5 sm:space-y-8 min-w-0">
              {/* Quick Theme & Active University Club Bar */}
              <div className="broadcast-panel rounded-xl sm:rounded-2xl px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 w-full max-w-full min-w-0 overflow-hidden">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 max-w-full">
                  <span className="text-[10px] sm:text-[11px] font-mono-tabular uppercase text-[#26E6DE] font-bold shrink-0">
                    Club:
                  </span>
                  <select
                    aria-label="Switch active university club"
                    value={clubConfig.clubId}
                    onChange={(e) => {
                      const found = clubs.find((c) => c.clubId === e.target.value);
                      if (found) setClubConfig(found);
                    }}
                    className="min-w-0 max-w-[210px] sm:max-w-[340px] h-8 sm:h-9 px-2.5 py-0 leading-normal rounded-lg sm:rounded-xl bg-[#061020] border border-white/15 text-[11px] sm:text-xs font-bold text-white cursor-pointer"
                  >
                    {clubs.map((c) => (
                      <option key={c.clubId} value={c.clubId}>
                        {c.clubName} ({c.universityName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Instant 1-Click Theme Mode Bar */}
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap max-w-full min-w-0">
                  <span className="hidden sm:flex text-[11px] font-mono-tabular uppercase text-slate-400 font-bold mr-1 items-center gap-1 max-w-full">
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
                        className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1 max-w-full cursor-pointer ${
                          isActive
                            ? 'bg-[#FF6B00] text-white shadow-sm'
                            : 'bg-[#061020]/75 text-slate-300 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {t.id === 'light' ? (
                          <Sun className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        ) : t.id === 'basic' ? (
                          <Monitor className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        ) : (
                          <Moon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        )}
                        <span className="sm:hidden">{t.shortLabel}</span>
                        <span className="hidden sm:inline">{t.label}</span>
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

              {/* 4K 16:9 CINEMATIC PAGE HERO BANNER FOR ALL OTHER PAGES */}
              {activeModule !== 'overview' && !showHeroInWorkspace && (
                <div className="relative w-full max-w-full min-w-0 h-24 sm:h-52 lg:h-60 rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 shadow-2xl flex flex-col justify-end p-3 sm:p-7">
                  <img
                    src={resolveAssetUrl(activeModuleBg.imageUrl, IMG_MIKHAIL_TAL_HERO)}
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
                  <div className="relative z-10 flex flex-wrap items-end justify-between gap-2 max-w-full min-w-0">
                    <div className="space-y-0.5 min-w-0 max-w-full">
                      <h1 className="text-base sm:text-3xl font-extrabold text-white tracking-tight drop-shadow">
                        {activeModuleBg.title}
                      </h1>
                      <p className="text-[10px] sm:text-sm text-slate-200 max-w-2xl line-clamp-1 sm:line-clamp-2">
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
                <div className="space-y-4 sm:space-y-8 min-w-0 w-full max-w-full overflow-hidden">
                  {/* Enhanced Real School Campus Photo + School Introduction & Club Goal */}
                  <div className="broadcast-panel p-3 sm:p-6 rounded-2xl grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-5 items-stretch min-w-0 w-full max-w-full overflow-hidden">
                    <div className="lg:col-span-5 min-w-0 max-w-full relative rounded-xl sm:rounded-2xl overflow-hidden border border-[#26E6DE]/30 bg-[#08224A] shadow-xl min-h-[150px] sm:min-h-[260px] flex items-center justify-center">
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
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono-tabular text-white">
                        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg bg-[#061020]/85 border border-white/15 backdrop-blur-sm truncate">
                          📍 ENP El Harrach · Algiers (Est. 1925)
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-7 min-w-0 max-w-full flex flex-col justify-between gap-3">
                      <div className="space-y-2 sm:space-y-3 min-w-0 max-w-full flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-base sm:text-2xl font-extrabold text-white break-words">
                            {clubConfig.clubName} · {clubConfig.universityName}
                          </h2>
                          <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <ClubLogoBadge
                              customLogoUrl={clubConfig.customLogoUrl}
                              accentColor={clubConfig.accentColor}
                              size="sm"
                            />
                            {clubConfig.schoolLogoUrl && (
                              <div className="w-9 h-9 rounded-xl bg-[#061020] border border-[#26E6DE]/35 flex items-center justify-center overflow-hidden">
                                <img
                                  src={resolveAssetUrl(clubConfig.schoolLogoUrl, IMG_ENP_SCHOOL_LOGO)}
                                  alt="École Nationale Polytechnique Logo"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    if (e.currentTarget.src !== IMG_ENP_SCHOOL_LOGO) {
                                      e.currentTarget.src = IMG_ENP_SCHOOL_LOGO;
                                    }
                                  }}
                                  className="w-full h-full object-cover scale-105"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] sm:text-xs text-[#26E6DE] font-semibold">
                          {clubConfig.subtitleAr}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-0.5">
                          <div className="p-2.5 sm:p-3.5 rounded-xl bg-[#061020]/75 border border-white/10 space-y-1">
                            <div className="text-[10px] sm:text-[11px] font-mono-tabular uppercase text-[#26E6DE] font-bold">
                              About École Nationale Polytechnique
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-300 leading-snug sm:leading-relaxed">
                              Founded in 1925 in El Harrach (Algiers), ENP is Algeria’s premier engineering institution across CPST and 13 engineering departments.
                            </p>
                          </div>

                          <div className="p-2.5 sm:p-3.5 rounded-xl bg-[#061020]/75 border border-[#FF6B00]/30 space-y-1">
                            <div className="text-[10px] sm:text-[11px] font-mono-tabular uppercase text-[#FF6B00] font-bold">
                              Goal of the ENP Chess Club
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-300 leading-snug sm:leading-relaxed">
                              Unite polytechnic students from beginners to advanced players via OTB campus games, coaching workshops, and ranked cups.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 max-w-full min-w-0">
                          <button
                            type="button"
                            onClick={() => setActiveModule('lounge')}
                            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-[11px] sm:text-xs font-bold flex items-center gap-1.5 max-w-full shadow-lg shadow-[#FF6B00]/20 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                            <span className="truncate">Teams &amp; Chat</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveModule('studio')}
                            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-[#1E56A0] hover:bg-[#2563EB] text-white text-[11px] sm:text-xs font-bold max-w-full cursor-pointer"
                          >
                            Board Studio
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveModule('tournaments')}
                            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-[11px] sm:text-xs font-bold max-w-full cursor-pointer"
                          >
                            Tournaments
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4-Column KPI Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full max-w-full min-w-0">
                    <div className="broadcast-panel p-2.5 sm:p-5 rounded-xl sm:rounded-2xl min-w-0 max-w-full overflow-hidden">
                      <div className="text-[9px] sm:text-xs font-mono-tabular text-slate-400">
                        CLUB ROSTER
                      </div>
                      <div className="text-base sm:text-3xl font-extrabold font-mono-tabular text-white mt-0.5 sm:mt-1 truncate">
                        {clubMembers.length} Players
                      </div>
                      <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 truncate">
                        {clubConfig.clubName}
                      </div>
                    </div>

                    <div className="broadcast-panel p-2.5 sm:p-5 rounded-xl sm:rounded-2xl min-w-0 max-w-full overflow-hidden">
                      <div className="text-[9px] sm:text-xs font-mono-tabular text-slate-400">
                        GAMES DATABASE
                      </div>
                      <div className="text-base sm:text-3xl font-extrabold font-mono-tabular text-[#26E6DE] mt-0.5 sm:mt-1 truncate">
                        {approvedClubGames.length} Verified
                      </div>
                      <div className="text-[10px] sm:text-xs text-slate-400 font-mono-tabular mt-0.5 sm:mt-1 truncate">
                        {isAdminOrOwner
                          ? `${pendingClubGames.length} Pending`
                          : 'PGN Archive'}
                      </div>
                    </div>

                    <div className="broadcast-panel p-2.5 sm:p-5 rounded-xl sm:rounded-2xl min-w-0 max-w-full overflow-hidden">
                      <div className="text-[9px] sm:text-xs font-mono-tabular text-slate-400">
                        #1 CLUB LEADER
                      </div>
                      <div className="text-sm sm:text-xl font-extrabold text-white mt-0.5 sm:mt-1 truncate">
                        {clubLeader ? clubLeader.name : '—'}
                      </div>
                      <div className="text-[10px] sm:text-xs font-mono-tabular text-[#FF6B00] font-bold mt-0.5 sm:mt-1 truncate">
                        {clubLeader
                          ? `R ${clubLeader.fide.rapid} · B ${clubLeader.fide.blitz}`
                          : '1500 Elo'}
                      </div>
                    </div>

                    <div className="broadcast-panel p-2.5 sm:p-5 rounded-xl sm:rounded-2xl min-w-0 max-w-full overflow-hidden">
                      <div className="text-[9px] sm:text-xs font-mono-tabular text-slate-400">
                        ONLINE / OTB NOW
                      </div>
                      <div className="text-base sm:text-3xl font-extrabold font-mono-tabular text-[#FF6B00] mt-0.5 sm:mt-1 truncate">
                        {freeNowPlayers.length} Ready
                      </div>
                      <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 truncate">
                        In {clubConfig.clubName}
                      </div>
                    </div>
                  </div>

                  {/* CLUB NEWS & ADMIN ANNOUNCEMENTS FEED */}
                  <div className="broadcast-panel p-3 sm:p-6 rounded-2xl space-y-3 sm:space-y-4 w-full max-w-full min-w-0 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5 sm:pb-3 max-w-full min-w-0">
                      <div className="min-w-0 max-w-full">
                        <span className="text-[10px] sm:text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold flex items-center gap-1.5 max-w-full">
                          <Megaphone className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                          <span className="truncate">
                            {clubConfig.clubName.toUpperCase()} BULLETIN BOARD
                          </span>
                        </span>
                        <h3 className="text-sm sm:text-lg font-bold text-white mt-0.5">
                          Club News &amp; Admin Posts
                        </h3>
                      </div>

                      {isAdminOrOwner && (
                        <button
                          type="button"
                          onClick={() => setIsQuickPostModalOpen(true)}
                          className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 max-w-full cursor-pointer shadow-lg shadow-[#FF6B00]/20"
                        >
                          <PlusCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                          + Post
                        </button>
                      )}
                    </div>

                    {clubPosts.length === 0 ? (
                      <div className="p-4 sm:p-6 rounded-xl bg-[#061020]/70 text-center text-[11px] sm:text-xs text-slate-400">
                        No announcements posted for {clubConfig.clubName} yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4 w-full max-w-full min-w-0">
                        {clubPosts.map((post) => (
                          <article
                            key={post.id}
                            className="p-3 sm:p-4 rounded-xl bg-[#061020]/80 border border-white/10 space-y-1.5 sm:space-y-2 flex flex-col justify-between max-w-full min-w-0 overflow-hidden"
                          >
                            <div className="space-y-1 min-w-0 max-w-full">
                              <div className="flex flex-wrap items-center gap-1.5 max-w-full min-w-0">
                                <span className="px-1.5 py-0.5 rounded bg-[#1E56A0]/40 text-[#26E6DE] font-mono-tabular text-[9px] sm:text-[10px] font-bold uppercase">
                                  {post.category}
                                </span>
                                {post.pinned && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#FF6B00]/20 text-[#FF6B00] font-mono-tabular text-[9px] sm:text-[10px] font-bold uppercase">
                                    Pinned
                                  </span>
                                )}
                                <span className="text-[10px] sm:text-[11px] font-mono-tabular text-slate-400">
                                  {post.createdAt}
                                </span>
                              </div>
                              <h4 className="text-xs sm:text-base font-bold text-white break-words">
                                {post.title}
                              </h4>
                              <p className="text-[11px] sm:text-xs text-slate-300 leading-snug sm:leading-relaxed break-words">
                                {post.body}
                              </p>
                            </div>

                            <div className="pt-1.5 border-t border-white/8 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 max-w-full min-w-0">
                              <span className="truncate">
                                By <strong className="text-slate-200">{post.authorName}</strong>
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rating Distribution & Club-Scoped Available Players */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 w-full max-w-full min-w-0">
                    <div className="lg:col-span-6 broadcast-panel p-3 sm:p-6 rounded-2xl space-y-3 sm:space-y-4 min-w-0 max-w-full overflow-hidden">
                      <div className="flex items-center justify-between gap-2 max-w-full min-w-0">
                        <div className="min-w-0">
                          <span className="text-[10px] sm:text-xs font-mono-tabular uppercase text-slate-400 block truncate">
                            UNIFIED ELO DISTRIBUTION
                          </span>
                          <h3 className="text-sm sm:text-lg font-bold text-white">
                            Club Rapid Elo Distribution
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveModule('members')}
                          className="min-h-[30px] sm:min-h-[38px] px-2 text-[11px] sm:text-xs font-bold text-[#26E6DE] hover:underline flex items-center gap-0.5 max-w-full shrink-0 cursor-pointer"
                        >
                          Roster <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2.5 pt-1 max-w-full min-w-0">
                        {ratingBuckets.map((b) => {
                          const pctVal =
                            clubMembers.length > 0
                              ? Math.round((b.count / clubMembers.length) * 100)
                              : 0;
                          return (
                            <div key={b.range} className="space-y-1 max-w-full min-w-0">
                              <div className="flex items-center justify-between text-[11px] sm:text-xs max-w-full min-w-0">
                                <span className="font-semibold text-slate-200 truncate">{b.range}</span>
                                <span className="font-mono-tabular text-slate-400 shrink-0">
                                  {b.count} ({pctVal}%)
                                </span>
                              </div>
                              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
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

                    <div className="lg:col-span-6 broadcast-panel p-3 sm:p-6 rounded-2xl space-y-3 sm:space-y-4 min-w-0 max-w-full overflow-hidden">
                      <div className="flex items-center justify-between gap-2 max-w-full min-w-0">
                        <div className="min-w-0">
                          <span className="text-[10px] sm:text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold block truncate">
                            SCOPED TO {clubConfig.clubName.toUpperCase()}
                          </span>
                          <h3 className="text-sm sm:text-lg font-bold text-white">
                            Members Online &amp; OTB Now
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveModule('radar')}
                          className="min-h-[30px] sm:min-h-[38px] px-2 text-[11px] sm:text-xs font-bold text-[#26E6DE] hover:underline flex items-center gap-0.5 max-w-full shrink-0 cursor-pointer"
                        >
                          GPS Radar <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2 max-w-full min-w-0">
                        {freeNowPlayers.length === 0 ? (
                          <div className="p-4 sm:p-5 rounded-xl bg-[#061020]/70 border border-white/10 text-center space-y-1.5">
                            <div className="text-xs sm:text-sm font-bold text-slate-200">
                              0 members currently online
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-400">
                              Members automatically appear online while signed in and connected, and switch offline automatically when disconnected or signed out.
                            </p>
                          </div>
                        ) : (
                          freeNowPlayers.slice(0, 4).map((p) => (
                            <div
                              key={p.id}
                              className="p-2.5 sm:p-3 rounded-xl bg-[#061020]/70 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-full min-w-0 overflow-hidden"
                            >
                              <div className="min-w-0 max-w-full">
                                <div className="font-bold text-xs sm:text-sm text-white truncate">
                                  {p.name} ·{' '}
                                  <span className="font-mono-tabular text-[#FF6B00]">
                                    R {p.fide.rapid}
                                  </span>{' '}
                                  ·{' '}
                                  <span className="font-mono-tabular text-[#26E6DE]">
                                    B {p.fide.blitz}
                                  </span>
                                </div>
                                <div className="text-[10px] sm:text-xs text-slate-400 truncate">
                                  {p.department} ·{' '}
                                  {p.liveStatus === 'campus_otb'
                                    ? 'On Campus OTB'
                                    : 'Online Ready'}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 max-w-full shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMemberId(p.id);
                                    setActiveModule('members');
                                  }}
                                  className="min-h-[28px] sm:min-h-[38px] flex-1 sm:flex-initial px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-semibold bg-white/8 border border-white/15 text-slate-200 hover:bg-white/15 cursor-pointer"
                                >
                                  Profile
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPrivateChatWithMember(p.id)}
                                  className="min-h-[28px] sm:min-h-[38px] flex-1 sm:flex-initial px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-[#1E56A0] hover:bg-[#2563EB] text-white cursor-pointer"
                                >
                                  DM
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveModule('studio')}
                                  className="min-h-[28px] sm:min-h-[38px] flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-[#FF6B00] hover:bg-[#FF8533] text-white cursor-pointer"
                                >
                                  Studio
                                </button>
                              </div>
                            </div>
                          ))
                        )}
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
                  allMembers={members.map(withResolvedPresence)}
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
                  onUpdateCampusZones={(zones) =>
                    handleUpdateClubConfig({ ...clubConfig, campusZones: zones })
                  }
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
                  onProvisionMemberLogin={handleProvisionMemberLogin}
                  onUpdateMemberRole={handleUpdateMemberRole}
                  onSyncClubToFirestore={seedClubToFirestore}
                  onResetRosterStatusesOffline={handleResetRosterStatusesOffline}
                  isCloudSynced={isCloudSynced}
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
          } bg-[#061020]/95 backdrop-blur-xl border-t border-white/15 px-1 py-1 justify-around items-center z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.6)]`}
        >
          {navItems.map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`min-h-[36px] flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 py-0.5 rounded-lg text-[9px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'text-[#26E6DE] bg-white/8 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="whitespace-nowrap truncate max-w-full">{item.mobileLabel}</span>
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

            <div className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-xs text-rose-200 leading-relaxed">
                  {loginError}
                </div>
              )}

              {/* 1. Admin-Issued Club Account Login (Username + Password) */}
              <form
                onSubmit={handleClubAccountLogin}
                className="p-3.5 rounded-xl bg-[#061020]/80 border border-[#26E6DE]/30 space-y-3"
              >
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#FF6B00]" />
                  Sign In with Admin-Issued Club Account
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Enter the club username (e.g. <span className="font-mono-tabular text-[#26E6DE]">@yasser</span>) and password issued to you by the Club Admin.
                </p>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Club Username
                    </label>
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="e.g., yasser or wadjih"
                      autoComplete="username"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#040B16] text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter club password"
                      autoComplete="current-password"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#040B16] text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF6B00]/20"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isLoggingIn ? 'Signing In...' : 'Sign In with Club Account'}</span>
                </button>
              </form>

              <div className="flex items-center gap-2 text-[10px] font-mono-tabular uppercase text-slate-500">
                <div className="flex-1 h-px bg-white/10" />
                <span>OR VERIFIED GOOGLE AUTH</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="p-3 rounded-xl bg-[#061020]/60 border border-white/10 text-[11px] text-slate-300 space-y-1 leading-relaxed">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#26E6DE]" />
                  Owner &amp; School Mail / Google Sign-In
                </div>
                <p className="text-slate-400">
                  ENP students can sign in directly with their <span className="font-mono-tabular text-[#26E6DE]">@g.enp.edu.dz</span> school email or any Google account (Club Owner: <span className="font-mono-tabular text-[#FF6B00]">fethallah2411@gmail.com</span>).
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-[#061020] text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <LogIn className="w-4 h-4" />
                <span>Continue with Google / ENP School Mail</span>
              </button>

              {!currentUser && (
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="w-full p-2 rounded-xl border border-white/10 bg-[#061020]/50 hover:bg-white/10 text-center text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Continue Browsing as Guest (Read-Only)
                </button>
              )}
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
