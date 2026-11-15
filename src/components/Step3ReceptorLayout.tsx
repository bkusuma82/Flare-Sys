import React, { useState, useEffect, useMemo } from 'react';
import {
  LeafletFlareMap,
  LeafletTileMode,
  LeafletReceptorPin,
} from './LeafletFlareMap';
import {
  FlareStackConfig,
  Receptor,
  StackSupportType,
  SimulationResults,
} from '../types/flaresim';
import {
  DEFAULT_ORIGIN_LAT,
  DEFAULT_ORIGIN_LNG,
  localMetersToLatLng,
  latLngToLocalMeters,
} from '../utils/flareCalculations';
import {
  MapPin,
  Plus,
  Trash2,
  Building,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Crosshair,
  Globe,
  Layers,
  Flame,
  Pencil,
  Check,
  X,
} from 'lucide-react';

interface Step3ReceptorLayoutProps {
  stack: FlareStackConfig;
  setStack: React.Dispatch<React.SetStateAction<FlareStackConfig>>;
  receptors: Receptor[];
  setReceptors: React.Dispatch<React.SetStateAction<Receptor[]>>;
  results: SimulationResults;
  onNext: () => void;
  onPrev: () => void;
}

const SUPPORT_TYPES: Array<{
  id: StackSupportType;
  name: string;
  desc: string;
  heightRange: string;
}> = [
  {
    id: 'self_supported',
    name: 'Self-Supported (Tiang Bebas Mandiri)',
    desc: 'Struktur baja tabung tunggal tanpa kawat penopang. Membutuhkan pondasi besar dan ketebalan dinding baja bawah yang tebal.',
    heightRange: 'Optimal untuk tinggi < 50 m',
  },
  {
    id: 'guyed',
    name: 'Guyed Wire Supported (Kawat Penopang)',
    desc: 'Menggunakan kabel kawat baja (guy wires) ke 3 blok angkur di tanah. Bobot baja tiang paling ringan dan ekonomis, namun memakan tapak tanah (plot plan) luas.',
    heightRange: 'Sangat hemat untuk tinggi 30 – 120 m',
  },
  {
    id: 'derrick',
    name: 'Derrick Supported (Rangka Lattice)',
    desc: 'Tiang suar diletakkan di dalam rangka menara baja truss struktural 3 atau 4 kaki. Tapak lahan kompak, cocok untuk lokasi offshore atau lahan terbatas.',
    heightRange: 'Untuk tinggi 40 – 150 m & offshore',
  },
];

export const Step3ReceptorLayout: React.FC<Step3ReceptorLayoutProps> = ({
  stack,
  setStack,
  receptors,
  setReceptors,
  results,
  onNext,
  onPrev,
}) => {
  const originLat = stack.originLat ?? DEFAULT_ORIGIN_LAT;
  const originLng = stack.originLng ?? DEFAULT_ORIGIN_LNG;

  const stackLatLng = useMemo(
    () => localMetersToLatLng(stack.locationX, stack.locationY, originLat, originLng),
    [stack.locationX, stack.locationY, originLat, originLng]
  );

  // Map UI controls
  const [mapClickMode, setMapClickMode] = useState<'receptor' | 'stack'>('receptor');
  const [tileMode, setTileMode] = useState<LeafletTileMode>('osm');
  const [showHazardousZones, setShowHazardousZones] = useState<boolean>(true);
  const [showIsoplethOverlay, setShowIsoplethOverlay] = useState<boolean>(true);
  const [autoAddOnClick, setAutoAddOnClick] = useState<boolean>(false);
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(stackLatLng);
  const [focusTrigger, setFocusTrigger] = useState<number>(0);

  // New receptor form state (dual sync X/Y meters & Lat/Lng)
  const [newRecName, setNewRecName] = useState('');
  const [newRecX, setNewRecX] = useState<number>(75);
  const [newRecY, setNewRecY] = useState<number>(50);
  const [newRecZ, setNewRecZ] = useState<number>(1.5);
  const initialNewLatLng = localMetersToLatLng(75, 50, originLat, originLng);
  const [newRecLat, setNewRecLat] = useState<number>(initialNewLatLng.lat);
  const [newRecLng, setNewRecLng] = useState<number>(initialNewLatLng.lng);
  const [coordInputMode, setCoordInputMode] = useState<'cartesian' | 'latlng'>('cartesian');
  const [newRecLimit, setNewRecLimit] = useState<number>(1.58);
  const [newRecNoise, setNewRecNoise] = useState<number>(85);
  const [newRecCategory, setNewRecCategory] = useState<Receptor['category']>('walkway');
  const [editingReceptorId, setEditingReceptorId] = useState<string | null>(null);

  // Keep preview LatLng synced when origin moves in Cartesian mode
  useEffect(() => {
    const updated = localMetersToLatLng(newRecX, newRecY, originLat, originLng);
    setNewRecLat(updated.lat);
    setNewRecLng(updated.lng);
  }, [originLat, originLng]);

  const handleCartesianChange = (xVal: number, yVal: number) => {
    setNewRecX(xVal);
    setNewRecY(yVal);
    const geo = localMetersToLatLng(xVal, yVal, originLat, originLng);
    setNewRecLat(geo.lat);
    setNewRecLng(geo.lng);
  };

  const handleLatLngChange = (latVal: number, lngVal: number) => {
    setNewRecLat(latVal);
    setNewRecLng(lngVal);
    const local = latLngToLocalMeters(latVal, lngVal, originLat, originLng);
    setNewRecX(local.x);
    setNewRecY(local.y);
  };

  const handleAddReceptor = (overrideCoords?: { x: number; y: number; lat: number; lng: number }) => {
    const xVal = overrideCoords ? overrideCoords.x : newRecX;
    const yVal = overrideCoords ? overrideCoords.y : newRecY;
    const latVal = overrideCoords ? overrideCoords.lat : newRecLat;
    const lngVal = overrideCoords ? overrideCoords.lng : newRecLng;

    const cleanName =
      newRecName.trim() || `Reseptor #${receptors.length + 1} (${xVal.toFixed(0)}m, ${yVal.toFixed(0)}m)`;
    const newId = `rec_${Date.now()}`;
    const newReceptor: Receptor = {
      id: newId,
      name: cleanName,
      category: newRecCategory,
      x: xVal,
      y: yVal,
      z: newRecZ,
      lat: latVal,
      lng: lngVal,
      apiLimitKw: newRecLimit,
      noiseLimitDba: newRecNoise,
      notes: `Reseptor (${newRecLimit} kW/m²)`,
    };
    setReceptors((prev) => [...prev, newReceptor]);
    setNewRecName('');
    setActiveInfoId(newId);
  };

  const handleDeleteReceptor = (id: string) => {
    setReceptors((prev) => prev.filter((r) => r.id !== id));
    if (activeInfoId === id) setActiveInfoId(null);
    if (editingReceptorId === id) {
      setEditingReceptorId(null);
      setNewRecName('');
    }
  };

  const handleStartEditReceptor = (rec: Receptor) => {
    const geo = localMetersToLatLng(
      rec.x - stack.locationX,
      rec.y - stack.locationY,
      originLat,
      originLng
    );
    setEditingReceptorId(rec.id);
    setNewRecName(rec.name);
    setNewRecCategory(rec.category);
    setNewRecX(rec.x);
    setNewRecY(rec.y);
    setNewRecZ(rec.z);
    setNewRecLat(geo.lat);
    setNewRecLng(geo.lng);
    setNewRecLimit(rec.apiLimitKw);
    setNewRecNoise(rec.noiseLimitDba);
    setMapClickMode('receptor');
    setAutoAddOnClick(false);
    setMapCenter(geo);
    setActiveInfoId(rec.id);
  };

  const handleCancelEditReceptor = () => {
    setEditingReceptorId(null);
    setNewRecName('');
  };

  const handleSaveEditReceptor = () => {
    if (!editingReceptorId) return;
    const cleanName = newRecName.trim() || `Reseptor (${newRecX.toFixed(0)}m, ${newRecY.toFixed(0)}m)`;
    setReceptors((prev) =>
      prev.map((r) =>
        r.id === editingReceptorId
          ? {
              ...r,
              name: cleanName,
              category: newRecCategory,
              x: newRecX,
              y: newRecY,
              z: newRecZ,
              lat: newRecLat,
              lng: newRecLng,
              apiLimitKw: newRecLimit,
              noiseLimitDba: newRecNoise,
              notes: `Reseptor (${newRecLimit} kW/m², ${newRecNoise} dBA)`,
            }
          : r
      )
    );
    setActiveInfoId(editingReceptorId);
    setEditingReceptorId(null);
    setNewRecName('');
  };

  const handleMapClick = (clickedLatRaw: number, clickedLngRaw: number) => {
    const clickedLat = Math.round(clickedLatRaw * 1e6) / 1e6;
    const clickedLng = Math.round(clickedLngRaw * 1e6) / 1e6;

    if (mapClickMode === 'stack') {
      // Move flare stack origin to clicked location; update receptors' X/Y if they keep their geographical spot
      setStack((prev) => ({
        ...prev,
        originLat: clickedLat,
        originLng: clickedLng,
      }));
      // Keep existing receptors at their relative (X, Y) or recalculate geo seamlessly on next render
      const updatedPreview = localMetersToLatLng(newRecX, newRecY, clickedLat, clickedLng);
      setNewRecLat(updatedPreview.lat);
      setNewRecLng(updatedPreview.lng);
      setActiveInfoId('stack_marker');
    } else {
      const local = latLngToLocalMeters(clickedLat, clickedLng, originLat, originLng);
      setNewRecLat(clickedLat);
      setNewRecLng(clickedLng);
      setNewRecX(local.x);
      setNewRecY(local.y);
      if (autoAddOnClick && !editingReceptorId) {
        handleAddReceptor({
          x: local.x,
          y: local.y,
          lat: clickedLat,
          lng: clickedLng,
        });
      }
    }
  };

  const handleCenterOnStack = () => {
    setMapCenter({ lat: stackLatLng.lat, lng: stackLatLng.lng });
    setFocusTrigger((n) => n + 1);
  };

  const { hazardousArea, isopleths, flame } = results;
  const iso158 = isopleths.find((i) => Math.abs(i.levelKw - 1.58) < 0.1);

  const leafletReceptors: LeafletReceptorPin[] = useMemo(
    () =>
      receptors.map((rec, idx) => {
        const recGeo = localMetersToLatLng(
          rec.x - stack.locationX,
          rec.y - stack.locationY,
          originLat,
          originLng
        );
        const recRes = results.receptors.find((r) => r.receptor.id === rec.id);
        return {
          id: rec.id,
          index: idx + 1,
          name: rec.name,
          x: rec.x,
          y: rec.y,
          z: rec.z,
          lat: recGeo.lat,
          lng: recGeo.lng,
          radiationKw: recRes?.radiationKw ?? 0,
          apiLimitKw: rec.apiLimitKw,
          noiseDba: recRes?.noiseDba ?? 0,
          isPass: recRes ? recRes.isRadiationPass && recRes.isNoisePass : true,
          zone: recRes?.hazardousZone ?? 'Non-Hazardous',
          exRequirement: recRes?.exRequirement ?? 'Non-Ex / General Purpose',
        };
      }),
    [receptors, stack.locationX, stack.locationY, originLat, originLng, results.receptors]
  );

  const isoplethOverlays = useMemo(() => {
    if (!showIsoplethOverlay || !iso158 || !iso158.reachesGround || iso158.radiusDownwind <= 0) return [];
    const yawRad = (flame.flameYawDeg * Math.PI) / 180;
    const shiftDist = (iso158.radiusDownwind - iso158.radiusCrosswind) * 0.65;
    const shiftX = stack.locationX + shiftDist * Math.sin(yawRad);
    const shiftY = stack.locationY + shiftDist * Math.cos(yawRad);
    const pts: Array<{ lat: number; lng: number }> = [];
    const steps = 48;
    for (let s = 0; s < steps; s++) {
      const t = (2 * Math.PI * s) / steps;
      const dAlong = iso158.radiusDownwind * Math.cos(t);
      const dCross = iso158.radiusCrosswind * Math.sin(t);
      const dx = shiftX + dAlong * Math.sin(yawRad) + dCross * Math.cos(yawRad);
      const dy = shiftY + dAlong * Math.cos(yawRad) - dCross * Math.sin(yawRad);
      pts.push(localMetersToLatLng(dx - stack.locationX, dy - stack.locationY, originLat, originLng));
    }
    return [
      {
        levelKw: iso158.levelKw,
        color: '#10b981',
        paths: pts,
      },
    ];
  }, [showIsoplethOverlay, iso158, flame.flameYawDeg, stack.locationX, stack.locationY, originLat, originLng]);

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h2 className="text-base font-bold text-slate-100">
                Tahap 3: Lokasi Flare Stack, Reseptor & Zona Bahaya (OpenStreetMap + Manual)
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              Klik langsung pada peta <strong>OpenStreetMap / Leaflet</strong> (100% gratis tanpa API Key &amp; biaya publish) untuk menempatkan Flare Stack atau titik Reseptor (otomatis terkonversi ke koordinat lokal X, Y meter), atau masukkan koordinat secara manual. Area berbahaya <strong>Zone 1 &amp; Zone 2 (IEC 60079-10-1 / API RP 505)</strong> langsung dipetakan untuk menentukan kebutuhan peralatan <em>Explosion Proof</em>.
            </p>
          </div>

          {/* Hazardous Area Quick Badges */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono flex-shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-rose-950/70 border border-rose-700/70 text-rose-300 font-bold">
              Zone 1: R ≤ {hazardousArea.zone1RadiusM} m
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-950/70 border border-amber-700/70 text-amber-300 font-bold">
              Zone 2: R ≤ {hazardousArea.zone2RadiusM} m
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-sky-300">
              Group {hazardousArea.gasGroup} · {hazardousArea.tempClass}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive OpenStreetMap / Leaflet Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
        {/* Map Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mr-1">
              <Globe className="w-4 h-4 text-amber-400" />
              <span>Mode Klik Peta:</span>
            </span>
            <button
              type="button"
              onClick={() => setMapClickMode('receptor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                mapClickMode === 'receptor'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Pilih / Tambah Reseptor</span>
            </button>
            <button
              type="button"
              onClick={() => setMapClickMode('stack')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                mapClickMode === 'stack'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Pindahkan Flare Stack</span>
            </button>

            {mapClickMode === 'receptor' && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-300 bg-slate-800/80 border border-slate-700 px-2.5 py-1.5 rounded-lg cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAddOnClick}
                  onChange={(e) => setAutoAddOnClick(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Auto-tambah titik saat klik</span>
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-[11px]">
              {(
                [
                  { id: 'osm', label: 'OSM Peta' },
                  { id: 'satellite', label: 'Satelit' },
                  { id: 'dark', label: 'Gelap' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTileMode(t.id)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    tileMode === t.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowHazardousZones(!showHazardousZones)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                showHazardousZones
                  ? 'bg-rose-950/60 border-rose-700/70 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Zone 1 &amp; 2</span>
            </button>

            <button
              type="button"
              onClick={() => setShowIsoplethOverlay(!showIsoplethOverlay)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                showIsoplethOverlay
                  ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Isopleth 1.58 kW</span>
            </button>

            <button
              type="button"
              onClick={handleCenterOnStack}
              className="px-2.5 py-1.5 rounded-lg text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1"
              title="Pusatkan peta ke lokasi Flare Stack"
            >
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>Fokus Stack</span>
            </button>
          </div>
        </div>

        {/* OpenStreetMap / Leaflet Interactive Map Viewport */}
        <LeafletFlareMap
          center={mapCenter}
          zoom={17}
          tileMode={tileMode}
          heightClass="h-[460px]"
          stackLatLng={stackLatLng}
          stackInfo={{
            locationX: stack.locationX,
            locationY: stack.locationY,
            stackHeight: stack.stackHeight,
          }}
          hazardousArea={{
            zone1RadiusM: hazardousArea.zone1RadiusM,
            zone2RadiusM: hazardousArea.zone2RadiusM,
          }}
          showHazardousZones={showHazardousZones}
          isoplethPolygons={isoplethOverlays}
          receptors={leafletReceptors}
          candidateMarker={
            mapClickMode === 'receptor'
              ? { lat: newRecLat, lng: newRecLng, isEditing: Boolean(editingReceptorId) }
              : null
          }
          activePopupId={activeInfoId}
          onSelectReceptor={(id) => setActiveInfoId(id)}
          onEditReceptor={(id) => {
            const found = receptors.find((r) => r.id === id);
            if (found) handleStartEditReceptor(found);
          }}
          onMapClick={handleMapClick}
          focusTrigger={focusTrigger}
        />

        {/* Map Legend & Hazardous Area Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] pt-1">
          <div className="bg-rose-950/30 border border-rose-800/50 rounded-lg p-2.5 flex items-start gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-300 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-300">
                Zone 1 (R ≤ {hazardousArea.zone1RadiusM} m) — Wajib Explosion Proof
              </div>
              <div className="text-slate-400">{hazardousArea.equipmentSpecZone1}</div>
            </div>
          </div>
          <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-2.5 flex items-start gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-300 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-300">
                Zone 2 (R ≤ {hazardousArea.zone2RadiusM} m) — Peralatan Ex ec / Non-Sparking
              </div>
              <div className="text-slate-400">{hazardousArea.equipmentSpecZone2}</div>
            </div>
          </div>
          <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-2.5 flex items-start gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-300 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-emerald-300">
                Safe Area (&gt; {hazardousArea.zone2RadiusM} m) &amp; Isopleth 1.58 kW/m² ({iso158?.reachesGround ? `${iso158.radiusDownwind} m` : 'Aman / Tidak menyentuh tanah'})
              </div>
              <div className="text-slate-400">{hazardousArea.equipmentSpecSafe}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Flare Stack Coordinates & Height Configuration + Receptors Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stack Configuration (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-400" />
            <span>Spesifikasi & Koordinat Tiang Suar (Flare Stack)</span>
          </h3>

          {/* Stack GPS Origin Inputs (Manual Override) */}
          <div className="bg-slate-800/50 border border-slate-700/70 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-amber-300">Koordinat GPS Pusat Flare Stack (WGS84)</span>
              <span className="font-mono text-slate-400">Lokal: ({stack.locationX}, {stack.locationY})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block">Latitude Stack</label>
                <input
                  type="number"
                  step="0.0001"
                  value={originLat}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      setStack((p) => ({ ...p, originLat: v }));
                      setMapCenter((c) => ({ ...c, lat: v }));
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Longitude Stack</label>
                <input
                  type="number"
                  step="0.0001"
                  value={originLng}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      setStack((p) => ({ ...p, originLng: v }));
                      setMapCenter((c) => ({ ...c, lng: v }));
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Stack Height Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
              <span>Tinggi Tiang Awal (Stack Height)</span>
              <span className="font-mono text-amber-400 font-bold text-sm">
                {stack.stackHeight} meter ({(stack.stackHeight * 3.28084).toFixed(0)} ft)
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="130"
              step="0.5"
              value={stack.stackHeight}
              onChange={(e) =>
                setStack((p) => ({ ...p, stackHeight: parseFloat(e.target.value) || 10 }))
              }
              className="w-full accent-amber-500 h-2 bg-slate-700 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>5 m (Skid)</span>
              <span>25 m (Menengah)</span>
              <span>60 m (Tinggi)</span>
              <span>130 m (Super)</span>
            </div>
          </div>

          {/* Stack Diameter */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Diameter Riser (m)
              </label>
              <input
                type="number"
                min="0.025"
                max="3.0"
                step="0.005"
                value={stack.stackDiameter}
                onChange={(e) =>
                  setStack((p) => ({
                    ...p,
                    stackDiameter: parseFloat(e.target.value) || 0.025,
                  }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                {(stack.stackDiameter * 1000).toFixed(0)} mm ({(stack.stackDiameter * 39.37).toFixed(1)}")
              </span>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Gas Group / Temp Class
              </label>
              <div className="text-xs font-mono text-amber-300 font-bold bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
                Group {hazardousArea.gasGroup} · {hazardousArea.tempClass}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                IEC 60079-10-1 Ex Basis
              </span>
            </div>
          </div>

          {/* Quick Riser Pipe Sizes starting from 1" */}
          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">
              Pilihan Pipa Riser Standar (Mulai 1"):
            </span>
            <div className="flex flex-wrap gap-1">
              {[
                { nps: '1"', m: 0.025 },
                { nps: '1.5"', m: 0.04 },
                { nps: '2"', m: 0.05 },
                { nps: '3"', m: 0.08 },
                { nps: '4"', m: 0.10 },
                { nps: '6"', m: 0.15 },
                { nps: '8"', m: 0.20 },
                { nps: '10"', m: 0.25 },
                { nps: '12"', m: 0.30 },
                { nps: '16"', m: 0.40 },
                { nps: '20"', m: 0.50 },
                { nps: '24"', m: 0.60 },
                { nps: '30"', m: 0.75 },
              ].map((pipe) => (
                <button
                  key={pipe.nps}
                  type="button"
                  onClick={() => setStack((p) => ({ ...p, stackDiameter: pipe.m }))}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                    Math.abs(stack.stackDiameter - pipe.m) < 0.008
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {pipe.nps}
                </button>
              ))}
            </div>
          </div>

          {/* Support Structure Type */}
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-2">
              Tipe Struktur Penyangga Baja
            </label>
            <div className="space-y-2">
              {SUPPORT_TYPES.map((st) => (
                <div
                  key={st.id}
                  onClick={() => setStack((p) => ({ ...p, supportType: st.id }))}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    stack.supportType === st.id
                      ? 'bg-amber-500/15 border-amber-500/60 shadow-sm'
                      : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-200">{st.name}</span>
                    <span className="text-[10px] text-amber-400/90 font-mono">
                      {st.heightRange}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{st.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Receptors List & Coordinates (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>Daftar Titik Reseptor & Status Zona Bahaya (Ex-Proof)</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {receptors.length} Titik Terpasang
            </span>
          </div>

          {/* Receptors Table */}
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/90 text-slate-400 font-mono uppercase sticky top-0 text-[10px]">
                <tr>
                  <th className="py-2 px-3">Nama Reseptor & GPS</th>
                  <th className="py-2 px-2 text-center">Koordinat (X, Y, Z) m</th>
                  <th className="py-2 px-2 text-center">Jarak</th>
                  <th className="py-2 px-2 text-center">Zona Bahaya & Ex</th>
                  <th className="py-2 px-2 text-right">Batas API</th>
                  <th className="py-2 px-2 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {receptors.map((rec, idx) => {
                  const recGeo = localMetersToLatLng(
                    rec.x - stack.locationX,
                    rec.y - stack.locationY,
                    originLat,
                    originLng
                  );
                  const recRes = results.receptors.find((r) => r.receptor.id === rec.id);
                  const groundDist = recRes
                    ? recRes.stackGroundDistance
                    : Math.hypot(rec.x - stack.locationX, rec.y - stack.locationY);
                  const zone = recRes?.hazardousZone ?? 'Non-Hazardous';
                  const isEditingThis = editingReceptorId === rec.id;

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => {
                        setMapCenter(recGeo);
                        setActiveInfoId(rec.id);
                      }}
                      className={`cursor-pointer transition-colors ${
                        isEditingThis
                          ? 'bg-purple-950/40 ring-1 ring-inset ring-purple-500/60'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-200">
                          #{idx + 1} {rec.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {recGeo.lat.toFixed(5)}, {recGeo.lng.toFixed(5)} · {rec.category}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-slate-200 whitespace-nowrap">
                        ({rec.x}, {rec.y}, <span className="text-sky-400">+{rec.z}</span>)
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-slate-300">
                        {groundDist.toFixed(1)} m
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                            zone === 'Zone 1'
                              ? 'bg-rose-950/70 border-rose-600 text-rose-300'
                              : zone === 'Zone 2'
                              ? 'bg-amber-950/70 border-amber-600 text-amber-300'
                              : 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                          }`}
                        >
                          {zone === 'Zone 1'
                            ? 'ZONE 1 (Ex d/ia)'
                            : zone === 'Zone 2'
                            ? 'ZONE 2 (Ex ec)'
                            : 'SAFE AREA'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-amber-400">
                        {rec.apiLimitKw}
                      </td>
                      <td
                        className="py-2 px-2 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditReceptor(rec)}
                            className={`p-1 rounded transition-colors ${
                              isEditingThis
                                ? 'bg-purple-600 text-white'
                                : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                            }`}
                            title="Edit reseptor (nama, koordinat, batas radiasi)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReceptor(rec.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                            title="Hapus reseptor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add / Edit Receptor Form (Dual Cartesian + GPS Input) */}
          <div
            className={`rounded-xl p-3.5 space-y-3 border transition-colors ${
              editingReceptorId
                ? 'bg-purple-950/25 border-purple-500/60'
                : 'bg-slate-800/60 border-slate-700/60'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${editingReceptorId ? 'text-purple-300' : 'text-slate-300'}`}>
                  {editingReceptorId
                    ? `✏️ Mode Edit Reseptor (Klik peta OpenStreetMap atau ubah angka di bawah)`
                    : '+ Tambah Titik Reseptor (Klik peta OpenStreetMap atau Input Manual)'}
                </span>
              </div>
              <div className="flex bg-slate-900 border border-slate-700 rounded-md p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setCoordInputMode('cartesian')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    coordInputMode === 'cartesian'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Lokal (X, Y, Z)
                </button>
                <button
                  type="button"
                  onClick={() => setCoordInputMode('latlng')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    coordInputMode === 'latlng'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  GPS (Lat, Lng)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Nama lokasi (cth: Pompa Transfer B)"
                value={newRecName}
                onChange={(e) => setNewRecName(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 col-span-1 sm:col-span-2 focus:outline-none focus:border-amber-500"
              />
              <select
                value={newRecCategory}
                onChange={(e) => setNewRecCategory(e.target.value as Receptor['category'])}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="walkway">Walkway / Jalan Pekerja</option>
                <option value="helipad">Helipad / Helideck</option>
                <option value="tank_roof">Atap Tangki (Storage)</option>
                <option value="platform">Platform / Pompa / Panel</option>
                <option value="fence">Pagar Batas Fasilitas</option>
                <option value="control_room">Gedung Kontrol</option>
              </select>
            </div>

            {coordInputMode === 'cartesian' ? (
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">X Timur/Barat (m)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={newRecX}
                    onChange={(e) => handleCartesianChange(parseFloat(e.target.value) || 0, newRecY)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Y Utara/Selatan (m)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={newRecY}
                    onChange={(e) => handleCartesianChange(newRecX, parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Elev Z (m)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={newRecZ}
                    onChange={(e) => setNewRecZ(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Batas (kW/m²)</span>
                  <select
                    value={newRecLimit}
                    onChange={(e) => setNewRecLimit(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono text-amber-400 font-bold"
                  >
                    <option value={1.58}>1.58 (Kontinu)</option>
                    <option value={3.16}>3.16 (Personel)</option>
                    <option value={4.73}>4.73 (Terbatas)</option>
                    <option value={6.31}>6.31 (Evakuasi)</option>
                  </select>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Bising (dBA)</span>
                  <input
                    type="number"
                    min="60"
                    max="120"
                    step="1"
                    value={newRecNoise}
                    onChange={(e) => setNewRecNoise(parseFloat(e.target.value) || 85)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-sky-300"
                  />
                </div>
                <div className="flex items-end gap-1 col-span-2 sm:col-span-1">
                  {editingReceptorId ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveEditReceptor}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                        title="Simpan perubahan reseptor"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditReceptor}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-1.5 px-2 rounded flex items-center justify-center"
                        title="Batal edit"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddReceptor()}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">Latitude (WGS84)</span>
                  <input
                    type="number"
                    step="0.00001"
                    value={newRecLat}
                    onChange={(e) => handleLatLngChange(parseFloat(e.target.value) || originLat, newRecLng)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Longitude (WGS84)</span>
                  <input
                    type="number"
                    step="0.00001"
                    value={newRecLng}
                    onChange={(e) => handleLatLngChange(newRecLat, parseFloat(e.target.value) || originLng)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Elev Z (m)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={newRecZ}
                    onChange={(e) => setNewRecZ(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Batas (kW/m²)</span>
                  <select
                    value={newRecLimit}
                    onChange={(e) => setNewRecLimit(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono text-amber-400 font-bold"
                  >
                    <option value={1.58}>1.58 (Kontinu)</option>
                    <option value={3.16}>3.16 (Personel)</option>
                    <option value={4.73}>4.73 (Terbatas)</option>
                    <option value={6.31}>6.31 (Evakuasi)</option>
                  </select>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Bising (dBA)</span>
                  <input
                    type="number"
                    min="60"
                    max="120"
                    step="1"
                    value={newRecNoise}
                    onChange={(e) => setNewRecNoise(parseFloat(e.target.value) || 85)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-sky-300"
                  />
                </div>
                <div className="flex items-end gap-1 col-span-2 sm:col-span-1">
                  {editingReceptorId ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveEditReceptor}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                        title="Simpan perubahan reseptor"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditReceptor}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-1.5 px-2 rounded flex items-center justify-center"
                        title="Batal edit"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddReceptor()}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Synced Coordinate & Zone Preview Line */}
            {(() => {
              const previewDist = Math.hypot(newRecX - stack.locationX, newRecY - stack.locationY);
              const previewZone =
                previewDist <= hazardousArea.zone1RadiusM
                  ? 'Zone 1 (Wajib Ex d / Ex ia)'
                  : previewDist <= hazardousArea.zone2RadiusM
                  ? 'Zone 2 (Wajib Ex ec / Ex nA)'
                  : 'Non-Hazardous (Safe Area)';
              return (
                <div className="text-[10px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 px-2.5 py-1.5 rounded border border-slate-700/60">
                  <span>
                    Pratinjau: X={newRecX}m, Y={newRecY}m | GPS ({newRecLat.toFixed(5)}, {newRecLng.toFixed(5)}) | Jarak Stack: {previewDist.toFixed(1)}m
                  </span>
                  <span
                    className={
                      previewDist <= hazardousArea.zone1RadiusM
                        ? 'text-rose-400 font-bold'
                        : previewDist <= hazardousArea.zone2RadiusM
                        ? 'text-amber-400 font-bold'
                        : 'text-emerald-400 font-bold'
                    }
                  >
                    {previewZone}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Nav Actions */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onPrev}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali: Sizing Tip</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition-all"
        >
          <span>Lanjut ke Tahap 4: Eksekusi Simulasi 3D & Isopleth</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
