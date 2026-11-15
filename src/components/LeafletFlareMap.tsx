import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type LeafletTileMode = 'osm' | 'satellite' | 'dark';

export interface LeafletReceptorPin {
  id: string;
  index: number;
  name: string;
  x: number;
  y: number;
  z: number;
  lat: number;
  lng: number;
  radiationKw: number;
  apiLimitKw: number;
  noiseDba: number;
  isPass: boolean;
  zone: string;
  exRequirement: string;
}

export interface LeafletIsoplethOverlay {
  levelKw: number;
  color: string;
  paths: Array<{ lat: number; lng: number }>;
}

interface LeafletFlareMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  tileMode: LeafletTileMode;
  heightClass?: string;
  stackLatLng: { lat: number; lng: number };
  stackInfo: {
    locationX: number;
    locationY: number;
    stackHeight: number;
    windSpeed?: number;
    windDirection?: number;
    flameTiltDeg?: number;
  };
  hazardousArea: {
    zone1RadiusM: number;
    zone2RadiusM: number;
  };
  showHazardousZones?: boolean;
  noise85RadiusM?: number;
  isoplethPolygons?: LeafletIsoplethOverlay[];
  windLine?: Array<{ lat: number; lng: number }>;
  receptors: LeafletReceptorPin[];
  candidateMarker?: { lat: number; lng: number; isEditing: boolean } | null;
  activePopupId?: string | null;
  onSelectReceptor?: (id: string) => void;
  onEditReceptor?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  focusTrigger?: number;
}

const TILE_SOURCES: Record<
  LeafletTileMode,
  { url: string; attribution: string; maxZoom: number }
> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
  },
};

function createPinIcon(bg: string, border: string, textColor: string, label: string, size = 28) {
  return L.divIcon({
    className: 'flaresim-leaflet-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      background:${bg};
      border:2.5px solid ${border};
      color:${textColor};
      font-weight:800;
      font-size:11px;
      font-family:monospace;
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 3px 10px rgba(0,0,0,0.55);
      cursor:pointer;
    ">${label}</div>`,
  });
}

export const LeafletFlareMap: React.FC<LeafletFlareMapProps> = ({
  center,
  zoom = 17,
  tileMode,
  heightClass = 'h-[460px]',
  stackLatLng,
  stackInfo,
  hazardousArea,
  showHazardousZones = true,
  noise85RadiusM,
  isoplethPolygons = [],
  windLine,
  receptors,
  candidateMarker,
  activePopupId,
  onSelectReceptor,
  onEditReceptor,
  onMapClick,
  focusTrigger = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Record<string, L.Marker>>({});

  // Keep latest callbacks in refs so map listeners never go stale
  const onMapClickRef = useRef(onMapClick);
  const onSelectReceptorRef = useRef(onSelectReceptor);
  const onEditReceptorRef = useRef(onEditReceptor);
  onMapClickRef.current = onMapClick;
  onSelectReceptorRef.current = onSelectReceptor;
  onEditReceptorRef.current = onEditReceptor;

  // 1. Initialize Leaflet Map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
    });

    const overlayGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayGroupRef.current = overlayGroup;

    map.on('click', (ev: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(ev.latlng.lat, ev.latlng.lng);
      }
    });

    // Ensure tiles render cleanly when inside conditional/tabbed layouts
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      overlayGroupRef.current = null;
      markersByIdRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Switch Tile Layer cleanly when tileMode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const src = TILE_SOURCES[tileMode];
    const layer = L.tileLayer(src.url, {
      attribution: src.attribution,
      maxZoom: src.maxZoom,
    }).addTo(map);
    tileLayerRef.current = layer;
  }, [tileMode]);

  // 3. Pan/Center when center prop updates explicitly or focusTrigger fires
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([center.lat, center.lng], focusTrigger > 0 ? zoom : map.getZoom(), {
      animate: true,
    });
  }, [center.lat, center.lng, focusTrigger, zoom]);

  // 4. Render Overlays & Markers whenever data changes
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    markersByIdRef.current = {};

    // Isopleth Polygons (API 521 Radiation Contours)
    isoplethPolygons.forEach((iso) => {
      if (iso.paths.length >= 3) {
        L.polygon(
          iso.paths.map((p) => [p.lat, p.lng] as [number, number]),
          {
            color: iso.color,
            weight: 2,
            opacity: 0.9,
            fillColor: iso.color,
            fillOpacity: 0.14,
            interactive: false,
          }
        ).addTo(group);
      }
    });

    // Hazardous Area Zone 2 & Zone 1 Circles
    if (showHazardousZones) {
      L.circle([stackLatLng.lat, stackLatLng.lng], {
        radius: Math.max(0.5, hazardousArea.zone2RadiusM),
        color: '#f59e0b',
        weight: 2,
        opacity: 0.85,
        fillColor: '#f59e0b',
        fillOpacity: 0.13,
        dashArray: '6 4',
        interactive: false,
      }).addTo(group);

      L.circle([stackLatLng.lat, stackLatLng.lng], {
        radius: Math.max(0.5, hazardousArea.zone1RadiusM),
        color: '#ef4444',
        weight: 2.5,
        opacity: 0.9,
        fillColor: '#ef4444',
        fillOpacity: 0.25,
        interactive: false,
      }).addTo(group);
    }

    // Noise 85 dBA boundary circle
    if (noise85RadiusM && noise85RadiusM > 2) {
      L.circle([stackLatLng.lat, stackLatLng.lng], {
        radius: noise85RadiusM,
        color: '#38bdf8',
        weight: 1.5,
        opacity: 0.85,
        fillColor: '#38bdf8',
        fillOpacity: 0.03,
        dashArray: '5 4',
        interactive: false,
      }).addTo(group);
    }

    // Wind Vector Line
    if (windLine && windLine.length >= 2) {
      L.polyline(
        windLine.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color: '#38bdf8',
          weight: 3,
          opacity: 0.9,
          interactive: false,
        }
      ).addTo(group);
    }

    // Candidate New/Edit Receptor Marker
    if (candidateMarker) {
      const candMarker = L.marker([candidateMarker.lat, candidateMarker.lng], {
        icon: createPinIcon(
          candidateMarker.isEditing ? '#a855f7' : '#38bdf8',
          candidateMarker.isEditing ? '#581c87' : '#0c4a6e',
          '#ffffff',
          candidateMarker.isEditing ? 'E' : '+',
          26
        ),
        zIndexOffset: 500,
      }).addTo(group);
      candMarker.bindTooltip(
        candidateMarker.isEditing ? 'Posisi Baru Reseptor yang Diedit' : 'Kandidat Reseptor Baru',
        { direction: 'top' }
      );
    }

    // Flare Stack Center Marker
    const stackMarker = L.marker([stackLatLng.lat, stackLatLng.lng], {
      icon: createPinIcon('#f59e0b', '#78350f', '#0f172a', 'F', 30),
      zIndexOffset: 700,
    }).addTo(group);

    const stackPopupEl = document.createElement('div');
    stackPopupEl.className = 'text-slate-900 text-xs space-y-1 min-w-[190px]';
    stackPopupEl.innerHTML = `
      <div class="font-bold text-amber-700">Flare Stack (H = ${stackInfo.stackHeight} m)</div>
      <div class="font-mono text-[11px]">Lokal: (X: ${stackInfo.locationX}m, Y: ${stackInfo.locationY}m)</div>
      <div class="font-mono text-[11px]">GPS: ${stackLatLng.lat.toFixed(6)}, ${stackLatLng.lng.toFixed(6)}</div>
      <div class="text-[11px] font-semibold text-rose-700">Zone 1: R ≤ ${hazardousArea.zone1RadiusM}m | Zone 2: R ≤ ${hazardousArea.zone2RadiusM}m</div>
      ${
        stackInfo.windSpeed !== undefined
          ? `<div class="text-[11px] text-slate-700">Angin: ${stackInfo.windSpeed} m/s dari ${stackInfo.windDirection}° · Tilt ${stackInfo.flameTiltDeg?.toFixed(1)}°</div>`
          : ''
      }
    `;
    stackMarker.bindPopup(stackPopupEl);
    markersByIdRef.current['stack_marker'] = stackMarker;

    // Receptor Markers
    receptors.forEach((rec) => {
      const pinBg = !rec.isPass
        ? '#ef4444'
        : rec.zone === 'Zone 1'
        ? '#f97316'
        : rec.zone === 'Zone 2'
        ? '#eab308'
        : '#10b981';

      const recMarker = L.marker([rec.lat, rec.lng], {
        icon: createPinIcon(pinBg, '#0f172a', '#ffffff', `${rec.index}`, 27),
        zIndexOffset: 600,
      }).addTo(group);

      const popupEl = document.createElement('div');
      popupEl.className = 'text-slate-900 text-xs space-y-1 min-w-[210px]';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'font-bold text-slate-900';
      titleDiv.textContent = rec.name;
      popupEl.appendChild(titleDiv);

      const coordDiv = document.createElement('div');
      coordDiv.className = 'font-mono text-[11px]';
      coordDiv.textContent = `Koordinat: (X: ${rec.x}m, Y: ${rec.y}m, Z: +${rec.z}m)`;
      popupEl.appendChild(coordDiv);

      const gpsDiv = document.createElement('div');
      gpsDiv.className = 'font-mono text-[11px]';
      gpsDiv.textContent = `GPS: ${rec.lat.toFixed(6)}, ${rec.lng.toFixed(6)}`;
      popupEl.appendChild(gpsDiv);

      const radDiv = document.createElement('div');
      radDiv.className = 'text-[11px]';
      radDiv.innerHTML = `Radiasi: <strong>${rec.radiationKw.toFixed(2)} kW/m²</strong> (Batas: ${rec.apiLimitKw}) · ${rec.noiseDba.toFixed(1)} dBA`;
      popupEl.appendChild(radDiv);

      const zoneDiv = document.createElement('div');
      zoneDiv.className = 'text-[11px] font-bold text-rose-700';
      zoneDiv.textContent = `Zona: ${rec.zone} — ${rec.exRequirement}`;
      popupEl.appendChild(zoneDiv);

      if (onEditReceptorRef.current) {
        const btnWrap = document.createElement('div');
        btnWrap.className = 'pt-1';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className =
          'px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] cursor-pointer';
        editBtn.textContent = 'Edit Reseptor Ini';
        editBtn.onclick = (e) => {
          e.stopPropagation();
          onEditReceptorRef.current?.(rec.id);
        };
        btnWrap.appendChild(editBtn);
        popupEl.appendChild(btnWrap);
      }

      recMarker.bindPopup(popupEl);
      recMarker.on('click', () => {
        onSelectReceptorRef.current?.(rec.id);
      });
      markersByIdRef.current[rec.id] = recMarker;
    });

    if (activePopupId && markersByIdRef.current[activePopupId]) {
      markersByIdRef.current[activePopupId].openPopup();
    }
  }, [
    stackLatLng.lat,
    stackLatLng.lng,
    stackInfo,
    hazardousArea.zone1RadiusM,
    hazardousArea.zone2RadiusM,
    showHazardousZones,
    noise85RadiusM,
    isoplethPolygons,
    windLine,
    receptors,
    candidateMarker,
    activePopupId,
  ]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClass} rounded-xl overflow-hidden border border-slate-700/80 relative z-10`}
    />
  );
};
