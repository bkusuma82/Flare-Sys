export type FlareTipType = 'pipe' | 'sonic' | 'steam_assisted' | 'air_assisted';

export type StackSupportType = 'self_supported' | 'guyed' | 'derrick';

export type GasType = 
  | 'natural_gas'
  | 'methane'
  | 'propane'
  | 'ethylene'
  | 'sour_gas'
  | 'syngas'
  | 'biogas'
  | 'custom';

export interface GasComponentItem {
  id: string;
  name: string;
  formula: string;
  mw: number; // kg/kmol
  lhvMjKg: number; // MJ/kg
  kCpCv: number; // Cp/Cv
  molePct: number; // % mole
}

export type FlowInputMode = 'mass_kgh' | 'vol_actual_m3h' | 'vol_normal_nm3h';

export interface FluidProperties {
  gasType: GasType;
  gasName: string;
  molecularWeight: number; // kg/kmol (g/mol)
  massFlowRate: number; // kg/h
  flowInputMode?: FlowInputMode;
  volumetricFlowInput?: number; // user input value in m3/h or Nm3/h
  temperature: number; // °C
  reliefPressure: number; // barg
  lhv: number; // Lower Heating Value in MJ/kg
  heatCapacityRatio: number; // k = Cp/Cv (dimensionless)
  compressibilityZ: number; // Z factor
  h2sContentPct: number; // % H2S for sour gas
  customComponents?: GasComponentItem[];
}

export interface EnvironmentConditions {
  ambientTemp: number; // °C
  relativeHumidity: number; // %
  windSpeed: number; // m/s
  windDirection: number; // degrees (0° = North, 90° = East, 180° = South, 270° = West)
  solarRadiation: number; // kW/m² (API 521 solar constant, ~1.0 kW/m² peak sun)
}

export interface FlareTipConfig {
  tipType: FlareTipType;
  tipDiameter: number; // mm
  dischargeCoeff: number; // typically 0.6 - 0.85
  radiationFractionOverride?: number; // optional custom Fs
}

export interface FlareStackConfig {
  stackHeight: number; // meters
  stackDiameter: number; // meters
  supportType: StackSupportType;
  locationX: number; // meters
  locationY: number; // meters
  originLat?: number; // WGS84 Latitude of stack origin
  originLng?: number; // WGS84 Longitude of stack origin
}

export type HazardousZoneType = 'Zone 1' | 'Zone 2' | 'Non-Hazardous';

export interface HazardousAreaZones {
  zone1RadiusM: number; // IEC 60079-10-1 / API RP 505 Zone 1 radius from flare/KO drum source
  zone2RadiusM: number; // Zone 2 radius (extended / flameout LEL buffer)
  gasGroup: 'IIA' | 'IIB' | 'IIC';
  tempClass: 'T1' | 'T2' | 'T3';
  equipmentSpecZone1: string;
  equipmentSpecZone2: string;
  equipmentSpecSafe: string;
  basisNote: string;
}

export interface Receptor {
  id: string;
  name: string;
  category: 'walkway' | 'helipad' | 'tank_roof' | 'platform' | 'fence' | 'control_room' | 'custom';
  x: number; // meters (East + / West -)
  y: number; // meters (North + / South -)
  z: number; // meters elevation
  lat?: number; // optional WGS84 Latitude synced with X/Y
  lng?: number; // optional WGS84 Longitude synced with X/Y
  apiLimitKw: number; // kW/m² allowed by API 521 for this location
  noiseLimitDba: number; // dBA allowed
  notes?: string;
}

export interface ReceptorResult {
  receptor: Receptor;
  distanceToFlameCenter: number; // m
  groundDistance: number; // m from flame center projection
  stackGroundDistance: number; // m from flare stack base
  hazardousZone: HazardousZoneType;
  exRequirement: string;
  transmissivity: number; // tau
  radiationKw: number; // kW/m² (including solar)
  radiationBtu: number; // BTU/h·ft²
  noiseDba: number; // dBA
  metalTempC: number; // estimated equilibrium metal temp °C
  isRadiationPass: boolean;
  isNoisePass: boolean;
  isMetalTempPass: boolean;
  marginKw: number; // apiLimitKw - radiationKw (positive = safe, negative = exceed)
}

export interface FlameGeometry {
  heatReleaseMw: number; // MW
  radiationFraction: number; // Fs
  radiatedPowerMw: number; // MW
  flameLength: number; // meters
  flameTiltDeg: number; // tilt from vertical
  flameYawDeg: number; // azimuth direction (wind downwind)
  flameCenterCoords: { x: number; y: number; z: number };
  flameTipCoords: { x: number; y: number; z: number };
  tipExitVelocity: number; // m/s
  sonicVelocity: number; // m/s
  machNumber: number; // Mach
  soundPowerLevelDba: number; // PWL in dBA
}

export interface IsoplethRadius {
  levelKw: number;
  label: string;
  description: string;
  color: string;
  radiusDownwind: number; // meters from stack base (0 if radiation shell stays above ground)
  radiusCrosswind: number; // meters from stack base (0 if radiation shell stays above ground)
  radiusUpwind: number; // meters from stack base (0 if radiation shell stays above ground)
  radius3d: number; // true 3D spherical radius around flame radiation center
  reachesGround: boolean; // whether this radiation intensity reaches grade level (z=0)
}

export interface CapexBreakdown {
  stackHeight: number;
  steelWeightTonnes: number;
  steelCostUsd: number;
  pipingCostUsd: number;
  civilFoundationUsd: number;
  tipCostUsd: number;
  totalCapexUsd: number;
}

export interface SimulationResults {
  flame: FlameGeometry;
  receptors: ReceptorResult[];
  isopleths: IsoplethRadius[];
  noise85Radius: number; // meters
  maxReceptorRadiationKw: number;
  isAllCompliant: boolean;
  flameoutHazardDistanceM: number; // dispersion radius
  hazardousArea: HazardousAreaZones;
  capex: CapexBreakdown;
}

export interface FlareProjectPreset {
  id: string;
  name: string;
  description: string;
  industry: string;
  fluid: FluidProperties;
  environment: EnvironmentConditions;
  tip: FlareTipConfig;
  stack: FlareStackConfig;
  receptors: Receptor[];
}

export interface RadiationDistancePoint {
  distanceM: number;
  totalDownwindKw: number;
  flareDownwindKw: number;
  totalCrosswindKw: number;
  totalUpwindKw: number;
  solarKw: number;
}

export type SeparatorOrientation = 'vertical' | 'horizontal';

export interface SeparatorConfig {
  orientation: SeparatorOrientation;
  dropletSizeMicron: number; // default 300 um per API 521 / AIChE
  selectedDiameterMm: number; // e.g. 300 mm
  selectedLengthMm?: number; // for horizontal separator T-T length (mm), e.g. 1500 mm
  surgeMarginFactor: number; // e.g. 0.8
  budgetPressureDropMbar: number; // e.g. 0.5 mbar
  maxDigesterPressureMmWc: number; // e.g. 255 mmWC (~25 mbar)
  sealSafetyFactor: number; // e.g. 1.5
  condensateRateLitersPerDay: number; // e.g. 156 L/day
  drainMode: 'continuous_loop_seal' | 'manual_batch';
  manualDrainIntervalHours: number; // e.g. 8 h
  gasViscosityPaS: number; // default 1.2e-5 Pa·s
  waterDensityKgM3: number; // default 1000 kg/m3
  demisterThicknessMm: number; // 100 or 150 mm
  inletDeflectorType: '45deg_baffle' | 'half_pipe' | 'tangential';
  vortexBreakerType: 'cross_baffle' | 'flat_plate';
}

export interface SeparatorCriteriaResult {
  id: number;
  criteriaName: string;
  sourceCode: '[S]' | '[P]'; // [S] = Standar, [P] = Praktik industri/rekomendasi
  acceptanceLimit: string;
  calculatedValue: string;
  status: 'OK' | 'WARNING' | 'FAIL';
  explanation: string;
}

export interface SeparatorNozzleItem {
  tag: string;
  service: string;
  nominalSizeInch: string;
  sizeMm: number;
  elevationMm: number;
  velocityMs: number;
  notes: string;
}

export interface SeparatorSizingResult {
  orientation: SeparatorOrientation;
  gasDensityKgM3: number;
  actualVolumetricFlowM3h: number;
  actualVolumetricFlowM3s: number;

  dropletDiameterM: number;
  terminalVelocityMs: number; // vt
  reynoldsNumber: number; // Re
  dragCoefficient: number; // Cd
  allowableGasVelocityMs: number; // 0.8 * vt (vertical) or settling-scaled limit (horizontal)

  minCrossSectionalAreaM2: number;
  minDiameterMm: number;
  selectedDiameterMm: number;
  vesselLengthMm: number; // for horizontal: T-T length (mm); for vertical: equals tanToTanHeightMm
  ldRatio: number; // L/D ratio
  actualGasVelocityMs: number;
  velocityRatioVt: number; // v_gas / vt (vertical) or v_gas / v_allow (horizontal)

  sumpHeightMm: number;
  workingHeightMm: number;
  workingVolumeLiters: number;
  disengagementHeightMm: number;
  inletElevationMm: number;
  demisterBottomElevationMm: number;
  demisterThicknessMm: number;
  topFreeboardHeightMm: number;
  tanToTanHeightMm: number;
  overallHeightMm: number;

  lllElevationMm: number;
  nllElevationMm: number;
  hllElevationMm: number;
  hhllElevationMm: number;

  fillTimeHours: number;
  isContinuousDrainRequired: boolean;

  minSealHeightMmWc: number;
  providedSealHeightMmWc: number;
  sealStatus: 'OK' | 'FAIL';

  inletDropMbar: number;
  demisterDropMbar: number;
  outletDropMbar: number;
  totalDropMbar: number;
  isPressureDropPass: boolean;

  nozzles: SeparatorNozzleItem[];
  criteria: SeparatorCriteriaResult[];
}

export type ProjectStatus = 'draft' | 'completed';

export interface ProjectMetadata {
  projectName: string;
  docNumber: string;
  facilityLocation: string;
  leadEngineer: string;
  hseAuditor: string;
  notes: string;
}

export interface SavedProjectSummary {
  heatReleaseMw: number;
  stackHeightM: number;
  maxRadiationKw: number;
  isAllCompliant: boolean;
  gasName: string;
  separatorOrientation: SeparatorOrientation;
  separatorDiaMm: number;
}

export interface SavedFlareProject {
  id: string;
  ownerId: string;
  projectName: string;
  docNumber: string;
  facilityLocation: string;
  leadEngineer: string;
  hseAuditor: string;
  status: ProjectStatus;
  notes: string;
  currentPresetId: string;
  unitSystem: 'SI' | 'Field';
  activeStep: number;
  fluid: FluidProperties;
  environment: EnvironmentConditions;
  tip: FlareTipConfig;
  stack: FlareStackConfig;
  receptors: Receptor[];
  separatorConfig: SeparatorConfig;
  summary: SavedProjectSummary;
  storageSource: 'cloud' | 'local';
  createdAtIso?: string;
  updatedAtIso?: string;
}

