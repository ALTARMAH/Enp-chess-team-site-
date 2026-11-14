import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ClubChatMessage,
  ClubMember,
  ClubThemeConfig,
} from '../utils/clubData';
import {
  MatchOutcome,
  MatchStakes,
  TimeControl,
  previewEloMatch,
} from '../utils/chessEngine';
import {
  MessageSquare,
  Hash,
  Send,
  Swords,
  Users,
  Lock,
  CheckCircle2,
  Handshake,
  Flame,
  Shield,
  Globe,
} from 'lucide-react';

interface ClubChatHubProps {
  clubName: string;
  clubs?: ClubThemeConfig[];
  members: ClubMember[];
  allMembers?: ClubMember[];
  currentUser: ClubMember | null;
  messages: ClubChatMessage[];
  initialDmRecipientId?: string | null;
  onOpenAuthModal: () => void;
  onSendMessage: (payload: {
    channelId: string;
    channelType: 'team' | 'dm';
    recipientId?: string;
    text: string;
    challengeTimeControl?: TimeControl;
    challengeStakes?: MatchStakes;
  }) => void;
  onQuickLogResult: (payload: {
    whiteId: string;
    blackId: string;
    outcome: MatchOutcome;
    timeControl: TimeControl;
    matchStakes: MatchStakes;
    openingName: string;
    pgn: string;
  }) => void;
  onOpenStudioBoard: () => void;
}

const TEAM_CHANNELS = [
  {
    id: 'team-general',
    name: 'general-lounge',
    description: 'Exclusive hangout & match challenges for your university team',
  },
  {
    id: 'team-varsity',
    name: 'varsity-tactics',
    description: 'Internal team strategy, Scheveningen prep & opening repertoire',
  },
  {
    id: 'team-otb',
    name: 'otb-campus-meetup',
    description: 'Coordinate campus tables at Jardins, Library, Amphi 1C, VIC, CAP, IEEE & ENPRT locals',
  },
] as const;

export function buildDmChannelId(uidA: string, uidB: string): string {
  return `dm_${[uidA, uidB].sort().join('_')}`;
}

export const ClubChatHub: React.FC<ClubChatHubProps> = ({
  clubName,
  clubs = [],
  members,
  allMembers,
  currentUser,
  messages,
  initialDmRecipientId,
  onOpenAuthModal,
  onSendMessage,
  onQuickLogResult,
  onOpenStudioBoard,
}) => {
  const rosterForDms = allMembers && allMembers.length > 0 ? allMembers : members;

  const [activeChannelId, setActiveChannelId] = useState<string>('team-general');
  const [activeDmMemberId, setActiveDmMemberId] = useState<string | null>(
    initialDmRecipientId || null
  );
  const [dmTeamFilter, setDmTeamFilter] = useState<'all' | 'my_team' | 'other_teams'>('all');
  const [messageInput, setMessageInput] = useState<string>('');
  const [attachChallenge, setAttachChallenge] = useState<boolean>(false);
  const [challengeTc, setChallengeTc] = useState<TimeControl>('rapid');
  const [challengeStakes, setChallengeStakes] = useState<MatchStakes>('friendly');

  // Quick Result Logger State (No PGN Required)
  const [opponentId, setOpponentId] = useState<string>(
    rosterForDms.find((m) => m.id !== currentUser?.id)?.id || rosterForDms[0]?.id || ''
  );
  const [quickTc, setQuickTc] = useState<TimeControl>('blitz');
  const [quickStakes, setQuickStakes] = useState<MatchStakes>('friendly');
  const [quickOutcome, setQuickOutcome] = useState<MatchOutcome>(1);
  const [quickBanner, setQuickBanner] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialDmRecipientId && currentUser) {
      setActiveDmMemberId(initialDmRecipientId);
      setActiveChannelId(buildDmChannelId(currentUser.id, initialDmRecipientId));
      setOpponentId(initialDmRecipientId);
    }
  }, [initialDmRecipientId, currentUser]);

  // Member's own home team info
  const myTeamClub = useMemo(() => {
    if (!currentUser) return null;
    return clubs.find((c) => c.clubId === currentUser.clubId) || null;
  }, [clubs, currentUser]);

  const myTeamName = myTeamClub?.clubName || currentUser?.university || clubName;

  const selectTeamChannel = (channelId: string) => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    setActiveDmMemberId(null);
    setActiveChannelId(channelId);
  };

  const selectPrivateDm = (targetMember: ClubMember) => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    setActiveDmMemberId(targetMember.id);
    setActiveChannelId(buildDmChannelId(currentUser.id, targetMember.id));
    setOpponentId(targetMember.id);
  };

  const activeDmMember = useMemo(
    () => rosterForDms.find((m) => m.id === activeDmMemberId) || null,
    [rosterForDms, activeDmMemberId]
  );

  const activeTeamChannel = useMemo(
    () => TEAM_CHANNELS.find((c) => c.id === activeChannelId) || TEAM_CHANNELS[0],
    [activeChannelId]
  );

  // Team messages are strictly scoped to currentUser.clubId; Private DMs work across all teams
  const visibleMessages = useMemo(() => {
    if (!currentUser) return [];
    if (activeDmMember) {
      const dmId = buildDmChannelId(currentUser.id, activeDmMember.id);
      return messages.filter((m) => m.channelType === 'dm' && m.channelId === dmId);
    }
    return messages.filter(
      (m) =>
        m.channelType === 'team' &&
        m.channelId === activeChannelId &&
        m.clubId === currentUser.clubId
    );
  }, [messages, activeChannelId, activeDmMember, currentUser]);

  const filteredDmContacts = useMemo(() => {
    if (!currentUser) return [];
    return rosterForDms
      .filter((m) => m.id !== currentUser.id)
      .filter((m) => {
        if (dmTeamFilter === 'my_team') return m.clubId === currentUser.clubId;
        if (dmTeamFilter === 'other_teams') return m.clubId !== currentUser.clubId;
        return true;
      });
  }, [rosterForDms, currentUser, dmTeamFilter]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length, activeChannelId]);

  // STRICT GUEST LOCK: Guests must NOT have access to Teams Chats or Private DMs
  if (!currentUser) {
    return (
      <section className="space-y-6">
        <div className="broadcast-panel rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-5 border border-[#FF6B00]/40 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#FF6B00]/15 border border-[#FF6B00]/40 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-[#FF6B00]" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-md bg-[#FF6B00]/20 text-[#FF6B00] font-mono-tabular text-xs font-bold uppercase">
              RESTRICTED · REGISTERED TEAM MEMBERS ONLY
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Guests Do Not Have Access to Team Channels or Private Chat
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl mx-auto">
              Internal university team channels are strictly private to verified members of the club, and 1-on-1 direct messages require a signed-in club account. Sign in with your club credentials to join the ENP team chat and message teammates.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#FF6B00]/25 cursor-pointer flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              <span>Sign In to Access Your Team Chat & Private DMs</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = messageInput.trim();
    if (!cleanText && !attachChallenge) return;

    const finalBody =
      cleanText ||
      `Invited ${
        activeDmMember ? activeDmMember.name : myTeamName
      } to a ${challengeStakes.toUpperCase()} ${challengeTc.toUpperCase()} match!`;

    onSendMessage({
      channelId: activeDmMember
        ? buildDmChannelId(currentUser.id, activeDmMember.id)
        : activeChannelId,
      channelType: activeDmMember ? 'dm' : 'team',
      recipientId: activeDmMember?.id,
      text: finalBody,
      challengeTimeControl: attachChallenge ? challengeTc : undefined,
      challengeStakes: attachChallenge ? challengeStakes : undefined,
    });

    setMessageInput('');
    setAttachChallenge(false);
  };

  const playerWhite = currentUser;
  const playerBlack =
    rosterForDms.find((m) => m.id === opponentId && m.id !== playerWhite.id) ||
    rosterForDms.find((m) => m.id !== playerWhite.id) ||
    rosterForDms[0];

  const quickEloPreview =
    playerWhite && playerBlack
      ? previewEloMatch(
          playerWhite.fide[quickTc],
          playerBlack.fide[quickTc],
          quickOutcome,
          playerWhite.fide.gamesPlayed,
          playerBlack.fide.gamesPlayed,
          quickStakes
        )
      : {
          whiteNew: 1600,
          whiteDelta: 0,
          blackNew: 1600,
          blackDelta: 0,
          expectedWhiteWinProb: 50,
          effectiveKWhite: 18,
          effectiveKBlack: 18,
          isProvisionalMatch: false,
        };

  const handleQuickResultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerWhite || !playerBlack) return;

    const resultStr =
      quickOutcome === 1 ? '1-0' : quickOutcome === 0 ? '0-1' : '1/2-1/2';

    onQuickLogResult({
      whiteId: playerWhite.id,
      blackId: playerBlack.id,
      outcome: quickOutcome,
      timeControl: quickTc,
      matchStakes: quickStakes,
      openingName:
        quickStakes === 'friendly'
          ? 'Friendly Hangout Match (Result Only)'
          : 'Competitive Club Match (Result Only)',
      pgn: `Result Only (${resultStr}) — No PGN Moves Uploaded`,
    });

    onSendMessage({
      channelId: activeDmMember
        ? buildDmChannelId(currentUser.id, activeDmMember.id)
        : activeChannelId,
      channelType: activeDmMember ? 'dm' : 'team',
      recipientId: activeDmMember?.id,
      text: `Logged a ${quickStakes.toUpperCase()} ${quickTc.toUpperCase()} match result: ${playerWhite.name} vs ${playerBlack.name} (${resultStr})`,
    });

    setQuickBanner(
      `Recorded ${quickStakes} ${quickTc} result (${resultStr}) vs ${playerBlack.name}! (${
        quickEloPreview.whiteDelta >= 0 ? '+' : ''
      }${quickEloPreview.whiteDelta} Elo)`
    );
    setTimeout(() => setQuickBanner(''), 5000);
  };

  const getShortTeamTag = (memberClubId: string) => {
    if (memberClubId.startsWith('enp')) return 'ENP';
    return memberClubId.slice(0, 5).toUpperCase();
  };

  return (
    <section className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2.5 sm:gap-4 border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-mono-tabular text-[#26E6DE] tracking-wider uppercase">
            {myTeamName.toUpperCase()} CHANNELS · 1-ON-1 DMs · RESULT LOGGER
          </span>
          <h2 className="text-lg sm:text-3xl font-extrabold text-white mt-0.5 sm:mt-1">
            {myTeamName} — Team &amp; Private Chat
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 sm:mt-1">
            Signed in as <strong className="text-white">{currentUser.name}</strong> ({myTeamName}).
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenStudioBoard}
          className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-[#1E56A0] hover:bg-[#FF6B00] text-white text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Swords className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Board Studio</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left 3 Cols: Scoped Home Team Channels + Cross-Team Direct Message Directory */}
        <div className="lg:col-span-3 broadcast-panel rounded-2xl p-3 sm:p-4 space-y-3.5 sm:space-y-5">
          {/* Team Channels (Strictly Scoped to currentUser.clubId) */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between px-1 sm:px-2">
              <span className="text-[10px] sm:text-[11px] font-mono-tabular uppercase tracking-wider text-[#FF6B00] font-bold">
                My Team ({getShortTeamTag(currentUser.clubId)})
              </span>
              <Users className="w-3.5 h-3.5 text-[#FF6B00]" />
            </div>
            <div className="px-1 sm:px-2 pb-0.5 text-[10px] sm:text-[11px] text-slate-400">
              Private to {myTeamName} squad members.
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-1">
              {TEAM_CHANNELS.map((ch) => {
                const isSelected = !activeDmMemberId && activeChannelId === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => selectTeamChannel(ch.id)}
                    className={`w-full px-2 sm:px-3 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-left flex items-center justify-between gap-1 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#FF6B00] text-white font-bold shadow-md'
                        : 'text-slate-300 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <Hash className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 opacity-80" />
                      <div className="text-[10px] sm:text-xs truncate">{ch.name}</div>
                    </div>
                    <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-black/30 text-[9px] font-mono-tabular uppercase shrink-0">
                      {getShortTeamTag(currentUser.clubId)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Private 1-on-1 Direct Messages (Across All Teams!) */}
          <div className="space-y-2 pt-2.5 sm:pt-3 border-t border-white/10">
            <div className="flex items-center justify-between px-1 sm:px-2">
              <span className="text-[10px] sm:text-[11px] font-mono-tabular uppercase tracking-wider text-[#26E6DE] font-bold">
                Private DMs
              </span>
              <Globe className="w-3.5 h-3.5 text-[#26E6DE]" />
            </div>

            {/* Filter: All Teams vs My Team vs Other Teams */}
            <div className="grid grid-cols-3 gap-1 bg-[#040B16] p-1 rounded-xl border border-white/10 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setDmTeamFilter('all')}
                className={`py-1 rounded-lg transition-colors cursor-pointer ${
                  dmTeamFilter === 'all'
                    ? 'bg-[#1E56A0] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({rosterForDms.filter((m) => m.id !== currentUser.id).length})
              </button>
              <button
                type="button"
                onClick={() => setDmTeamFilter('my_team')}
                className={`py-1 rounded-lg transition-colors cursor-pointer ${
                  dmTeamFilter === 'my_team'
                    ? 'bg-[#1E56A0] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                My Team
              </button>
              <button
                type="button"
                onClick={() => setDmTeamFilter('other_teams')}
                className={`py-1 rounded-lg transition-colors cursor-pointer ${
                  dmTeamFilter === 'other_teams'
                    ? 'bg-[#FF6B00] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Others
              </button>
            </div>

            <div className="space-y-1 max-h-[190px] sm:max-h-[320px] overflow-y-auto pr-1">
              {filteredDmContacts.map((m) => {
                const isSelected = activeDmMemberId === m.id;
                const isSameTeam = m.clubId === currentUser.clubId;
                const isAvailable = m.liveStatus !== 'in_lecture';
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectPrivateDm(m)}
                    className={`w-full p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1E56A0] text-white font-bold shadow'
                        : 'bg-[#061020]/60 hover:bg-white/10 text-slate-200 border border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-extrabold text-white shrink-0 overflow-hidden"
                        style={{ backgroundColor: m.avatarColor }}
                      >
                        {m.avatarUrl ? (
                          <img
                            src={m.avatarUrl}
                            alt={m.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          m.avatarInitials
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] sm:text-xs font-bold truncate flex items-center gap-1">
                          <span className="truncate">{m.name}</span>
                          <span
                            className={`px-1 py-0.2 rounded text-[8px] sm:text-[9px] font-mono-tabular uppercase shrink-0 ${
                              isSameTeam
                                ? 'bg-white/15 text-white'
                                : 'bg-[#FF6B00]/25 text-[#FF6B00] border border-[#FF6B00]/40'
                            }`}
                          >
                            {getShortTeamTag(m.clubId)}
                          </span>
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-mono-tabular text-slate-400 truncate">
                          {m.fide.rapid} Rapid ·{' '}
                          {isAvailable ? 'Online' : 'In Class'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center 5 Cols: Live Chat Stream & Match Challenge Composer */}
        <div className="lg:col-span-5 broadcast-panel rounded-2xl flex flex-col h-[390px] sm:h-[580px] overflow-hidden">
          {/* Active Channel Header */}
          <div className="p-2.5 sm:p-4 border-b border-white/10 bg-[#061020]/80 flex items-center justify-between gap-2">
            <div className="min-w-0">
              {activeDmMember ? (
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: activeDmMember.avatarColor }}
                  >
                    {activeDmMember.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                      <span className="truncate">{activeDmMember.name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#FF6B00]/20 border border-[#FF6B00]/40 text-[#FF6B00] text-[9px] sm:text-[10px] font-mono-tabular uppercase shrink-0">
                        {activeDmMember.clubId === currentUser.clubId ? 'Teammate' : 'DM'}
                      </span>
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-mono-tabular text-[#26E6DE] truncate">
                      {activeDmMember.fide.rapid} Rapid Elo
                    </div>
                  </div>
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1 truncate">
                    <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF6B00] shrink-0" />
                    <span className="truncate">
                      {activeTeamChannel.name}
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-400 truncate">
                    {activeTeamChannel.description}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setAttachChallenge((v) => !v)}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                attachChallenge
                  ? 'bg-[#26E6DE] text-[#061020]'
                  : 'bg-white/10 hover:bg-white/15 text-[#26E6DE]'
              }`}
            >
              <Swords className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{attachChallenge ? 'Attached' : '+ Challenge'}</span>
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-2.5 sm:p-4 overflow-y-auto space-y-2.5 sm:space-y-3">
            {visibleMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-6 text-slate-400 space-y-1.5">
                <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-[#26E6DE]/60" />
                <div className="text-xs sm:text-sm font-bold text-white">
                  {activeDmMember
                    ? `Message ${activeDmMember.name}`
                    : `No messages in #${activeTeamChannel.name} yet`}
                </div>
                <p className="text-[11px] sm:text-xs max-w-xs">
                  Send a message or attach a match invitation below.
                </p>
              </div>
            ) : (
              visibleMessages.map((msg) => {
                const isMe = currentUser.id === msg.senderId;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5 px-1">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-300">
                        {msg.senderName}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-mono-tabular text-slate-500">
                        {msg.createdAt}
                      </span>
                    </div>

                    <div
                      className={`max-w-[90%] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-[11px] sm:text-xs leading-snug sm:leading-relaxed space-y-2 ${
                        isMe
                          ? 'bg-[#1E56A0] text-white rounded-br-none'
                          : 'bg-[#061020]/90 border border-white/10 text-slate-100 rounded-bl-none'
                      }`}
                    >
                      <p>{msg.text}</p>

                      {msg.challengeTimeControl && (
                        <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-[#040B16]/90 border border-[#26E6DE]/40 flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="text-[9px] sm:text-[10px] font-mono-tabular uppercase text-[#26E6DE] font-bold flex items-center gap-1">
                              <Swords className="w-3 h-3" />
                              <span>
                                {msg.challengeStakes || 'friendly'} ·{' '}
                                {msg.challengeTimeControl.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-slate-300">
                              {msg.challengeStakes === 'friendly'
                                ? 'Friendly (0.45x Elo)'
                                : 'Competitive (1.0x Elo)'}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={onOpenStudioBoard}
                            className="px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#FF8533] text-white text-[11px] font-bold cursor-pointer"
                          >
                            Accept & Play
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Optional Challenge Attachment Drawer */}
          {attachChallenge && (
            <div className="px-4 py-2.5 bg-[#040B16] border-t border-[#26E6DE]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#26E6DE] font-bold">Challenge Setup:</span>
                <select
                  aria-label="Challenge time control"
                  value={challengeTc}
                  onChange={(e) => setChallengeTc(e.target.value as TimeControl)}
                  className="px-2 py-1 rounded bg-[#08172E] border border-white/15 text-white text-xs"
                >
                  <option value="blitz">Blitz (3+2 / 5+0)</option>
                  <option value="rapid">Rapid (10+0 / 15+10)</option>
                  <option value="classical">Classical</option>
                </select>
                <select
                  aria-label="Challenge stakes"
                  value={challengeStakes}
                  onChange={(e) => setChallengeStakes(e.target.value as MatchStakes)}
                  className="px-2 py-1 rounded bg-[#08172E] border border-white/15 text-white text-xs"
                >
                  <option value="friendly">Friendly (0.45x Elo)</option>
                  <option value="competitive">Competitive (1.0x Elo)</option>
                </select>
              </div>
            </div>
          )}

          {/* Message Input Bar */}
          <form
            onSubmit={handleSendSubmit}
            className="p-3 bg-[#061020] border-t border-white/10 flex items-center gap-2"
          >
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={
                activeDmMember
                  ? `Message ${activeDmMember.name} (${getShortTeamTag(activeDmMember.clubId)}) privately...`
                  : `Message #${activeTeamChannel.name} (${myTeamName})...`
              }
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0B1C36] border border-white/15 text-xs text-white placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>

        {/* Right 4 Cols: Instant Result-Only Match Logger (No PGN Upload Required!) */}
        <div className="lg:col-span-4 broadcast-panel rounded-2xl p-5 space-y-4">
          <div className="border-b border-white/10 pb-3">
            <span className="text-xs font-mono-tabular uppercase text-[#26E6DE] font-bold">
              NO PGN NEEDED · JUST PICK WHO WON & LOST
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              Quick Friendly / Competitive Match Result
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Played an OTB or casual game without recording the moves? Choose who won and whether it was a{' '}
              <strong className="text-[#26E6DE]">Friendly Game (0.45x Elo)</strong> or{' '}
              <strong className="text-white">Competitive (1.0x Elo)</strong>.
            </p>
          </div>

          <form onSubmit={handleQuickResultSubmit} className="space-y-4">
            {quickBanner && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-200 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{quickBanner}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Match Type (Friendly vs. Competitive)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setQuickStakes('friendly')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    quickStakes === 'friendly'
                      ? 'bg-[#26E6DE]/15 border-[#26E6DE] text-white shadow'
                      : 'bg-[#061020]/70 border-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#26E6DE]">
                    <Handshake className="w-3.5 h-3.5" />
                    <span>Friendly Game</span>
                  </div>
                  <div className="text-[10px] font-mono-tabular text-slate-300 mt-0.5">
                    Light 0.45x Elo Impact
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setQuickStakes('competitive')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    quickStakes === 'competitive'
                      ? 'bg-[#1E56A0]/30 border-[#3B82F6] text-white shadow'
                      : 'bg-[#061020]/70 border-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Competitive</span>
                  </div>
                  <div className="text-[10px] font-mono-tabular text-slate-300 mt-0.5">
                    Standard 1.0x Elo
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Opponent (Teammate or Other University Player)
              </label>
              <select
                aria-label="Select Opponent"
                value={playerBlack?.id || ''}
                onChange={(e) => setOpponentId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
              >
                {rosterForDms
                  .filter((m) => m.id !== playerWhite.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      [{getShortTeamTag(m.clubId)}] {m.name} ({m.fide[quickTc]}{' '}
                      {quickTc.toUpperCase()} Elo)
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Time Control
                </label>
                <select
                  aria-label="Select Time Control"
                  value={quickTc}
                  onChange={(e) => setQuickTc(e.target.value as TimeControl)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
                >
                  <option value="blitz">Blitz</option>
                  <option value="rapid">Rapid</option>
                  <option value="classical">Classical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Who Won?
                </label>
                <select
                  aria-label="Select Who Won"
                  value={quickOutcome}
                  onChange={(e) => setQuickOutcome(Number(e.target.value) as MatchOutcome)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-white/15 bg-[#061020] text-white"
                >
                  <option value={1}>I Won ({playerWhite.name})</option>
                  <option value={0.5}>Draw (½ - ½)</option>
                  <option value={0}>{playerBlack?.name} Won</option>
                </select>
              </div>
            </div>

            {/* Live Elo Preview */}
            {playerWhite && playerBlack && (
              <div className="p-3.5 rounded-xl bg-[#040B16]/90 border border-white/10 font-mono-tabular text-xs space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{quickStakes.toUpperCase()} ELO PREVIEW</span>
                  <span className="text-[#26E6DE]">K={quickEloPreview.effectiveKWhite}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-sans font-semibold text-white truncate">
                    {playerWhite.name}
                  </span>
                  <span
                    className={
                      quickEloPreview.whiteDelta >= 0
                        ? 'text-emerald-400 font-bold'
                        : 'text-rose-400 font-bold'
                    }
                  >
                    {quickEloPreview.whiteNew} ({quickEloPreview.whiteDelta >= 0 ? '+' : ''}
                    {quickEloPreview.whiteDelta})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-sans font-semibold text-white truncate">
                    {playerBlack.name}
                  </span>
                  <span
                    className={
                      quickEloPreview.blackDelta >= 0
                        ? 'text-emerald-400 font-bold'
                        : 'text-rose-400 font-bold'
                    }
                  >
                    {quickEloPreview.blackNew} ({quickEloPreview.blackDelta >= 0 ? '+' : ''}
                    {quickEloPreview.blackDelta})
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold text-xs shadow-lg shadow-[#FF6B00]/25 transition-colors cursor-pointer"
            >
              Record {quickStakes === 'friendly' ? 'Friendly' : 'Competitive'} Result (No PGN)
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
