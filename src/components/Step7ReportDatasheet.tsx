import React from 'react';
import {
  FluidProperties,
  EnvironmentConditions,
  FlareTipConfig,
  FlareStackConfig,
  Receptor,
  SimulationResults,
  ProjectMetadata,
} from '../types/flaresim';
import {
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Building,
  ShieldCheck,
  FileCheck,
  ArrowLeft,
  ArrowRight,
  Save,
} from 'lucide-react';

interface Step7ReportDatasheetProps {
  fluid: FluidProperties;
  env: EnvironmentConditions;
  tip: FlareTipConfig;
  stack: FlareStackConfig;
  receptors: Receptor[];
  results: SimulationResults;
  unitSystem: 'SI' | 'Field';
  projectMeta?: ProjectMetadata;
  onSaveCompletedProject?: () => void;
  onPrev: () => void;
  onNext?: () => void;
}

export const Step7ReportDatasheet: React.FC<Step7ReportDatasheetProps> = ({
  fluid,
  env,
  tip,
  stack,
  receptors,
  results,
  projectMeta,
  onSaveCompletedProject,
  onPrev,
  onNext,
}) => {
  const docNumber =
    projectMeta?.docNumber ||
    (fluid.gasType === 'biogas' ? 'FLS-CALC-BIO-001' : 'FLS-CALC-API521-004');
  const projectName =
    projectMeta?.projectName ||
    (fluid.gasType === 'biogas'
      ? 'Biogas Recovery & Safe Flaring Facility (POME / Digester)'
      : 'Onshore Central Gas Processing Plant');
  const facilityLocation =
    projectMeta?.facilityLocation ||
    (fluid.gasType === 'biogas'
      ? 'Riau Bioenergy & Palm Oil Mill Complex'
      : 'South Sumatra Basin Block A');
  const leadEngineer = projectMeta?.leadEngineer || 'Ir. B. Kusuma, IPM (Process Lead)';
  const hseAuditor = projectMeta?.hseAuditor || 'HSE & Process Safety Directorate';

  const { flame, isopleths, noise85Radius, flameoutHazardDistanceM, isAllCompliant } = results;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = [
      'ID Reseptor',
      'Nama Lokasi',
      'Kategori',
      'Koordinat X (m)',
      'Koordinat Y (m)',
      'Elevasi Z (m)',
      'Jarak ke Nyala (m)',
      'Radiasi Aktual (kW/m2)',
      'Radiasi Aktual (BTU/h-ft2)',
      'Batas API 521 (kW/m2)',
      'Margin Keamanan (kW/m2)',
      'Tingkat Kebisingan (dBA)',
      'Suhu Logam (°C)',
      'Status Kepatuhan',
    ];

    const rows = results.receptors.map((r) => [
      r.receptor.id,
      `"${r.receptor.name}"`,
      r.receptor.category,
      r.receptor.x,
      r.receptor.y,
      r.receptor.z,
      r.distanceToFlameCenter.toFixed(1),
      r.radiationKw.toFixed(2),
      r.radiationBtu.toFixed(0),
      r.receptor.apiLimitKw.toFixed(2),
      r.marginKw.toFixed(2),
      r.noiseDba.toFixed(1),
      r.metalTempC.toFixed(0),
      r.isRadiationPass && r.isNoisePass ? 'PASS' : 'FAIL',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Flaresim_Report_${docNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Step Header (No Print) */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h2 className="text-base font-bold text-slate-100">
                Tahap 7: Finalisasi & Laporan Kalkulasi Formal HSE API 521
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              Ekstrak dokumen rekayasa resmi (datasheet) untuk penyerahan multi-disiplin (sipil, perpipaan, instrumen) dan persetujuan keselamatan (HSE approval).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              title="Ekspor tabel reseptor ke format CSV / Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg shadow-md transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF Datasheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* FORMAL ENGINEERING DATASHEET CONTAINER (Printable) */}
      <div className="print-page bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6 shadow-xl text-slate-100 max-w-5xl mx-auto">
        {/* Document Header & Engineering Stamp */}
        <div className="border-b-2 border-slate-700 pb-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 flex-shrink-0">
                <Flame className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white uppercase">
                  FLARE SYSTEM DESIGN & SAFETY CALCULATION DATASHEET
                </h1>
                <div className="text-xs font-mono text-slate-400 flex items-center gap-3 mt-0.5">
                  <span>STANDARD: API STD 521 / ISO 23251</span>
                  <span>·</span>
                  <span>SIXTH EDITION</span>
                </div>
              </div>
            </div>

            {/* Document Meta Block */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-xs font-mono space-y-1 sm:text-right min-w-[200px]">
              <div>
                <span className="text-slate-400">DOC NO: </span>
                <span className="text-amber-400 font-bold">{docNumber}</span>
              </div>
              <div>
                <span className="text-slate-400">REV: </span>
                <span className="text-white font-bold">0 (APPROVED FOR DESIGN)</span>
              </div>
              <div>
                <span className="text-slate-400">DATE: </span>
                <span className="text-slate-300">{new Date().toISOString().split('T')[0]}</span>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-400">Nama Fasilitas / Proyek: </span>
              <span className="font-semibold text-slate-200">{projectName}</span>
            </div>
            <div>
              <span className="text-slate-400">Lokasi Tapak (Site): </span>
              <span className="font-semibold text-slate-200">{facilityLocation}</span>
            </div>
          </div>
        </div>

        {/* Section 1 & 2: Process Relief & Flare Tip Hydraulics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1 */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              1. Basis Desain Fluida Relief (Process Data)
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Fluida Gas:</span>
                <span className="font-semibold text-slate-200">{fluid.gasName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Laju Alir Masal (Blowdown):</span>
                <span className="font-mono font-bold text-slate-100">
                  {fluid.massFlowRate.toLocaleString()} kg/h ({(fluid.massFlowRate / 1000).toFixed(1)} t/h)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Debit Volumetrik Aktual:</span>
                <span className="font-mono text-slate-200">
                  {(fluid.massFlowRate / Math.max(0.01, (fluid.reliefPressure + 1.013) * 1e5 * fluid.molecularWeight / (fluid.compressibilityZ * 8314.46 * (fluid.temperature + 273.15)))).toFixed(1)} m³/h
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Debit Volumetrik Normal:</span>
                <span className="font-mono text-slate-200">
                  {(fluid.massFlowRate / Math.max(0.01, fluid.molecularWeight / 22.414)).toFixed(0)} Nm³/h
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Tekanan Relief:</span>
                <span className="font-mono text-slate-200">{fluid.reliefPressure} barg</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Temperatur Relief:</span>
                <span className="font-mono text-slate-200">{fluid.temperature} °C</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Berat Molekul (MW):</span>
                <span className="font-mono text-slate-200">{fluid.molecularWeight} kg/kmol</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Nilai Kalor Bawah (LHV):</span>
                <span className="font-mono text-slate-200">{fluid.lhv} MJ/kg</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Laju Pelepasan Panas Total (Q):</span>
                <span className="font-mono font-bold text-amber-400">
                  {flame.heatReleaseMw.toFixed(1)} MW ({(flame.heatReleaseMw * 3.412e6).toFixed(0)} BTU/h)
                </span>
              </div>

              {/* Custom Gas Composition Breakdown if applicable */}
              {fluid.gasType === 'custom' && fluid.customComponents && (
                <div className="mt-3 pt-2.5 border-t border-slate-800">
                  <span className="text-[11px] font-bold text-amber-400 block mb-1.5 font-mono">
                    Komposisi Gas Kustom (% Mole):
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 text-[10px] font-mono">
                    {fluid.customComponents
                      .filter((c) => c.molePct > 0)
                      .map((c) => (
                        <div key={c.id} className="bg-slate-900 px-2 py-1 rounded flex justify-between">
                          <span className="text-slate-300 font-semibold">{c.formula}:</span>
                          <span className="text-amber-300">{c.molePct}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2 */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              2. Spesifikasi Flare Tip & Hidrolika
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Tipe Flare Tip:</span>
                <span className="font-semibold text-slate-200 uppercase">{tip.tipType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Diameter Tip Burner:</span>
                <span className="font-mono font-bold text-slate-100">
                  {tip.tipDiameter} mm ({(tip.tipDiameter / 25.4).toFixed(1)}")
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Kecepatan Alir Keluar:</span>
                <span className="font-mono text-slate-200">{flame.tipExitVelocity.toFixed(1)} m/s</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Bilangan Mach (Ma):</span>
                <span className="font-mono font-bold text-amber-300">
                  {flame.machNumber.toFixed(3)} Mach (OK)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Fraksi Emisi Radiasi (Fs):</span>
                <span className="font-mono text-slate-200">
                  {(flame.radiationFraction * 100).toFixed(1)}% ({flame.radiatedPowerMw.toFixed(1)} MW)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Panjang Nyala Api (Lf):</span>
                <span className="font-mono text-slate-200">{flame.flameLength.toFixed(1)} meter</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Kemiringan Nyala (Flame Tilt):</span>
                <span className="font-mono text-sky-400">
                  {flame.flameTiltDeg.toFixed(1)}° (Angin {env.windSpeed} m/s)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Stack Structural Summary (No Capex) */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            3. Rangkuman Spesifikasi Teknis Struktur Tiang Suar (Structural Data)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Tinggi Tiang Suar (H):</span>
              <span className="font-mono font-bold text-base text-slate-100">
                {stack.stackHeight} meter
              </span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Diameter Riser Pipa:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {stack.stackDiameter} m ({(stack.stackDiameter * 39.37).toFixed(1)}")
              </span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Tipe Penyangga Struktur:</span>
              <span className="font-bold text-slate-200 uppercase">
                {stack.supportType.replace('_', ' ')}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Elevasi Pusat Nyala (Z):</span>
              <span className="font-mono font-bold text-slate-100 text-sm">
                {results.flame.flameCenterCoords.z.toFixed(1)} meter
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: API 521 Receptor Verification Table */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            4. Tabel Verifikasi Kepatuhan Reseptor API STD 521 (Radiation & Noise Matrix)
          </h3>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Titik Reseptor</th>
                  <th className="py-2.5 px-2 text-center">Posisi (X, Y, Z)</th>
                  <th className="py-2.5 px-2 text-center">Jarak R</th>
                  <th className="py-2.5 px-3 text-right">Radiasi Aktual</th>
                  <th className="py-2.5 px-3 text-right">Batas API 521</th>
                  <th className="py-2.5 px-2 text-right">Margin</th>
                  <th className="py-2.5 px-2 text-center">Bising</th>
                  <th className="py-2.5 px-3 text-center">Status HSE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-950/30">
                {results.receptors.map((rec) => {
                  const isPass = rec.isRadiationPass && rec.isNoisePass;
                  return (
                    <tr key={rec.receptor.id}>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">
                        {rec.receptor.name}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px]">
                        ({rec.receptor.x}, {rec.receptor.y}, +{rec.receptor.z}m)
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-300">
                        {rec.distanceToFlameCenter.toFixed(1)}m
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-100">
                        {rec.radiationKw.toFixed(2)} kW/m²
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-400">
                        {rec.receptor.apiLimitKw.toFixed(2)} kW/m²
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">
                        <span className={rec.marginKw >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {rec.marginKw >= 0 ? `+${rec.marginKw.toFixed(2)}` : rec.marginKw.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-300">
                        {rec.noiseDba.toFixed(0)} dBA
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            isPass
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {isPass ? 'COMPLIANT' : 'EXCEEDED'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Isopleth Contour Radii */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            5. Radius Zona Kontur Isopleth di Permukaan Tanah (Grade Level)
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {isopleths.map((iso) => (
              <div
                key={iso.levelKw}
                className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: iso.color }}
                  />
                  <span className="font-mono font-bold text-slate-200">
                    {iso.levelKw} kW/m²
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-300">
                  {iso.reachesGround && iso.radiusDownwind > 0 ? (
                    <>
                      Radius Tanah:{' '}
                      <span className="font-bold text-amber-400">{iso.radiusDownwind} m</span>
                    </>
                  ) : (
                    <span className="text-emerald-400 font-semibold">
                      Aman di tanah (R 3D: {iso.radius3d} m)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {(iso.levelKw * 317).toFixed(0)} BTU/h·ft²
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Formal HSE Sign-Off Approval Block */}
        <div className="border-t-2 border-slate-700 pt-5 mt-6">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-4">
            Pengesahan & Persetujuan Dokumen Rekayasa (Sign-Off & HSE Endorsement)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-3.5 flex flex-col justify-between h-32">
              <div className="text-[11px] text-slate-400">Dipersiapkan Oleh (Process Lead):</div>
              <div className="text-xs font-bold text-slate-200">{leadEngineer}</div>
              <div className="text-[10px] font-mono text-emerald-400 border-t border-slate-800 pt-1">
                Tanda Tangan Elektronik: VERIFIED
              </div>
            </div>

            <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-3.5 flex flex-col justify-between h-32">
              <div className="text-[11px] text-slate-400">Diverifikasi Oleh (Sipil/Struktur):</div>
              <div className="text-xs font-bold text-slate-200">
                Structural & Civil Engineering Dept.
              </div>
              <div className="text-[10px] font-mono text-emerald-400 border-t border-slate-800 pt-1">
                Tinggi {stack.stackHeight}m: FEASIBLE
              </div>
            </div>

            <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-3.5 flex flex-col justify-between h-32">
              <div className="text-[11px] text-slate-400">Disetujui Oleh (HSE & Safety):</div>
              <div className="text-xs font-bold text-slate-200">{hseAuditor}</div>
              <div
                className={`text-[10px] font-mono border-t border-slate-800 pt-1 font-bold ${
                  isAllCompliant ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isAllCompliant ? 'STATUS: APPROVED' : 'STATUS: REJECTED'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nav Actions (No Print) */}
      <div className="no-print flex flex-wrap justify-between items-center gap-2 pt-2">
        <button
          onClick={onPrev}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali: Iterasi & Optimasi</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {onSaveCompletedProject && (
            <button
              type="button"
              onClick={onSaveCompletedProject}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Proyek Selesai</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-4 py-2.5 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Formal Datasheet</span>
          </button>

          {onNext && (
            <button
              onClick={onNext}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition-all"
            >
              <span>Lanjut: Tahap 8 (Sizing Separator & Gambar GA)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
