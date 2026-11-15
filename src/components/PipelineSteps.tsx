import React from 'react';
import {
  FileText,
  Flame,
  MapPin,
  PlayCircle,
  ShieldCheck,
  TrendingDown,
  Printer,
  ChevronRight,
  Filter,
} from 'lucide-react';

export interface StepItem {
  id: number;
  title: string;
  shortTitle: string;
  desc: string;
  icon: React.ElementType;
}

export const PIPELINE_STEPS: StepItem[] = [
  {
    id: 1,
    title: '1. Persiapan Data Input',
    shortTitle: 'Data Input',
    desc: 'Termodinamika fluida (Aspen HYSYS) & cuaca',
    icon: FileText,
  },
  {
    id: 2,
    title: '2. Pemilihan & Sizing Tip',
    shortTitle: 'Sizing Flare Tip',
    desc: 'Jenis ujung pembakar, Mach number & kestabilan',
    icon: Flame,
  },
  {
    id: 3,
    title: '3. Lokasi & Reseptor',
    shortTitle: 'Lokasi & Reseptor',
    desc: 'Koordinat tiang suar & titik evaluasi (helipad, walkway)',
    icon: MapPin,
  },
  {
    id: 4,
    title: '4. Eksekusi Simulasi',
    shortTitle: 'Eksekusi Simulasi',
    desc: 'Bentuk nyala 3D, radiasi termal, kebisingan & dispersi',
    icon: PlayCircle,
  },
  {
    id: 5,
    title: '5. Evaluasi Standar',
    shortTitle: 'Evaluasi Standar',
    desc: 'Pemeriksaan kepatuhan ambang batas API 521',
    icon: ShieldCheck,
  },
  {
    id: 6,
    title: '6. Iterasi & Optimasi',
    shortTitle: 'Iterasi & Optimasi',
    desc: 'Optimasi ketinggian tiang suar vs batas aman API 521',
    icon: TrendingDown,
  },
  {
    id: 7,
    title: '7. Finalisasi & Pelaporan',
    shortTitle: 'Finalisasi & Laporan',
    desc: 'Isopleth radiasi & formal HSE engineering datasheet',
    icon: Printer,
  },
  {
    id: 8,
    title: '8. Sizing Gas Water Separator',
    shortTitle: 'Separator Sizing',
    desc: 'KO Drum, Demister, Baffle & Gambar 2D GA',
    icon: Filter,
  },
];

interface PipelineStepsProps {
  activeStep: number;
  onSelectStep: (step: number) => void;
  isCompliant: boolean;
}

export const PipelineSteps: React.FC<PipelineStepsProps> = ({
  activeStep,
  onSelectStep,
  isCompliant,
}) => {
  return (
    <nav className="no-print bg-slate-900/60 border-b border-slate-800/80 px-3 lg:px-6 py-2 overflow-x-auto">
      <div className="flex items-center min-w-max gap-1">
        {PIPELINE_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;
          const isPassed = activeStep > step.id;

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => onSelectStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm'
                    : isPassed
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded flex items-center justify-center font-mono text-xs font-semibold ${
                    isActive
                      ? 'bg-amber-500 text-slate-950'
                      : isPassed
                      ? 'bg-slate-700 text-slate-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {step.id}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold leading-tight flex items-center gap-1.5">
                    {step.shortTitle}
                    {step.id === 5 && !isCompliant && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden xl:inline">
                    {step.desc}
                  </span>
                </div>
              </button>

              {idx < PIPELINE_STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-700 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
