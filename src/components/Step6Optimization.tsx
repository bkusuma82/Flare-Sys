import React, { useMemo } from 'react';
import {
  FluidProperties,
  EnvironmentConditions,
  FlareTipConfig,
  FlareStackConfig,
  Receptor,
  SimulationResults,
} from '../types/flaresim';
import { autoOptimizeStackHeight } from '../utils/flareCalculations';
import {
  TrendingDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building,
  Scale,
  ShieldCheck,
  Maximize2,
} from 'lucide-react';

interface Step6OptimizationProps {
  fluid: FluidProperties;
  env: EnvironmentConditions;
  tip: FlareTipConfig;
  stack: FlareStackConfig;
  setStack: React.Dispatch<React.SetStateAction<FlareStackConfig>>;
  receptors: Receptor[];
  results: SimulationResults;
  onNext: () => void;
  onPrev: () => void;
}

export const Step6Optimization: React.FC<Step6OptimizationProps> = ({
  fluid,
  env,
  tip,
  stack,
  setStack,
  receptors,
  results,
  onNext,
  onPrev,
}) => {
  // Run optimizer computation to generate sensitivity curve (from 5m to 120m)
  const optimizationData = useMemo(() => {
    return autoOptimizeStackHeight(fluid, env, tip, stack, receptors, 5, 120, 1.0);
  }, [fluid, env, tip, stack.supportType, stack.stackDiameter, stack.locationX, stack.locationY, receptors]);

  const { optimalHeight, optimalResults, curveData } = optimizationData;

  const currentHeight = stack.stackHeight;
  const isOverDesigned = currentHeight > optimalHeight && results.isAllCompliant;
  const isUnderDesigned = !results.isAllCompliant;
  const heightDiff = Math.abs(currentHeight - optimalHeight);

  const handleApplyOptimalHeight = () => {
    setStack((p) => ({ ...p, stackHeight: optimalHeight }));
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h2 className="text-base font-bold text-slate-100">
                Tahap 6: Iterasi & Optimasi Ketinggian Tiang Suar (API 521 Safety Solver)
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              Mencari titik ketinggian tiang suar minimum (<strong className="text-amber-400">H_min</strong>) yang menjamin seluruh titik reseptor (pekerja, tangki, helipad, pagar batas) memenuhi batas aman radiasi termal API 521 tanpa ketinggian tiang yang berlebihan.
            </p>
          </div>

          <button
            onClick={handleApplyOptimalHeight}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all flex-shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Terapkan Tinggi Optimal: {optimalHeight} m</span>
          </button>
        </div>
      </div>

      {/* Status Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Height Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-400">Tinggi Tiang Saat Ini</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                results.isAllCompliant
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}
            >
              {results.isAllCompliant ? 'Patuh API 521' : 'Melebihi Batas'}
            </span>
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100">
            {currentHeight} <span className="text-xs font-normal text-slate-400">meter</span>
          </div>
          <span className="text-xs font-mono text-slate-400 mt-1 block">
            {(currentHeight * 3.28084).toFixed(0)} ft · Radiasi Maks: {results.maxReceptorRadiationKw.toFixed(2)} kW/m²
          </span>
        </div>

        {/* Optimal Minimum Height Card */}
        <div className="bg-slate-900/80 border border-amber-500/50 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 text-amber-500/10 pointer-events-none">
            <Scale className="w-20 h-20" />
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Tinggi Minimum Aman (API 521 Pass)
            </span>
            <span className="text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded">
              H_min
            </span>
          </div>
          <div className="text-2xl font-mono font-bold text-amber-400">
            {optimalHeight} <span className="text-xs font-normal text-slate-400">meter</span>
          </div>
          <span className="text-xs font-mono text-slate-400 mt-1 block">
            {(optimalHeight * 3.28084).toFixed(0)} ft · Target Keselamatan Terpenuhi
          </span>
        </div>

        {/* Engineering Evaluation Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">Rekomendasi Keselamatan</span>
          {isUnderDesigned ? (
            <div>
              <div className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Tiang Kurang Tinggi (+{heightDiff.toFixed(1)}m)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Radiasi termal di reseptor melebihi batas. Naikkan tinggi tiang minimal ke <strong>{optimalHeight}m</strong> agar area kerja operator aman.
              </p>
            </div>
          ) : isOverDesigned ? (
            <div>
              <div className="text-sm font-bold text-sky-400 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 flex-shrink-0" />
                <span>Margin Berlebih (+{heightDiff.toFixed(1)}m)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Tiang suar dapat diturunkan hingga <strong>{optimalHeight}m</strong> dengan tetap mematuhi seluruh batas keselamatan API 521.
              </p>
            </div>
          ) : (
            <div>
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Tinggi Tiang Presisi Optimal</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Ketinggian tiang suar berada persis pada titik paling efisien yang memenuhi seluruh ambang batas radiasi.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Height Slider & Sensitivity Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Controls & Technical Specs (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-5">
          <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-400" />
            <span>Pengaturan Ketinggian Tiang Suar</span>
          </h3>

          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
              <span>Tinggi Tiang (Stack Height)</span>
              <span className="font-mono text-amber-400 font-bold text-base">
                {stack.stackHeight} m ({(stack.stackHeight * 3.28).toFixed(0)} ft)
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="120"
              step="0.5"
              value={stack.stackHeight}
              onChange={(e) =>
                setStack((p) => ({ ...p, stackHeight: parseFloat(e.target.value) || 10 }))
              }
              className="w-full accent-amber-500 h-2.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>5 m (Skid)</span>
              <span className="text-amber-400 font-bold">Optimal: {optimalHeight}m</span>
              <span>120 m</span>
            </div>
          </div>

          {/* Quick Step Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStack((p) => ({ ...p, stackHeight: Math.max(5, p.stackHeight - 5) }))}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg"
            >
              - 5 Meter
            </button>
            <button
              type="button"
              onClick={() => setStack((p) => ({ ...p, stackHeight: Math.min(130, p.stackHeight + 5) }))}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg"
            >
              + 5 Meter
            </button>
            <button
              type="button"
              onClick={handleApplyOptimalHeight}
              className="px-3 py-1 text-xs bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 font-bold rounded-lg ml-auto"
            >
              Set Optimal ({optimalHeight}m)
            </button>
          </div>

          {/* Technical Structural Parameters */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-slate-300 block">
              Parameter Spesifikasi Teknis:
            </span>

            <div className="bg-slate-800/60 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Diameter Pipa Riser:</span>
                <span className="font-mono font-semibold text-slate-100">
                  {stack.stackDiameter} m ({(stack.stackDiameter * 39.37).toFixed(1)}")
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span>Tipe Penyangga Struktur:</span>
                <span className="font-semibold text-slate-100 uppercase">
                  {stack.supportType.replace('_', ' ')}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span>Elevasi Pusat Nyala (Z):</span>
                <span className="font-mono font-semibold text-amber-300">
                  {results.flame.flameCenterCoords.z.toFixed(1)} m
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span>Radiasi Reseptor Terburuk:</span>
                <span
                  className={`font-mono font-bold ${
                    results.maxReceptorRadiationKw <= 3.16 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {results.maxReceptorRadiationKw.toFixed(2)} kW/m²
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sensitivity Curve Chart: Stack Height vs Maximum Radiation (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-200">
              Kurva Sensitivitas: Tinggi Tiang vs Radiasi Termal Reseptor
            </h3>
            <span className="text-xs font-mono text-slate-400">API 521 Solver</span>
          </div>

          <p className="text-xs text-slate-400">
            Grafik menunjukkan bagaimana peningkatan ketinggian tiang menurunkan radiasi panas pada titik reseptor (garis oranye). Garis hijau vertikal menandai ketinggian minimum yang telah memenuhi standar.
          </p>

          {/* SVG Chart */}
          <div className="w-full h-[280px] bg-slate-950/80 rounded-xl p-3 border border-slate-800 relative">
            <svg viewBox="0 0 500 240" className="w-full h-full">
              {/* Axes Grid */}
              <line x1="45" y1="20" x2="45" y2="200" stroke="#334155" strokeWidth="1" />
              <line x1="45" y1="200" x2="480" y2="200" stroke="#334155" strokeWidth="1" />

              {/* Threshold Line: 3.16 kW/m² */}
              <line x1="45" y1="120" x2="480" y2="120" stroke="#f43f5e" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
              <text x="50" y="115" fill="#f43f5e" fontSize="9" fontFamily="monospace">
                Ambang Batas Radiasi API 521 (3.16 kW/m²)
              </text>

              {/* Optimal Height Line (Green) */}
              {(() => {
                const optX = 45 + ((optimalHeight - 5) / (120 - 5)) * (480 - 45);
                return (
                  <g>
                    <line x1={optX} y1="20" x2={optX} y2="200" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" />
                    <text x={optX + 4} y="32" fill="#10b981" fontSize="9" fontWeight="bold">
                      Optimal ({optimalHeight}m)
                    </text>
                  </g>
                );
              })()}

              {/* Current Height Marker (Yellow) */}
              {(() => {
                const curX = 45 + ((currentHeight - 5) / (120 - 5)) * (480 - 45);
                return (
                  <g>
                    <line x1={curX} y1="20" x2={curX} y2="200" stroke="#fbbf24" strokeWidth="2" />
                    <circle cx={curX} cy="200" r="4" fill="#fbbf24" />
                    <text x={curX - 18} y="215" fill="#fbbf24" fontSize="9" fontWeight="bold">
                      H={currentHeight}m
                    </text>
                  </g>
                );
              })()}

              {/* Radiation Curve (Orange) */}
              {(() => {
                const maxRad = Math.max(...curveData.map((d) => d.maxRadiationKw), 6.0);
                const points = curveData.map((d) => {
                  const x = 45 + ((d.height - 5) / (120 - 5)) * (480 - 45);
                  const y = 200 - (Math.min(maxRad, d.maxRadiationKw) / maxRad) * 170;
                  return `${x},${y}`;
                });
                return (
                  <polyline
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    points={points.join(' ')}
                  />
                );
              })()}

              {/* Axis Labels */}
              <text x="45" y="215" fill="#64748b" fontSize="9" fontFamily="monospace">5m</text>
              <text x="240" y="225" fill="#94a3b8" fontSize="10" textAnchor="middle">
                Tinggi Tiang Suar (m)
              </text>
              <text x="460" y="215" fill="#64748b" fontSize="9" fontFamily="monospace">120m</text>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between text-xs pt-1 px-1 text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-orange-500 inline-block"></span>
              <span>Radiasi Maksimum Reseptor (kW/m²)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-emerald-500 inline-block"></span>
              <span>Garis Tinggi Minimum Optimal H_min</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-amber-400 inline-block"></span>
              <span>Posisi Ketinggian Saat Ini</span>
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
          <span>Kembali: Evaluasi Standar</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition-all"
        >
          <span>Lanjut ke Tahap 7: Finalisasi & Laporan Datasheet HSE</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
