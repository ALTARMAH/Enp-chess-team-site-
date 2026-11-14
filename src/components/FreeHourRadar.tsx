import React, { useState, useEffect, useRef } from 'react';
import {
  ClubMember,
  ClubThemeConfig,
  ENP_CAMPUS_MEETUP_ZONES,
  EnpCampusMeetupZone,
} from '../utils/clubData';
import { resolveAssetUrl } from '../utils/assetUrls';
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
  const [activeInfoMarkerId, setActiveInfoMarkerId] = useState<string | null>(null);
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

  // Strictly show ONLY members who actually granted browser GPS permission (zero fabricated pins)
  const onlineMembersOnMap = members.filter(
    (m) =>
      Boolean(m.gpsLocation?.isLiveBrowserGps) &&
      typeof m.gpsLocation?.lat === 'number' &&
      typeof m.gpsLocation?.lng === 'number'
  );

  const memberMapPins = onlineMembersOnMap.map((m) => {
    const zone = getZoneById(m.campusMeetupZoneId);
    return {
      member: m,
      lat: m.gpsLocation!.lat,
      lng: m.gpsLocation!.lng,
      zone,
      isExactGps: true,
      accuracy: m.gpsLocation!.accuracyMeters,
      updatedAt: m.gpsLocation!.updatedAt,
    };
  });

  // Relative equirectangular projection for Zero-Key Campus GPS Radar centered on ENP El Harrach
  const projectToRadarPercent = (lat: number, lng: number) => {
    const latSpan = 0.0032; // ~350m vertical span across ENP campus
    const lngSpan = 0.0042; // ~380m horizontal span across ENP campus
    const rawX = 50 + ((lng - ENP_CAMPUS_CENTER.lng) / lngSpan) * 80;
    const rawY = 50 - ((lat - ENP_CAMPUS_CENTER.lat) / latSpan) * 80;
    return {
      xPct: Math.max(8, Math.min(92, rawX)),
      yPct: Math.max(12, Math.min(88, rawY)),
    };
  };

  const selectedRadarPin =
    memberMapPins.find((p) => `member-${p.member.id}` === activeInfoMarkerId) || null;

  return (
    <section className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2.5 sm:gap-4 border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <h2 className="text-lg sm:text-3xl font-extrabold text-white mt-0.5">
            “Who’s Free This Hour” &amp; Live Campus GPS
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-300 mt-1 max-w-3xl">
            See online members on campus or broadcast your exact GPS coordinates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={handleShareLiveGps}
            className={`min-h-[32px] sm:min-h-[42px] px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg ${
              gpsWatchStatus === 'tracking'
                ? 'bg-emerald-500 text-[#040B16] shadow-emerald-500/25'
                : 'bg-[#FF6B00] hover:bg-[#FF8533] text-white shadow-[#FF6B00]/25'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>
              {gpsWatchStatus === 'tracking'
                ? 'GPS Active (Stop)'
                : gpsWatchStatus === 'requesting'
                ? 'Locating...'
                : 'Share Live GPS'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleEditMode}
            className={`min-h-[32px] sm:min-h-[42px] px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              editMyHoursMode
                ? 'bg-[#26E6DE] text-[#061020] shadow'
                : currentUser
                ? 'bg-[#1E56A0] hover:bg-[#2563EB] text-white'
                : 'bg-white/8 hover:bg-white/15 border border-white/15 text-slate-200'
            }`}
          >
            {!currentUser && <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#FF6B00]" />}
            {editMyHoursMode
              ? `✓ Done (${editingMember?.name.split(' ')[0]})`
              : currentUser
              ? 'Edit Free Hours'
              : 'Sign In to Edit'}
          </button>
        </div>
      </div>

      {gpsStatusMessage && (
        <div
          className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border text-[11px] sm:text-xs font-mono-tabular flex flex-wrap items-center justify-between gap-2 ${
            gpsWatchStatus === 'tracking'
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
              : gpsWatchStatus === 'denied'
              ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
              : 'bg-[#1E56A0]/25 border-[#26E6DE]/40 text-[#26E6DE]'
          }`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-[#FF6B00]" />
            <span>{gpsStatusMessage}</span>
          </div>
          {currentUser && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-slate-300 font-sans">Spot:</span>
              <select
                aria-label="Select my ENP campus meetup zone"
                value={currentUser.campusMeetupZoneId || 'zone-jardins-library'}
                onChange={(e) =>
                  onUpdateMemberMeetupZone?.(currentUser.id, e.target.value)
                }
                className="px-2 py-1 rounded-lg bg-[#061020] border border-white/20 text-white font-sans font-bold text-[11px] sm:text-xs"
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
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-[11px] sm:text-sm text-emerald-200 font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{challengeToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setChallengeToast('')}
            className="text-[11px] sm:text-xs underline text-emerald-300 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* LIVE CAMPUS GPS RADAR (Google Maps when VITE_GOOGLE_MAPS_API_KEY is set, Zero-Key Interactive Campus Radar otherwise) */}
      <div className="w-full">
        <div className="w-full broadcast-panel rounded-2xl overflow-hidden flex flex-col border border-[#26E6DE]/30">
          <div className="p-2.5 sm:p-4 border-b border-white/10 bg-[#061020]/90 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[9px] sm:text-[10px] font-mono-tabular uppercase text-[#FF6B00] font-bold flex items-center gap-1.5">
                <Compass className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                LIVE CAMPUS GPS RADAR · {memberMapPins.length} LIVE GPS ON MAP
              </span>
              <h3 className="text-xs sm:text-base font-bold text-white">
                {memberMapPins.length > 0
                  ? 'Live GPS Shared Positions (Tap Avatar to Challenge)'
                  : 'Campus GPS Map (Waiting for Live GPS Opt-In)'}
              </h3>
            </div>

            {currentUser && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-[11px] text-slate-400">My Spot:</span>
                <select
                  aria-label="Quick switch my campus meetup zone"
                  value={currentUser.campusMeetupZoneId || 'zone-jardins-library'}
                  onChange={(e) => {
                    onUpdateMemberMeetupZone?.(currentUser.id, e.target.value);
                  }}
                  className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#040B16] border border-[#26E6DE]/40 text-[11px] sm:text-xs font-bold text-[#26E6DE]"
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

          <div className="relative w-full h-[270px] sm:h-[440px] bg-[#040B16] overflow-hidden">
            {MAPS_API_KEY ? (
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
                            <span
                              className={`absolute -inset-1 rounded-full blur-xs opacity-70 ${
                                pin.isExactGps
                                  ? 'bg-emerald-400'
                                  : isMe
                                  ? 'bg-[#26E6DE]'
                                  : 'bg-[#FF6B00]'
                              }`}
                            />
                            <div
                              className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-[3px] shadow-[0_8px_20px_rgba(0,0,0,0.75)] flex items-center justify-center bg-[#061020] ${
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
                                  src={resolveAssetUrl(pin.member.avatarUrl)}
                                  alt={pin.member.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[11px] sm:text-xs font-extrabold text-white">
                                  {pin.member.avatarInitials}
                                </span>
                              )}
                            </div>
                            <span className="absolute bottom-1 right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-400 border-2 border-[#061020] shadow" />
                            <div
                              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rotate-45 -mt-1.5 ${
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
                                    src={resolveAssetUrl(pin.member.avatarUrl)}
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
            ) : (
              /* ZERO-KEY INTERACTIVE ENP CAMPUS GPS RADAR (Works immediately on Vercel & Firebase without Maps Billing) */
              <div
                className="relative w-full h-full select-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 50% 50%, rgba(38,230,222,0.12) 0%, rgba(6,16,32,0.92) 72%), linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
                  backgroundSize: '100% 100%, 36px 36px, 36px 36px',
                }}
              >
                {/* Concentric Radar Rings */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-[160px] h-[160px] sm:w-[230px] sm:h-[230px] rounded-full border border-[#26E6DE]/15" />
                  <div className="absolute w-[250px] h-[250px] sm:w-[370px] sm:h-[370px] rounded-full border border-[#26E6DE]/10" />
                </div>

                {/* Top Radar Coordinate Tag */}
                <div className="absolute top-2.5 left-2.5 sm:top-3.5 sm:left-4 z-10 px-2 py-1 rounded-lg bg-[#061020]/90 border border-white/15 text-[9px] sm:text-[10px] font-mono-tabular text-slate-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ENP El Harrach · 36.723°N, 3.150°E</span>
                </div>

                {/* Campus Meetup Zone Landmarks */}
                {ENP_CAMPUS_MEETUP_ZONES.map((zone) => {
                  const { xPct, yPct } = projectToRadarPercent(zone.lat, zone.lng);
                  return (
                    <div
                      key={zone.id}
                      style={{ left: `${xPct}%`, top: `${yPct}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center opacity-70"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#26E6DE]/70" />
                      <span className="mt-0.5 px-1.5 py-0.5 rounded bg-[#061020]/80 border border-white/10 text-[8px] sm:text-[9px] font-mono-tabular text-slate-300 whitespace-nowrap">
                        {zone.shortTag}
                      </span>
                    </div>
                  );
                })}

                {/* Live Online & Exact GPS Member Avatars */}
                {memberMapPins.map((pin) => {
                  const markerKey = `member-${pin.member.id}`;
                  const isMe = currentUser?.id === pin.member.id;
                  const isSelected = activeInfoMarkerId === markerKey;
                  const { xPct, yPct } = projectToRadarPercent(pin.lat, pin.lng);

                  return (
                    <button
                      key={markerKey}
                      type="button"
                      onClick={() =>
                        setActiveInfoMarkerId(isSelected ? null : markerKey)
                      }
                      style={{ left: `${xPct}%`, top: `${yPct}%` }}
                      aria-label={`Locate ${pin.member.name} on ENP Campus GPS Radar`}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center cursor-pointer transition-transform ${
                        isSelected ? 'scale-115 z-30' : 'hover:scale-110'
                      }`}
                    >
                      <span
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 sm:border-[3px] shadow-xl flex items-center justify-center bg-[#061020] ${
                          pin.isExactGps
                            ? 'border-emerald-400 ring-2 ring-emerald-400/40'
                            : isMe
                            ? 'border-[#26E6DE] ring-2 ring-[#26E6DE]/40'
                            : 'border-[#FF6B00]'
                        }`}
                        style={{ backgroundColor: pin.member.avatarColor }}
                      >
                        {pin.member.avatarUrl ? (
                          <img
                            src={resolveAssetUrl(pin.member.avatarUrl)}
                            alt={pin.member.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] sm:text-xs font-extrabold text-white">
                            {pin.member.avatarInitials}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 px-1.5 py-0.5 rounded bg-[#061020]/95 border border-white/15 text-[9px] font-bold text-white whitespace-nowrap shadow">
                        {pin.member.name.split(' ')[0]} · {pin.member.fide.rapid}
                      </span>
                    </button>
                  );
                })}

                {memberMapPins.length === 0 && (
                  <div className="pointer-events-none absolute inset-x-3 bottom-3 sm:inset-x-auto sm:left-4 sm:bottom-4 z-20 px-3 py-2 rounded-xl bg-[#061020]/90 border border-white/15 backdrop-blur-md text-[10px] sm:text-xs text-slate-300 max-w-sm">
                    No members are sharing live GPS right now. Sign in and tap{' '}
                    <span className="text-[#FF6B00] font-bold">Share Live GPS</span> to grant browser location permission and appear on the map.
                  </div>
                )}

                {/* Tapped Member Details & Challenge Card */}
                {selectedRadarPin && (
                  <div className="absolute bottom-2.5 right-2.5 left-2.5 sm:left-auto sm:w-72 z-40 p-2.5 sm:p-3 rounded-xl bg-[#061020]/95 backdrop-blur-md border border-[#26E6DE]/45 shadow-2xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-white truncate">
                          {selectedRadarPin.member.name}
                        </div>
                        <div className="text-[10px] font-mono-tabular text-[#26E6DE]">
                          {selectedRadarPin.member.fide.rapid} Rapid ·{' '}
                          {selectedRadarPin.isExactGps
                            ? `Live GPS (±${selectedRadarPin.accuracy || 10}m)`
                            : selectedRadarPin.zone.shortTag}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveInfoMarkerId(null)}
                        className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://www.google.com/maps?q=${selectedRadarPin.lat},${selectedRadarPin.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 text-center text-[10px] font-bold text-slate-200"
                      >
                        Open Coordinates
                      </a>
                      {currentUser?.id !== selectedRadarPin.member.id && (
                        <button
                          type="button"
                          onClick={() => handlePingChallenge(selectedRadarPin.member)}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-[#FF6B00] hover:bg-[#FF8533] text-white text-[10px] font-bold cursor-pointer"
                        >
                          Challenge
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WEEKLY FREE-HOUR SCHEDULE MATRIX + MATCHMAKING */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        <div className="lg:col-span-8 broadcast-panel p-3 sm:p-6 rounded-2xl space-y-3 sm:space-y-4 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] sm:text-xs font-semibold text-slate-300">
              {editMyHoursMode && editingMember
                ? `Tap hours to toggle availability for ${editingMember.name}:`
                : `Tap any hour slot to see free ${clubConfig.clubName} players:`}
            </div>
            <span className="text-[11px] sm:text-xs font-mono-tabular text-[#26E6DE] font-bold">
              Slot: {selectedSlotLabel}
            </span>
          </div>

          <table className="w-full border-collapse text-[10px] sm:text-xs font-mono-tabular min-w-[460px] sm:min-w-[600px]">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="py-1.5 sm:py-2.5 px-1.5 sm:px-2 text-left">Hour</th>
                {days.map((day) => (
                  <th key={day} className="py-1.5 sm:py-2.5 px-1 sm:px-2 text-center font-sans font-bold text-white">
                    {day.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {HOURS.map((hr) => (
                <tr key={hr}>
                  <td className="py-1.5 px-1.5 sm:px-2 font-bold text-slate-400 whitespace-nowrap">
                    {hr.toString().padStart(2, '0')}:00
                  </td>
                  {days.map((day, dIdx) => {
                    const key = `${dIdx}-${hr}`;
                    const count = members.filter((m) => m.freeSlots.includes(key)).length;
                    const isSelected = selectedSlot === key;
                    const mySlotActive = editingMember?.freeSlots.includes(key) ?? false;

                    return (
                      <td key={key} className="p-0.5 sm:p-1">
                        <button
                          type="button"
                          onClick={() => handleCellClick(key)}
                          aria-label={`${day} ${hr}:00 — ${count} players free`}
                          className={`w-full py-1.5 sm:py-2 px-1 rounded-lg sm:rounded-xl font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
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
                          <span>{count}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-4 broadcast-panel p-3.5 sm:p-6 rounded-2xl space-y-3 sm:space-y-4">
          <div className="border-b border-white/10 pb-2.5 sm:pb-3">
            <span className="text-[10px] sm:text-xs font-mono-tabular uppercase text-[#FF6B00] font-bold">
              {clubConfig.clubName.toUpperCase()} OTB MATCHMAKING
            </span>
            <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">{selectedSlotLabel}</h3>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              {membersFreeInSlot.length} members available in this slot.
            </p>
          </div>

          {membersFreeInSlot.length === 0 ? (
            <div className="p-4 sm:p-6 text-center rounded-xl bg-[#061020]/70 text-[11px] sm:text-xs text-slate-400 space-y-2.5">
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
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl bg-[#FF6B00] text-white text-[11px] sm:text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                {!currentUser && <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                {currentUser ? '+ Mark Myself Free' : 'Sign In to Mark Free'}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {membersFreeInSlot.map((m) => {
                const memberZone = getZoneById(m.campusMeetupZoneId);
                return (
                  <div
                    key={m.id}
                    className="p-2.5 sm:p-3.5 rounded-xl bg-[#061020]/75 border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 truncate">
                          <span className="truncate">{m.name}</span>
                          {m.gpsLocation?.isLiveBrowserGps && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono-tabular text-[9px] font-bold shrink-0">
                              LIVE GPS
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{m.department}</div>
                        <div className="text-[10px] sm:text-[11px] font-mono-tabular text-[#26E6DE] mt-0.5">
                          Meetup: {memberZone.shortTag}
                        </div>
                      </div>
                      <div className="text-right font-mono-tabular shrink-0">
                        <div className="text-xs sm:text-sm font-extrabold text-[#FF6B00]">
                          {m.fide.rapid} Rapid
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-[#26E6DE]">Blitz {m.fide.blitz}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
                      <span className="text-[11px] sm:text-xs font-medium text-slate-300 flex items-center gap-1">
                        {m.liveStatus === 'campus_otb' ? (
                          <>
                            <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#FF6B00]" />
                            {memberZone.shortTag}
                          </>
                        ) : m.liveStatus === 'online_ready' ? (
                          <>
                            <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#26E6DE]" />
                            Online Ready
                          </>
                        ) : m.liveStatus === 'in_lecture' ? (
                          'In Lecture'
                        ) : (
                          'Offline'
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => handlePingChallenge(m)}
                        className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#FF8533] text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Swords className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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
