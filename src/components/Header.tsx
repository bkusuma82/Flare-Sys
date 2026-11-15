import React from 'react';
import {
  Flame,
  Download,
  Printer,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Save,
  FolderOpen,
  Cloud,
} from 'lucide-react';
import { INDUSTRIAL_PRESETS } from '../utils/presets';
import { FlareProjectPreset, ProjectStatus } from '../types/flaresim';

interface HeaderProps {
  currentPresetId: string;
  onSelectPreset: (preset: FlareProjectPreset) => void;
  onResetToDefault: () => void;
  onRunAutoOptimize: () => void;
  onExportJson: () => void;
  onTriggerPrint: () => void;
  isCompliant: boolean;
  unitSystem: 'SI' | 'Field';
  setUnitSystem: (val: 'SI' | 'Field') => void;
  activeStep: number;
  setActiveStep: (step: number) => void;
  savedProjectsCount: number;
  activeProjectName: string;
  activeProjectStatus: ProjectStatus | null;
  lastAutosaveIso: string | null;
  userEmail: string | null;
  onOpenSaveModal: () => void;
  onOpenLoadModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPresetId,
  onSelectPreset,
  onResetToDefault,
  onRunAutoOptimize,
  onExportJson,
  onTriggerPrint,
  isCompliant,
  unitSystem,
  setUnitSystem,
  setActiveStep,
  savedProjectsCount,
  activeProjectName,
  activeProjectStatus,
  lastAutosaveIso,
  userEmail,
  onOpenSaveModal,
  onOpenLoadModal,
}) => {
  return (
    <header className="no-print bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40 px-4 lg:px-6 py-3">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white flex-shrink-0">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                FLARESIM
              </h1>
              <span className="text-xs font-mono font-medium text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded">
                API 521 / ISO 23251
              </span>
              {activeProjectStatus === 'completed' && (
                <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-700/70 px-1.5 py-0.5 rounded">
                  FINAL
                </span>
              )}
              {userEmail && (
                <span
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-sky-300 bg-sky-950/50 border border-sky-800/70 px-1.5 py-0.5 rounded"
                  title={`Tersambung Cloud: ${userEmail}`}
                >
                  <Cloud className="w-2.5 h-2.5" />
                  Cloud Aktif
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate max-w-md">
              {activeProjectName}
              {lastAutosaveIso ? ' · Auto-saved' : ''}
            </p>
          </div>
        </div>

        {/* Action Controls & Presets */}
        <div className="flex flex-wrap items-center gap-2 lg:gap-2.5">
          {/* Save & Open Project Controls */}
          <button
            type="button"
            onClick={onOpenSaveModal}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
            title="Simpan proyek ke Cloud atau Browser Lokal agar bisa dibuka lagi nanti"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Proyek</span>
          </button>

          <button
            type="button"
            onClick={onOpenLoadModal}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-medium text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            title="Buka kembali proyek tersimpan atau impor file .json"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Buka</span>
            {savedProjectsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                {savedProjectsCount}
              </span>
            )}
          </button>

          {/* Preset Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-slate-400 hidden xl:inline">Skenario:</span>
            <select
              value={currentPresetId}
              onChange={(e) => {
                const found = INDUSTRIAL_PRESETS.find((p) => p.id === e.target.value);
                if (found) onSelectPreset(found);
              }}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer text-xs max-w-[165px]"
            >
              {INDUSTRIAL_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Toggle */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setUnitSystem('SI')}
              className={`px-2 py-1 rounded font-mono font-medium transition-colors ${
                unitSystem === 'SI'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="International System (kW/m², m, °C, kg/h)"
            >
              SI
            </button>
            <button
              onClick={() => setUnitSystem('Field')}
              className={`px-2 py-1 rounded font-mono font-medium transition-colors ${
                unitSystem === 'Field'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="US Field Units (BTU/h·ft², ft, °F, lb/h)"
            >
              Field
            </button>
          </div>

          {/* Compliance Status Indicator */}
          <div
            onClick={() => setActiveStep(5)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
              isCompliant
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
                : 'bg-rose-950/60 text-rose-300 border-rose-700/60 hover:bg-rose-900/60'
            }`}
            title="Klik untuk melihat evaluasi kepatuhan API 521"
          >
            {isCompliant ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="hidden md:inline">API 521: Safe</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                <span className="hidden md:inline">Batas Terlampaui</span>
              </>
            )}
          </div>

          {/* Auto-Optimizer Button */}
          <button
            onClick={onRunAutoOptimize}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium text-xs px-2.5 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
            title="Temukan tinggi tiang suar minimum yang memenuhi batas keselamatan API 521"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Auto-Optimasi</span>
          </button>

          {/* Print / Datasheet Action */}
          <button
            onClick={onTriggerPrint}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            title="Cetak atau unduh formal engineering datasheet (PDF/Print)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Cetak</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={onExportJson}
            className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Ekspor File Proyek (.json)"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Reset */}
          <button
            onClick={onResetToDefault}
            className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Reset ke Nilai Standar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
