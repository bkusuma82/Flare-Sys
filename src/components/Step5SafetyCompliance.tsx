import React from 'react';
import { SimulationResults } from '../types/flaresim';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Thermometer,
  Volume2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  Zap,
} from 'lucide-react';

interface Step5SafetyComplianceProps {
  results: SimulationResults;
  unitSystem: 'SI' | 'Field';
  onNext: () => void;
  onPrev: () => void;
  onJumpToOptimize: () => void;
}

const API_STANDARD_LIMITS = [
  {
    levelKw: 1.58,
    levelBtu: 500,
    category: 'Kontinu & Publik',
    desc: 'Area akses umum, jalan umum, batas pagar fasilitas (fence line), atau area kerja kontinu tanpa batasan waktu dan pakaian khusus.',
  },
  {
    levelKw: 3.16,
    levelBtu: 1000,
    category: 'Personel Kerja Biasa',
    desc: 'Area operasional tempat pekerja bertugas beberapa menit dengan pakaian kerja standar (overall katun) tanpa pelindung termal khusus.',
  },
  {
    levelKw: 4.73,
    levelBtu: 1500,
    category: 'Akses Terbatas / Darurat Singkat',
    desc: 'Area operasional terbatas, evakuasi darurat, atau tindakan mitigasi darurat singkat (beberapa menit) dengan APD sesuai.',
  },
  {
    levelKw: 6.31,
    levelBtu: 2000,
    category: 'Evakuasi Murni (Max 1 Menit)',
    desc: 'Hanya diizinkan untuk rute evakuasi darurat dengan paparan maksimal 1 menit tanpa cedera fatal kulit.',
  },
  {
    levelKw: 9.46,
    levelBtu: 3000,
    category: 'Peralatan / Struktur Logam',
    desc: 'Batas temperatur desain untuk peralatan logam, tangki penyimpanan, dan struktur baja tanpa proteksi pendingin semprotan air (deluge water).',
  },
];

export const Step5SafetyCompliance: React.FC<Step5SafetyComplianceProps> = ({
  results,
  unitSystem,
  onNext,
  onPrev,
  onJumpToOptimize,
}) => {
  const { receptors, isAllCompliant, maxReceptorRadiationKw, hazardousArea } = results;

  const failedCount = receptors.filter(
    (r) => !r.isRadiationPass || !r.isNoisePass || !r.isMetalTempPass
  ).length;

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h2 className="text-base font-bold text-slate-100">
                Tahap 5: Evaluasi Terhadap Standar Keselamatan (API 521 / ISO 23251)
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              Membandingkan tingkat radiasi termal, batas kebisingan suara kerja, dan temperatur kesetimbangan logam pada seluruh titik reseptor terhadap batas regulasi industri keselamatan minyak & gas bumi.
            </p>
          </div>

          {!isAllCompliant && (
            <button
              onClick={onJumpToOptimize}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all flex-shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Optimasi Otomatis (Perbaiki Batas)</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Compliance Summary Banner */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
          isAllCompliant
            ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
            : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
        }`}
      >
        <div className="flex items-center gap-3">
          {isAllCompliant ? (
            <CheckCircle2 className="w-7 h-7 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-7 h-7 text-rose-400 flex-shrink-0 animate-bounce" />
          )}
          <div>
            <h3 className="text-sm font-bold">
              {isAllCompliant
                ? 'Seluruh Titik Reseptor MEMENUHI Standar Keselamatan API 521'
                : `Ditemukan ${failedCount} Titik Reseptor MELEBIHI Ambang Batas Keselamatan!`}
            </h3>
            <p className="text-xs text-slate-300">
              {isAllCompliant
                ? `Radiasi termal tertinggi tercatat sebesar ${maxReceptorRadiationKw.toFixed(2)} kW/m² (masih di bawah batas desain yang diizinkan). Desain siap untuk iterasi efisiensi biaya.`
                : 'Tingkat radiasi panas atau kebisingan berpotensi membahayakan pekerja. Diperlukan penyesuaian tinggi tiang suar, pergeseran tata letak, atau tipe flare tip.'}
            </p>
          </div>
        </div>

        <div className="text-right hidden sm:block flex-shrink-0">
          <span className="text-[10px] text-slate-400 block uppercase font-mono">
            Status HSE
          </span>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
              isAllCompliant
                ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300'
                : 'bg-rose-900/60 border-rose-600 text-rose-300'
            }`}
          >
            {isAllCompliant ? 'APPROVED / VERIFIED' : 'ACTION REQUIRED'}
          </span>
        </div>
      </div>

      {/* Detailed Receptor Evaluation Matrix Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Matriks Evaluasi Reseptor Rinci</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {receptors.length} Titik Dievaluasi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4">Reseptor & Koordinat</th>
                <th className="py-2.5 px-3 text-center">Jarak Nyala / Stack</th>
                <th className="py-2.5 px-3 text-right">Radiasi Aktual</th>
                <th className="py-2.5 px-3 text-right">Batas API 521</th>
                <th className="py-2.5 px-3 text-right">Margin</th>
                <th className="py-2.5 px-3 text-center">Bising (dBA)</th>
                <th className="py-2.5 px-3 text-center">Suhu Logam</th>
                <th className="py-2.5 px-3 text-center">Zona Bahaya &amp; Ex-Proof</th>
                <th className="py-2.5 px-4 text-center">Status API 521</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {receptors.map((rec) => {
                const isPass = rec.isRadiationPass && rec.isNoisePass && rec.isMetalTempPass;
                return (
                  <tr
                    key={rec.receptor.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      !isPass ? 'bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-200">{rec.receptor.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        (X: {rec.receptor.x}m, Y: {rec.receptor.y}m, Z: +{rec.receptor.z}m)
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-slate-300">
                      <div>{rec.distanceToFlameCenter.toFixed(1)} m</div>
                      <div className="text-[10px] text-slate-500">
                        Tanah: {rec.stackGroundDistance.toFixed(1)} m
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div
                        className={`font-mono font-bold text-sm ${
                          rec.isRadiationPass ? 'text-slate-100' : 'text-rose-400'
                        }`}
                      >
                        {rec.radiationKw.toFixed(2)}{' '}
                        <span className="text-[10px] font-normal text-slate-400">kW/m²</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {rec.radiationBtu.toFixed(0)} BTU/h·ft²
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold text-amber-400">
                      {rec.receptor.apiLimitKw.toFixed(2)} kW/m²
                    </td>

                    <td className="py-3 px-3 text-right font-mono">
                      <span
                        className={`font-bold ${
                          rec.marginKw >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {rec.marginKw >= 0 ? `+${rec.marginKw.toFixed(2)}` : rec.marginKw.toFixed(2)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      <span
                        className={`${
                          rec.isNoisePass ? 'text-slate-300' : 'text-rose-400 font-bold'
                        }`}
                      >
                        {rec.noiseDba.toFixed(1)}
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        Limit: {rec.receptor.noiseLimitDba}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      <span
                        className={`${
                          rec.metalTempC > 150
                            ? 'text-amber-400 font-bold'
                            : 'text-slate-300'
                        }`}
                      >
                        {rec.metalTempC.toFixed(0)} °C
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        Limit &lt; 200°C
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                          rec.hazardousZone === 'Zone 1'
                            ? 'bg-rose-950/70 border-rose-600 text-rose-300'
                            : rec.hazardousZone === 'Zone 2'
                            ? 'bg-amber-950/70 border-amber-600 text-amber-300'
                            : 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                        }`}
                      >
                        {rec.hazardousZone}
                      </span>
                      <div className="text-[9px] text-slate-400 mt-1 max-w-[150px] mx-auto leading-tight">
                        {rec.hazardousZone === 'Zone 1'
                          ? `Wajib Ex d / Ex ia (${hazardousArea.gasGroup} ${hazardousArea.tempClass})`
                          : rec.hazardousZone === 'Zone 2'
                          ? `Wajib Min. Ex ec / Ex nA (${hazardousArea.gasGroup})`
                          : 'Non-Ex (IP54/IP65)'}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isPass ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>LULUS (SAFE)</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] font-bold">
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>MELEBIHI BATAS</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hazardous Area Classification (Zone 1 & Zone 2) Panel */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
              Klasifikasi Area Berbahaya (Zone 1 &amp; Zone 2) — IEC 60079-10-1 / API RP 505
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/50 border border-amber-700/60 px-2.5 py-0.5 rounded">
            Gas Group {hazardousArea.gasGroup} · Temp Class {hazardousArea.tempClass}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {hazardousArea.basisNote} Setiap peralatan listrik, instrumen (transmitter, solenoid valve, panel kontrol, blower motor, lampu penerangan) yang terpasang di dalam radius berikut wajib memenuhi sertifikasi <strong>Explosion Proof</strong> yang sesuai:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-rose-950/35 border border-rose-700/60 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-rose-400" />
                <span>ZONE 1 (R ≤ {hazardousArea.zone1RadiusM} m)</span>
              </span>
              <span className="text-[10px] font-mono bg-rose-900/70 text-rose-200 px-1.5 py-0.5 rounded">
                EPL Gb
              </span>
            </div>
            <div className="font-semibold text-slate-200">{hazardousArea.equipmentSpecZone1}</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Area di sekitar pangkal tiang suar, seal drain separator/KO drum, &amp; pilot manifold di mana campuran gas mudah terbakar berpotensi hadir saat operasi normal.
            </p>
          </div>

          <div className="bg-amber-950/35 border border-amber-700/60 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>ZONE 2 ({hazardousArea.zone1RadiusM} – {hazardousArea.zone2RadiusM} m)</span>
              </span>
              <span className="text-[10px] font-mono bg-amber-900/70 text-amber-200 px-1.5 py-0.5 rounded">
                EPL Gc
              </span>
            </div>
            <div className="font-semibold text-slate-200">{hazardousArea.equipmentSpecZone2}</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Area penyangga perluasan (termasuk jejak dispersi 50% LEL saat flameout) di mana gas hanya muncul sesaat jika terjadi kebocoran/gangguan abnormal.
            </p>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-700/60 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>NON-HAZARDOUS (&gt; {hazardousArea.zone2RadiusM} m)</span>
              </span>
              <span className="text-[10px] font-mono bg-emerald-900/70 text-emerald-200 px-1.5 py-0.5 rounded">
                Safe Area
              </span>
            </div>
            <div className="font-semibold text-slate-200">{hazardousArea.equipmentSpecSafe}</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Lokasi aman untuk menempatkan MCC / panel kontrol utama non-Ex, gedung kontrol (control room), trafo daya, dan utilitas standar.
            </p>
          </div>
        </div>
      </div>

      {/* API 521 Reference Threshold Standard Guide */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
          Rujukan Ambang Batas Regulasi API 521 (Table 11: Radiation Limits)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {API_STANDARD_LIMITS.map((lim) => (
            <div
              key={lim.levelKw}
              className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 space-y-1.5"
            >
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {lim.levelKw} kW/m²
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {lim.levelBtu} BTU/h·ft²
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-200">{lim.category}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{lim.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Nav Actions */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onPrev}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali: Simulasi 3D</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition-all"
        >
          <span>Lanjut ke Tahap 6: Iterasi & Optimasi Biaya Baja</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
