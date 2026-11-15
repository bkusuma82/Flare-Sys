import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  ProjectMetadata,
  ProjectStatus,
  SavedFlareProject,
  SavedProjectSummary,
} from '../types/flaresim';
import {
  X,
  Save,
  FolderOpen,
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Upload,
  Download,
  Lock,
  FileCheck2,
  LogIn,
  LogOut,
  Clock,
  Flame,
  Filter,
} from 'lucide-react';

interface ProjectManagerModalProps {
  isOpen: boolean;
  initialTab: 'save' | 'open';
  defaultSaveStatus?: ProjectStatus;
  onClose: () => void;
  user: User | null;
  authLoading: boolean;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  meta: ProjectMetadata;
  setMeta: React.Dispatch<React.SetStateAction<ProjectMetadata>>;
  summary: SavedProjectSummary;
  activeProjectId: string | null;
  activeProjectStatus: ProjectStatus | null;
  activeStorageSource: 'cloud' | 'local' | null;
  cloudProjects: SavedFlareProject[];
  localProjects: SavedFlareProject[];
  onSaveProject: (
    target: 'cloud' | 'local',
    status: ProjectStatus,
    saveAsNew: boolean
  ) => Promise<void>;
  onLoadProject: (project: SavedFlareProject) => void;
  onDeleteProject: (project: SavedFlareProject) => Promise<void>;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => Promise<void>;
  storageError: string | null;
}

function formatDateId(iso?: string): string {
  if (!iso) return 'Baru saja';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  initialTab,
  defaultSaveStatus = 'completed',
  onClose,
  user,
  authLoading,
  onSignInGoogle,
  onSignOut,
  meta,
  setMeta,
  summary,
  activeProjectId,
  activeProjectStatus,
  activeStorageSource,
  cloudProjects,
  localProjects,
  onSaveProject,
  onLoadProject,
  onDeleteProject,
  onExportJson,
  onImportJsonFile,
  storageError,
}) => {
  const [tab, setTab] = useState<'save' | 'open'>(initialTab);
  const [saveStatus, setSaveStatus] = useState<ProjectStatus>(defaultSaveStatus);
  const [saveTarget, setSaveTarget] = useState<'cloud' | 'local'>(user ? 'cloud' : 'local');
  const [saveAsNew, setSaveAsNew] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setSaveStatus(defaultSaveStatus);
      setSaveTarget(user ? 'cloud' : 'local');
      setSaveAsNew(activeProjectStatus === 'completed');
      setFeedback(null);
      setConfirmDeleteId(null);
    }
  }, [isOpen, initialTab, defaultSaveStatus, user, activeProjectStatus]);

  if (!isOpen) return null;

  const isLockedRevision = Boolean(activeProjectId && activeProjectStatus === 'completed');

  const handlePerformSave = async () => {
    if (!meta.projectName.trim()) {
      setFeedback({ type: 'err', msg: 'Nama proyek wajib diisi sebelum menyimpan.' });
      return;
    }
    if (saveTarget === 'cloud' && !user) {
      setFeedback({
        type: 'err',
        msg: 'Silakan masuk dengan akun Google terlebih dahulu untuk menyimpan ke Cloud, atau pilih Simpan Lokal di Browser.',
      });
      return;
    }

    setIsBusy(true);
    setFeedback(null);
    try {
      await onSaveProject(saveTarget, saveStatus, saveAsNew || isLockedRevision);
      setFeedback({
        type: 'ok',
        msg:
          saveTarget === 'cloud'
            ? `Proyek "${meta.projectName}" berhasil disimpan ke Cloud Database (${saveStatus === 'completed' ? 'Final / Selesai' : 'Draft'}).`
            : `Proyek "${meta.projectName}" berhasil disimpan di browser lokal (${saveStatus === 'completed' ? 'Final / Selesai' : 'Draft'}).`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Gagal menyimpan proyek.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsBusy(true);
    setFeedback(null);
    try {
      await onImportJsonFile(file);
      setFeedback({ type: 'ok', msg: `File "${file.name}" berhasil dimuat ke workspace.` });
      onClose();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Gagal membaca file JSON.',
      });
    } finally {
      setIsBusy(false);
      e.target.value = '';
    }
  };

  const renderProjectCard = (proj: SavedFlareProject) => {
    const isActive = activeProjectId === proj.id;
    const isConfirming = confirmDeleteId === proj.id;

    return (
      <div
        key={`${proj.storageSource}_${proj.id}`}
        className={`rounded-xl border p-3.5 transition-all ${
          isActive
            ? 'bg-amber-500/10 border-amber-500/60'
            : 'bg-slate-800/50 border-slate-700/70 hover:border-slate-600'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-100 truncate">
                {proj.projectName}
              </span>
              {proj.status === 'completed' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 border border-emerald-700/70 text-emerald-300">
                  <Lock className="w-2.5 h-2.5" />
                  SELESAI (FINAL)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/70 border border-amber-700/70 text-amber-300">
                  DRAFT
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  proj.storageSource === 'cloud'
                    ? 'bg-sky-950/70 border-sky-700/60 text-sky-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                {proj.storageSource === 'cloud' ? (
                  <>
                    <Cloud className="w-2.5 h-2.5" /> Cloud
                  </>
                ) : (
                  <>
                    <HardDrive className="w-2.5 h-2.5" /> Lokal
                  </>
                )}
              </span>
              {isActive && (
                <span className="text-[10px] font-mono font-bold text-amber-400">
                  ● Aktif
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-slate-300">{proj.docNumber || '-'}</span>
              <span>{proj.facilityLocation || '-'}</span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Clock className="w-3 h-3" />
                {formatDateId(proj.updatedAtIso)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-slate-300 inline-flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" />
                {proj.summary?.gasName} · {proj.summary?.heatReleaseMw?.toFixed(1)} MW
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-amber-300">
                Stack {proj.summary?.stackHeightM} m
              </span>
              <span
                className={`px-2 py-0.5 rounded border ${
                  proj.summary?.isAllCompliant
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-800 text-rose-300'
                }`}
              >
                {proj.summary?.isAllCompliant ? 'API 521: PASS' : 'API 521: VIOLATION'}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-sky-300 inline-flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Sep. {proj.summary?.separatorOrientation === 'horizontal' ? 'Horiz.' : 'Vert.'} Ø
                {proj.summary?.separatorDiaMm} mm
              </span>
            </div>

            {proj.notes && (
              <p className="text-[11px] text-slate-400 italic pt-0.5 line-clamp-2">
                "{proj.notes}"
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                onLoadProject(proj);
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Buka</span>
            </button>

            {isConfirming ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={async () => {
                    setIsBusy(true);
                    try {
                      await onDeleteProject(proj);
                      setConfirmDeleteId(null);
                    } finally {
                      setIsBusy(false);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer"
                >
                  Yakin Hapus
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] cursor-pointer"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(proj.id)}
                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                title="Hapus proyek tersimpan"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              {tab === 'save' ? <Save className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Manajer Penyimpanan Proyek Flaresim
              </h3>
              <p className="text-[11px] text-slate-400">
                Simpan hasil perhitungan selesai &amp; buka kembali kapan saja setelah keluar dari halaman
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Account & Tab Switcher Bar */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex bg-slate-800/90 border border-slate-700 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setTab('save');
                setFeedback(null);
              }}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'save'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Proyek</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('open');
                setFeedback(null);
              }}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'open'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Buka Proyek ({cloudProjects.length + localProjects.length})</span>
            </button>
          </div>

          {/* Auth Status */}
          <div className="flex items-center gap-2 text-xs">
            {user ? (
              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/60 rounded-lg px-2.5 py-1">
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-200 font-medium truncate max-w-[170px]">
                  {user.email || user.displayName}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="text-[10px] text-slate-400 hover:text-rose-300 flex items-center gap-0.5 ml-1 cursor-pointer"
                  title="Keluar dari akun Google"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={authLoading}
                onClick={onSignInGoogle}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{authLoading ? 'Menghubungkan...' : 'Masuk Google (Cloud Sync)'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {(feedback || storageError) && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                feedback?.type === 'ok'
                  ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-700/70 text-rose-200'
              }`}
            >
              {feedback?.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <span>{feedback?.msg || storageError}</span>
            </div>
          )}

          {tab === 'save' ? (
            <div className="space-y-4">
              {/* Project Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Nama Proyek / Judul Desain *
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={meta.projectName}
                    onChange={(e) => setMeta((p) => ({ ...p, projectName: e.target.value }))}
                    placeholder="cth: Desain Flare & Separator Biogas Digester POME Unit 2"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nomor Dokumen</label>
                  <input
                    type="text"
                    maxLength={60}
                    value={meta.docNumber}
                    onChange={(e) => setMeta((p) => ({ ...p, docNumber: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Lokasi / Fasilitas</label>
                  <input
                    type="text"
                    maxLength={140}
                    value={meta.facilityLocation}
                    onChange={(e) => setMeta((p) => ({ ...p, facilityLocation: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Process Lead Engineer</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={meta.leadEngineer}
                    onChange={(e) => setMeta((p) => ({ ...p, leadEngineer: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Catatan Revisi (Opsional)</label>
                  <input
                    type="text"
                    maxLength={500}
                    value={meta.notes}
                    onChange={(e) => setMeta((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="cth: Revisi final setelah optimasi stack 25m & separator horizontal"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Project Status & Destination Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-3 space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Status Penyelesaian Proyek
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSaveStatus('completed')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        saveStatus === 'completed'
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1">
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>Selesai (Final)</span>
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        Arsip resmi proyek tuntas
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaveStatus('draft')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        saveStatus === 'draft'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1">
                        <Save className="w-3.5 h-3.5" />
                        <span>Draft</span>
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        Masih bisa diedit &amp; timpa
                      </div>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-3 space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Tujuan Penyimpanan
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSaveTarget('cloud')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        saveTarget === 'cloud'
                          ? 'bg-sky-500/15 border-sky-500 text-sky-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1">
                        <Cloud className="w-3.5 h-3.5" />
                        <span>Cloud Akun</span>
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        {user ? 'Sinkron lintas perangkat' : 'Perlu login Google'}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaveTarget('local')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        saveTarget === 'local'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Lokal Browser</span>
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        Instan tanpa login
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {activeProjectId && activeStorageSource === saveTarget && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-300">
                    {isLockedRevision
                      ? 'Proyek aktif berstatus Selesai (Final). Perubahan akan disimpan sebagai dokumen revisi baru.'
                      : 'Proyek Draft aktif terdeteksi. Timpa proyek ini atau simpan sebagai salinan baru?'}
                  </span>
                  {!isLockedRevision && (
                    <label className="flex items-center gap-1.5 text-[11px] text-amber-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveAsNew}
                        onChange={(e) => setSaveAsNew(e.target.checked)}
                        className="accent-amber-500"
                      />
                      <span>Simpan Sebagai Proyek Baru</span>
                    </label>
                  )}
                </div>
              )}

              {/* Summary Strip */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[11px] font-mono flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300">
                <span>Gas: <strong className="text-slate-100">{summary.gasName}</strong></span>
                <span>Panas: <strong className="text-amber-400">{summary.heatReleaseMw.toFixed(2)} MW</strong></span>
                <span>Stack: <strong className="text-slate-100">{summary.stackHeightM} m</strong></span>
                <span>Radiasi Maks: <strong className="text-slate-100">{summary.maxRadiationKw.toFixed(2)} kW/m²</strong></span>
                <span>Separator: <strong className="text-sky-300">{summary.separatorOrientation} Ø{summary.separatorDiaMm} mm</strong></span>
              </div>

              {/* Action Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={onExportJson}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Unduh File Cadangan (.json)</span>
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handlePerformSave}
                  className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isBusy
                      ? 'Menyimpan...'
                      : saveStatus === 'completed'
                      ? 'Simpan Proyek Selesai'
                      : 'Simpan Sebagai Draft'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Import JSON File Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-800/40 border border-slate-700/70 rounded-xl p-3">
                <div className="text-xs text-slate-300">
                  Punya file cadangan <span className="font-mono text-amber-400">.json</span> dari perangkat lain?
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Impor File .json</span>
                  </button>
                </div>
              </div>

              {/* Cloud Projects Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Proyek Cloud (Firestore) — {cloudProjects.length}</span>
                  </h4>
                </div>

                {!user ? (
                  <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-4 text-center space-y-2">
                    <p className="text-xs text-slate-300">
                      Masuk dengan akun Google untuk melihat dan membuka proyek yang tersimpan di Cloud dari perangkat mana saja.
                    </p>
                    <button
                      type="button"
                      onClick={onSignInGoogle}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Masuk dengan Google</span>
                    </button>
                  </div>
                ) : cloudProjects.length === 0 ? (
                  <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500">
                    Belum ada proyek yang disimpan di Cloud untuk akun ini.
                  </div>
                ) : (
                  <div className="space-y-2.5">{cloudProjects.map(renderProjectCard)}</div>
                )}
              </div>

              {/* Local Browser Projects Section */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Proyek Lokal (Browser Ini) — {localProjects.length}</span>
                </h4>
                {localProjects.length === 0 ? (
                  <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500">
                    Belum ada proyek tersimpan secara lokal di browser ini.
                  </div>
                ) : (
                  <div className="space-y-2.5">{localProjects.map(renderProjectCard)}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
