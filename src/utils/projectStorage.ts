import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  FluidProperties,
  EnvironmentConditions,
  FlareTipConfig,
  FlareStackConfig,
  Receptor,
  SeparatorConfig,
  ProjectMetadata,
  ProjectStatus,
  SavedFlareProject,
  SavedProjectSummary,
} from '../types/flaresim';

const AUTOSAVE_KEY = 'flaresim_autosave_v1';
const LOCAL_PROJECTS_KEY = 'flaresim_local_projects_v1';
const PROJECTS_COLLECTION = 'projects';

export interface ActiveProjectState {
  activeProjectId: string | null;
  activeProjectStatus: ProjectStatus | null;
  activeStorageSource: 'cloud' | 'local' | null;
  meta: ProjectMetadata;
  currentPresetId: string;
  unitSystem: 'SI' | 'Field';
  activeStep: number;
  fluid: FluidProperties;
  environment: EnvironmentConditions;
  tip: FlareTipConfig;
  stack: FlareStackConfig;
  receptors: Receptor[];
  separatorConfig: SeparatorConfig;
  savedAtIso?: string;
}

/**
 * Strip undefined values recursively because Firestore rejects `undefined` properties.
 */
function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `proj_${Date.now()}`;
}

function clampStr(val: string | undefined, maxLen: number, fallback = ''): string {
  const s = (val ?? fallback).trim();
  return s.slice(0, maxLen);
}

function buildSanitizedFirestorePayload(
  projectId: string,
  ownerId: string,
  status: ProjectStatus,
  state: ActiveProjectState,
  summary: SavedProjectSummary
) {
  const safeReceptors = state.receptors.slice(0, 50).map((r) => stripUndefinedDeep(r));
  const safeFluid: FluidProperties = stripUndefinedDeep({
    ...state.fluid,
    gasType: clampStr(state.fluid.gasType, 32, 'natural_gas') as FluidProperties['gasType'],
    gasName: clampStr(state.fluid.gasName, 120, 'Flare Gas'),
    customComponents: state.fluid.customComponents
      ? state.fluid.customComponents.slice(0, 25)
      : undefined,
  });

  return stripUndefinedDeep({
    id: sanitizeId(projectId),
    ownerId: clampStr(ownerId, 128),
    projectName: clampStr(state.meta.projectName, 140, 'Proyek Flaresim Tanpa Judul'),
    docNumber: clampStr(state.meta.docNumber, 60, 'FLS-CALC-001'),
    facilityLocation: clampStr(state.meta.facilityLocation, 140, '-'),
    leadEngineer: clampStr(state.meta.leadEngineer, 100, '-'),
    hseAuditor: clampStr(state.meta.hseAuditor, 100, '-'),
    status,
    notes: clampStr(state.meta.notes, 500, ''),
    currentPresetId: clampStr(state.currentPresetId, 64, 'custom'),
    unitSystem: state.unitSystem,
    activeStep: Math.min(8, Math.max(1, Math.round(state.activeStep || 1))),
    fluid: safeFluid,
    environment: stripUndefinedDeep(state.environment),
    tip: stripUndefinedDeep(state.tip),
    stack: stripUndefinedDeep(state.stack),
    receptors: safeReceptors,
    separatorConfig: stripUndefinedDeep(state.separatorConfig),
    summary: stripUndefinedDeep({
      ...summary,
      gasName: clampStr(summary.gasName, 120, 'Flare Gas'),
    }),
  });
}

// ============================================================================
// 1. AUTO-SAVE DRAFT (localStorage) — Survives accidental close / reload
// ============================================================================

export function saveAutosaveDraft(state: ActiveProjectState): string {
  const savedAtIso = new Date().toISOString();
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ...state, savedAtIso }));
  } catch (err) {
    console.warn('Gagal menyimpan auto-save ke localStorage:', err);
  }
  return savedAtIso;
}

export function loadAutosaveDraft(): ActiveProjectState | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveProjectState;
    if (!parsed || !parsed.fluid || !parsed.stack || !parsed.tip) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAutosaveDraft(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

// ============================================================================
// 2. LOCAL SAVED PROJECTS LIST (localStorage) — Offline / No-login persistence
// ============================================================================

export function listLocalProjects(): SavedFlareProject[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedFlareProject[];
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) =>
      (b.updatedAtIso ?? '').localeCompare(a.updatedAtIso ?? '')
    );
  } catch {
    return [];
  }
}

export function saveLocalProject(
  state: ActiveProjectState,
  summary: SavedProjectSummary,
  status: ProjectStatus,
  overwriteId?: string | null
): SavedFlareProject {
  const existingList = listLocalProjects();
  const nowIso = new Date().toISOString();
  const targetId = overwriteId
    ? sanitizeId(overwriteId)
    : `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const prev = existingList.find((p) => p.id === targetId);

  const record: SavedFlareProject = {
    id: targetId,
    ownerId: 'local_browser',
    projectName: clampStr(state.meta.projectName, 140, 'Proyek Flaresim'),
    docNumber: clampStr(state.meta.docNumber, 60, 'FLS-CALC-001'),
    facilityLocation: clampStr(state.meta.facilityLocation, 140, '-'),
    leadEngineer: clampStr(state.meta.leadEngineer, 100, '-'),
    hseAuditor: clampStr(state.meta.hseAuditor, 100, '-'),
    status,
    notes: clampStr(state.meta.notes, 500, ''),
    currentPresetId: state.currentPresetId,
    unitSystem: state.unitSystem,
    activeStep: state.activeStep,
    fluid: stripUndefinedDeep(state.fluid),
    environment: stripUndefinedDeep(state.environment),
    tip: stripUndefinedDeep(state.tip),
    stack: stripUndefinedDeep(state.stack),
    receptors: stripUndefinedDeep(state.receptors),
    separatorConfig: stripUndefinedDeep(state.separatorConfig),
    summary: stripUndefinedDeep(summary),
    storageSource: 'local',
    createdAtIso: prev?.createdAtIso ?? nowIso,
    updatedAtIso: nowIso,
  };

  const nextList = [record, ...existingList.filter((p) => p.id !== targetId)];
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(nextList));
  return record;
}

export function deleteLocalProject(projectId: string): SavedFlareProject[] {
  const nextList = listLocalProjects().filter((p) => p.id !== projectId);
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(nextList));
  return nextList;
}

// ============================================================================
// 3. CLOUD SAVED PROJECTS (Firebase Firestore) — Multi-device persistence
// ============================================================================

function timestampToIso(val: unknown): string | undefined {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return undefined;
}

export function subscribeCloudProjects(
  uid: string,
  onUpdate: (projects: SavedFlareProject[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, PROJECTS_COLLECTION), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedFlareProject[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: d.ownerId,
          projectName: d.projectName,
          docNumber: d.docNumber ?? '',
          facilityLocation: d.facilityLocation ?? '',
          leadEngineer: d.leadEngineer ?? '',
          hseAuditor: d.hseAuditor ?? '',
          status: d.status === 'completed' ? 'completed' : 'draft',
          notes: d.notes ?? '',
          currentPresetId: d.currentPresetId ?? 'custom',
          unitSystem: d.unitSystem === 'Field' ? 'Field' : 'SI',
          activeStep: typeof d.activeStep === 'number' ? d.activeStep : 1,
          fluid: d.fluid,
          environment: d.environment,
          tip: d.tip,
          stack: d.stack,
          receptors: Array.isArray(d.receptors) ? d.receptors : [],
          separatorConfig: d.separatorConfig,
          summary: d.summary,
          storageSource: 'cloud',
          createdAtIso: timestampToIso(d.createdAt),
          updatedAtIso: timestampToIso(d.updatedAt),
        };
      });
      items.sort((a, b) => (b.updatedAtIso ?? '').localeCompare(a.updatedAtIso ?? ''));
      onUpdate(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, PROJECTS_COLLECTION);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export async function saveCloudProject(
  uid: string,
  state: ActiveProjectState,
  summary: SavedProjectSummary,
  status: ProjectStatus,
  existingDraftId?: string | null
): Promise<SavedFlareProject> {
  // Completed projects are immutable per security rules; create a new document if existing is completed or absent.
  const canUpdateInPlace =
    Boolean(existingDraftId) &&
    state.activeStorageSource === 'cloud' &&
    state.activeProjectStatus === 'draft';

  const projectId = canUpdateInPlace && existingDraftId
    ? sanitizeId(existingDraftId)
    : `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const docPath = `${PROJECTS_COLLECTION}/${projectId}`;
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);
  const basePayload = buildSanitizedFirestorePayload(projectId, uid, status, state, summary);

  if (canUpdateInPlace) {
    try {
      const { id: _id, ownerId: _owner, ...updatableFields } = basePayload;
      await updateDoc(docRef, {
        ...updatableFields,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  } else {
    try {
      await setDoc(docRef, {
        ...basePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  }

  const nowIso = new Date().toISOString();
  return {
    ...basePayload,
    storageSource: 'cloud',
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
}

export async function deleteCloudProject(projectId: string): Promise<void> {
  const safeId = sanitizeId(projectId);
  const docPath = `${PROJECTS_COLLECTION}/${safeId}`;
  try {
    await deleteDoc(doc(db, PROJECTS_COLLECTION, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// ============================================================================
// 4. PORTABLE JSON FILE IMPORT / EXPORT
// ============================================================================

export function parseImportedProjectJson(rawJson: string): Partial<ActiveProjectState> {
  const parsed = JSON.parse(rawJson);
  if (!parsed || typeof parsed !== 'object' || !parsed.fluid || !parsed.stack || !parsed.tip) {
    throw new Error('Format file JSON bukan proyek Flaresim yang valid.');
  }
  return {
    currentPresetId: typeof parsed.presetId === 'string'
      ? parsed.presetId
      : typeof parsed.currentPresetId === 'string'
      ? parsed.currentPresetId
      : 'custom',
    unitSystem: parsed.unitSystem === 'Field' ? 'Field' : 'SI',
    activeStep: typeof parsed.activeStep === 'number' ? parsed.activeStep : 1,
    fluid: parsed.fluid,
    environment: parsed.environment,
    tip: parsed.tip,
    stack: parsed.stack,
    receptors: Array.isArray(parsed.receptors) ? parsed.receptors : [],
    separatorConfig: parsed.separatorConfig,
    meta: parsed.meta ?? {
      projectName: parsed.projectName ?? 'Proyek Impor JSON',
      docNumber: parsed.docNumber ?? 'FLS-IMP-001',
      facilityLocation: parsed.facilityLocation ?? '-',
      leadEngineer: parsed.leadEngineer ?? '-',
      hseAuditor: parsed.hseAuditor ?? '-',
      notes: parsed.notes ?? '',
    },
  };
}
