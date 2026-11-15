import React, { useState, useMemo, useRef } from 'react';
import {
  FluidProperties,
  SeparatorConfig,
  SeparatorSizingResult,
} from '../types/flaresim';
import {
  DEFAULT_SEPARATOR_CONFIG,
  sizeGasWaterSeparator,
  STANDARD_PIPE_SIZES_MM,
} from '../utils/flareCalculations';
import {
  exportSeparatorToPdf,
  exportSeparatorToDxf,
} from '../utils/separatorExport';
import {
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  Sliders,
  Maximize2,
  Layers,
  Download,
  Printer,
  ArrowRight,
  ArrowLeft,
  Settings,
  Droplets,
  Gauge,
  HelpCircle,
  Eye,
  Check,
  Save,
} from 'lucide-react';

interface Step8SeparatorSizingProps {
  fluid: FluidProperties;
  unitSystem: 'SI' | 'Field';
  config?: SeparatorConfig;
  setConfig?: React.Dispatch<React.SetStateAction<SeparatorConfig>>;
  onSaveCompletedProject?: () => void;
  onNext?: () => void;
  onPrev: () => void;
}

export const Step8SeparatorSizing: React.FC<Step8SeparatorSizingProps> = ({
  fluid,
  unitSystem,
  config: controlledConfig,
  setConfig: setControlledConfig,
  onSaveCompletedProject,
  onNext,
  onPrev,
}) => {
  const [localConfig, setLocalConfig] = useState<SeparatorConfig>(DEFAULT_SEPARATOR_CONFIG);
  const config = controlledConfig ?? localConfig;
  const setConfig = setControlledConfig ?? setLocalConfig;

  const [selectedInternalPart, setSelectedInternalPart] = useState<string | null>('demister');
  const [activeTab, setActiveTab] = useState<'drawing' | 'criteria' | 'nozzles' | 'hazid'>('drawing');
  const svgRef = useRef<SVGSVGElement>(null);

  // Live recalculation of separator sizing
  const result: SeparatorSizingResult = useMemo(() => {
    return sizeGasWaterSeparator(fluid, config);
  }, [fluid, config]);

  const updateConfig = <K extends keyof SeparatorConfig>(key: K, value: SeparatorConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      // Ensure drawing SVG is mounted if user was on another tab
      if (!svgRef.current && activeTab !== 'drawing') {
        setActiveTab('drawing');
        await new Promise((r) => setTimeout(r, 80));
      }
      await exportSeparatorToPdf(svgRef.current, result, fluid, config);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportDxf = () => {
    exportSeparatorToDxf(result, fluid, config);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 lg:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/30">
                <Filter className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold text-slate-100">
                Tahap 8: Sizing Gas-Water Separator (KO Drum / Condensate Pot) & Gambar 2D GA
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-4xl">
              Perhitungan bejana pemisah gas-cair <strong>Vertikal</strong> maupun <strong>Horizontal</strong> di hulu <em>Flame Arrester</em> (FA) dan ujung suar (flare tip) berdasarkan penyesuaian <strong>API 521 / AIChE</strong> untuk sistem biogas tekanan rendah (level mbar). Mencakup eliminasi tetesan 300 µm, evaluasi kecepatan gas riil, seal loop drain, dan gambar teknik 2D lengkap dengan dimensi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-sm transition-colors"
              title="Unduh Lembar Gambar Teknik GA (PDF Landscape A4)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Membuat PDF...' : 'Unduh GA (.PDF)'}</span>
            </button>
            <button
              onClick={handleExportDxf}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-sm transition-colors"
              title="Unduh Gambar CAD 2D AutoCAD (.DXF)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh GA (.DXF)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Process Conditions & Key Design Badges Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] text-slate-400 block">Laju Alir Volumetrik</span>
          <span className="font-mono font-bold text-amber-300 text-sm">
            {result.actualVolumetricFlowM3h.toLocaleString()} m³/h
          </span>
          <span className="text-[10px] text-slate-500 block font-mono">
            ({result.actualVolumetricFlowM3s.toFixed(3)} m³/s)
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] text-slate-400 block">Densitas Gas (ρ_g)</span>
          <span className="font-mono font-bold text-slate-200 text-sm">
            {result.gasDensityKgM3.toFixed(3)} kg/m³
          </span>
          <span className="text-[10px] text-slate-500 block">
            P = {(fluid.reliefPressure * 1000).toFixed(0)} mbarg, T = {fluid.temperature}°C
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] text-slate-400 block">Terminal Vel (300 µm)</span>
          <span className="font-mono font-bold text-sky-300 text-sm">
            {result.terminalVelocityMs} m/s
          </span>
          <span className="text-[10px] text-slate-500 block font-mono">
            Re ≈ {result.reynoldsNumber}, Cd ≈ {result.dragCoefficient}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] text-slate-400 block">
            {config.orientation === 'horizontal' ? 'Vel Gas Horizontal (v_gas)' : 'Vel Gas Naik (v_gas)'}
          </span>
          <span className="font-mono font-bold text-emerald-300 text-sm">
            {result.actualGasVelocityMs} m/s
          </span>
          <span className="text-[10px] text-slate-500 block font-mono">
            (Batas: {result.allowableGasVelocityMs} m/s · {result.velocityRatioVt}×)
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] text-slate-400 block">Diameter Bejana</span>
          <span className="font-mono font-bold text-amber-400 text-sm">
            ID {result.selectedDiameterMm} mm
          </span>
          <span className="text-[10px] text-slate-500 block font-mono">
            (Min: {result.minDiameterMm} mm)
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] text-slate-400 block">
            {config.orientation === 'horizontal' ? 'Panjang T-T (L)' : 'Tinggi Total (T-T)'}
          </span>
          <span className="font-mono font-bold text-slate-200 text-sm">
            {result.tanToTanHeightMm} mm
          </span>
          <span className="text-[10px] text-slate-500 block font-mono">
            {config.orientation === 'horizontal'
              ? `L/D = ${result.ldRatio} · Vol: ${result.workingVolumeLiters} L`
              : `(OAL: ${(result.overallHeightMm / 1000).toFixed(2)} m)`}
          </span>
        </div>
      </div>

      {/* Main Grid: Parameters Sizing Panel (Left 4 cols) + Interactive 2D GA CAD Drawing & Tabs (Right 8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sizing Inputs & Parameters Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Parameter & Basis Desain</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">API 521 / AIChE</span>
            </div>

            {/* Separator Orientation Selector: Vertical vs Horizontal */}
            <div>
              <label className="block text-xs text-slate-300 font-medium mb-1.5">
                Orientasi Bejana (Vessel Orientation):
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => updateConfig('orientation', 'vertical')}
                  className={`py-2 px-2.5 rounded-lg border text-left transition-colors ${
                    config.orientation === 'vertical'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="block">Vertikal (KO Pot)</span>
                  <span className="text-[9px] opacity-80 font-normal block">Hemat lahan (tapak kecil)</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig('orientation', 'horizontal')}
                  className={`py-2 px-2.5 rounded-lg border text-left transition-colors ${
                    config.orientation === 'horizontal'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="block">Horizontal (KO Drum)</span>
                  <span className="text-[9px] opacity-80 font-normal block">Holdup cairan lebih besar</span>
                </button>
              </div>
            </div>

            {/* Droplet Size Selection */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <label className="text-slate-300 font-medium flex items-center gap-1">
                  <span>Target Ukuran Tetesan (d):</span>
                  <span title="Kriteria 300 µm diadopsi dari API 521 konservatif untuk melindungi flame arrester dan flare tip.">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500 cursor-help" />
                  </span>
                </label>
                <span className="font-mono font-bold text-amber-400">
                  {config.dropletSizeMicron} µm
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {[150, 300, 600].map((micron) => (
                  <button
                    key={micron}
                    onClick={() => updateConfig('dropletSizeMicron', micron)}
                    className={`py-1.5 px-2 rounded-lg border text-center font-mono text-[11px] transition-colors ${
                      config.dropletSizeMicron === micron
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {micron} µm {micron === 300 ? '(API 521)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Vessel Diameter Selection */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <label className="text-slate-300 font-medium">Diameter Bejana (ID):</label>
                <span className="font-mono font-bold text-amber-400">
                  {config.selectedDiameterMm} mm ({((config.selectedDiameterMm / 25.4)).toFixed(0)}")
                </span>
              </div>
              <input
                type="range"
                min="150"
                max="600"
                step="25"
                value={config.selectedDiameterMm}
                onChange={(e) => updateConfig('selectedDiameterMm', Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>150 mm (6")</span>
                <span className="text-amber-400 font-bold">Min: {result.minDiameterMm} mm</span>
                <span>600 mm (24")</span>
              </div>

              {/* Quick Diameter Buttons */}
              <div className="grid grid-cols-4 gap-1 mt-2">
                {[200, 250, 300, 350, 400, 450, 500, 600].map((d) => (
                  <button
                    key={d}
                    onClick={() => updateConfig('selectedDiameterMm', d)}
                    className={`py-1 rounded text-[10px] font-mono border transition-colors ${
                      config.selectedDiameterMm === d
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {d}mm
                  </button>
                ))}
              </div>
            </div>

            {/* Horizontal Vessel Length T-T Control */}
            {config.orientation === 'horizontal' && (
              <div className="border-t border-slate-800 pt-3">
                <div className="flex justify-between items-center text-xs mb-1">
                  <label className="text-slate-300 font-medium">Panjang Bejana T-T (L):</label>
                  <span className="font-mono font-bold text-sky-300">
                    {config.selectedLengthMm} mm (L/D = {result.ldRatio})
                  </span>
                </div>
                <input
                  type="range"
                  min="800"
                  max="3000"
                  step="100"
                  value={config.selectedLengthMm}
                  onChange={(e) => updateConfig('selectedLengthMm', Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
                <div className="grid grid-cols-5 gap-1 mt-1.5">
                  {[1000, 1200, 1500, 2000, 2500].map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => updateConfig('selectedLengthMm', len)}
                      className={`py-1 rounded text-[10px] font-mono border transition-colors ${
                        config.selectedLengthMm === len
                          ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Surge Margin Factor */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <label className="text-slate-300 font-medium">Cadangan Lonjakan (Surge Margin):</label>
                <span className="font-mono font-bold text-slate-200">
                  {config.surgeMarginFactor} · vt
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {[0.7, 0.8, 1.0].map((factor) => (
                  <button
                    key={factor}
                    onClick={() => updateConfig('surgeMarginFactor', factor)}
                    className={`py-1.5 px-2 rounded-lg border text-center font-mono text-[11px] transition-colors ${
                      config.surgeMarginFactor === factor
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {factor} vt {factor === 0.8 ? '(Praktik)' : factor === 1.0 ? '(Batas)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Condensate Rate & Drain Mode */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <label className="text-slate-300 font-medium flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-sky-400" />
                    <span>Laju Kondensat Puncak:</span>
                  </label>
                  <span className="font-mono font-bold text-sky-300">
                    {config.condensateRateLitersPerDay} L/hari
                  </span>
                </div>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  step="10"
                  value={config.condensateRateLitersPerDay}
                  onChange={(e) => updateConfig('condensateRateLitersPerDay', Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Setara ±{(config.condensateRateLitersPerDay / 24).toFixed(1)} Liter/jam
                </span>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Kebijakan Pengurasan (Drain Policy):
                </label>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    onClick={() => updateConfig('drainMode', 'continuous_loop_seal')}
                    className={`py-1.5 px-2 rounded-lg border text-left text-[11px] transition-colors ${
                      config.drainMode === 'continuous_loop_seal'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600 font-bold'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="block">Kontinu Loop Seal</span>
                    <span className="text-[9px] opacity-75 font-normal block">Direkomendasikan [P]</span>
                  </button>
                  <button
                    onClick={() => updateConfig('drainMode', 'manual_batch')}
                    className={`py-1.5 px-2 rounded-lg border text-left text-[11px] transition-colors ${
                      config.drainMode === 'manual_batch'
                        ? 'bg-rose-950 text-rose-300 border-rose-600 font-bold'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="block">Manual Periodik</span>
                    <span className="text-[9px] opacity-75 font-normal block">Risiko Overflow</span>
                  </button>
                </div>
              </div>

              {/* Digester Max PRV Pressure for Seal Sizing */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <label className="text-slate-300 font-medium flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-amber-400" />
                    <span>Set PRV Digester (P_max):</span>
                  </label>
                  <span className="font-mono font-bold text-amber-400">
                    {config.maxDigesterPressureMmWc} mmWC
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[170, 255, 350].map((p) => (
                    <button
                      key={p}
                      onClick={() => updateConfig('maxDigesterPressureMmWc', p)}
                      className={`py-1 rounded-lg border text-center font-mono text-[11px] transition-colors ${
                        config.maxDigesterPressureMmWc === p
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {p} mmWC
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Tinggi seal min (x1.5): <strong className="text-slate-300">{result.minSealHeightMmWc} mmWC</strong> (Disediakan: <strong className="text-emerald-400">{result.providedSealHeightMmWc} mmWC</strong>)
                </span>
              </div>
            </div>

            {/* Internal Parts Configuration */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <label className="text-xs text-slate-300 font-medium block">
                Pilihan Komponen Internal:
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Tebal Demister Pad:</span>
                  <select
                    value={config.demisterThicknessMm}
                    onChange={(e) => updateConfig('demisterThicknessMm', Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono"
                  >
                    <option value={100}>100 mm (4")</option>
                    <option value={150}>150 mm (6")</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Inlet Deflector:</span>
                  <select
                    value={config.inletDeflectorType}
                    onChange={(e) => updateConfig('inletDeflectorType', e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="45deg_baffle">Plat Baffle 45°</option>
                    <option value="half_pipe">Half-Pipe Elbow</option>
                    <option value="tangential">Inlet Tangensial</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 2D GA CAD Drawing & Tabs (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('drawing')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'drawing'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Gambar 2D GA Lengkap</span>
              </button>

              <button
                onClick={() => setActiveTab('criteria')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'criteria'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>5 Kriteria Penerimaan [S] / [P]</span>
              </button>

              <button
                onClick={() => setActiveTab('nozzles')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'nozzles'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tabel Nozzle Schedule</span>
              </button>

              <button
                onClick={() => setActiveTab('hazid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'hazid'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Analisis HAZID & Seal Drain</span>
              </button>
            </div>
          </div>

          {/* TAB 1: 2D GA CAD Engineering Drawing */}
          {activeTab === 'drawing' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">
                    {config.orientation === 'horizontal'
                      ? 'General Arrangement (GA) Drawing - Horizontal Knock-Out Drum'
                      : 'General Arrangement (GA) Drawing - Vertical Knock-Out Pot'}
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {config.orientation === 'horizontal'
                      ? 'Proyeksi Potongan Horizontal CAD 2D dengan Saddle Support, Demister Box & Anotasi Dimensi (mm)'
                      : 'Proyeksi Potongan Vertikal CAD 2D dengan Anotasi Dimensi Lengkap (mm)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span>Klik pada komponen untuk menyorot detail teknis</span>
                </div>
              </div>

              {/* The SVG CAD Canvas */}
              <div className="w-full h-[520px] bg-slate-950 rounded-lg border border-slate-900 flex items-center justify-center overflow-hidden relative">
                {config.orientation === 'horizontal' ? (
                  (() => {
                    const xLeftTan = 140;
                    const xRightTan = 540;
                    const shellLenPx = xRightTan - xLeftTan; // 400px -> vesselLengthMm
                    const yTopShell = 135;
                    const shellHeightPx = 140; // -> selectedDiameterMm
                    const yBottomShell = yTopShell + shellHeightPx;
                    const cyShell = yTopShell + shellHeightPx / 2;
                    const pxPerDiaMm = shellHeightPx / Math.max(150, result.selectedDiameterMm);

                    const toHorizY = (elevFromBottomMm: number) =>
                      yBottomShell - elevFromBottomMm * pxPerDiaMm;

                    const yLll = toHorizY(result.lllElevationMm);
                    const yNll = toHorizY(result.nllElevationMm);
                    const yHll = toHorizY(result.hllElevationMm);
                    const yHhll = toHorizY(result.hhllElevationMm);

                    const xInlet = xLeftTan + 55;
                    const xOutlet = xRightTan - 55;
                    const xDrain = xRightTan - 75;

                    return (
                      <svg
                        ref={svgRef}
                        viewBox="0 0 760 520"
                        className="w-full h-full select-none"
                      >
                        <defs>
                          <pattern id="meshHatchH" width="8" height="8" patternUnits="userSpaceOnUse">
                            <path d="M0 0 L8 8 M8 0 L0 8" stroke="#38bdf8" strokeWidth="0.8" opacity="0.65" />
                          </pattern>
                          <linearGradient id="liquidGradH" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.85" />
                          </linearGradient>
                          <pattern id="gridSubH" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0f172a" strokeWidth="0.5" />
                          </pattern>
                        </defs>

                        {/* CAD Background */}
                        <rect width="760" height="520" fill="#030712" />
                        <rect width="760" height="520" fill="url(#gridSubH)" />

                        {/* Title Block */}
                        <g transform="translate(545, 430)">
                          <rect width="195" height="75" fill="#0b1329" stroke="#1e293b" strokeWidth="1" rx="4" />
                          <text x="10" y="18" fill="#f8fafc" fontSize="10" fontWeight="bold">FLARESIM HORIZ. KO DRUM</text>
                          <text x="10" y="32" fill="#94a3b8" fontSize="8.5">TAG: TK-4101H (BIOGAS)</text>
                          <text x="10" y="46" fill="#f59e0b" fontSize="8.5" fontFamily="monospace">
                            ID: {result.selectedDiameterMm} · L: {result.vesselLengthMm} (L/D {result.ldRatio})
                          </text>
                          <text x="10" y="60" fill="#64748b" fontSize="8">SCALE: 1:20 · STATUS: APPROVED</text>
                        </g>

                        {/* Horizontal Centerline */}
                        <line
                          x1="55"
                          y1={cyShell}
                          x2="635"
                          y2={cyShell}
                          stroke="#ef4444"
                          strokeWidth="0.8"
                          strokeDasharray="14 3 3 3"
                          opacity="0.7"
                        />

                        {/* Grade Line */}
                        <line x1="60" y1="455" x2="520" y2="455" stroke="#334155" strokeWidth="2" />
                        <text x="70" y="472" fill="#64748b" fontSize="9" fontFamily="monospace">GRADE ELEV. ±0.000 m</text>

                        {/* Two Saddle Supports */}
                        <g stroke="#475569" strokeWidth="2" fill="#1e293b">
                          <path d={`M ${xLeftTan + 45} ${yBottomShell} L ${xLeftTan + 35} 455 L ${xLeftTan + 95} 455 L ${xLeftTan + 85} ${yBottomShell} Z`} />
                          <path d={`M ${xRightTan - 85} ${yBottomShell} L ${xRightTan - 95} 455 L ${xRightTan - 35} 455 L ${xRightTan - 45} ${yBottomShell} Z`} />
                          <rect x={xLeftTan + 25} y="449" width="80" height="7" fill="#334155" />
                          <rect x={xRightTan - 105} y="449" width="80" height="7" fill="#334155" />
                        </g>

                        {/* Left 2:1 Ellipsoidal Head */}
                        <path
                          d={`M ${xLeftTan} ${yTopShell} C ${xLeftTan - 48} ${yTopShell}, ${xLeftTan - 48} ${yBottomShell}, ${xLeftTan} ${yBottomShell}`}
                          fill="#091328"
                          stroke="#94a3b8"
                          strokeWidth="2.5"
                        />

                        {/* Cylindrical Horizontal Shell */}
                        <rect
                          x={xLeftTan}
                          y={yTopShell}
                          width={shellLenPx}
                          height={shellHeightPx}
                          fill="#071026"
                          stroke="#94a3b8"
                          strokeWidth="2.5"
                        />

                        {/* Right 2:1 Ellipsoidal Head */}
                        <path
                          d={`M ${xRightTan} ${yTopShell} C ${xRightTan + 48} ${yTopShell}, ${xRightTan + 48} ${yBottomShell}, ${xRightTan} ${yBottomShell}`}
                          fill="#091328"
                          stroke="#94a3b8"
                          strokeWidth="2.5"
                        />

                        {/* Tangent Lines */}
                        <line x1={xLeftTan} y1={yTopShell - 18} x2={xLeftTan} y2={yBottomShell + 18} stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />
                        <line x1={xRightTan} y1={yTopShell - 18} x2={xRightTan} y2={yBottomShell + 18} stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />

                        {/* LIQUID HOLDUP ZONE (Bottom -> HLL) */}
                        <g className="cursor-pointer" onClick={() => setSelectedInternalPart('sump')}>
                          <rect
                            x={xLeftTan + 1}
                            y={yHll}
                            width={shellLenPx - 2}
                            height={yBottomShell - yHll}
                            fill="url(#liquidGradH)"
                          />
                          <line x1={xLeftTan} y1={yHll} x2={xRightTan} y2={yHll} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="6 3" />
                        </g>

                        {/* Liquid Level Markers (HHLL, HLL, NLL, LLL) */}
                        <g fontSize="8" fontFamily="monospace" fontWeight="bold">
                          <line x1={xRightTan} y1={yHhll} x2={xRightTan + 46} y2={yHhll} stroke="#ef4444" strokeWidth="1.2" />
                          <text x={xRightTan + 50} y={yHhll + 3} fill="#ef4444">HHLL +{result.hhllElevationMm}</text>

                          <line x1={xRightTan} y1={yHll} x2={xRightTan + 46} y2={yHll} stroke="#f59e0b" strokeWidth="1.2" />
                          <text x={xRightTan + 50} y={yHll + 3} fill="#f59e0b">HLL +{result.hllElevationMm}</text>

                          <line x1={xRightTan} y1={yNll} x2={xRightTan + 46} y2={yNll} stroke="#38bdf8" strokeWidth="1.2" />
                          <text x={xRightTan + 50} y={yNll + 3} fill="#38bdf8">NLL +{result.nllElevationMm}</text>

                          <line x1={xRightTan} y1={yLll} x2={xRightTan + 46} y2={yLll} stroke="#10b981" strokeWidth="1.2" />
                          <text x={xRightTan + 50} y={yLll + 3} fill="#10b981">LLL +{result.lllElevationMm}</text>
                        </g>

                        {/* NOZZLE N1: TOP-LEFT INLET + 45 DEG DEFLECTOR */}
                        <g className="cursor-pointer" onClick={() => setSelectedInternalPart('baffle')}>
                          <rect x={xInlet - 14} y={yTopShell - 36} width="28" height="36" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                          <rect x={xInlet - 19} y={yTopShell - 41} width="38" height="6" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
                          <text x={xInlet} y={yTopShell - 48} fill="#f8fafc" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                            N1: Inlet ({result.nozzles[0]?.nominalSizeInch})
                          </text>
                          {/* Internal 45deg Baffle */}
                          <path
                            d={`M ${xInlet - 18} ${yTopShell + 22} L ${xInlet + 22} ${yTopShell + 48}`}
                            stroke="#f59e0b"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                          {/* Horizontal gas path arrow */}
                          <path
                            d={`M ${xInlet + 35} ${cyShell - 22} L ${xOutlet - 50} ${cyShell - 22}`}
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                            strokeDasharray="5 3"
                          />
                          <text x={(xInlet + xOutlet) / 2 - 15} y={cyShell - 29} fill="#38bdf8" fontSize="8" fontFamily="monospace" textAnchor="middle">
                            Settling Vapor Space (65% ID) · v_gas = {result.actualGasVelocityMs} m/s
                          </text>
                        </g>

                        {/* INTERNAL: HORIZONTAL WIRE MESH DEMISTER BOX + NOZZLE N2 */}
                        <g className="cursor-pointer" onClick={() => setSelectedInternalPart('demister')}>
                          <rect
                            x={xOutlet - 45}
                            y={yTopShell + 4}
                            width="90"
                            height="28"
                            fill="url(#meshHatchH)"
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                          />
                          <line x1={xOutlet - 45} y1={yTopShell + 32} x2={xOutlet + 45} y2={yTopShell + 32} stroke="#f59e0b" strokeWidth="2" />
                          <text x={xOutlet} y={yTopShell + 45} fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
                            DEMISTER PAD ({result.demisterThicknessMm} mm)
                          </text>

                          {/* N2 Gas Outlet */}
                          <rect x={xOutlet - 14} y={yTopShell - 36} width="28" height="36" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                          <rect x={xOutlet - 19} y={yTopShell - 41} width="38" height="6" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
                          <text x={xOutlet} y={yTopShell - 48} fill="#f8fafc" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                            N2: Clean Gas ({result.nozzles[1]?.nominalSizeInch})
                          </text>
                        </g>

                        {/* VORTEX BREAKER + N3 DRAIN + U-LOOP SEAL */}
                        <g className="cursor-pointer" onClick={() => setSelectedInternalPart('vortex')}>
                          <path
                            d={`M ${xDrain - 14} ${yBottomShell - 10} L ${xDrain + 14} ${yBottomShell - 10} M ${xDrain} ${yBottomShell - 20} L ${xDrain} ${yBottomShell}`}
                            stroke="#f59e0b"
                            strokeWidth="2.5"
                          />
                        </g>
                        <g className="cursor-pointer" onClick={() => setSelectedInternalPart('loop_seal')}>
                          <rect x={xDrain - 7} y={yBottomShell} width="14" height="26" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                          <text x={xDrain - 14} y={yBottomShell + 18} fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="end">
                            N3 (Drain 2")
                          </text>
                          <path
                            d={`M ${xDrain} ${yBottomShell + 26} L ${xDrain} 430 L ${xDrain + 75} 430 L ${xDrain + 75} 340 L ${xDrain + 135} 340 L ${xDrain + 135} 455`}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="5"
                            strokeLinecap="round"
                          />
                          <path
                            d={`M ${xDrain + 75} 340 L ${xDrain + 75} 290`}
                            fill="none"
                            stroke="#eab308"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                          <text x={xDrain + 82} y="302" fill="#facc15" fontSize="7.5" fontWeight="bold">Anti-Siphon Vent</text>
                          <text x={xDrain + 142} y="395" fill="#38bdf8" fontSize="8" fontWeight="bold">To IPAL</text>
                          <text x={xDrain - 12} y="410" fill="#f59e0b" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="end">
                            SEAL H = {result.providedSealHeightMmWc} mmWC
                          </text>
                        </g>

                        {/* N4 END MANWAY / HANDHOLE (Left Head) */}
                        <g>
                          <rect x={xLeftTan - 68} y={cyShell - 15} width="32" height="30" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                          <rect x={xLeftTan - 74} y={cyShell - 20} width="6" height="40" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
                          <text x={xLeftTan - 78} y={cyShell - 25} fill="#94a3b8" fontSize="8" textAnchor="end">
                            N4: {result.nozzles[3]?.nominalSizeInch}
                          </text>
                        </g>

                        {/* DIMENSION LINES */}
                        {/* Top: Tan-to-Tan Length L */}
                        <g stroke="#f59e0b" strokeWidth="1" fill="#f59e0b">
                          <line x1={xLeftTan} y1="62" x2={xRightTan} y2="62" />
                          <line x1={xLeftTan} y1="56" x2={xLeftTan} y2="68" />
                          <line x1={xRightTan} y1="56" x2={xRightTan} y2="68" />
                          <text x={(xLeftTan + xRightTan) / 2} y="54" fontSize="9.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            L (T-T) = {result.vesselLengthMm} mm (L/D = {result.ldRatio})
                          </text>
                        </g>

                        {/* Left: Vessel ID */}
                        <g stroke="#f59e0b" strokeWidth="1" fill="#f59e0b">
                          <line x1="78" y1={yTopShell} x2="78" y2={yBottomShell} />
                          <line x1="72" y1={yTopShell} x2="84" y2={yTopShell} />
                          <line x1="72" y1={yBottomShell} x2="84" y2={yBottomShell} />
                          <text
                            transform="rotate(-90)"
                            x={-cyShell}
                            y="68"
                            fontSize="9.5"
                            fontWeight="bold"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            ID = {result.selectedDiameterMm} mm
                          </text>
                        </g>
                      </svg>
                    );
                  })()
                ) : (
                  (() => {
                    // Coordinate space (Vertical KO Pot):
                    const cx = 330;
                    const shellRadius = 65; // ~ID 300 mm visual scale
                    const shellLeft = cx - shellRadius;
                    const shellRight = cx + shellRadius;

                    const yBottomTan = 370;
                    const yTopTan = 90;
                    const shellHeight = yBottomTan - yTopTan; // 280 px representing ~1700mm

                  // Scale factor mm to px
                  const pxPerMm = shellHeight / Math.max(1000, result.tanToTanHeightMm);

                  // Elevations in SVG Y
                  const toSvgY = (elevMm: number) => yBottomTan - elevMm * pxPerMm;

                  const yLll = toSvgY(result.lllElevationMm);
                  const yNll = toSvgY(result.nllElevationMm);
                  const yHll = toSvgY(result.hllElevationMm);
                  const yHhll = toSvgY(result.hhllElevationMm);
                  const yInlet = toSvgY(result.inletElevationMm);
                  const yDemisterBottom = toSvgY(result.demisterBottomElevationMm);
                  const demisterPx = Math.max(16, result.demisterThicknessMm * pxPerMm);
                  const yDemisterTop = yDemisterBottom - demisterPx;

                  return (
                    <svg
                      ref={svgRef}
                      viewBox="0 0 760 520"
                      className="w-full h-full select-none"
                    >
                      <defs>
                        {/* Mesh Hatch pattern for Demister */}
                        <pattern id="meshHatch" width="8" height="8" patternUnits="userSpaceOnUse">
                          <path d="M0 0 L8 8 M8 0 L0 8" stroke="#38bdf8" strokeWidth="0.8" opacity="0.6" />
                        </pattern>
                        {/* Liquid Gradient */}
                        <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0284c7" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.8" />
                        </linearGradient>
                        {/* Centerline Dash pattern */}
                        <pattern id="gridSub" width="20" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0f172a" strokeWidth="0.5" />
                        </pattern>
                      </defs>

                      {/* CAD Blueprint Background */}
                      <rect width="760" height="520" fill="#030712" />
                      <rect width="760" height="520" fill="url(#gridSub)" />

                      {/* Title Block in Corner */}
                      <g transform="translate(560, 430)">
                        <rect width="180" height="75" fill="#0b1329" stroke="#1e293b" strokeWidth="1" rx="4" />
                        <text x="10" y="18" fill="#f8fafc" fontSize="10" fontWeight="bold">FLARESIM KO DRUM GA</text>
                        <text x="10" y="32" fill="#94a3b8" fontSize="8.5">TAG: TK-4101 (BIOGAS)</text>
                        <text x="10" y="46" fill="#f59e0b" fontSize="8.5" fontFamily="monospace">ID: {result.selectedDiameterMm} mm · H: {result.tanToTanHeightMm} mm</text>
                        <text x="10" y="60" fill="#64748b" fontSize="8">SCALE: 1:20 · STATUS: APPROVED</text>
                      </g>

                      {/* Centerline */}
                      <line
                        x1={cx}
                        y1="40"
                        x2={cx}
                        y2="470"
                        stroke="#ef4444"
                        strokeWidth="0.8"
                        strokeDasharray="14 3 3 3"
                        opacity="0.7"
                      />

                      {/* Ground Line */}
                      <line x1="80" y1="465" x2="520" y2="465" stroke="#334155" strokeWidth="2" />
                      <text x="90" y="480" fill="#64748b" fontSize="9" fontFamily="monospace">GRADE ELEV. ±0.000 m</text>

                      {/* Support Legs */}
                      <g stroke="#475569" strokeWidth="2" fill="#1e293b">
                        <rect x={shellLeft - 5} y={yBottomTan + 15} width="12" height={465 - (yBottomTan + 15)} />
                        <rect x={shellRight - 7} y={yBottomTan + 15} width="12" height={465 - (yBottomTan + 15)} />
                        {/* Base plates */}
                        <rect x={shellLeft - 15} y="460" width="32" height="6" fill="#334155" />
                        <rect x={shellRight - 17} y="460" width="32" height="6" fill="#334155" />
                      </g>

                      {/* Bottom Head (2:1 Ellipsoidal dish) */}
                      <path
                        d={`M ${shellLeft} ${yBottomTan} C ${shellLeft} ${yBottomTan + 40}, ${shellRight} ${yBottomTan + 40}, ${shellRight} ${yBottomTan}`}
                        fill="#091328"
                        stroke="#94a3b8"
                        strokeWidth="2.5"
                      />

                      {/* Cylindrical Shell Body */}
                      <rect
                        x={shellLeft}
                        y={yTopTan}
                        width={shellRadius * 2}
                        height={shellHeight}
                        fill="#071026"
                        stroke="#94a3b8"
                        strokeWidth="2.5"
                      />

                      {/* Top Head (2:1 Ellipsoidal dish) */}
                      <path
                        d={`M ${shellLeft} ${yTopTan} C ${shellLeft} ${yTopTan - 40}, ${shellRight} ${yTopTan - 40}, ${shellRight} ${yTopTan}`}
                        fill="#091328"
                        stroke="#94a3b8"
                        strokeWidth="2.5"
                      />

                      {/* Tangent Lines (Dashed grey) */}
                      <line x1={shellLeft - 20} y1={yTopTan} x2={shellRight + 20} y2={yTopTan} stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />
                      <text x={shellRight + 25} y={yTopTan + 3} fill="#64748b" fontSize="8" fontFamily="monospace">T.T. ELEV +{result.tanToTanHeightMm}</text>

                      <line x1={shellLeft - 20} y1={yBottomTan} x2={shellRight + 20} y2={yBottomTan} stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" />
                      <text x={shellRight + 25} y={yBottomTan + 3} fill="#64748b" fontSize="8" fontFamily="monospace">B.T. ELEV +0.000</text>

                      {/* LIQUID ZONE (LLL to HLL) */}
                      <g className="cursor-pointer" onClick={() => setSelectedInternalPart('sump')}>
                        {/* Liquid in bottom head */}
                        <path
                          d={`M ${shellLeft} ${yBottomTan} C ${shellLeft} ${yBottomTan + 40}, ${shellRight} ${yBottomTan + 40}, ${shellRight} ${yBottomTan} Z`}
                          fill="url(#liquidGrad)"
                        />
                        {/* Liquid up to HLL */}
                        <rect
                          x={shellLeft}
                          y={yHll}
                          width={shellRadius * 2}
                          height={yBottomTan - yHll}
                          fill="url(#liquidGrad)"
                        />
                        {/* Water waves pattern on surface */}
                        <line x1={shellLeft} y1={yHll} x2={shellRight} y2={yHll} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="6 3" />
                      </g>

                      {/* Liquid Level Markers & Bridle Connections */}
                      <g fontSize="8" fontFamily="monospace" fontWeight="bold">
                        {/* HHLL */}
                        <line x1={shellLeft - 8} y1={yHhll} x2={shellLeft} y2={yHhll} stroke="#ef4444" strokeWidth="1.5" />
                        <text x={shellLeft - 48} y={yHhll + 3} fill="#ef4444">HHLL +{result.hhllElevationMm}</text>

                        {/* HLL */}
                        <line x1={shellLeft - 8} y1={yHll} x2={shellLeft} y2={yHll} stroke="#f59e0b" strokeWidth="1.5" />
                        <text x={shellLeft - 42} y={yHll + 3} fill="#f59e0b">HLL +{result.hllElevationMm}</text>

                        {/* NLL */}
                        <line x1={shellLeft - 8} y1={yNll} x2={shellLeft} y2={yNll} stroke="#38bdf8" strokeWidth="1.5" />
                        <text x={shellLeft - 42} y={yNll + 3} fill="#38bdf8">NLL +{result.nllElevationMm}</text>

                        {/* LLL */}
                        <line x1={shellLeft - 8} y1={yLll} x2={shellLeft} y2={yLll} stroke="#10b981" strokeWidth="1.5" />
                        <text x={shellLeft - 42} y={yLll + 3} fill="#10b981">LLL +{result.lllElevationMm}</text>
                      </g>

                      {/* INTERNAL 1: VORTEX BREAKER (Bottom) */}
                      <g
                        className="cursor-pointer"
                        onClick={() => setSelectedInternalPart('vortex')}
                      >
                        <path
                          d={`M ${cx - 15} ${yBottomTan + 25} L ${cx + 15} ${yBottomTan + 25} M ${cx} ${yBottomTan + 12} L ${cx} ${yBottomTan + 35}`}
                          stroke="#f59e0b"
                          strokeWidth="2.5"
                        />
                        <circle cx={cx} cy={yBottomTan + 25} r="4" fill="#f59e0b" />
                      </g>

                      {/* NOZZLE N3: Liquid Drain Pipe to Loop Seal */}
                      <g className="cursor-pointer" onClick={() => setSelectedInternalPart('loop_seal')}>
                        <rect x={cx - 7} y={yBottomTan + 38} width="14" height="28" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                        <text x={cx + 12} y={yBottomTan + 55} fill="#38bdf8" fontSize="8" fontWeight="bold">N3 (Drain 2")</text>

                        {/* U-LOOP SEAL PIPE DRAWING */}
                        {/* Downcomer pipe */}
                        <path
                          d={`M ${cx} ${yBottomTan + 66} L ${cx} 450 L ${cx + 60} 450 L ${cx + 60} 380 L ${cx + 110} 380 L ${cx + 110} 470`}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="5"
                          strokeLinecap="round"
                        />
                        {/* Anti-siphon vent line */}
                        <path
                          d={`M ${cx + 60} 380 L ${cx + 60} 310`}
                          fill="none"
                          stroke="#eab308"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                        <text x={cx + 65} y="325" fill="#facc15" fontSize="7.5" fontWeight="bold">Anti-Siphon Vent</text>
                        <text x={cx + 115} y="440" fill="#38bdf8" fontSize="8" fontWeight="bold">To IPAL (Continuous)</text>

                        {/* Loop Seal Dimension Arrow (mmWC) */}
                        <line x1={cx + 40} y1="450" x2={cx + 40} y2="380" stroke="#f59e0b" strokeWidth="1.2" markerEnd="url(#arrow)" />
                        <text x={cx - 45} y="420" fill="#f59e0b" fontSize="8" fontWeight="bold" fontFamily="monospace">
                          SEAL H = {result.providedSealHeightMmWc} mmWC
                        </text>
                      </g>

                      {/* NOZZLE N1: INLET (Left Side) */}
                      <g
                        className="cursor-pointer"
                        onClick={() => setSelectedInternalPart('baffle')}
                      >
                        {/* Inlet Pipe Nozzle */}
                        <rect
                          x={shellLeft - 45}
                          y={yInlet - 14}
                          width="45"
                          height="28"
                          fill="#1e293b"
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                        />
                        {/* Flange */}
                        <rect
                          x={shellLeft - 48}
                          y={yInlet - 19}
                          width="6"
                          height="38"
                          fill="#475569"
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                        />
                        <text x={shellLeft - 50} y={yInlet - 24} fill="#f8fafc" fontSize="8.5" fontWeight="bold">
                          N1: Inlet ({result.nozzles[0]?.nominalSizeInch})
                        </text>

                        {/* INTERNAL 2: INLET 45° DEFLECTOR BAFFLE */}
                        <path
                          d={`M ${shellLeft + 1} ${yInlet - 20} L ${shellLeft + 30} ${yInlet + 25}`}
                          stroke="#f59e0b"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                        {/* Arrow showing downward gas/liquid deflection */}
                        <path
                          d={`M ${shellLeft + 18} ${yInlet + 6} Q ${shellLeft + 25} ${yInlet + 32} ${shellLeft + 10} ${yInlet + 45}`}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          strokeDasharray="3 2"
                        />
                      </g>

                      {/* INTERNAL 3: WIRE MESH DEMISTER PAD */}
                      <g
                        className="cursor-pointer"
                        onClick={() => setSelectedInternalPart('demister')}
                      >
                        {/* Support Grids top and bottom */}
                        <line x1={shellLeft + 2} y1={yDemisterBottom} x2={shellRight - 2} y2={yDemisterBottom} stroke="#f59e0b" strokeWidth="2" />
                        <line x1={shellLeft + 2} y1={yDemisterTop} x2={shellRight - 2} y2={yDemisterTop} stroke="#f59e0b" strokeWidth="2" />

                        {/* Mesh Body */}
                        <rect
                          x={shellLeft + 2}
                          y={yDemisterTop}
                          width={shellRadius * 2 - 4}
                          height={demisterPx}
                          fill="url(#meshHatch)"
                          stroke="#38bdf8"
                          strokeWidth="1"
                        />
                        <rect
                          x={shellLeft + 2}
                          y={yDemisterTop}
                          width={shellRadius * 2 - 4}
                          height={demisterPx}
                          fill="#0284c7"
                          fillOpacity="0.15"
                        />

                        {/* Demister Label */}
                        <text
                          x={cx}
                          y={yDemisterTop + demisterPx / 2 + 3}
                          fill="#38bdf8"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          WIRE MESH DEMISTER ({result.demisterThicknessMm} mm)
                        </text>
                      </g>

                      {/* NOZZLE N2: GAS OUTLET (Top Head) */}
                      <g className="cursor-pointer" onClick={() => setSelectedInternalPart('demister')}>
                        <rect
                          x={cx - 16}
                          y={yTopTan - 65}
                          width="32"
                          height="35"
                          fill="#1e293b"
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                        />
                        <rect
                          x={cx - 22}
                          y={yTopTan - 69}
                          width="44"
                          height="6"
                          fill="#475569"
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                        />
                        <text x={cx} y={yTopTan - 76} fill="#f8fafc" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                          N2: Clean Gas Outlet ({result.nozzles[1]?.nominalSizeInch})
                        </text>
                        {/* Gas outlet arrows */}
                        <path d={`M ${cx} ${yTopTan - 15} L ${cx} ${yTopTan - 55}`} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" />
                      </g>

                      {/* NOZZLE N4: MANWAY / INSPECTION (Right side) */}
                      <g>
                        <rect x={shellRight} y={yInlet - 10} width="35" height="25" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x={shellRight + 32} y={yInlet - 14} width="6" height="33" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
                        <text x={shellRight + 42} y={yInlet + 5} fill="#94a3b8" fontSize="8">
                          {result.nozzles[3]?.nominalSizeInch}
                        </text>
                      </g>

                      {/* DIMENSION LINES & CALLOUTS (CAD Standard) */}
                      {/* Left: Overall Tan-to-Tan Height */}
                      <g stroke="#f59e0b" strokeWidth="1" fill="#f59e0b">
                        <line x1="160" y1={yTopTan} x2="160" y2={yBottomTan} />
                        <line x1="150" y1={yTopTan} x2="170" y2={yTopTan} />
                        <line x1="150" y1={yBottomTan} x2="170" y2={yBottomTan} />
                        <text
                          transform={`rotate(-90)`}
                          x={-(yTopTan + shellHeight / 2)}
                          y="152"
                          fontSize="9.5"
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          H (T-T) = {result.tanToTanHeightMm} mm
                        </text>
                      </g>

                      {/* Top: Shell Diameter ID */}
                      <g stroke="#f59e0b" strokeWidth="1" fill="#f59e0b">
                        <line x1={shellLeft} y1="70" x2={shellRight} y2="70" />
                        <line x1={shellLeft} y1="65" x2={shellLeft} y2="75" />
                        <line x1={shellRight} y1="65" x2={shellRight} y2="75" />
                        <text x={cx} y="62" fontSize="9.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                          ID = {result.selectedDiameterMm} mm
                        </text>
                      </g>

                      {/* Disengagement zone dimension */}
                      <g stroke="#38bdf8" strokeWidth="0.8" fill="#38bdf8">
                        <line x1={shellRight + 10} y1={yInlet} x2={shellRight + 10} y2={yDemisterBottom} />
                        <text x={shellRight + 14} y={yDemisterBottom + (yInlet - yDemisterBottom) / 2 + 3} fontSize="8" fontFamily="monospace">
                          Disengagement = {result.disengagementHeightMm} mm
                        </text>
                      </g>
                    </svg>
                  );
                })()
                )}
              </div>

              {/* Part Details Inspector Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>Spesifikasi Internal Part Terpilih:</span>
                    <strong className="text-amber-300 font-mono capitalize">
                      {selectedInternalPart === 'demister' && 'Wire Mesh Demister Pad (Mist Eliminator)'}
                      {selectedInternalPart === 'baffle' && 'Inlet Impingement Deflector Baffle Plate'}
                      {selectedInternalPart === 'loop_seal' && 'U-Loop Seal Liquid Drain & Anti-Siphon'}
                      {selectedInternalPart === 'vortex' && 'Cross Baffle Vortex Breaker'}
                      {selectedInternalPart === 'sump' && 'Liquid Sump & Level Retention (LLL-HLL)'}
                    </strong>
                  </span>
                  <div className="flex items-center gap-1">
                    {['demister', 'baffle', 'loop_seal', 'vortex', 'sump'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setSelectedInternalPart(p)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-colors ${
                          selectedInternalPart === p
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {p.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Part descriptions */}
                {selectedInternalPart === 'demister' && (
                  <div className="space-y-1.5 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>Fungsi:</strong> Menangkap tetesan kabut cair (<em>mist</em>) berukuran mikro (&gt; 10 µm) dengan efisiensi &gt; 99% sebelum gas bersih dialirkan menuju <em>Flame Arrester</em> dan suar.
                    </p>
                    <p>
                      <strong>Material & Spesifikasi:</strong> Stainless Steel 316 / 304 kawat rajut (<em>knitted wire mesh</em>), densitas volumetrik 144 kg/m³, fraksi ruang kosong (<em>voidage</em>) 98.2%, tebal {result.demisterThicknessMm} mm. Dilengkapi grid penyangga atas-bawah (<em>top/bottom support grids</em>) dan tie wire pengikat.
                    </p>
                    <p>
                      <strong>Pressure Drop:</strong> ≈ {result.demisterDropMbar} mbar pada kecepatan gas riil {result.actualGasVelocityMs} m/s. Sangat aman dalam batas alokasi 0.5 mbar.
                    </p>
                  </div>
                )}

                {selectedInternalPart === 'baffle' && (
                  <div className="space-y-1.5 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>Fungsi:</strong> Mereduksi momentum fluida masuk (ρv²) dan membelokkan aliran ke bawah untuk memisahkan fraksi cairan curah (<em>bulk liquid</em>) secara gravitasi, mencegah cairan terlempar ke atas menuju demister.
                    </p>
                    <p>
                      <strong>Geometri:</strong> Plat miring 45°, tebal 6 mm, dipasang tepat di depan nozzle inlet N1 dengan celah pembebasan gas minimum 1.2 × luas penampang pipa inlet.
                    </p>
                    <p>
                      <strong>Elevasi:</strong> Berada pada +{result.inletElevationMm} mm, minimal 200 mm di atas level trip HHLL.
                    </p>
                  </div>
                )}

                {selectedInternalPart === 'loop_seal' && (
                  <div className="space-y-1.5 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>Fungsi:</strong> Membuang kondensat cair secara kontinu ke saluran IPAL tanpa memerlukan katup mekanik yang rentan macet oleh deposit kotoran biogas, sekaligus mencegah kebocoran gas ke atmosfer.
                    </p>
                    <p>
                      <strong>Tinggi Seal Air:</strong> Disediakan {result.providedSealHeightMmWc} mmWC, melebihi batas minimum P_max × 1.5 = {result.minSealHeightMmWc} mmWC. Gas biogas tidak akan mendesak keluar saat digester mencapai tekanan set PRV.
                    </p>
                    <p>
                      <strong>Proteksi:</strong> Pipa U dilengkapi <em>Anti-Siphon Vent Line</em> untuk mencegah efek siphon yang menyedot habis air seal, serta port pengisian ulang (<em>water make-up</em>).
                    </p>
                  </div>
                )}

                {selectedInternalPart === 'vortex' && (
                  <div className="space-y-1.5 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>Fungsi:</strong> Mencegah terbentuknya pusaran cairan (<em>vortex funnel</em>) di atas nozzle pembuangan drain N3 yang dapat menarik gas biogas ikut terhisap ke dalam pipa drainase.
                    </p>
                    <p>
                      <strong>Konstruksi:</strong> Plat silang tegak (4 × 90° cross-baffle), tinggi 50 mm, panjang 1.5 × diameter nozzle drain (75 mm).
                    </p>
                  </div>
                )}

                {selectedInternalPart === 'sump' && (
                  <div className="space-y-1.5 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>Kapasitas Tampung ({config.orientation === 'horizontal' ? 'Horizontal' : 'Vertikal'}):</strong>{' '}
                      {config.orientation === 'horizontal'
                        ? `Bejana horizontal ID ${result.selectedDiameterMm} mm × L ${result.vesselLengthMm} mm dengan zona cair LLL–HLL (${result.lllElevationMm}–${result.hllElevationMm} mm dari dasar shell) menampung ${result.workingVolumeLiters} Liter.`
                        : `Luas penampang bejana ID ${result.selectedDiameterMm} mm = ${(Math.PI / 4 * Math.pow(result.selectedDiameterMm / 1000, 2)).toFixed(4)} m², menampung ≈ ${Math.round(Math.PI / 4 * Math.pow(result.selectedDiameterMm / 1000, 2) * 1000)} Liter per meter tinggi (Volume kerja LLL–HLL = ${result.workingVolumeLiters} L).`}
                    </p>
                    <p>
                      <strong>Waktu Isi:</strong> Volume kerja LLL-HLL ({result.workingVolumeLiters} L) terisi penuh dalam ≈ {result.fillTimeHours} jam pada laju kondensat puncak {config.condensateRateLitersPerDay} L/hari.
                    </p>
                    <p className="text-amber-400 font-semibold">
                      Konfirmasi Praktik AIChE: Drain manual periodik tidak layak. Drain kontinu via loop seal wajib diaktifkan.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AIChE 5 Engineering Acceptance Criteria Table */}
          {activeTab === 'criteria' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-slate-200">
                  Tabel Evaluasi Kriteria Penerimaan Tahap Desain (AIChE / API 521)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Kode: <strong className="text-sky-300">[S]</strong> = Turunan Standar Resmi · <strong className="text-amber-300">[P]</strong> = Praktik Industri / Engineering Best Practice
                </p>
              </div>

              <div className="space-y-3">
                {result.criteria.map((c) => (
                  <div
                    key={c.id}
                    className={`border rounded-xl p-3 text-xs space-y-1.5 ${
                      c.status === 'OK'
                        ? 'bg-slate-900/60 border-slate-800'
                        : 'bg-amber-950/20 border-amber-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold flex items-center justify-center text-[10px]">
                          {c.id}
                        </span>
                        <span className="font-bold text-slate-200">{c.criteriaName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            c.sourceCode === '[S]'
                              ? 'bg-sky-950 text-sky-300 border border-sky-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {c.sourceCode}
                        </span>
                      </div>

                      <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          c.status === 'OK'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {c.status === 'OK' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <AlertTriangle className="w-3 h-3 text-amber-400" />}
                        <span>{c.status}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/60 p-2 rounded-lg">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Batas Penerimaan:</span>
                        <span className="text-slate-200">{c.acceptanceLimit}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Nilai Desain Hasil Kalkulasi:</span>
                        <span className="text-amber-300 font-bold">{c.calculatedValue}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {c.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Nozzle Schedule Table */}
          {activeTab === 'nozzles' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-slate-200">
                  Tabel Nozzle Schedule Bejana Pemisah (TK-4101)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Daftar flensa nozzle standar ANSI / ASME B16.5 Class 150 # RF untuk perpipaan biogas
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                      <th className="py-2 px-2.5">Tag</th>
                      <th className="py-2 px-2.5">Layanan (Service)</th>
                      <th className="py-2 px-2.5">Ukuran NPS</th>
                      <th className="py-2 px-2.5">ID (mm)</th>
                      <th className="py-2 px-2.5">Elevasi (mm)</th>
                      <th className="py-2 px-2.5">Kecepatan</th>
                      <th className="py-2 px-2.5">Catatan Teknis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {result.nozzles.map((noz) => (
                      <tr key={noz.tag} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-2.5 font-bold text-amber-400">{noz.tag}</td>
                        <td className="py-2.5 px-2.5 font-sans font-medium text-slate-200">{noz.service}</td>
                        <td className="py-2.5 px-2.5 text-slate-300 font-bold">{noz.nominalSizeInch}</td>
                        <td className="py-2.5 px-2.5 text-slate-400">{noz.sizeMm} mm</td>
                        <td className="py-2.5 px-2.5 text-sky-400">
                          {noz.elevationMm >= 0 ? `+${noz.elevationMm}` : noz.elevationMm}
                        </td>
                        <td className="py-2.5 px-2.5 text-emerald-400">
                          {noz.velocityMs > 0 ? `${noz.velocityMs.toFixed(1)} m/s` : 'Statik'}
                        </td>
                        <td className="py-2.5 px-2.5 font-sans text-slate-400 text-[10px]">{noz.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: HAZID & Safety Analysis */}
          {activeTab === 'hazid' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Kajian Bahaya Proses (HAZID) & Kebijakan Seal Drain Biogas</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Temuan kritis terkait risiko gas buang terlepas ke atmosfer atau tersumbatnya jalur suar
                </p>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Temuan 1: Pengurasan Manual Tidak Layak (Risiko Overflow ke Tip)</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Dengan laju kondensat puncak <strong className="text-amber-300">±{config.condensateRateLitersPerDay} L/hari</strong> dan volume sump ID {result.selectedDiameterMm} mm yang hanya menampung <strong className="text-amber-300">±{Math.round(result.workingVolumeLiters)} Liter</strong>, bejana akan penuh terisi air hanya dalam <strong className="text-rose-400">{result.fillTimeHours} jam</strong>. Jika operator terlambat membuka katup drain, air kondensat akan terseret (*carry-over*) masuk ke <em>Flame Arrester</em> dan memadamkan nyala flare tip, menyebabkan pelepasan gas metana dan H₂S beracun langsung tanpa terbakar!
                  </p>
                  <p className="text-emerald-400 font-semibold text-[11px]">
                    ✓ Rekomendasi Solusi: Drain WAJIB KONTINU lewat U-Loop Seal langsung ke saluran IPAL tertutup.
                  </p>
                </div>

                <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Temuan 2: Risiko Siphon & Seal Kering (Gas Leakage ke Atmosfer)</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Pipa U-loop seal yang kering akibat penguapan saat musim panas, atau mengalami efek penarikan siphon (*vacuum pull*), akan kehilangan kolom penahan airnya. Jalur terbuka ini akan menjadi jalan keluar langsung bagi gas biogas ke atmosfer terbuka.
                  </p>
                  <p className="text-amber-300 font-semibold text-[11px]">
                    ✓ Tindakan Mitigasi: Pasang pipa <em>Anti-Siphon Vent Line</em> pada puncak lekukan U-seal, pasang saluran pengisian air otomatis (*seal water make-up line*), dan masukkan ke dalam jadwal inspeksi harian HSE operator.
                  </p>
                </div>

                <div className="bg-sky-950/30 border border-sky-800/60 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sky-300">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                    <span>Temuan 3: Tekanan Desain (MAWP) Tingkat mbar Cukup</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Standar KO drum flare kilang mensyaratkan MAWP 3.4 barg untuk menahan deflagrasi darurat. Pada sistem flare biogas bertekanan rendah, separator berada di hulu <em>Flame Arrester</em> (FA) yang telah tersertifikasi menahan ledakan rambatan api balik (*flashback*), dan sistem beroperasi pada tekanan 15 - 50 mbar. Oleh karena itu, bejana dengan tekanan desain atmosferik / low pressure (misal 1.0 barg hydrotest) sudah memadai dan sangat hemat material.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs">
        <button
          onClick={onPrev}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Tahap 7: Laporan Datasheet</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingPdf ? 'Membuat PDF...' : 'Unduh Gambar GA (.PDF)'}</span>
          </button>
          <button
            onClick={handleExportDxf}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Gambar GA (.DXF)</span>
          </button>
          {onSaveCompletedProject && (
            <button
              type="button"
              onClick={onSaveCompletedProject}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg shadow-md transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Selesai &amp; Simpan Proyek</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
