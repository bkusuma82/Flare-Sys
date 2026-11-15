import React, { useState } from 'react';
import {
  FluidProperties,
  EnvironmentConditions,
  GasType,
  GasComponentItem,
  FlowInputMode,
} from '../types/flaresim';
import {
  calculateGasDensity,
  calculateSonicVelocity,
  calculateNormalGasDensity,
  calculateMixtureProperties,
  DEFAULT_GAS_COMPONENTS,
} from '../utils/flareCalculations';
import {
  Wind,
  Droplets,
  Thermometer,
  Gauge,
  Sun,
  Database,
  ArrowRight,
  Compass,
  FileCode2,
  Sliders,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Info,
} from 'lucide-react';

interface Step1InputDataProps {
  fluid: FluidProperties;
  setFluid: React.Dispatch<React.SetStateAction<FluidProperties>>;
  env: EnvironmentConditions;
  setEnv: React.Dispatch<React.SetStateAction<EnvironmentConditions>>;
  unitSystem: 'SI' | 'Field';
  onNext: () => void;
}

const GAS_PRESETS: Record<
  GasType,
  { name: string; mw: number; lhv: number; k: number; z: number }
> = {
  natural_gas: { name: 'Natural Gas (Sales Gas)', mw: 18.2, lhv: 48.2, k: 1.28, z: 0.94 },
  methane: { name: 'Pure Methane (CH4)', mw: 16.04, lhv: 50.0, k: 1.30, z: 0.98 },
  propane: { name: 'Propane / LPG (C3H8)', mw: 44.1, lhv: 46.3, k: 1.13, z: 0.92 },
  ethylene: { name: 'Ethylene (C2H4)', mw: 28.05, lhv: 47.2, k: 1.24, z: 0.95 },
  sour_gas: { name: 'Sour Gas (with H2S)', mw: 23.5, lhv: 41.5, k: 1.26, z: 0.91 },
  syngas: { name: 'Synthesis Gas (H2 / CO)', mw: 14.5, lhv: 38.0, k: 1.35, z: 0.97 },
  biogas: { name: 'Biogas (60% CH4, 40% CO2)', mw: 27.2, lhv: 21.5, k: 1.28, z: 0.96 },
  custom: { name: 'Custom Composition', mw: 20.4, lhv: 46.8, k: 1.25, z: 0.94 },
};

export const Step1InputData: React.FC<Step1InputDataProps> = ({
  fluid,
  setFluid,
  env,
  setEnv,
  unitSystem,
  onNext,
}) => {
  const [showHysysModal, setShowHysysModal] = useState(false);
  const [flowMode, setFlowMode] = useState<FlowInputMode>(fluid.flowInputMode || 'mass_kgh');
  const [customComponents, setCustomComponents] = useState<GasComponentItem[]>(
    fluid.customComponents && fluid.customComponents.length > 0
      ? fluid.customComponents
      : DEFAULT_GAS_COMPONENTS
  );

  // Interactive Operational Range -> Governing Design Case Assistant
  const [opPMinMbar, setOpPMinMbar] = useState<number>(25);
  const [opPMaxMbar, setOpPMaxMbar] = useState<number>(40);
  const [opFlowMax, setOpFlowMax] = useState<number>(Math.max(100, Math.round(fluid.massFlowRate)));
  const [opFlowMin, setOpFlowMin] = useState<number>(Math.max(50, Math.round(fluid.massFlowRate * 0.4)));
  const [activeDesignCase, setActiveDesignCase] = useState<'peak_sizing' | 'max_backpressure' | 'turndown' | null>(null);

  const [hysysSnippet, setHysysSnippet] = useState(
    JSON.stringify(
      {
        streamName: 'HP_DEPRESSURING_BLOWDOWN',
        massFlowRate_kg_h: 135000,
        temperature_C: 48.5,
        pressure_barg: 4.8,
        molecularWeight: 19.1,
        lhv_MJ_kg: 47.8,
        k_CpCv: 1.27,
      },
      null,
      2
    )
  );

  const density = calculateGasDensity(
    fluid.reliefPressure,
    fluid.temperature,
    fluid.molecularWeight,
    fluid.compressibilityZ
  );

  const rhoNormal = calculateNormalGasDensity(fluid.molecularWeight);

  const sonicVel = calculateSonicVelocity(
    fluid.temperature,
    fluid.molecularWeight,
    fluid.heatCapacityRatio
  );

  const totalHeatMw = (fluid.massFlowRate / 3600) * fluid.lhv;

  // Calculate current volumetric rates
  const actualVolumetricM3h = density > 0 ? fluid.massFlowRate / density : 0;
  const normalVolumetricNm3h = rhoNormal > 0 ? fluid.massFlowRate / rhoNormal : 0;

  const handleGasTypeChange = (type: GasType) => {
    const preset = GAS_PRESETS[type];
    if (type === 'custom') {
      const mix = calculateMixtureProperties(customComponents);
      setFluid((prev) => ({
        ...prev,
        gasType: type,
        gasName: 'Custom Gas Mixture',
        molecularWeight: mix.mw,
        lhv: mix.lhv,
        heatCapacityRatio: mix.k,
        compressibilityZ: mix.z,
        h2sContentPct: mix.h2sPct,
        customComponents,
      }));
    } else {
      setFluid((prev) => ({
        ...prev,
        gasType: type,
        gasName: preset.name,
        molecularWeight: preset.mw,
        lhv: preset.lhv,
        heatCapacityRatio: preset.k,
        compressibilityZ: preset.z,
        h2sContentPct: type === 'biogas' ? 0.35 : type === 'sour_gas' ? 2.5 : 0.05,
        massFlowRate: type === 'biogas' && prev.massFlowRate > 20000 ? 3600 : prev.massFlowRate,
        reliefPressure: type === 'biogas' && prev.reliefPressure > 2.0 ? 0.15 : prev.reliefPressure,
      }));
    }
  };

  // Handle flow rate input change depending on selected mode
  const handleFlowValueChange = (rawVal: number) => {
    if (flowMode === 'vol_actual_m3h') {
      const calculatedMass = rawVal * density;
      setFluid((p) => ({
        ...p,
        massFlowRate: Math.max(1, Math.round(calculatedMass)),
        volumetricFlowInput: rawVal,
        flowInputMode: 'vol_actual_m3h',
      }));
    } else if (flowMode === 'vol_normal_nm3h') {
      const calculatedMass = rawVal * rhoNormal;
      setFluid((p) => ({
        ...p,
        massFlowRate: Math.max(1, Math.round(calculatedMass)),
        volumetricFlowInput: rawVal,
        flowInputMode: 'vol_normal_nm3h',
      }));
    } else {
      setFluid((p) => ({
        ...p,
        massFlowRate: Math.max(1, rawVal),
        flowInputMode: 'mass_kgh',
      }));
    }
  };

  // Apply Governing Design Case from fluctuating operational range (e.g., 25-40 mbar)
  const applyGoverningDesignCase = (caseType: 'peak_sizing' | 'max_backpressure' | 'turndown') => {
    const pMbar = caseType === 'peak_sizing' ? opPMinMbar : opPMaxMbar;
    const pBarg = Math.max(0.001, pMbar / 1000);
    const targetRho = calculateGasDensity(
      pBarg,
      fluid.temperature,
      fluid.molecularWeight,
      fluid.compressibilityZ
    );
    const selectedFlowVal = caseType === 'turndown' ? opFlowMin : opFlowMax;

    let nextMassKgH = selectedFlowVal;
    if (flowMode === 'vol_actual_m3h') {
      nextMassKgH = Math.max(1, Math.round(selectedFlowVal * targetRho));
    } else if (flowMode === 'vol_normal_nm3h') {
      nextMassKgH = Math.max(1, Math.round(selectedFlowVal * rhoNormal));
    } else {
      nextMassKgH = Math.max(1, Math.round(selectedFlowVal));
    }

    setFluid((p) => ({
      ...p,
      reliefPressure: Math.round(pBarg * 10000) / 10000,
      massFlowRate: nextMassKgH,
      volumetricFlowInput: flowMode !== 'mass_kgh' ? selectedFlowVal : p.volumetricFlowInput,
      flowInputMode: flowMode,
    }));
    setActiveDesignCase(caseType);
  };

  // Custom component percentage change
  const handleComponentChange = (id: string, newMole: number) => {
    const updated = customComponents.map((c) =>
      c.id === id ? { ...c, molePct: Math.max(0, newMole) } : c
    );
    setCustomComponents(updated);
    const mix = calculateMixtureProperties(updated);
    setFluid((p) => ({
      ...p,
      molecularWeight: mix.mw,
      lhv: mix.lhv,
      heatCapacityRatio: mix.k,
      compressibilityZ: mix.z,
      h2sContentPct: mix.h2sPct,
      customComponents: updated,
    }));
  };

  // Normalize components to 100%
  const handleNormalizeComponents = () => {
    const total = customComponents.reduce((sum, c) => sum + Math.max(0, c.molePct), 0);
    if (total <= 0) return;
    const normalized = customComponents.map((c) => ({
      ...c,
      molePct: Math.round(((Math.max(0, c.molePct) / total) * 100) * 10) / 10,
    }));
    setCustomComponents(normalized);
    const mix = calculateMixtureProperties(normalized);
    setFluid((p) => ({
      ...p,
      molecularWeight: mix.mw,
      lhv: mix.lhv,
      heatCapacityRatio: mix.k,
      compressibilityZ: mix.z,
      h2sContentPct: mix.h2sPct,
      customComponents: normalized,
    }));
  };

  // Load custom blend presets
  const handleLoadBlend = (blendType: 'rich' | 'lean' | 'refinery' | 'syngas' | 'biogas_blend') => {
    let comps: GasComponentItem[] = [];
    if (blendType === 'rich') {
      comps = [
        { id: 'ch4', name: 'Metana', formula: 'CH4', mw: 16.043, lhvMjKg: 50.01, kCpCv: 1.304, molePct: 70.0 },
        { id: 'c2h6', name: 'Etana', formula: 'C2H6', mw: 30.070, lhvMjKg: 47.79, kCpCv: 1.186, molePct: 14.0 },
        { id: 'c3h8', name: 'Propana', formula: 'C3H8', mw: 44.097, lhvMjKg: 46.36, kCpCv: 1.130, molePct: 8.0 },
        { id: 'c4h10', name: 'Butana (i/n)', formula: 'C4H10', mw: 58.123, lhvMjKg: 45.66, kCpCv: 1.095, molePct: 4.0 },
        { id: 'c5plus', name: 'Pentana+ (C5+)', formula: 'C5H12+', mw: 72.150, lhvMjKg: 45.00, kCpCv: 1.080, molePct: 1.5 },
        { id: 'co2', name: 'Karbon Dioksida', formula: 'CO2', mw: 44.010, lhvMjKg: 0.00, kCpCv: 1.289, molePct: 1.5 },
        { id: 'n2', name: 'Nitrogen', formula: 'N2', mw: 28.013, lhvMjKg: 0.00, kCpCv: 1.404, molePct: 0.8 },
        { id: 'h2s', name: 'Hidrogen Sulfida', formula: 'H2S', mw: 34.082, lhvMjKg: 15.20, kCpCv: 1.320, molePct: 0.2 },
        { id: 'h2', name: 'Hidrogen', formula: 'H2', mw: 2.016, lhvMjKg: 120.00, kCpCv: 1.405, molePct: 0.0 },
        { id: 'co', name: 'Karbon Monoksida', formula: 'CO', mw: 28.010, lhvMjKg: 10.10, kCpCv: 1.400, molePct: 0.0 },
        { id: 'h2o', name: 'Uap Air', formula: 'H2O', mw: 18.015, lhvMjKg: 0.00, kCpCv: 1.330, molePct: 0.0 },
      ];
    } else if (blendType === 'lean') {
      comps = [
        { id: 'ch4', name: 'Metana', formula: 'CH4', mw: 16.043, lhvMjKg: 50.01, kCpCv: 1.304, molePct: 92.5 },
        { id: 'c2h6', name: 'Etana', formula: 'C2H6', mw: 30.070, lhvMjKg: 47.79, kCpCv: 1.186, molePct: 4.5 },
        { id: 'c3h8', name: 'Propana', formula: 'C3H8', mw: 44.097, lhvMjKg: 46.36, kCpCv: 1.130, molePct: 1.0 },
        { id: 'c4h10', name: 'Butana (i/n)', formula: 'C4H10', mw: 58.123, lhvMjKg: 45.66, kCpCv: 1.095, molePct: 0.2 },
        { id: 'c5plus', name: 'Pentana+ (C5+)', formula: 'C5H12+', mw: 72.150, lhvMjKg: 45.00, kCpCv: 1.080, molePct: 0.0 },
        { id: 'co2', name: 'Karbon Dioksida', formula: 'CO2', mw: 44.010, lhvMjKg: 0.00, kCpCv: 1.289, molePct: 0.8 },
        { id: 'n2', name: 'Nitrogen', formula: 'N2', mw: 28.013, lhvMjKg: 0.00, kCpCv: 1.404, molePct: 1.0 },
        { id: 'h2s', name: 'Hidrogen Sulfida', formula: 'H2S', mw: 34.082, lhvMjKg: 15.20, kCpCv: 1.320, molePct: 0.0 },
        { id: 'h2', name: 'Hidrogen', formula: 'H2', mw: 2.016, lhvMjKg: 120.00, kCpCv: 1.405, molePct: 0.0 },
        { id: 'co', name: 'Karbon Monoksida', formula: 'CO', mw: 28.010, lhvMjKg: 10.10, kCpCv: 1.400, molePct: 0.0 },
        { id: 'h2o', name: 'Uap Air', formula: 'H2O', mw: 18.015, lhvMjKg: 0.00, kCpCv: 1.330, molePct: 0.0 },
      ];
    } else if (blendType === 'refinery') {
      comps = [
        { id: 'ch4', name: 'Metana', formula: 'CH4', mw: 16.043, lhvMjKg: 50.01, kCpCv: 1.304, molePct: 45.0 },
        { id: 'c2h6', name: 'Etana', formula: 'C2H6', mw: 30.070, lhvMjKg: 47.79, kCpCv: 1.186, molePct: 20.0 },
        { id: 'c3h8', name: 'Propana', formula: 'C3H8', mw: 44.097, lhvMjKg: 46.36, kCpCv: 1.130, molePct: 12.0 },
        { id: 'c4h10', name: 'Butana (i/n)', formula: 'C4H10', mw: 58.123, lhvMjKg: 45.66, kCpCv: 1.095, molePct: 5.0 },
        { id: 'c5plus', name: 'Pentana+ (C5+)', formula: 'C5H12+', mw: 72.150, lhvMjKg: 45.00, kCpCv: 1.080, molePct: 2.0 },
        { id: 'co2', name: 'Karbon Dioksida', formula: 'CO2', mw: 44.010, lhvMjKg: 0.00, kCpCv: 1.289, molePct: 1.0 },
        { id: 'n2', name: 'Nitrogen', formula: 'N2', mw: 28.013, lhvMjKg: 0.00, kCpCv: 1.404, molePct: 3.0 },
        { id: 'h2s', name: 'Hidrogen Sulfida', formula: 'H2S', mw: 34.082, lhvMjKg: 15.20, kCpCv: 1.320, molePct: 2.0 },
        { id: 'h2', name: 'Hidrogen', formula: 'H2', mw: 2.016, lhvMjKg: 120.00, kCpCv: 1.405, molePct: 10.0 },
        { id: 'co', name: 'Karbon Monoksida', formula: 'CO', mw: 28.010, lhvMjKg: 10.10, kCpCv: 1.400, molePct: 0.0 },
        { id: 'h2o', name: 'Uap Air', formula: 'H2O', mw: 18.015, lhvMjKg: 0.00, kCpCv: 1.330, molePct: 0.0 },
      ];
    } else if (blendType === 'syngas') {
      comps = [
        { id: 'ch4', name: 'Metana', formula: 'CH4', mw: 16.043, lhvMjKg: 50.01, kCpCv: 1.304, molePct: 4.0 },
        { id: 'c2h6', name: 'Etana', formula: 'C2H6', mw: 30.070, lhvMjKg: 47.79, kCpCv: 1.186, molePct: 0.0 },
        { id: 'c3h8', name: 'Propana', formula: 'C3H8', mw: 44.097, lhvMjKg: 46.36, kCpCv: 1.130, molePct: 0.0 },
        { id: 'c4h10', name: 'Butana (i/n)', formula: 'C4H10', mw: 58.123, lhvMjKg: 45.66, kCpCv: 1.095, molePct: 0.0 },
        { id: 'c5plus', name: 'Pentana+ (C5+)', formula: 'C5H12+', mw: 72.150, lhvMjKg: 45.00, kCpCv: 1.080, molePct: 0.0 },
        { id: 'co2', name: 'Karbon Dioksida', formula: 'CO2', mw: 44.010, lhvMjKg: 0.00, kCpCv: 1.289, molePct: 12.0 },
        { id: 'n2', name: 'Nitrogen', formula: 'N2', mw: 28.013, lhvMjKg: 0.00, kCpCv: 1.404, molePct: 4.0 },
        { id: 'h2s', name: 'Hidrogen Sulfida', formula: 'H2S', mw: 34.082, lhvMjKg: 15.20, kCpCv: 1.320, molePct: 0.0 },
        { id: 'h2', name: 'Hidrogen', formula: 'H2', mw: 2.016, lhvMjKg: 120.00, kCpCv: 1.405, molePct: 52.0 },
        { id: 'co', name: 'Karbon Monoksida', formula: 'CO', mw: 28.010, lhvMjKg: 10.10, kCpCv: 1.400, molePct: 26.0 },
        { id: 'h2o', name: 'Uap Air', formula: 'H2O', mw: 18.015, lhvMjKg: 0.00, kCpCv: 1.330, molePct: 2.0 },
      ];
    } else {
      comps = [
        { id: 'ch4', name: 'Metana', formula: 'CH4', mw: 16.043, lhvMjKg: 50.01, kCpCv: 1.304, molePct: 60.0 },
        { id: 'c2h6', name: 'Etana', formula: 'C2H6', mw: 30.070, lhvMjKg: 47.79, kCpCv: 1.186, molePct: 0.0 },
        { id: 'c3h8', name: 'Propana', formula: 'C3H8', mw: 44.097, lhvMjKg: 46.36, kCpCv: 1.130, molePct: 0.0 },
        { id: 'c4h10', name: 'Butana (i/n)', formula: 'C4H10', mw: 58.123, lhvMjKg: 45.66, kCpCv: 1.095, molePct: 0.0 },
        { id: 'c5plus', name: 'Pentana+ (C5+)', formula: 'C5H12+', mw: 72.150, lhvMjKg: 45.00, kCpCv: 1.080, molePct: 0.0 },
        { id: 'co2', name: 'Karbon Dioksida', formula: 'CO2', mw: 44.010, lhvMjKg: 0.00, kCpCv: 1.289, molePct: 38.5 },
        { id: 'n2', name: 'Nitrogen', formula: 'N2', mw: 28.013, lhvMjKg: 0.00, kCpCv: 1.404, molePct: 0.8 },
        { id: 'h2s', name: 'Hidrogen Sulfida', formula: 'H2S', mw: 34.082, lhvMjKg: 15.20, kCpCv: 1.320, molePct: 0.5 },
        { id: 'h2', name: 'Hidrogen', formula: 'H2', mw: 2.016, lhvMjKg: 120.00, kCpCv: 1.405, molePct: 0.0 },
        { id: 'co', name: 'Karbon Monoksida', formula: 'CO', mw: 28.010, lhvMjKg: 10.10, kCpCv: 1.400, molePct: 0.0 },
        { id: 'h2o', name: 'Uap Air', formula: 'H2O', mw: 18.015, lhvMjKg: 0.00, kCpCv: 1.330, molePct: 0.2 },
      ];
    }
    setCustomComponents(comps);
    const mix = calculateMixtureProperties(comps);
    setFluid((p) => ({
      ...p,
      gasType: 'custom',
      gasName: 'Custom Multi-Component Stream',
      molecularWeight: mix.mw,
      lhv: mix.lhv,
      heatCapacityRatio: mix.k,
      compressibilityZ: mix.z,
      h2sContentPct: mix.h2sPct,
      customComponents: comps,
    }));
  };

  const handleApplyHysys = () => {
    try {
      const parsed = JSON.parse(hysysSnippet);
      setFluid((prev) => ({
        ...prev,
        gasName: parsed.streamName || 'Aspen HYSYS Stream',
        massFlowRate: parsed.massFlowRate_kg_h || prev.massFlowRate,
        temperature: parsed.temperature_C ?? prev.temperature,
        reliefPressure: parsed.pressure_barg ?? prev.reliefPressure,
        molecularWeight: parsed.molecularWeight || prev.molecularWeight,
        lhv: parsed.lhv_MJ_kg || prev.lhv,
        heatCapacityRatio: parsed.k_CpCv || prev.heatCapacityRatio,
      }));
      setShowHysysModal(false);
    } catch {
      alert('Format JSON data Aspen HYSYS tidak valid.');
    }
  };

  const totalMolePct = customComponents.reduce((sum, c) => sum + Math.max(0, c.molePct), 0);
  const is100Pct = Math.abs(totalMolePct - 100) < 0.1;

  // Current display value for the selected flow input mode
  const currentFlowDisplayVal =
    flowMode === 'vol_actual_m3h'
      ? Math.round(actualVolumetricM3h)
      : flowMode === 'vol_normal_nm3h'
      ? Math.round(normalVolumetricNm3h)
      : fluid.massFlowRate;

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h2 className="text-base font-bold text-slate-100">
                Tahap 1: Persiapan Data Input Termodinamika & Lingkungan
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              Pilih komposisi fluida atau rancang komposisi gas kustom sendiri (% mole). Anda dapat menginput laju alir dalam satuan massa (<strong className="text-slate-200">kg/h</strong>) maupun debit volumetrik (<strong className="text-amber-400">m³/h</strong> aktual atau <strong className="text-sky-400">Nm³/h</strong> normal).
            </p>
          </div>
          <button
            onClick={() => setShowHysysModal(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <FileCode2 className="w-4 h-4" />
            <span>Impor Aspen HYSYS / Simulator</span>
          </button>
        </div>

        {/* Design Basis vs Operational Data Guidance */}
        <div className="mt-4 bg-sky-950/30 border border-sky-800/60 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <div className="font-bold text-sky-300">
              Panduan Engineering: Data Desain (Governing Case) vs Data Operasional (contoh P = 25–40 mbar)
            </div>
            <p className="text-[11px] text-slate-300">
              Data yang dimasukkan ke simulasi flare & separator sebaiknya menggunakan <strong className="text-amber-300">Data Desain (Skenario Kasus Terburuk / Governing Case)</strong>, bukan sekadar rata-rata operasional harian:
            </p>
            <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-0.5">
              <li>
                <strong className="text-slate-200">Sizing Diameter Tip, Separator & Radiasi Puncak:</strong> Gunakan <strong>Flow Rate Maksimum (Peak)</strong> dan <strong>Tekanan Terendah (mis. 25 mbar / 0.025 barg)</strong> karena pada tekanan rendah densitas gas paling kecil sehingga volume aktual (m³/h) dan kecepatan gas (v_gas) mencapai nilai tertinggi.
              </li>
              <li>
                <strong className="text-slate-200">Sizing U-Loop Seal & Batas Tekanan Balik (Backpressure):</strong> Evaluasi pada <strong>Tekanan Tertinggi / Set PRV (mis. 40 mbar atau 255 mmWC)</strong> agar tinggi seal air aman dari <em>blow-through</em>.
              </li>
              <li>
                <strong className="text-slate-200">Cek Burnback / Turndown:</strong> Uji ulang dengan <strong>Flow Rate Minimum</strong> untuk memastikan Mach number tidak turun di bawah batas kestabilan nyala api.
              </li>
            </ul>

            {/* Interactive Operating Range -> Design Case Helper */}
            <div className="mt-2.5 pt-2.5 border-t border-sky-800/50 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-amber-300">
                  Asisten Konversi Rentang Operasi → Kasus Desain Otomatis:
                </span>
                {activeDesignCase && (
                  <span className="text-[10px] font-mono bg-emerald-950/80 border border-emerald-700/70 text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {activeDesignCase === 'peak_sizing'
                      ? `Case Peak Sizing aktif (${opPMinMbar} mbarg + Flow Puncak)`
                      : activeDesignCase === 'max_backpressure'
                      ? `Case Max Seal/Backpressure aktif (${opPMaxMbar} mbarg + Flow Puncak)`
                      : `Case Turndown aktif (${opPMaxMbar} mbarg + Flow Min)`}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block">P_min Operasi (mbar)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={opPMinMbar}
                    onChange={(e) => setOpPMinMbar(Math.max(1, parseFloat(e.target.value) || 25))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">P_max Operasi (mbar)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={opPMaxMbar}
                    onChange={(e) => setOpPMaxMbar(Math.max(1, parseFloat(e.target.value) || 40))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">
                    Flow Puncak ({flowMode === 'vol_actual_m3h' ? 'm³/h' : flowMode === 'vol_normal_nm3h' ? 'Nm³/h' : 'kg/h'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={opFlowMax}
                    onChange={(e) => setOpFlowMax(Math.max(1, parseFloat(e.target.value) || 100))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-amber-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">
                    Flow Min ({flowMode === 'vol_actual_m3h' ? 'm³/h' : flowMode === 'vol_normal_nm3h' ? 'Nm³/h' : 'kg/h'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={opFlowMin}
                    onChange={(e) => setOpFlowMin(Math.max(1, parseFloat(e.target.value) || 50))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-sky-300"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => applyGoverningDesignCase('peak_sizing')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                    activeDesignCase === 'peak_sizing'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/40'
                  }`}
                >
                  1. Terapkan Peak Sizing ({opPMinMbar} mbar + Flow Puncak)
                </button>
                <button
                  type="button"
                  onClick={() => applyGoverningDesignCase('max_backpressure')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                    activeDesignCase === 'max_backpressure'
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-900 hover:bg-slate-800 text-sky-300 border-sky-500/40'
                  }`}
                >
                  2. Terapkan Max Seal/Backpressure ({opPMaxMbar} mbar + Flow Puncak)
                </button>
                <button
                  type="button"
                  onClick={() => applyGoverningDesignCase('turndown')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                    activeDesignCase === 'turndown'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  3. Uji Turndown ({opPMaxMbar} mbar + Flow Min)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Fluid Properties & Environmental Conditions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sifat Fluida (8 cols) */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-200">
                1. Sifat Fluida Gas Buang (Relief Gas)
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">API 521 Section 5</span>
          </div>

          {/* Gas Preset Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Komposisi Gas / Fluida Rujukan
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(GAS_PRESETS) as GasType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleGasTypeChange(type)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left border transition-all ${
                    fluid.gasType === type
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700/60 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {type === 'custom' ? '⚙️ Custom Gas' : GAS_PRESETS[type].name.split(' (')[0]}
                </button>
              ))}
            </div>

            {fluid.gasType === 'biogas' && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs flex items-start gap-2.5 text-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 flex-shrink-0 animate-pulse" />
                <div className="space-y-0.5">
                  <span className="font-bold text-emerald-300">Karakteristik Skenario Biogas (Anaerobic Digester / POME / Landfill):</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Kandungan gas inert CO₂ (~40%) dan metana (~60%) menyebabkan nilai kalor bawah lebih rendah (LHV 21.5 MJ/kg) dibanding gas alam murni. Tekanan operasional suar biogas umumnya sangat rendah (50–300 mbarg), dengan nyala api yang lebih pendek dan radiasi panas lebih moderat.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CUSTOM GAS COMPOSITION BUILDER PANEL */}
          {fluid.gasType === 'custom' && (
            <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-100">
                    Editor Komposisi Campuran Gas Sendiri (% Mole)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${
                      is100Pct
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-700'
                    }`}
                  >
                    Total: {totalMolePct.toFixed(1)}%
                  </div>
                  {!is100Pct && (
                    <button
                      type="button"
                      onClick={handleNormalizeComponents}
                      className="text-[11px] font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded transition-colors"
                      title="Skalakan persentase secara proporsional hingga pas 100%"
                    >
                      Normalkan ke 100%
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Component Blend Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400 mr-1">Contoh Campuran:</span>
                <button
                  type="button"
                  onClick={() => handleLoadBlend('rich')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded"
                >
                  Gas Alam Kaya (Associated)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadBlend('lean')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded"
                >
                  Gas Kering (Lean C1)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadBlend('refinery')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded"
                >
                  Offgas Kilang
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadBlend('syngas')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded"
                >
                  Syngas (H₂/CO)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadBlend('biogas_blend')}
                  className="px-2 py-0.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded"
                >
                  Biogas (60/40)
                </button>
              </div>

              {/* Component Mole % Inputs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                {customComponents.map((c) => (
                  <div
                    key={c.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="font-semibold text-slate-200">{c.formula}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[65px]">
                        {c.name}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={c.molePct}
                        onChange={(e) =>
                          handleComponentChange(c.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500 pr-5"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-slate-500 font-mono">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Calculated Blend Properties Readout */}
              <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">MW Rata-Rata:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {fluid.molecularWeight} kg/kmol
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">LHV Campuran:</span>
                  <span className="font-mono font-bold text-orange-400">
                    {fluid.lhv} MJ/kg
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Rasio Panas k (Cp/Cv):</span>
                  <span className="font-mono font-bold text-sky-300">
                    {fluid.heatCapacityRatio}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Kandungan H₂S:</span>
                  <span className="font-mono font-bold text-rose-400">
                    {fluid.h2sContentPct.toFixed(2)} %
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* FLOW RATE INPUT SECTION WITH MASS / VOLUMETRIC SWITCHER */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <span>Input Laju Alir (Flow Rate):</span>
              </label>

              {/* Flow Unit Mode Selector */}
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-[11px] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setFlowMode('mass_kgh')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    flowMode === 'mass_kgh'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  kg/h (Massa)
                </button>
                <button
                  type="button"
                  onClick={() => setFlowMode('vol_actual_m3h')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    flowMode === 'vol_actual_m3h'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Debit volumetrik aktual pada kondisi operasi temperatur & tekanan relief"
                >
                  m³/h (Aktual @ P, T)
                </button>
                <button
                  type="button"
                  onClick={() => setFlowMode('vol_normal_nm3h')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    flowMode === 'vol_normal_nm3h'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Debit volumetrik normal pada kondisi standar 0°C, 1.01325 bara"
                >
                  Nm³/h (Normal @ 0°C)
                </button>
              </div>
            </div>

            {/* Input Box and Dual Unit Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="5000000"
                    step="50"
                    value={currentFlowDisplayVal}
                    onChange={(e) => handleFlowValueChange(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-amber-300 font-bold focus:outline-none focus:border-amber-500 pr-20"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono font-semibold">
                    {flowMode === 'vol_actual_m3h'
                      ? 'm³/h'
                      : flowMode === 'vol_normal_nm3h'
                      ? 'Nm³/h'
                      : 'kg/h'}
                  </span>
                </div>
              </div>

              {/* Live Converted Equivalents Readout */}
              <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800 text-[11px] space-y-1 font-mono">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Laju Alir Masal:</span>
                  <span className="font-bold text-amber-400">
                    {fluid.massFlowRate.toLocaleString()} kg/h ({(fluid.massFlowRate / 1000).toFixed(1)} t/h)
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Volumetrik Aktual (@P,T):</span>
                  <span className="text-sky-300 font-semibold">
                    {Math.round(actualVolumetricM3h).toLocaleString()} m³/h
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Volumetrik Normal (Nm³):</span>
                  <span className="text-emerald-300 font-semibold">
                    {Math.round(normalVolumetricNm3h).toLocaleString()} Nm³/h
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Relief Pressure */}
            <div>
              <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span>Tekanan Relief / Desain (Gauge)</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {fluid.reliefPressure} {unitSystem === 'SI' ? 'barg' : 'psig'} ({(fluid.reliefPressure * 1000).toFixed(0)} mbarg)
                </span>
              </label>
              <input
                type="number"
                min="0.001"
                max="50"
                step="0.005"
                value={fluid.reliefPressure}
                onChange={(e) =>
                  setFluid((p) => ({ ...p, reliefPressure: parseFloat(e.target.value) || 0 }))
                }
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                P-abs: {(fluid.reliefPressure + 1.01325).toFixed(3)} bara · {(fluid.reliefPressure * 1000).toFixed(1)} mbarg
              </span>
            </div>

            {/* Temperature */}
            <div>
              <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span>Temperatur Fluida</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {fluid.temperature} °C
                </span>
              </label>
              <input
                type="number"
                min="-160"
                max="400"
                step="1"
                value={fluid.temperature}
                onChange={(e) =>
                  setFluid((p) => ({ ...p, temperature: parseFloat(e.target.value) || 0 }))
                }
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                {(fluid.temperature + 273.15).toFixed(1)} K
              </span>
            </div>

            {/* Molecular Weight */}
            <div>
              <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span>Berat Molekul (MW)</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {fluid.molecularWeight} kg/kmol
                </span>
              </label>
              <input
                type="number"
                min="2"
                max="120"
                step="0.1"
                value={fluid.molecularWeight}
                onChange={(e) =>
                  setFluid((p) => ({ ...p, molecularWeight: parseFloat(e.target.value) || 0 }))
                }
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Air MW ref = 28.96
              </span>
            </div>

            {/* LHV */}
            <div>
              <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span>Nilai Kalor Bawah (LHV)</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {fluid.lhv} MJ/kg
                </span>
              </label>
              <input
                type="number"
                min="10"
                max="120"
                step="0.5"
                value={fluid.lhv}
                onChange={(e) =>
                  setFluid((p) => ({ ...p, lhv: parseFloat(e.target.value) || 0 }))
                }
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                {(fluid.lhv * 429.9).toFixed(0)} BTU/lb
              </span>
            </div>

            {/* Heat Capacity Ratio k = Cp/Cv */}
            <div>
              <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <span>Rasio Kapasitas Panas (k = Cp/Cv)</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {fluid.heatCapacityRatio}
                </span>
              </label>
              <input
                type="number"
                min="1.05"
                max="1.67"
                step="0.01"
                value={fluid.heatCapacityRatio}
                onChange={(e) =>
                  setFluid((p) => ({
                    ...p,
                    heatCapacityRatio: parseFloat(e.target.value) || 1.3,
                  }))
                }
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Faktor isentropik ekspansi gas
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Kondisi Lingkungan (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-slate-200">
                2. Kondisi Lingkungan Sekitar
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Meteorologi</span>
          </div>

          {/* Ambient Temp & Humidity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1">
                <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                <span>Suhu Ambien</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="-20"
                  max="60"
                  value={env.ambientTemp}
                  onChange={(e) =>
                    setEnv((p) => ({ ...p, ambientTemp: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 pr-8 focus:outline-none focus:border-sky-500"
                />
                <span className="absolute right-2.5 top-2 text-xs text-slate-400">°C</span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1">
                <Droplets className="w-3.5 h-3.5 text-sky-400" />
                <span>Kelembaban (RH)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={env.relativeHumidity}
                  onChange={(e) =>
                    setEnv((p) => ({ ...p, relativeHumidity: parseFloat(e.target.value) || 50 }))
                  }
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 pr-8 focus:outline-none focus:border-sky-500"
                />
                <span className="absolute right-2.5 top-2 text-xs text-slate-400">%</span>
              </div>
            </div>
          </div>

          {/* Wind Speed */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-sky-400" />
                <span>Kecepatan Angin Desain</span>
              </span>
              <span className="font-mono text-sky-400 font-semibold">
                {env.windSpeed} m/s ({(env.windSpeed * 3.6).toFixed(1)} km/h)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              step="0.5"
              value={env.windSpeed}
              onChange={(e) =>
                setEnv((p) => ({ ...p, windSpeed: parseFloat(e.target.value) || 0 }))
              }
              className="w-full accent-sky-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Tenang (0 m/s)</span>
              <span>Sedang (8 m/s)</span>
              <span>Badai (25 m/s)</span>
            </div>
          </div>

          {/* Wind Direction & Compass Rose */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>Arah Angin (Dari)</span>
              </span>
              <span className="font-mono text-sky-400 font-semibold">
                {env.windDirection}° (
                {env.windDirection >= 337.5 || env.windDirection < 22.5
                  ? 'Utara'
                  : env.windDirection < 67.5
                  ? 'Timur Laut'
                  : env.windDirection < 112.5
                  ? 'Timur'
                  : env.windDirection < 157.5
                  ? 'Tenggara'
                  : env.windDirection < 202.5
                  ? 'Selatan'
                  : env.windDirection < 247.5
                  ? 'Barat Daya'
                  : env.windDirection < 292.5
                  ? 'Barat'
                  : 'Barat Laut'}
                )
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="355"
              step="5"
              value={env.windDirection}
              onChange={(e) =>
                setEnv((p) => ({ ...p, windDirection: parseInt(e.target.value) || 0 }))
              }
              className="w-full accent-sky-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>U (0°)</span>
              <span>T (90°)</span>
              <span>S (180°)</span>
              <span>B (270°)</span>
              <span>U (360°)</span>
            </div>
          </div>

          {/* Solar Radiation */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Radiasi Matahari (Solar Constant)</span>
              </span>
              <span className="font-mono text-amber-400 font-semibold">
                {env.solarRadiation} kW/m²
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1.2"
              step="0.05"
              value={env.solarRadiation}
              onChange={(e) =>
                setEnv((p) => ({ ...p, solarRadiation: parseFloat(e.target.value) || 0 }))
              }
              className="w-full accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              API 521 menganjurkan 1.0 kW/m² untuk kondisi siang hari terik
            </span>
          </div>
        </div>
      </div>

      {/* Thermodynamic Live Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">Massa Jenis Fluida (ρ)</span>
          <div className="text-lg font-mono font-bold text-slate-100">
            {density.toFixed(3)}{' '}
            <span className="text-xs font-normal text-slate-400">kg/m³</span>
          </div>
          <span className="text-[11px] text-slate-500">Persamaan Gas Riil (Z={fluid.compressibilityZ})</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">Kecepatan Suara Gas (c)</span>
          <div className="text-lg font-mono font-bold text-sky-400">
            {sonicVel.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">m/s</span>
          </div>
          <span className="text-[11px] text-slate-500">Batas sonik Mach 1.0</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">Laju Pelepasan Panas Total (Q)</span>
          <div className="text-lg font-mono font-bold text-amber-400">
            {totalHeatMw.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">MW</span>
          </div>
          <span className="text-[11px] text-slate-500">{(totalHeatMw * 3.412e6).toFixed(0)} BTU/h</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">Debit Volumetrik Relief</span>
          <div className="text-lg font-mono font-bold text-emerald-400">
            {((fluid.massFlowRate / 3600) / density).toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">m³/s</span>
          </div>
          <span className="text-[11px] text-slate-500">{(((fluid.massFlowRate / 3600) / density) * 3600).toFixed(0)} m³/h</span>
        </div>
      </div>

      {/* Next Step Action */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition-all"
        >
          <span>Lanjut ke Tahap 2: Sizing Flare Tip</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Modal: Aspen HYSYS Import */}
      {showHysysModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-2 flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-amber-400" />
              Impor Stream Aspen HYSYS / PRO/II / Unisim
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Tempelkan (paste) parameter stream blowdown dari simulator proses dalam format data JSON:
            </p>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-slate-400">Pilih Contoh Template:</span>
              <button
                type="button"
                onClick={() =>
                  setHysysSnippet(
                    JSON.stringify(
                      {
                        streamName: 'HP_DEPRESSURING_BLOWDOWN',
                        massFlowRate_kg_h: 135000,
                        temperature_C: 48.5,
                        pressure_barg: 4.8,
                        molecularWeight: 19.1,
                        lhv_MJ_kg: 47.8,
                        k_CpCv: 1.27,
                      },
                      null,
                      2
                    )
                  )
                }
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Gas Alam Blowdown
              </button>
              <button
                type="button"
                onClick={() =>
                  setHysysSnippet(
                    JSON.stringify(
                      {
                        streamName: 'BIOGAS_POME_DIGESTER_SURPLUS',
                        massFlowRate_kg_h: 3600,
                        temperature_C: 38.0,
                        pressure_barg: 0.15,
                        molecularWeight: 27.2,
                        lhv_MJ_kg: 21.5,
                        k_CpCv: 1.28,
                      },
                      null,
                      2
                    )
                  )
                }
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700"
              >
                Biogas (POME Digester)
              </button>
            </div>

            <textarea
              value={hysysSnippet}
              onChange={(e) => setHysysSnippet(e.target.value)}
              rows={9}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-amber-500 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowHysysModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800"
              >
                Batal
              </button>
              <button
                onClick={handleApplyHysys}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400"
              >
                Terapkan Data Stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
