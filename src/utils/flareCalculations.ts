import {
  FluidProperties,
  EnvironmentConditions,
  FlareTipConfig,
  FlareStackConfig,
  Receptor,
  ReceptorResult,
  FlameGeometry,
  IsoplethRadius,
  CapexBreakdown,
  SimulationResults,
  GasComponentItem,
  FlowInputMode,
  RadiationDistancePoint,
  SeparatorConfig,
  SeparatorSizingResult,
  SeparatorCriteriaResult,
  SeparatorNozzleItem,
  HazardousAreaZones,
  HazardousZoneType,
} from '../types/flaresim';

export const DEFAULT_ORIGIN_LAT = -6.2088;
export const DEFAULT_ORIGIN_LNG = 106.8456;

const METERS_PER_DEG_LAT = 111320;

export function localMetersToLatLng(
  xMeters: number,
  yMeters: number,
  originLat: number = DEFAULT_ORIGIN_LAT,
  originLng: number = DEFAULT_ORIGIN_LNG
): { lat: number; lng: number } {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  const lat = originLat + yMeters / METERS_PER_DEG_LAT;
  const lng = originLng + xMeters / Math.max(1000, metersPerDegLng);
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
  };
}

export function latLngToLocalMeters(
  lat: number,
  lng: number,
  originLat: number = DEFAULT_ORIGIN_LAT,
  originLng: number = DEFAULT_ORIGIN_LNG
): { x: number; y: number } {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  const y = (lat - originLat) * METERS_PER_DEG_LAT;
  const x = (lng - originLng) * metersPerDegLng;
  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

const R_UNIVERSAL = 8314.46; // J / (kmol · K)
const STEFAN_BOLTZMANN = 5.670374e-8; // W / (m² · K⁴)

export const STANDARD_PIPE_SIZES_MM: Array<{ nps: string; mm: number; inches: number }> = [
  { nps: '1"', mm: 25, inches: 1 },
  { nps: '1.5"', mm: 40, inches: 1.5 },
  { nps: '2"', mm: 50, inches: 2 },
  { nps: '3"', mm: 80, inches: 3 },
  { nps: '4"', mm: 100, inches: 4 },
  { nps: '6"', mm: 150, inches: 6 },
  { nps: '8"', mm: 200, inches: 8 },
  { nps: '10"', mm: 250, inches: 10 },
  { nps: '12"', mm: 300, inches: 12 },
  { nps: '14"', mm: 350, inches: 14 },
  { nps: '16"', mm: 400, inches: 16 },
  { nps: '18"', mm: 450, inches: 18 },
  { nps: '20"', mm: 500, inches: 20 },
  { nps: '24"', mm: 600, inches: 24 },
  { nps: '30"', mm: 750, inches: 30 },
  { nps: '36"', mm: 900, inches: 36 },
  { nps: '42"', mm: 1050, inches: 42 },
  { nps: '48"', mm: 1200, inches: 48 },
];

export const DEFAULT_GAS_COMPONENTS: GasComponentItem[] = [
  { id: 'ch4', name: 'Metana', formula: 'CH4', mw: 16.043, lhvMjKg: 50.01, kCpCv: 1.304, molePct: 80.0 },
  { id: 'c2h6', name: 'Etana', formula: 'C2H6', mw: 30.070, lhvMjKg: 47.79, kCpCv: 1.186, molePct: 8.0 },
  { id: 'c3h8', name: 'Propana', formula: 'C3H8', mw: 44.097, lhvMjKg: 46.36, kCpCv: 1.130, molePct: 4.0 },
  { id: 'c4h10', name: 'Butana (i/n)', formula: 'C4H10', mw: 58.123, lhvMjKg: 45.66, kCpCv: 1.095, molePct: 2.0 },
  { id: 'c5plus', name: 'Pentana+ (C5+)', formula: 'C5H12+', mw: 72.150, lhvMjKg: 45.00, kCpCv: 1.080, molePct: 0.5 },
  { id: 'co2', name: 'Karbon Dioksida', formula: 'CO2', mw: 44.010, lhvMjKg: 0.00, kCpCv: 1.289, molePct: 3.5 },
  { id: 'n2', name: 'Nitrogen', formula: 'N2', mw: 28.013, lhvMjKg: 0.00, kCpCv: 1.404, molePct: 1.5 },
  { id: 'h2s', name: 'Hidrogen Sulfida', formula: 'H2S', mw: 34.082, lhvMjKg: 15.20, kCpCv: 1.320, molePct: 0.5 },
  { id: 'h2', name: 'Hidrogen', formula: 'H2', mw: 2.016, lhvMjKg: 120.00, kCpCv: 1.405, molePct: 0.0 },
  { id: 'co', name: 'Karbon Monoksida', formula: 'CO', mw: 28.010, lhvMjKg: 10.10, kCpCv: 1.400, molePct: 0.0 },
  { id: 'h2o', name: 'Uap Air', formula: 'H2O', mw: 18.015, lhvMjKg: 0.00, kCpCv: 1.330, molePct: 0.0 },
];

/**
 * Calculate thermodynamics for custom multi-component gas mixture
 */
export function calculateMixtureProperties(components: GasComponentItem[]): {
  mw: number;
  lhv: number;
  k: number;
  z: number;
  h2sPct: number;
  totalMolePct: number;
} {
  const totalMole = components.reduce((sum, c) => sum + Math.max(0, c.molePct), 0);
  if (totalMole <= 0) {
    return { mw: 18.2, lhv: 48.0, k: 1.28, z: 0.95, h2sPct: 0, totalMolePct: 0 };
  }

  const normalized = components.map((c) => ({
    ...c,
    yi: Math.max(0, c.molePct) / totalMole,
  }));

  // Average MW = sum(yi * MWi)
  const mw = normalized.reduce((sum, c) => sum + c.yi * c.mw, 0);

  // Mass fractions wi = (yi * MWi) / MW, LHV_mix = sum(wi * LHV_i)
  const lhv = normalized.reduce((sum, c) => {
    const wi = (c.yi * c.mw) / Math.max(0.1, mw);
    return sum + wi * c.lhvMjKg;
  }, 0);

  // Cp / Cv approximation from molar heat capacities:
  let cpMolarMix = 0;
  normalized.forEach((c) => {
    const k_i = Math.max(1.05, c.kCpCv);
    const cp_i = (k_i / (k_i - 1)) * R_UNIVERSAL;
    cpMolarMix += c.yi * cp_i;
  });
  const cvMolarMix = Math.max(100, cpMolarMix - R_UNIVERSAL);
  const k = Math.min(1.45, Math.max(1.10, cpMolarMix / cvMolarMix));

  // H2S mass %
  const h2sComp = normalized.find((c) => c.formula === 'H2S');
  const h2sPct = h2sComp ? ((h2sComp.yi * h2sComp.mw) / Math.max(0.1, mw)) * 100 : 0;

  // Approximate compressibility Z factor
  const z = Math.max(0.85, Math.min(0.99, 1.0 - 0.0025 * Math.min(60, mw)));

  return {
    mw: Math.round(mw * 100) / 100,
    lhv: Math.round(lhv * 100) / 100,
    k: Math.round(k * 1000) / 1000,
    z: Math.round(z * 100) / 100,
    h2sPct: Math.round(h2sPct * 100) / 100,
    totalMolePct: Math.round(totalMole * 10) / 10,
  };
}

/**
 * Normal gas density (at 0°C, 1.01325 bara) in kg/Nm³:
 * rho_normal = MW / 22.414
 */
export function calculateNormalGasDensity(mw: number): number {
  return mw / 22.414;
}

/**
 * Convert user flow input (mass kg/h or volumetric m3/h) to mass flow in kg/h
 */
export function convertFlowToMassRate(
  mode: FlowInputMode,
  value: number,
  densityActualKgM3: number,
  mw: number
): number {
  if (mode === 'vol_actual_m3h') {
    return value * Math.max(0.01, densityActualKgM3);
  }
  if (mode === 'vol_normal_nm3h') {
    const rhoNormal = calculateNormalGasDensity(mw);
    return value * rhoNormal;
  }
  return value;
}

/**
 * Convert mass flow rate (kg/h) to volumetric flow (actual or normal m3/h)
 */
export function convertMassToVolumetricFlow(
  massFlowKgH: number,
  densityActualKgM3: number,
  mw: number,
  mode: FlowInputMode
): number {
  if (mode === 'vol_actual_m3h') {
    return massFlowKgH / Math.max(0.01, densityActualKgM3);
  }
  if (mode === 'vol_normal_nm3h') {
    const rhoNormal = calculateNormalGasDensity(mw);
    return massFlowKgH / Math.max(0.01, rhoNormal);
  }
  return massFlowKgH;
}

/**
 * Calculate gas density in kg/m³ using Real Gas Law:
 * rho = (P_abs * MW) / (Z * R_u * T_abs)
 */
export function calculateGasDensity(
  pressureBarg: number,
  tempC: number,
  mw: number,
  zFactor: number
): number {
  const pAbsPa = (pressureBarg + 1.01325) * 1e5;
  const tAbsK = tempC + 273.15;
  const z = Math.max(0.5, Math.min(1.5, zFactor));
  return (pAbsPa * mw) / (z * R_UNIVERSAL * tAbsK);
}

/**
 * Calculate speed of sound in the gas:
 * c = sqrt((k * R_u * T_abs) / MW)
 */
export function calculateSonicVelocity(
  tempC: number,
  mw: number,
  kRatio: number
): number {
  const tAbsK = tempC + 273.15;
  const c = Math.sqrt((kRatio * R_UNIVERSAL * tAbsK) / mw);
  return c;
}

/**
 * Calculate flare tip hydraulics: diameter, velocity, and Mach number
 */
export function calculateTipHydraulics(
  massFlowKgH: number,
  densityKgM3: number,
  tipDiameterMm: number,
  sonicVelocityMs: number
) {
  const massFlowKgS = massFlowKgH / 3600;
  const volFlowM3S = massFlowKgS / Math.max(0.01, densityKgM3);
  const diameterM = tipDiameterMm / 1000;
  const areaM2 = (Math.PI / 4) * Math.pow(diameterM, 2);
  const exitVelocityMs = volFlowM3S / Math.max(0.0001, areaM2);
  const machNumber = exitVelocityMs / Math.max(1, sonicVelocityMs);

  return {
    volFlowM3S,
    areaM2,
    exitVelocityMs,
    machNumber,
  };
}

/**
 * Recommend initial tip diameter (mm) based on target Mach number (e.g. 0.4 for pipe, 0.7 for sonic)
 */
export function recommendTipDiameterMm(
  massFlowKgH: number,
  densityKgM3: number,
  sonicVelocityMs: number,
  targetMach: number = 0.4
): number {
  const massFlowKgS = massFlowKgH / 3600;
  const volFlowM3S = massFlowKgS / Math.max(0.01, densityKgM3);
  const targetVelocity = sonicVelocityMs * targetMach;
  const requiredArea = volFlowM3S / Math.max(1, targetVelocity);
  const reqDiameterM = Math.sqrt((4 * requiredArea) / Math.PI);
  
  // Standardize to nearest standard pipe sizing (min 25mm / 1")
  const reqDiameterMm = reqDiameterM * 1000;
  const matched = STANDARD_PIPE_SIZES_MM.find((p) => p.mm >= reqDiameterMm);
  return matched ? matched.mm : 1200;
}

/**
 * Estimate radiation fraction F_s per API 521
 */
export function getRadiationFraction(
  fluid: FluidProperties,
  tip: FlareTipConfig
): number {
  if (tip.radiationFractionOverride && tip.radiationFractionOverride > 0) {
    return tip.radiationFractionOverride;
  }

  const mw = fluid.molecularWeight;
  let baseFs = 0.18;

  switch (tip.tipType) {
    case 'sonic':
      // Sonic flares have high aeration and shorter flame, lower Fs
      baseFs = 0.12 + 0.002 * Math.min(60, mw);
      break;
    case 'steam_assisted':
      baseFs = 0.13 + 0.0018 * Math.min(60, mw);
      break;
    case 'air_assisted':
      baseFs = 0.14 + 0.002 * Math.min(60, mw);
      break;
    case 'pipe':
    default:
      // Pipe flares have higher luminous soot fraction for heavier gas
      baseFs = 0.17 + 0.003 * Math.min(60, mw);
      break;
  }

  return Math.min(0.35, Math.max(0.12, baseFs));
}

/**
 * Calculate Flame Geometry per API 521 / Brzustowski-Sommer:
 * Heat release, flame length, tilt angle from wind, flame center
 */
export function calculateFlameGeometry(
  fluid: FluidProperties,
  env: EnvironmentConditions,
  tip: FlareTipConfig,
  stack: FlareStackConfig
): FlameGeometry {
  const massFlowKgS = fluid.massFlowRate / 3600;
  const density = calculateGasDensity(fluid.reliefPressure, fluid.temperature, fluid.molecularWeight, fluid.compressibilityZ);
  const sonicVel = calculateSonicVelocity(fluid.temperature, fluid.molecularWeight, fluid.heatCapacityRatio);
  const hydraulics = calculateTipHydraulics(fluid.massFlowRate, density, tip.tipDiameter, sonicVel);

  // Total heat release in MW = massFlow (kg/s) * LHV (MJ/kg)
  const heatReleaseMw = massFlowKgS * fluid.lhv;
  const heatReleaseW = heatReleaseMw * 1e6;

  // Radiation fraction Fs
  const radiationFraction = getRadiationFraction(fluid, tip);
  const radiatedPowerMw = heatReleaseMw * radiationFraction;

  // Flame length L_f (m) from API 521 empirical equation:
  // Lf = 0.00607 * (Q_heat_watts)^0.478
  const flameLength = Math.max(2.0, 0.00607 * Math.pow(Math.max(1000, heatReleaseW), 0.478));

  // Flame tilt: ratio of wind speed to exit velocity
  const uWind = Math.max(0.1, env.windSpeed);
  const uJet = Math.max(1.0, hydraulics.exitVelocityMs);
  const velRatio = uWind / uJet;

  // Flame tilt angle from vertical (degrees)
  // Higher wind / lower jet velocity causes more tilt
  const tiltRad = Math.atan(2.2 * Math.pow(velRatio, 0.65));
  let flameTiltDeg = (tiltRad * 180) / Math.PI;
  flameTiltDeg = Math.min(75, Math.max(0, flameTiltDeg));

  // Azimuth direction: wind pushes the flame downwind
  // If wind direction is theta (blowing from), downwind direction is (theta + 180) % 360
  const flameYawDeg = (env.windDirection + 180) % 360;
  const yawRad = (flameYawDeg * Math.PI) / 180;
  const tiltAngleRad = (flameTiltDeg * Math.PI) / 180;

  // Center of radiation is located at ~40% - 50% along flame length from the tip
  const centerDistance = 0.45 * flameLength;
  const tipDistance = flameLength;

  // Coordinates:
  // X = East (+), Y = North (+), Z = Up (+)
  // yaw 0 = North (so deltaY = cos, deltaX = sin)
  const flameCenterX = stack.locationX + centerDistance * Math.sin(tiltAngleRad) * Math.sin(yawRad);
  const flameCenterY = stack.locationY + centerDistance * Math.sin(tiltAngleRad) * Math.cos(yawRad);
  const flameCenterZ = stack.stackHeight + centerDistance * Math.cos(tiltAngleRad);

  const flameTipX = stack.locationX + tipDistance * Math.sin(tiltAngleRad) * Math.sin(yawRad);
  const flameTipY = stack.locationY + tipDistance * Math.sin(tiltAngleRad) * Math.cos(yawRad);
  const flameTipZ = stack.stackHeight + tipDistance * Math.cos(tiltAngleRad);

  // Sound Power Level (PWL in dBA) per API 521
  // PWL = 55 + 10 * log10(Q_heat_watts)
  const soundPowerLevelDba = 55 + 10 * Math.log10(Math.max(1e5, heatReleaseW));

  return {
    heatReleaseMw,
    radiationFraction,
    radiatedPowerMw,
    flameLength,
    flameTiltDeg,
    flameYawDeg,
    flameCenterCoords: { x: flameCenterX, y: flameCenterY, z: flameCenterZ },
    flameTipCoords: { x: flameTipX, y: flameTipY, z: flameTipZ },
    tipExitVelocity: hydraulics.exitVelocityMs,
    sonicVelocity: sonicVel,
    machNumber: hydraulics.machNumber,
    soundPowerLevelDba,
  };
}

/**
 * Atmospheric Transmissivity tau per API 521
 * tau = 0.79 * (100 / RH)^(1/16) * (100 / R)^(1/16)
 */
export function calculateTransmissivity(distanceM: number, relativeHumidityPct: number): number {
  const rh = Math.max(10, Math.min(100, relativeHumidityPct));
  const r = Math.max(5, distanceM);
  const tau = 0.79 * Math.pow(100 / rh, 1 / 16) * Math.pow(100 / r, 1 / 16);
  return Math.min(1.0, Math.max(0.60, tau));
}

/**
 * Calculate equilibrium metal temperature (°C)
 */
export function calculateMetalSkinTemp(
  incidentRadiationKw: number,
  ambientTempC: number,
  windSpeedMs: number
): number {
  const qIncidentWm2 = incidentRadiationKw * 1000;
  const alpha = 0.85; // Solar / flame absorptivity of oxidized steel
  const epsilon = 0.80; // Emissivity
  const hc = 10.0 + 4.0 * Math.max(0.5, windSpeedMs); // Convective heat transfer coeff W/(m²·K)
  const tAmbK = ambientTempC + 273.15;

  // Linearized radiation approximation for fast evaluation:
  // q_in = alpha * Q = epsilon * sigma * 4 * T_avg^3 * (T_m - T_amb) + hc * (T_m - T_amb)
  const hRad = 4 * epsilon * STEFAN_BOLTZMANN * Math.pow(tAmbK, 3);
  const deltaT = (alpha * qIncidentWm2) / (hc + hRad);
  return ambientTempC + deltaT;
}

/**
 * Calculate Hazardous Area Classification (Zone 1 & Zone 2) per IEC 60079-10-1 / API RP 505 / EI 15
 * Evaluates gas group (IIA / IIB / IIC), temperature class, Zone 1 radius (around KO drum vents,
 * seal drains, pilot/ignition manifold & flare base), and Zone 2 radius (extended / flameout LEL buffer).
 */
export function calculateHazardousAreaZones(
  fluid: FluidProperties,
  flameoutHazardDistanceM: number
): HazardousAreaZones {
  const density = calculateGasDensity(
    fluid.reliefPressure,
    fluid.temperature,
    fluid.molecularWeight,
    fluid.compressibilityZ
  );
  const actualVolM3h = fluid.massFlowRate / Math.max(0.05, density);

  // Determine IEC Gas Group & Temp Class from gas type or custom components
  let gasGroup: 'IIA' | 'IIB' | 'IIC' = 'IIA';
  let tempClass: 'T1' | 'T2' | 'T3' = 'T1';

  if (fluid.gasType === 'syngas') {
    gasGroup = 'IIC'; // H2-rich syngas
    tempClass = 'T1';
  } else if (fluid.gasType === 'ethylene') {
    gasGroup = 'IIB';
    tempClass = 'T2';
  } else if (fluid.gasType === 'sour_gas' || fluid.h2sContentPct >= 1.0) {
    gasGroup = 'IIB'; // H2S requires IIB (or IIB + H2S considerations) & T3
    tempClass = 'T3';
  } else if (fluid.gasType === 'custom' && fluid.customComponents) {
    const total = Math.max(1, fluid.customComponents.reduce((s, c) => s + Math.max(0, c.molePct), 0));
    const h2Pct = ((fluid.customComponents.find((c) => c.formula === 'H2')?.molePct || 0) / total) * 100;
    const h2sPct = ((fluid.customComponents.find((c) => c.formula === 'H2S')?.molePct || 0) / total) * 100;
    const c3PlusPct =
      (((fluid.customComponents.find((c) => c.formula === 'C3H8')?.molePct || 0) +
        (fluid.customComponents.find((c) => c.formula === 'C4H10')?.molePct || 0) +
        (fluid.customComponents.find((c) => c.formula === 'C5H12+')?.molePct || 0)) /
        total) *
      100;

    if (h2Pct > 15) {
      gasGroup = 'IIC';
      tempClass = 'T1';
    } else if (h2sPct > 1.0) {
      gasGroup = 'IIB';
      tempClass = 'T3';
    } else if (c3PlusPct > 25) {
      gasGroup = 'IIA';
      tempClass = 'T2';
    }
  }

  // Zone 1 Radius: Around flare base skid, KO drum/separator seal drain & vent valves
  // Minimum 4.5 m per API RP 505 / EI 15 for open/outdoor vents, scaled with flow & pressure
  const flowScale = Math.pow(Math.max(1, actualVolM3h / 500), 0.32);
  const pressureBonus = Math.min(8, Math.max(0, fluid.reliefPressure) * 0.45);
  const h2sBonus = fluid.h2sContentPct > 0.1 ? 2.0 : 0;
  const zone1RadiusM = Math.max(
    4.5,
    Math.min(35, Math.round((3.0 + 1.8 * flowScale + pressureBonus + h2sBonus) * 10) / 10)
  );

  // Zone 2 Radius: Extended perimeter covering abnormal release / unignited dispersion 50% LEL
  const zone2RadiusM = Math.max(
    Math.round(zone1RadiusM * 2.4 * 10) / 10,
    Math.min(120, Math.max(15, flameoutHazardDistanceM))
  );

  return {
    zone1RadiusM,
    zone2RadiusM,
    gasGroup,
    tempClass,
    equipmentSpecZone1: `Wajib Ex d / Ex ia / Ex px (Group ${gasGroup} ${tempClass}) — Tahan Ledakan`,
    equipmentSpecZone2: `Wajib Min. Ex ec / Ex nA / Ex nR (Group ${gasGroup} ${tempClass}) — Non-Sparking`,
    equipmentSpecSafe: `Non-Hazardous (Safe Area) — Panel & Instrumen Industri Standar (IP54/IP65)`,
    basisNote:
      `Klasifikasi mengacu IEC 60079-10-1 & API RP 505 untuk area terbuka (outdoor natural ventilation) di sekitar basis flare stack, unit separator/KO drum, & jalur flameout 50% LEL.`,
  };
}

/**
 * Evaluate single receptor radiation, noise, and hazardous area Ex rating
 */
export function evaluateReceptor(
  receptor: Receptor,
  flame: FlameGeometry,
  env: EnvironmentConditions,
  stack: FlareStackConfig,
  hazardousArea: HazardousAreaZones
): ReceptorResult {
  const fc = flame.flameCenterCoords;
  const dx = receptor.x - fc.x;
  const dy = receptor.y - fc.y;
  const dz = receptor.z - fc.z;

  const groundDistance = Math.sqrt(
    Math.pow(receptor.x - fc.x, 2) + Math.pow(receptor.y - fc.y, 2)
  );
  const stackGroundDistance = Math.sqrt(
    Math.pow(receptor.x - stack.locationX, 2) + Math.pow(receptor.y - stack.locationY, 2)
  );
  const distanceToFlameCenter = Math.sqrt(dx * dx + dy * dy + dz * dz);

  let hazardousZone: HazardousZoneType = 'Non-Hazardous';
  let exRequirement = hazardousArea.equipmentSpecSafe;
  if (stackGroundDistance <= hazardousArea.zone1RadiusM) {
    hazardousZone = 'Zone 1';
    exRequirement = hazardousArea.equipmentSpecZone1;
  } else if (stackGroundDistance <= hazardousArea.zone2RadiusM) {
    hazardousZone = 'Zone 2';
    exRequirement = hazardousArea.equipmentSpecZone2;
  }

  const transmissivity = calculateTransmissivity(distanceToFlameCenter, env.relativeHumidity);

  // Radiated heat power in kW
  const qRadKw = flame.radiatedPowerMw * 1000;

  // Radiation intensity K = tau * Q_rad / (4 * pi * R^2) + K_solar
  const flareRadiationKw = (transmissivity * qRadKw) / (4 * Math.PI * Math.pow(Math.max(3, distanceToFlameCenter), 2));
  const totalRadiationKw = flareRadiationKw + env.solarRadiation;
  const totalRadiationBtu = totalRadiationKw * 317.0;

  // Noise level at receptor distance:
  // SPL = PWL - 20 * log10(R) - 11 (geometric attenuation)
  const noiseDba = Math.max(
    30,
    flame.soundPowerLevelDba - 20 * Math.log10(Math.max(1, distanceToFlameCenter)) - 11
  );

  const metalTempC = calculateMetalSkinTemp(totalRadiationKw, env.ambientTemp, env.windSpeed);

  const isRadiationPass = totalRadiationKw <= receptor.apiLimitKw;
  const isNoisePass = noiseDba <= receptor.noiseLimitDba;
  // Equipment / structural metal safe up to ~200°C for unshielded structural carbon steel
  const isMetalTempPass = metalTempC <= 200;

  return {
    receptor,
    distanceToFlameCenter,
    groundDistance,
    stackGroundDistance,
    hazardousZone,
    exRequirement,
    transmissivity,
    radiationKw: totalRadiationKw,
    radiationBtu: totalRadiationBtu,
    noiseDba,
    metalTempC,
    isRadiationPass,
    isNoisePass,
    isMetalTempPass,
    marginKw: receptor.apiLimitKw - totalRadiationKw,
  };
}

/**
 * Calculate standard API 521 Radiation Isopleth radii from stack center
 */
export function calculateIsopleths(
  flame: FlameGeometry,
  stack: FlareStackConfig,
  env: EnvironmentConditions
): IsoplethRadius[] {
  const levels = [
    {
      levelKw: 1.58,
      label: '1.58 kW/m² (500 BTU/h·ft²)',
      description: 'Continuous personnel exposure, public areas, unrestricted access',
      color: '#10b981', // green
    },
    {
      levelKw: 3.16,
      label: '3.16 kW/m² (1,000 BTU/h·ft²)',
      description: 'Continuous work (several minutes) with normal work clothing',
      color: '#eab308', // yellow
    },
    {
      levelKw: 4.73,
      label: '4.73 kW/m² (1,500 BTU/h·ft²)',
      description: 'Restricted access, maintenance work with protective clothing',
      color: '#f97316', // orange
    },
    {
      levelKw: 6.31,
      label: '6.31 kW/m² (2,000 BTU/h·ft²)',
      description: 'Emergency escape only, maximum 1 minute exposure',
      color: '#ef4444', // red
    },
    {
      levelKw: 9.46,
      label: '9.46 kW/m² (3,000 BTU/h·ft²)',
      description: 'Equipment design limit, cooling / fireproofing required',
      color: '#b91c1c', // dark red
    },
  ];

  const qRadKw = flame.radiatedPowerMw * 1000;
  const hFlame = flame.flameCenterCoords.z;

  return levels.map((lvl) => {
    // Required flare radiation without solar:
    const targetFlareKw = Math.max(0.1, lvl.levelKw - env.solarRadiation);
    // 3D spherical distance from flame radiation center: R = sqrt(tau * Q_rad / (4 * pi * K))
    const approxR = Math.sqrt((0.85 * qRadKw) / (4 * Math.PI * targetFlareKw));
    const radius3d = Math.round(approxR * 10) / 10;
    const reachesGround = approxR > hFlame;

    if (!reachesGround) {
      return {
        levelKw: lvl.levelKw,
        label: lvl.label,
        description: lvl.description,
        color: lvl.color,
        radiusDownwind: 0,
        radiusCrosswind: 0,
        radiusUpwind: 0,
        radius3d,
        reachesGround: false,
      };
    }

    // Ground circle radius around flame-center ground projection: r_ground = sqrt(R^2 - hFlame^2)
    const baseGroundR = Math.sqrt(approxR * approxR - hFlame * hFlame);

    // Shift with wind deflection from stack base:
    const downwindShift = Math.sin((flame.flameTiltDeg * Math.PI) / 180) * (0.45 * flame.flameLength);
    const radiusDownwind = Math.round(baseGroundR + downwindShift);
    const radiusCrosswind = Math.round(baseGroundR);
    const radiusUpwind = Math.max(0, Math.round(baseGroundR - downwindShift * 0.7));

    return {
      levelKw: lvl.levelKw,
      label: lvl.label,
      description: lvl.description,
      color: lvl.color,
      radiusDownwind,
      radiusCrosswind,
      radiusUpwind,
      radius3d,
      reachesGround: true,
    };
  });
}

/**
 * Structural Capex Cost Estimation Model
 */
export function calculateCapex(stack: FlareStackConfig, tip: FlareTipConfig): CapexBreakdown {
  const h = stack.stackHeight;
  const d = Math.max(0.6, stack.stackDiameter);

  // Multiplier based on support structure:
  // Derrick is heavier steel structure; guyed has wires and anchors; self-supported has heavy base wall
  let supportMult = 1.0;
  if (stack.supportType === 'derrick') supportMult = 1.35;
  if (stack.supportType === 'guyed') supportMult = 0.85;

  // Steel weight scaling (empirical civil structural sizing: scales roughly with H^1.75 * D^0.8)
  const steelWeightTonnes = Math.round(
    0.055 * Math.pow(h, 1.75) * Math.pow(d, 0.75) * supportMult
  );

  // Cost estimates in USD (standard industrial petrochemical benchmark):
  // Installed structural steel: ~$4,800 / tonne (fabrication, coatings, erection)
  const steelCostUsd = steelWeightTonnes * 4800;

  // Riser piping & utility runs: ~$750 per meter of height * diameter factor
  const pipingCostUsd = Math.round(h * 850 * (d / 0.8));

  // Civil foundation & piling: Overturning moment scales with H^2.2
  const foundationVolumeM3 = Math.round(0.04 * Math.pow(h, 1.9) * (d / 0.8));
  const civilFoundationUsd = foundationVolumeM3 * 1100;

  // Flare tip assembly cost:
  let tipCostUsd = 45000;
  if (tip.tipType === 'sonic') tipCostUsd = 95000;
  if (tip.tipType === 'steam_assisted') tipCostUsd = 120000;
  if (tip.tipType === 'air_assisted') tipCostUsd = 145000;

  const totalCapexUsd = steelCostUsd + pipingCostUsd + civilFoundationUsd + tipCostUsd;

  return {
    stackHeight: h,
    steelWeightTonnes,
    steelCostUsd,
    pipingCostUsd,
    civilFoundationUsd,
    tipCostUsd,
    totalCapexUsd,
  };
}

/**
 * Complete Simulation Execution
 */
export function runSimulation(
  fluid: FluidProperties,
  env: EnvironmentConditions,
  tip: FlareTipConfig,
  stack: FlareStackConfig,
  receptors: Receptor[]
): SimulationResults {
  const flame = calculateFlameGeometry(fluid, env, tip, stack);

  // Flameout dispersion hazard radius (if flame extinguished, distance to 50% LEL)
  const flameoutHazardDistanceM = Math.round(3.8 * Math.sqrt(fluid.massFlowRate / 1000));

  // Hazardous Area Zones (IEC 60079-10-1 / API RP 505)
  const hazardousArea = calculateHazardousAreaZones(fluid, flameoutHazardDistanceM);

  const receptorResults = receptors.map((rec) =>
    evaluateReceptor(rec, flame, env, stack, hazardousArea)
  );
  const isopleths = calculateIsopleths(flame, stack, env);

  // 85 dBA continuous noise boundary radius
  // 85 = PWL - 20 * log10(R) - 11 -> 20 * log10(R) = PWL - 96 -> R = 10^((PWL - 96)/20)
  const noise85Radius = Math.round(Math.pow(10, (flame.soundPowerLevelDba - 96) / 20));

  // Max radiation encountered across all receptors
  const maxReceptorRadiationKw = receptorResults.reduce(
    (max, r) => Math.max(max, r.radiationKw),
    0
  );

  const isAllCompliant = receptorResults.every(
    (r) => r.isRadiationPass && r.isNoisePass && r.isMetalTempPass
  );

  const capex = calculateCapex(stack, tip);

  return {
    flame,
    receptors: receptorResults,
    isopleths,
    noise85Radius,
    maxReceptorRadiationKw,
    isAllCompliant,
    flameoutHazardDistanceM,
    hazardousArea,
    capex,
  };
}

/**
 * Automated Capex vs Safety Optimizer:
 * Finds the minimum stack height (within minHeight and maxHeight) that makes all receptors compliant.
 */
export function autoOptimizeStackHeight(
  fluid: FluidProperties,
  env: EnvironmentConditions,
  tip: FlareTipConfig,
  stack: FlareStackConfig,
  receptors: Receptor[],
  minH: number = 5,
  maxH: number = 130,
  stepH: number = 0.5
): {
  optimalHeight: number;
  optimalResults: SimulationResults;
  curveData: Array<{
    height: number;
    maxRadiationKw: number;
    capexUsd: number;
    isCompliant: boolean;
  }>;
} {
  const curveData: Array<{
    height: number;
    maxRadiationKw: number;
    capexUsd: number;
    isCompliant: boolean;
  }> = [];

  let optimalHeight = maxH;
  let optimalResults: SimulationResults | null = null;

  // Sample height range to build sensitivity curve
  for (let h = minH; h <= maxH; h += stepH) {
    const testStack = { ...stack, stackHeight: h };
    const sim = runSimulation(fluid, env, tip, testStack, receptors);

    curveData.push({
      height: Math.round(h * 10) / 10,
      maxRadiationKw: Math.round(sim.maxReceptorRadiationKw * 100) / 100,
      capexUsd: sim.capex.totalCapexUsd,
      isCompliant: sim.isAllCompliant,
    });

    if (sim.isAllCompliant && optimalResults === null) {
      optimalHeight = h;
      optimalResults = sim;
    }
  }

  // If no height is fully compliant, take maxHeight
  if (!optimalResults) {
    const fallbackStack = { ...stack, stackHeight: maxH };
    optimalResults = runSimulation(fluid, env, tip, fallbackStack, receptors);
    optimalHeight = maxH;
  }

  return {
    optimalHeight,
    optimalResults,
    curveData,
  };
}

export const DEFAULT_SEPARATOR_CONFIG: SeparatorConfig = {
  orientation: 'vertical',
  dropletSizeMicron: 300,
  selectedDiameterMm: 300,
  selectedLengthMm: 1200,
  surgeMarginFactor: 0.8,
  budgetPressureDropMbar: 0.5,
  maxDigesterPressureMmWc: 255, // ~25 mbar PRV set
  sealSafetyFactor: 1.5,
  condensateRateLitersPerDay: 156,
  drainMode: 'continuous_loop_seal',
  manualDrainIntervalHours: 8,
  gasViscosityPaS: 1.2e-5,
  waterDensityKgM3: 1000,
  demisterThicknessMm: 100,
  inletDeflectorType: '45deg_baffle',
  vortexBreakerType: 'cross_baffle',
};

/**
 * Calculate droplet terminal settling velocity using intermediate regime
 * per API 521 / AIChE:
 * Re = rho_g * v_t * d / mu
 * Cd = (24 / Re) * (1 + 0.15 * Re^0.687)
 * v_t = sqrt((4 * g * d * (rho_L - rho_g)) / (3 * Cd * rho_g))
 */
export function calculateTerminalVelocityIntermediate(
  dropletDiameterM: number,
  rhoGas: number,
  rhoLiq: number,
  muGas: number
): { vt: number; re: number; cd: number } {
  let vt = 1.0; // initial guess in m/s
  let re = 40;
  let cd = 1.77;
  const g = 9.80665;
  const deltaRho = Math.max(10, rhoLiq - rhoGas);

  for (let iter = 0; iter < 60; iter++) {
    re = Math.max(0.1, (rhoGas * vt * dropletDiameterM) / Math.max(1e-7, muGas));
    cd = (24 / re) * (1 + 0.15 * Math.pow(re, 0.687));
    const denom = 3 * cd * Math.max(0.01, rhoGas);
    const vtNext = Math.sqrt((4 * g * dropletDiameterM * deltaRho) / denom);

    if (Math.abs(vtNext - vt) < 1e-4) {
      vt = vtNext;
      break;
    }
    vt = 0.5 * vt + 0.5 * vtNext;
  }

  return {
    vt: Math.round(vt * 1000) / 1000,
    re: Math.round(re * 10) / 10,
    cd: Math.round(cd * 1000) / 1000,
  };
}

/**
 * Full Sizing Engine for Vertical OR Horizontal Gas-Water Separator (KO Drum / Condensate Pot)
 * based on API 521 adjusted for low-pressure biogas systems (mbar level)
 */
export function sizeGasWaterSeparator(
  fluid: FluidProperties,
  config: SeparatorConfig = DEFAULT_SEPARATOR_CONFIG
): SeparatorSizingResult {
  const orientation = config.orientation ?? 'vertical';
  // Gas density at separator operating condition:
  // Low pressure separator upstream of flare FA operates at 20-50 mbarg
  const opPressureBarg = Math.min(0.05, Math.max(0.01, fluid.reliefPressure));
  const gasDensity = calculateGasDensity(
    opPressureBarg,
    fluid.temperature,
    fluid.molecularWeight,
    fluid.compressibilityZ
  );

  const massFlowKgS = fluid.massFlowRate / 3600;
  const actualVolumetricFlowM3s = massFlowKgS / Math.max(0.01, gasDensity);
  const actualVolumetricFlowM3h = actualVolumetricFlowM3s * 3600;

  // Droplet terminal settling velocity:
  const dropletDiameterM = config.dropletSizeMicron * 1e-6;
  const { vt, re, cd } = calculateTerminalVelocityIntermediate(
    dropletDiameterM,
    gasDensity,
    config.waterDensityKgM3,
    config.gasViscosityPaS
  );

  // Selected diameter:
  const selectedDiameterMm = Math.max(150, config.selectedDiameterMm);
  const selectedDiameterM = selectedDiameterMm / 1000;
  const actualAreaM2 = (Math.PI / 4) * Math.pow(selectedDiameterM, 2);

  // Seal Drain calculation:
  const minSealHeightMmWc = Math.round(config.maxDigesterPressureMmWc * config.sealSafetyFactor);
  const providedSealHeightMmWc = Math.max(600, Math.round(minSealHeightMmWc * 1.25));
  const sealStatus = providedSealHeightMmWc >= minSealHeightMmWc ? 'OK' : 'FAIL';

  // Nozzle Sizing helper:
  const calcNozzle = (service: string, tag: string, flowM3s: number, targetV: number, elevMm: number) => {
    const reqArea = flowM3s / targetV;
    const reqDmm = Math.sqrt((4 * reqArea) / Math.PI) * 1000;
    const standard = STANDARD_PIPE_SIZES_MM.find((p) => p.mm >= reqDmm) || STANDARD_PIPE_SIZES_MM[0];
    const actualArea = (Math.PI / 4) * Math.pow(standard.mm / 1000, 2);
    const vel = Math.round((flowM3s / actualArea) * 10) / 10;
    return {
      tag,
      service,
      nominalSizeInch: standard.nps,
      sizeMm: standard.mm,
      elevationMm: elevMm,
      velocityMs: vel,
      notes: '',
    };
  };

  let allowableGasVelocityMs: number;
  let minCrossSectionalAreaM2: number;
  let minDiameterMm: number;
  let actualGasVelocityMs: number;
  let velocityRatioVt: number;
  let vesselLengthMm: number;
  let ldRatio: number;

  let sumpHeightMm: number;
  let workingHeightMm: number;
  let workingVolumeLiters: number;
  let disengagementHeightMm: number;
  let inletElevationMm: number;
  let demisterBottomElevationMm: number;
  const demisterThicknessMm = config.demisterThicknessMm;
  let topFreeboardHeightMm: number;
  let tanToTanHeightMm: number;
  const headHeightMm = Math.round(selectedDiameterMm * 0.25);
  let overallHeightMm: number;

  let lllElevationMm: number;
  let nllElevationMm: number;
  let hllElevationMm: number;
  let hhllElevationMm: number;

  let fillTimeHours: number;
  let isContinuousDrainRequired: boolean;
  let nozzles: SeparatorNozzleItem[];

  const condensateLitersPerHour = config.condensateRateLitersPerDay / 24;

  if (orientation === 'horizontal') {
    // HORIZONTAL KO DRUM (API 521 Section 5.4.2)
    vesselLengthMm = Math.max(800, config.selectedLengthMm || 1200);
    const vesselLengthM = vesselLengthMm / 1000;
    ldRatio = Math.round((vesselLengthMm / selectedDiameterMm) * 10) / 10;

    // Reserve bottom 35% of ID for liquid holdup (HLL = 0.35*D), upper 65% height = vapor space
    const vaporAreaFraction = 0.688; // circular segment above h = 0.35*D
    const vaporSpaceHeightM = 0.65 * selectedDiameterM;
    const effectiveSettlingLengthM = 0.75 * vesselLengthM;

    // Settling requirement: t_gas >= t_fall -> L_eff / v_gas >= H_v / (vt * surgeMargin)
    // Cap max horizontal gas velocity at 3.5 * vt to avoid liquid surface wave re-entrainment
    const settlingAllowableVel =
      (effectiveSettlingLengthM / Math.max(0.1, vaporSpaceHeightM)) * vt * config.surgeMarginFactor;
    allowableGasVelocityMs =
      Math.round(Math.min(3.5 * vt * config.surgeMarginFactor, settlingAllowableVel) * 1000) / 1000;

    const vaporAreaM2 = actualAreaM2 * vaporAreaFraction;
    actualGasVelocityMs = Math.round((actualVolumetricFlowM3s / Math.max(0.001, vaporAreaM2)) * 1000) / 1000;
    velocityRatioVt = Math.round((actualGasVelocityMs / Math.max(0.01, allowableGasVelocityMs)) * 100) / 100;

    minCrossSectionalAreaM2 = actualVolumetricFlowM3s / Math.max(0.01, allowableGasVelocityMs * vaporAreaFraction);
    minDiameterMm = Math.round(Math.sqrt((4 * minCrossSectionalAreaM2) / Math.PI) * 1000);

    // Liquid levels measured from Bottom Inner Diameter (0 mm):
    lllElevationMm = Math.round(selectedDiameterMm * 0.12);
    nllElevationMm = Math.round(selectedDiameterMm * 0.24);
    hllElevationMm = Math.round(selectedDiameterMm * 0.35);
    hhllElevationMm = Math.round(selectedDiameterMm * 0.42);
    sumpHeightMm = lllElevationMm;
    workingHeightMm = hllElevationMm - lllElevationMm;

    // Liquid working volume between LLL (0.12D) and HLL (0.35D) along horizontal length L:
    // Segment area fraction difference ≈ 0.312 - 0.068 = 0.244 of full cross-section
    const workingAreaFraction = 0.244;
    workingVolumeLiters =
      Math.round(actualAreaM2 * workingAreaFraction * vesselLengthM * 1000 * 10) / 10;

    fillTimeHours = Math.round((workingVolumeLiters / Math.max(0.01, condensateLitersPerHour)) * 10) / 10;
    isContinuousDrainRequired = fillTimeHours < 12 || config.drainMode === 'continuous_loop_seal';

    disengagementHeightMm = Math.round(selectedDiameterMm * 0.58);
    inletElevationMm = selectedDiameterMm; // Top-left nozzle
    demisterBottomElevationMm = selectedDiameterMm - demisterThicknessMm;
    topFreeboardHeightMm = Math.round(selectedDiameterMm * 0.15);
    tanToTanHeightMm = vesselLengthMm; // Horizontal T-T length
    overallHeightMm = selectedDiameterMm + 650; // Saddle + shell height

    const n1Inlet = calcNozzle('Inlet Biogas Campuran (Top-Left)', 'N1', actualVolumetricFlowM3s, 8.0, selectedDiameterMm);
    n1Inlet.notes = `Inlet atas sisi kiri dengan ${config.inletDeflectorType === '45deg_baffle' ? 'Plat Deflektor 45°' : 'Half-Pipe Baffle'} mengarah ke zona cairan`;

    const n2Outlet = calcNozzle('Clean Gas Outlet ke FA (Top-Right)', 'N2', actualVolumetricFlowM3s, 8.0, selectedDiameterMm);
    n2Outlet.notes = 'Outlet puncak sisi kanan di atas Horizontal Wire Mesh Demister Box';

    const n3Drain: SeparatorNozzleItem = {
      tag: 'N3',
      service: 'Liquid Drain ke Loop Seal (Bottom)',
      nominalSizeInch: '2"',
      sizeMm: 50,
      elevationMm: 0,
      velocityMs: 0.1,
      notes: 'Drain di dasar drum sisi kanan dilengkapi Vortex Breaker silang & U-Loop Seal',
    };

    const n4Manway: SeparatorNozzleItem = {
      tag: 'N4',
      service: 'Handhole / Inspeksi End-Cap',
      nominalSizeInch: selectedDiameterMm >= 400 ? '16" Manway' : '8" Handhole',
      sizeMm: selectedDiameterMm >= 400 ? 400 : 200,
      elevationMm: Math.round(selectedDiameterMm * 0.5),
      velocityMs: 0,
      notes: 'Akses pembersihan lumpur (sludge) dasar drum horizontal & inspeksi demister',
    };

    const n5Bridle: SeparatorNozzleItem = {
      tag: 'N5A/B',
      service: 'Level Gauge / Bridle Tap',
      nominalSizeInch: '1"',
      sizeMm: 25,
      elevationMm: lllElevationMm,
      velocityMs: 0,
      notes: 'Sight Glass samping pada rentang LLL ke HHLL',
    };

    const n6Pressure: SeparatorNozzleItem = {
      tag: 'N6',
      service: 'Pressure Gauge / Tap mbar',
      nominalSizeInch: '1/2"',
      sizeMm: 15,
      elevationMm: selectedDiameterMm,
      velocityMs: 0,
      notes: 'Tap tekanan diferensial (dP) melintasi demister',
    };

    nozzles = [n1Inlet, n2Outlet, n3Drain, n4Manway, n5Bridle, n6Pressure];
  } else {
    // VERTICAL KO POT (Default)
    allowableGasVelocityMs = Math.round(vt * config.surgeMarginFactor * 1000) / 1000;

    minCrossSectionalAreaM2 = actualVolumetricFlowM3s / Math.max(0.01, allowableGasVelocityMs);
    minDiameterMm = Math.round(Math.sqrt((4 * minCrossSectionalAreaM2) / Math.PI) * 1000);

    actualGasVelocityMs = Math.round((actualVolumetricFlowM3s / actualAreaM2) * 1000) / 1000;
    velocityRatioVt = Math.round((actualGasVelocityMs / vt) * 100) / 100;

    const litersPerMeterHeight = actualAreaM2 * 1000;

    sumpHeightMm = 150;
    lllElevationMm = sumpHeightMm;

    workingHeightMm = 300;
    nllElevationMm = lllElevationMm + Math.round(workingHeightMm * 0.5);
    hllElevationMm = lllElevationMm + workingHeightMm;
    hhllElevationMm = hllElevationMm + 100;

    workingVolumeLiters = Math.round((workingHeightMm / 1000) * litersPerMeterHeight * 10) / 10;

    fillTimeHours = Math.round((workingVolumeLiters / Math.max(0.01, condensateLitersPerHour)) * 10) / 10;
    isContinuousDrainRequired = fillTimeHours < 12 || config.drainMode === 'continuous_loop_seal';

    inletElevationMm = hhllElevationMm + 200;
    disengagementHeightMm = Math.max(600, Math.round(1.2 * selectedDiameterMm));
    demisterBottomElevationMm = inletElevationMm + disengagementHeightMm;
    topFreeboardHeightMm = Math.max(200, Math.round(0.6 * selectedDiameterMm));

    tanToTanHeightMm = demisterBottomElevationMm + demisterThicknessMm + topFreeboardHeightMm;
    vesselLengthMm = tanToTanHeightMm;
    ldRatio = Math.round((tanToTanHeightMm / selectedDiameterMm) * 10) / 10;
    const legHeightMm = 650;
    overallHeightMm = tanToTanHeightMm + 2 * headHeightMm + legHeightMm;

    const n1Inlet = calcNozzle('Inlet Biogas Campuran', 'N1', actualVolumetricFlowM3s, 8.0, inletElevationMm);
    n1Inlet.notes = `Dilengkapi ${config.inletDeflectorType === '45deg_baffle' ? 'Plat Deflektor 45°' : 'Half-Pipe Baffle'} untuk separasi awal curah`;

    const n2Outlet = calcNozzle('Clean Gas Outlet ke Flare/FA', 'N2', actualVolumetricFlowM3s, 8.0, tanToTanHeightMm + headHeightMm);
    n2Outlet.notes = 'Terletak di puncak bejana di atas Wire Mesh Demister';

    const n3Drain: SeparatorNozzleItem = {
      tag: 'N3',
      service: 'Liquid Drain ke Loop Seal',
      nominalSizeInch: '2"',
      sizeMm: 50,
      elevationMm: -headHeightMm,
      velocityMs: 0.1,
      notes: 'Dilengkapi Vortex Breaker silang & tersambung ke U-Loop Seal',
    };

    const n4Manway: SeparatorNozzleItem = {
      tag: 'N4',
      service: 'Handhole / Inspeksi Mesh',
      nominalSizeInch: selectedDiameterMm >= 400 ? '16" Manway' : '8" Handhole',
      sizeMm: selectedDiameterMm >= 400 ? 400 : 200,
      elevationMm: inletElevationMm + Math.round(disengagementHeightMm * 0.5),
      velocityMs: 0,
      notes: 'Akses inspeksi visual, pembersihan deposit kerak kondensat & mesh',
    };

    const n5Bridle: SeparatorNozzleItem = {
      tag: 'N5A/B',
      service: 'Level Gauge / Bridle Tap',
      nominalSizeInch: '1"',
      sizeMm: 25,
      elevationMm: lllElevationMm,
      velocityMs: 0,
      notes: 'Koneksi Sight Glass / Level Transmitter (rentang LLL ke HHLL)',
    };

    const n6Pressure: SeparatorNozzleItem = {
      tag: 'N6',
      service: 'Pressure Gauge / Tap mbar',
      nominalSizeInch: '1/2"',
      sizeMm: 15,
      elevationMm: demisterBottomElevationMm + demisterThicknessMm + 100,
      velocityMs: 0,
      notes: 'Indikator tekanan diferensial (dP) demister pad untuk deteksi fouling',
    };

    nozzles = [n1Inlet, n2Outlet, n3Drain, n4Manway, n5Bridle, n6Pressure];
  }

  const n1Inlet = nozzles[0];
  const n2Outlet = nozzles[1];

  // Pressure Drop Estimation (in mbar):
  const inletDropMbar = Math.round((1.5 * 0.5 * gasDensity * Math.pow(n1Inlet.velocityMs, 2) * 0.01) * 100) / 100;
  const demisterDropMbar = Math.round((0.12 * Math.pow(Math.max(0.3, actualGasVelocityMs), 1.6)) * 100) / 100;
  const outletDropMbar = Math.round((1.0 * 0.5 * gasDensity * Math.pow(n2Outlet.velocityMs, 2) * 0.01) * 100) / 100;
  const totalDropMbar = Math.round((inletDropMbar + demisterDropMbar + outletDropMbar) * 100) / 100;
  const isPressureDropPass = totalDropMbar <= config.budgetPressureDropMbar;

  const isVelocityPass = actualGasVelocityMs <= allowableGasVelocityMs;

  const criteria: SeparatorCriteriaResult[] = [
    {
      id: 1,
      criteriaName:
        orientation === 'horizontal'
          ? 'Kecepatan Gas Horizontal vs Waktu Jatuh Tetes 300 µm'
          : 'Kecepatan Gas Naik vs Kecepatan Terminal Tetes 300 µm',
      sourceCode: '[S]',
      acceptanceLimit:
        orientation === 'horizontal'
          ? `v_gas ≤ v_allow (${allowableGasVelocityMs} m/s) agar tetes 300 µm mengendap sepanjang L=${vesselLengthMm} mm [S/P]`
          : `v_gas ≤ v_t (${vt} m/s). Rekomendasi ≤ ${config.surgeMarginFactor} v_t (${allowableGasVelocityMs} m/s) [P]`,
      calculatedValue:
        orientation === 'horizontal'
          ? `v_gas = ${actualGasVelocityMs} m/s (${velocityRatioVt}x v_allow). ID min = ${minDiameterMm} mm, Terpilih = ${selectedDiameterMm}×${vesselLengthMm} mm`
          : `v_gas = ${actualGasVelocityMs} m/s (${velocityRatioVt} v_t). ID min = ${minDiameterMm} mm, Terpilih = ${selectedDiameterMm} mm`,
      status: isVelocityPass ? 'OK' : 'WARNING',
      explanation: isVelocityPass
        ? orientation === 'horizontal'
          ? `Tetesan ≥300 µm sempat jatuh ke zona cair sebelum mencapai outlet N2 pada L/D=${ldRatio}.`
          : `Lolos kriteria API 521 / AIChE dengan cadangan lonjakan ${Math.round((1 - velocityRatioVt) * 100)}%. Tetesan ≥300 µm jatuh gravitasi.`
        : `Kecepatan gas melebihi batas desain (${allowableGasVelocityMs} m/s). Naikkan diameter bejana (atau panjang L untuk horizontal).`,
    },
    {
      id: 2,
      criteriaName: 'Pressure Drop Total Separator',
      sourceCode: '[P]',
      acceptanceLimit: `≤ ${config.budgetPressureDropMbar} mbar (alokasi budget tekanan sistem mbar)`,
      calculatedValue: `ΔP total = ${totalDropMbar} mbar (Inlet: ${inletDropMbar} mbar, Demister: ${demisterDropMbar} mbar, Outlet: ${outletDropMbar} mbar)`,
      status: isPressureDropPass ? 'OK' : 'WARNING',
      explanation: isPressureDropPass
        ? `Memenuhi budget tekanan mbar. Margin tekanan flare tip terjaga aman.`
        : `Pressure drop melebihi budget ${config.budgetPressureDropMbar} mbar. Naikkan ukuran nozzle inlet/outlet.`,
    },
    {
      id: 3,
      criteriaName: 'Tinggi Seal Drain (U-Loop Seal)',
      sourceCode: '[P]',
      acceptanceLimit: `Tinggi seal ≥ P_max digester (${config.maxDigesterPressureMmWc} mmWC) × 1.5 = ${minSealHeightMmWc} mmWC [P]`,
      calculatedValue: `Tinggi disediakan = ${providedSealHeightMmWc} mmWC (dengan proteksi anti-siphon & make-up port)`,
      status: sealStatus === 'OK' ? 'OK' : 'FAIL',
      explanation:
        sealStatus === 'OK'
          ? `Tinggi seal ${providedSealHeightMmWc} mmWC > ${minSealHeightMmWc} mmWC minimum. Gas tidak akan blow-through saat digester mencapai set PRV.`
          : `Tinggi seal tidak mencukupi! Risiko blow-through gas buang ke saluran drain terbuka.`,
    },
    {
      id: 4,
      criteriaName: 'Kapasitas Tampung Cairan & Kebijakan Drain',
      sourceCode: '[P]',
      acceptanceLimit: `Volume LLL-HLL ≥ laju kondensat × interval drain. Drain kontinu via loop seal jika akumulasi tinggi [P]`,
      calculatedValue: `Vol LLL-HLL = ${workingVolumeLiters} L. Laju kondensat: ${config.condensateRateLitersPerDay} L/hari. Waktu isi = ${fillTimeHours} jam.`,
      status: isContinuousDrainRequired ? 'WARNING' : 'OK',
      explanation:
        `Dengan kondensat puncak ±${config.condensateRateLitersPerDay} L/hari dan volume kerja ${workingVolumeLiters} L, sump terisi dalam ±${fillTimeHours} jam. ` +
        `Drain WAJIB KONTINU lewat U-loop seal ke saluran IPAL dengan jadwal pengisian ulang seal (HAZID: seal kering → bocor gas!).`,
    },
    {
      id: 5,
      criteriaName: 'Geometri Ruang Pemisahan & Internal Baffle',
      sourceCode: '[P]',
      acceptanceLimit:
        orientation === 'horizontal'
          ? `Ruang uap atas ≥65% tinggi ID, inlet terpisah jauh dari outlet (L=${vesselLengthMm} mm), deflector & demister terpasang [P]`
          : `Inlet di atas HLL, outlet di puncak, tinggi disengagement memadai, inlet dilengkapi deflector [P]`,
      calculatedValue:
        orientation === 'horizontal'
          ? `Orientasi Horizontal ID ${selectedDiameterMm}×${vesselLengthMm} mm (L/D=${ldRatio}). HLL +${hllElevationMm} mm. Demister di bawah N2.`
          : `Inlet N1 = +${inletElevationMm} mm (di atas HHLL +${hhllElevationMm} mm). Disengagement = ${disengagementHeightMm} mm. Plat deflektor terpasang.`,
      status: 'OK',
      explanation: `Desain ${orientation === 'horizontal' ? 'Horizontal KO Drum' : 'Vertical KO Pot'} memenuhi kaidah engineering separasi dua fasa dengan proteksi entrainment & demister.`,
    },
  ];

  return {
    orientation,
    gasDensityKgM3: Math.round(gasDensity * 1000) / 1000,
    actualVolumetricFlowM3h: Math.round(actualVolumetricFlowM3h * 10) / 10,
    actualVolumetricFlowM3s: Math.round(actualVolumetricFlowM3s * 1000) / 1000,

    dropletDiameterM,
    terminalVelocityMs: vt,
    reynoldsNumber: re,
    dragCoefficient: cd,
    allowableGasVelocityMs,

    minCrossSectionalAreaM2: Math.round(minCrossSectionalAreaM2 * 1000) / 1000,
    minDiameterMm,
    selectedDiameterMm,
    vesselLengthMm,
    ldRatio,
    actualGasVelocityMs,
    velocityRatioVt,

    sumpHeightMm,
    workingHeightMm,
    workingVolumeLiters,
    disengagementHeightMm,
    inletElevationMm,
    demisterBottomElevationMm,
    demisterThicknessMm,
    topFreeboardHeightMm,
    tanToTanHeightMm,
    overallHeightMm,

    lllElevationMm,
    nllElevationMm,
    hllElevationMm,
    hhllElevationMm,

    fillTimeHours,
    isContinuousDrainRequired,

    minSealHeightMmWc,
    providedSealHeightMmWc,
    sealStatus,

    inletDropMbar,
    demisterDropMbar,
    outletDropMbar,
    totalDropMbar,
    isPressureDropPass,

    nozzles,
    criteria,
  };
}

/**
 * Generate 2D Heat Radiation vs Ground Distance Curve points
 * across Downwind, Crosswind, and Upwind directions
 */
export function calculateRadiationDistanceProfile(
  flame: FlameGeometry,
  stack: FlareStackConfig,
  env: EnvironmentConditions,
  maxDistanceM: number = 200,
  stepM: number = 2
): RadiationDistancePoint[] {
  const points: RadiationDistancePoint[] = [];
  const qRadKw = flame.radiatedPowerMw * 1000;
  const fc = flame.flameCenterCoords;
  const yawRad = (flame.flameYawDeg * Math.PI) / 180;
  const solarKw = env.solarRadiation;

  for (let d = 1; d <= maxDistanceM; d += stepM) {
    // 1. Downwind point (in the direction flame is tilted)
    const downwindX = stack.locationX + d * Math.sin(yawRad);
    const downwindY = stack.locationY + d * Math.cos(yawRad);
    const distDownwind = Math.sqrt(
      Math.pow(downwindX - fc.x, 2) + Math.pow(downwindY - fc.y, 2) + Math.pow(fc.z, 2)
    );
    const tauDown = calculateTransmissivity(distDownwind, env.relativeHumidity);
    const flareDownKw = (tauDown * qRadKw) / (4 * Math.PI * Math.pow(Math.max(2, distDownwind), 2));
    const totalDownKw = flareDownKw + solarKw;

    // 2. Crosswind point (90 degrees to wind)
    const crosswindX = stack.locationX + d * Math.cos(yawRad);
    const crosswindY = stack.locationY - d * Math.sin(yawRad);
    const distCross = Math.sqrt(
      Math.pow(crosswindX - fc.x, 2) + Math.pow(crosswindY - fc.y, 2) + Math.pow(fc.z, 2)
    );
    const tauCross = calculateTransmissivity(distCross, env.relativeHumidity);
    const flareCrossKw = (tauCross * qRadKw) / (4 * Math.PI * Math.pow(Math.max(2, distCross), 2));
    const totalCrossKw = flareCrossKw + solarKw;

    // 3. Upwind point (opposite to wind direction)
    const upwindX = stack.locationX - d * Math.sin(yawRad);
    const upwindY = stack.locationY - d * Math.cos(yawRad);
    const distUp = Math.sqrt(
      Math.pow(upwindX - fc.x, 2) + Math.pow(upwindY - fc.y, 2) + Math.pow(fc.z, 2)
    );
    const tauUp = calculateTransmissivity(distUp, env.relativeHumidity);
    const flareUpKw = (tauUp * qRadKw) / (4 * Math.PI * Math.pow(Math.max(2, distUp), 2));
    const totalUpKw = flareUpKw + solarKw;

    points.push({
      distanceM: d,
      totalDownwindKw: Math.round(totalDownKw * 100) / 100,
      flareDownwindKw: Math.round(flareDownKw * 100) / 100,
      totalCrosswindKw: Math.round(totalCrossKw * 100) / 100,
      totalUpwindKw: Math.round(totalUpKw * 100) / 100,
      solarKw: Math.round(solarKw * 100) / 100,
    });
  }

  return points;
}

