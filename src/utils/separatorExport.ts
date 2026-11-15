import { jsPDF } from 'jspdf';
import {
  FluidProperties,
  SeparatorConfig,
  SeparatorSizingResult,
} from '../types/flaresim';

/**
 * Render the 2D GA SVG element onto an offscreen canvas and export as an A4 Landscape PDF engineering sheet.
 */
export async function exportSeparatorToPdf(
  svgElement: SVGSVGElement | null,
  result: SeparatorSizingResult,
  fluid: FluidProperties,
  config: SeparatorConfig
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = 297;
  const pageH = 210;
  const margin = 8;

  // Outer CAD border
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.rect(margin, margin, pageW - 2 * margin, pageH - 2 * margin);
  doc.setLineWidth(0.2);
  doc.rect(margin + 1.5, margin + 1.5, pageW - 2 * margin - 3, pageH - 2 * margin - 3);

  // Header strip
  doc.setFillColor(15, 23, 42);
  doc.rect(margin + 1.5, margin + 1.5, pageW - 2 * margin - 3, 12, 'F');
  const isHoriz = result.orientation === 'horizontal';
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    isHoriz
      ? 'GENERAL ARRANGEMENT (GA) DRAWING — HORIZONTAL GAS-WATER SEPARATOR (KO DRUM)'
      : 'GENERAL ARRANGEMENT (GA) DRAWING — VERTICAL GAS-WATER SEPARATOR (KO DRUM)',
    margin + 5,
    margin + 8.5
  );
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    isHoriz
      ? `TAG: TK-4101H | ID: ${result.selectedDiameterMm} mm | L(T-T): ${result.vesselLengthMm} mm (L/D ${result.ldRatio})`
      : `TAG: TK-4101 | ID: ${result.selectedDiameterMm} mm | Tan-to-Tan: ${result.tanToTanHeightMm} mm`,
    pageW - margin - 5,
    margin + 8.5,
    { align: 'right' }
  );

  // Convert SVG to high-res PNG via Canvas
  const drawAreaX = margin + 3;
  const drawAreaY = margin + 15;
  const drawAreaW = 186;
  const drawAreaH = 142;

  if (svgElement) {
    try {
      const cloned = svgElement.cloneNode(true) as SVGSVGElement;
      cloned.setAttribute('width', '1520');
      cloned.setAttribute('height', '1040');
      const svgString = new XMLSerializer().serializeToString(cloned);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const imgDataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1900;
          canvas.height = 1300;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error('Canvas 2D context unavailable'));
            return;
          }
          ctx.fillStyle = '#030712';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        };
        img.src = url;
      });

      doc.addImage(imgDataUrl, 'PNG', drawAreaX, drawAreaY, drawAreaW, drawAreaH);
    } catch {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(10);
      doc.text('Pratinjau gambar GA tidak tersedia.', drawAreaX + 20, drawAreaY + 40);
    }
  }

  // Right Sidebar: Design Data & Nozzle Schedule
  const sideX = drawAreaX + drawAreaW + 3;
  const sideW = pageW - margin - 3 - sideX;
  let curY = drawAreaY;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.rect(sideX, curY, sideW, drawAreaH);

  // Section 1: Process & Sizing Summary
  doc.setFillColor(30, 41, 59);
  doc.rect(sideX, curY, sideW, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('PROCESS & SIZING BASIS (API 521 / AIChE)', sideX + 2, curY + 4.2);
  curY += 9;

  const summaryRows: Array<[string, string]> = [
    ['Orientasi Bejana', isHoriz ? 'Horizontal KO Drum' : 'Vertical KO Pot'],
    ['Fluida Gas', fluid.gasName.slice(0, 28)],
    ['Debit Aktual', `${result.actualVolumetricFlowM3h.toLocaleString()} m3/h`],
    ['Tekanan / Suhu', `${(fluid.reliefPressure * 1000).toFixed(0)} mbarg / ${fluid.temperature} C`],
    ['Densitas Gas', `${result.gasDensityKgM3.toFixed(3)} kg/m3`],
    ['Target Tetesan', `${config.dropletSizeMicron} um (vt=${result.terminalVelocityMs} m/s)`],
    [isHoriz ? 'Vel Gas Horizontal' : 'Vel Gas Naik', `${result.actualGasVelocityMs} m/s (${result.velocityRatioVt}x batas)`],
    ['ID Minimum / Terpilih', `${result.minDiameterMm} mm / ${result.selectedDiameterMm} mm`],
    [isHoriz ? 'Panjang T-T / L/D' : 'Tan-to-Tan / Overall', isHoriz ? `${result.vesselLengthMm} mm / L/D=${result.ldRatio}` : `${result.tanToTanHeightMm} mm / ${result.overallHeightMm} mm`],
    ['Demister Pad', `${result.demisterThicknessMm} mm SS316L`],
    ['Total dP Separator', `${result.totalDropMbar} mbar (Batas ${config.budgetPressureDropMbar})`],
    ['U-Loop Seal Height', `${result.providedSealHeightMmWc} mmWC (Min ${result.minSealHeightMmWc})`],
    ['Laju Kondensat', `${config.condensateRateLitersPerDay} L/hari (Fill: ${result.fillTimeHours} jam)`],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  summaryRows.forEach(([k, v]) => {
    doc.setTextColor(71, 85, 105);
    doc.text(k, sideX + 2, curY);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(v, sideX + sideW - 2, curY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    curY += 4.5;
  });

  // Section 2: Nozzle Schedule
  curY += 2;
  doc.setFillColor(30, 41, 59);
  doc.rect(sideX, curY, sideW, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('NOZZLE SCHEDULE (MM FROM BTL)', sideX + 2, curY + 4.2);
  curY += 8.5;

  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('TAG', sideX + 2, curY);
  doc.text('SERVICE', sideX + 13, curY);
  doc.text('SIZE', sideX + 54, curY);
  doc.text('ELEV', sideX + sideW - 2, curY, { align: 'right' });
  curY += 1.5;
  doc.line(sideX + 1, curY, sideX + sideW - 1, curY);
  curY += 3.5;

  result.nozzles.forEach((noz) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(noz.tag, sideX + 2, curY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(noz.service.slice(0, 24), sideX + 13, curY);
    doc.text(`${noz.nominalSizeInch} (${noz.sizeMm})`, sideX + 54, curY);
    doc.text(`${noz.elevationMm >= 0 ? '+' : ''}${noz.elevationMm}`, sideX + sideW - 2, curY, { align: 'right' });
    curY += 4.6;
  });

  // Bottom Title Block & Criteria Strip
  const footerY = drawAreaY + drawAreaH + 3;
  const footerH = pageH - margin - 2 - footerY;
  doc.setDrawColor(30, 41, 59);
  doc.rect(drawAreaX, footerY, pageW - 2 * margin - 6, footerH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CATATAN TEKNIS & KRITERIA PENERIMAAN:', drawAreaX + 3, footerY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `1. Semua dimensi dalam milimeter (mm) dari Bottom Tangent Line (BTL = 0.000).  2. LLL = +${result.lllElevationMm} mm, NLL = +${result.nllElevationMm} mm, HLL = +${result.hllElevationMm} mm, HHLL = +${result.hhllElevationMm} mm.`,
    drawAreaX + 3,
    footerY + 10
  );
  doc.text(
    `3. Drain kondensat wajib kontinu melalui U-Loop Seal (${result.providedSealHeightMmWc} mmWC) dengan proteksi anti-siphon & seal make-up line menuju saluran IPAL tertutup.`,
    drawAreaX + 3,
    footerY + 14.5
  );
  doc.text(
    `4. Bejana beroperasi di hulu Flame Arrester (FA) pada tekanan desain rendah (mbar level). Material rekomendasi: SS304L / SS316L (tahan korosi H2S/biogas).`,
    drawAreaX + 3,
    footerY + 19
  );

  // Engineering stamp box on bottom right
  const stampX = pageW - margin - 65;
  doc.line(stampX, footerY, stampX, footerY + footerH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('FLARESIM ENGINEERING', stampX + 3, footerY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`DOC: GA-SEP-TK4101`, stampX + 3, footerY + 10.5);
  doc.text(`DATE: ${new Date().toISOString().slice(0, 10)}`, stampX + 3, footerY + 15);
  doc.text(`REV: 0 (ISSUED FOR DESIGN)`, stampX + 3, footerY + 19.5);

  doc.save(`Separator_GA_${isHoriz ? 'Horizontal' : 'Vertical'}_ID${result.selectedDiameterMm}mm.pdf`);
}

/**
 * Generate a standard ASCII AutoCAD DXF (R12 / AC1009) 2D GA Drawing in true millimeters.
 * Coordinate origin (0,0) = Vessel Centerline at Bottom Tangent Line (BTL).
 */
export function exportSeparatorToDxf(
  result: SeparatorSizingResult,
  fluid: FluidProperties,
  config: SeparatorConfig
): void {
  const id = result.selectedDiameterMm;
  const r = id / 2;
  const hTan = result.tanToTanHeightMm;
  const headH = Math.round(id * 0.25);
  const legH = 650;
  const gradeY = -headH - legH;

  const lines: string[] = [];
  const pushPair = (code: number, value: string | number) => {
    lines.push(String(code), String(value));
  };

  const addLine = (layer: string, x1: number, y1: number, x2: number, y2: number) => {
    pushPair(0, 'LINE');
    pushPair(8, layer);
    pushPair(10, x1.toFixed(2));
    pushPair(20, y1.toFixed(2));
    pushPair(30, 0);
    pushPair(11, x2.toFixed(2));
    pushPair(21, y2.toFixed(2));
    pushPair(31, 0);
  };

  const addRect = (layer: string, x1: number, y1: number, x2: number, y2: number) => {
    addLine(layer, x1, y1, x2, y1);
    addLine(layer, x2, y1, x2, y2);
    addLine(layer, x2, y2, x1, y2);
    addLine(layer, x1, y2, x1, y1);
  };

  const addText = (layer: string, x: number, y: number, height: number, text: string) => {
    pushPair(0, 'TEXT');
    pushPair(8, layer);
    pushPair(10, x.toFixed(2));
    pushPair(20, y.toFixed(2));
    pushPair(30, 0);
    pushPair(40, height.toFixed(1));
    pushPair(1, text);
  };

  const addSemiEllipse = (
    layer: string,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    isTop: boolean,
    segments: number = 24
  ) => {
    for (let i = 0; i < segments; i++) {
      const a1 = (Math.PI * i) / segments;
      const a2 = (Math.PI * (i + 1)) / segments;
      const x1 = cx + rx * Math.cos(a1);
      const y1 = cy + (isTop ? 1 : -1) * ry * Math.sin(a1);
      const x2 = cx + rx * Math.cos(a2);
      const y2 = cy + (isTop ? 1 : -1) * ry * Math.sin(a2);
      addLine(layer, x1, y1, x2, y2);
    }
  };

  // HEADER SECTION
  pushPair(0, 'SECTION');
  pushPair(2, 'HEADER');
  pushPair(9, '$ACADVER');
  pushPair(1, 'AC1009');
  pushPair(9, '$INSUNITS');
  pushPair(70, 4); // Millimeters
  pushPair(0, 'ENDSEC');

  // TABLES / LAYERS SECTION
  pushPair(0, 'SECTION');
  pushPair(2, 'TABLES');
  pushPair(0, 'TABLE');
  pushPair(2, 'LAYER');
  pushPair(70, 8);

  const layers: Array<{ name: string; color: number }> = [
    { name: 'SHELL', color: 7 },       // White
    { name: 'INTERNAL', color: 4 },    // Cyan
    { name: 'NOZZLES', color: 3 },     // Green
    { name: 'LOOP_SEAL', color: 5 },   // Blue
    { name: 'LEVELS', color: 6 },      // Magenta
    { name: 'CENTERLINE', color: 1 },  // Red
    { name: 'DIMENSIONS', color: 2 },  // Yellow
    { name: 'TEXT', color: 7 },        // White
  ];

  layers.forEach((lay) => {
    pushPair(0, 'LAYER');
    pushPair(2, lay.name);
    pushPair(70, 0);
    pushPair(62, lay.color);
    pushPair(6, 'CONTINUOUS');
  });

  pushPair(0, 'ENDTAB');
  pushPair(0, 'ENDSEC');

  // ENTITIES SECTION
  pushPair(0, 'SECTION');
  pushPair(2, 'ENTITIES');

  if (result.orientation === 'horizontal') {
    const len = result.vesselLengthMm;
    const saddleH = 650;
    const hGradeY = -saddleH;

    // Horizontal Centerline
    addLine('CENTERLINE', -headH - 220, r, len + headH + 220, r);
    // Grade Line
    addLine('SHELL', -headH - 350, hGradeY, len + headH + 650, hGradeY);
    addText('TEXT', -headH - 320, hGradeY + 25, 24, 'GRADE ELEV. 0.000');

    // Horizontal Shell Lines (0..len, y=0..id)
    addLine('SHELL', 0, 0, len, 0);
    addLine('SHELL', 0, id, len, id);
    addLine('LEVELS', 0, -40, 0, id + 40);
    addLine('LEVELS', len, -40, len, id + 40);

    // Left & Right 2:1 Ellipsoidal Heads
    for (let i = 0; i < 24; i++) {
      const a1 = (Math.PI * i) / 24;
      const a2 = (Math.PI * (i + 1)) / 24;
      // Left head
      addLine(
        'SHELL',
        -headH * Math.sin(a1),
        r + r * Math.cos(a1),
        -headH * Math.sin(a2),
        r + r * Math.cos(a2)
      );
      // Right head
      addLine(
        'SHELL',
        len + headH * Math.sin(a1),
        r + r * Math.cos(a1),
        len + headH * Math.sin(a2),
        r + r * Math.cos(a2)
      );
    }

    // Two Saddle Supports
    const sad1X = len * 0.2;
    const sad2X = len * 0.8;
    addRect('SHELL', sad1X - 90, hGradeY + 20, sad1X + 90, 0);
    addRect('SHELL', sad2X - 90, hGradeY + 20, sad2X + 90, 0);
    addRect('SHELL', sad1X - 130, hGradeY, sad1X + 130, hGradeY + 20);
    addRect('SHELL', sad2X - 130, hGradeY, sad2X + 130, hGradeY + 20);

    // Liquid Levels (measured from bottom of horizontal shell y=0)
    [
      { label: `HHLL +${result.hhllElevationMm}`, y: result.hhllElevationMm },
      { label: `HLL +${result.hllElevationMm}`, y: result.hllElevationMm },
      { label: `NLL +${result.nllElevationMm}`, y: result.nllElevationMm },
      { label: `LLL +${result.lllElevationMm}`, y: result.lllElevationMm },
    ].forEach((lvl) => {
      addLine('LEVELS', 10, lvl.y, len + 120, lvl.y);
      addText('TEXT', len + 135, lvl.y - 8, 18, lvl.label);
    });

    // Top-left Inlet N1 + Baffle
    const n1 = result.nozzles.find((n) => n.tag === 'N1');
    const n1Size = n1 ? n1.sizeMm : 150;
    const n1X = len * 0.16;
    addRect('NOZZLES', n1X - n1Size / 2, id, n1X + n1Size / 2, id + 150);
    addLine('NOZZLES', n1X - n1Size * 0.7, id + 150, n1X + n1Size * 0.7, id + 150);
    addText('TEXT', n1X - 120, id + 175, 22, `N1 INLET (${n1?.nominalSizeInch || '6"'})`);
    addLine('INTERNAL', n1X - n1Size * 0.6, id - 50, n1X + n1Size * 0.8, id - 130);

    // Top-right Outlet N2 + Horizontal Demister Box
    const n2 = result.nozzles.find((n) => n.tag === 'N2');
    const n2Size = n2 ? n2.sizeMm : 150;
    const n2X = len * 0.84;
    addRect('NOZZLES', n2X - n2Size / 2, id, n2X + n2Size / 2, id + 150);
    addLine('NOZZLES', n2X - n2Size * 0.7, id + 150, n2X + n2Size * 0.7, id + 150);
    addText('TEXT', n2X - 120, id + 175, 22, `N2 GAS OUTLET (${n2?.nominalSizeInch || '6"'}) TO FA`);
    addRect('INTERNAL', n2X - 150, id - result.demisterThicknessMm, n2X + 150, id - 10);
    addText('TEXT', n2X - 150, id - result.demisterThicknessMm - 35, 18, `DEMISTER PAD ${result.demisterThicknessMm}mm SS316L`);

    // Bottom Drain N3 + Vortex Breaker + U-Loop Seal
    const n3X = len * 0.78;
    const sealBotY = hGradeY + 70;
    const sealH = Math.min(result.providedSealHeightMmWc, 550);
    const uRightX = len + 260;
    addLine('INTERNAL', n3X - 40, 35, n3X + 40, 35);
    addLine('INTERNAL', n3X, 10, n3X, 60);
    addLine('LOOP_SEAL', n3X, 0, n3X, sealBotY);
    addLine('LOOP_SEAL', n3X, sealBotY, uRightX, sealBotY);
    addLine('LOOP_SEAL', uRightX, sealBotY, uRightX, sealBotY + sealH);
    addLine('LOOP_SEAL', uRightX, sealBotY + sealH, uRightX + 220, sealBotY + sealH);
    addLine('LOOP_SEAL', uRightX, sealBotY + sealH, uRightX, sealBotY + sealH + 140);
    addText('TEXT', uRightX + 20, sealBotY + sealH + 100, 18, 'ANTI-SIPHON VENT');
    addText('TEXT', uRightX + 20, sealBotY + sealH - 30, 18, 'CONTINUOUS OVERFLOW TO IPAL');
    addText('TEXT', n3X + 30, sealBotY - 30, 20, `U-LOOP SEAL H=${result.providedSealHeightMmWc} mmWC`);

    // End Manway N4 on left head
    const n4 = result.nozzles.find((n) => n.tag === 'N4');
    const n4Size = Math.min(250, n4 ? n4.sizeMm : 200);
    addRect('NOZZLES', -headH - 130, r - n4Size / 2, -headH + 5, r + n4Size / 2);
    addLine('NOZZLES', -headH - 130, r - n4Size * 0.65, -headH - 130, r + n4Size * 0.65);
    addText('TEXT', -headH - 360, r + 15, 20, `N4 ${n4?.nominalSizeInch || 'HANDHOLE'}`);

    // Dimension lines: Length L (T-T) & ID
    const dimLenY = id + 300;
    addLine('DIMENSIONS', 0, dimLenY, len, dimLenY);
    addLine('DIMENSIONS', 0, id + 10, 0, dimLenY + 20);
    addLine('DIMENSIONS', len, id + 10, len, dimLenY + 20);
    addText('DIMENSIONS', len * 0.35, dimLenY + 25, 26, `L (T-T) = ${len} mm (L/D=${result.ldRatio})`);

    const dimIdX = -headH - 220;
    addLine('DIMENSIONS', dimIdX, 0, dimIdX, id);
    addLine('DIMENSIONS', -10, 0, dimIdX - 20, 0);
    addLine('DIMENSIONS', -10, id, dimIdX - 20, id);
    addText('DIMENSIONS', dimIdX - 200, r, 24, `ID = ${id} mm`);

    // Title Block
    const tbX = len + 360;
    const tbY = hGradeY + 20;
    addRect('TEXT', tbX, tbY, tbX + 950, tbY + 340);
    addText('TEXT', tbX + 25, tbY + 280, 28, 'FLARESIM HORIZONTAL KO DRUM - GA (MM)');
    addText('TEXT', tbX + 25, tbY + 230, 22, `TAG: TK-4101H | FLUID: ${fluid.gasName.slice(0, 32)}`);
    addText('TEXT', tbX + 25, tbY + 185, 22, `ID: ${id} mm | L(T-T): ${len} mm | L/D: ${result.ldRatio}`);
    addText('TEXT', tbX + 25, tbY + 140, 20, `DESIGN FLOW: ${result.actualVolumetricFlowM3h} m3/h | V_GAS: ${result.actualGasVelocityMs} m/s`);
    addText('TEXT', tbX + 25, tbY + 95, 20, `SEAL DRAIN: ${result.providedSealHeightMmWc} mmWC | CONDENSATE: ${config.condensateRateLitersPerDay} L/day`);
    addText('TEXT', tbX + 25, tbY + 45, 18, `BASIS: API 521 / AIChE HORIZONTAL KO DRUM (300 um DROPLET)`);
  } else {
    // 1. Centerline
    addLine('CENTERLINE', 0, gradeY - 120, 0, hTan + headH + 260);

    // 2. Grade line
    addLine('SHELL', -r - 450, gradeY, r + 950, gradeY);
    addText('TEXT', -r - 430, gradeY + 25, 26, 'GRADE ELEV. 0.000');

    // 3. Cylindrical Shell & 2:1 Ellipsoidal Heads
    addLine('SHELL', -r, 0, -r, hTan);
    addLine('SHELL', r, 0, r, hTan);
    addLine('LEVELS', -r - 40, 0, r + 40, 0);
    addText('TEXT', -r - 220, -10, 22, 'BTL (0 mm)');
    addLine('LEVELS', -r - 40, hTan, r + 40, hTan);
    addText('TEXT', -r - 240, hTan - 10, 22, `TTL (+${hTan} mm)`);

    addSemiEllipse('SHELL', 0, hTan, r, headH, true, 24);
    addSemiEllipse('SHELL', 0, 0, r, headH, false, 24);

    // 4. Support Legs & Base Plates
    const legW = 50;
    addRect('SHELL', -r - 10, gradeY + 20, -r - 10 + legW, -headH * 0.4);
    addRect('SHELL', r + 10 - legW, gradeY + 20, r + 10, -headH * 0.4);
    addRect('SHELL', -r - 45, gradeY, -r + 75, gradeY + 20);
    addRect('SHELL', r - 75, gradeY, r + 45, gradeY + 20);

    // 5. Liquid Levels (LLL, NLL, HLL, HHLL)
    const levelLines = [
      { label: `HHLL +${result.hhllElevationMm}`, y: result.hhllElevationMm },
      { label: `HLL +${result.hllElevationMm}`, y: result.hllElevationMm },
      { label: `NLL +${result.nllElevationMm}`, y: result.nllElevationMm },
      { label: `LLL +${result.lllElevationMm}`, y: result.lllElevationMm },
    ];
    levelLines.forEach((lvl) => {
      addLine('LEVELS', -r + 10, lvl.y, r + 90, lvl.y);
      addText('TEXT', r + 105, lvl.y - 8, 20, lvl.label);
    });

    // 6. Wire Mesh Demister Pad + Cross Hatching
    const yDemBot = result.demisterBottomElevationMm;
    const yDemTop = yDemBot + result.demisterThicknessMm;
    addRect('INTERNAL', -r + 6, yDemBot, r - 6, yDemTop);
    const hatchSteps = 8;
    for (let i = 0; i < hatchSteps; i++) {
      const xA = -r + 6 + ((id - 12) * i) / hatchSteps;
      const xB = -r + 6 + ((id - 12) * (i + 1)) / hatchSteps;
      addLine('INTERNAL', xA, yDemBot, xB, yDemTop);
      addLine('INTERNAL', xB, yDemBot, xA, yDemTop);
    }
    addText('TEXT', r + 70, yDemBot + 25, 22, `DEMISTER PAD ${result.demisterThicknessMm}mm SS316L`);

    // 7. Inlet Nozzle N1 + Deflector Baffle
    const n1 = result.nozzles.find((n) => n.tag === 'N1');
    const n1Size = n1 ? n1.sizeMm : 150;
    const n1Elev = result.inletElevationMm;
    const n1Proj = 160;
    addRect('NOZZLES', -r - n1Proj, n1Elev - n1Size / 2, -r, n1Elev + n1Size / 2);
    addLine('NOZZLES', -r - n1Proj, n1Elev - n1Size * 0.7, -r - n1Proj, n1Elev + n1Size * 0.7);
    addText('TEXT', -r - n1Proj - 250, n1Elev + 15, 22, `N1 INLET (${n1?.nominalSizeInch || '6"'})`);
    if (config.inletDeflectorType === '45deg_baffle') {
      addLine('INTERNAL', -r + 45, n1Elev + n1Size * 0.5, -r + 135, n1Elev - n1Size * 0.8);
    } else {
      addRect('INTERNAL', -r + 35, n1Elev - n1Size * 0.6, -r + 75, n1Elev + n1Size * 0.6);
    }

    // 8. Top Outlet Nozzle N2
    const n2 = result.nozzles.find((n) => n.tag === 'N2');
    const n2Size = n2 ? n2.sizeMm : 150;
    const n2TopY = hTan + headH + 140;
    addRect('NOZZLES', -n2Size / 2, hTan + headH - 10, n2Size / 2, n2TopY);
    addLine('NOZZLES', -n2Size * 0.7, n2TopY, n2Size * 0.7, n2TopY);
    addText('TEXT', n2Size * 0.8, n2TopY - 20, 22, `N2 GAS OUTLET (${n2?.nominalSizeInch || '6"'}) TO FA`);

    // 9. Manway / Handhole N4
    const n4 = result.nozzles.find((n) => n.tag === 'N4');
    const n4Size = Math.min(350, n4 ? n4.sizeMm : 200);
    const n4Elev = n4 ? n4.elevationMm : n1Elev + 300;
    addRect('NOZZLES', r, n4Elev - n4Size / 2, r + 130, n4Elev + n4Size / 2);
    addLine('NOZZLES', r + 130, n4Elev - n4Size * 0.65, r + 130, n4Elev + n4Size * 0.65);
    addText('TEXT', r + 150, n4Elev, 20, `N4 ${n4?.nominalSizeInch || 'HANDHOLE'}`);

    // 10. Bottom Drain N3 + Vortex Breaker + U-Loop Seal
    const n3TopY = -headH;
    const sealBotY = gradeY + 60;
    const sealHeight = Math.min(result.providedSealHeightMmWc, 650);
    const uRightX = r + 340;
    const uMidX = r + 180;
    const uOverflowY = sealBotY + sealHeight;

    addLine('INTERNAL', -40, n3TopY + 35, 40, n3TopY + 35);
    addLine('INTERNAL', 0, n3TopY + 10, 0, n3TopY + 60);

    addLine('LOOP_SEAL', 0, n3TopY, 0, sealBotY);
    addLine('LOOP_SEAL', 0, sealBotY, uRightX, sealBotY);
    addLine('LOOP_SEAL', uRightX, sealBotY, uRightX, uOverflowY);
    addLine('LOOP_SEAL', uRightX, uOverflowY, uRightX + 240, uOverflowY);
    addLine('LOOP_SEAL', uRightX, uOverflowY, uRightX, uOverflowY + 160);
    addText('TEXT', uRightX + 20, uOverflowY + 120, 20, 'ANTI-SIPHON VENT');
    addText('TEXT', uRightX + 20, uOverflowY - 30, 20, 'CONTINUOUS OVERFLOW TO IPAL');
    addText('TEXT', uMidX - 80, sealBotY - 35, 22, `U-LOOP SEAL H=${result.providedSealHeightMmWc} mmWC`);

    // 11. Dimension Lines
    const dimX = -r - 340;
    addLine('DIMENSIONS', dimX, 0, dimX, hTan);
    addLine('DIMENSIONS', -r - 20, 0, dimX - 20, 0);
    addLine('DIMENSIONS', -r - 20, hTan, dimX - 20, hTan);
    addText('DIMENSIONS', dimX - 180, hTan * 0.5, 24, `T/T = ${hTan} mm`);

    const dimIdY = hTan + headH + 220;
    addLine('DIMENSIONS', -r, dimIdY, r, dimIdY);
    addLine('DIMENSIONS', -r, hTan, -r, dimIdY + 20);
    addLine('DIMENSIONS', r, hTan, r, dimIdY + 20);
    addText('DIMENSIONS', -110, dimIdY + 25, 26, `ID = ${id} mm`);

    // 12. Engineering Title Block
    const tbX = r + 420;
    const tbY = gradeY + 20;
    addRect('TEXT', tbX, tbY, tbX + 950, tbY + 340);
    addText('TEXT', tbX + 25, tbY + 280, 28, 'FLARESIM KO DRUM - GA DRAWING (MM)');
    addText('TEXT', tbX + 25, tbY + 230, 22, `TAG: TK-4101 | FLUID: ${fluid.gasName.slice(0, 32)}`);
    addText('TEXT', tbX + 25, tbY + 185, 22, `VESSEL ID: ${id} mm | TAN-TO-TAN: ${hTan} mm | OVERALL: ${result.overallHeightMm} mm`);
    addText('TEXT', tbX + 25, tbY + 140, 20, `DESIGN FLOW: ${result.actualVolumetricFlowM3h} m3/h | V_GAS: ${result.actualGasVelocityMs} m/s (${result.velocityRatioVt} vt)`);
    addText('TEXT', tbX + 25, tbY + 95, 20, `SEAL DRAIN: ${result.providedSealHeightMmWc} mmWC | CONDENSATE: ${config.condensateRateLitersPerDay} L/day`);
    addText('TEXT', tbX + 25, tbY + 45, 18, `BASIS: API 521 / AIChE (300 um DROPLET, MBAR LEVEL BIOGAS SYSTEM)`);
  }

  pushPair(0, 'ENDSEC');
  pushPair(0, 'EOF');

  const dxfContent = lines.join('\n');
  const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Separator_GA_${result.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}_ID${id}mm.dxf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
