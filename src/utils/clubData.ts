import {
  Glicko2Rating,
  TournamentMatch,
  TournamentFormat,
  TimeControl,
  MatchStakes,
} from './chessEngine';
import {
  IMG_BLITZ_ARENA_BANNER,
  IMG_ENP_CLUB_LOGO,
  IMG_ENP_COURTYARD_BANNER,
  IMG_ENP_CREST_BANNER,
  IMG_ENP_SCHOOL_LOGO,
  IMG_ENP_TWILIGHT_BANNER,
  IMG_FISCHER_REYKJAVIK_BANNER,
  IMG_KASPAROV_DEEP_BLUE_BANNER,
  IMG_KASPAROV_KARPOV_BANNER,
  IMG_MIKHAIL_TAL_HERO,
} from './assetUrls';

export type MemberLiveStatus = 'campus_otb' | 'online_ready' | 'in_lecture' | 'offline';
export type UserRole = 'owner' | 'admin' | 'member';

export type ClubRoleDivision =
  | 'President & Founder'
  | 'Vice-President'
  | 'IT & Digital Platform'
  | 'COMM & Media'
  | 'Tournament & Events'
  | 'Coaching & Workshops'
  | 'Logistics & Inventory'
  | 'Relex & Sponsorship'
  | 'Varsity Competitor'
  | 'Club Member';

export const CLUB_ROLE_DIVISIONS: {
  id: ClubRoleDivision;
  shortTag: string;
  badgeClass: string;
  description: string;
}[] = [
  {
    id: 'President & Founder',
    shortTag: 'PRESIDENT',
    badgeClass: 'bg-[#FF6B00]/25 text-[#FF6B00] border-[#FF6B00]/50',
    description: 'Overall club leadership, inter-university representation, and next-gen succession.',
  },
  {
    id: 'Vice-President',
    shortTag: 'VICE-PRES',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
    description: 'Executive coordination, varsity team oversight, and internal operations.',
  },
  {
    id: 'IT & Digital Platform',
    shortTag: 'IT',
    badgeClass: 'bg-[#26E6DE]/20 text-[#26E6DE] border-[#26E6DE]/50',
    description: 'Manages the ENP Chess Hub website, Elo rating database, PGN archives, and live pairings.',
  },
  {
    id: 'COMM & Media',
    shortTag: 'COMM',
    badgeClass: 'bg-pink-500/20 text-pink-300 border-pink-400/40',
    description: 'Social media, photography, tournament posters, campus visibility, and announcements.',
  },
  {
    id: 'Tournament & Events',
    shortTag: 'EVENTS',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
    description: 'Organizes Swiss/Knockout tournaments, arbitrating, pairings, and campus exhibitions.',
  },
  {
    id: 'Coaching & Workshops',
    shortTag: 'COACHING',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    description: 'Leads tactical workshops, game reviews, opening prep, and beginner/intermediate training.',
  },
  {
    id: 'Logistics & Inventory',
    shortTag: 'LOGISTICS',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
    description: 'Manages physical chess boards, DGT clocks, tournament tables, and campus meetup zones.',
  },
  {
    id: 'Relex & Sponsorship',
    shortTag: 'RELEX',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40',
    description: 'External relations with USTHB, ESI, other grandes écoles, and event sponsors.',
  },
  {
    id: 'Varsity Competitor',
    shortTag: 'VARSITY',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
    description: 'Selected player representing ENP El Harrach in inter-university championships.',
  },
  {
    id: 'Club Member',
    shortTag: 'MEMBER',
    badgeClass: 'bg-white/10 text-slate-300 border-white/15',
    description: 'Active club player participating in campus games, trainings, and tournaments.',
  },
];

export const CHESS_SPECIALTY_PRESETS: string[] = [
  'Tactical Attacker & Sacrifices',
  'Positional Grinder & Endgame Specialist',
  'Rapid & Blitz Speed Specialist',
  'Opening Theoretician & Prep Lead',
  'Workshop Coach & Game Analyst',
  'Solid Classical Defender',
  'Dynamic Counter-Attacker',
  'Rising Tactical Contender',
];

export const OPENING_REPERTOIRE_PRESETS: string[] = [
  'Sicilian Defense: Najdorf (B90) & Ruy Lopez (C84)',
  'Italian Game (C50) & Caro-Kann Defense (B18)',
  'Queen’s Gambit (D37) & King’s Indian Defense (E97)',
  'London System (D02) & French Defense (C18)',
  'Scotch Game (C45) & Sicilian Dragon (B70)',
  'English Opening (A20) & Nimzo-Indian (E20)',
  'Vienna Game (C25) & Scandinavian Defense (B01)',
  'Catalan Opening (E06) & Slav Defense (D15)',
];

export interface ClubGenerationRecord {
  id: string;
  clubId: string;
  generationLabel: string;
  MandatePeriod: string;
  fromOwnerId: string;
  fromOwnerName: string;
  toOwnerId: string;
  toOwnerName: string;
  toOwnerDepartment: string;
  transferredAt: string;
  legacyNote: string;
}

export interface ProfilePhotoPost {
  id: string;
  imageUrl: string;
  caption: string;
  date: string;
  likes: number;
}

export interface OpeningStat {
  name: string;
  eco: string;
  color: 'white' | 'black';
  wins: number;
  draws: number;
  losses: number;
}

export interface RatingHistoryPoint {
  date: string;
  event: string;
  fide: number;
  glicko: number;
  opponent: string;
  result: 'W' | 'D' | 'L';
  timeControl?: TimeControl;
}

export interface ClubMember {
  id: string;
  clubId: string;
  name: string;
  arabicName: string;
  username: string;
  authUid?: string;
  role: UserRole;
  /**
   * Club organizational division / role (IT, COMM, Coaching, Events, Logistics, Relex, etc.)
   */
  clubRoleDivision?: ClubRoleDivision;
  /**
   * Player's chess style / specialty (e.g. Tactical Attacker, Endgame Specialist, Workshop Coach)
   */
  chessSpecialty?: string;
  /**
   * Primary openings played by this member (e.g. "Sicilian Najdorf & Ruy Lopez")
   */
  signatureOpening?: string;
  /**
   * Chess.com or Lichess username submitted in the registration form
   */
  chessComUsername?: string;
  /**
   * Self-reported online ELO bracket from the registration form
   */
  onlineEloBracket?: string;
  /**
   * Owns a physical chess board or clock they can bring to campus events
   */
  bringsEquipment?: boolean;
  /**
   * Open to leading workshops, reviewing games, or coaching newer members
   */
  willingToCoach?: boolean;
  /**
   * Interested in helping organize and run the team
   */
  willingToOrganize?: boolean;
  /**
   * What they expect most from the ENP Chess Team this year
   */
  clubExpectation?: string;
  /**
   * Whether this member is designated as the Next-Generation Heir / Successor for Club Ownership
   */
  isDesignatedSuccessor?: boolean;
  university: string;
  department: string;
  yearLevel: string;
  titleBadge: string;
  liveStatus: MemberLiveStatus;
  bio: string;
  avatarUrl?: string;
  coverPhotoUrl?: string;
  profilePhotos?: ProfilePhotoPost[];
  avatarInitials: string;
  avatarColor: string;
  joinedDate: string;
  fide: {
    rapid: number;
    blitz: number;
    classical: number;
    peak: number;
    delta30d: number;
    gamesPlayed: number;
  };
  glicko2: {
    rapid: Glicko2Rating;
    blitz: Glicko2Rating;
    classical: Glicko2Rating;
  };
  ratingHistory: RatingHistoryPoint[];
  openings: OpeningStat[];
  freeSlots: string[];
  campusMeetupZoneId?: string;
  gpsLocation?: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
    label: string;
    isLiveBrowserGps?: boolean;
    updatedAt: string;
  };
}

export interface EnpCampusMeetupZone {
  id: string;
  name: string;
  shortTag: string;
  wing: string;
  description: string;
  lat: number;
  lng: number;
  boardsAvailable: number;
}

export const ENP_ACADEMIC_DEPARTMENTS_13: string[] = [
  'Classes Préparatoires (CPST — Sciences & Technologies)',
  'Génie Automatique (Automatics)',
  'Génie Électronique (Electronics)',
  'Génie Électrique (Electrical)',
  'Génie Chimique & Génie des Procédés (GPE / Chemical)',
  'Génie Civil (Civil)',
  'Génie de l’Environnement (Environmental)',
  'Génie Mécanique (Mechanical)',
  'Génie Industriel & Data Science (Industrial)',
  'Génie Minier (Mining)',
  'Génie Hydraulique (Hydraulic)',
  'Génie Métallurgique (Metallurgy)',
  'Maîtrise des Risques Industriels (Industrial Risk Management)',
];

export const ENP_CAMPUS_MEETUP_ZONES: EnpCampusMeetupZone[] = [
  {
    id: 'zone-jardins-library',
    name: 'Jardins Central & Main Library Courtyard',
    shortTag: 'Jardins & Library',
    wing: 'Central Walkway & Library Block',
    description:
      'Landscaped courtyards and gardens (jardins) between the central walkway and the Main Library — outdoor & quiet indoor OTB chess tables.',
    lat: 36.72335,
    lng: 3.14945,
    boardsAvailable: 6,
  },
  {
    id: 'zone-amphi-1c',
    name: 'Amphi C / 1C (Preparatory Cycle Department — CPST)',
    shortTag: 'Amphi C (Prep Cycle)',
    wing: 'Preparatory Cycle Department (Classes Préparatoires — CPST)',
    description:
      'Steps and shaded tables beside Amphi C / 1C in the Preparatory Cycle Department (CPST), ideal for rapid 10+0 and 3+2 blitz games between lectures.',
    lat: 36.72362,
    lng: 3.14985,
    boardsAvailable: 4,
  },
  {
    id: 'zone-club-vic',
    name: 'VIC Local (Vision & Innovation Club)',
    shortTag: 'Local VIC',
    wing: 'VIC Club Room',
    description:
      'Dedicated campus local of Vision & Innovation Club (VIC) where members hang out and play OTB rapid and blitz games.',
    lat: 36.72312,
    lng: 3.15008,
    boardsAvailable: 3,
  },
  {
    id: 'zone-club-cap',
    name: 'CAP Local (Club d’Activités Polyvalentes)',
    shortTag: 'Local CAP',
    wing: 'CAP Club Room',
    description:
      'Dedicated campus local of Club d’Activités Polyvalentes (CAP) hosting cultural events and student chess tables.',
    lat: 36.72294,
    lng: 3.14972,
    boardsAvailable: 3,
  },
  {
    id: 'zone-club-ieee',
    name: 'IEEE ENP Student Branch Local',
    shortTag: 'Local IEEE ENP',
    wing: 'IEEE ENP Room',
    description:
      'Dedicated campus local of the IEEE ENP Student Branch where Electrical, Electronics & Automatics players meet for games.',
    lat: 36.72382,
    lng: 3.14932,
    boardsAvailable: 3,
  },
  {
    id: 'zone-club-enprt',
    name: 'ENPRT Local (ENP Racing Team — Formula Student)',
    shortTag: 'Local ENPRT (Formula Student)',
    wing: 'ENPRT Formula Student Workshop & Local',
    description:
      'Dedicated campus local and workshop of the ENP Racing Team (ENPRT — Formula Student Team) with boards set up for blitz breaks.',
    lat: 36.72348,
    lng: 3.15025,
    boardsAvailable: 3,
  },
  {
    id: 'zone-main-gate-oudek',
    name: 'Main Gate (Rue des Frères Oudek) & Admin Parking',
    shortTag: 'South Gate & Admin',
    wing: 'Southern Campus Entrance (Rue des Frères Oudek)',
    description:
      'Main southern entrance on Rue des Frères Oudek alongside the Administration Building and staff/visitor parking lots.',
    lat: 36.72225,
    lng: 3.14895,
    boardsAvailable: 2,
  },
  {
    id: 'zone-north-depts',
    name: 'Central & Northern 13 Academic Department Wings',
    shortTag: '13 Dept Wings (North/Central)',
    wing: 'Central & Northern Engineering Wings',
    description:
      'Study lounges across the 13 ENP departments (Preparatory, Automatics, Electronics, Electrical, Chemical/GPE, Civil, Environmental, Mechanical, Industrial, Mining, Hydraulic, Metallurgy & Risk Management).',
    lat: 36.72415,
    lng: 3.14965,
    boardsAvailable: 5,
  },
];

export const RIVALRY_HEADER_BANNER_4K = IMG_KASPAROV_KARPOV_BANNER;

export const ANDROID_BLITZ_BANNER_4K = IMG_BLITZ_ARENA_BANNER;

export interface LoggedClubGame {
  id: string;
  clubId: string;
  title: string;
  event: string;
  date: string;
  whiteId: string;
  blackId: string;
  result: '1-0' | '1/2-1/2' | '0-1';
  timeControl: TimeControl;
  matchStakes?: MatchStakes;
  eco: string;
  openingName: string;
  pgn: string;
  status: 'approved' | 'pending';
  submittedBy?: string;
  submittedByUid?: string;
  whiteEloDelta?: number;
  blackEloDelta?: number;
  tournamentId?: string;
  moves: {
    ply: number;
    san: string;
    fen: string;
    eval: number;
    comment?: string;
    fromSquare?: string;
    toSquare?: string;
  }[];
}

export interface ClubPost {
  id: string;
  clubId: string;
  title: string;
  category: 'Tournament' | 'Club News' | 'Match Recap' | 'Campus Notice';
  body: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  pinned?: boolean;
}

export interface ClubTournament {
  id: string;
  clubId: string;
  name: string;
  format: TournamentFormat;
  timeControl: TimeControl;
  status: 'active' | 'completed';
  currentRound: number;
  totalRounds: number;
  playerIds: string[];
  matches: TournamentMatch[];
  createdAt: string;
}

export interface ClubThemeConfig {
  clubId: string;
  clubName: string;
  subtitleAr: string;
  universityName: string;
  city: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  customLogoUrl: string;
  schoolLogoUrl: string;
  clubBannerUrl?: string;
  customHeroUrl: string;
  startingRating: number;
  weekMode: 'algeria_sat_thu' | 'intl_mon_sat';
}

export interface ClubChatMessage {
  id: string;
  clubId: string;
  channelId: string;
  channelType: 'team' | 'dm';
  senderId: string;
  senderAuthUid?: string;
  senderName: string;
  senderRole: UserRole;
  recipientId?: string;
  recipientAuthUid?: string;
  participantAuthUids?: string[];
  text: string;
  challengeTimeControl?: TimeControl;
  challengeStakes?: MatchStakes;
  createdAt: string;
}

export const MODULE_BACKGROUNDS_4K: Record<
  'overview' | 'members' | 'studio' | 'tournaments' | 'lounge' | 'radar' | 'customizer',
  {
    imageUrl: string;
    kicker: string;
    title: string;
    subtitle: string;
  }
> = {
  overview: {
    imageUrl: IMG_MIKHAIL_TAL_HERO,
    kicker: 'THE MAGICIAN FROM RIGA · BLED CANDIDATES 1965',
    title: 'Mikhail Tal’s Immortal 16. Nd5 Knight Sacrifice',
    subtitle: 'Step through each single turn of the historic Bled 1965 semifinal clash.',
  },
  members: {
    imageUrl: IMG_ENP_TWILIGHT_BANNER,
    kicker: 'OFFICIAL ENP CHESS CLUB ROSTER · PLAYER PROFILES & OPENINGS',
    title: 'ENP Chess Club Members & Player Dossiers',
    subtitle:
      'Official registered ENP El Harrach students across CPST and engineering departments, Chess.com handles, favorite openings, and Elo brackets.',
  },
  studio: {
    imageUrl: IMG_KASPAROV_DEEP_BLUE_BANNER,
    kicker: 'MAN VS. MACHINE (1997) · REAL-TIME STOCKFISH-LITE EVAL BAR · PGN STUDIO',
    title: 'Chessboard Studio, Stockfish Analysis & PGN Database',
    subtitle:
      'Play legal alternating turns or challenge Stockfish-Lite with a live depth-smoothed evaluation bar, or log result-only friendly & competitive games.',
  },
  tournaments: {
    imageUrl: IMG_FISCHER_REYKJAVIK_BANNER,
    kicker: 'REYKJAVIK 1972 CHAMPIONSHIP SPIRIT · 7 AUTOMATED COMPUTER-PAIRED FORMATS',
    title: 'Tournaments & Championship Hub',
    subtitle:
      'Run Swiss, Knockout, Round Robin, Scheveningen Team Clash, and Club Arena events with full bracket & history management.',
  },
  lounge: {
    imageUrl: IMG_BLITZ_ARENA_BANNER,
    kicker: 'MEMBERS-ONLY TEAM CHANNELS · CROSS-TEAM PRIVATE DMs · LIVE BLITZ ARENA',
    title: 'Internal Team Channels & Cross-Team Private Chat',
    subtitle:
      'Exclusive team chat for your university squad, private 1-on-1 DMs with players from any team, and instant Friendly (0.45x) or Competitive (1.0x) match logging.',
  },
  radar: {
    imageUrl: IMG_ENP_COURTYARD_BANNER,
    kicker: 'ENP EL HARRACH COURTYARD · LIVE GPS MAP · VIC / CAP / IEEE / ENPRT & AMPHI 1C',
    title: '“Who’s Free This Hour” Campus Radar & Live GPS Map',
    subtitle:
      'Pin your exact real-time GPS location across ENP El Harrach (Rue des Frères Oudek Gate, Jardins, Library, Amphi C, VIC/CAP/IEEE/ENPRT Clubs, and 13 Departments).',
  },
  customizer: {
    imageUrl: IMG_ENP_TWILIGHT_BANNER,
    kicker: 'ADMIN CENTER, NEXT-GENERATION OWNERSHIP INHERITANCE & CLUB ROLES',
    title: 'Admin Center, Next-Generation Inheritance & Club Management',
    subtitle:
      'Manage real student accounts, assign custom club roles & openings when ready, moderate games, and pass club ownership to future generations.',
  },
};

export const UNIVERSITY_PRESETS: ClubThemeConfig[] = [
  {
    clubId: 'enp-alger',
    clubName: 'ENP Chess Club',
    subtitleAr: 'نادي الشطرنج — المدرسة الوطنية المتعددة التقنيات بالحراش',
    universityName: 'École Nationale Polytechnique (ENP El Harrach)',
    city: 'El Harrach, Algiers',
    primaryColor: '#0A1E3C',
    secondaryColor: '#133B6E',
    accentColor: '#FF6B00',
    customLogoUrl: IMG_ENP_CLUB_LOGO,
    schoolLogoUrl: IMG_ENP_SCHOOL_LOGO,
    clubBannerUrl: IMG_ENP_CREST_BANNER,
    customHeroUrl: IMG_MIKHAIL_TAL_HERO,
    startingRating: 1200,
    weekMode: 'algeria_sat_thu',
  },
];

export const TAL_BLED_1965_COMBINATION = {
  title: 'Mikhail Tal vs. Bent Larsen — Candidates Semifinal, Bled 1965 (Game 10)',
  subtitle: 'The Immortal Speculative Knight Sacrifice · Sicilian Scheveningen (B82)',
  sacrificeMoveIndex: 2,
  steps: [
    {
      ply: 29,
      moveLabel: '15. Bd3 (White)',
      movedBy: 'White · Mikhail Tal',
      san: 'Bd3',
      fen: '1q3rk1/1b1nbppp/p2pp3/1p4P1/3BPP2/2NB1Q2/PPP4P/2KR3R b - - 2 15',
      eval: 0.55,
      fromSquare: 'f1',
      toSquare: 'd3',
      comment:
        'White Turn 15: Tal develops his Bishop from f1 to d3, aiming directly at Black’s kingside. Now it is Black’s turn.',
      whiteClock: '04:48',
      blackClock: '03:24',
    },
    {
      ply: 30,
      moveLabel: '15... b4 (Black)',
      movedBy: 'Black · Bent Larsen',
      san: 'b4',
      fen: '1q3rk1/1b1nbppp/p2pp3/6P1/1p1BPP2/2NB1Q2/PPP4P/2KR3R w - - 0 16',
      eval: 0.75,
      fromSquare: 'b5',
      toSquare: 'b4',
      comment:
        'Black Turn 15: Larsen pushes his pawn from b5 to b4, attacking Tal’s Knight on c3. Now it is White’s turn.',
      whiteClock: '04:48',
      blackClock: '03:12',
    },
    {
      ply: 31,
      moveLabel: '16. Nd5 (White)',
      movedBy: 'White · Mikhail Tal',
      san: 'Nd5',
      fen: '1q3rk1/1b1nbppp/p2pp3/3N2P1/1p1BPP2/3B1Q2/PPP4P/2KR3R b - - 1 16',
      eval: 3.85,
      fromSquare: 'c3',
      toSquare: 'd5',
      comment:
        'White Turn 16: Instead of retreating his Knight, Tal leaps from c3 to d5, sacrificing a full piece to rip open the center.',
      whiteClock: '04:35',
      blackClock: '03:12',
    },
    {
      ply: 32,
      moveLabel: '16... exd5 (Black)',
      movedBy: 'Black · Bent Larsen',
      san: 'exd5',
      fen: '1q3rk1/1b1nbppp/p2p4/3p2P1/1p1BPP2/3B1Q2/PPP4P/2KR3R w - - 0 17',
      eval: 4.1,
      fromSquare: 'e6',
      toSquare: 'd5',
      comment:
        'Black Turn 16: Larsen captures the Knight on d5 with his e6 pawn (exd5). Now it is White’s turn.',
      whiteClock: '04:35',
      blackClock: '02:44',
    },
    {
      ply: 33,
      moveLabel: '17. exd5 (White)',
      movedBy: 'White · Mikhail Tal',
      san: 'exd5',
      fen: '1q3rk1/1b1nbppp/p2p4/3P2P1/1p1B1P2/3B1Q2/PPP4P/2KR3R b - - 0 17',
      eval: 4.45,
      fromSquare: 'e4',
      toSquare: 'd5',
      comment:
        'White Turn 17: Tal recaptures on d5 with his e4 pawn (exd5), opening the e-file and entombing Black’s b7 Bishop.',
      whiteClock: '04:29',
      blackClock: '02:44',
    },
    {
      ply: 34,
      moveLabel: '17... f5 (Black)',
      movedBy: 'Black · Bent Larsen',
      san: 'f5',
      fen: '1q3rk1/1b1nb1pp/p2p4/3P1pP1/1p1B1P2/3B1Q2/PPP4P/2KR3R w - f6 0 18',
      eval: 4.9,
      fromSquare: 'f7',
      toSquare: 'f5',
      comment:
        'Black Turn 17: Larsen advances his f7 pawn to f5 to block White’s d3 Bishop diagonal. Now it is White’s turn.',
      whiteClock: '04:29',
      blackClock: '02:18',
    },
    {
      ply: 35,
      moveLabel: '18. Rde1 (White)',
      movedBy: 'White · Mikhail Tal',
      san: 'Rde1',
      fen: '1q3rk1/1b1nb1pp/p2p4/3P1pP1/1p1B1P2/3B1Q2/PPP4P/2K1R2R b - - 1 18',
      eval: 5.4,
      fromSquare: 'd1',
      toSquare: 'e1',
      comment:
        'White Turn 18: Tal brings his queenside Rook from d1 to e1, targeting the pinned e7 Bishop.',
      whiteClock: '04:18',
      blackClock: '02:18',
    },
    {
      ply: 36,
      moveLabel: '18... Rf7 (Black)',
      movedBy: 'Black · Bent Larsen',
      san: 'Rf7',
      fen: '1q4k1/1b1nbrpp/p2p4/3P1pP1/1p1B1P2/3B1Q2/PPP4P/2K1R2R w - - 2 19',
      eval: 5.7,
      fromSquare: 'f8',
      toSquare: 'f7',
      comment:
        'Black Turn 18: Larsen plays Rf8-f7 to defend the e7 Bishop. Now it is White’s turn.',
      whiteClock: '04:18',
      blackClock: '01:55',
    },
    {
      ply: 37,
      moveLabel: '19. g6 (White)',
      movedBy: 'White · Mikhail Tal',
      san: 'g6',
      fen: '1q4k1/1b1nbrpp/p2p2P1/3P1p2/1p1B1P2/3B1Q2/PPP4P/2K1R2R b - - 0 19',
      eval: 6.4,
      fromSquare: 'g5',
      toSquare: 'g6',
      comment:
        'White Turn 19: Tal thrusts his g5 pawn to g6, shattering Black’s kingside fortress.',
      whiteClock: '04:12',
      blackClock: '01:55',
    },
  ],
};

export const INITIAL_OWNERSHIP_LINEAGE: ClubGenerationRecord[] = [
  {
    id: 'gen-2026-founding',
    clubId: 'enp-alger',
    generationLabel: 'Generation I — Founding Mandate',
    MandatePeriod: '2026 – 2027 Academic Year',
    fromOwnerId: 'enp-owner',
    fromOwnerName: 'Fethallah (Club Founder)',
    toOwnerId: 'enp-owner',
    toOwnerName: 'Fethallah (Club Founder)',
    toOwnerDepartment: 'Direction du Club & Génie Polytechnique',
    transferredAt: '2026-11-04',
    legacyNote:
      'Founded the official ENP Chess Club digital platform, onboarded the first 28 registered ENP members across CPST and engineering departments, and established the Ownership Inheritance system for future generations.',
  },
];

/**
 * OFFICIAL ENP CHESS CLUB ROSTER
 * Imported directly from the Google Form registration responses CSV + Club Founder Fethallah.
 * All synthetic test accounts have been removed.
 */
export const INITIAL_MEMBERS: ClubMember[] = [
  // 0. Founder & Platform Owner
  {
    id: 'enp-owner',
    clubId: 'enp-alger',
    name: 'Fethallah (Club Founder)',
    arabicName: 'فتح الله — مؤسس النادي',
    username: 'fethallah',
    role: 'owner',
    clubRoleDivision: 'President & Founder',
    chessSpecialty: 'Tactical Attacker & Sacrifices',
    chessComUsername: 'altarmmah3',
    onlineEloBracket: '1600-2000 (Advanced Intermediate)',
    bringsEquipment: true,
    willingToCoach: true,
    willingToOrganize: true,
    clubExpectation: 'Build a lasting ENP Chess Club tradition passed down through generations',
    university: 'ENP Alger',
    department: 'Direction du Club & Génie Polytechnique',
    yearLevel: 'Club Owner & President',
    titleBadge: 'Platform Owner · President',
    liveStatus: 'offline',
    bio: 'Founder & President of the ENP Chess Club Platform. Oversees club registrations, tournament homologation, organizational roles (IT, COMM, Events, Coaching), and next-generation ownership inheritance.',
    avatarUrl: IMG_ENP_CLUB_LOGO,
    avatarInitials: 'FE',
    avatarColor: '#FF6B00',
    coverPhotoUrl: IMG_FISCHER_REYKJAVIK_BANNER,
    profilePhotos: [
      {
        id: 'ph-fe-1',
        imageUrl: IMG_FISCHER_REYKJAVIK_BANNER,
        caption: 'Launch of the official ENP Chess Club roster at El Harrach!',
        date: 'Nov 14, 2026',
        likes: 28,
      },
    ],
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1600,
      blitz: 1600,
      classical: 1600,
      peak: 1600,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1600, rd: 220, vol: 0.06 },
      blitz: { rating: 1600, rd: 220, vol: 0.06 },
      classical: { rating: 1600, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-10', event: 'Club Seed (1600 Tier)', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
      { date: '2026-11', event: 'ENP Inaugural Seed', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-jardins-library',
  },

  // 1. Boureghda Yasser — Chimie, 1600-2000, Brings Board/Clock: Yes, Coach: Yes, Organize: Yes
  {
    id: 'enp-yasser-boureghda',
    clubId: 'enp-alger',
    name: 'Boureghda Yasser',
    arabicName: 'بورغدة ياسر',
    username: 'yasser',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Positional & Workshop Player',
    onlineEloBracket: '1600-2000 (advanced intermediate)',
    bringsEquipment: true,
    willingToCoach: true,
    willingToOrganize: true,
    clubExpectation: 'Regular competitive tournaments with rankings',
    university: 'ENP Alger',
    department: 'Génie Chimique & Génie des Procédés (GPE / Chemical)',
    yearLevel: 'Cycle Ingénieur — Chimie',
    titleBadge: '1600–2000 Bracket · Chimie',
    liveStatus: 'offline',
    bio: 'Chemical Engineering player (1600–2000 ELO bracket). Brings physical chess equipment to campus and is open to coaching workshops and organizing ranked ENP tournaments.',
    avatarInitials: 'BY',
    avatarColor: '#059669',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1600,
      blitz: 1600,
      classical: 1600,
      peak: 1600,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1600, rd: 220, vol: 0.056 },
      blitz: { rating: 1600, rd: 220, vol: 0.058 },
      classical: { rating: 1600, rd: 220, vol: 0.054 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (1600–2000)', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-jardins-library',
  },

  // 2. Hammada Ahmed Wadjih — 1CP, 1600-2000, Watermelon_enthusiast, Brings Board/Clock: Yes
  {
    id: 'enp-ahmed-wadjih',
    clubId: 'enp-alger',
    name: 'Hammada Ahmed Wadjih',
    arabicName: 'حمادة أحمد وجيه',
    username: 'wadjih',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Tactical Attacker & Sacrifices',
    chessComUsername: 'Watermelon_enthusiast',
    onlineEloBracket: '1600-2000 (advanced intermediate)',
    bringsEquipment: true,
    willingToCoach: true,
    willingToOrganize: false,
    clubExpectation: 'Preparation and team selection for inter-university competitions — I wanna have fun',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '1600–2000 Bracket · @Watermelon_enthusiast',
    liveStatus: 'offline',
    bio: '1CP player (@Watermelon_enthusiast, 1600–2000 online). Owns a physical board/clock for campus events and aims for inter-university competitions.',
    avatarInitials: 'HW',
    avatarColor: '#1E56A0',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1600,
      blitz: 1600,
      classical: 1600,
      peak: 1600,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1600, rd: 220, vol: 0.058 },
      blitz: { rating: 1600, rd: 220, vol: 0.06 },
      classical: { rating: 1600, rd: 220, vol: 0.056 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (1600–2000)', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 3. Yessaad Yanis Faycel — 2CP, 1600-2000, GMmindmaster, Coach: Yes
  {
    id: 'enp-yanis-yessaad',
    clubId: 'enp-alger',
    name: 'Yessaad Yanis Faycel',
    arabicName: 'يسعد يانيس فيصل',
    username: 'yanis',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Rapid & Blitz Speed Specialist',
    chessComUsername: 'GMmindmaster',
    onlineEloBracket: '1600-2000 (advanced intermediate)',
    bringsEquipment: false,
    willingToCoach: true,
    willingToOrganize: false,
    clubExpectation: 'A chill community to play casual games between classes — here for fun',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '2nd Year CPST (2CP)',
    titleBadge: '1600–2000 Bracket · @GMmindmaster',
    liveStatus: 'offline',
    bio: '2CP player (@GMmindmaster, 1600–2000 online). Open to coaching newer members, reviewing games, and playing casual games between classes.',
    avatarInitials: 'YY',
    avatarColor: '#7C3AED',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1600,
      blitz: 1600,
      classical: 1600,
      peak: 1600,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1600, rd: 220, vol: 0.06 },
      blitz: { rating: 1600, rd: 220, vol: 0.062 },
      classical: { rating: 1600, rd: 220, vol: 0.058 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (1600–2000)', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 4. Taleb Aramis — 1CP, 1600-2000
  {
    id: 'enp-aramis-taleb',
    clubId: 'enp-alger',
    name: 'Taleb Aramis',
    arabicName: 'طالب أراميس',
    username: 'aramis',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Positional Grinder & Endgame Specialist',
    onlineEloBracket: '1600-2000 (advanced intermediate)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: false,
    clubExpectation: 'A chill community to play casual games between classes',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '1600–2000 Bracket · 1CP',
    liveStatus: 'offline',
    bio: '1CP player in the 1600–2000 rating bracket looking for casual and rated games between lectures.',
    avatarInitials: 'TA',
    avatarColor: '#0284C7',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1600,
      blitz: 1600,
      classical: 1600,
      peak: 1600,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1600, rd: 220, vol: 0.058 },
      blitz: { rating: 1600, rd: 220, vol: 0.06 },
      classical: { rating: 1600, rd: 220, vol: 0.056 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (1600–2000)', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 5. Mazouzi Mohamed — 5ème année GPE, 1200-1600, Mohammed_45, Coach: Yes, Organize: Yes
  {
    id: 'enp-mohamed-mazouzi',
    clubId: 'enp-alger',
    name: 'Mazouzi Mohamed',
    arabicName: 'مازوزي محمد',
    username: 'mazouzi',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Opening Theoretician & Prep Lead',
    chessComUsername: 'Mohammed_45',
    onlineEloBracket: '1200-1600 (intermediate)',
    bringsEquipment: false,
    willingToCoach: true,
    willingToOrganize: true,
    clubExpectation: 'A structured path to seriously improve my rating/ELO — more univ competition',
    university: 'ENP Alger',
    department: 'Génie Chimique & Génie des Procédés (GPE / Chemical)',
    yearLevel: '5th Year Ingénieur GPE',
    titleBadge: '1200–1600 Bracket · @Mohammed_45',
    liveStatus: 'offline',
    bio: '5th Year GPE student (@Mohammed_45, 1200–1600 bracket). Interested in inter-university competition, coaching, and team organization.',
    avatarInitials: 'MM',
    avatarColor: '#D97706',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1600,
      blitz: 1600,
      classical: 1600,
      peak: 1600,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1600, rd: 220, vol: 0.058 },
      blitz: { rating: 1600, rd: 220, vol: 0.06 },
      classical: { rating: 1600, rd: 220, vol: 0.056 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (1200–1600)', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-north-depts',
  },

  // 6. Harrat Mohamed Wail — 1 CP, 1200-1600, helpwailto1000, Brings Board: Yes, Coach: Maybe, Organize: Yes
  {
    id: 'enp-wail-harrat',
    clubId: 'enp-alger',
    name: 'Harrat Mohamed Wail',
    arabicName: 'حراث محمد وائل',
    username: 'wail',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Tactical Attacker & Sacrifices',
    chessComUsername: 'helpwailto1000',
    onlineEloBracket: '1200-1600 (intermediate)',
    bringsEquipment: true,
    willingToCoach: true,
    willingToOrganize: true,
    clubExpectation: 'Regular competitive tournaments with rankings',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '1200–1600 Bracket · @helpwailto1000',
    liveStatus: 'offline',
    bio: '1CP player (@helpwailto1000, 1200–1600 bracket). Brings physical chess gear to campus and is ready to help run ranked tournaments.',
    avatarInitials: 'HW',
    avatarColor: '#EA580C',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1600,
      blitz: 1600,
      classical: 1600,
      peak: 1600,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1600, rd: 220, vol: 0.06 },
      blitz: { rating: 1600, rd: 220, vol: 0.06 },
      classical: { rating: 1600, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (1200–1600)', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 7. Farah Daoud — 1 CP, 1200-1600, kaneki0701, Coach: Yes, Organize: Yes
  {
    id: 'enp-farah-daoud',
    clubId: 'enp-alger',
    name: 'Farah Daoud',
    arabicName: 'فرح داود',
    username: 'farah',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Dynamic Counter-Attacker',
    chessComUsername: 'kaneki0701',
    onlineEloBracket: '1200-1600 (intermediate)',
    bringsEquipment: false,
    willingToCoach: true,
    willingToOrganize: true,
    clubExpectation: 'I will be a great supporter of this group and any chess organization, competition, or exhibition.',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '1200–1600 Bracket · @kaneki0701',
    liveStatus: 'offline',
    bio: '1CP student (@kaneki0701, 1200–1600 bracket). Ready to support club exhibitions, competitions, and coaching sessions.',
    avatarInitials: 'FD',
    avatarColor: '#DB2777',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1600,
      blitz: 1600,
      classical: 1600,
      peak: 1600,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1600, rd: 220, vol: 0.06 },
      blitz: { rating: 1600, rd: 220, vol: 0.06 },
      classical: { rating: 1600, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (1200–1600)', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-jardins-library',
  },

  // 8. Tarek Meriem — 2CP, 1200-1600, daakkiii, Coach: Maybe, Organize: Yes
  {
    id: 'enp-meriem-tarek',
    clubId: 'enp-alger',
    name: 'Tarek Meriem',
    arabicName: 'طارق مريم',
    username: 'daakkiii',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Positional Grinder & Endgame Specialist',
    chessComUsername: 'daakkiii',
    onlineEloBracket: '1200-1600 (intermediate)',
    bringsEquipment: false,
    willingToCoach: true,
    willingToOrganize: true,
    clubExpectation: 'A chill community to play casual games between classes',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '2nd Year CPST (2CP)',
    titleBadge: '1200–1600 Bracket · @daakkiii',
    liveStatus: 'offline',
    bio: '2CP student (@daakkiii, 1200–1600 bracket). Interested in casual OTB games between classes and helping organize the club.',
    avatarInitials: 'TM',
    avatarColor: '#0D9488',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1600,
      blitz: 1600,
      classical: 1600,
      peak: 1600,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1600, rd: 220, vol: 0.06 },
      blitz: { rating: 1600, rd: 220, vol: 0.06 },
      classical: { rating: 1600, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (1200–1600)', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 9. Youcef Khoudja Younes — 1st Year Mining Engineering, 1200-1600, younesyk0, Organize: Yes
  {
    id: 'enp-younes-yk',
    clubId: 'enp-alger',
    name: 'Youcef Khoudja Younes',
    arabicName: 'يوسف خوجة يونس',
    username: 'younes',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Rapid & Blitz Speed Specialist',
    chessComUsername: 'younesyk0',
    onlineEloBracket: '1200-1600 (intermediate)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: true,
    clubExpectation: 'A chill community to play casual games between classes — play a lot of games',
    university: 'ENP Alger',
    department: 'Génie Minier (Mining)',
    yearLevel: '1st Year Génie Minier',
    titleBadge: '1200–1600 Bracket · @younesyk0',
    liveStatus: 'offline',
    bio: 'Mining Engineering student (@younesyk0, 1200–1600 bracket) eager to play plenty of rapid and blitz games and help out.',
    avatarInitials: 'YY',
    avatarColor: '#2563EB',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1600,
      blitz: 1600,
      classical: 1600,
      peak: 1600,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1600, rd: 220, vol: 0.06 },
      blitz: { rating: 1600, rd: 220, vol: 0.06 },
      classical: { rating: 1600, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (1200–1600)', fide: 1600, glicko: 1600, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-north-depts',
  },

  // 10. Houari Ouassim — 2CP, 800-1200, Wasimovv, Brings Board: Yes, Coach: Yes
  {
    id: 'enp-ouassim-houari',
    clubId: 'enp-alger',
    name: 'Houari Ouassim',
    arabicName: 'هواري وسيم',
    username: 'ouassim',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Solid Classical Defender',
    chessComUsername: 'Wasimovv',
    onlineEloBracket: '800-1200 (beginner)',
    bringsEquipment: true,
    willingToCoach: true,
    willingToOrganize: false,
    clubExpectation: 'Regulated tournaments, to get clocks and boards. Thank you for that chance!',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '2nd Year CPST (2CP)',
    titleBadge: '800–1200 Bracket · @Wasimovv',
    liveStatus: 'offline',
    bio: '2CP player (@Wasimovv, 800–1200 bracket). Brings physical chess boards & clocks to campus events and participates in OTB tournaments.',
    avatarInitials: 'HO',
    avatarColor: '#0F766E',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1200,
      blitz: 1200,
      classical: 1200,
      peak: 1200,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1200, rd: 220, vol: 0.06 },
      blitz: { rating: 1200, rd: 220, vol: 0.06 },
      classical: { rating: 1200, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (800–1200)', fide: 1200, glicko: 1200, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 11. Khelifi Yasmine Malak — 1CP, 800-1200, y4ssmxne, Brings Board: Yes, Organize: Yes
  {
    id: 'enp-yasmine-khelifi',
    clubId: 'enp-alger',
    name: 'Khelifi Yasmine Malak',
    arabicName: 'خليفي ياسمين ملاك',
    username: 'yasmine',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Rising Tactical Contender',
    chessComUsername: 'y4ssmxne',
    onlineEloBracket: '800-1200 (beginner)',
    bringsEquipment: true,
    willingToCoach: false,
    willingToOrganize: true,
    clubExpectation: 'Preparation and team selection for inter-university competitions — sharing tactics and discussing them between members',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '800–1200 Bracket · @y4ssmxne',
    liveStatus: 'offline',
    bio: '1CP student (@y4ssmxne, 800–1200 bracket). Brings a physical board/clock to campus and enjoys sharing tactics and preparing for inter-university competitions.',
    avatarInitials: 'KY',
    avatarColor: '#9333EA',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1200,
      blitz: 1200,
      classical: 1200,
      peak: 1200,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1200, rd: 220, vol: 0.06 },
      blitz: { rating: 1200, rd: 220, vol: 0.06 },
      classical: { rating: 1200, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (800–1200)', fide: 1200, glicko: 1200, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 12. Belaidouni Romaissa — 1st year GPE, 800-1200, ROMI, Organize: Yes
  {
    id: 'enp-romaissa-belaidouni',
    clubId: 'enp-alger',
    name: 'Belaidouni Romaissa',
    arabicName: 'بلعيدوني رميساء',
    username: 'romaissa',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Dynamic Counter-Attacker',
    chessComUsername: 'ROMI',
    onlineEloBracket: '800-1200 (beginner)',
    bringsEquipment: false,
    willingToCoach: true,
    willingToOrganize: true,
    clubExpectation: 'I wish the best for this club, it is really interesting — I want it to be popular inside and outside the school',
    university: 'ENP Alger',
    department: 'Génie Chimique & Génie des Procédés (GPE / Chemical)',
    yearLevel: '1st Year GPE & Environmental Engineering',
    titleBadge: '800–1200 Bracket · @ROMI',
    liveStatus: 'offline',
    bio: '1st Year Process & Environmental Engineering (GPE) student (@ROMI, 800–1200 bracket). Enthusiastic about growing the club inside and outside ENP.',
    avatarInitials: 'BR',
    avatarColor: '#E11D48',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1200,
      blitz: 1200,
      classical: 1200,
      peak: 1200,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1200, rd: 220, vol: 0.06 },
      blitz: { rating: 1200, rd: 220, vol: 0.06 },
      classical: { rating: 1200, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (800–1200)', fide: 1200, glicko: 1200, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-club-vic',
  },

  // 13. Esma Boulkhessaim — 2ème année Automatique, 800-1200, Organize: Yes
  {
    id: 'enp-esma-boulkhessaim',
    clubId: 'enp-alger',
    name: 'Esma Boulkhessaim',
    arabicName: 'أسماء بولخصايم',
    username: 'esma',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Opening Theoretician & Prep Lead',
    onlineEloBracket: '800-1200 (beginner)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: true,
    clubExpectation: 'A structured path to seriously improve my rating/ELO — I expect workshops training',
    university: 'ENP Alger',
    department: 'Génie Automatique (Automatics)',
    yearLevel: '2nd Year Ingénieur Automatique',
    titleBadge: '800–1200 Bracket · Automatique',
    liveStatus: 'offline',
    bio: '2nd Year Automatics Engineering student (800–1200 bracket). Looking forward to structured workshops and rating progression.',
    avatarInitials: 'EB',
    avatarColor: '#4F46E5',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1200,
      blitz: 1200,
      classical: 1200,
      peak: 1200,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1200, rd: 220, vol: 0.06 },
      blitz: { rating: 1200, rd: 220, vol: 0.06 },
      classical: { rating: 1200, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (800–1200)', fide: 1200, glicko: 1200, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-club-ieee',
  },

  // 14. Remili Mohanned — 4th year GPE, 800-1200, mohanned_remili, Organize: Yes
  {
    id: 'enp-mohanned-remili',
    clubId: 'enp-alger',
    name: 'Remili Mohanned',
    arabicName: 'رميلي مهند',
    username: 'mohanned',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Solid Classical Defender',
    chessComUsername: 'mohanned_remili',
    onlineEloBracket: '800-1200 (beginner)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: true,
    clubExpectation: 'A chill community to play casual games between classes',
    university: 'ENP Alger',
    department: 'Génie Chimique & Génie des Procédés (GPE / Chemical)',
    yearLevel: '4th Year Ingénieur GPE',
    titleBadge: '800–1200 Bracket · @mohanned_remili',
    liveStatus: 'offline',
    bio: '4th Year GPE student (@mohanned_remili, 800–1200 bracket) looking for a friendly campus community and casual OTB matches.',
    avatarInitials: 'RM',
    avatarColor: '#0284C7',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1200,
      blitz: 1200,
      classical: 1200,
      peak: 1200,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1200, rd: 220, vol: 0.06 },
      blitz: { rating: 1200, rd: 220, vol: 0.06 },
      classical: { rating: 1200, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (800–1200)', fide: 1200, glicko: 1200, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-jardins-library',
  },

  // 15. Meradci Fatima Zohra — 1st year GPE, 800-1200, Coach: Yes, Organize: Yes
  {
    id: 'enp-fatima-meradci',
    clubId: 'enp-alger',
    name: 'Meradci Fatima Zohra',
    arabicName: 'مرادسي فاطمة الزهراء',
    username: 'fatima_m',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Workshop & Endgame Student',
    onlineEloBracket: '800-1200 (beginner)',
    bringsEquipment: false,
    willingToCoach: true,
    willingToOrganize: true,
    clubExpectation: 'Preparation and team selection for inter-university competitions',
    university: 'ENP Alger',
    department: 'Génie Chimique & Génie des Procédés (GPE / Chemical)',
    yearLevel: '1st Year Ingénieur GPE',
    titleBadge: '800–1200 Bracket · GPE',
    liveStatus: 'offline',
    bio: '1st Year GPE student (800–1200 bracket) keen on training sessions and inter-university team preparation.',
    avatarInitials: 'MF',
    avatarColor: '#059669',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1200,
      blitz: 1200,
      classical: 1200,
      peak: 1200,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1200, rd: 220, vol: 0.06 },
      blitz: { rating: 1200, rd: 220, vol: 0.06 },
      classical: { rating: 1200, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (800–1200)', fide: 1200, glicko: 1200, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-club-cap',
  },

  // 16. Mouatez Arib Chaib — 1 CP, 800-1200, Wharko
  {
    id: 'enp-mouatez-chaib',
    clubId: 'enp-alger',
    name: 'Mouatez Arib Chaib',
    arabicName: 'معتز عريب شايب',
    username: 'wharko',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Rising Tactical Contender',
    chessComUsername: 'Wharko',
    onlineEloBracket: '800-1200 (beginner)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: false,
    clubExpectation: 'A structured path to seriously improve my rating/ELO',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '800–1200 Bracket · @Wharko',
    liveStatus: 'offline',
    bio: '1CP student (@Wharko, 800–1200 bracket) focused on a structured training path to climb the ENP Rapid & Blitz Elo leaderboard.',
    avatarInitials: 'MC',
    avatarColor: '#1E56A0',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1200,
      blitz: 1200,
      classical: 1200,
      peak: 1200,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1200, rd: 220, vol: 0.06 },
      blitz: { rating: 1200, rd: 220, vol: 0.06 },
      classical: { rating: 1200, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (800–1200)', fide: 1200, glicko: 1200, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 17. Anis Bouzegza — 1 CP, 800-1200, WPLAYER2
  {
    id: 'enp-anis-bouzegza',
    clubId: 'enp-alger',
    name: 'Anis Bouzegza',
    arabicName: 'أنيس بوزقزة',
    username: 'wplayer2',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Tactical Attacker & Sacrifices',
    chessComUsername: 'WPLAYER2',
    onlineEloBracket: '800-1200 (beginner)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: false,
    clubExpectation: 'A structured path to seriously improve my rating/ELO',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '800–1200 Bracket · @WPLAYER2',
    liveStatus: 'offline',
    bio: '1CP student (@WPLAYER2, 800–1200 bracket) working systematically on rating improvement.',
    avatarInitials: 'AB',
    avatarColor: '#EA580C',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1200,
      blitz: 1200,
      classical: 1200,
      peak: 1200,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1200, rd: 220, vol: 0.06 },
      blitz: { rating: 1200, rd: 220, vol: 0.06 },
      classical: { rating: 1200, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (800–1200)', fide: 1200, glicko: 1200, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 18. Rayane Sellal — 1ere année prepa, 800-1200, Organize: Yes
  {
    id: 'enp-rayane-sellal',
    clubId: 'enp-alger',
    name: 'Rayane Sellal',
    arabicName: 'ريان سلال',
    username: 'rayane',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Rapid & Blitz Speed Specialist',
    onlineEloBracket: '800-1200 (beginner)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: true,
    clubExpectation: 'A chill community to play casual games between classes',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '800–1200 Bracket · 1CP',
    liveStatus: 'offline',
    bio: '1st Year Preparatory Cycle student (800–1200 bracket) enjoying casual campus games between classes.',
    avatarInitials: 'RS',
    avatarColor: '#7C3AED',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 1200,
      blitz: 1200,
      classical: 1200,
      peak: 1200,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 1200, rd: 220, vol: 0.06 },
      blitz: { rating: 1200, rd: 220, vol: 0.06 },
      classical: { rating: 1200, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (800–1200)', fide: 1200, glicko: 1200, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 19. Hadjab Abdelhakim — 2nd year prepa, 100-800, AbHakim07, Brings Board: Yes
  {
    id: 'enp-abdelhakim-hadjab',
    clubId: 'enp-alger',
    name: 'Hadjab Abdelhakim',
    arabicName: 'حجاب عبد الحكيم',
    username: 'abhakim07',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Rising Tactical Contender',
    chessComUsername: 'AbHakim07',
    onlineEloBracket: '100-800 (absolut beginner)',
    bringsEquipment: true,
    willingToCoach: true,
    willingToOrganize: false,
    clubExpectation: 'A structured path to seriously improve my rating/ELO',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '2nd Year CPST (2CP)',
    titleBadge: '100–800 Bracket · @AbHakim07',
    liveStatus: 'offline',
    bio: '2CP student (@AbHakim07, 100–800 bracket) who brings a physical board/clock to campus events and trains actively to improve his Elo.',
    avatarInitials: 'HA',
    avatarColor: '#0F766E',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 800,
      blitz: 800,
      classical: 800,
      peak: 800,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 800, rd: 220, vol: 0.06 },
      blitz: { rating: 800, rd: 220, vol: 0.06 },
      classical: { rating: 800, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (100–800)', fide: 800, glicko: 800, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 20. Bouokka Abderrahmen — Mining Engineering, 100-800, Brings Board: Yes, Coach: Yes, Organize: Yes
  {
    id: 'enp-abderrahmen-bouokka',
    clubId: 'enp-alger',
    name: 'Bouokka Abderrahmen',
    arabicName: 'بوعكة عبد الرحمان',
    username: 'abderrahmen',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Tactical Attacker & Sacrifices',
    onlineEloBracket: '100-800 (absolut beginner)',
    bringsEquipment: true,
    willingToCoach: true,
    willingToOrganize: true,
    clubExpectation: 'Active campus events, tournaments & team camaraderie',
    university: 'ENP Alger',
    department: 'Génie Minier (Mining)',
    yearLevel: 'Cycle Ingénieur — Génie Minier',
    titleBadge: '100–800 Bracket · Génie Minier',
    liveStatus: 'offline',
    bio: 'Mining Engineering student (بوعكة عبد الرحمان, 100–800 bracket). Brings physical chess gear to campus.',
    avatarInitials: 'BA',
    avatarColor: '#D97706',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 800,
      blitz: 800,
      classical: 800,
      peak: 800,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 800, rd: 220, vol: 0.06 },
      blitz: { rating: 800, rd: 220, vol: 0.06 },
      classical: { rating: 800, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (100–800)', fide: 800, glicko: 800, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-north-depts',
  },

  // 21. Ouzlifi Fatima Zahra — 1CP, 100-800, Brings Board: Yes, Organize: Yes
  {
    id: 'enp-fatima-ouzlifi',
    clubId: 'enp-alger',
    name: 'Ouzlifi Fatima Zahra',
    arabicName: 'أوزليفي فاطمة الزهراء',
    username: 'fatima_o',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Positional Grinder & Endgame Specialist',
    onlineEloBracket: '100-800 (absolut beginner)',
    bringsEquipment: true,
    willingToCoach: false,
    willingToOrganize: true,
    clubExpectation: 'A structured path to seriously improve my rating/ELO',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '100–800 Bracket · 1CP',
    liveStatus: 'offline',
    bio: '1CP member (100–800 bracket) who brings a physical chess set to campus events.',
    avatarInitials: 'OF',
    avatarColor: '#DB2777',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 800,
      blitz: 800,
      classical: 800,
      peak: 800,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 800, rd: 220, vol: 0.06 },
      blitz: { rating: 800, rd: 220, vol: 0.06 },
      classical: { rating: 800, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (100–800)', fide: 800, glicko: 800, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 22. Choura Salsabil — First year mining engineering, 100-800, Salsabil-ch, Coach: Yes, Organize: Yes
  {
    id: 'enp-salsabil-choura',
    clubId: 'enp-alger',
    name: 'Choura Salsabil',
    arabicName: 'شورة سلسبيل',
    username: 'salsabil',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Solid Classical Defender',
    chessComUsername: 'Salsabil-ch',
    onlineEloBracket: '100-800 (absolut beginner)',
    bringsEquipment: false,
    willingToCoach: true,
    willingToOrganize: true,
    clubExpectation: 'Regular competitive tournaments with rankings — I’d love to see this club develop seriously',
    university: 'ENP Alger',
    department: 'Génie Minier (Mining)',
    yearLevel: '1st Year Génie Minier',
    titleBadge: '100–800 Bracket · @Salsabil-ch',
    liveStatus: 'offline',
    bio: '1st Year Mining Engineering student (@Salsabil-ch on Chess.com, 100–800 bracket). Dedicated to seeing the ENP Chess Club develop seriously.',
    avatarInitials: 'CS',
    avatarColor: '#9333EA',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 800,
      blitz: 800,
      classical: 800,
      peak: 800,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 800, rd: 220, vol: 0.06 },
      blitz: { rating: 800, rd: 220, vol: 0.06 },
      classical: { rating: 800, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (100–800)', fide: 800, glicko: 800, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-north-depts',
  },

  // 23. Mahamdioua Ala Eddine — 1st year mechanical engineering, 100-800, Mrblunder_Aladdin, Organize: Yes
  {
    id: 'enp-ala-eddine',
    clubId: 'enp-alger',
    name: 'Mahamdioua Ala Eddine',
    arabicName: 'محمديوة علاء الدين',
    username: 'aladdin',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Tactical Attacker & Sacrifices',
    chessComUsername: 'Mrblunder_Aladdin',
    onlineEloBracket: '100-800 (absolut beginner)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: true,
    clubExpectation: 'Regular competitive tournaments with rankings',
    university: 'ENP Alger',
    department: 'Génie Mécanique (Mechanical)',
    yearLevel: '1st Year Génie Mécanique',
    titleBadge: '100–800 Bracket · @Mrblunder_Aladdin',
    liveStatus: 'offline',
    bio: '1st Year Mechanical Engineering student (محمديوة علاء الدين · @Mrblunder_Aladdin, 100–800 bracket).',
    avatarInitials: 'MA',
    avatarColor: '#2563EB',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 800,
      blitz: 800,
      classical: 800,
      peak: 800,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 800, rd: 220, vol: 0.06 },
      blitz: { rating: 800, rd: 220, vol: 0.06 },
      classical: { rating: 800, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (100–800)', fide: 800, glicko: 800, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-club-enprt',
  },

  // 24. Rahmoune Adam — 1 cycle preparatoire, 100-800, AdRahmoune, Organize: Yes
  {
    id: 'enp-adam-rahmoune',
    clubId: 'enp-alger',
    name: 'Rahmoune Adam',
    arabicName: 'رحمون آدم',
    username: 'ad_rahmoune',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Rising Tactical Contender',
    chessComUsername: 'AdRahmoune',
    onlineEloBracket: '100-800 (absolut beginner)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: true,
    clubExpectation: 'Regular competitive tournaments with rankings — Well organised events',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '100–800 Bracket · @AdRahmoune',
    liveStatus: 'offline',
    bio: '1CP student (@AdRahmoune, 100–800 bracket) interested in well-organized competitive tournaments at ENP.',
    avatarInitials: 'RA',
    avatarColor: '#059669',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 800,
      blitz: 800,
      classical: 800,
      peak: 800,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 800, rd: 220, vol: 0.06 },
      blitz: { rating: 800, rd: 220, vol: 0.06 },
      classical: { rating: 800, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (100–800)', fide: 800, glicko: 800, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 25. Medbal Tinhinane — 3ème génie civil, 100-800, tinamedbal
  {
    id: 'enp-tinhinane-medbal',
    clubId: 'enp-alger',
    name: 'Medbal Tinhinane',
    arabicName: 'مدبال تينهنان',
    username: 'tinamedbal',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Solid Classical Defender',
    chessComUsername: 'tinamedbal',
    onlineEloBracket: '100-800 (absolut beginner)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: false,
    clubExpectation: 'Regular competitive tournaments with rankings',
    university: 'ENP Alger',
    department: 'Génie Civil (Civil)',
    yearLevel: '3rd Year Ingénieur Génie Civil',
    titleBadge: '100–800 Bracket · @tinamedbal',
    liveStatus: 'offline',
    bio: '3rd Year Civil Engineering student (@tinamedbal, 100–800 bracket) participating in ENP chess tournaments.',
    avatarInitials: 'MT',
    avatarColor: '#4F46E5',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 800,
      blitz: 800,
      classical: 800,
      peak: 800,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 800, rd: 220, vol: 0.06 },
      blitz: { rating: 800, rd: 220, vol: 0.06 },
      classical: { rating: 800, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (100–800)', fide: 800, glicko: 800, opponent: 'Baseline', result: 'W', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-north-depts',
  },

  // 26. Seghir Soumia — 1ere Année cycle préparatoire, 100-800, sou_mia_se, Organize: Yes
  {
    id: 'enp-soumia-seghir',
    clubId: 'enp-alger',
    name: 'Seghir Soumia',
    arabicName: 'صغير سمية',
    username: 'soumia',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Rising Tactical Contender',
    chessComUsername: 'sou_mia_se',
    onlineEloBracket: '100-800 (absolut beginner)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: true,
    clubExpectation: 'A structured path to seriously improve my rating/ELO',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '100–800 Bracket · @sou_mia_se',
    liveStatus: 'offline',
    bio: '1CP student (@sou_mia_se, 100–800 bracket) following a structured Elo improvement program.',
    avatarInitials: 'SS',
    avatarColor: '#E11D48',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 800,
      blitz: 800,
      classical: 800,
      peak: 800,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 800, rd: 220, vol: 0.06 },
      blitz: { rating: 800, rd: 220, vol: 0.06 },
      classical: { rating: 800, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (100–800)', fide: 800, glicko: 800, opponent: 'Baseline', result: 'D', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

  // 27. Medjdoub Maram — 1st preparatory cycle, 100-800
  {
    id: 'enp-maram-medjdoub',
    clubId: 'enp-alger',
    name: 'Medjdoub Maram',
    arabicName: 'مجدوب مرام',
    username: 'maram',
    role: 'member',
    clubRoleDivision: 'Club Member',
    chessSpecialty: 'Positional Grinder & Endgame Specialist',
    onlineEloBracket: '100-800 (absolut beginner)',
    bringsEquipment: false,
    willingToCoach: false,
    willingToOrganize: false,
    clubExpectation: 'A chill community to play casual games between classes',
    university: 'ENP Alger',
    department: 'Classes Préparatoires (CPST — Sciences & Technologies)',
    yearLevel: '1st Year CPST (1CP)',
    titleBadge: '100–800 Bracket · 1CP',
    liveStatus: 'offline',
    bio: '1st Year Preparatory Cycle student (100–800 bracket) enjoying casual campus OTB games between classes at Amphi C and the Library.',
    avatarInitials: 'MM',
    avatarColor: '#0284C7',
    joinedDate: 'Nov 2026',
    fide: {
      rapid: 800,
      blitz: 800,
      classical: 800,
      peak: 800,
      delta30d: 0,
      gamesPlayed: 0,
    },
    glicko2: {
      rapid: { rating: 800, rd: 220, vol: 0.06 },
      blitz: { rating: 800, rd: 220, vol: 0.06 },
      classical: { rating: 800, rd: 220, vol: 0.06 },
    },
    ratingHistory: [
      { date: '2026-11', event: 'Registration Seed (100–800)', fide: 800, glicko: 800, opponent: 'Baseline', result: 'D', timeControl: 'rapid' },
    ],
    openings: [],
    freeSlots: [],
    campusMeetupZoneId: 'zone-amphi-1c',
  },

];

export const INITIAL_CLUB_POSTS: ClubPost[] = [
  {
    id: 'post-enp-roster-live',
    clubId: 'enp-alger',
    title: 'Welcome to the Official ENP Chess Club Roster (28 Registered Members!)',
    category: 'Club News',
    body: 'All 27 students who registered via the official ENP Chess Team form have been onboarded alongside Club Founder Fethallah! Starting Elo ratings are calibrated by bracket (800, 1200, and 1600) with Chess.com-style early-game placement calibration on your first matches.',
    authorName: 'Fethallah (Club Founder)',
    authorRole: 'Owner',
    createdAt: '2026-11-14',
    pinned: true,
  },
  {
    id: 'post-enp-tourney-open',
    clubId: 'enp-alger',
    title: 'Inaugural ENP Rapid & Elimination Cup — Pairings Live',
    category: 'Tournament',
    body: 'Our first official club tournament with the registered ENP roster is now open! Play your match on campus or online, click your match card in the Tournaments tab to select the winner and paste the PGN, and watch the live leaderboard update.',
    authorName: 'Fethallah (Club Founder)',
    authorRole: 'Owner',
    createdAt: '2026-11-14',
    pinned: false,
  },
];

export const INITIAL_LOGGED_GAMES: LoggedClubGame[] = [];

export const INITIAL_KNOCKOUT_MATCHES: TournamentMatch[] = [
  // Quarter-Final (4 Games with Real Registered ENP Top Seeds)
  {
    id: 'ko-qf-1',
    round: 1,
    stageLabel: 'Quarter-Final',
    bracketCode: 'QF · Game 1',
    bracketSlotIndex: 0,
    nextMatchId: 'ko-sf-1',
    nextMatchSlot: 'white',
    whiteId: 'enp-owner',
    blackId: 'enp-meriem-tarek',
    result: null,
  },
  {
    id: 'ko-qf-2',
    round: 1,
    stageLabel: 'Quarter-Final',
    bracketCode: 'QF · Game 2',
    bracketSlotIndex: 1,
    nextMatchId: 'ko-sf-1',
    nextMatchSlot: 'black',
    whiteId: 'enp-aramis-taleb',
    blackId: 'enp-mohamed-mazouzi',
    result: null,
  },
  {
    id: 'ko-qf-3',
    round: 1,
    stageLabel: 'Quarter-Final',
    bracketCode: 'QF · Game 3',
    bracketSlotIndex: 2,
    nextMatchId: 'ko-sf-2',
    nextMatchSlot: 'white',
    whiteId: 'enp-yasser-boureghda',
    blackId: 'enp-farah-daoud',
    result: null,
  },
  {
    id: 'ko-qf-4',
    round: 1,
    stageLabel: 'Quarter-Final',
    bracketCode: 'QF · Game 4',
    bracketSlotIndex: 3,
    nextMatchId: 'ko-sf-2',
    nextMatchSlot: 'black',
    whiteId: 'enp-ahmed-wadjih',
    blackId: 'enp-yanis-yessaad',
    result: null,
  },
  // Semi-Final (2 Games)
  {
    id: 'ko-sf-1',
    round: 2,
    stageLabel: 'Semi-Final',
    bracketCode: 'SF · Game 1',
    bracketSlotIndex: 0,
    nextMatchId: 'ko-final-1',
    nextMatchSlot: 'white',
    whiteId: 'TBD',
    blackId: 'TBD',
    result: null,
  },
  {
    id: 'ko-sf-2',
    round: 2,
    stageLabel: 'Semi-Final',
    bracketCode: 'SF · Game 2',
    bracketSlotIndex: 1,
    nextMatchId: 'ko-final-1',
    nextMatchSlot: 'black',
    whiteId: 'TBD',
    blackId: 'TBD',
    result: null,
  },
  // Final (1 Game)
  {
    id: 'ko-final-1',
    round: 3,
    stageLabel: 'Final',
    bracketCode: 'Final',
    bracketSlotIndex: 0,
    whiteId: 'TBD',
    blackId: 'TBD',
    result: null,
  },
];

export const INITIAL_TOURNAMENTS: ClubTournament[] = [
  {
    id: 'tourney-enp-knockout-real',
    clubId: 'enp-alger',
    name: 'ENP Inaugural 8-Player Knockout Cup (Official Roster)',
    format: 'knockout',
    timeControl: 'rapid',
    status: 'active',
    currentRound: 1,
    totalRounds: 3,
    playerIds: [
      'enp-owner',
      'enp-yasser-boureghda',
      'enp-ahmed-wadjih',
      'enp-yanis-yessaad',
      'enp-aramis-taleb',
      'enp-mohamed-mazouzi',
      'enp-farah-daoud',
      'enp-meriem-tarek',
    ],
    matches: INITIAL_KNOCKOUT_MATCHES,
    createdAt: '2026-11-14',
  },
  {
    id: 'tourney-enp-13p-real',
    clubId: 'enp-alger',
    name: 'ENP 13-Player Elimination Cup (Play-In + 8-Player Bracket)',
    format: 'knockout',
    timeControl: 'blitz',
    status: 'active',
    currentRound: 1,
    totalRounds: 4,
    playerIds: [
      'enp-owner',
      'enp-yasser-boureghda',
      'enp-ahmed-wadjih',
      'enp-yanis-yessaad',
      'enp-aramis-taleb',
      'enp-mohamed-mazouzi',
      'enp-wail-harrat',
      'enp-farah-daoud',
      'enp-meriem-tarek',
      'enp-younes-yk',
      'enp-ouassim-houari',
      'enp-yasmine-khelifi',
      'enp-romaissa-belaidouni',
    ],
    createdAt: '2026-11-14',
    matches: [
      {
        id: 'ko13-r1-seed-1',
        round: 1,
        stageLabel: 'Play-In & Seeding Round',
        bracketCode: 'Seeding · Game 1 (Both Advance)',
        bracketSlotIndex: 0,
        isDualAdvanceSeeding: true,
        nextMatchId: 'ko13-qf-2',
        nextMatchSlot: 'white',
        loserNextMatchId: 'ko13-qf-3',
        loserNextMatchSlot: 'white',
        whiteId: 'enp-yasser-boureghda',
        blackId: 'enp-ahmed-wadjih',
        result: null,
      },
      {
        id: 'ko13-r1-playin-2',
        round: 1,
        stageLabel: 'Play-In & Seeding Round',
        bracketCode: 'Play-In · Game 2',
        bracketSlotIndex: 1,
        nextMatchId: 'ko13-qf-4',
        nextMatchSlot: 'white',
        whiteId: 'enp-yanis-yessaad',
        blackId: 'enp-romaissa-belaidouni',
        result: null,
      },
      {
        id: 'ko13-r1-playin-3',
        round: 1,
        stageLabel: 'Play-In & Seeding Round',
        bracketCode: 'Play-In · Game 3',
        bracketSlotIndex: 2,
        nextMatchId: 'ko13-qf-1',
        nextMatchSlot: 'black',
        whiteId: 'enp-aramis-taleb',
        blackId: 'enp-yasmine-khelifi',
        result: null,
      },
      {
        id: 'ko13-r1-playin-4',
        round: 1,
        stageLabel: 'Play-In & Seeding Round',
        bracketCode: 'Play-In · Game 4',
        bracketSlotIndex: 3,
        nextMatchId: 'ko13-qf-2',
        nextMatchSlot: 'black',
        whiteId: 'enp-mohamed-mazouzi',
        blackId: 'enp-ouassim-houari',
        result: null,
      },
      {
        id: 'ko13-r1-playin-5',
        round: 1,
        stageLabel: 'Play-In & Seeding Round',
        bracketCode: 'Play-In · Game 5',
        bracketSlotIndex: 4,
        nextMatchId: 'ko13-qf-3',
        nextMatchSlot: 'black',
        whiteId: 'enp-wail-harrat',
        blackId: 'enp-younes-yk',
        result: null,
      },
      {
        id: 'ko13-r1-playin-6',
        round: 1,
        stageLabel: 'Play-In & Seeding Round',
        bracketCode: 'Play-In · Game 6',
        bracketSlotIndex: 5,
        nextMatchId: 'ko13-qf-4',
        nextMatchSlot: 'black',
        whiteId: 'enp-farah-daoud',
        blackId: 'enp-meriem-tarek',
        result: null,
      },
      {
        id: 'ko13-qf-1',
        round: 2,
        stageLabel: 'Quarter-Final',
        bracketCode: 'QF · Game 1',
        bracketSlotIndex: 0,
        nextMatchId: 'ko13-sf-1',
        nextMatchSlot: 'white',
        whiteId: 'enp-owner',
        blackId: 'TBD',
        result: null,
      },
      {
        id: 'ko13-qf-2',
        round: 2,
        stageLabel: 'Quarter-Final',
        bracketCode: 'QF · Game 2',
        bracketSlotIndex: 1,
        nextMatchId: 'ko13-sf-1',
        nextMatchSlot: 'black',
        whiteId: 'TBD',
        blackId: 'TBD',
        result: null,
      },
      {
        id: 'ko13-qf-3',
        round: 2,
        stageLabel: 'Quarter-Final',
        bracketCode: 'QF · Game 3',
        bracketSlotIndex: 2,
        nextMatchId: 'ko13-sf-2',
        nextMatchSlot: 'white',
        whiteId: 'TBD',
        blackId: 'TBD',
        result: null,
      },
      {
        id: 'ko13-qf-4',
        round: 2,
        stageLabel: 'Quarter-Final',
        bracketCode: 'QF · Game 4',
        bracketSlotIndex: 3,
        nextMatchId: 'ko13-sf-2',
        nextMatchSlot: 'black',
        whiteId: 'TBD',
        blackId: 'TBD',
        result: null,
      },
      {
        id: 'ko13-sf-1',
        round: 3,
        stageLabel: 'Semi-Final',
        bracketCode: 'SF · Game 1',
        bracketSlotIndex: 0,
        nextMatchId: 'ko13-final-1',
        nextMatchSlot: 'white',
        whiteId: 'TBD',
        blackId: 'TBD',
        result: null,
      },
      {
        id: 'ko13-sf-2',
        round: 3,
        stageLabel: 'Semi-Final',
        bracketCode: 'SF · Game 2',
        bracketSlotIndex: 1,
        nextMatchId: 'ko13-final-1',
        nextMatchSlot: 'black',
        whiteId: 'TBD',
        blackId: 'TBD',
        result: null,
      },
      {
        id: 'ko13-final-1',
        round: 4,
        stageLabel: 'Final',
        bracketCode: 'Final',
        bracketSlotIndex: 0,
        whiteId: 'TBD',
        blackId: 'TBD',
        result: null,
      },
    ],
  },
];

export const INITIAL_CHAT_MESSAGES: ClubChatMessage[] = [
  {
    id: 'msg-enp-1',
    clubId: 'enp-alger',
    channelId: 'team-general',
    channelType: 'team',
    senderId: 'enp-owner',
    senderName: 'Fethallah (Club Founder)',
    senderRole: 'owner',
    text: 'Welcome to all 28 founding members of the ENP Chess Club! Everyone is seeded in their declared ELO bracket. Let’s set up matches across Amphi C, the Library Courtyard, and club locals.',
    createdAt: '10:15',
  },
  {
    id: 'msg-enp-2',
    clubId: 'enp-alger',
    channelId: 'team-general',
    channelType: 'team',
    senderId: 'enp-yasser-boureghda',
    senderName: 'Boureghda Yasser',
    senderRole: 'member',
    text: 'I brought my physical board and clock to campus today! Ready for coaching reviews or 10+0 Rapid games at the Library Courtyard.',
    challengeTimeControl: 'rapid',
    challengeStakes: 'friendly',
    createdAt: '11:04',
  },
  {
    id: 'msg-enp-3',
    clubId: 'enp-alger',
    channelId: 'team-varsity',
    channelType: 'team',
    senderId: 'enp-ahmed-wadjih',
    senderName: 'Hammada Ahmed Wadjih',
    senderRole: 'member',
    text: 'Who is free at Amphi C between 1CP lectures for inter-university team prep?',
    challengeTimeControl: 'blitz',
    challengeStakes: 'competitive',
    createdAt: '11:30',
  },
];
