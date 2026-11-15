import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { LeafletFlareMap, LeafletTileMode } from './LeafletFlareMap';
import {
  SimulationResults,
  FlareStackConfig,
  EnvironmentConditions,
  Receptor,
} from '../types/flaresim';
import {
  calculateRadiationDistanceProfile,
  DEFAULT_ORIGIN_LAT,
  DEFAULT_ORIGIN_LNG,
  localMetersToLatLng,
} from '../utils/flareCalculations';
import {
  Flame,
  Wind,
  Maximize2,
  Eye,
  RotateCcw,
  Volume2,
  Radio,
  Layers,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  TrendingUp,
  Sun,
  CheckCircle2,
  AlertTriangle,
  Info,
  Globe,
  Crosshair,
} from 'lucide-react';

interface Step4Simulation3DProps {
  results: SimulationResults;
  stack: FlareStackConfig;
  env: EnvironmentConditions;
  receptors: Receptor[];
  unitSystem: 'SI' | 'Field';
  onNext: () => void;
  onPrev: () => void;
}

export const Step4Simulation3D: React.FC<Step4Simulation3DProps> = ({
  results,
  stack,
  env,
  receptors,
  unitSystem,
  onNext,
  onPrev,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d' | 'graph'>('3d');
  const [showIsopleths3D, setShowIsopleths3D] = useState(true);
  const [selectedReceptorId, setSelectedReceptorId] = useState<string | null>(null);

  // 2D Radar Top-Down OpenStreetMap / Leaflet states
  const originLat = stack.originLat ?? DEFAULT_ORIGIN_LAT;
  const originLng = stack.originLng ?? DEFAULT_ORIGIN_LNG;
  const stackLatLng = useMemo(
    () => localMetersToLatLng(stack.locationX, stack.locationY, originLat, originLng),
    [stack.locationX, stack.locationY, originLat, originLng]
  );
  const [radarBgMode, setRadarBgMode] = useState<'osm' | 'schematic'>('osm');
  const [radarTileMode, setRadarTileMode] = useState<LeafletTileMode>('osm');
  const [radarMapCenter, setRadarMapCenter] = useState<{ lat: number; lng: number }>(stackLatLng);
  const [radarFocusTrigger, setRadarFocusTrigger] = useState<number>(0);
  const [radarInfoId, setRadarInfoId] = useState<string | null>(null);

  useEffect(() => {
    setRadarMapCenter(stackLatLng);
  }, [stackLatLng.lat, stackLatLng.lng]);

  // 2D Radiation Graph interactive states
  const [graphMaxDistance, setGraphMaxDistance] = useState<number>(150);
  const [showDownwind, setShowDownwind] = useState<boolean>(true);
  const [showCrosswind, setShowCrosswind] = useState<boolean>(true);
  const [showUpwind, setShowUpwind] = useState<boolean>(true);
  const [showFlareOnly, setShowFlareOnly] = useState<boolean>(true);
  const [showSolar, setShowSolar] = useState<boolean>(true);
  const [showLimits, setShowLimits] = useState<boolean>(true);
  const [showReceptorPoints, setShowReceptorPoints] = useState<boolean>(true);
  const [hoveredPointDistance, setHoveredPointDistance] = useState<number | null>(null);

  const { flame, isopleths, noise85Radius, flameoutHazardDistanceM, hazardousArea } = results;

  // Calculated profile curve of heat radiation vs ground distance
  const radiationDistanceProfile = useMemo(() => {
    return calculateRadiationDistanceProfile(flame, stack, env, graphMaxDistance, 2);
  }, [flame, stack, env, graphMaxDistance]);

  // 3D Scene Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Orbit state
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const orbitAngleRef = useRef({ theta: 0.8, phi: 0.65, radius: 180 });

  // Initialize and update Three.js scene
  useEffect(() => {
    if (viewMode !== '3d' || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = Math.max(480, container.clientHeight || 520);

    // Create Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    // Create Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1500);
    cameraRef.current = camera;

    // Helper to position camera from spherical coords
    const updateCameraPos = () => {
      const { theta, phi, radius } = orbitAngleRef.current;
      const x = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.cos(theta);
      camera.position.set(x, Math.max(10, y), z);
      camera.lookAt(0, stack.stackHeight * 0.45, 0);
    };
    updateCameraPos();

    // Create WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current = renderer;

    // Clear previous children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404859, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
    dirLight.position.set(100, 150, 80);
    scene.add(dirLight);

    // Ground Grid & Concentric Rings
    const gridHelper = new THREE.GridHelper(300, 30, 0x1e293b, 0x0f172a);
    scene.add(gridHelper);

    // Concentric distance circles on ground (50m, 100m, 150m)
    [50, 100, 150, 200].forEach((r) => {
      const ringGeo = new THREE.RingGeometry(r - 0.4, r + 0.4, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x334155,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
    });

    // Flare Stack Tower
    const stackH = stack.stackHeight;
    const stackR = Math.max(0.4, stack.stackDiameter / 2);
    const stackGeo = new THREE.CylinderGeometry(stackR * 0.9, stackR * 1.1, stackH, 24);
    const stackMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.6,
      roughness: 0.35,
    });
    const stackMesh = new THREE.Mesh(stackGeo, stackMat);
    stackMesh.position.set(stack.locationX, stackH / 2, stack.locationY);
    scene.add(stackMesh);

    // Concrete Base Ring
    const baseGeo = new THREE.CylinderGeometry(stackR * 2.8, stackR * 3.2, 2, 24);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(stack.locationX, 1, stack.locationY);
    scene.add(baseMesh);

    // Support Structures: Guyed or Derrick
    if (stack.supportType === 'derrick') {
      const trussGroup = new THREE.Group();
      const trussLevels = Math.floor(stackH / 10);
      const baseSpread = Math.max(4, stackH * 0.12);

      for (let i = 0; i < trussLevels; i++) {
        const y1 = i * 10;
        const y2 = (i + 1) * 10;
        const s1 = baseSpread * (1 - (i / trussLevels) * 0.65);
        const s2 = baseSpread * (1 - ((i + 1) / trussLevels) * 0.65);

        // 4 leg lines
        const legMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });
        const corners = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ];

        corners.forEach(([cx, cz]) => {
          const pts = [
            new THREE.Vector3(cx * s1, y1, cz * s1),
            new THREE.Vector3(cx * s2, y2, cz * s2),
          ];
          const legGeo = new THREE.BufferGeometry().setFromPoints(pts);
          trussGroup.add(new THREE.Line(legGeo, legMat));
        });
      }
      trussGroup.position.set(stack.locationX, 0, stack.locationY);
      scene.add(trussGroup);
    } else if (stack.supportType === 'guyed') {
      // 3 Guy wire sets to ground anchors at 120 deg
      const guyMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
      const anchorRadius = stackH * 0.75;
      [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].forEach((angle) => {
        const ax = stack.locationX + anchorRadius * Math.sin(angle);
        const az = stack.locationY + anchorRadius * Math.cos(angle);
        const guyPts = [
          new THREE.Vector3(stack.locationX, stackH * 0.85, stack.locationY),
          new THREE.Vector3(ax, 0, az),
        ];
        const guyGeo = new THREE.BufferGeometry().setFromPoints(guyPts);
        scene.add(new THREE.Line(guyGeo, guyMat));

        // Anchor block
        const ancGeo = new THREE.BoxGeometry(2, 1, 2);
        const ancMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
        const ancMesh = new THREE.Mesh(ancGeo, ancMat);
        ancMesh.position.set(ax, 0.5, az);
        scene.add(ancMesh);
      });
    }

    // Flare Tip (Burner Rim)
    const tipGeo = new THREE.CylinderGeometry(stackR * 1.3, stackR * 1.1, 3, 24);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2,
    });
    const tipMesh = new THREE.Mesh(tipGeo, tipMat);
    tipMesh.position.set(stack.locationX, stackH + 1.5, stack.locationY);
    scene.add(tipMesh);

    // FLAME GEOMETRY (Deflected Cone by wind tilt & yaw)
    const flameL = flame.flameLength;
    const flameBaseR = Math.max(0.8, stackR * 1.2);
    const flameTopR = flameL * 0.15;

    // Create custom flame cone
    const flameConeGeo = new THREE.ConeGeometry(flameTopR, flameL, 24, 8, true);
    // translate so origin is at the base
    flameConeGeo.translate(0, flameL / 2, 0);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const flameMesh = new THREE.Mesh(flameConeGeo, flameMat);

    // Core inner flame (yellow-white)
    const innerFlameGeo = new THREE.ConeGeometry(flameTopR * 0.5, flameL * 0.75, 16);
    innerFlameGeo.translate(0, (flameL * 0.75) / 2, 0);
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffec99,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const innerFlameMesh = new THREE.Mesh(innerFlameGeo, innerFlameMat);

    const flameGroup = new THREE.Group();
    flameGroup.add(flameMesh);
    flameGroup.add(innerFlameMesh);

    // Flame Point Light
    const flameLight = new THREE.PointLight(0xff6600, 3.5, flameL * 3.5);
    flameLight.position.set(0, flameL * 0.45, 0);
    flameGroup.add(flameLight);

    // Apply tilt and yaw rotation
    const tiltRad = (flame.flameTiltDeg * Math.PI) / 180;
    const yawRad = (flame.flameYawDeg * Math.PI) / 180;

    flameGroup.position.set(stack.locationX, stackH + 3, stack.locationY);
    flameGroup.rotation.order = 'YXZ';
    flameGroup.rotation.y = yawRad;
    flameGroup.rotation.z = -tiltRad;

    scene.add(flameGroup);

    // Flame Radiation Center Marker
    const fcGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const fcMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const fcMesh = new THREE.Mesh(fcGeo, fcMat);
    fcMesh.position.set(
      flame.flameCenterCoords.x,
      flame.flameCenterCoords.z, // Three.js Y is UP
      flame.flameCenterCoords.y
    );
    scene.add(fcMesh);

    // Hazardous Area Zone 1 & Zone 2 Ground Rings (IEC 60079-10-1 / API RP 505)
    const addGroundHazardRing = (radiusM: number, colorHex: number, thickness: number, opacity: number) => {
      const rInner = Math.max(0.5, radiusM - thickness / 2);
      const rOuter = radiusM + thickness / 2;
      const hzGeo = new THREE.RingGeometry(rInner, rOuter, 64);
      const hzMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
      });
      const hzMesh = new THREE.Mesh(hzGeo, hzMat);
      hzMesh.rotation.x = Math.PI / 2;
      hzMesh.position.set(stack.locationX, 0.15, stack.locationY);
      scene.add(hzMesh);

      const discGeo = new THREE.CircleGeometry(radiusM, 64);
      const discMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: opacity * 0.06,
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.rotation.x = Math.PI / 2;
      discMesh.position.set(stack.locationX, 0.1, stack.locationY);
      scene.add(discMesh);
    };

    addGroundHazardRing(hazardousArea.zone1RadiusM, 0xef4444, 0.9, 0.85);
    addGroundHazardRing(hazardousArea.zone2RadiusM, 0xf59e0b, 0.9, 0.75);

    // Helper to create floating 3D coordinate sprite label
    const makeCoordSprite = (title: string, coordText: string, borderColor: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title.slice(0, 24), canvas.width / 2, 38);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 21px monospace';
        ctx.fillText(coordText, canvas.width / 2, 72);
      }
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(26, 7, 1);
      return sprite;
    };

    // Flare Stack coordinate label at base/mid
    const stackSprite = makeCoordSprite(
      `Flare Stack (H=${stack.stackHeight}m)`,
      `(X:${stack.locationX}, Y:${stack.locationY}, Z:0m)`,
      '#f59e0b'
    );
    stackSprite.position.set(stack.locationX, Math.max(8, stack.stackHeight * 0.25), stack.locationY);
    scene.add(stackSprite);

    // Receptors in 3D
    receptors.forEach((rec) => {
      const recRes = results.receptors.find((r) => r.receptor.id === rec.id);
      const isPass = recRes ? recRes.isRadiationPass && recRes.isNoisePass : true;
      const col = isPass ? 0x10b981 : 0xef4444;
      const hexBorder = isPass ? '#10b981' : '#ef4444';

      const recGroup = new THREE.Group();

      // Stem from ground to elevation Z
      const stemH = Math.max(1, rec.z);
      const stemGeo = new THREE.CylinderGeometry(0.3, 0.3, stemH, 8);
      const stemMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = stemH / 2;
      recGroup.add(stem);

      // Beacon Sphere at Z
      const beaconGeo = new THREE.SphereGeometry(1.4, 16, 16);
      const beaconMat = new THREE.MeshBasicMaterial({ color: col });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = stemH;
      recGroup.add(beacon);

      // Pulse Ring
      const ringGeo = new THREE.RingGeometry(1.8, 2.4, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: col,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      const pulseRing = new THREE.Mesh(ringGeo, ringMat);
      pulseRing.rotation.x = Math.PI / 2;
      pulseRing.position.y = stemH;
      recGroup.add(pulseRing);

      // 3D Floating Coordinate Label Sprite
      const labelSprite = makeCoordSprite(
        rec.name.split(' ')[0],
        `(${rec.x}, ${rec.y}, +${rec.z}m)`,
        hexBorder
      );
      labelSprite.position.y = stemH + 6.5;
      recGroup.add(labelSprite);

      // Coordinates: Three.js (X, Y, Z) = (rec.x, rec.z, rec.y)
      recGroup.position.set(rec.x, 0, rec.y);
      scene.add(recGroup);
    });

    // 3D Radiation Isopleth Shells centered at the Flame Radiation Center (top of stack/flame)
    if (showIsopleths3D) {
      const fcY = flame.flameCenterCoords.z;
      isopleths.forEach((iso) => {
        if (iso.radius3d > 1 && iso.radius3d < 260) {
          // Clip sphere at ground plane (y = 0) when radius3d > flameCenterCoords.z
          const thetaMax =
            iso.radius3d > fcY
              ? Math.acos(Math.max(-1, Math.min(1, -fcY / iso.radius3d)))
              : Math.PI;

          const isoGeo = new THREE.SphereGeometry(
            iso.radius3d,
            24,
            14,
            0,
            Math.PI * 2,
            0,
            thetaMax
          );
          const isoMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(iso.color),
            transparent: true,
            opacity: iso.reachesGround ? 0.08 : 0.14,
            wireframe: true,
            side: THREE.DoubleSide,
          });
          const isoMesh = new THREE.Mesh(isoGeo, isoMat);
          isoMesh.position.set(
            flame.flameCenterCoords.x,
            fcY, // Centered at flame radiation center in the air!
            flame.flameCenterCoords.y
          );
          scene.add(isoMesh);
        }

        // Ground-level footprint ring ONLY if this radiation level reaches ground (z = 0)
        if (iso.reachesGround && iso.radiusCrosswind > 1 && iso.radiusCrosswind < 260) {
          const gRingGeo = new THREE.RingGeometry(
            Math.max(0.5, iso.radiusCrosswind - 0.5),
            iso.radiusCrosswind + 0.5,
            64
          );
          const gRingMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(iso.color),
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
          });
          const gRingMesh = new THREE.Mesh(gRingGeo, gRingMat);
          gRingMesh.rotation.x = Math.PI / 2;
          gRingMesh.position.set(
            flame.flameCenterCoords.x,
            0.22,
            flame.flameCenterCoords.y
          );
          scene.add(gRingMesh);
        }
      });
    }

    // Mouse Interaction Handlers for Camera Orbit
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };

      orbitAngleRef.current.theta += dx * 0.008;
      orbitAngleRef.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.05, orbitAngleRef.current.phi - dy * 0.008)
      );
      updateCameraPos();
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitAngleRef.current.radius = Math.max(
        30,
        Math.min(450, orbitAngleRef.current.radius + e.deltaY * 0.15)
      );
      updateCameraPos();
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domEl.addEventListener('wheel', handleWheel, { passive: false });

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Subtle dynamic flame flicker & pulse
      const flicker = 1.0 + Math.sin(elapsed * 9) * 0.04 + Math.cos(elapsed * 15) * 0.02;
      flameGroup.scale.set(flicker, flicker, flicker);

      renderer.render(scene, camera);
    };
    animate();

    // Window Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = Math.max(480, mountRef.current.clientHeight || 520);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [viewMode, stack, flame, receptors, isopleths, showIsopleths3D, hazardousArea, results.receptors]);

  // Reset 3D Camera View
  const handleResetCamera = () => {
    orbitAngleRef.current = { theta: 0.8, phi: 0.65, radius: 180 };
    if (cameraRef.current) {
      const { theta, phi, radius } = orbitAngleRef.current;
      const x = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.position.set(x, y, z);
      cameraRef.current.lookAt(0, stack.stackHeight * 0.45, 0);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <h2 className="text-base font-bold text-slate-100">
                Tahap 4: Eksekusi Simulasi 3D Flaresim & Peta Kontur Radiasi (Isopleth)
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              Solver memodelkan bentuk tiga dimensi nyala api dengan sudut kemiringan (flame tilt) akibat kecepatan angin ({env.windSpeed} m/s) dan arah ({env.windDirection}°). Evaluasi sebaran zona panas termal, kebisingan akustik, dan dispersi gas.
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  viewMode === '3d'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Model 3D Spasial</span>
              </button>
              <button
                onClick={() => setViewMode('2d')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  viewMode === '2d'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Peta Radar 2D (Isopleth)</span>
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  viewMode === 'graph'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Grafik 2D Radiasi vs Jarak</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas + Control Overlay */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Canvas Area (8 cols) */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative shadow-inner min-h-[500px]">
          {viewMode === '3d' ? (
            <>
              {/* Three.js Container */}
              <div
                ref={mountRef}
                className="w-full h-[520px] cursor-grab active:cursor-grabbing"
              />

              {/* 3D Floating Action Tools */}
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                <button
                  onClick={() => setShowIsopleths3D(!showIsopleths3D)}
                  className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border backdrop-blur transition-colors ${
                    showIsopleths3D
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-900/80 text-slate-400 border-slate-700'
                  }`}
                  title="Toggle 3D Isopleth hemispherical wireframe contours"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Kubah Isopleth 3D</span>
                </button>

                <button
                  onClick={handleResetCamera}
                  className="p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg backdrop-blur"
                  title="Reset Posisi Kamera"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 3D Top-Left Coordinate Quick Reference Overlay */}
              <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-2.5 text-[10px] space-y-1 z-10 max-w-[275px] max-h-[215px] overflow-y-auto">
                <div className="font-bold text-amber-400 border-b border-slate-800 pb-1 flex items-center justify-between gap-2">
                  <span>Koordinat Reseptor (X, Y, Z)</span>
                  <span className="text-slate-400 font-mono">Stack: ({stack.locationX},{stack.locationY})</span>
                </div>
                {results.receptors.map((r) => (
                  <div
                    key={r.receptor.id}
                    onClick={() => setSelectedReceptorId(r.receptor.id)}
                    className={`flex items-center justify-between gap-2 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      selectedReceptorId === r.receptor.id ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="truncate font-medium text-slate-200 max-w-[110px]">
                      {r.receptor.name}
                    </span>
                    <span className="font-mono text-sky-300 whitespace-nowrap">
                      ({r.receptor.x}, {r.receptor.y}, +{r.receptor.z}m)
                    </span>
                    <span
                      className={`font-mono font-bold px-1 rounded text-[9px] ${
                        r.hazardousZone === 'Zone 1'
                          ? 'bg-rose-950 text-rose-300'
                          : r.hazardousZone === 'Zone 2'
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {r.hazardousZone === 'Non-Hazardous' ? 'SAFE' : r.hazardousZone}
                    </span>
                  </div>
                ))}
              </div>

              {/* 3D Legend & Compass Overlay */}
              <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur border border-slate-800 rounded-lg p-2.5 text-[11px] space-y-1 z-10 pointer-events-none">
                <div className="flex items-center gap-2 text-slate-200 font-semibold mb-1">
                  <Wind className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    Angin: {env.windSpeed} m/s dari {env.windDirection}°
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Patuh (Aman)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Melebihi Batas
                  </span>
                  <span className="flex items-center gap-1 text-rose-300">
                    <span className="w-2.5 h-0.5 bg-rose-500"></span>
                    Zone 1 ({hazardousArea.zone1RadiusM}m)
                  </span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <span className="w-2.5 h-0.5 bg-amber-500"></span>
                    Zone 2 ({hazardousArea.zone2RadiusM}m)
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 pt-0.5">
                  Klik & geser untuk rotasi 3D · Scroll untuk zoom
                </div>
              </div>
            </>
          ) : viewMode === '2d' ? (
            /* 2D Plan / Radar View Canvas (Top-Down OpenStreetMap/Leaflet default + CAD SVG toggle) */
            <div className="w-full min-h-[520px] p-3.5 flex flex-col justify-between relative bg-slate-950 gap-2.5">
              {/* Top-Down Radar Sub-Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setRadarBgMode('osm')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded font-semibold transition-colors ${
                        radarBgMode === 'osm'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>OpenStreetMap (Tampak Atas)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRadarBgMode('schematic')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded font-semibold transition-colors ${
                        radarBgMode === 'schematic'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Grid CAD 2D (Skematis)</span>
                    </button>
                  </div>
                </div>

                {radarBgMode === 'osm' && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                      {(
                        [
                          { id: 'osm', label: 'OSM Peta' },
                          { id: 'satellite', label: 'Satelit' },
                          { id: 'dark', label: 'Gelap' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setRadarTileMode(t.id)}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            radarTileMode === t.id
                              ? 'bg-sky-500 text-slate-950 font-bold'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRadarMapCenter(stackLatLng);
                        setRadarFocusTrigger((n) => n + 1);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                      <span>Fokus Stack</span>
                    </button>
                  </div>
                )}
              </div>

              {radarBgMode === 'osm' ? (
                <div className="w-full flex-1 flex flex-col relative">
                  <LeafletFlareMap
                    center={radarMapCenter}
                    zoom={17}
                    tileMode={radarTileMode}
                    heightClass="h-[430px]"
                    stackLatLng={stackLatLng}
                    stackInfo={{
                      locationX: stack.locationX,
                      locationY: stack.locationY,
                      stackHeight: stack.stackHeight,
                      windSpeed: env.windSpeed,
                      windDirection: env.windDirection,
                      flameTiltDeg: flame.flameTiltDeg,
                    }}
                    hazardousArea={{
                      zone1RadiusM: hazardousArea.zone1RadiusM,
                      zone2RadiusM: hazardousArea.zone2RadiusM,
                    }}
                    showHazardousZones={true}
                    noise85RadiusM={noise85Radius}
                    isoplethPolygons={isopleths
                      .filter((iso) => iso.reachesGround && iso.radiusDownwind > 0)
                      .slice()
                      .reverse()
                      .map((iso) => {
                        const yawRad = (flame.flameYawDeg * Math.PI) / 180;
                        const shiftDist = (iso.radiusDownwind - iso.radiusCrosswind) * 0.65;
                        const shiftX = stack.locationX + shiftDist * Math.sin(yawRad);
                        const shiftY = stack.locationY + shiftDist * Math.cos(yawRad);
                        const pts: Array<{ lat: number; lng: number }> = [];
                        const steps = 48;
                        for (let s = 0; s < steps; s++) {
                          const t = (2 * Math.PI * s) / steps;
                          const dAlong = iso.radiusDownwind * Math.cos(t);
                          const dCross = iso.radiusCrosswind * Math.sin(t);
                          const dx = shiftX + dAlong * Math.sin(yawRad) + dCross * Math.cos(yawRad);
                          const dy = shiftY + dAlong * Math.cos(yawRad) - dCross * Math.sin(yawRad);
                          pts.push(
                            localMetersToLatLng(dx - stack.locationX, dy - stack.locationY, originLat, originLng)
                          );
                        }
                        return {
                          levelKw: iso.levelKw,
                          color: iso.color,
                          paths: pts,
                        };
                      })}
                    windLine={(() => {
                      const windRad = (env.windDirection * Math.PI) / 180;
                      const len = Math.max(45, (isopleths[0]?.radiusDownwind ?? 60) * 0.75);
                      const upwindPt = localMetersToLatLng(
                        len * Math.sin(windRad),
                        len * Math.cos(windRad),
                        originLat,
                        originLng
                      );
                      return [upwindPt, stackLatLng];
                    })()}
                    receptors={receptors.map((rec, idx) => {
                      const recGeo = localMetersToLatLng(
                        rec.x - stack.locationX,
                        rec.y - stack.locationY,
                        originLat,
                        originLng
                      );
                      const recRes = results.receptors.find((r) => r.receptor.id === rec.id);
                      const isPass = recRes ? recRes.isRadiationPass && recRes.isNoisePass : true;
                      return {
                        id: rec.id,
                        index: idx + 1,
                        name: rec.name,
                        x: rec.x,
                        y: rec.y,
                        z: rec.z,
                        lat: recGeo.lat,
                        lng: recGeo.lng,
                        radiationKw: recRes?.radiationKw ?? 0,
                        apiLimitKw: rec.apiLimitKw,
                        noiseDba: recRes?.noiseDba ?? 0,
                        isPass,
                        zone: recRes?.hazardousZone ?? 'Non-Hazardous',
                        exRequirement: recRes?.exRequirement ?? 'Safe Area',
                      };
                    })}
                    activePopupId={radarInfoId}
                    onSelectReceptor={(id) => {
                      setRadarInfoId(id);
                      setSelectedReceptorId(id);
                    }}
                    focusTrigger={radarFocusTrigger}
                  />

                  {/* Floating Wind & Isopleth Top-Left Badge */}
                  <div className="absolute top-3 left-14 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 pointer-events-none space-y-0.5 z-20">
                    <div className="font-bold text-sky-300 flex items-center gap-1">
                      <Wind className="w-3 h-3" />
                      <span>Angin {env.windSpeed} m/s dari {env.windDirection}° (Garis Biru)</span>
                    </div>
                    <div className="text-slate-400">
                      OpenStreetMap / Leaflet (Gratis tanpa API Key) · Kontur elips isopleth bawah angin
                    </div>
                  </div>
                </div>
              ) : (
                /* Fallback / Toggleable Schematic SVG 2D Radar Isopleth Map */
                <div className="w-full h-[430px] flex items-center justify-center relative radar-grid rounded-xl border border-slate-900">
                  <svg viewBox="-200 -200 400 400" className="w-full h-full max-h-[420px]">
                    {/* Concentric Reference Grid Circles */}
                    {[50, 100, 150, 180].map((r) => (
                      <circle
                        key={r}
                        cx="0"
                        cy="0"
                        r={r}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                    ))}

                    {/* Compass Axes */}
                    <line x1="-190" y1="0" x2="190" y2="0" stroke="#1e293b" strokeWidth="1" />
                    <line x1="0" y1="-190" x2="0" y2="190" stroke="#1e293b" strokeWidth="1" />
                    <text x="180" y="-5" fill="#64748b" fontSize="10" fontFamily="monospace">T (E)</text>
                    <text x="-195" y="-5" fill="#64748b" fontSize="10" fontFamily="monospace">B (W)</text>
                    <text x="5" y="-180" fill="#64748b" fontSize="10" fontFamily="monospace">U (N)</text>
                    <text x="5" y="190" fill="#64748b" fontSize="10" fontFamily="monospace">S (S)</text>

                    {/* 2D Isopleth Ellipses (Deflected by wind downwind, only levels reaching ground) */}
                    {isopleths
                      .filter((iso) => iso.reachesGround && iso.radiusDownwind > 0)
                      .slice()
                      .reverse()
                      .map((iso) => {
                        const yawRad = (flame.flameYawDeg * Math.PI) / 180;
                        const shiftDist = (iso.radiusDownwind - iso.radiusCrosswind) * 0.7;
                        const shiftX = shiftDist * Math.sin(yawRad);
                        const shiftY = -shiftDist * Math.cos(yawRad);

                        return (
                          <ellipse
                            key={iso.levelKw}
                            cx={shiftX}
                            cy={shiftY}
                            rx={iso.radiusCrosswind}
                            ry={iso.radiusDownwind}
                            fill={iso.color}
                            fillOpacity="0.12"
                            stroke={iso.color}
                            strokeWidth="1.5"
                            transform={`rotate(${flame.flameYawDeg}, ${shiftX}, ${shiftY})`}
                          />
                        );
                      })}

                    {/* Hazardous Area Zone 2 & Zone 1 Boundaries */}
                    <circle
                      cx={stack.locationX}
                      cy={-stack.locationY}
                      r={Math.min(190, hazardousArea.zone2RadiusM)}
                      fill="#f59e0b"
                      fillOpacity="0.08"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                    />
                    <text
                      x={stack.locationX + Math.min(185, hazardousArea.zone2RadiusM) * 0.7}
                      y={-stack.locationY - Math.min(185, hazardousArea.zone2RadiusM) * 0.7}
                      fill="#fbbf24"
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ZONE 2 ({hazardousArea.zone2RadiusM}m)
                    </text>

                    <circle
                      cx={stack.locationX}
                      cy={-stack.locationY}
                      r={Math.min(190, hazardousArea.zone1RadiusM)}
                      fill="#ef4444"
                      fillOpacity="0.18"
                      stroke="#ef4444"
                      strokeWidth="1.8"
                      strokeDasharray="3 2"
                    />
                    <text
                      x={stack.locationX + 4}
                      y={-stack.locationY - hazardousArea.zone1RadiusM - 3}
                      fill="#fca5a5"
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ZONE 1 ({hazardousArea.zone1RadiusM}m)
                    </text>

                    {/* Noise 85 dBA boundary circle */}
                    <circle
                      cx="0"
                      cy="0"
                      r={Math.min(190, noise85Radius)}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.2"
                      strokeDasharray="6 3"
                    />

                    {/* Wind Vector Arrow */}
                    {(() => {
                      const arrowLength = 55;
                      const rad = (env.windDirection * Math.PI) / 180;
                      const x1 = arrowLength * Math.sin(rad);
                      const y1 = -arrowLength * Math.cos(rad);
                      return (
                        <g opacity="0.85">
                          <line
                            x1={x1}
                            y1={y1}
                            x2={0}
                            y2={0}
                            stroke="#38bdf8"
                            strokeWidth="2.5"
                          />
                        </g>
                      );
                    })()}

                    {/* Receptors in 2D with explicit (X, Y, Z) coordinates */}
                    {receptors.map((rec) => {
                      const recRes = results.receptors.find((r) => r.receptor.id === rec.id);
                      const isPass = recRes ? recRes.isRadiationPass && recRes.isNoisePass : true;
                      const col = isPass ? '#10b981' : '#ef4444';
                      const isSelected = selectedReceptorId === rec.id;
                      const svgX = rec.x;
                      const svgY = -rec.y;

                      return (
                        <g
                          key={rec.id}
                          onClick={() => setSelectedReceptorId(rec.id)}
                          className="cursor-pointer group"
                        >
                          <circle
                            cx={svgX}
                            cy={svgY}
                            r={isSelected ? 7.5 : 6}
                            fill={col}
                            stroke={isSelected ? '#fbbf24' : '#ffffff'}
                            strokeWidth={isSelected ? '2.5' : '1.5'}
                          />
                          <circle
                            cx={svgX}
                            cy={svgY}
                            r="12"
                            fill="none"
                            stroke={col}
                            strokeWidth="1"
                            opacity="0.4"
                          />
                          <text
                            x={svgX + 9}
                            y={svgY + 2}
                            fill="#f8fafc"
                            fontSize="8.5"
                            fontWeight="bold"
                            className="pointer-events-none drop-shadow"
                          >
                            {rec.name.split(' ')[0]} ({recRes?.radiationKw.toFixed(1)} kW)
                          </text>
                          <text
                            x={svgX + 9}
                            y={svgY + 11}
                            fill="#38bdf8"
                            fontSize="7.5"
                            fontFamily="monospace"
                            className="pointer-events-none drop-shadow"
                          >
                            X:{rec.x} Y:{rec.y} Z:+{rec.z}m [{recRes?.hazardousZone === 'Non-Hazardous' ? 'SAFE' : recRes?.hazardousZone}]
                          </text>
                        </g>
                      );
                    })}

                    {/* Flare Stack Center Mark */}
                    <circle cx={stack.locationX} cy={-stack.locationY} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                    <text x={stack.locationX + 7} y={-stack.locationY + 3} fill="#fbbf24" fontSize="9.5" fontWeight="bold">
                      Flare Stack ({stack.locationX},{stack.locationY}) H={stack.stackHeight}m
                    </text>
                  </svg>
                </div>
              )}

              {/* 2D Radar Bottom Coordinate & Zone Legend */}
              <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400 pt-1.5 border-t border-slate-800/80">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-rose-300 font-bold">● Zone 1 (Ex d/ia): R ≤ {hazardousArea.zone1RadiusM}m</span>
                  <span className="text-amber-300 font-bold">● Zone 2 (Ex ec): R ≤ {hazardousArea.zone2RadiusM}m</span>
                  <span className="text-sky-300">● Noise 85 dBA: R = {noise85Radius}m</span>
                </div>
                <span>Pusat Stack GPS: {stackLatLng.lat.toFixed(5)}, {stackLatLng.lng.toFixed(5)}</span>
              </div>
            </div>
          ) : (
            /* 2D Cartesian Heat Radiation vs Distance Graph */
            <div className="w-full h-full min-h-[520px] p-4 flex flex-col justify-between bg-slate-950 relative">
              {/* Graph Toolbar & Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800 text-xs">
                {/* Distance Selector */}
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
                  <span className="text-[11px] text-slate-400">Jarak Maks:</span>
                  {[50, 100, 150, 200, 250].map((d) => (
                    <button
                      key={d}
                      onClick={() => setGraphMaxDistance(d)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                        graphMaxDistance === d
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>

                {/* Curve Toggles */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <button
                    onClick={() => setShowDownwind(!showDownwind)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                      showDownwind
                        ? 'bg-orange-950/60 text-orange-300 border-orange-700/60'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <span className="w-2.5 h-1 bg-orange-500 rounded" />
                    <span>Downwind Total</span>
                  </button>

                  <button
                    onClick={() => setShowFlareOnly(!showFlareOnly)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                      showFlareOnly
                        ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <span className="w-2.5 h-0.5 border-t border-dashed border-amber-400" />
                    <span>Flare Murni</span>
                  </button>

                  <button
                    onClick={() => setShowSolar(!showSolar)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                      showSolar
                        ? 'bg-yellow-950/60 text-yellow-300 border-yellow-700/60'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <Sun className="w-3 h-3 text-yellow-400" />
                    <span>Matahari ({env.solarRadiation} kW)</span>
                  </button>

                  <button
                    onClick={() => setShowCrosswind(!showCrosswind)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                      showCrosswind
                        ? 'bg-sky-950/60 text-sky-300 border-sky-700/60'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <span className="w-2.5 h-1 bg-sky-400 rounded" />
                    <span>Crosswind</span>
                  </button>

                  <button
                    onClick={() => setShowUpwind(!showUpwind)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                      showUpwind
                        ? 'bg-teal-950/60 text-teal-300 border-teal-700/60'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <span className="w-2.5 h-1 bg-teal-400 rounded" />
                    <span>Upwind</span>
                  </button>

                  <button
                    onClick={() => setShowLimits(!showLimits)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                      showLimits
                        ? 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <span>Batas API 521</span>
                  </button>

                  <button
                    onClick={() => setShowReceptorPoints(!showReceptorPoints)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                      showReceptorPoints
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <span>Titik Reseptor</span>
                  </button>
                </div>
              </div>

              {/* SVG Cartesian Graph */}
              {(() => {
                const svgW = 760;
                const svgH = 380;
                const pLeft = 55;
                const pTop = 25;
                const pW = 555;
                const pH = 295;
                const yMax = 12; // kW/m²

                const mapX = (d: number) => pLeft + (Math.max(0, Math.min(graphMaxDistance, d)) / graphMaxDistance) * pW;
                const mapY = (kw: number) => pTop + (1 - Math.max(0, Math.min(yMax, kw)) / yMax) * pH;

                // Path builders
                const buildPath = (key: 'totalDownwindKw' | 'flareDownwindKw' | 'totalCrosswindKw' | 'totalUpwindKw') => {
                  if (!radiationDistanceProfile.length) return '';
                  return radiationDistanceProfile
                    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${mapX(pt.distanceM).toFixed(1)} ${mapY(pt[key]).toFixed(1)}`)
                    .join(' ');
                };

                const downwindPath = buildPath('totalDownwindKw');
                const flareOnlyPath = buildPath('flareDownwindKw');
                const crosswindPath = buildPath('totalCrosswindKw');
                const upwindPath = buildPath('totalUpwindKw');

                // Area fill under downwind
                const downwindArea = radiationDistanceProfile.length
                  ? `M ${mapX(0).toFixed(1)} ${mapY(0).toFixed(1)} ` +
                    radiationDistanceProfile.map((pt) => `L ${mapX(pt.distanceM).toFixed(1)} ${mapY(pt.totalDownwindKw).toFixed(1)}`).join(' ') +
                    ` L ${mapX(graphMaxDistance).toFixed(1)} ${mapY(0).toFixed(1)} Z`
                  : '';

                // API 521 Limit values & colors
                const apiLimits = [
                  { val: 1.58, label: '1.58 kW: Akses Bebas/Kontinu', color: '#10b981' },
                  { val: 3.16, label: '3.16 kW: Kerja Rutin (bbrp mnt)', color: '#eab308' },
                  { val: 4.73, label: '4.73 kW: Akses Terbatas (APD)', color: '#f97316' },
                  { val: 6.31, label: '6.31 kW: Evakuasi Darurat (1 mnt)', color: '#ef4444' },
                  { val: 9.46, label: '9.46 kW: Batas Desain Peralatan', color: '#b91c1c' },
                ];

                // Hovered point data lookup
                const hoveredData = hoveredPointDistance !== null
                  ? radiationDistanceProfile.find((p) => Math.abs(p.distanceM - hoveredPointDistance) <= 1) ||
                    radiationDistanceProfile[Math.min(radiationDistanceProfile.length - 1, Math.round(hoveredPointDistance / 2))]
                  : null;

                return (
                  <div className="relative w-full h-[380px] overflow-hidden">
                    <svg
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      className="w-full h-full cursor-crosshair select-none"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clientX = e.clientX - rect.left;
                        const svgScale = svgW / rect.width;
                        const xInSvg = clientX * svgScale;
                        if (xInSvg >= pLeft && xInSvg <= pLeft + pW) {
                          const dist = Math.round(((xInSvg - pLeft) / pW) * graphMaxDistance);
                          setHoveredPointDistance(dist);
                        } else {
                          setHoveredPointDistance(null);
                        }
                      }}
                      onMouseLeave={() => setHoveredPointDistance(null)}
                    >
                      <defs>
                        {/* Area gradient under downwind curve */}
                        <linearGradient id="downwindGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Chart Background */}
                      <rect x={pLeft} y={pTop} width={pW} height={pH} fill="#020617" fillOpacity="0.7" rx="4" />

                      {/* Horizontal Grid lines (kW/m²) */}
                      {[0, 2, 4, 6, 8, 10, 12].map((kw) => (
                        <g key={kw}>
                          <line
                            x1={pLeft}
                            y1={mapY(kw)}
                            x2={pLeft + pW}
                            y2={mapY(kw)}
                            stroke="#1e293b"
                            strokeWidth="1"
                            strokeDasharray={kw === 0 ? undefined : '3 3'}
                          />
                          <text
                            x={pLeft - 8}
                            y={mapY(kw) + 3}
                            fill="#64748b"
                            fontSize="10"
                            textAnchor="end"
                            fontFamily="monospace"
                          >
                            {kw}
                          </text>
                        </g>
                      ))}

                      {/* Vertical Grid lines (Distance in meters) */}
                      {Array.from({ length: 6 }).map((_, idx) => {
                        const dist = Math.round((idx / 5) * graphMaxDistance);
                        return (
                          <g key={dist}>
                            <line
                              x1={mapX(dist)}
                              y1={pTop}
                              x2={mapX(dist)}
                              y2={pTop + pH}
                              stroke="#1e293b"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={mapX(dist)}
                              y={pTop + pH + 16}
                              fill="#64748b"
                              fontSize="10"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              {dist}m
                            </text>
                          </g>
                        );
                      })}

                      {/* Axis Labels */}
                      <text
                        x={pLeft + pW / 2}
                        y={pTop + pH + 34}
                        fill="#94a3b8"
                        fontSize="11"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        Jarak Tanah dari Titik Tiang Suar (Ground Distance dari Flare Stack, meter)
                      </text>
                      <text
                        transform={`rotate(-90)`}
                        x={-(pTop + pH / 2)}
                        y={16}
                        fill="#94a3b8"
                        fontSize="11"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        Intensitas Radiasi Termal Total (kW/m²)
                      </text>

                      {/* API 521 Permissible Limit Lines */}
                      {showLimits &&
                        apiLimits.map((lim) => (
                          <g key={lim.val}>
                            <line
                              x1={pLeft}
                              y1={mapY(lim.val)}
                              x2={pLeft + pW}
                              y2={mapY(lim.val)}
                              stroke={lim.color}
                              strokeWidth="1.2"
                              strokeDasharray="4 4"
                              opacity="0.8"
                            />
                            <rect
                              x={pLeft + pW + 6}
                              y={mapY(lim.val) - 8}
                              width={140}
                              height={16}
                              fill="#0f172a"
                              stroke={lim.color}
                              strokeWidth="0.8"
                              rx="3"
                              opacity="0.9"
                            />
                            <text
                              x={pLeft + pW + 10}
                              y={mapY(lim.val) + 3}
                              fill={lim.color}
                              fontSize="8.5"
                              fontFamily="sans-serif"
                              fontWeight="600"
                            >
                              {lim.label}
                            </text>
                          </g>
                        ))}

                      {/* Solar Baseline Radiation Line */}
                      {showSolar && (
                        <g>
                          <line
                            x1={pLeft}
                            y1={mapY(env.solarRadiation)}
                            x2={pLeft + pW}
                            y2={mapY(env.solarRadiation)}
                            stroke="#eab308"
                            strokeWidth="1.5"
                            strokeDasharray="6 3"
                            opacity="0.9"
                          />
                          <text
                            x={pLeft + 8}
                            y={mapY(env.solarRadiation) - 5}
                            fill="#facc15"
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            ☀ Sinar Matahari (Solar: {env.solarRadiation} kW/m²)
                          </text>
                        </g>
                      )}

                      {/* Area Fill under Downwind */}
                      {showDownwind && downwindArea && (
                        <path d={downwindArea} fill="url(#downwindGrad)" />
                      )}

                      {/* Curves */}
                      {showUpwind && (
                        <path d={upwindPath} fill="none" stroke="#2dd4bf" strokeWidth="1.8" opacity="0.85" />
                      )}
                      {showCrosswind && (
                        <path d={crosswindPath} fill="none" stroke="#38bdf8" strokeWidth="2.0" opacity="0.9" />
                      )}
                      {showFlareOnly && (
                        <path d={flareOnlyPath} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="5 3" opacity="0.85" />
                      )}
                      {showDownwind && (
                        <path d={downwindPath} fill="none" stroke="#f97316" strokeWidth="2.8" />
                      )}

                      {/* Plotted Receptors */}
                      {showReceptorPoints &&
                        receptors.map((rec) => {
                          const dist = Math.round(
                            Math.sqrt(Math.pow(rec.x - stack.locationX, 2) + Math.pow(rec.y - stack.locationY, 2))
                          );
                          if (dist > graphMaxDistance) return null;

                          const rRes = results.receptors.find((r) => r.receptor.id === rec.id);
                          const radKw = rRes ? rRes.radiationKw : 1.0;
                          const isPass = rRes ? rRes.isRadiationPass : true;
                          const ptX = mapX(dist);
                          const ptY = mapY(radKw);
                          const col = isPass ? '#10b981' : '#ef4444';

                          return (
                            <g
                              key={rec.id}
                              className="cursor-pointer group"
                              onClick={() => setSelectedReceptorId(rec.id)}
                            >
                              {!isPass && (
                                <circle
                                  cx={ptX}
                                  cy={ptY}
                                  r="11"
                                  fill="none"
                                  stroke="#ef4444"
                                  strokeWidth="1.5"
                                  className="animate-ping"
                                  opacity="0.6"
                                />
                              )}
                              <circle cx={ptX} cy={ptY} r="5" fill={col} stroke="#ffffff" strokeWidth="1.5" />
                              <text
                                x={ptX}
                                y={ptY - 8}
                                fill="#f8fafc"
                                fontSize="9"
                                fontWeight="bold"
                                textAnchor="middle"
                                className="drop-shadow pointer-events-none"
                              >
                                {rec.name.split(' ')[0]} ({radKw.toFixed(1)})
                              </text>
                            </g>
                          );
                        })}

                      {/* Interactive Hover Crosshair */}
                      {hoveredPointDistance !== null && (
                        <g>
                          <line
                            x1={mapX(hoveredPointDistance)}
                            y1={pTop}
                            x2={mapX(hoveredPointDistance)}
                            y2={pTop + pH}
                            stroke="#f59e0b"
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                          />
                          <circle
                            cx={mapX(hoveredPointDistance)}
                            cy={mapY(hoveredData?.totalDownwindKw || 0)}
                            r="5"
                            fill="#f97316"
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                        </g>
                      )}
                    </svg>

                    {/* Floating Inspection Card on Hover */}
                    {hoveredData && (
                      <div
                        className="absolute top-3 left-16 bg-slate-900/95 border border-slate-700/80 rounded-lg p-2.5 shadow-xl text-xs space-y-1 backdrop-blur z-20 pointer-events-none"
                      >
                        <div className="flex items-center justify-between gap-4 font-mono font-bold text-amber-400 border-b border-slate-800 pb-1">
                          <span>Jarak: {hoveredData.distanceM} m</span>
                          <span
                            className={
                              hoveredData.totalDownwindKw <= 3.16 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {hoveredData.totalDownwindKw <= 3.16 ? '✓ Safe' : '⚠ Exceeds API 521'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] font-mono">
                          <span className="text-slate-400">Downwind Total:</span>
                          <span className="text-orange-400 font-bold">{hoveredData.totalDownwindKw.toFixed(2)} kW/m²</span>

                          <span className="text-slate-400">Flare Only:</span>
                          <span className="text-amber-300">{hoveredData.flareDownwindKw.toFixed(2)} kW/m²</span>

                          <span className="text-slate-400">Matahari (Solar):</span>
                          <span className="text-yellow-400">+{hoveredData.solarKw.toFixed(2)} kW/m²</span>

                          <span className="text-slate-400">Crosswind:</span>
                          <span className="text-sky-300">{hoveredData.totalCrosswindKw.toFixed(2)} kW/m²</span>

                          <span className="text-slate-400">Upwind:</span>
                          <span className="text-teal-300">{hoveredData.totalUpwindKw.toFixed(2)} kW/m²</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Explanatory Footer Card */}
              <div className="mt-2 bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>
                    <strong>Persamaan Titik Sumber API 521:</strong> <code className="text-amber-300 font-mono">K = (τ · Q_rad) / (4·π·R²) + K_solar</code>.
                    Sumbu <span className="text-orange-400 font-semibold">Downwind</span> menghasilkan radiasi tertinggi karena kemiringan nyala ({flame.flameTiltDeg.toFixed(1)}°) mendekati permukaan tanah.
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Stack: {stack.stackHeight}m · Q_rad: {flame.radiatedPowerMw.toFixed(1)} MW · Angin: {env.windSpeed} m/s
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Simulation Physics Metrics Readout (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Flame Geometry Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Geometri Nyala Api (API 521)</span>
              </h3>
              <span className="text-[10px] font-mono text-amber-400">
                {flame.heatReleaseMw.toFixed(1)} MW Release
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">Panjang Nyala (Lf)</span>
                <span className="font-mono font-bold text-amber-300 text-sm">
                  {flame.flameLength.toFixed(1)} m
                </span>
                <span className="text-[9px] text-slate-500 block">
                  {(flame.flameLength * 3.28).toFixed(0)} ft
                </span>
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">Sudut Miring (Tilt)</span>
                <span className="font-mono font-bold text-sky-300 text-sm">
                  {flame.flameTiltDeg.toFixed(1)}°
                </span>
                <span className="text-[9px] text-slate-500 block">
                  dari vertikal tiang
                </span>
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">Pusat Radiasi Z</span>
                <span className="font-mono font-bold text-slate-200 text-sm">
                  {flame.flameCenterCoords.z.toFixed(1)} m
                </span>
                <span className="text-[9px] text-slate-500 block">Elevasi titik panas</span>
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block">Daya Radiasi (Qrad)</span>
                <span className="font-mono font-bold text-orange-400 text-sm">
                  {flame.radiatedPowerMw.toFixed(1)} MW
                </span>
                <span className="text-[9px] text-slate-500 block">
                  {(flame.radiationFraction * 100).toFixed(1)}% fraksi emisi
                </span>
              </div>
            </div>
          </div>

          {/* Acoustic & Flameout Dispersion Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-sky-400" />
                <span>Akustik & Bahaya Flameout</span>
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center bg-slate-800/60 p-2 rounded-lg">
                <span className="text-slate-400">Tingkat Daya Suara (PWL):</span>
                <span className="font-mono font-bold text-slate-200">
                  {flame.soundPowerLevelDba.toFixed(1)} dBA
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-800/60 p-2 rounded-lg">
                <span className="text-slate-400">Radius Batas Bising 85 dBA:</span>
                <span className="font-mono font-bold text-sky-400">
                  {noise85Radius} meter
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-800/60 p-2 rounded-lg">
                <span className="text-slate-400 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Radius Bahaya Flameout:</span>
                </span>
                <span className="font-mono font-bold text-rose-400">
                  {flameoutHazardDistanceM} meter
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Jika nyala suar padam saat pelepasan gas darurat (flameout), gas mudah terbakar dapat menjangkau radius hingga {flameoutHazardDistanceM}m sebelum terdispersi di bawah 50% LEL.
            </p>
          </div>

          {/* Hazardous Area Zone 1 & Zone 2 Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Zona Bahaya (Ex-Proof IEC 60079-10-1)</span>
              </h3>
              <span className="text-[10px] font-mono text-amber-400">
                Group {hazardousArea.gasGroup} {hazardousArea.tempClass}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-rose-950/40 border border-rose-700/60 rounded-lg p-2">
                <span className="text-[10px] text-rose-300 block">Zone 1 (Wajib Ex d/ia)</span>
                <span className="font-mono font-bold text-rose-200 text-sm">
                  R ≤ {hazardousArea.zone1RadiusM} m
                </span>
              </div>
              <div className="bg-amber-950/40 border border-amber-700/60 rounded-lg p-2">
                <span className="text-[10px] text-amber-300 block">Zone 2 (Min. Ex ec/nA)</span>
                <span className="font-mono font-bold text-amber-200 text-sm">
                  R ≤ {hazardousArea.zone2RadiusM} m
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              {hazardousArea.basisNote}
            </p>
          </div>

          {/* Isopleth Radii Breakdown */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-200 border-b border-slate-800 pb-1.5">
              Zona Radius Isopleth (Bawah Angin)
            </h3>
            <div className="space-y-1.5 text-xs">
              {isopleths.map((iso) => (
                <div
                  key={iso.levelKw}
                  className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: iso.color }}
                    />
                    <span className="text-slate-300 font-mono">{iso.levelKw} kW/m²</span>
                  </div>
                  <span className="font-mono font-semibold text-slate-100">
                    {iso.reachesGround && iso.radiusDownwind > 0 ? (
                      `${iso.radiusDownwind} m`
                    ) : (
                      <span className="text-emerald-400 text-[11px]">
                        Aman di tanah (R 3D: {iso.radius3d} m di udara)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Explicit Receptor Coordinate & Simulation Breakdown Strip */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-bold text-slate-200">
            Ringkasan Posisi Koordinat Reseptor, Radiasi & Klasifikasi Zona Bahaya
          </h3>
          <span className="text-[10px] font-mono text-slate-400">
            Pusat Flare Stack: (X: {stack.locationX}m, Y: {stack.locationY}m)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/70 text-slate-400 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-1.5 px-3">Reseptor</th>
                <th className="py-1.5 px-2 text-center">Koordinat (X, Y, Z) m</th>
                <th className="py-1.5 px-2 text-center">Jarak Tanah</th>
                <th className="py-1.5 px-2 text-right">Radiasi (kW/m²)</th>
                <th className="py-1.5 px-2 text-center">Bising (dBA)</th>
                <th className="py-1.5 px-3 text-center">Zona Bahaya & Rating Ex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {results.receptors.map((r) => (
                <tr
                  key={r.receptor.id}
                  onClick={() => setSelectedReceptorId(r.receptor.id)}
                  className={`cursor-pointer transition-colors ${
                    selectedReceptorId === r.receptor.id ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-2 px-3 font-semibold text-slate-200">{r.receptor.name}</td>
                  <td className="py-2 px-2 text-center font-mono text-sky-300">
                    (X: {r.receptor.x}m, Y: {r.receptor.y}m, Z: +{r.receptor.z}m)
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-slate-300">
                    {r.stackGroundDistance.toFixed(1)} m
                  </td>
                  <td className={`py-2 px-2 text-right font-mono font-bold ${r.isRadiationPass ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {r.radiationKw.toFixed(2)} / {r.receptor.apiLimitKw}
                  </td>
                  <td className={`py-2 px-2 text-center font-mono ${r.isNoisePass ? 'text-slate-300' : 'text-rose-400'}`}>
                    {r.noiseDba.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                        r.hazardousZone === 'Zone 1'
                          ? 'bg-rose-950/70 border-rose-600 text-rose-300'
                          : r.hazardousZone === 'Zone 2'
                          ? 'bg-amber-950/70 border-amber-600 text-amber-300'
                          : 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      }`}
                    >
                      {r.hazardousZone === 'Zone 1'
                        ? `ZONE 1 (Ex d/ia ${hazardousArea.gasGroup})`
                        : r.hazardousZone === 'Zone 2'
                        ? `ZONE 2 (Ex ec ${hazardousArea.gasGroup})`
                        : 'SAFE AREA'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nav Actions */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onPrev}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali: Reseptor</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition-all"
        >
          <span>Lanjut ke Tahap 5: Evaluasi Standar API 521</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
