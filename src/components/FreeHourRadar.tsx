import React, { useState, useEffect, useRef } from 'react';
import {
  ClubMember,
  ClubThemeConfig,
  ENP_CAMPUS_MEETUP_ZONES,
  EnpCampusMeetupZone,
} from '../utils/clubData';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import {
  Swords,
  CheckCircle2,
  MapPin,
  Wifi,
  Lock,
  Navigation,
  Compass,
  Radio,
} from 'lucide-react';

interface FreeHourRadarProps {
  members: ClubMember[];
  clubConfig: ClubThemeConfig;
  currentUser: ClubMember | null;
  onOpenAuthModal: () => void;
  onToggleMemberSlot: (memberId: string, slotKey: string) => void;
  onUpdateMemberMeetupZone?: (memberId: string, zoneId: string) => void;
  onUpdateMemberGps?: (
    memberId: string,
    gps: {
      lat: number;
      lng: number;
      accuracyMeters?: number;
      label: string;
      isLiveBrowserGps?: boolean;
      updatedAt: string;
    } | null
  ) => void;
  onChallengeMember: (opponent: ClubMember, slotLabel: string) => void;
}

const ALGERIA_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const INTL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

// Historic École Nationale Polytechnique (ENP El Harrach, Avenue Hassen Badi / Rue des Frères Oudek)
const ENP_CAMPUS_CENTER = { lat: 36.72335, lng: 3.14955 };

const MAPS_API_KEY =
  (import.meta.env?.VITE_GOOGLE_MAPS_API_KEY as string) ||
  (process.env.GOOGLE_MAPS_API_KEY as string) ||
  '';

export const FreeHourRadar: React.FC<FreeHourRadarProps> = ({
  members,
  clubConfig,
  currentUser,
  onOpenAuthModal,
  onToggleMemberSlot,
  onUpdateMemberMeetupZone,
  onUpdateMemberGps,
  onChallengeMember,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<string>('0-11');
  const [editMyHoursMode, setEditMyHoursMode] = useState<boolean>(false);
  const [editingMemberId, setEditingMemberId] = useState<string>(
    currentUser?.id || members[0]?.id || ''
  );
  const [challengeToast, setChallengeToast] = useState<string>('');

  // Live Browser Geolocation State
  const [gpsWatchStatus, setGpsWatchStatus] = useState<
    'idle' | 'requesting' | 'tracking' | 'denied'
  >('idle');
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string>('');
  const [activeInfoMarkerId, setActiveInfoMarkerId] = useState<string | null>(
    'zone-jardins-library'
  );
  const watchIdRef = useRef<number | null>(null);

  const isAdminOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  useEffect(() => {
    if (!currentUser) {
      setEditMyHoursMode(false);
    } else if (!isAdminOrOwner) {
      setEditingMemberId(currentUser.id);
    } else if (!members.some((m) => m.id === editingMemberId)) {
      setEditingMemberId(currentUser.id || members[0]?.id || '');
    }
  }, [currentUser, isAdminOrOwner, members, editingMemberId]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const days = clubConfig.weekMode === 'algeria_sat_thu' ? ALGERIA_DAYS : INTL_DAYS;
  const [selDayIdx, selHour] = selectedSlot.split('-').map(Number);
  const selectedSlotLabel = `${days[selDayIdx] || days[0]} ${selHour
    .toString()
    .padStart(2, '0')}:00 – ${(selHour + 1).toString().padStart(2, '0')}:00`;

  const getZoneById = (zoneId?: string): EnpCampusMeetupZone =>
    ENP_CAMPUS_MEETUP_ZONES.find((z) => z.id === zoneId) || ENP_CAMPUS_MEETUP_ZONES[0];

  const membersFreeInSlot = members.filter((m) => m.freeSlots.includes(selectedSlot));

  const editingMember =
    (isAdminOrOwner
      ? members.find((m) => m.id === editingMemberId)
      : members.find((m) => m.id === currentUser?.id)) ||
    currentUser ||
    members[0];

  const handleToggleEditMode = () => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    setEditingMemberId(currentUser.id);
    setEditMyHoursMode((prev) => !prev);
  };

  const handleCellClick = (slotKey: string) => {
    setSelectedSlot(slotKey);
    if (editMyHoursMode && currentUser && editingMember) {
      onToggleMemberSlot(editingMember.id, slotKey);
    }
  };

  const handlePingChallenge = (opponent: ClubMember) => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    const zone = getZoneById(opponent.campusMeetupZoneId);
    setChallengeToast(
      `Challenge ping sent from ${currentUser.name} to ${opponent.name} (${opponent.fide.rapid} Rapid Elo) at ${zone.shortTag} for ${selectedSlotLabel}!`
    );
    onChallengeMember(opponent, selectedSlotLabel);
  };

  // Start or stop live browser GPS tracking
  const handleShareLiveGps = () => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    if (!('geolocation' in navigator)) {
      setGpsWatchStatus('denied');
      setGpsStatusMessage('Browser Geolocation API is not supported on this device.');
      return;
    }

    if (gpsWatchStatus === 'tracking') {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsWatchStatus('idle');
      setGpsStatusMessage('Stopped live GPS broadcasting.');
      onUpdateMemberGps?.(currentUser.id, null);
      return;
    }

    setGpsWatchStatus('requesting');
    setGpsStatusMessage('Requesting exact GPS coordinates from your browser...');

    const onSuccess = (pos: GeolocationPosition) => {
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      const acc = Math.round(pos.coords.accuracy || 10);
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const myZone = getZoneById(currentUser.campusMeetupZoneId);

      setGpsWatchStatus('tracking');
      setGpsStatusMessage(
        `Live GPS Active: ${lat}, ${lng} (±${acc}m accuracy · Updated ${timeStr})`
      );
      setActiveInfoMarkerId(`member-${currentUser.id}`);

      onUpdateMemberGps?.(currentUser.id, {
        lat,
        lng,
        accuracyMeters: acc,
        label: `Exact Live GPS (${myZone.shortTag})`,
        isLiveBrowserGps: true,
        updatedAt: timeStr,
      });
    };

    const onError = (err: GeolocationPositionError) => {
      setGpsWatchStatus('denied');
      setGpsStatusMessage(
        err.code === 1
          ? 'GPS permission was denied in the browser. Allow location access or select your ENP campus meetup zone below.'
          : 'Could not lock GPS signal right now. You can select your exact ENP campus building pin below.'
      );
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    const id = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
    });
    watchIdRef.current = id;
  };

  // Compute coordinates ONLY for online / active campus members so only their floating pictures appear on the map
  const onlineMembersOnMap = members.filter(
    (m) =>
      m.liveStatus === 'campus_otb' ||
      m.liveStatus === 'online_ready' ||
      Boolean(m.gpsLocation?.isLiveBrowserGps)
  );

  const memberMapPins = onlineMembersOnMap.map((m, idx) => {
    const zone = getZoneById(m.campusMeetupZoneId);
    if (m.gpsLocation) {
      return {
        member: m,
        lat: m.gpsLocation.lat,
        lng: m.gpsLocation.lng,
        zone,
        isExactGps: Boolean(m.gpsLocation.isLiveBrowserGps),
        accuracy: m.gpsLocation.accuracyMeters,
        updatedAt: m.gpsLocation.updatedAt,
      };
    }
    const angle = (idx * 137.5 * Math.PI) / 180;
    const radius = 0.00014 * ((idx % 3) + 1);
    return {
      member: m,
      lat: Number((zone.lat + Math.cos(angle) * radius).toFixed(6)),
      lng: Number((zone.lng + Math.sin(angle) * radius).toFixed(6)),
      zone,
      isExactGps: false,
      accuracy: undefined,
      updatedAt: 'Online on Campus',
    };
  });

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            “Who’s Free This Hour” & Live Campus GPS Map
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            See online members’ floating profile pictures directly where they are on campus, or allow GPS access to broadcast your exact live coordinates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleShareLiveGps}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
              gpsWatchStatus === 'tracking'
                ? 'bg-emerald-500 text-[#040B16] shadow-emerald-500/25'
                : 'bg-[#FF6B00] hover:bg-[#FF8533] text-white shadow-[#FF6B00]/25'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>
              {gpsWatchStatus === 'tracking'
                ? 'Live GPS Shared (Click to Stop)'
                : gpsWatchStatus === 'requesting'
                ? 'Locating GPS...'
                : 'Allow GPS & Pin Exact Location'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleEditMode}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              editMyHoursMode
                ? 'bg-[#26E6DE] text-[#061020] shadow'
                : currentUser
                ? 'bg-[#1E56A0] hover:bg-[#2563EB] text-white'
                : 'bg-white/8 hover:bg-white/15 border border-white/15 text-slate-200'
            }`}
          >
            {!currentUser && <Lock className="w-3.5 h-3.5 text-[#FF6B00]" />}
            {editMyHoursMode
              ? `✓ Done Editing (${editingMember?.name.split(' ')[0]})`
              : currentUser
              ? 'Edit My Weekly Free Hours'
              : 'Sign In to Edit Free Hours'}
          </button>
        </div>
      </div>

      {gpsStatusMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-mono-tabular flex flex-wrap items-center justify-between gap-2 ${
            gpsWatchStatus === 'tracking'
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
              : gpsWatchStatus === 'denied'
              ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
              : 'bg-[#1E56A0]/25 border-[#26E6DE]/40 text-[#26E6DE]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 shrink-0 text-[#FF6B00]" />
            <span>{gpsStatusMessage}</span>
          </div>
          {currentUser && (
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-sans">My Campus Meetup Spot:</span>
              <select
                aria-label="Select my ENP campus meetup zone"
                value={currentUser.campusMeetupZoneId || 'zone-jardins-library'}
                onChange={(e) =>
                  onUpdateMemberMeetupZone?.(currentUser.id, e.target.value)
                }
                className="px-2.5 py-1 rounded-lg bg-[#061020] border border-white/20 text-white font-sans font-bold text-xs"
              >
                {ENP_CAMPUS_MEETUP_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.shortTag}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {challengeToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-xs sm:text-sm text-emerald-200 font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{challengeToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setChallengeToast('')}
            className="text-xs underline text-emerald-300 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* LIVE GOOGLE MAPS PLATFORM INTERACTIVE CAMPUS GPS RADAR (ONLY FLOATING ONLINE MEMBER PICTURES) */}
      <div className="w-full">
        {/* Interactive Google Map with Floating Pictures of Online Members */}
        <div className="w-full broadcast-panel rounded-2xl overflow-hidden flex flex-col border border-[#26E6DE]/30">
          <div className="p-4 border-b border-white/10 bg-[#061020]/90 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono-tabular uppercase text-[#FF6B00] font-bold flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                LIVE CAMPUS GPS RADAR · {memberMapPins.length} ONLINE MEMBERS FLOATING ON MAP
              </span>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Online Members Live Positions (Tap Picture to Challenge)
              </h3>
            </div>

            {currentUser && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">My Spot:</span>
                <select
                  aria-label="Quick switch my campus meetup zone"
                  value={currentUser.campusMeetupZoneId || 'zone-jardins-library'}
                  onChange={(e) => {
                    onUpdateMemberMeetupZone?.(currentUser.id, e.target.value);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#040B16] border border-[#26E6DE]/40 text-xs font-bold text-[#26E6DE]"
                >
                  {ENP_CAMPUS_MEETUP_ZONES.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.shortTag}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="relative w-full h-[390px] sm:h-[440px] bg-[#040B16]">
            <APIProvider apiKey={MAPS_API_KEY}>
              <GoogleMap
                defaultCenter={ENP_CAMPUS_CENTER}
                defaultZoom={17}
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                gestureHandling="greedy"
                disableDefaultUI={true}
                zoomControl={true}
                className="w-full h-full"
              >
                {/* Floating Pictures of Online Members Only — Zero Place Names on the Map */}
                {memberMapPins.map((pin) => {
                  const markerKey = `member-${pin.member.id}`;
                  const isMe = currentUser?.id === pin.member.id;
                  return (
                    <React.Fragment key={markerKey}>
                      <AdvancedMarker
                        position={{ lat: pin.lat, lng: pin.lng }}
                        onClick={() => setActiveInfoMarkerId(markerKey)}
                        title={pin.member.name}
                      >
                        <div className="relative group flex flex-col items-center cursor-pointer transition-transform hover:scale-110">
                          {/* Pulsing halo for live online member */}
                          <span
                            className={`absolute -inset-1 rounded-full blur-xs opacity-70 ${
                              pin.isExactGps
                                ? 'bg-emerald-400'
                                : isMe
                                ? 'bg-[#26E6DE]'
                                : 'bg-[#FF6B00]'
                            }`}
                          />

                          {/* Floating Circular Picture Only (No Place or Text Labels) */}
                          <div
                            className={`relative w-12 h-12 rounded-full overflow-hidden border-[3px] shadow-[0_8px_20px_rgba(0,0,0,0.75)] flex items-center justify-center bg-[#061020] ${
                              pin.isExactGps
                                ? 'border-emerald-400'
                                : isMe
                                ? 'border-[#26E6DE]'
                                : 'border-[#FF6B00]'
                            }`}
                            style={{ backgroundColor: pin.member.avatarColor }}
                          >
                            {pin.member.avatarUrl ? (
                              <img
                                src={pin.member.avatarUrl}
                                alt={pin.member.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-extrabold text-white">
                                {pin.member.avatarInitials}
                              </span>
                            )}
                          </div>

                          {/* Online Green Status Dot */}
                          <span className="absolute bottom-1 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#061020] shadow" />

                          {/* Small Floating Pin Pointer */}
                          <div
                            className={`w-2.5 h-2.5 rotate-45 -mt-1.5 ${
                              pin.isExactGps
                                ? 'bg-emerald-400'
                                : isMe
                                ? 'bg-[#26E6DE]'
                                : 'bg-[#FF6B00]'
                            }`}
                          />
                        </div>
                      </AdvancedMarker>

                      {activeInfoMarkerId === markerKey && (
                        <InfoWindow
                          position={{ lat: pin.lat, lng: pin.lng }}
                          onCloseClick={() => setActiveInfoMarkerId(null)}
                        >
                          <div className="p-1 max-w-[210px] text-slate-900 space-y-1.5">
                            <div className="flex items-center gap-2">
                              {pin.member.avatarUrl && (
                                <img
                                  src={pin.member.avatarUrl}
                                  alt={pin.member.name}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full object-cover border border-slate-300 shrink-0"
                                />
                              )}
                              <div>
                                <div className="text-xs font-extrabold leading-tight">
                                  {pin.member.name}
                                </div>
                                <div className="text-[10px] font-mono-tabular text-[#FF6B00] font-bold">
                                  {pin.member.fide.rapid} Rapid · {pin.member.fide.blitz} Blitz
                                </div>
                              </div>
                            </div>
                            {currentUser?.id !== pin.member.id && (
                              <button
                                type="button"
                                onClick={() => handlePingChallenge(pin.member)}
                                className="w-full py-1 px-2 rounded bg-[#FF6B00] text-white text-[10px] font-bold cursor-pointer"
                              >
                                Challenge to Play
                              </button>
                            )}
                          </div>
                        </InfoWindow>
                      )}
                    </React.Fragment>
                  );
                })}
              </GoogleMap>
            </APIProvider>
          </div>
        </div>
      </div>

      {/* WEEKLY FREE-HOUR SCHEDULE MATRIX + MATCHMAKING */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-4 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-300">
              {editMyHoursMode && editingMember
                ? `Click any hour slot below to toggle availability for ${editingMember.name}:`
                : `Click any hour cell to see which ${clubConfig.clubName} members are free:`}
            </div>
            <span className="text-xs font-mono-tabular text-[#26E6DE] font-bold">
              Active Slot: {selectedSlotLabel}
            </span>
          </div>

          <table className="w-full border-collapse text-xs font-mono-tabular min-w-[600px]">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="py-2.5 px-2 text-left">Hour</th>
                {days.map((day) => (
                  <th key={day} className="py-2.5 px-2 text-center font-sans font-bold text-white">
                    {day.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {HOURS.map((hr) => (
                <tr key={hr}>
                  <td className="py-2 px-2 font-bold text-slate-400 whitespace-nowrap">
                    {hr.toString().padStart(2, '0')}:00
                  </td>
                  {days.map((day, dIdx) => {
                    const key = `${dIdx}-${hr}`;
                    const count = members.filter((m) => m.freeSlots.includes(key)).length;
                    const isSelected = selectedSlot === key;
                    const mySlotActive = editingMember?.freeSlots.includes(key) ?? false;

                    return (
                      <td key={key} className="p-1">
                        <button
                          type="button"
                          onClick={() => handleCellClick(key)}
                          aria-label={`${day} ${hr}:00 — ${count} players free`}
                          className={`w-full py-2 px-1.5 rounded-xl font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                            editMyHoursMode
                              ? mySlotActive
                                ? 'bg-[#FF6B00] text-white shadow'
                                : 'bg-white/5 text-slate-500 hover:bg-white/10'
                              : isSelected
                              ? 'bg-[#26E6DE] text-[#061020] ring-2 ring-[#FF6B00]'
                              : count >= 3
                              ? 'bg-[#1E56A0]/45 text-white hover:bg-[#1E56A0]/65'
                              : count > 0
                              ? 'bg-white/10 text-slate-200 hover:bg-white/20'
                              : 'bg-white/3 text-slate-600'
                          }`}
                        >
                          <span>{count} free</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-4 broadcast-panel p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="border-b border-white/10 pb-3">
            <span className="text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold">
              {clubConfig.clubName.toUpperCase()} OTB MATCHMAKING
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">{selectedSlotLabel}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {membersFreeInSlot.length} members matching your slot & campus zone filter.
            </p>
          </div>

          {membersFreeInSlot.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-[#061020]/70 text-xs text-slate-400 space-y-2.5">
              <p>No members have marked themselves free for this hour yet.</p>
              <button
                type="button"
                onClick={() => {
                  if (!currentUser || !editingMember) {
                    onOpenAuthModal();
                    return;
                  }
                  setEditMyHoursMode(true);
                  onToggleMemberSlot(editingMember.id, selectedSlot);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#FF6B00] text-white font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                {!currentUser && <Lock className="w-3.5 h-3.5" />}
                {currentUser ? '+ Mark Myself Free Here' : 'Sign In to Mark Yourself Free'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {membersFreeInSlot.map((m) => {
                const memberZone = getZoneById(m.campusMeetupZoneId);
                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-[#061020]/75 border border-white/10 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-1.5">
                          <span>{m.name}</span>
                          {m.gpsLocation?.isLiveBrowserGps && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono-tabular text-[9px] font-bold">
                              LIVE GPS
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{m.department}</div>
                        <div className="text-[11px] font-mono-tabular text-[#26E6DE] mt-0.5">
                          Meetup: {memberZone.shortTag}
                        </div>
                      </div>
                      <div className="text-right font-mono-tabular">
                        <div className="text-sm font-extrabold text-[#FF6B00]">
                          {m.fide.rapid} Rapid
                        </div>
                        <div className="text-[11px] text-[#26E6DE]">Blitz {m.fide.blitz}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/10">
                      <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
                        {m.liveStatus === 'campus_otb' ? (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                            {memberZone.shortTag}
                          </>
                        ) : m.liveStatus === 'online_ready' ? (
                          <>
                            <Wifi className="w-3.5 h-3.5 text-[#26E6DE]" />
                            Online Ready
                          </>
                        ) : (
                          'Between Lectures'
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => handlePingChallenge(m)}
                        className="px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        Challenge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
