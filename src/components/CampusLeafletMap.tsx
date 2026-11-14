import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ClubMember,
  ENP_CAMPUS_MEETUP_ZONES,
  EnpCampusMeetupZone,
} from '../utils/clubData';
import { resolveAssetUrl } from '../utils/assetUrls';

export type CampusMapLayerMode = 'terrain' | 'satellite' | 'streets';

export interface CampusPinData {
  member: ClubMember;
  lat: number;
  lng: number;
  zone: EnpCampusMeetupZone;
  isExactGps: boolean;
  accuracy?: number;
  updatedAt: string;
}

interface CampusLeafletMapProps {
  center: { lat: number; lng: number };
  layerMode: CampusMapLayerMode;
  memberPins: CampusPinData[];
  currentUserId?: string;
  activeMarkerId: string | null;
  onSelectMarker: (markerId: string | null) => void;
}

const TILE_LAYERS: Record<
  CampusMapLayerMode,
  { url: string; attribution: string; maxZoom: number }
> = {
  terrain: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, Garmin, USGS, NPS',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const CampusLeafletMap: React.FC<CampusLeafletMapProps> = ({
  center,
  layerMode,
  memberPins,
  currentUserId,
  activeMarkerId,
  onSelectMarker,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const pinsLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectMarkerRef = useRef(onSelectMarker);
  onSelectMarkerRef.current = onSelectMarker;

  // Initialize Leaflet map instance once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [center.lat, center.lng],
      zoom: 17,
      zoomControl: true,
      attributionControl: true,
    });

    const initialCfg = TILE_LAYERS[layerMode];
    const tileLayer = L.tileLayer(initialCfg.url, {
      attribution: initialCfg.attribution,
      maxZoom: initialCfg.maxZoom,
    }).addTo(map);

    const zonesLayer = L.layerGroup().addTo(map);
    const pinsLayer = L.layerGroup().addTo(map);

    // Render fixed ENP Campus Meetup Zone reference markers
    ENP_CAMPUS_MEETUP_ZONES.forEach((zone) => {
      const marker = L.circleMarker([zone.lat, zone.lng], {
        radius: 5,
        color: '#26E6DE',
        weight: 2,
        fillColor: '#061020',
        fillOpacity: 0.9,
      });
      marker.bindTooltip(escapeHtml(zone.shortTag), {
        permanent: true,
        direction: 'bottom',
        offset: [0, 4],
        className: 'enp-zone-tooltip',
      });
      marker.addTo(zonesLayer);
    });

    map.on('click', () => {
      onSelectMarkerRef.current(null);
    });

    mapRef.current = map;
    tileLayerRef.current = tileLayer;
    zonesLayerRef.current = zonesLayer;
    pinsLayerRef.current = pinsLayer;

    // Force size invalidation after initial mount in responsive container
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      zonesLayerRef.current = null;
      pinsLayerRef.current = null;
    };
  }, []);

  // Swap tile layer when Terrain / Satellite / Streets mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const cfg = TILE_LAYERS[layerMode];
    const nextLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(map);
    tileLayerRef.current = nextLayer;
  }, [layerMode]);

  // Sync live opted-in member avatar markers
  useEffect(() => {
    const map = mapRef.current;
    const pinsLayer = pinsLayerRef.current;
    if (!map || !pinsLayer) return;

    pinsLayer.clearLayers();

    memberPins.forEach((pin) => {
      const markerKey = `member-${pin.member.id}`;
      const isMe = currentUserId === pin.member.id;
      const isSelected = activeMarkerId === markerKey;
      const ringColor = pin.isExactGps
        ? '#34d399'
        : isMe
        ? '#26E6DE'
        : '#FF6B00';
      const firstName = escapeHtml(pin.member.name.split(' ')[0]);
      const avatarSrc = pin.member.avatarUrl
        ? escapeHtml(resolveAssetUrl(pin.member.avatarUrl))
        : '';
      const initials = escapeHtml(pin.member.avatarInitials);
      const bg = escapeHtml(pin.member.avatarColor || '#1E56A0');

      const avatarInner = avatarSrc
        ? `<img src="${avatarSrc}" alt="${firstName}" style="width:100%;height:100%;object-fit:cover;border-radius:9999px;" referrerpolicy="no-referrer" />`
        : `<span style="font-size:11px;font-weight:800;color:#fff;">${initials}</span>`;

      const html = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-85%) ${
          isSelected ? 'scale(1.12)' : 'scale(1)'
        };transition:transform 0.15s ease;">
          <div style="width:40px;height:40px;border-radius:9999px;overflow:hidden;border:3px solid ${ringColor};background:${bg};display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,0.65);">
            ${avatarInner}
          </div>
          <div style="margin-top:2px;padding:1px 6px;border-radius:6px;background:rgba(6,16,32,0.92);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.5);">
            ${firstName} · ${pin.member.fide.rapid}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html,
        className: 'enp-custom-member-pin',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const m = L.marker([pin.lat, pin.lng], { icon });
      m.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        onSelectMarkerRef.current(isSelected ? null : markerKey);
      });
      m.addTo(pinsLayer);
    });
  }, [memberPins, currentUserId, activeMarkerId]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full z-0" />
    </div>
  );
};
