import React, { useState, useRef } from 'react';
import {
  CHESS_SPECIALTY_PRESETS,
  CLUB_ROLE_DIVISIONS,
  ClubMember,
  ClubRoleDivision,
  LoggedClubGame,
  MemberLiveStatus,
  OPENING_REPERTOIRE_PRESETS,
  ProfilePhotoPost,
  RIVALRY_HEADER_BANNER_4K,
} from '../utils/clubData';
import { MatchOutcome, MatchStakes, TimeControl, previewEloMatch } from '../utils/chessEngine';
import {
  Camera,
  Swords,
  Play,
  UserPlus,
  Search,
  Upload,
  Shield,
  Lock,
  CheckCircle2,
  Clock,
  X,
  ImagePlus,
  Heart,
  Trash2,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';

interface MemberProfileViewProps {
  members: ClubMember[];
  selectedMemberId: string;
  currentUser: ClubMember | null;
  onSelectMember: (id: string) => void;
  onUpdateMemberStatus: (id: string, status: MemberLiveStatus) => void;
  onUpdateMemberAvatar: (id: string, avatarUrl: string) => void;
  onUpdateMemberCoverPhoto: (id: string, coverPhotoUrl: string) => void;
  onAddMemberPhotoPost: (id: string, imageUrl: string, caption: string) => void;
  onLikeMemberPhotoPost: (memberId: string, photoId: string) => void;
  onDeleteMemberPhotoPost: (memberId: string, photoId: string) => void;
  onOpenAuthModal: () => void;
  onOpenAdminTab: () => void;
  onOpenPrivateChat?: (memberId: string) => void;
  onSubmitGame: (payload: {
    whiteId: string;
    blackId: string;
    outcome: MatchOutcome;
    timeControl: TimeControl;
    matchStakes?: MatchStakes;
    openingName: string;
    pgn: string;
  }) => void;
  loggedGames: LoggedClubGame[];
  onLoadGameInStudio: (game: LoggedClubGame) => void;
  onUpdateMemberRoleAndChessProfile?: (
    memberId: string,
    updates: {
      clubRoleDivision?: ClubRoleDivision;
      chessSpecialty?: string;
      signatureOpening?: string;
      bringsEquipment?: boolean;
    }
  ) => void;
}

const INVALID_CHESSCOM_HANDLES = new Set([
  '',
  'none',
  'na',
  'n/a',
  'منعرف',
  'idont have',
  'i dont have',
  "i don't have one",
  'no',
]);

function getChessComLinkInfo(raw?: string): { handle: string; url: string } | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  if (!cleaned || INVALID_CHESSCOM_HANDLES.has(cleaned.toLowerCase())) return null;

  // Handle full URL if someone enters one
  if (/^https?:\/\//i.test(cleaned)) {
    const match = cleaned.match(/chess\.com\/member\/([A-Za-z0-9_.-]+)/i);
    if (match?.[1]) {
      cleaned = match[1];
    } else {
      return null;
    }
  }

  // Strip annotations like "(chess.com)" or "I think its "
  cleaned = cleaned
    .replace(/\s*\(chess\.com\)\s*/gi, '')
    .replace(/^i\s+think\s+its\s+/i, '')
    .replace(/^@/, '')
    .trim();

  if (!cleaned || /\s/.test(cleaned) || INVALID_CHESSCOM_HANDLES.has(cleaned.toLowerCase())) {
    return null;
  }

  return {
    handle: cleaned,
    url: `https://www.chess.com/member/${encodeURIComponent(cleaned)}`,
  };
}

export const MemberProfileView: React.FC<MemberProfileViewProps> = ({
  members,
  selectedMemberId,
  currentUser,
  onSelectMember,
  onUpdateMemberStatus,
  onUpdateMemberAvatar,
  onUpdateMemberCoverPhoto,
  onAddMemberPhotoPost,
  onLikeMemberPhotoPost,
  onDeleteMemberPhotoPost,
  onOpenAuthModal,
  onOpenAdminTab,
  onOpenPrivateChat,
  onSubmitGame,
  loggedGames,
  onLoadGameInStudio,
  onUpdateMemberRoleAndChessProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [sortTimeControl, setSortTimeControl] = useState<TimeControl>('rapid');

  const selectedMember = members.find((m) => m.id === selectedMemberId) || members[0];
  const [rivalryOpponentId, setRivalryOpponentId] = useState<string>(
    members.find((m) => m.id !== selectedMember?.id)?.id || members[0]?.id || ''
  );

  // Upload / Share Game Modal State
  const [isUploadGameModalOpen, setIsUploadGameModalOpen] = useState(false);
  const [gameColor, setGameColor] = useState<'white' | 'black'>('white');
  const [opponentId, setOpponentId] = useState<string>(
    members.find((m) => m.id !== selectedMember?.id)?.id || members[0]?.id || ''
  );
  const [gameTimeControl, setGameTimeControl] = useState<TimeControl>('rapid');
  const [gameMatchStakes, setGameMatchStakes] = useState<MatchStakes>('friendly');
  const [gameResultOnly, setGameResultOnly] = useState<boolean>(true);
  const [gameOutcome, setGameOutcome] = useState<MatchOutcome>(1);
  const [gameOpening, setGameOpening] = useState('Campus Casual / Club Match');
  const [gamePgn, setGamePgn] = useState(
    '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6'
  );
  const [uploadSuccessBanner, setUploadSuccessBanner] = useState('');

  // Facebook-Style Profile Photo Wall State
  const [isAddPhotoModalOpen, setIsAddPhotoModalOpen] = useState(false);
  const [newPhotoPreviewUrl, setNewPhotoPreviewUrl] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<ProfilePhotoPost | null>(null);

  const avatarUploadRef = useRef<HTMLInputElement>(null);
  const coverUploadRef = useRef<HTMLInputElement>(null);
  const galleryPhotoUploadRef = useRef<HTMLInputElement>(null);

  if (!selectedMember) {
    return (
      <div className="broadcast-panel p-8 rounded-2xl text-center text-slate-300">
        No members registered in this club yet.
      </div>
    );
  }

  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';
  const canEditSelectedProfile =
    isAdminOrOwner || (currentUser !== null && currentUser.id === selectedMember.id);

  const rivalryOpponent =
    members.find((m) => m.id === rivalryOpponentId && m.id !== selectedMember.id) ||
    members.find((m) => m.id !== selectedMember.id) ||
    selectedMember;

  const filteredMembers = members
    .filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesQ =
        m.name.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        (m.clubRoleDivision || '').toLowerCase().includes(q) ||
        (m.chessSpecialty || '').toLowerCase().includes(q) ||
        (m.signatureOpening || '').toLowerCase().includes(q) ||
        (m.chessComUsername || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || m.liveStatus === statusFilter;
      const matchesRole =
        roleFilter === 'ALL'
          ? true
          : roleFilter === 'EQUIPMENT'
          ? Boolean(m.bringsEquipment)
          : roleFilter === 'COACHES'
          ? Boolean(m.willingToCoach)
          : (m.clubRoleDivision || 'Club Member') === roleFilter;
      return matchesQ && matchesStatus && matchesRole;
    })
    .sort((a, b) => b.fide[sortTimeControl] - a.fide[sortTimeControl]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditSelectedProfile) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateMemberAvatar(selectedMember.id, reader.result);
        setUploadSuccessBanner(`Updated ${selectedMember.name}'s profile picture!`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditSelectedProfile) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateMemberCoverPhoto(selectedMember.id, reader.result);
        setUploadSuccessBanner(`Updated ${selectedMember.name}'s cover photo banner!`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGalleryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewPhotoPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePhotoPostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSelectedProfile || !newPhotoPreviewUrl) return;
    onAddMemberPhotoPost(
      selectedMember.id,
      newPhotoPreviewUrl,
      newPhotoCaption.trim() || `${selectedMember.name} at ${selectedMember.university}`
    );
    setNewPhotoPreviewUrl('');
    setNewPhotoCaption('');
    setIsAddPhotoModalOpen(false);
    setUploadSuccessBanner(`Posted new photo to ${selectedMember.name}'s profile wall!`);
  };

  const handleOpenUploadModal = () => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    const defaultOpp =
      members.find((m) => m.id !== selectedMember.id)?.id || members[0]?.id || '';
    setOpponentId(defaultOpp);
    setIsUploadGameModalOpen(true);
  };

  const handleUploadGameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const whiteId = gameColor === 'white' ? selectedMember.id : opponentId;
    const blackId = gameColor === 'white' ? opponentId : selectedMember.id;
    if (!whiteId || !blackId || whiteId === blackId) return;

    onSubmitGame({
      whiteId,
      blackId,
      outcome: gameOutcome,
      timeControl: gameTimeControl,
      matchStakes: gameMatchStakes,
      openingName:
        gameOpening.trim() ||
        (gameMatchStakes === 'friendly'
          ? 'Friendly Campus Match (No PGN)'
          : 'Competitive Club Match'),
      pgn: gameResultOnly ? '' : gamePgn.trim(),
    });

    setIsUploadGameModalOpen(false);
    setUploadSuccessBanner(
      isAdminOrOwner
        ? `Recorded ${gameMatchStakes.toUpperCase()} match (${gameResultOnly ? 'Result Only' : 'With PGN'}) and updated ${gameTimeControl.toUpperCase()} Elo!`
        : `Submitted ${gameMatchStakes.toUpperCase()} match (${gameResultOnly ? 'Result Only' : 'With PGN'})! Once approved by an Admin, both players' Elo will update.`
    );
  };

  const history = selectedMember.ratingHistory;
  const ratingsInHistory = history.map((h) => h.fide);
  const rawMin = ratingsInHistory.length ? Math.min(...ratingsInHistory, selectedMember.fide.rapid) : 400;
  const rawMax = ratingsInHistory.length ? Math.max(...ratingsInHistory, selectedMember.fide.rapid) : 1800;
  const minR = Math.max(100, Math.floor((rawMin - 150) / 100) * 100);
  const maxR = Math.max(minR + 400, Math.ceil((rawMax + 150) / 100) * 100);
  const chartTicks = [
    minR,
    Math.round(minR + (maxR - minR) * 0.33),
    Math.round(minR + (maxR - minR) * 0.66),
    maxR,
  ];
  const chartW = 560;
  const chartH = 170;

  const mapPoint = (idx: number, val: number) => {
    const x =
      history.length <= 1 ? chartW / 2 : 36 + (idx / (history.length - 1)) * (chartW - 72);
    const clamped = Math.max(minR, Math.min(maxR, val));
    const y = chartH - 26 - ((clamped - minR) / (maxR - minR)) * (chartH - 52);
    return { x, y };
  };

  const eloPoints = history.map((h, i) => mapPoint(i, h.fide));
  const eloPolyline = eloPoints.map((p) => `${p.x},${p.y}`).join(' ');

  const memberGames = loggedGames.filter(
    (g) => g.whiteId === selectedMember.id || g.blackId === selectedMember.id
  );

  const renderStatusText = (status: MemberLiveStatus) => {
    if (status === 'campus_otb') return 'On Campus OTB (Foyer / Library)';
    if (status === 'online_ready') return 'Online Ready for Challenge';
    return 'In Lecture / Engineering Lab';
  };

  const renderRoleBadge = (role: ClubMember['role']) => {
    if (role === 'owner') {
      return (
        <span className="px-2 py-0.5 rounded-md bg-[#FF6B00]/20 border border-[#FF6B00]/50 text-[#FF6B00] font-mono-tabular text-[10px] font-bold uppercase">
          OWNER
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="px-2 py-0.5 rounded-md bg-[#26E6DE]/15 border border-[#26E6DE]/40 text-[#26E6DE] font-mono-tabular text-[10px] font-bold uppercase">
          ADMIN
        </span>
      );
    }
    return null;
  };

  const renderDivisionBadge = (m: ClubMember) => {
    const divInfo =
      CLUB_ROLE_DIVISIONS.find((d) => d.id === m.clubRoleDivision) ||
      CLUB_ROLE_DIVISIONS[CLUB_ROLE_DIVISIONS.length - 1];
    return (
      <span
        className={`px-2 py-0.5 rounded-md border font-mono-tabular text-[10px] font-bold uppercase ${divInfo.badgeClass}`}
      >
        {divInfo.shortTag}
      </span>
    );
  };

  // Preview Elo for the upload modal
  const modalWhite =
    gameColor === 'white'
      ? selectedMember
      : members.find((m) => m.id === opponentId) || selectedMember;
  const modalBlack =
    gameColor === 'black'
      ? selectedMember
      : members.find((m) => m.id === opponentId) || selectedMember;
  const modalEloPreview = previewEloMatch(
    modalWhite.fide[gameTimeControl],
    modalBlack.fide[gameTimeControl],
    gameOutcome,
    modalWhite.fide.gamesPlayed,
    modalBlack.fide.gamesPlayed,
    gameMatchStakes
  );

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span className="text-xs font-mono-tabular text-[#26E6DE] tracking-wider uppercase">
            CLUB ROSTER & UNIFIED ELO RATINGS · RAPID · BLITZ · CLASSICAL (BY DECLARED BRACKET)
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Club Members, Profiles & Game Archives
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#08172E] rounded-xl border border-white/10">
            {(['rapid', 'blitz', 'classical'] as const).map((tc) => (
              <button
                key={tc}
                type="button"
                onClick={() => setSortTimeControl(tc)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer uppercase font-mono-tabular ${
                  sortTimeControl === tc
                    ? 'bg-[#FF6B00] text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sort: {tc}
              </button>
            ))}
          </div>

          {isAdminOrOwner ? (
            <button
              type="button"
              onClick={onOpenAdminTab}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold bg-[#1E56A0] hover:bg-[#2563EB] text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#26E6DE]" />
              Manage Accounts & Passwords in Admin Tab
            </button>
          ) : !currentUser ? (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold bg-[#FF6B00] hover:bg-[#FF8533] text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              Sign In to Edit Your Profile
            </button>
          ) : null}
        </div>
      </div>

      {uploadSuccessBanner && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-xs sm:text-sm text-emerald-200 font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{uploadSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadSuccessBanner('')}
            className="text-xs underline text-emerald-300 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* DIRECTORY FILTER BAR & LEADERBOARD */}
      <div className="broadcast-panel rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member by name, role (IT, COMM, Coaching), opening, or department..."
              aria-label="Search club members"
              className="w-full min-h-[42px] pl-9 pr-4 py-2 text-sm rounded-xl border border-white/15 bg-[#061020]/80 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#26E6DE]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by club role division"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-[#26E6DE]/40 bg-[#061020] text-[#26E6DE]"
            >
              <option value="ALL">All Club Roles ({members.length})</option>
              {CLUB_ROLE_DIVISIONS.map((div) => (
                <option key={div.id} value={div.id}>
                  Role: {div.id}
                </option>
              ))}
              <option value="EQUIPMENT">♟️ Owns Physical Board / Clock</option>
              <option value="COACHES">🎓 Open to Coaching / Workshops</option>
            </select>

            <select
              aria-label="Filter by live campus status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[42px] px-3 py-2 text-xs font-medium rounded-xl border border-white/15 bg-[#061020] text-slate-200"
            >
              <option value="ALL">All Campus Statuses</option>
              <option value="campus_otb">On Campus OTB</option>
              <option value="online_ready">Online Ready</option>
              <option value="in_lecture">In Lecture</option>
            </select>
          </div>
        </div>

        {/* MOBILE PHONE TAP-CARD ROSTER (< 768px) */}
        <div className="md:hidden divide-y divide-white/10 max-h-[340px] overflow-y-auto">
          {filteredMembers.map((m, idx) => {
            const isSelected = m.id === selectedMember.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMember(m.id)}
                className={`w-full p-3.5 text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected ? 'bg-[#1E56A0]/35' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono-tabular text-xs font-bold text-slate-400 w-5 shrink-0">
                    #{idx + 1}
                  </span>
                  {m.avatarUrl ? (
                    <img
                      src={m.avatarUrl}
                      alt={m.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ backgroundColor: m.avatarColor }}
                    >
                      {m.avatarInitials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                      <span className="truncate">{m.name}</span>
                      {renderRoleBadge(m.role)}
                    </div>
                    <div className="text-[11px] text-[#26E6DE] truncate">{m.department}</div>
                    {(() => {
                      const cc = getChessComLinkInfo(m.chessComUsername);
                      if (!cc) return null;
                      return (
                        <a
                          href={cc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-mono-tabular text-[#26E6DE] hover:text-white underline decoration-[#26E6DE]/40 mt-0.5"
                        >
                          <span>chess.com/member/{cc.handle}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      );
                    })()}
                    <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
                      Rapid {m.fide.rapid} · Blitz {m.fide.blitz} · Classic {m.fide.classical}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono-tabular shrink-0">
                  <div className="text-base font-extrabold text-[#FF6B00]">
                    {m.fide[sortTimeControl]}
                  </div>
                  <div className="text-[10px] uppercase text-slate-400">{sortTimeControl} Elo</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* DESKTOP TABLE (>= 768px) */}
        <div className="hidden md:block overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#061020]/70 text-[11px] font-mono-tabular uppercase text-slate-400">
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Member & Department</th>
                <th className="py-3 px-4">Club Role, Specialty & Openings</th>
                <th className="py-3 px-4 text-right">Rapid Elo</th>
                <th className="py-3 px-4 text-right">Blitz Elo</th>
                <th className="py-3 px-4 text-right">Classical</th>
                <th className="py-3 px-4">Live Status</th>
                <th className="py-3 px-4 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8 text-sm">
              {filteredMembers.map((m, idx) => {
                const isSelected = m.id === selectedMember.id;
                return (
                  <tr
                    key={m.id}
                    onClick={() => onSelectMember(m.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#1E56A0]/30' : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono-tabular font-bold text-slate-400">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {m.avatarUrl ? (
                          <img
                            src={m.avatarUrl}
                            alt={m.name}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                            style={{ backgroundColor: m.avatarColor }}
                          >
                            {m.avatarInitials}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white flex flex-wrap items-center gap-1.5">
                            <span>{m.name}</span>
                            {renderRoleBadge(m.role)}
                            {m.isDesignatedSuccessor && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/50 text-amber-300 font-mono-tabular text-[10px] font-bold">
                                👑 NEXT-GEN HEIR
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {m.department} · {m.yearLevel}
                          </div>
                          {(() => {
                            const cc = getChessComLinkInfo(m.chessComUsername);
                            if (!cc) return null;
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] font-mono-tabular">
                                <a
                                  href={cc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[#26E6DE] hover:text-white underline decoration-[#26E6DE]/40"
                                >
                                  <span>chess.com/member/{cc.handle}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                                {m.onlineEloBracket && (
                                  <span className="text-slate-400">({m.onlineEloBracket})</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {renderDivisionBadge(m)}
                          {m.bringsEquipment && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[10px] font-mono-tabular font-semibold">
                              ♟️ Has Board/Clock
                            </span>
                          )}
                        </div>
                        {m.chessSpecialty && (
                          <div className="text-xs font-semibold text-slate-200">
                            {m.chessSpecialty}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 truncate max-w-[240px]">
                          Top Opening:{' '}
                          <span
                            className={
                              m.openings[0]?.name || m.signatureOpening
                                ? 'text-[#FF6B00] font-semibold'
                                : 'text-slate-500 italic'
                            }
                          >
                            {m.openings[0]?.name ||
                              m.signatureOpening ||
                              'Pending — Upload games'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular">
                      <span
                        className={`font-bold ${
                          sortTimeControl === 'rapid' ? 'text-[#FF6B00] text-base' : 'text-white'
                        }`}
                      >
                        {m.fide.rapid}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular">
                      <span
                        className={`font-bold ${
                          sortTimeControl === 'blitz' ? 'text-[#FF6B00] text-base' : 'text-[#26E6DE]'
                        }`}
                      >
                        {m.fide.blitz}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular">
                      <span
                        className={`font-bold ${
                          sortTimeControl === 'classical'
                            ? 'text-[#FF6B00] text-base'
                            : 'text-slate-200'
                        }`}
                      >
                        {m.fide.classical}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">
                      {m.liveStatus === 'campus_otb'
                        ? 'On Campus OTB'
                        : m.liveStatus === 'online_ready'
                        ? 'Online Ready'
                        : 'In Lecture'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMember(m.id);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-[#FF6B00] text-white'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20'
                        }`}
                      >
                        {isSelected ? 'Viewing' : 'View Profile'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SELECTED PLAYER DOSSIER (FACEBOOK-STYLE COVER PHOTO + PROFILE AVATAR + PHOTO WALL) */}
      <div className="broadcast-panel rounded-2xl overflow-hidden">
        {/* Facebook-Style 16:9 Cover Photo Banner */}
        <div className="relative h-44 sm:h-60 w-full overflow-hidden bg-[#082556] border-b border-white/10">
          <img
            src={
              selectedMember.coverPhotoUrl ||
              '/src/assets/images/enp_twilight_facade_banner_1794646311361.jpg'
            }
            alt={`${selectedMember.name} Cover Banner`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#061020] via-[#061020]/30 to-transparent pointer-events-none" />

          {canEditSelectedProfile && (
            <>
              <input
                id="profile-cover-upload-input"
                ref={coverUploadRef}
                type="file"
                accept="image/*"
                onChange={handleCoverPhotoChange}
                className="sr-only"
                aria-label="Upload profile cover photo"
              />
              <label
                htmlFor="profile-cover-upload-input"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    coverUploadRef.current?.click();
                  }
                }}
                className="absolute top-3 right-3 sm:top-4 sm:right-5 z-30 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#061020]/90 hover:bg-[#0B1C38] text-white border border-white/25 backdrop-blur-md text-xs font-bold inline-flex items-center gap-2 shadow-xl cursor-pointer select-none transition-colors"
              >
                <Camera className="w-4 h-4 text-[#FF6B00]" />
                <span>Edit Cover Photo</span>
              </label>
            </>
          )}
        </div>

        {/* Profile Identity Bar (Overlapping Avatar like Facebook) */}
        <div className="px-4 sm:px-8 pb-6 pt-3 cad-grid-dark border-b border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 -mt-12 sm:-mt-16 relative z-10 pointer-events-none">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-5 pointer-events-auto">
              <div className="relative group shrink-0">
                {selectedMember.avatarUrl ? (
                  <img
                    src={selectedMember.avatarUrl}
                    alt={selectedMember.name}
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-cover border-4 border-[#061020] ring-2 ring-[#FF6B00] shadow-2xl bg-[#061020]"
                  />
                ) : (
                  <div
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl font-extrabold text-white border-4 border-[#061020] ring-2 ring-white/25 shadow-2xl"
                    style={{ backgroundColor: selectedMember.avatarColor }}
                  >
                    {selectedMember.avatarInitials}
                  </div>
                )}

                {canEditSelectedProfile && (
                  <>
                    <input
                      ref={avatarUploadRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      aria-label="Upload member profile photo"
                    />
                    <button
                      type="button"
                      onClick={() => avatarUploadRef.current?.click()}
                      title="Update profile picture"
                      className="absolute -bottom-2 -right-2 z-20 p-2.5 rounded-xl bg-[#FF6B00] text-white hover:bg-[#FF8533] shadow-lg transition-colors cursor-pointer border-2 border-[#061020]"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-[#26E6DE]">
                  <span>{selectedMember.university}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedMember.titleBadge}</span>
                  <span aria-hidden="true">·</span>
                  <span>@{selectedMember.username}</span>
                  {renderRoleBadge(selectedMember.role)}
                  {renderDivisionBadge(selectedMember)}
                  {selectedMember.isDesignatedSuccessor && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/25 border border-amber-400/50 text-amber-300 font-mono-tabular text-[10px] font-bold uppercase">
                      👑 Designated Next-Gen Heir
                    </span>
                  )}
                  {selectedMember.bringsEquipment && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono-tabular text-[10px] font-bold uppercase">
                      ♟️ Brings OTB Board/Clock
                    </span>
                  )}
                </div>

                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex flex-wrap items-baseline gap-2.5">
                  <span>{selectedMember.name}</span>
                  <span className="text-base font-normal text-slate-300">
                    ({selectedMember.arabicName})
                  </span>
                </h3>

                <div className="text-xs sm:text-sm text-slate-300 flex flex-wrap items-center gap-2">
                  <span>
                    {selectedMember.department} · {selectedMember.yearLevel}
                  </span>
                  {(() => {
                    const cc = getChessComLinkInfo(selectedMember.chessComUsername);
                    if (!cc) return null;
                    return (
                      <a
                        href={cc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#26E6DE]/15 hover:bg-[#26E6DE]/25 border border-[#26E6DE]/40 font-mono-tabular text-xs font-bold text-[#26E6DE] transition-colors"
                      >
                        <span>Chess.com: @{cc.handle}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    );
                  })()}
                  {selectedMember.onlineEloBracket && (
                    <span className="px-2 py-0.5 rounded bg-[#FF6B00]/15 font-mono-tabular text-xs text-[#FF6B00]">
                      Form Rating: {selectedMember.onlineEloBracket}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-[#061020]/90 border border-white/15 text-slate-200">
                    <strong className="text-[#26E6DE]">Club Role:</strong>{' '}
                    {selectedMember.clubRoleDivision || 'Club Member'}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#061020]/90 border border-white/15 text-slate-200">
                    <strong className="text-[#FF6B00]">Specialty:</strong>{' '}
                    {selectedMember.chessSpecialty || 'Tactical & Rapid Player'}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#061020]/90 border border-white/15 text-slate-200">
                    <strong className="text-emerald-400">Most Played Opening:</strong>{' '}
                    {selectedMember.openings[0]?.name ||
                      selectedMember.signatureOpening ||
                      'Pending — Determined after playing & uploading PGN games'}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-200 max-w-2xl pt-1 leading-relaxed">
                  {selectedMember.bio}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-3 shrink-0 pointer-events-auto">
              <div className="flex flex-col sm:items-end gap-1.5">
                <span className="text-[11px] font-mono-tabular uppercase tracking-wider text-slate-300">
                  Live Campus Availability Status
                </span>
                {canEditSelectedProfile ? (
                  <div className="flex flex-wrap items-center gap-1.5 bg-[#061020] p-1.5 rounded-xl border border-white/15">
                    {(
                      [
                        { id: 'campus_otb', label: 'On Campus OTB' },
                        { id: 'online_ready', label: 'Online Ready' },
                        { id: 'in_lecture', label: 'In Lecture' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onUpdateMemberStatus(selectedMember.id, st.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          selectedMember.liveStatus === st.id
                            ? 'bg-[#FF6B00] text-white'
                            : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3.5 py-2 rounded-xl bg-[#061020]/90 border border-white/15 text-xs font-semibold text-[#26E6DE] flex items-center gap-2">
                    <span>{renderStatusText(selectedMember.liveStatus)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canEditSelectedProfile && (
                  <button
                    type="button"
                    onClick={() => setIsAddPhotoModalOpen(true)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1E56A0] hover:bg-[#2563EB] text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4 text-[#26E6DE]" />
                    + Add Photo to Profile
                  </button>
                )}

                {onOpenPrivateChat && currentUser?.id !== selectedMember.id && (
                  <button
                    type="button"
                    onClick={() => onOpenPrivateChat(selectedMember.id)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-[#26E6DE]/40 text-[#26E6DE] text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Message / Challenge
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleOpenUploadModal}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  {isAdminOrOwner
                    ? `Record Match / Upload for ${selectedMember.name.split(' ')[0]}`
                    : 'Record Match (Result Only or PGN)'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* UNIFIED ELO CARDS (RAPID, BLITZ, CLASSICAL) + ROLE/OPENING EDITOR + PHOTO WALL + TRAJECTORY & ARCHIVE */}
        <div className="p-4 sm:p-8 space-y-8">
          {/* Interactive Role (IT / COMM / Coaching / Events), Specialty & Opening Editor */}
          {canEditSelectedProfile && onUpdateMemberRoleAndChessProfile && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#061020]/90 border border-[#26E6DE]/35 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-mono-tabular uppercase text-[#26E6DE] font-bold">
                    CLUB ROLE (IT / COMM / COACHING / EVENTS), CHESS SPECIALTY & OPENINGS
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    Customize {selectedMember.name}’s Club Role, Specialty & Openings Played
                  </h4>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedMember.bringsEquipment)}
                    onChange={(e) =>
                      onUpdateMemberRoleAndChessProfile(selectedMember.id, {
                        bringsEquipment: e.target.checked,
                      })
                    }
                    className="rounded accent-emerald-500"
                  />
                  ♟️ Owns & Brings Physical Board / Clock to Campus
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Club Organizational Role (IT, COMM, etc.)
                  </label>
                  <select
                    aria-label="Member club organizational role"
                    value={selectedMember.clubRoleDivision || 'Club Member'}
                    onChange={(e) =>
                      onUpdateMemberRoleAndChessProfile(selectedMember.id, {
                        clubRoleDivision: e.target.value as ClubRoleDivision,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-white/15 bg-[#040B16] text-xs font-bold text-white"
                  >
                    {CLUB_ROLE_DIVISIONS.map((div) => (
                      <option key={div.id} value={div.id}>
                        {div.id} ({div.shortTag})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Player Chess Specialty / Style
                  </label>
                  <input
                    type="text"
                    list="chess-specialty-presets-profile"
                    value={selectedMember.chessSpecialty || ''}
                    onChange={(e) =>
                      onUpdateMemberRoleAndChessProfile(selectedMember.id, {
                        chessSpecialty: e.target.value,
                      })
                    }
                    placeholder="e.g., Tactical Attacker, Endgame Specialist..."
                    className="w-full px-3 py-2 rounded-xl border border-white/15 bg-[#040B16] text-xs text-white"
                  />
                  <datalist id="chess-specialty-presets-profile">
                    {CHESS_SPECIALTY_PRESETS.map((sp) => (
                      <option key={sp} value={sp} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Favorite Openings Played (White & Black)
                  </label>
                  <input
                    type="text"
                    list="opening-repertoire-presets-profile"
                    value={selectedMember.signatureOpening || ''}
                    onChange={(e) =>
                      onUpdateMemberRoleAndChessProfile(selectedMember.id, {
                        signatureOpening: e.target.value,
                      })
                    }
                    placeholder="e.g., Sicilian Najdorf (B90) & Italian Game (C50)"
                    className="w-full px-3 py-2 rounded-xl border border-white/15 bg-[#040B16] text-xs text-white"
                  />
                  <datalist id="opening-repertoire-presets-profile">
                    {OPENING_REPERTOIRE_PRESETS.map((op) => (
                      <option key={op} value={op} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#061020]/80 border border-[#FF6B00]/40 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono-tabular text-slate-400">
                <span>RAPID ELO (10+0 / 15+10)</span>
                <Clock className="w-4 h-4 text-[#FF6B00]" />
              </div>
              <div className="text-3xl font-extrabold font-mono-tabular text-white">
                {selectedMember.fide.rapid}
              </div>
              <div className="text-xs font-mono-tabular text-emerald-400">
                30d Delta: {selectedMember.fide.delta30d >= 0 ? '+' : ''}
                {selectedMember.fide.delta30d} Elo · Peak {selectedMember.fide.peak}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#061020]/80 border border-[#26E6DE]/35 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono-tabular text-slate-400">
                <span>BLITZ ELO (3+2 / 5+0)</span>
                <Clock className="w-4 h-4 text-[#26E6DE]" />
              </div>
              <div className="text-3xl font-extrabold font-mono-tabular text-[#26E6DE]">
                {selectedMember.fide.blitz}
              </div>
              <div className="text-xs font-mono-tabular text-slate-400">
                Official Club Blitz Rating
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#061020]/80 border border-white/15 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono-tabular text-slate-400">
                <span>CLASSICAL ELO (OTB 60m+)</span>
                <Shield className="w-4 h-4 text-slate-300" />
              </div>
              <div className="text-3xl font-extrabold font-mono-tabular text-white">
                {selectedMember.fide.classical}
              </div>
              <div className="text-xs font-mono-tabular text-slate-400">
                {selectedMember.fide.gamesPlayed} Total Rated Games
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ELO PROGRESSION CHART */}
            <div className="lg:col-span-7 p-5 rounded-2xl bg-[#061020]/70 border border-white/10 flex flex-col justify-between space-y-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <span className="text-xs font-mono-tabular text-slate-400 uppercase">
                      ELO PROGRESSION TRACKER
                    </span>
                    <h4 className="text-base font-bold text-white">
                      Official Club Elo Trajectory
                    </h4>
                  </div>
                  <span className="text-xs font-mono-tabular text-[#FF6B00] font-semibold">
                    — Unified Club Elo
                  </span>
                </div>

                <div className="w-full bg-[#040B16]/90 rounded-xl p-3 border border-white/10">
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-40 overflow-visible">
                    {chartTicks.map((lvl, tickIdx) => {
                      const y = chartH - 26 - ((lvl - minR) / (maxR - minR)) * (chartH - 52);
                      return (
                        <g key={`${lvl}-${tickIdx}`}>
                          <line
                            x1={32}
                            y1={y}
                            x2={chartW - 20}
                            y2={y}
                            stroke={tickIdx === 1 ? '#FF6B00' : 'rgba(255,255,255,0.12)'}
                            strokeDasharray={tickIdx === 1 ? '4 4' : '2 4'}
                            strokeWidth={tickIdx === 1 ? '1.2' : '0.8'}
                          />
                          <text
                            x={4}
                            y={y + 3}
                            className="text-[9px] fill-slate-400 font-mono-tabular"
                          >
                            {lvl}
                          </text>
                        </g>
                      );
                    })}

                    {eloPoints.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#FF6B00"
                        strokeWidth="3"
                        points={eloPolyline}
                      />
                    )}

                    {eloPoints.map((pt, idx) => {
                      const item = history[idx];
                      return (
                        <g key={idx}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="4.5"
                            fill="#FF6B00"
                            stroke="#061020"
                            strokeWidth="1.5"
                          >
                            <title>{`${item.date} · ${item.event}: ${item.fide} Elo`}</title>
                          </circle>
                          <text
                            x={pt.x}
                            y={pt.y - 8}
                            textAnchor="middle"
                            className="text-[9px] font-mono-tabular font-bold fill-white"
                          >
                            {item.fide}
                          </text>
                          <text
                            x={pt.x}
                            y={chartH - 6}
                            textAnchor="middle"
                            className="text-[9px] font-mono-tabular fill-slate-400"
                          >
                            {item.date}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* HEAD-TO-HEAD RIVALRY COMPARATOR (KASPAROV VS. KARPOV 1985 BANNER) */}
              <div className="pt-2 border-t border-white/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Swords className="w-4 h-4 text-[#FF6B00]" />
                    Head-to-Head Rivalry Comparator (Kasparov vs. Karpov 1985 Edition)
                  </h4>

                  <select
                    aria-label="Select comparison opponent"
                    value={rivalryOpponent.id}
                    onChange={(e) => setRivalryOpponentId(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-white/15 bg-[#040B16] text-xs font-semibold text-white"
                  >
                    {members
                      .filter((m) => m.id !== selectedMember.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          vs. {m.name} (Rapid {m.fide.rapid})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-[#26E6DE]/30 shadow-xl min-h-[126px] flex items-center">
                  <img
                    src={RIVALRY_HEADER_BANNER_4K}
                    alt="Garry Kasparov vs. Anatoly Karpov 1985 Rivalry Header"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover object-center opacity-75 pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#061020]/85 via-[#061020]/70 to-[#061020]/85 pointer-events-none" />

                  <div className="relative z-10 w-full grid grid-cols-3 items-center p-4 text-center font-mono-tabular">
                    <div>
                      <div className="text-xs font-sans font-extrabold text-white truncate drop-shadow">
                        {selectedMember.name}
                      </div>
                      <div className="text-xl font-extrabold text-[#26E6DE] mt-0.5 drop-shadow">
                        {selectedMember.fide.rapid}
                      </div>
                      <div className="text-[10px] text-slate-200">
                        Blitz {selectedMember.fide.blitz} · Cls {selectedMember.fide.classical}
                      </div>
                    </div>

                    <div className="border-x border-white/20 px-2 bg-[#040B16]/75 py-2 rounded-xl backdrop-blur-sm">
                      <div className="text-[10px] uppercase text-[#FF6B00] font-bold">
                        HEAD-TO-HEAD DIFF
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                        {selectedMember.fide.rapid - rivalryOpponent.fide.rapid >= 0 ? '+' : ''}
                        {selectedMember.fide.rapid - rivalryOpponent.fide.rapid} Elo
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-sans font-extrabold text-white truncate drop-shadow">
                        {rivalryOpponent.name}
                      </div>
                      <div className="text-xl font-extrabold text-[#FF6B00] mt-0.5 drop-shadow">
                        {rivalryOpponent.fide.rapid}
                      </div>
                      <div className="text-[10px] text-slate-200">
                        Blitz {rivalryOpponent.fide.blitz} · Cls {rivalryOpponent.fide.classical}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PLAYER GAME ARCHIVE & PGN DATABASE */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-[#061020]/70 border border-white/10 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
                      PLAYER PGN ARCHIVE
                    </span>
                    <h4 className="text-base font-bold text-white">
                      Saved Games ({memberGames.length})
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenUploadModal}
                    className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    + Add Game
                  </button>
                </div>

                {memberGames.length === 0 ? (
                  <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      No games recorded for {selectedMember.name} yet.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenUploadModal}
                      className="px-3.5 py-1.5 rounded-lg bg-[#1E56A0] text-white text-xs font-bold cursor-pointer"
                    >
                      Upload First PGN Game
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {memberGames.map((g) => (
                      <div
                        key={g.id}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 hover:border-[#26E6DE]/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">{g.title}</span>
                            {g.status === 'pending' && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono-tabular text-[10px] font-bold shrink-0">
                                Pending Approval
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
                            {g.timeControl.toUpperCase()} · Result: {g.result} · {g.openingName}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onLoadGameInStudio(g)}
                          className="px-3 py-1.5 rounded-lg bg-[#1E56A0] hover:bg-[#FF6B00] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          Replay
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Opening Repertoire Summary (Determined dynamically from played & uploaded games) */}
              <div className="space-y-2 pt-3 border-t border-white/10">
                <div className="text-xs font-mono-tabular uppercase text-slate-400">
                  Most Played Openings (Auto-Detected from Uploaded Games)
                </div>
                {selectedMember.openings.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-[#040B16]/70 border border-white/10 text-xs text-slate-400 leading-relaxed">
                    No openings recorded yet. Play club or tournament matches and upload PGNs to automatically determine {selectedMember.name.split(' ')[0]}’s most-played openings.
                  </div>
                ) : (
                  selectedMember.openings.map((op) => {
                    const total = op.wins + op.draws + op.losses || 1;
                    const wPct = Math.round((op.wins / total) * 100);
                    const dPct = Math.round((op.draws / total) * 100);
                    const lPct = Math.max(0, 100 - wPct - dPct);
                    return (
                      <div key={`${op.name}-${op.color}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="font-semibold text-white truncate">
                            [{op.eco}] {op.name} ({op.color})
                          </span>
                          <span className="font-mono-tabular text-slate-300 shrink-0">
                            +{op.wins} ={op.draws} -{op.losses}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-white/10">
                          <div style={{ width: `${wPct}%` }} className="bg-emerald-500" />
                          <div style={{ width: `${dPct}%` }} className="bg-slate-400" />
                          <div style={{ width: `${lPct}%` }} className="bg-rose-500" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* FACEBOOK-STYLE PLAYER PHOTO WALL & CAMPUS MOMENTS GALLERY */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#061020]/75 border border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
                  PLAYER PHOTO WALL & CAMPUS TOURNAMENT MOMENTS
                </span>
                <h4 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  {selectedMember.name}’s Photos & Moments ({selectedMember.profilePhotos?.length || 0})
                </h4>
              </div>

              {canEditSelectedProfile && (
                <button
                  type="button"
                  onClick={() => setIsAddPhotoModalOpen(true)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  + Upload Photo to Profile
                </button>
              )}
            </div>

            {!selectedMember.profilePhotos || selectedMember.profilePhotos.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3">
                <Camera className="w-8 h-8 text-[#26E6DE] mx-auto" />
                <div className="text-sm font-bold text-white">
                  No Photos Posted on {selectedMember.name.split(' ')[0]}’s Profile Yet
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {canEditSelectedProfile
                    ? 'Share tournament photos, OTB games in the Foyer, or trophy moments on your profile wall just like Facebook.'
                    : `${selectedMember.name} hasn't posted any profile photos yet.`}
                </p>
                {canEditSelectedProfile && (
                  <button
                    type="button"
                    onClick={() => setIsAddPhotoModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#1E56A0] hover:bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
                  >
                    + Post First Profile Photo
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedMember.profilePhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group rounded-2xl overflow-hidden bg-[#040B16] border border-white/15 flex flex-col justify-between shadow-lg hover:border-[#26E6DE]/50 transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxPhoto(photo)}
                      className="relative h-48 w-full overflow-hidden bg-[#08172E] cursor-pointer text-left"
                    >
                      <img
                        src={photo.imageUrl}
                        alt={photo.caption}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#040B16] via-transparent to-transparent opacity-75" />
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-mono-tabular text-slate-200">
                        {photo.date}
                      </span>
                    </button>

                    <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                      <p className="text-xs text-slate-200 leading-relaxed line-clamp-2">
                        {photo.caption}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => onLikeMemberPhotoPost(selectedMember.id, photo.id)}
                          className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-rose-500/20 text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                          <span className="font-mono-tabular">{photo.likes}</span>
                          <span>Like</span>
                        </button>

                        {canEditSelectedProfile && (
                          <button
                            type="button"
                            onClick={() => onDeleteMemberPhotoPost(selectedMember.id, photo.id)}
                            title="Delete photo from profile"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FACEBOOK-STYLE ADD PHOTO TO PROFILE MODAL */}
      {isAddPhotoModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-photo-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0B1D36] rounded-2xl border border-white/15 max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
                  PLAYER PROFILE WALL
                </span>
                <h3 id="add-photo-modal-title" className="text-lg font-extrabold text-white">
                  Post Photo to {selectedMember.name}’s Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPhotoModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePhotoPostSubmit} className="space-y-4">
              <input
                ref={galleryPhotoUploadRef}
                type="file"
                accept="image/*"
                onChange={handleGalleryFileSelect}
                className="hidden"
              />

              {newPhotoPreviewUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-white/20 h-48 bg-[#061020]">
                  <img
                    src={newPhotoPreviewUrl}
                    alt="Upload preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => galleryPhotoUploadRef.current?.click()}
                    className="absolute bottom-2 right-2 px-3 py-1.5 rounded-xl bg-black/75 text-white text-xs font-bold cursor-pointer"
                  >
                    Change Photo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => galleryPhotoUploadRef.current?.click()}
                  className="w-full h-40 rounded-2xl border-2 border-dashed border-[#26E6DE]/40 hover:border-[#FF6B00] bg-[#061020]/80 flex flex-col items-center justify-center gap-2 text-slate-300 cursor-pointer transition-colors"
                >
                  <ImagePlus className="w-8 h-8 text-[#FF6B00]" />
                  <span className="text-xs font-bold text-white">
                    Tap to Choose Photo from Phone or Computer
                  </span>
                  <span className="text-[11px] text-slate-400">JPG, PNG, or WebP</span>
                </button>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Photo Caption
                </label>
                <textarea
                  rows={3}
                  value={newPhotoCaption}
                  onChange={(e) => setNewPhotoCaption(e.target.value)}
                  placeholder="Write a caption about this game, tournament, or campus moment..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPhotoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPhotoPreviewUrl}
                  className="px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
                >
                  Post Photo to Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL-SCREEN PHOTO LIGHTBOX MODAL */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0B1D36] rounded-2xl border border-white/20 max-w-2xl w-full overflow-hidden shadow-2xl text-white"
          >
            <div className="relative bg-black max-h-[70vh] flex items-center justify-center">
              <img
                src={lightboxPhoto.imageUrl}
                alt={lightboxPhoto.caption}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-white">{selectedMember.name}</div>
                <p className="text-xs sm:text-sm text-slate-200">{lightboxPhoto.caption}</p>
                <div className="text-[11px] font-mono-tabular text-slate-400">
                  Posted {lightboxPhoto.date}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onLikeMemberPhotoPost(selectedMember.id, lightboxPhoto.id);
                  setLightboxPhoto({ ...lightboxPhoto, likes: lightboxPhoto.likes + 1 });
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                <span>{lightboxPhoto.likes}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD / SUBMIT GAME TO PROFILE MODAL */}
      {isUploadGameModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-game-modal-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0B1D36] rounded-2xl border border-white/15 max-w-lg w-full p-6 space-y-4 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
                  {isAdminOrOwner
                    ? 'ADMIN DIRECT PGN UPLOAD & ELO EVALUATION'
                    : 'MEMBER GAME SUBMISSION FOR ADMIN APPROVAL'}
                </span>
                <h3 id="upload-game-modal-title" className="text-lg font-extrabold text-white">
                  Record Game for {selectedMember.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadGameModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadGameSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {selectedMember.name.split(' ')[0]}’s Pieces
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-[#061020] p-1 rounded-xl border border-white/15">
                    {(['white', 'black'] as const).map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setGameColor(col)}
                        className={`py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                          gameColor === col
                            ? 'bg-[#FF6B00] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {col === 'white' ? '⬜ White' : '⬛ Black'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Club Opponent
                  </label>
                  <select
                    value={opponentId}
                    onChange={(e) => setOpponentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
                  >
                    {members
                      .filter((m) => m.id !== selectedMember.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.fide[gameTimeControl]} Elo)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Time Control (Elo Pool)
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-[#061020] p-1 rounded-xl border border-white/15">
                    {(['rapid', 'blitz', 'classical'] as const).map((tc) => (
                      <button
                        key={tc}
                        type="button"
                        onClick={() => setGameTimeControl(tc)}
                        className={`py-1.5 rounded-lg text-xs font-bold uppercase font-mono-tabular cursor-pointer ${
                          gameTimeControl === tc
                            ? 'bg-[#1E56A0] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tc}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Match Result
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-[#061020] p-1 rounded-xl border border-white/15 font-mono-tabular">
                    {[
                      { val: 1 as MatchOutcome, label: '1-0' },
                      { val: 0.5 as MatchOutcome, label: '½-½' },
                      { val: 0 as MatchOutcome, label: '0-1' },
                    ].map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => setGameOutcome(o.val)}
                        className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                          gameOutcome === o.val
                            ? 'bg-[#FF6B00] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Match Stakes Selector: Friendly (0.45x) vs Competitive (1.0x) vs Tournament (1.25x) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Match Stakes (Friendly games affect Elo less than Competitive)
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-[#061020] p-1 rounded-xl border border-white/15">
                  {(
                    [
                      { id: 'friendly', label: 'Friendly (0.45x Elo)' },
                      { id: 'competitive', label: 'Competitive (1.0x)' },
                      { id: 'tournament', label: 'Tournament (1.25x)' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setGameMatchStakes(st.id)}
                      className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        gameMatchStakes === st.id
                          ? st.id === 'friendly'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#FF6B00] text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Record Mode Toggle: Result Only (No PGN) vs Full PGN */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#061020] border border-white/10">
                <span className="text-xs font-semibold text-slate-300">
                  Recording Format:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGameResultOnly(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      gameResultOnly
                        ? 'bg-[#26E6DE] text-[#061020]'
                        : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    Result Only (No PGN)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameResultOnly(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      !gameResultOnly
                        ? 'bg-[#FF6B00] text-white'
                        : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    Include PGN Moves
                  </button>
                </div>
              </div>

              {/* Elo Impact Preview */}
              <div className="p-3 rounded-xl bg-[#061020] border border-white/10 space-y-1.5 text-xs font-mono-tabular">
                {modalEloPreview.isProvisionalMatch && (
                  <div className="text-[10px] text-[#FF6B00] font-bold uppercase">
                    ⚡ Early-Game Provisional Placement Active (Chess.com High-Swing K={modalEloPreview.effectiveKWhite}/{modalEloPreview.effectiveKBlack})
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 flex-wrap">
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Match Note / Opening Name (Optional)
                </label>
                <input
                  type="text"
                  value={gameOpening}
                  onChange={(e) => setGameOpening(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                />
              </div>

              {!gameResultOnly && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Paste PGN Moves
                  </label>
                  <textarea
                    rows={3}
                    value={gamePgn}
                    onChange={(e) => setGamePgn(e.target.value)}
                    placeholder="1. e4 c5 2. Nf3 d6 ..."
                    className="w-full px-3 py-2 text-xs font-mono-tabular rounded-xl border border-white/15 bg-[#061020] text-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadGameModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
                >
                  {isAdminOrOwner
                    ? 'Save Match & Update Elo Immediately'
                    : 'Submit Match for Admin Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
