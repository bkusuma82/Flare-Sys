import React, { useState, useMemo, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import {
  FluidProperties,
  EnvironmentConditions,
  FlareTipConfig,
  FlareStackConfig,
  Receptor,
  FlareProjectPreset,
  SeparatorConfig,
  ProjectMetadata,
  ProjectStatus,
  SavedFlareProject,
  SavedProjectSummary,
} from './types/flaresim';
import { INDUSTRIAL_PRESETS } from './utils/presets';
import {
  runSimulation,
  autoOptimizeStackHeight,
  calculateGasDensity,
  convertMassToVolumetricFlow,
  DEFAULT_ORIGIN_LAT,
  DEFAULT_ORIGIN_LNG,
  DEFAULT_SEPARATOR_CONFIG,
} from './utils/flareCalculations';
import {
  saveAutosaveDraft,
  loadAutosaveDraft,
  clearAutosaveDraft,
  listLocalProjects,
  saveLocalProject,
  deleteLocalProject,
  subscribeCloudProjects,
  saveCloudProject,
  deleteCloudProject,
  parseImportedProjectJson,
  ActiveProjectState,
} from './utils/projectStorage';
import { Header } from './components/Header';
import { PipelineSteps } from './components/PipelineSteps';
import { Step1InputData } from './components/Step1InputData';
import { Step2TipSizing } from './components/Step2TipSizing';
import { Step3ReceptorLayout } from './components/Step3ReceptorLayout';
import { Step4Simulation3D } from './components/Step4Simulation3D';
import { Step5SafetyCompliance } from './components/Step5SafetyCompliance';
import { Step6Optimization } from './components/Step6Optimization';
import { Step7ReportDatasheet } from './components/Step7ReportDatasheet';
import { Step8SeparatorSizing } from './components/Step8SeparatorSizing';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { Flame, ShieldCheck, AlertTriangle } from 'lucide-react';

function getDefaultMetaForGas(gasType: FluidProperties['gasType'], presetName?: string): ProjectMetadata {
  if (gasType === 'biogas') {
    return {
      projectName: presetName || 'Biogas Recovery & Safe Flaring Facility (POME / Digester)',
      docNumber: 'FLS-CALC-BIO-001',
      facilityLocation: 'Riau Bioenergy & Palm Oil Mill Complex',
      leadEngineer: 'Ir. B. Kusuma, IPM (Process Lead)',
      hseAuditor: 'HSE & Process Safety Directorate',
      notes: '',
    };
  }
  if (gasType === 'ethylene') {
    return {
      projectName: presetName || 'Cilegon Petrochemical Olefins Complex',
      docNumber: 'FLS-CALC-PETRO-003',
      facilityLocation: 'Banten Industrial Estate',
      leadEngineer: 'Ir. B. Kusuma, IPM (Process Lead)',
      hseAuditor: 'HSE & Process Safety Directorate',
      notes: '',
    };
  }
  return {
    projectName: presetName || 'Onshore Central Gas Processing Plant',
    docNumber: 'FLS-CALC-API521-004',
    facilityLocation: 'South Sumatra Basin Block A',
    leadEngineer: 'Ir. B. Kusuma, IPM (Process Lead)',
    hseAuditor: 'HSE & Process Safety Directorate',
    notes: '',
  };
}

export default function App() {
  const defaultPreset = INDUSTRIAL_PRESETS[0];
  const initialDraft = useMemo(() => loadAutosaveDraft(), []);

  const [currentPresetId, setCurrentPresetId] = useState<string>(
    initialDraft?.currentPresetId ?? defaultPreset.id
  );
  const [fluid, setFluid] = useState<FluidProperties>(
    initialDraft?.fluid ?? defaultPreset.fluid
  );
  const [env, setEnv] = useState<EnvironmentConditions>(
    initialDraft?.environment ?? defaultPreset.environment
  );
  const [tip, setTip] = useState<FlareTipConfig>(
    initialDraft?.tip ?? defaultPreset.tip
  );
  const [stack, setStack] = useState<FlareStackConfig>(() => {
    const baseStack = initialDraft?.stack ?? defaultPreset.stack;
    return {
      ...baseStack,
      originLat: baseStack.originLat ?? DEFAULT_ORIGIN_LAT,
      originLng: baseStack.originLng ?? DEFAULT_ORIGIN_LNG,
    };
  });
  const [receptors, setReceptors] = useState<Receptor[]>(
    initialDraft?.receptors ?? defaultPreset.receptors
  );
  const [separatorConfig, setSeparatorConfig] = useState<SeparatorConfig>(
    initialDraft?.separatorConfig ?? DEFAULT_SEPARATOR_CONFIG
  );
  const [projectMeta, setProjectMeta] = useState<ProjectMetadata>(
    initialDraft?.meta ?? getDefaultMetaForGas(defaultPreset.fluid.gasType, defaultPreset.name)
  );
  const [unitSystem, setUnitSystem] = useState<'SI' | 'Field'>(
    initialDraft?.unitSystem ?? 'SI'
  );
  const [activeStep, setActiveStep] = useState<number>(
    initialDraft?.activeStep ?? 1
  );

  // Active saved-project tracking
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    initialDraft?.activeProjectId ?? null
  );
  const [activeProjectStatus, setActiveProjectStatus] = useState<ProjectStatus | null>(
    initialDraft?.activeProjectStatus ?? null
  );
  const [activeStorageSource, setActiveStorageSource] = useState<'cloud' | 'local' | null>(
    initialDraft?.activeStorageSource ?? null
  );
  const [lastAutosaveIso, setLastAutosaveIso] = useState<string | null>(
    initialDraft?.savedAtIso ?? null
  );

  // Firebase Auth & Cloud / Local projects lists
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [cloudProjects, setCloudProjects] = useState<SavedFlareProject[]>([]);
  const [localProjects, setLocalProjects] = useState<SavedFlareProject[]>(() => listLocalProjects());
  const [storageError, setStorageError] = useState<string | null>(null);

  // Save/Load Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'save' | 'open'>('save');
  const [modalDefaultStatus, setModalDefaultStatus] = useState<ProjectStatus>('completed');

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firestore real-time subscription when authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setCloudProjects([]);
      return;
    }
    const unsub = subscribeCloudProjects(
      user.uid,
      (projects) => {
        setCloudProjects(projects);
        setStorageError(null);
      },
      (err) => {
        setStorageError(`Sinkronisasi cloud gagal: ${err.message}`);
      }
    );
    return () => unsub();
  }, [authReady, user]);

  // Continuous debounced Auto-Save to localStorage so leaving/refreshing never loses progress
  useEffect(() => {
    const timer = setTimeout(() => {
      const stateToSave: ActiveProjectState = {
        activeProjectId,
        activeProjectStatus,
        activeStorageSource,
        meta: projectMeta,
        currentPresetId,
        unitSystem,
        activeStep,
        fluid,
        environment: env,
        tip,
        stack,
        receptors,
        separatorConfig,
      };
      const iso = saveAutosaveDraft(stateToSave);
      setLastAutosaveIso(iso);
    }, 350);
    return () => clearTimeout(timer);
  }, [
    activeProjectId,
    activeProjectStatus,
    activeStorageSource,
    projectMeta,
    currentPresetId,
    unitSystem,
    activeStep,
    fluid,
    env,
    tip,
    stack,
    receptors,
    separatorConfig,
  ]);

  // Live simulation execution
  const results = useMemo(() => {
    return runSimulation(fluid, env, tip, stack, receptors);
  }, [fluid, env, tip, stack, receptors]);

  const actualVolumetricM3h = useMemo(() => {
    const density = calculateGasDensity(
      fluid.reliefPressure,
      fluid.temperature,
      fluid.molecularWeight,
      fluid.compressibilityZ
    );
    return convertMassToVolumetricFlow(
      fluid.massFlowRate,
      density,
      fluid.molecularWeight,
      'vol_actual_m3h'
    );
  }, [fluid]);

  const projectSummary: SavedProjectSummary = useMemo(
    () => ({
      heatReleaseMw: Number(results.flame.heatReleaseMw.toFixed(2)),
      stackHeightM: stack.stackHeight,
      maxRadiationKw: Number(results.maxReceptorRadiationKw.toFixed(2)),
      isAllCompliant: results.isAllCompliant,
      gasName: fluid.gasName,
      separatorOrientation: separatorConfig.orientation,
      separatorDiaMm: separatorConfig.selectedDiameterMm,
    }),
    [results, stack.stackHeight, fluid.gasName, separatorConfig.orientation, separatorConfig.selectedDiameterMm]
  );

  const handleSignInGoogle = async () => {
    setAuthLoading(true);
    setStorageError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setStorageError(
        err instanceof Error ? `Login Google dibatalkan / gagal: ${err.message}` : 'Login gagal.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setCloudProjects([]);
  };

  const handleSaveProject = async (
    target: 'cloud' | 'local',
    status: ProjectStatus,
    saveAsNew: boolean
  ) => {
    const activeState: ActiveProjectState = {
      activeProjectId,
      activeProjectStatus,
      activeStorageSource,
      meta: projectMeta,
      currentPresetId,
      unitSystem,
      activeStep,
      fluid,
      environment: env,
      tip,
      stack,
      receptors,
      separatorConfig,
    };

    if (target === 'cloud') {
      if (!user) throw new Error('Silakan masuk dengan akun Google terlebih dahulu.');
      const saved = await saveCloudProject(
        user.uid,
        activeState,
        projectSummary,
        status,
        saveAsNew ? null : activeProjectId
      );
      setActiveProjectId(saved.id);
      setActiveProjectStatus(saved.status);
      setActiveStorageSource('cloud');
    } else {
      const overwriteId =
        !saveAsNew &&
        activeStorageSource === 'local' &&
        activeProjectStatus !== 'completed'
          ? activeProjectId
          : null;
      const saved = saveLocalProject(activeState, projectSummary, status, overwriteId);
      setLocalProjects(listLocalProjects());
      setActiveProjectId(saved.id);
      setActiveProjectStatus(saved.status);
      setActiveStorageSource('local');
    }
  };

  const handleLoadProject = (proj: SavedFlareProject) => {
    setCurrentPresetId(proj.currentPresetId || 'custom');
    setFluid(proj.fluid);
    setEnv(proj.environment);
    setTip(proj.tip);
    setStack({
      ...proj.stack,
      originLat: proj.stack.originLat ?? DEFAULT_ORIGIN_LAT,
      originLng: proj.stack.originLng ?? DEFAULT_ORIGIN_LNG,
    });
    setReceptors(proj.receptors);
    setSeparatorConfig(proj.separatorConfig ?? DEFAULT_SEPARATOR_CONFIG);
    setProjectMeta({
      projectName: proj.projectName,
      docNumber: proj.docNumber,
      facilityLocation: proj.facilityLocation,
      leadEngineer: proj.leadEngineer,
      hseAuditor: proj.hseAuditor,
      notes: proj.notes ?? '',
    });
    setUnitSystem(proj.unitSystem ?? 'SI');
    setActiveStep(proj.activeStep || 1);
    setActiveProjectId(proj.id);
    setActiveProjectStatus(proj.status);
    setActiveStorageSource(proj.storageSource);
  };

  const handleDeleteProject = async (proj: SavedFlareProject) => {
    if (proj.storageSource === 'cloud') {
      await deleteCloudProject(proj.id);
    } else {
      setLocalProjects(deleteLocalProject(proj.id));
    }
    if (activeProjectId === proj.id) {
      setActiveProjectId(null);
      setActiveProjectStatus(null);
      setActiveStorageSource(null);
    }
  };

  const handleSelectPreset = (preset: FlareProjectPreset) => {
    setCurrentPresetId(preset.id);
    setFluid(preset.fluid);
    setEnv(preset.environment);
    setTip(preset.tip);
    setStack({
      ...preset.stack,
      originLat: preset.stack.originLat ?? DEFAULT_ORIGIN_LAT,
      originLng: preset.stack.originLng ?? DEFAULT_ORIGIN_LNG,
    });
    setReceptors(preset.receptors);
    setProjectMeta(getDefaultMetaForGas(preset.fluid.gasType, preset.name));
    setActiveProjectId(null);
    setActiveProjectStatus(null);
    setActiveStorageSource(null);
  };

  const handleResetToDefault = () => {
    clearAutosaveDraft();
    handleSelectPreset(defaultPreset);
    setSeparatorConfig(DEFAULT_SEPARATOR_CONFIG);
    setActiveStep(1);
  };

  const handleRunAutoOptimize = () => {
    const opt = autoOptimizeStackHeight(fluid, env, tip, stack, receptors, 15, 120, 0.5);
    setStack((prev) => ({ ...prev, stackHeight: opt.optimalHeight }));
    setActiveStep(6);
  };

  const handleExportJson = () => {
    const data = {
      presetId: currentPresetId,
      unitSystem,
      activeStep,
      meta: projectMeta,
      fluid,
      environment: env,
      tip,
      stack,
      receptors,
      separatorConfig,
      exportedAt: new Date().toISOString(),
    };
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', jsonStr);
    const safeName = projectMeta.docNumber.replace(/[^a-zA-Z0-9_-]/g, '_') || 'flaresim_project';
    dlAnchor.setAttribute('download', `${safeName}_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const handleImportJsonFile = async (file: File) => {
    const text = await file.text();
    const imported = parseImportedProjectJson(text);
    if (imported.fluid) setFluid(imported.fluid);
    if (imported.environment) setEnv(imported.environment);
    if (imported.tip) setTip(imported.tip);
    if (imported.stack) {
      setStack({
        ...imported.stack,
        originLat: imported.stack.originLat ?? DEFAULT_ORIGIN_LAT,
        originLng: imported.stack.originLng ?? DEFAULT_ORIGIN_LNG,
      });
    }
    if (imported.receptors) setReceptors(imported.receptors);
    if (imported.separatorConfig) setSeparatorConfig(imported.separatorConfig);
    if (imported.meta) setProjectMeta(imported.meta);
    if (imported.currentPresetId) setCurrentPresetId(imported.currentPresetId);
    if (imported.unitSystem) setUnitSystem(imported.unitSystem);
    if (imported.activeStep) setActiveStep(imported.activeStep);
    setActiveProjectId(null);
    setActiveProjectStatus(null);
    setActiveStorageSource(null);
  };

  const handleTriggerPrint = () => {
    setActiveStep(7);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const openSaveCompletedModal = () => {
    setModalDefaultStatus('completed');
    setModalTab('save');
    setModalOpen(true);
  };

  const openLoadProjectsModal = () => {
    setModalTab('open');
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        currentPresetId={currentPresetId}
        onSelectPreset={handleSelectPreset}
        onResetToDefault={handleResetToDefault}
        onRunAutoOptimize={handleRunAutoOptimize}
        onExportJson={handleExportJson}
        onTriggerPrint={handleTriggerPrint}
        isCompliant={results.isAllCompliant}
        unitSystem={unitSystem}
        setUnitSystem={setUnitSystem}
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        savedProjectsCount={cloudProjects.length + localProjects.length}
        activeProjectName={projectMeta.projectName}
        activeProjectStatus={activeProjectStatus}
        lastAutosaveIso={lastAutosaveIso}
        userEmail={user?.email ?? null}
        onOpenSaveModal={openSaveCompletedModal}
        onOpenLoadModal={openLoadProjectsModal}
      />

      {/* 8-Step Pipeline Interactive Stepper */}
      <PipelineSteps
        activeStep={activeStep}
        onSelectStep={setActiveStep}
        isCompliant={results.isAllCompliant}
      />

      {/* Main Workspace Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 pb-20">
        {activeStep === 1 && (
          <Step1InputData
            fluid={fluid}
            setFluid={setFluid}
            env={env}
            setEnv={setEnv}
            unitSystem={unitSystem}
            onNext={() => setActiveStep(2)}
          />
        )}

        {activeStep === 2 && (
          <Step2TipSizing
            fluid={fluid}
            tip={tip}
            setTip={setTip}
            onNext={() => setActiveStep(3)}
            onPrev={() => setActiveStep(1)}
          />
        )}

        {activeStep === 3 && (
          <Step3ReceptorLayout
            stack={stack}
            setStack={setStack}
            receptors={receptors}
            setReceptors={setReceptors}
            results={results}
            onNext={() => setActiveStep(4)}
            onPrev={() => setActiveStep(2)}
          />
        )}

        {activeStep === 4 && (
          <Step4Simulation3D
            results={results}
            stack={stack}
            env={env}
            receptors={receptors}
            unitSystem={unitSystem}
            onNext={() => setActiveStep(5)}
            onPrev={() => setActiveStep(3)}
          />
        )}

        {activeStep === 5 && (
          <Step5SafetyCompliance
            results={results}
            unitSystem={unitSystem}
            onNext={() => setActiveStep(6)}
            onPrev={() => setActiveStep(4)}
            onJumpToOptimize={() => setActiveStep(6)}
          />
        )}

        {activeStep === 6 && (
          <Step6Optimization
            fluid={fluid}
            env={env}
            tip={tip}
            stack={stack}
            setStack={setStack}
            receptors={receptors}
            results={results}
            onNext={() => setActiveStep(7)}
            onPrev={() => setActiveStep(5)}
          />
        )}

        {activeStep === 7 && (
          <Step7ReportDatasheet
            fluid={fluid}
            env={env}
            tip={tip}
            stack={stack}
            receptors={receptors}
            results={results}
            unitSystem={unitSystem}
            projectMeta={projectMeta}
            onSaveCompletedProject={openSaveCompletedModal}
            onPrev={() => setActiveStep(6)}
            onNext={() => setActiveStep(8)}
          />
        )}

        {activeStep === 8 && (
          <Step8SeparatorSizing
            fluid={fluid}
            unitSystem={unitSystem}
            config={separatorConfig}
            setConfig={setSeparatorConfig}
            onSaveCompletedProject={openSaveCompletedModal}
            onPrev={() => setActiveStep(7)}
          />
        )}

        {/* Global Preliminary Engineering Disclaimer */}
        <div className="no-print mt-8 bg-amber-950/25 border border-amber-700/40 rounded-xl px-4 py-3 flex items-start gap-2.5 text-[11px] text-slate-300 leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">Disclaimer Engineering: </span>
            Aplikasi ini hanya berfungsi sebagai <strong>estimasi awal (preliminary design / screening)</strong>. Untuk desain detail (FEED/DED), pengadaan, konstruksi, maupun persetujuan keselamatan resmi, seluruh hasil perhitungan wajib diverifikasi ulang menggunakan <strong>perangkat lunak simulasi berlisensi</strong> (seperti Flaresim®, Aspen Flare System Analyzer™) dan ditinjau serta disahkan oleh <strong>engineer berlisensi</strong>.
          </div>
        </div>
      </main>

      {/* Save / Open Project Modal */}
      <ProjectManagerModal
        isOpen={modalOpen}
        initialTab={modalTab}
        defaultSaveStatus={modalDefaultStatus}
        onClose={() => setModalOpen(false)}
        user={user}
        authLoading={authLoading}
        onSignInGoogle={handleSignInGoogle}
        onSignOut={handleSignOut}
        meta={projectMeta}
        setMeta={setProjectMeta}
        summary={projectSummary}
        activeProjectId={activeProjectId}
        activeProjectStatus={activeProjectStatus}
        activeStorageSource={activeStorageSource}
        cloudProjects={cloudProjects}
        localProjects={localProjects}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onDeleteProject={handleDeleteProject}
        onExportJson={handleExportJson}
        onImportJsonFile={handleImportJsonFile}
        storageError={storageError}
      />

      {/* Persistent Live Telemetry Status Bar (Docked at bottom) */}
      <footer className="no-print fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 z-30 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-slate-400">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Pelepasan Panas:</span>
              <span className="font-mono font-bold text-slate-200">
                {results.flame.heatReleaseMw.toFixed(1)} MW
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Kecepatan Tip:</span>
              <span className="font-mono font-bold text-slate-200">
                {results.flame.machNumber.toFixed(2)} Mach ({results.flame.tipExitVelocity.toFixed(0)} m/s)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Tinggi Tiang:</span>
              <span className="font-mono font-bold text-amber-400">
                {stack.stackHeight} m
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Radiasi Maks:</span>
              <span
                className={`font-mono font-bold ${
                  results.maxReceptorRadiationKw <= 3.16 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {results.maxReceptorRadiationKw.toFixed(2)} kW/m²
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5">
              <span>Debit Aktual:</span>
              <span className="font-mono font-bold text-slate-200">
                {actualVolumetricM3h.toLocaleString(undefined, { maximumFractionDigits: 1 })} m³/h
              </span>
            </div>
          </div>

          {/* Quick Jump / HSE Badge */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep(5)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold font-mono transition-colors ${
                results.isAllCompliant
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                  : 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 animate-pulse'
              }`}
            >
              {results.isAllCompliant ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>API 521: PASS</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>API 521: VIOLATION</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
