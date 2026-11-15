import React from 'react';
import {
  FluidProperties,
  FlareTipConfig,
  FlareTipType,
} from '../types/flaresim';
import {
  calculateGasDensity,
  calculateSonicVelocity,
  calculateTipHydraulics,
  recommendTipDiameterMm,
  getRadiationFraction,
  STANDARD_PIPE_SIZES_MM,
} from '../utils/flareCalculations';
import {
  Flame,
  Gauge,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Info,
} from 'lucide-react';

interface Step2TipSizingProps {
  fluid: FluidProperties;
  tip: FlareTipConfig;
  setTip: React.Dispatch<React.SetStateAction<FlareTipConfig>>;
  onNext: () => void;
  onPrev: () => void;
}

const TIP_TYPES: Array<{
  id: FlareTipType;
  name: string;
  recommendedMach: string;
  desc: string;
  pressureRange: string;
}> = [
  {
    id: 'pipe',
    name: 'Pipe Flare (Open Subsonic Tip)',
    recommendedMach: '0.20 – 0.50 Mach',
    desc: 'Ujung suar terbuka konvensional berbiaya ekonomis. Cocok untuk aliran gas pelepasan darurat bertekanan rendah hingga menengah.',
    pressureRange: 'Rendah - Sedang (< 3 barg)',
  },
  {
    id: 'sonic',
    name: 'Sonic Flare (High Pressure Multi-Nozzle)',
    recommendedMach: '0.60 – 1.00 Mach',
    desc: 'Nozel sonik kecepatan tinggi. Memanfaatkan energi kinetik tekanan gas untuk aerasi efisien, menghasilkan nyala lebih pendek dan fraksi radiasi lebih rendah.',
    pressureRange: 'Tinggi (> 4 barg)',
  },
  {
    id: 'steam_assisted',
    name: 'Steam-Assisted Flare (Injeksi Uap)',
    recommendedMach: '0.20 – 0.45 Mach',
    desc: 'Injeksi steam di sekeliling tip untuk meningkatkan pencampuran udara dan mencegah pembentukan jelaga hitam (smokeless flaring) pada hidrokarbon berat.',
    pressureRange: 'Sedang (1 - 5 barg)',
  },
  {
    id: 'air_assisted',
    name: 'Air-Assisted Flare (Injeksi Udara)',
    recommendedMach: '0.25 – 0.50 Mach',
    desc: 'Blower udara terintegrasi untuk pembakaran tanpa asap di fasilitas tanpa ketersediaan utilitas uap air (steam).',
    pressureRange: 'Rendah - Sedang',
  },
];

export const Step2TipSizing: React.FC<Step2TipSizingProps> = ({
  fluid,
  tip,
  setTip,
  onNext,
  onPrev,
}) => {
  const density = calculateGasDensity(
    fluid.reliefPressure,
    fluid.temperature,
    fluid.molecularWeight,
    fluid.compressibilityZ
  );

  const sonicVel = calculateSonicVelocity(
    fluid.temperature,
    fluid.molecularWeight,
    fluid.heatCapacityRatio
  );

  const hydraulics = calculateTipHydraulics(
    fluid.massFlowRate,
    density,
    tip.tipDiameter,
    sonicVel
  );

  const radFraction = getRadiationFraction(fluid, tip);

  const handleAutoSizing = () => {
    const targetMach = tip.tipType === 'sonic' ? 0.75 : 0.4;
    const recommendedDia = recommendTipDiameterMm(
      fluid.massFlowRate,
      density,
      sonicVel,
      targetMach
    );
    setTip((prev) => ({ ...prev, tipDiameter: recommendedDia }));
  };

  // Stability evaluation
  let stabilityStatus: 'safe' | 'warning' | 'critical' = 'safe';
  let stabilityMessage = 'Kecepatan fluida berada dalam rentang stabil pembakaran API 521.';

  if (tip.tipType === 'pipe') {
    if (hydraulics.machNumber > 0.5) {
      stabilityStatus = 'critical';
      stabilityMessage = `Mach ${hydraulics.machNumber.toFixed(2)} melebihi batas 0.50 untuk Pipe Flare! Risiko pelepasan nyala api (flame lift-off / blow out). Perbesar diameter tip!`;
    } else if (hydraulics.machNumber < 0.15) {
      stabilityStatus = 'warning';
      stabilityMessage = `Mach ${hydraulics.machNumber.toFixed(2)} terlalu rendah (< 0.15). Risiko nyala api masuk ke dalam burner (burnback / internal burning).`;
    }
  } else if (tip.tipType === 'sonic') {
    if (hydraulics.machNumber < 0.5) {
      stabilityStatus = 'warning';
      stabilityMessage = `Tekanan/Mach ${hydraulics.machNumber.toFixed(2)} di bawah rentang efisiensi sonik (> 0.6 Mach).`;
    }
  }

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h2 className="text-base font-bold text-slate-100">
                Tahap 2: Pemilihan Tipe & Sizing Dimensi Flare Tip
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              Pilih jenis ujung pembakar suar yang sesuai dengan profil gas buang, lalu tentukan diameter tip agar bilangan Mach dan kecepatan gas berada dalam koridor aman API 521 (mencegah blowout dan burnback).
            </p>
          </div>
          <button
            onClick={handleAutoSizing}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all flex-shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Auto-Size Diameter Tip</span>
          </button>
        </div>
      </div>

      {/* Tip Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIP_TYPES.map((t) => {
          const isSelected = tip.tipType === t.id;
          return (
            <div
              key={t.id}
              onClick={() => setTip((p) => ({ ...p, tipType: t.id }))}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-200">{t.name}</h4>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mb-3">{t.desc}</p>
              </div>

              <div className="border-t border-slate-800/80 pt-2.5 mt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Mach:</span>
                  <span className="font-mono font-semibold text-amber-400">
                    {t.recommendedMach}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tekanan:</span>
                  <span className="text-slate-300">{t.pressureRange}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sizing Controls & Hydraulics Readout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">
            Parameter Dimensi Flare Tip
          </h3>

          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
              <span>Diameter Tip Burner</span>
              <span className="font-mono text-amber-400 font-bold text-sm">
                {tip.tipDiameter} mm ({(tip.tipDiameter / 25.4).toFixed(1)} inch)
              </span>
            </div>
            <input
              type="range"
              min="25"
              max="2000"
              step="5"
              value={tip.tipDiameter}
              onChange={(e) =>
                setTip((p) => ({ ...p, tipDiameter: parseInt(e.target.value) || 25 }))
              }
              className="w-full accent-amber-500 h-2 bg-slate-700 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>25 mm (1")</span>
              <span>150 mm (6")</span>
              <span>500 mm (20")</span>
              <span>1200 mm (48")</span>
              <span>2000 mm (80")</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Discharge Coefficient (Cd)
              </label>
              <input
                type="number"
                min="0.5"
                max="1.0"
                step="0.05"
                value={tip.dischargeCoeff}
                onChange={(e) =>
                  setTip((p) => ({
                    ...p,
                    dischargeCoeff: parseFloat(e.target.value) || 0.75,
                  }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Fraksi Radiasi (Fs) Override
              </label>
              <input
                type="number"
                min="0.05"
                max="0.45"
                step="0.01"
                placeholder={`Auto: ${radFraction.toFixed(2)}`}
                value={tip.radiationFractionOverride || ''}
                onChange={(e) =>
                  setTip((p) => ({
                    ...p,
                    radiationFractionOverride: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
              />
            </div>
          </div>

          {/* Quick Pipe Size Presets starting from 1" */}
          <div className="pt-2">
            <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">
              Ukuran Diameter Pipa Standar ASME B36.10M (Dimulai dari 1"):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STANDARD_PIPE_SIZES_MM.map((pipe) => (
                <button
                  key={pipe.mm}
                  onClick={() => setTip((p) => ({ ...p, tipDiameter: pipe.mm }))}
                  className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors ${
                    tip.tipDiameter === pipe.mm
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {pipe.nps} ({pipe.mm}mm)
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Hydraulics & Stability Status (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Hasil Hidrolika Kecepatan & Mach</span>
              <span className="text-xs font-mono text-slate-400">API 521 5.7.2</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 block mb-1">Bilangan Mach (Ma)</span>
                <div
                  className={`text-2xl font-mono font-bold ${
                    hydraulics.machNumber > 0.5 && tip.tipType === 'pipe'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {hydraulics.machNumber.toFixed(3)}{' '}
                  <span className="text-xs font-normal text-slate-400">Mach</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {tip.tipType === 'pipe' ? 'Batas aman API ≤ 0.50' : 'Batas sonik ≤ 1.00'}
                </span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 block mb-1">Kecepatan Keluar (Exit Velocity)</span>
                <div className="text-2xl font-mono font-bold text-sky-400">
                  {hydraulics.exitVelocityMs.toFixed(1)}{' '}
                  <span className="text-xs font-normal text-slate-400">m/s</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Suara: {sonicVel.toFixed(0)} m/s
                </span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 block mb-1">Fraksi Radiasi (Fs)</span>
                <div className="text-xl font-mono font-bold text-emerald-400">
                  {(radFraction * 100).toFixed(1)}%{' '}
                  <span className="text-xs font-normal text-slate-400">dari Q total</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Fs = {radFraction.toFixed(3)}
                </span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 block mb-1">Luas Penampang Nozzle</span>
                <div className="text-xl font-mono font-bold text-slate-200">
                  {hydraulics.areaM2.toFixed(3)}{' '}
                  <span className="text-xs font-normal text-slate-400">m²</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {(hydraulics.areaM2 * 1550).toFixed(0)} sq in
                </span>
              </div>
            </div>
          </div>

          {/* Stability Warning / Pass Box */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              stabilityStatus === 'safe'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                : stabilityStatus === 'warning'
                ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                : 'bg-rose-950/40 border-rose-800 text-rose-200'
            }`}
          >
            {stabilityStatus === 'safe' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <span className="font-bold block mb-0.5">
                {stabilityStatus === 'safe'
                  ? 'Stabilitas Nyala Api Terverifikasi'
                  : 'Peringatan Stabilitas Pembakaran'}
              </span>
              <p className="text-slate-300">{stabilityMessage}</p>
            </div>
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
          <span>Kembali: Data Input</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition-all"
        >
          <span>Lanjut ke Tahap 3: Lokasi & Reseptor</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
