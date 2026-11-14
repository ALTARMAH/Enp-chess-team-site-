import React, { useRef, useState } from 'react';
import {
  CHESS_SPECIALTY_PRESETS,
  CLUB_ROLE_DIVISIONS,
  ClubGenerationRecord,
  ClubMember,
  ClubPost,
  ClubRoleDivision,
  ClubThemeConfig,
  ClubTournament,
  LoggedClubGame,
  MemberLiveStatus,
  OPENING_REPERTOIRE_PRESETS,
  UserRole,
} from '../utils/clubData';
import { ClubLogoBadge } from './ClubLogoBadge';
import {
  Smartphone,
  Upload,
  Copy,
  Check,
  Shield,
  UserPlus,
  CheckCircle2,
  XCircle,
  Trash2,
  PlusCircle,
  Megaphone,
  Building2,
  Lock,
  Key,
  Crown,
  Sparkles,
  BookOpen,
  Trophy,
  History,
  ArrowRightLeft,
  Download,
} from 'lucide-react';

interface ClubCustomizerSpecProps {
  clubs: ClubThemeConfig[];
  clubConfig: ClubThemeConfig;
  onSelectClub: (club: ClubThemeConfig) => void;
  onUpdateClubConfig: (next: ClubThemeConfig) => void;
  onAddClub: (newClub: ClubThemeConfig) => void;
  onDeleteClub: (clubId: string) => void;
  members: ClubMember[];
  currentUser: ClubMember | null;
  onOpenAuthModal: () => void;
  onCreateMemberAccount: (payload: {
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
  }) => void;
  onUpdateMemberRole: (memberId: string, nextRole: UserRole) => void;
  onUpdateMemberPassword: (memberId: string, nextPassword: string) => void;
  onUpdateMemberRoleAndChessProfile?: (
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
  ) => void;
  onDeleteMemberAccount?: (memberId: string) => void;
  ownershipLineage?: ClubGenerationRecord[];
  onDesignateSuccessor?: (memberId: string) => void;
  onTransferOwnershipToNextGen?: (payload: {
    newOwnerId: string;
    generationLabel: string;
    mandatePeriod: string;
    legacyNote: string;
  }) => void;
  onReclaimFounderOwnership?: () => void;
  tournaments?: ClubTournament[];
  onDeleteTournament?: (tournamentId: string) => void;
  onClearTournamentHistory?: () => void;
  pendingGames: LoggedClubGame[];
  approvedGames: LoggedClubGame[];
  onApprovePendingGame: (gameId: string) => void;
  onRejectPendingGame: (gameId: string) => void;
  posts: ClubPost[];
  onCreatePost: (payload: {
    title: string;
    category: ClubPost['category'];
    body: string;
    pinned: boolean;
  }) => void;
  onDeletePost: (postId: string) => void;
  androidPreviewMode: boolean;
  onToggleAndroidPreview: () => void;
}

type AdminSubTab =
  | 'accounts'
  | 'inheritance'
  | 'approvals'
  | 'posts'
  | 'clubs';

export const ClubCustomizerSpec: React.FC<ClubCustomizerSpecProps> = ({
  clubs,
  clubConfig,
  onSelectClub,
  onUpdateClubConfig,
  onAddClub,
  onDeleteClub,
  members,
  currentUser,
  onOpenAuthModal,
  onCreateMemberAccount,
  onUpdateMemberRole,
  onUpdateMemberPassword,
  onUpdateMemberRoleAndChessProfile,
  onDeleteMemberAccount,
  ownershipLineage = [],
  onDesignateSuccessor,
  onTransferOwnershipToNextGen,
  onReclaimFounderOwnership,
  tournaments = [],
  onDeleteTournament,
  onClearTournamentHistory,
  pendingGames,
  approvedGames,
  onApprovePendingGame,
  onRejectPendingGame,
  posts,
  onCreatePost,
  onDeletePost,
  androidPreviewMode,
  onToggleAndroidPreview,
}) => {
  const [subTab, setSubTab] = useState<AdminSubTab>('accounts');
  const [copiedCredId, setCopiedCredId] = useState<string>('');
  const [adminToast, setAdminToast] = useState<string>('');
  const [roleSearch, setRoleSearch] = useState<string>('');
  const [divisionFilter, setDivisionFilter] = useState<'ALL' | ClubRoleDivision>('ALL');

  // Create Member Account State
  const [accName, setAccName] = useState('');
  const [accArabic, setAccArabic] = useState('');
  const [accUsername, setAccUsername] = useState('');
  const [accPassword, setAccPassword] = useState('enp-2026');
  const [accDept, setAccDept] = useState('Génie Électrique & Automatique');
  const [accYear, setAccYear] = useState('1st Year Ingénieur');
  const [accRole, setAccRole] = useState<UserRole>('member');
  const [accDivision, setAccDivision] = useState<ClubRoleDivision>('Club Member');
  const [accSpecialty, setAccSpecialty] = useState<string>(CHESS_SPECIALTY_PRESETS[0]);
  const [accOpening, setAccOpening] = useState<string>(
    OPENING_REPERTOIRE_PRESETS[0]
  );
  const [accBringsEquipment, setAccBringsEquipment] = useState<boolean>(false);

  // Next-Generation Inheritance State
  const currentDesignatedHeir = members.find((m) => m.isDesignatedSuccessor);
  const [selectedHeirId, setSelectedHeirId] = useState<string>(
    currentDesignatedHeir?.id ||
      members.find((m) => m.role !== 'owner')?.id ||
      members[0]?.id ||
      ''
  );
  const [genLabel, setGenLabel] = useState<string>('Generation II — Next Mandate');
  const [mandatePeriod, setMandatePeriod] = useState<string>('2026 – 2027');
  const [legacyNote, setLegacyNote] = useState<string>(
    'Passing the torch of ENP Chess Club leadership, campus tournament traditions, and digital platform stewardship to the next generation of polytechnic engineers.'
  );

  // Create Home Screen Post State
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState<ClubPost['category']>('Club News');
  const [postBody, setPostBody] = useState('');
  const [postPinned, setPostPinned] = useState(true);

  // Add New Club State
  const [newClubName, setNewClubName] = useState('');
  const [newUniversityName, setNewUniversityName] = useState('');
  const [newSubtitleAr, setNewSubtitleAr] = useState('نادي الشطرنج الجامعي');
  const [newCity, setNewCity] = useState('Algiers, Algeria');
  const [newPrimaryColor, setNewPrimaryColor] = useState('#0A1E3C');
  const [newAccentColor, setNewAccentColor] = useState('#FF6B00');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const schoolLogoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const isOwner = currentUser?.role === 'owner';
  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name || id;

  const getRoleDivisionMeta = (div?: ClubRoleDivision) =>
    CLUB_ROLE_DIVISIONS.find((d) => d.id === div) ||
    CLUB_ROLE_DIVISIONS[CLUB_ROLE_DIVISIONS.length - 1];

  const handleCopyCredentials = (m: ClubMember) => {
    const text = `${clubConfig.clubName} Login Credentials\nMember: ${m.name}\nClub Role: ${
      m.clubRoleDivision || 'Club Member'
    }\nUsername: ${m.username}\nPassword Code: ${m.passwordCode}`;
    navigator.clipboard?.writeText(text);
    setCopiedCredId(m.id);
    setTimeout(() => setCopiedCredId(''), 2500);
  };

  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrOwner) {
      onOpenAuthModal();
      return;
    }
    if (!accName.trim() || !accUsername.trim() || !accPassword.trim()) return;

    onCreateMemberAccount({
      name: accName.trim(),
      arabicName: accArabic.trim() || 'عضو نادي الشطرنج',
      username: accUsername.trim().toLowerCase().replace(/\s+/g, ''),
      passwordCode: accPassword.trim(),
      department: accDept.trim() || 'Polytechnic Engineering',
      yearLevel: accYear.trim() || 'Ingénieur',
      liveStatus: 'campus_otb',
      role: isOwner ? accRole : 'member',
      clubRoleDivision: accDivision,
      chessSpecialty: accSpecialty,
      signatureOpening: accOpening,
      bringsEquipment: accBringsEquipment,
    });

    setAdminToast(
      `Created account for ${accName.trim()} (@${accUsername
        .trim()
        .toLowerCase()}) in role "${accDivision}" with password "${accPassword.trim()}".`
    );
    setAccName('');
    setAccArabic('');
    setAccUsername('');
    setAccPassword(`enp-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleCreatePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrOwner) {
      onOpenAuthModal();
      return;
    }
    if (!postTitle.trim() || !postBody.trim()) return;
    onCreatePost({
      title: postTitle.trim(),
      category: postCategory,
      body: postBody.trim(),
      pinned: postPinned,
    });
    setPostTitle('');
    setPostBody('');
    setAdminToast('Published announcement to the Home Screen!');
  };

  const handleAddClubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrOwner) {
      onOpenAuthModal();
      return;
    }
    if (!newClubName.trim() || !newUniversityName.trim()) return;
    const slug = `${newClubName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-3)}`;

    const createdClub: ClubThemeConfig = {
      clubId: slug,
      clubName: newClubName.trim(),
      subtitleAr: newSubtitleAr.trim() || 'نادي الشطرنج الجامعي',
      universityName: newUniversityName.trim(),
      city: newCity.trim() || 'Algeria',
      primaryColor: newPrimaryColor,
      secondaryColor: '#133B6E',
      accentColor: newAccentColor,
      customLogoUrl: clubConfig.customLogoUrl,
      schoolLogoUrl: clubConfig.schoolLogoUrl,
      clubBannerUrl: clubConfig.clubBannerUrl,
      customHeroUrl: clubConfig.customHeroUrl,
      startingRating: 1500,
      weekMode: 'algeria_sat_thu',
    };

    onAddClub(createdClub);
    setNewClubName('');
    setNewUniversityName('');
    setAdminToast(`Added new club "${createdClub.clubName}" and switched workspace!`);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'customLogoUrl' | 'schoolLogoUrl' | 'clubBannerUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateClubConfig({
          ...clubConfig,
          [field]: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const filteredMembers = members.filter((m) => {
    const matchesDivision =
      divisionFilter === 'ALL' || m.clubRoleDivision === divisionFilter;
    const q = roleSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.username.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q) ||
      (m.clubRoleDivision || '').toLowerCase().includes(q) ||
      (m.chessSpecialty || '').toLowerCase().includes(q) ||
      (m.signatureOpening || '').toLowerCase().includes(q);
    return matchesDivision && matchesSearch;
  });

  const completedTournaments = tournaments.filter((t) => t.status === 'completed');

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span className="text-xs font-mono-tabular text-[#26E6DE] tracking-wider uppercase">
            CENTRAL ADMIN, ACCOUNT MANAGEMENT & NEXT-GEN INHERITANCE
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Admin Control Center ({clubConfig.clubName})
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdminOrOwner && (
            <a
              href="/enp-chess-club-platform.zip"
              download="enp-chess-club-platform.zip"
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors bg-[#1E56A0] hover:bg-[#2563EB] border border-[#26E6DE]/40 text-white shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#26E6DE]" />
              <span>Download Site & Firebase Zip</span>
            </a>
          )}

          <button
            type="button"
            onClick={onToggleAndroidPreview}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              androidPreviewMode
                ? 'bg-[#FF6B00] text-white shadow-md'
                : 'bg-white/8 hover:bg-white/15 border border-white/15 text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-[#26E6DE]" />
            {androidPreviewMode ? 'Exit Phone Frame' : 'Phone Frame (412×860)'}
          </button>
        </div>
      </div>

      {/* Role Status Callout */}
      {!isAdminOrOwner && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/40 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              READ-ONLY PREVIEW MODE (ADMIN OR OWNER ACCOUNT REQUIRED FOR EDITS)
            </div>
            <p className="text-xs sm:text-sm text-slate-200">
              Sign in with the Owner or Admin account to assign custom club roles, pass ownership to the next generation, approve games, or manage accounts.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold cursor-pointer shrink-0"
          >
            Sign In / Switch Role
          </button>
        </div>
      )}

      {adminToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-xs sm:text-sm text-emerald-200 font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{adminToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setAdminToast('')}
            className="text-xs underline text-emerald-300 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sub-Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-[#08172E] p-1.5 rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setSubTab('accounts')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'accounts'
              ? 'bg-[#FF6B00] text-white shadow'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Accounts & Custom Roles ({members.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('inheritance')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'inheritance'
              ? 'bg-[#FF6B00] text-white shadow'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-300" />
          <span>Ownership Inheritance (Next Gen)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('approvals')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'approvals'
              ? 'bg-[#FF6B00] text-white shadow'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Games & Tournament Cleanup</span>
          {pendingGames.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-black/35 text-[#26E6DE] font-mono-tabular text-[11px]">
              {pendingGames.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('posts')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'posts'
              ? 'bg-[#FF6B00] text-white shadow'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Home Posts ({posts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('clubs')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'clubs'
              ? 'bg-[#FF6B00] text-white shadow'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Clubs & Logos ({clubs.length})</span>
        </button>
      </div>

      {/* TAB 1: MEMBER ACCOUNTS, ROLES (IT, COMM, COACHING), OPENINGS & PASSWORDS */}
      {subTab === 'accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Create Member Account with Role Division, Specialty & Opening */}
          <div className="lg:col-span-5 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-4">
            <div className="border-b border-white/10 pb-3">
              <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold">
                ISSUE MEMBER ACCOUNT, ROLE & CHESS PROFILE
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#FF6B00]" />
                Create Club Account & Assign Division
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                All 28 real ENP students from your registration form are already loaded! Use this form to add any new student with their Club Role (`IT`, `COMM`, `Coaching`, etc.), Chess Specialty, and Signature Opening.
              </p>
            </div>

            <form onSubmit={handleCreateAccountSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Student Full Name
                  </label>
                  <input
                    type="text"
                    value={accName}
                    onChange={(e) => {
                      setAccName(e.target.value);
                      if (!accUsername) {
                        setAccUsername(
                          e.target.value.split(' ')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
                            ''
                        );
                      }
                    }}
                    placeholder="e.g., Walid Zerrouki"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Arabic Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={accArabic}
                    onChange={(e) => setAccArabic(e.target.value)}
                    placeholder="وليد زروقي"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#26E6DE] mb-1">
                    Login Username
                  </label>
                  <input
                    type="text"
                    value={accUsername}
                    onChange={(e) => setAccUsername(e.target.value)}
                    placeholder="walid"
                    className="w-full px-3 py-2 text-xs font-mono-tabular rounded-xl border border-[#26E6DE]/40 bg-[#061020] text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#FF6B00] mb-1">
                    Password Code
                  </label>
                  <input
                    type="text"
                    value={accPassword}
                    onChange={(e) => setAccPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular rounded-xl border border-[#FF6B00]/40 bg-[#061020] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Engineering Department
                  </label>
                  <input
                    type="text"
                    value={accDept}
                    onChange={(e) => setAccDept(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Year Level
                  </label>
                  <input
                    type="text"
                    value={accYear}
                    onChange={(e) => setAccYear(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                  />
                </div>
              </div>

              {/* Club Organizational Role (IT, COMM, Coaching, Events, etc.) */}
              <div>
                <label className="block text-xs font-semibold text-[#26E6DE] mb-1">
                  Club Organizational Role (IT, COMM, Coaching, Events, Logistics...)
                </label>
                <select
                  value={accDivision}
                  onChange={(e) => setAccDivision(e.target.value as ClubRoleDivision)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#26E6DE]/40 bg-[#061020] text-white"
                >
                  {CLUB_ROLE_DIVISIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      [{d.shortTag}] {d.id} — {d.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chess Specialty & Signature Opening */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#FF6B00] mb-1">
                    Chess Specialty
                  </label>
                  <select
                    value={accSpecialty}
                    onChange={(e) => setAccSpecialty(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
                  >
                    {CHESS_SPECIALTY_PRESETS.map((sp) => (
                      <option key={sp} value={sp}>
                        {sp}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-300 mb-1">
                    Primary Opening Played
                  </label>
                  <select
                    value={accOpening}
                    onChange={(e) => setAccOpening(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
                  >
                    {OPENING_REPERTOIRE_PRESETS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accBringsEquipment}
                    onChange={(e) => setAccBringsEquipment(e.target.checked)}
                    className="rounded accent-[#26E6DE]"
                  />
                  Can Bring Physical Board / Clock to Campus
                </label>

                {isOwner && (
                  <select
                    value={accRole}
                    onChange={(e) => setAccRole(e.target.value as UserRole)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-white/15 bg-[#061020] text-white"
                  >
                    <option value="member">Member Access</option>
                    <option value="admin">Admin Access</option>
                  </select>
                )}
              </div>

              <button
                type="submit"
                disabled={!isAdminOrOwner}
                className="w-full min-h-[42px] py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
              >
                + Create Member Account & Assign Role
              </button>
            </form>
          </div>

          {/* Right: Manage Accounts, Assign IT/COMM Roles, Openings, Passwords & Delete Accounts */}
          <div className="lg:col-span-7 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-4">
            <div className="border-b border-white/10 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
                  REAL STUDENT ACCOUNTS, CLUB ROLES (IT / COMM / COACHING) & CREDENTIALS
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {clubConfig.clubName} Directory ({filteredMembers.length} / {members.length})
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Search student, IT, COMM, opening..."
                  className="px-3 py-1.5 rounded-xl bg-[#061020] border border-white/15 text-xs text-white"
                />
                <select
                  aria-label="Filter by club division"
                  value={divisionFilter}
                  onChange={(e) =>
                    setDivisionFilter(e.target.value as 'ALL' | ClubRoleDivision)
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-[#061020] border border-[#26E6DE]/35 text-xs font-bold text-[#26E6DE]"
                >
                  <option value="ALL">All Club Roles ({members.length})</option>
                  {CLUB_ROLE_DIVISIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.shortTag} — {d.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredMembers.map((m) => {
                const divMeta = getRoleDivisionMeta(m.clubRoleDivision);
                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-[#061020]/85 border border-white/10 space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-white">{m.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular font-bold uppercase border ${divMeta.badgeClass}`}
                          >
                            {divMeta.shortTag}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular font-bold uppercase ${
                              m.role === 'owner'
                                ? 'bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/40'
                                : m.role === 'admin'
                                ? 'bg-[#26E6DE]/20 text-[#26E6DE] border border-[#26E6DE]/40'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {m.role}
                          </span>
                          {m.isDesignatedSuccessor && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-mono-tabular font-bold">
                              👑 NEXT-GEN HEIR
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {m.yearLevel} · {m.department}
                          {m.email ? ` · ${m.email}` : ''}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {isAdminOrOwner && (
                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(m)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedCredId === m.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-[#26E6DE]" />
                                Copy Login
                              </>
                            )}
                          </button>
                        )}

                        {isOwner && m.role !== 'owner' && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateMemberRole(
                                m.id,
                                m.role === 'admin' ? 'member' : 'admin'
                              )
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                              m.role === 'admin'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-[#1E56A0] hover:bg-[#2563EB] text-white'
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            {m.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                        )}

                        {isAdminOrOwner && m.role !== 'owner' && onDeleteMemberAccount && (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteMemberAccount(m.id);
                              setAdminToast(`Deleted account "${m.name}" from roster.`);
                            }}
                            title={`Delete ${m.name} account`}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Role Division, Specialty, Opening & Credentials Editor */}
                    {isAdminOrOwner && (
                      <div className="pt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs">
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-mono-tabular uppercase text-slate-400 mb-0.5">
                            Club Role (IT / COMM / Coaching)
                          </label>
                          <select
                            aria-label={`Club role division for ${m.name}`}
                            value={m.clubRoleDivision || 'Club Member'}
                            onChange={(e) => {
                              if (onUpdateMemberRoleAndChessProfile) {
                                onUpdateMemberRoleAndChessProfile(m.id, {
                                  clubRoleDivision: e.target.value as ClubRoleDivision,
                                  chessSpecialty:
                                    m.chessSpecialty || CHESS_SPECIALTY_PRESETS[0],
                                  signatureOpening:
                                    m.signatureOpening ||
                                    m.openings[0]?.name ||
                                    'Italian Game (C50)',
                                  bringsEquipment: m.bringsEquipment,
                                  willingToCoach: m.willingToCoach,
                                  willingToOrganize: m.willingToOrganize,
                                });
                                setAdminToast(
                                  `Updated ${m.name}'s club role to "${e.target.value}".`
                                );
                              }
                            }}
                            className="w-full px-2 py-1 rounded-lg bg-black/40 border border-[#26E6DE]/35 text-white font-semibold text-xs"
                          >
                            {CLUB_ROLE_DIVISIONS.map((d) => (
                              <option key={d.id} value={d.id}>
                                [{d.shortTag}] {d.id}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-mono-tabular uppercase text-slate-400 mb-0.5">
                            Opening Played & Specialty
                          </label>
                          <div className="text-[11px] text-slate-200 truncate">
                            <span className="text-[#26E6DE] font-semibold">
                              {m.signatureOpening || m.openings[0]?.name || 'Italian Game'}
                            </span>{' '}
                            ·{' '}
                            <span className="text-[#FF6B00]">
                              {m.chessSpecialty || 'Tactical All-Rounder'}
                            </span>
                          </div>
                        </div>

                        <div className="sm:col-span-4 flex items-center justify-end gap-2 font-mono-tabular">
                          <span className="text-slate-400">
                            @{m.username}
                          </span>
                          <input
                            type="text"
                            aria-label={`Password for ${m.name}`}
                            value={m.passwordCode}
                            onChange={(e) => onUpdateMemberPassword(m.id, e.target.value)}
                            className="w-24 px-2 py-1 rounded-lg bg-black/40 border border-white/15 text-[#FF6B00] font-bold text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NEXT-GENERATION OWNERSHIP INHERITANCE & PRESIDENTIAL LINEAGE */}
      {subTab === 'inheritance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Designate Heir & Transfer Ownership to Next Generation */}
          <div className="lg:col-span-6 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-5 border border-amber-400/30">
            <div className="border-b border-white/10 pb-3">
              <span className="text-xs font-mono-tabular uppercase text-amber-300 font-bold flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-400" />
                NEXT-GENERATION OWNERSHIP INHERITANCE PROTOCOL
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
                Pass Club & Platform Ownership to the Next Generation
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                As polytechnic engineering classes graduate from ENP, you can designate an official <strong className="text-amber-300">Next-Generation Heir</strong> or execute a full <strong className="text-[#26E6DE]">Presidential Ownership Handover</strong> so the club thrives for years to come.
              </p>
            </div>

            {/* Step 1: Select Successor / Next-Generation President */}
            <div className="space-y-3 bg-[#061020]/90 p-4 rounded-2xl border border-white/15">
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">
                  1. Select Next-Generation Student Leader ({clubConfig.clubName})
                </label>
                <select
                  value={selectedHeirId}
                  onChange={(e) => setSelectedHeirId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#040B16] border border-amber-400/40 text-xs font-bold text-white"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.yearLevel} · {m.clubRoleDivision || 'Member'} · Rapid{' '}
                      {m.fide.rapid})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="text-xs text-slate-400">
                  Current Designated Heir:{' '}
                  <strong className="text-amber-300">
                    {currentDesignatedHeir ? currentDesignatedHeir.name : 'None Selected'}
                  </strong>
                </div>

                {onDesignateSuccessor && (
                  <button
                    type="button"
                    disabled={!isAdminOrOwner || !selectedHeirId}
                    onClick={() => {
                      onDesignateSuccessor(selectedHeirId);
                      const chosen = members.find((m) => m.id === selectedHeirId);
                      setAdminToast(
                        `Designated ${chosen?.name || 'member'} as Official Next-Generation Heir (👑 NEXT-GEN HEIR badge active on their profile)!`
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    Designate as Official Next-Gen Heir
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: Execute Full Ownership Inheritance Handover */}
            <div className="space-y-3 bg-[#061020]/90 p-4 rounded-2xl border border-[#FF6B00]/40">
              <div className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                2. Execute Full Ownership Transfer to Next Generation
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Generation Title
                  </label>
                  <input
                    type="text"
                    value={genLabel}
                    onChange={(e) => setGenLabel(e.target.value)}
                    placeholder="e.g., Generation II — 2026/2027"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#040B16] text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Academic Mandate Period
                  </label>
                  <input
                    type="text"
                    value={mandatePeriod}
                    onChange={(e) => setMandatePeriod(e.target.value)}
                    placeholder="e.g., 2026 – 2027"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#040B16] text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Presidential Handover & Legacy Message
                </label>
                <textarea
                  rows={3}
                  value={legacyNote}
                  onChange={(e) => setLegacyNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#040B16] text-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {onTransferOwnershipToNextGen && (
                  <button
                    type="button"
                    disabled={!isAdminOrOwner || !selectedHeirId}
                    onClick={() => {
                      onTransferOwnershipToNextGen({
                        newOwnerId: selectedHeirId,
                        generationLabel: genLabel.trim() || 'Next Generation Mandate',
                        mandatePeriod: mandatePeriod.trim() || '2026 – 2027',
                        legacyNote:
                          legacyNote.trim() ||
                          'Official ownership transferred to the next generation.',
                      });
                      const chosen = members.find((m) => m.id === selectedHeirId);
                      setAdminToast(
                        `Ownership inherited by ${chosen?.name}! Recorded in the ENP Chess Club Presidential Lineage.`
                      );
                    }}
                    className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
                  >
                    <Crown className="w-4 h-4" />
                    Transfer Ownership to Selected Successor
                  </button>
                )}

                {onReclaimFounderOwnership && (
                  <button
                    type="button"
                    onClick={() => {
                      onReclaimFounderOwnership();
                      setAdminToast(
                        'Founder Fethallah reclaimed Platform Owner privileges.'
                      );
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Reclaim Founder Owner (Fethallah)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Presidential & Generation Lineage Archive */}
          <div className="lg:col-span-6 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-4">
            <div className="border-b border-white/10 pb-3">
              <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold flex items-center gap-1.5">
                <History className="w-4 h-4" />
                ENP CHESS CLUB PRESIDENTIAL & GENERATION LINEAGE
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Club Ownership & Succession History ({ownershipLineage.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Permanent record of every generation of ENP Chess Club leadership and their successors.
              </p>
            </div>

            <div className="space-y-3">
              {ownershipLineage.map((gen, idx) => (
                <div
                  key={gen.id}
                  className={`p-4 rounded-2xl border space-y-2 ${
                    idx === 0
                      ? 'bg-[#061020] border-amber-400/50 shadow-lg'
                      : 'bg-[#061020]/70 border-white/10'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/40 font-mono-tabular text-[10px] font-bold uppercase">
                        {gen.generationLabel}
                      </span>
                      {idx === 0 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono-tabular text-[10px] font-bold uppercase">
                          ACTIVE MANDATE
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono-tabular text-[#26E6DE] font-bold">
                      {gen.MandatePeriod}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div>
                      <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span>President & Owner: {gen.fromOwnerName}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Designated Next-Gen Successor:{' '}
                        <strong className="text-[#26E6DE]">{gen.toOwnerName}</strong> (
                        {gen.toOwnerDepartment}) · Handover Date: {gen.transferredAt}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 italic bg-black/30 p-3 rounded-xl border border-white/8">
                    “{gen.legacyNote}”
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENDING GAME APPROVALS, VERIFIED DATABASE & TOURNAMENT HISTORY CLEANUP */}
      {subTab === 'approvals' && (
        <div className="space-y-6">
          {/* Tournament History & Test Data Cleanup Bar */}
          <div className="broadcast-panel p-5 rounded-2xl border border-rose-500/30 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-mono-tabular uppercase text-rose-300 font-bold flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#FF6B00]" />
                TOURNAMENT HISTORY & TEST TOURNAMENTS CLEANUP
              </div>
              <h3 className="text-base font-bold text-white">
                Manage or Delete Completed Tournament History ({completedTournaments.length}{' '}
                Completed / {tournaments.length} Total)
              </h3>
              <p className="text-xs text-slate-300">
                Delete any test tournament or clear completed tournament history in one click.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onClearTournamentHistory && completedTournaments.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearTournamentHistory();
                    setAdminToast('Cleared all completed tournaments from Tournament History!');
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Completed Tournament History ({completedTournaments.length})
                </button>
              )}
            </div>

            {tournaments.length > 0 && (
              <div className="w-full pt-3 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {tournaments.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-[#061020]/80 border border-white/10 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{t.name}</div>
                      <div className="text-[11px] font-mono-tabular text-slate-400">
                        {t.status.toUpperCase()} · {t.format.toUpperCase()} ·{' '}
                        {t.playerIds.length} Players
                      </div>
                    </div>
                    {isAdminOrOwner && onDeleteTournament && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteTournament(t.id);
                          setAdminToast(`Deleted tournament "${t.name}".`);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-4">
              <div className="border-b border-white/10 pb-3">
                <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold">
                  WAY 1: MEMBER SHARED GAMES AWAITING ADMIN HOMOLOGATION
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Pending Game Submissions ({pendingGames.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  When a club member submits a game from their account, an Admin approves it here to save it to the archive and update both players’ Elo.
                </p>
              </div>

              {pendingGames.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#061020]/70 border border-white/10 text-center text-xs text-slate-400">
                  All submitted member games have been reviewed and approved!
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingGames.map((g) => (
                    <div
                      key={g.id}
                      className="p-4 rounded-xl bg-[#061020]/90 border border-amber-500/40 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono-tabular text-[10px] font-bold uppercase">
                            Pending Approval · {g.timeControl.toUpperCase()} Elo
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1">
                            ⬜ {getMemberName(g.whiteId)} vs. ⬛ {getMemberName(g.blackId)} (
                            {g.result})
                          </h4>
                          <div className="text-xs text-slate-400">
                            {g.openingName} · Submitted {g.date}
                          </div>
                        </div>

                        {isAdminOrOwner && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onApprovePendingGame(g.id);
                                setAdminToast(
                                  `Approved "${g.title}"! Both players' ${g.timeControl.toUpperCase()} Elo ratings and game histories have been updated.`
                                );
                              }}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve & Update Elo
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectPendingGame(g.id)}
                              className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 font-mono-tabular text-[11px] text-[#26E6DE] overflow-x-auto">
                        {g.pgn}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-4">
              <div className="border-b border-white/10 pb-3">
                <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
                  OFFICIAL CLUB PGN ARCHIVE
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Approved Games ({approvedGames.length})
                </h3>
              </div>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {approvedGames.map((g) => (
                  <div
                    key={g.id}
                    className="p-3 rounded-xl bg-[#061020]/70 border border-white/10 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{g.title}</div>
                      <div className="text-[11px] font-mono-tabular text-slate-400">
                        {g.timeControl.toUpperCase()} · Result {g.result} · {g.date}
                      </div>
                    </div>
                    {isAdminOrOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          onRejectPendingGame(g.id);
                          setAdminToast(`Deleted game "${g.title}" from archive.`);
                        }}
                        title="Delete game from archive"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HOME SCREEN POSTS & ANNOUNCEMENTS */}
      {subTab === 'posts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-4">
            <div className="border-b border-white/10 pb-3">
              <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold">
                HOME SCREEN BULLETIN PUBLISHER
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Publish New Post to {clubConfig.clubName} Home
              </h3>
            </div>

            <form onSubmit={handleCreatePostSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Post Headline
                </label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="e.g., Thursday Blitz Tournament in Library Foyer"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value as ClubPost['category'])}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
                  >
                    <option value="Tournament">Tournament</option>
                    <option value="Club News">Club News</option>
                    <option value="Match Recap">Match Recap</option>
                    <option value="Campus Notice">Campus Notice</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 pt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postPinned}
                    onChange={(e) => setPostPinned(e.target.checked)}
                    className="rounded accent-[#FF6B00]"
                  />
                  Pin to Top of Home Screen
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Announcement Details
                </label>
                <textarea
                  rows={4}
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Write announcement details for club members..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white"
                />
              </div>

              <button
                type="submit"
                disabled={!isAdminOrOwner}
                className="w-full min-h-[42px] py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-[#FF6B00]/25 cursor-pointer"
              >
                Publish Post to Home Screen
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-4">
            <div className="border-b border-white/10 pb-3">
              <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
                ACTIVE HOME SCREEN FEED ({clubConfig.clubName.toUpperCase()})
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Published Posts ({posts.length})
              </h3>
            </div>

            {posts.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#061020]/70 text-center text-xs text-slate-400">
                No posts published for {clubConfig.clubName} yet.
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-[#061020]/80 border border-white/10 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#1E56A0]/40 text-[#26E6DE] font-mono-tabular text-[10px] font-bold uppercase">
                          {p.category}
                        </span>
                        {p.pinned && (
                          <span className="px-2 py-0.5 rounded bg-[#FF6B00]/20 text-[#FF6B00] font-mono-tabular text-[10px] font-bold uppercase">
                            Pinned
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-mono-tabular">
                          {p.createdAt} · by {p.authorName}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{p.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">{p.body}</p>
                    </div>

                    {isAdminOrOwner && (
                      <button
                        type="button"
                        onClick={() => onDeletePost(p.id)}
                        title="Delete post"
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: MULTI-CLUB MANAGER & BRAND LOGOS */}
      {subTab === 'clubs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-5">
            <div className="border-b border-white/10 pb-3">
              <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold">
                MULTI-UNIVERSITY CLUB DIRECTORY
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Registered University Clubs ({clubs.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Each club has its own isolated members, online players, weekly free hours, and home screen posts. Admins can add a new club;{' '}
                <strong className="text-[#FF6B00]">only the Platform Owner can delete a club</strong>.
              </p>
            </div>

            <div className="space-y-2.5">
              {clubs.map((c) => {
                const active = c.clubId === clubConfig.clubId;
                return (
                  <div
                    key={c.clubId}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      active
                        ? 'border-[#FF6B00] bg-[#061020]'
                        : 'border-white/10 bg-[#061020]/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectClub(c)}
                      className="flex-1 text-left cursor-pointer"
                    >
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{c.clubName}</span>
                        {active && (
                          <span className="px-2 py-0.5 rounded bg-[#FF6B00] text-white text-[10px] font-mono-tabular uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{c.universityName}</div>
                    </button>

                    {clubs.length > 1 && (
                      <div>
                        {isOwner ? (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteClub(c.clubId);
                              setAdminToast(`Owner deleted club "${c.clubName}".`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Club
                          </button>
                        ) : (
                          <span
                            title="Only the Platform Owner can delete a club"
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono-tabular text-slate-400 flex items-center gap-1"
                          >
                            <Lock className="w-3 h-3 text-[#FF6B00]" />
                            Owner Only Delete
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={handleAddClubSubmit}
              className="p-4 rounded-2xl bg-[#061020]/90 border border-white/15 space-y-3"
            >
              <div className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" />
                Add a New University Chess Club (Admin / Owner)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    New Club Name
                  </label>
                  <input
                    type="text"
                    value={newClubName}
                    onChange={(e) => setNewClubName(e.target.value)}
                    placeholder="e.g., ENSTA Chess Club"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#040B16] text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    University / School Name
                  </label>
                  <input
                    type="text"
                    value={newUniversityName}
                    onChange={(e) => setNewUniversityName(e.target.value)}
                    placeholder="e.g., ENSTA Alger"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#040B16] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Arabic / French Subtitle
                  </label>
                  <input
                    type="text"
                    value={newSubtitleAr}
                    onChange={(e) => setNewSubtitleAr(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#040B16] text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#040B16] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Primary Color
                  </label>
                  <input
                    type="color"
                    value={newPrimaryColor}
                    onChange={(e) => setNewPrimaryColor(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/15 bg-transparent cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Accent Color
                  </label>
                  <input
                    type="color"
                    value={newAccentColor}
                    onChange={(e) => setNewAccentColor(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/15 bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isAdminOrOwner}
                className="w-full py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                + Add New Club to Platform
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-5">
            <div className="border-b border-white/10 pb-3">
              <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
                ACTIVE CLUB LOGOS, CREST BANNER & BRANDING
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Customize {clubConfig.clubName} Visual Identity
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
              <div className="p-3.5 rounded-xl bg-[#061020] border border-white/10 flex flex-col items-center justify-between text-center gap-2">
                <ClubLogoBadge
                  customLogoUrl={clubConfig.customLogoUrl}
                  accentColor={clubConfig.accentColor}
                  size="xl"
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'customLogoUrl')}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={!isAdminOrOwner}
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-[11px] font-bold text-white flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-[#FF6B00]" />
                  Club Emblem
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#061020] border border-white/10 flex flex-col items-center justify-between text-center gap-2">
                <div className="w-20 h-20 rounded-2xl bg-[#061020] border border-[#26E6DE]/35 flex items-center justify-center shadow-inner overflow-hidden">
                  {clubConfig.schoolLogoUrl && (
                    <img
                      src={clubConfig.schoolLogoUrl}
                      alt="Official School Logo"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover scale-105"
                    />
                  )}
                </div>
                <input
                  ref={schoolLogoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'schoolLogoUrl')}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={!isAdminOrOwner}
                  onClick={() => schoolLogoInputRef.current?.click()}
                  className="w-full py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-[11px] font-bold text-white flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-[#26E6DE]" />
                  School Logo
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#061020] border border-white/10 flex flex-col items-center justify-between text-center gap-2">
                <div className="w-full h-20 rounded-xl bg-[#08224A] border border-[#26E6DE]/30 flex items-center justify-center overflow-hidden relative">
                  {clubConfig.clubBannerUrl && (
                    <img
                      src={clubConfig.clubBannerUrl}
                      alt="Official 16:9 Club Crest Banner"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'clubBannerUrl')}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={!isAdminOrOwner}
                  onClick={() => bannerInputRef.current?.click()}
                  className="w-full py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-[11px] font-bold text-white flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-[#FF6B00]" />
                  16:9 Crest Banner
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Active Club Name
                  </label>
                  <input
                    type="text"
                    disabled={!isAdminOrOwner}
                    value={clubConfig.clubName}
                    onChange={(e) =>
                      onUpdateClubConfig({ ...clubConfig, clubName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Arabic / French Subtitle
                  </label>
                  <input
                    type="text"
                    disabled={!isAdminOrOwner}
                    value={clubConfig.subtitleAr}
                    onChange={(e) =>
                      onUpdateClubConfig({ ...clubConfig, subtitleAr: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-white/15 bg-[#061020] text-white disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
