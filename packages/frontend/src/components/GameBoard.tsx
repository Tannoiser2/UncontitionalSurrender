/**
 * Componente principale della mappa di gioco
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";
import {
  coordKey,
  GamePhase,
  GameSubPhase,
  getEligibleAirSupporters,
  HEX_SIDES,
  HexCoord,
  HexSide,
  hexCodeForMap,
  movementRemainingFor,
  sameCoord,
  scenarioById,
  Side,
  sortiesFor,
  TerrainType,
  Unit,
  UnitType,
  UnitStatus
} from "@uswc/shared";
import styles from "./GameBoard.module.css";

interface Point {
  x: number;
  y: number;
}

type HexVertices = Record<"top" | "upperRight" | "lowerRight" | "bottom" | "lowerLeft" | "upperLeft", Point>;

const terrainFill: Record<TerrainType, string> = {
  [TerrainType.PLAIN]: "#b9bf8a",
  [TerrainType.FOREST]: "#4f7a55",
  [TerrainType.MOUNTAIN]: "#8f8775",
  [TerrainType.SWAMP]: "#6c7755",
  [TerrainType.RIVER]: "#5a9eb8",
  [TerrainType.CITY]: "#c4b39a",
  [TerrainType.COASTAL]: "#d5c78c",
  [TerrainType.SEA]: "#62b8d4"
};

const countryFill: Record<string, string> = {
  Germany: "#8f8f86",
  France: "#4f73b8",
  UK: "#9b6a45",
  USA: "#6f8fc8",
  Belgium: "#d59a3d",
  Netherlands: "#d88934",
  Italy: "#57745a",
  Hungary: "#b9a263",
  Romania: "#b9854b",
  Bulgaria: "#7c8b58",
  Greece: "#5f86bd",
  Yugoslavia: "#6e78aa",
  Albania: "#9a5d4f",
  USSR: "#a3433a",
  Finland: "#7fa3c9",
  Estonia: "#9bc4d2",
  Latvia: "#8dba9b",
  Lithuania: "#c4a76a",
  Poland: "#cf9b5a"
};

const countryBorderStroke: Record<string, string> = {
  Germany: "#2d2d2b",
  France: "#102c66",
  UK: "#5b321b",
  Belgium: "#6d4811",
  Netherlands: "#774519",
  Switzerland: "#8d1f1f",
  Italy: "#1d5c36",
  Luxembourg: "#5a4b78",
  USSR: "#5a1a16",
  Finland: "#1a3d5e",
  Estonia: "#2d5560",
  Latvia: "#2f5a3f",
  Lithuania: "#5a4520",
  Poland: "#7a4818"
};

const unitCounterLabel = (name: string): string => {
  const id = name.replace(/^(Germany|France|UK|USA|Belgium|Netherlands|Italy|Hungary|Romania|Bulgaria|Greece|Yugoslavia|Albania|USSR|Finland|Estonia|Latvia|Lithuania|Poland)\s+/, "");
  if (id === "Maginot Fort") return "Fort";
  if (id === "Ftr Cmd") return "Ftr";
  return id.replace(/\s+/g, "");
};

const countryCounterCode = (country?: string): string => {
  const codes: Record<string, string> = {
    Germany: "GE",
    France: "FR",
    UK: "UK",
    USA: "US",
    Belgium: "BE",
    Netherlands: "NL",
    Italy: "IT",
    Hungary: "HU",
    Romania: "RO",
    Bulgaria: "BU",
    Greece: "GR",
    Yugoslavia: "YU",
    Albania: "AL",
    USSR: "SU",
    Finland: "FI",
    Estonia: "EE",
    Latvia: "LV",
    Lithuania: "LT",
    Poland: "PL"
  };
  return country ? codes[country] || country.slice(0, 2).toUpperCase() : "";
};

const counterIconCache: Record<string, HTMLImageElement | undefined> = {};

const counterIcon = (name: "strategic"): HTMLImageElement | null => {
  if (typeof Image === "undefined") return null;
  const src = "/event-icons/Strategic_move.png";
  const cached = counterIconCache[name];
  if (cached) return cached;
  const image = new Image();
  image.src = src;
  counterIconCache[name] = image;
  return image;
};

const mapEventIconCache: Record<string, HTMLImageElement | undefined> = {};
const mapEventIconSrc: Record<string, string> = {
  AD: "/event-icons/Airdrop.png",
  MB: "/event-icons/Mulberry.png",
  PT: "/event-icons/Partisans.png",
  SA: "/event-icons/Surprise_attack.png"
};

const mapEventIcon = (label: string): HTMLImageElement | null => {
  if (typeof Image === "undefined") return null;
  const src = mapEventIconSrc[label];
  if (!src) return null;
  const cached = mapEventIconCache[label];
  if (cached) return cached;
  const image = new Image();
  image.src = src;
  mapEventIconCache[label] = image;
  return image;
};

const hexToPixel = (
  coord: HexCoord,
  columnStep: number,
  rowStep: number,
  rowShift: number,
  offsetX: number,
  offsetY: number
) => ({
  x: offsetX + coord.q * columnStep + (coord.r % 2 === 0 ? rowShift : 0),
  y: offsetY + coord.r * rowStep
});

const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2
});

const hexVertices = (center: Point, hexWidth: number, hexHeight: number): HexVertices => ({
  top: { x: center.x, y: center.y - hexHeight / 2 },
  upperRight: { x: center.x + hexWidth / 2, y: center.y - hexHeight / 4 },
  lowerRight: { x: center.x + hexWidth / 2, y: center.y + hexHeight / 4 },
  bottom: { x: center.x, y: center.y + hexHeight / 2 },
  lowerLeft: { x: center.x - hexWidth / 2, y: center.y + hexHeight / 4 },
  upperLeft: { x: center.x - hexWidth / 2, y: center.y - hexHeight / 4 }
});

const sideSegmentFor = (vertices: HexVertices, side: HexSide): [Point, Point] => {
  const segments: Record<HexSide, [Point, Point]> = {
    N: [vertices.upperLeft, vertices.top],
    NE: [vertices.top, vertices.upperRight],
    SE: [vertices.upperRight, vertices.lowerRight],
    S: [vertices.lowerRight, vertices.bottom],
    SW: [vertices.bottom, vertices.lowerLeft],
    NW: [vertices.lowerLeft, vertices.upperLeft]
  };
  return segments[side];
};

const sidePointFor = (vertices: HexVertices, side: HexSide): Point => {
  const [a, b] = sideSegmentFor(vertices, side);
  return midpoint(a, b);
};

const neighborForSide = (coord: HexCoord, side: HexSide): HexCoord => {
  const isIndentedRow = coord.r % 2 === 0;
  const deltas: Record<HexSide, HexCoord> = {
    N: { q: isIndentedRow ? 0 : -1, r: -1 },
    NE: { q: isIndentedRow ? 1 : 0, r: -1 },
    SE: { q: 1, r: 0 },
    S: { q: isIndentedRow ? 1 : 0, r: 1 },
    SW: { q: isIndentedRow ? 0 : -1, r: 1 },
    NW: { q: -1, r: 0 }
  };
  const delta = deltas[side];
  return { q: coord.q + delta.q, r: coord.r + delta.r };
};

const sideBetween = (from: HexCoord, to: HexCoord): HexSide | null =>
  HEX_SIDES.find((side) => sameCoord(neighborForSide(from, side), to)) || null;

const drawRail = (context: CanvasRenderingContext2D, start: Point, end: Point) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 4) return;

  const unit = { x: dx / length, y: dy / length };
  const normal = { x: -unit.y, y: unit.x };
  const insetStart = { x: start.x + unit.x * 3, y: start.y + unit.y * 3 };
  const insetEnd = { x: end.x - unit.x * 3, y: end.y - unit.y * 3 };

  context.save();
  context.lineCap = "round";
  context.strokeStyle = "#111111";
  context.lineWidth = 2.1;
  context.beginPath();
  context.moveTo(insetStart.x, insetStart.y);
  context.lineTo(insetEnd.x, insetEnd.y);
  context.stroke();

  const tickSpacing = 11;
  const tickHalfLength = 4.2;
  for (let distance = tickSpacing; distance < length - tickSpacing * 0.45; distance += tickSpacing) {
    const point = { x: start.x + unit.x * distance, y: start.y + unit.y * distance };
    context.beginPath();
    context.moveTo(point.x - normal.x * tickHalfLength, point.y - normal.y * tickHalfLength);
    context.lineTo(point.x + normal.x * tickHalfLength, point.y + normal.y * tickHalfLength);
    context.stroke();
  }
  context.restore();
};

const drawRiver = (context: CanvasRenderingContext2D, start: Point, end: Point) => {
  context.save();
  context.lineCap = "round";
  context.lineWidth = 6;
  context.strokeStyle = "rgba(255, 255, 255, 0.82)";
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.lineWidth = 3;
  context.strokeStyle = "#1f7fa8";
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
};

const drawCountryBorder = (context: CanvasRenderingContext2D, start: Point, end: Point, country?: string) => {
  context.save();
  context.lineCap = "round";
  context.strokeStyle = countryBorderStroke[country || ""] || "#1a1a1a";
  context.lineWidth = 4;
  context.setLineDash([7, 4]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = 1.4;
  context.setLineDash([4, 7]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
};

const drawMountainEdge = (context: CanvasRenderingContext2D, start: Point, end: Point) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 4) return;

  const unit = { x: dx / length, y: dy / length };
  const normal = { x: -unit.y, y: unit.x };

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "rgba(255, 244, 212, 0.9)";
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  context.strokeStyle = "#6a4c2b";
  context.lineWidth = 2.2;
  const toothSpacing = 9;
  const toothHeight = 6;
  for (let distance = 3; distance < length - 3; distance += toothSpacing) {
    const base = { x: start.x + unit.x * distance, y: start.y + unit.y * distance };
    const nextBase = { x: start.x + unit.x * Math.min(length, distance + toothSpacing * 0.58), y: start.y + unit.y * Math.min(length, distance + toothSpacing * 0.58) };
    const peak = {
      x: (base.x + nextBase.x) / 2 + normal.x * toothHeight,
      y: (base.y + nextBase.y) / 2 + normal.y * toothHeight
    };
    context.beginPath();
    context.moveTo(base.x, base.y);
    context.lineTo(peak.x, peak.y);
    context.lineTo(nextBase.x, nextBase.y);
    context.stroke();
  }
  context.restore();
};

const drawImpassableEdge = (context: CanvasRenderingContext2D, start: Point, end: Point) => {
  context.save();
  context.lineCap = "round";
  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.strokeStyle = "#050505";
  context.lineWidth = 3.2;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
};

const drawStraitEdge = (context: CanvasRenderingContext2D, start: Point, end: Point) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 4) return;
  const ux = dx / length;
  const uy = dy / length;
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const headSize = 7;
  const armLen = 11;

  context.save();
  context.strokeStyle = "rgba(255,255,255,0.9)";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  context.strokeStyle = "#7c3aed";
  context.fillStyle = "#7c3aed";
  context.lineWidth = 2;

  const drawArrow = (ox: number, oy: number, dirX: number, dirY: number) => {
    const tipX = ox + dirX * armLen;
    const tipY = oy + dirY * armLen;
    context.beginPath();
    context.moveTo(ox, oy);
    context.lineTo(tipX, tipY);
    context.stroke();
    context.beginPath();
    context.moveTo(tipX, tipY);
    context.lineTo(tipX - dirX * headSize + dirY * (headSize * 0.55), tipY - dirY * headSize - dirX * (headSize * 0.55));
    context.lineTo(tipX - dirX * headSize - dirY * (headSize * 0.55), tipY - dirY * headSize + dirX * (headSize * 0.55));
    context.closePath();
    context.fill();
  };

  drawArrow(mx, my,  ux,  uy);
  drawArrow(mx, my, -ux, -uy);
  context.restore();
};

const drawAttackArrow = (
  context: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  counterSize: number,
  lineWidth = 4
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tipX = to.x - ux * (counterSize / 2 + 4);
  const tipY = to.y - uy * (counterSize / 2 + 4);
  const tailX = from.x + ux * (counterSize / 2 + 2);
  const tailY = from.y + uy * (counterSize / 2 + 2);

  context.save();
  context.strokeStyle = "rgba(0,0,0,0.72)";
  context.lineWidth = lineWidth + 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(tailX, tailY);
  context.lineTo(tipX, tipY);
  context.stroke();

  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(tailX, tailY);
  context.lineTo(tipX, tipY);
  context.stroke();

  const headSize = 12;
  context.beginPath();
  context.moveTo(tipX, tipY);
  context.lineTo(tipX - ux * headSize + uy * (headSize * 0.6), tipY - uy * headSize - ux * (headSize * 0.6));
  context.lineTo(tipX - ux * headSize - uy * (headSize * 0.6), tipY - uy * headSize + ux * (headSize * 0.6));
  context.closePath();
  context.fill();
  context.strokeStyle = "rgba(0,0,0,0.72)";
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
};

const drawNatoSymbol = (context: CanvasRenderingContext2D, type: UnitType, x: number, y: number, width: number, height: number) => {
  const left = x - width / 2;
  const top = y - height / 2;

  context.save();
  context.strokeStyle = "#050505";
  context.lineWidth = 1.8;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeRect(left, top, width, height);

  if (type === UnitType.INFANTRY) {
    context.beginPath();
    context.moveTo(left, top);
    context.lineTo(left + width, top + height);
    context.moveTo(left + width, top);
    context.lineTo(left, top + height);
    context.stroke();
  } else if (type === UnitType.ARMOR) {
    context.beginPath();
    context.ellipse(x, y, width * 0.32, height * 0.28, 0, 0, Math.PI * 2);
    context.stroke();
  } else if (type === UnitType.AIR) {
    context.beginPath();
    context.moveTo(left + width * 0.15, y);
    context.lineTo(left + width * 0.85, y);
    context.moveTo(x, top + height * 0.12);
    context.lineTo(x, top + height * 0.88);
    context.moveTo(left + width * 0.28, top + height * 0.78);
    context.lineTo(left + width * 0.72, top + height * 0.78);
    context.stroke();
  } else if (type === UnitType.CAVALRY) {
    context.beginPath();
    context.moveTo(left + width * 0.72, top);
    context.lineTo(left + width * 0.28, top + height);
    context.stroke();
  } else if (type === UnitType.ARTILLERY) {
    context.beginPath();
    context.arc(x, y, Math.min(width, height) * 0.16, 0, Math.PI * 2);
    context.stroke();
  } else if (type === UnitType.FORT) {
    context.beginPath();
    context.moveTo(left + width * 0.15, top + height * 0.75);
    context.lineTo(left + width * 0.15, top + height * 0.42);
    context.lineTo(left + width * 0.34, top + height * 0.42);
    context.lineTo(left + width * 0.34, top + height * 0.28);
    context.lineTo(left + width * 0.66, top + height * 0.28);
    context.lineTo(left + width * 0.66, top + height * 0.42);
    context.lineTo(left + width * 0.85, top + height * 0.42);
    context.lineTo(left + width * 0.85, top + height * 0.75);
    context.closePath();
    context.stroke();
  } else {
    context.beginPath();
    context.moveTo(left + width * 0.22, y);
    context.lineTo(left + width * 0.78, y);
    context.moveTo(x, top + height * 0.22);
    context.lineTo(x, top + height * 0.78);
    context.stroke();
  }
  context.restore();
};

const drawUnitCounter = (
  context: CanvasRenderingContext2D,
  unit: Unit,
  center: Point,
  counterSize = 50
) => {
  const counterLeft = center.x - counterSize / 2;
  const counterTop = center.y - counterSize / 2;
  const fill = countryFill[unit.country || ""] || (unit.side === Side.AXIS ? "#8f8f86" : "#4f73b8");
  const stroke = unit.side === Side.AXIS ? "#2b2925" : "#102445";

  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.38)";
  context.shadowBlur = 3;
  context.shadowOffsetY = 2;
  context.fillStyle = fill;
  context.strokeStyle = "#f6efe2";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(counterLeft, counterTop, counterSize, counterSize, 5);
  context.fill();
  context.stroke();
  context.restore();

  context.fillStyle = "rgba(8, 12, 14, 0.28)";
  context.fillRect(counterLeft + 2, counterTop + 2, counterSize - 4, 12);
  context.strokeStyle = "rgba(255,255,255,0.18)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(counterLeft + 3, counterTop + 14);
  context.lineTo(counterLeft + counterSize - 3, counterTop + 14);
  context.stroke();

  context.fillStyle = "#f6efe2";
  context.font = "800 8px system-ui, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(countryCounterCode(unit.country), counterLeft + 5, counterTop + 8);

  if (unit.reduced) {
    context.fillStyle = "#b91c1c";
    context.beginPath();
    context.moveTo(counterLeft + counterSize - 2, counterTop + 2);
    context.lineTo(counterLeft + counterSize - 15, counterTop + 2);
    context.lineTo(counterLeft + counterSize - 2, counterTop + 15);
    context.closePath();
    context.fill();
  }

  const symbolWidth = counterSize * 0.66;
  const symbolHeight = counterSize * 0.32;
  const symbolY = center.y - counterSize * 0.06;
  context.fillStyle = "rgba(246, 239, 226, 0.84)";
  context.strokeStyle = stroke;
  context.lineWidth = 1.2;
  context.beginPath();
  context.roundRect(center.x - symbolWidth / 2, symbolY - symbolHeight / 2, symbolWidth, symbolHeight, 2);
  context.fill();
  context.stroke();

  drawNatoSymbol(context, unit.type, center.x, symbolY, symbolWidth - 7, symbolHeight - 5);

  const label = unitCounterLabel(unit.name);
  context.fillStyle = "#ffffff";
  context.font = `900 ${label.length > 5 ? 9 : 11}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const hasMovementPip = unit.type !== UnitType.AIR && unit.type !== UnitType.FORT;
  context.fillText(label, center.x - (hasMovementPip ? counterSize * 0.12 : 0), counterTop + counterSize - 9);

  if (hasMovementPip) {
    context.fillStyle = "#f6efe2";
    context.beginPath();
    context.arc(counterLeft + counterSize - 10, counterTop + counterSize - 10, 8, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#111111";
    context.lineWidth = 1.2;
    context.stroke();
    context.fillStyle = "#111111";
    context.font = "800 10px system-ui, sans-serif";
    context.fillText(String(movementRemainingFor(unit)), counterLeft + counterSize - 10, counterTop + counterSize - 9.5);
  }

  if (unit.type === UnitType.AIR) {
    const sortiesSize = 15;
    const sortiesLeft = counterLeft + counterSize - sortiesSize - 3;
    const sortiesTop = counterTop + 3;
    context.fillStyle = "#f6efe2";
    context.fillRect(sortiesLeft, sortiesTop, sortiesSize, sortiesSize);
    context.strokeStyle = "#111111";
    context.lineWidth = 1.1;
    context.strokeRect(sortiesLeft, sortiesTop, sortiesSize, sortiesSize);
    context.fillStyle = "#111111";
    context.font = "800 9px system-ui, sans-serif";
    context.fillText(String(sortiesFor(unit)), sortiesLeft + sortiesSize / 2, sortiesTop + sortiesSize / 2 + 0.5);
  }
};

const polygonFor = (
  coord: HexCoord,
  hexWidth: number,
  hexHeight: number,
  columnStep: number,
  rowStep: number,
  rowShift: number,
  offsetX: number,
  offsetY: number
): Path2D => {
  const center = hexToPixel(coord, columnStep, rowStep, rowShift, offsetX, offsetY);
  const path = new Path2D();
  const points = [
    { x: 0, y: -hexHeight / 2 },
    { x: hexWidth / 2, y: -hexHeight / 4 },
    { x: hexWidth / 2, y: hexHeight / 4 },
    { x: 0, y: hexHeight / 2 },
    { x: -hexWidth / 2, y: hexHeight / 4 },
    { x: -hexWidth / 2, y: -hexHeight / 4 }
  ];

  points.forEach((point, i) => {
    const x = center.x + point.x;
    const y = center.y + point.y;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });

  path.closePath();
  return path;
};

export const GameBoard: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const selectedHex = useGameStore((state) => state.selectedHex);
  const selectedUnit = useGameStore((state) => state.selectedUnit);
  const attackMode = useGameStore((state) => state.attackMode);
  const validMoves = useGameStore((state) => state.validMoves);
  const mapEventPlacement = useGameStore((state) => state.mapEventPlacement);
  const privateMapLayer = useGameStore((state) => state.privateMapLayer);
  const clickHex = useGameStore((state) => state.clickHex);
  const selectWesternMedUnit = useGameStore((state) => state.selectWesternMedUnit);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const privateMapImageRef = useRef<HTMLImageElement | null>(null);
  const westMedUnitZonesRef = useRef<Array<{ unitId: string; left: number; top: number; size: number }>>([]);
  const [privateMapVersion, setPrivateMapVersion] = useState(0);
  const currentMapId = scenarioById(gameState?.scenarioId).mapId;

  useEffect(() => {
    (["strategic"] as const).forEach((name) => {
      const image = counterIcon(name);
      if (!image || image.complete) return;
      image.onload = () => setPrivateMapVersion((version) => version + 1);
    });
    ["AD", "MB", "PT", "SA"].forEach((label) => {
      const image = mapEventIcon(label);
      if (!image || image.complete) return;
      image.onload = () => setPrivateMapVersion((version) => version + 1);
    });
  }, []);

  const hexPaths = useMemo(() => {
    if (!gameState) return [];
    return Array.from(gameState.map.values()).map((hex) => ({
      hex,
      path: polygonFor(
        hex.coord,
        privateMapLayer.gridHexWidth,
        privateMapLayer.gridHexHeight,
        privateMapLayer.gridColumnStep,
        privateMapLayer.gridRowStep,
        privateMapLayer.gridRowShift,
        privateMapLayer.gridOffsetX,
        privateMapLayer.gridOffsetY
      )
    }));
  }, [
    gameState,
    privateMapLayer.gridColumnStep,
    privateMapLayer.gridHexHeight,
    privateMapLayer.gridHexWidth,
    privateMapLayer.gridOffsetX,
    privateMapLayer.gridOffsetY,
    privateMapLayer.gridRowShift,
    privateMapLayer.gridRowStep
  ]);

  useEffect(() => {
    if (!privateMapLayer.imageDataUrl) {
      privateMapImageRef.current = null;
      return;
    }

    const image = new Image();
    image.onload = () => {
      privateMapImageRef.current = image;
      setPrivateMapVersion((version) => version + 1);
    };
    image.src = privateMapLayer.imageDataUrl;
  }, [privateMapLayer.imageDataUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const mapHexes = Array.from(gameState.map.values());
    const maxPoint = mapHexes.reduce(
      (acc, hex) => {
        const pixel = hexToPixel(
          hex.coord,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        return { x: Math.max(acc.x, pixel.x), y: Math.max(acc.y, pixel.y) };
      },
      { x: 0, y: 0 }
    );

    const privateMap = privateMapImageRef.current;
    const privateMapRight = privateMap ? privateMapLayer.offsetX + privateMap.width * privateMapLayer.scale : 0;
    const privateMapBottom = privateMap ? privateMapLayer.offsetY + privateMap.height * privateMapLayer.scale : 0;
    const width = Math.ceil(Math.max(maxPoint.x + privateMapLayer.gridHexWidth, privateMapRight + 40));
    const height = Math.ceil(Math.max(maxPoint.y + privateMapLayer.gridHexHeight, privateMapBottom + 40));
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    westMedUnitZonesRef.current = [];
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    if (privateMap) {
      context.save();
      context.globalAlpha = privateMapLayer.opacity;
      context.drawImage(
        privateMap,
        privateMapLayer.offsetX,
        privateMapLayer.offsetY,
        privateMap.width * privateMapLayer.scale,
        privateMap.height * privateMapLayer.scale
      );
      context.restore();
    }

    hexPaths.forEach(({ hex, path }) => {
      const isSelected = selectedHex && hex.coord.q === selectedHex.q && hex.coord.r === selectedHex.r;
      const move = validMoves.find((item) => item.coord.q === hex.coord.q && item.coord.r === hex.coord.r);
      const isMove = Boolean(move);

      context.fillStyle =
        privateMap && !privateMapLayer.showProceduralTerrain
          ? "rgba(255, 255, 255, 0.01)"
          : terrainFill[hex.terrain];
      if (privateMap && privateMapLayer.showProceduralTerrain) {
        context.save();
        context.globalAlpha = privateMapLayer.proceduralTerrainOpacity;
        context.fill(path);
        context.restore();
      } else {
        context.fill(path);
      }
      if (privateMapLayer.showCountryColors && hex.features.country) {
        const cColor = countryFill[hex.features.country];
        if (cColor) {
          context.save();
          context.globalAlpha = 0.38;
          context.fillStyle = cColor;
          context.fill(path);
          context.restore();
        }
      }
      if (privateMapLayer.showGrid || isSelected) {
        context.lineWidth = isSelected ? 4 : 3;
        context.strokeStyle = isSelected ? "rgba(255, 224, 102, 0.55)" : "rgba(255, 255, 255, 0.35)";
        context.stroke(path);
        context.lineWidth = isSelected ? 2 : 1.4;
        context.strokeStyle = isSelected ? "#050505" : "rgba(0, 0, 0, 0.88)";
        context.stroke(path);
      }

      if (privateMapLayer.showGrid) {
        const center = hexToPixel(
          hex.coord,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        context.save();
        context.fillStyle = "rgba(0, 0, 0, 0.62)";
        context.font = "700 10px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(hexCodeForMap(hex.coord, currentMapId), center.x, center.y + privateMapLayer.gridHexHeight * 0.23);
        context.restore();
      }

      if (privateMapLayer.showGrid && hex.features.country) {
        const center = hexToPixel(
          hex.coord,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        const vertices = hexVertices(center, privateMapLayer.gridHexWidth, privateMapLayer.gridHexHeight);
        HEX_SIDES.forEach((side) => {
          const neighbor = neighborForSide(hex.coord, side);
          const neighborHex = gameState.map.get(coordKey(neighbor));
          const isMapEdge = !neighborHex;
          const neighborCountry = neighborHex?.features.country;
          const shouldDraw =
            (isMapEdge && hex.features.country) ||
            (neighborCountry && neighborCountry !== hex.features.country && coordKey(hex.coord) < coordKey(neighbor));
          if (!shouldDraw) return;
          const [start, end] = sideSegmentFor(vertices, side);
          drawCountryBorder(context, start, end, hex.features.country);
        });
      }

      if (isMove) {
        const isRetreat = gameState.pendingCombat?.kind === "retreat";
        if (isRetreat) {
          // 5.3.5: hex retreat → bordo rosso pieno. Il badge viene disegnato sopra le unità più avanti.
          context.save();
          context.lineWidth = 5;
          context.strokeStyle = "rgba(220, 38, 38, 0.9)";
          context.stroke(path);
          context.restore();
        } else {
          // Bordo giallo dell'hex per evidenziare l'opzione di movimento sotto eventuale unità.
          // Il numeretto del costo viene disegnato in un pass finale sopra le pedine.
          context.save();
          context.lineWidth = 3;
          context.strokeStyle = "rgba(255, 224, 102, 0.85)";
          context.stroke(path);
          context.restore();
        }
      }

      if (privateMapLayer.showProceduralTerrain && (hex.features.prohibited || hex.features.fadedDot)) {
        const center = hexToPixel(
          hex.coord,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        if (hex.features.prohibited) {
          context.strokeStyle = "rgba(95, 0, 0, 0.9)";
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(center.x - 13, center.y - 13);
          context.lineTo(center.x + 13, center.y + 13);
          context.moveTo(center.x + 13, center.y - 13);
          context.lineTo(center.x - 13, center.y + 13);
          context.stroke();
        } else {
          context.fillStyle = "rgba(60, 45, 35, 0.62)";
          context.beginPath();
          context.arc(center.x, center.y, 4.2, 0, Math.PI * 2);
          context.fill();
        }
      }

      if ((hex.terrain === TerrainType.CITY || hex.features.city) && (!privateMap || privateMapLayer.showProceduralTerrain)) {
        const center = hexToPixel(
          hex.coord,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        context.fillStyle = "#333842";
        context.fillRect(center.x - 9, center.y - 8, 18, 16);
        context.fillStyle = "#f2ece2";
        context.fillRect(center.x - 3, center.y - 8, 6, 16);
      }

      if (hex.features.port || hex.features.productionCenter || hex.features.capital) {
        const center = hexToPixel(
          hex.coord,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        const badges = [
          hex.features.port ? "P" : "",
          hex.features.productionCenter ? "F" : "",
          hex.features.capital ? "C" : ""
        ].filter(Boolean);

        context.fillStyle = "rgba(5, 5, 5, 0.82)";
        context.strokeStyle = "rgba(255, 255, 255, 0.75)";
        context.lineWidth = 1;
        badges.forEach((badge, index) => {
          const x = center.x - 18 + index * 12;
          const y = center.y + privateMapLayer.gridHexHeight * 0.18;
          context.beginPath();
          context.arc(x, y, 6, 0, Math.PI * 2);
          context.fill();
          context.stroke();
          context.fillStyle = "#ffffff";
          context.font = "700 8px system-ui, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(badge, x, y + 0.5);
          context.fillStyle = "rgba(5, 5, 5, 0.82)";
        });
      }

      if (privateMapLayer.showProceduralTerrain && (hex.railEdges || []).length >= 2) {
        const center = hexToPixel(
          hex.coord,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        const vertices = hexVertices(center, privateMapLayer.gridHexWidth, privateMapLayer.gridHexHeight);
        const railPoints = hex.railEdges.map((side) => sidePointFor(vertices, side));

        if (railPoints.length === 2) {
          drawRail(context, railPoints[0], railPoints[1]);
        } else {
          railPoints.forEach((point) => drawRail(context, center, point));
        }
      }
    });

    if (privateMapLayer.showProceduralTerrain) gameState.riverEdges.forEach((key) => {
      const [fromKey, toKey] = key.split("|");
      const fromHex = gameState.map.get(fromKey);
      const toHex = gameState.map.get(toKey);
      if (!fromHex || !toHex) return;

      const fromSide = sideBetween(fromHex.coord, toHex.coord);
      const toSide = sideBetween(toHex.coord, fromHex.coord);
      const riverHex = fromSide ? fromHex : toSide ? toHex : null;
      const riverSide = fromSide || toSide;
      if (!riverHex || !riverSide) return;

      const center = hexToPixel(
        riverHex.coord,
        privateMapLayer.gridColumnStep,
        privateMapLayer.gridRowStep,
        privateMapLayer.gridRowShift,
        privateMapLayer.gridOffsetX,
        privateMapLayer.gridOffsetY
      );
      const vertices = hexVertices(center, privateMapLayer.gridHexWidth, privateMapLayer.gridHexHeight);
      const [start, end] = sideSegmentFor(vertices, riverSide);
      drawRiver(context, start, end);
    });

    if (privateMapLayer.showProceduralTerrain) gameState.mountainEdges.forEach((key) => {
      const [fromKey, toKey] = key.split("|");
      const fromHex = gameState.map.get(fromKey);
      const toHex = gameState.map.get(toKey);
      if (!fromHex || !toHex) return;

      const fromSide = sideBetween(fromHex.coord, toHex.coord);
      const toSide = sideBetween(toHex.coord, fromHex.coord);
      const mountainHex = fromSide ? fromHex : toSide ? toHex : null;
      const mountainSide = fromSide || toSide;
      if (!mountainHex || !mountainSide) return;

      const center = hexToPixel(
        mountainHex.coord,
        privateMapLayer.gridColumnStep,
        privateMapLayer.gridRowStep,
        privateMapLayer.gridRowShift,
        privateMapLayer.gridOffsetX,
        privateMapLayer.gridOffsetY
      );
      const vertices = hexVertices(center, privateMapLayer.gridHexWidth, privateMapLayer.gridHexHeight);
      const [start, end] = sideSegmentFor(vertices, mountainSide);
      drawMountainEdge(context, start, end);
    });

    if (privateMapLayer.showProceduralTerrain) gameState.impassableEdges.forEach((key) => {
      const [fromKey, toKey] = key.split("|");
      const fromHex = gameState.map.get(fromKey);
      const toHex = gameState.map.get(toKey);
      if (!fromHex || !toHex) return;

      const fromSide = sideBetween(fromHex.coord, toHex.coord);
      const toSide = sideBetween(toHex.coord, fromHex.coord);
      const blockedHex = fromSide ? fromHex : toSide ? toHex : null;
      const blockedSide = fromSide || toSide;
      if (!blockedHex || !blockedSide) return;

      const center = hexToPixel(
        blockedHex.coord,
        privateMapLayer.gridColumnStep,
        privateMapLayer.gridRowStep,
        privateMapLayer.gridRowShift,
        privateMapLayer.gridOffsetX,
        privateMapLayer.gridOffsetY
      );
      const vertices = hexVertices(center, privateMapLayer.gridHexWidth, privateMapLayer.gridHexHeight);
      const [start, end] = sideSegmentFor(vertices, blockedSide);
      drawImpassableEdge(context, start, end);
    });

    if (privateMapLayer.showProceduralTerrain) gameState.straitEdges.forEach((key) => {
      const [fromKey, toKey] = key.split("|");
      const fromHex = gameState.map.get(fromKey);
      const toHex = gameState.map.get(toKey);
      if (!fromHex || !toHex) return;
      const fromSide = sideBetween(fromHex.coord, toHex.coord);
      const toSide = sideBetween(toHex.coord, fromHex.coord);
      const refHex = fromSide ? fromHex : toSide ? toHex : null;
      const refSide = fromSide || toSide;
      if (!refHex || !refSide) return;
      const center = hexToPixel(
        refHex.coord,
        privateMapLayer.gridColumnStep,
        privateMapLayer.gridRowStep,
        privateMapLayer.gridRowShift,
        privateMapLayer.gridOffsetX,
        privateMapLayer.gridOffsetY
      );
      const vertices = hexVertices(center, privateMapLayer.gridHexWidth, privateMapLayer.gridHexHeight);
      const [start, end] = sideSegmentFor(vertices, refSide);
      drawStraitEdge(context, start, end);
    });

    const mapUnits = Array.from(gameState.units.values()).filter(
      (unit) => unit.status !== UnitStatus.DESTROYED && (unit.mapPresence || "france") === "france"
    );
    const orderedUnitsInHex = (position: HexCoord): Unit[] =>
      mapUnits
        .filter((otherUnit) => otherUnit.mapPresence !== "off_map" && sameCoord(otherUnit.position, position))
        .sort((a, b) => {
          if (a.id === selectedUnit?.id) return 1;
          if (b.id === selectedUnit?.id) return -1;
          return 0;
        });
    const displayCenterForUnit = (unit: Unit): Point => {
      const baseCenter = hexToPixel(
        unit.position,
        privateMapLayer.gridColumnStep,
        privateMapLayer.gridRowStep,
        privateMapLayer.gridRowShift,
        privateMapLayer.gridOffsetX,
        privateMapLayer.gridOffsetY
      );
      const unitsInHex = orderedUnitsInHex(unit.position);
      const stackIndex = unitsInHex.findIndex((otherUnit) => otherUnit.id === unit.id);
      const stackOffset = stackIndex > 0 ? 13 : 0;
      return { x: baseCenter.x + stackOffset, y: baseCenter.y + stackOffset };
    };

    mapUnits
      .slice()
      .sort((a, b) => {
        if (a.id === selectedUnit?.id) return 1;
        if (b.id === selectedUnit?.id) return -1;
        return 0;
      })
      .filter((unit) => unit.status !== UnitStatus.DESTROYED && (unit.mapPresence || "france") === "france")
      .forEach((unit) => {
        const center = displayCenterForUnit(unit);
        const counterSize = 50;
        const counterLeft = center.x - counterSize / 2;
        const counterTop = center.y - counterSize / 2;
        drawUnitCounter(context, unit, center, counterSize);

        if (selectedUnit?.id === unit.id) {
          context.save();
          context.strokeStyle = "rgba(59, 130, 246, 0.98)";
          context.lineWidth = 4;
          context.strokeRect(counterLeft - 4, counterTop - 4, counterSize + 8, counterSize + 8);
          context.strokeStyle = "rgba(255,255,255,0.95)";
          context.lineWidth = 1.5;
          context.strokeRect(counterLeft - 2, counterTop - 2, counterSize + 4, counterSize + 4);
          context.restore();
        }

        // 5.3.3: Assault marker — freccia gialla che punta al target
        if (unit.assaultTarget) {
          const targetCenter = hexToPixel(
            unit.assaultTarget,
            privateMapLayer.gridColumnStep,
            privateMapLayer.gridRowStep,
            privateMapLayer.gridRowShift,
            privateMapLayer.gridOffsetX,
            privateMapLayer.gridOffsetY
          );
          const dx = targetCenter.x - center.x;
          const dy = targetCenter.y - center.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          // Punta della freccia: bordo dell'hex bersaglio (non il centro, per non coprirlo)
          const tipX = targetCenter.x - ux * (counterSize / 2 + 4);
          const tipY = targetCenter.y - uy * (counterSize / 2 + 4);
          // Coda: bordo del counter attaccante
          const tailX = center.x + ux * (counterSize / 2 + 2);
          const tailY = center.y + uy * (counterSize / 2 + 2);
          context.save();
          // ombra/contorno scuro per visibilità su mappa chiara
          context.strokeStyle = "rgba(0,0,0,0.7)";
          context.lineWidth = 7;
          context.lineCap = "round";
          context.beginPath();
          context.moveTo(tailX, tailY);
          context.lineTo(tipX, tipY);
          context.stroke();
          // freccia gialla
          context.strokeStyle = "#facc15";
          context.fillStyle = "#facc15";
          context.lineWidth = 4;
          context.beginPath();
          context.moveTo(tailX, tailY);
          context.lineTo(tipX, tipY);
          context.stroke();
          // arrowhead più grande
          const headSize = 12;
          context.beginPath();
          context.moveTo(tipX, tipY);
          context.lineTo(tipX - ux * headSize + uy * (headSize * 0.6), tipY - uy * headSize - ux * (headSize * 0.6));
          context.lineTo(tipX - ux * headSize - uy * (headSize * 0.6), tipY - uy * headSize + ux * (headSize * 0.6));
          context.closePath();
          context.fill();
          context.strokeStyle = "rgba(0,0,0,0.7)";
          context.lineWidth = 1.5;
          context.stroke();
          context.restore();
        }

        // 4.1: Strategic Move marker — pallino blu in alto a sinistra
        if (unit.strategicMove) {
          context.save();
          const strategicIcon = counterIcon("strategic");
          if (strategicIcon?.complete && strategicIcon.naturalWidth > 0) {
            context.fillStyle = "#f6efe2";
            context.strokeStyle = "#082f49";
            context.lineWidth = 1.1;
            context.beginPath();
            context.roundRect(counterLeft + 2, counterTop + 2, 14, 14, 3);
            context.fill();
            context.stroke();
            context.drawImage(strategicIcon, counterLeft + 3, counterTop + 3, 12, 12);
          } else {
            context.fillStyle = "#0ea5e9";
            context.strokeStyle = "#082f49";
            context.lineWidth = 1.2;
            context.beginPath();
            context.arc(counterLeft + 8, counterTop + 8, 6, 0, Math.PI * 2);
            context.fill();
            context.stroke();
            context.fillStyle = "#ffffff";
            context.font = "800 8px system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText("S", counterLeft + 8, counterTop + 8.5);
          }
          context.restore();
        }

        // 6.3: activated marker — overlay grigio semitrasparente
        if (unit.activated) {
          context.save();
          context.fillStyle = "rgba(0, 0, 0, 0.35)";
          context.fillRect(counterLeft, counterTop, counterSize, counterSize);
          context.restore();
        }

        // 7.1: Low / No Supply marker — pallino arancio/rosso in basso a sx
        const supply = unit.supplyState;
        if (supply === "low" || supply === "no") {
          context.save();
          context.fillStyle = supply === "low" ? "#f59e0b" : "#dc2626";
          context.strokeStyle = "#451a03";
          context.lineWidth = 1.4;
          context.beginPath();
          context.arc(counterLeft + 8, counterTop + counterSize - 8, 7, 0, Math.PI * 2);
          context.fill();
          context.stroke();
          context.fillStyle = "#ffffff";
          context.font = "800 9px system-ui, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(supply === "low" ? "LS" : "NS", counterLeft + 8, counterTop + counterSize - 8 + 0.5);
          context.restore();
        }
      });

      const drawMapBoxUnits = (presence: "west_med" | "central_med" | "east_na", rowOffset: number) => {
        const boxUnits = Array.from(gameState.units.values()).filter(
          (unit) => unit.status !== UnitStatus.DESTROYED && unit.mapPresence === presence
        );
        if (boxUnits.length === 0) return;
        const privateMap = privateMapImageRef.current;
        const mapBottom = privateMap ? privateMapLayer.offsetY + privateMap.height * privateMapLayer.scale : height;
        const mapRight = privateMap ? privateMapLayer.offsetX + privateMap.width * privateMapLayer.scale : width;
        const startX = presence === "east_na"
          ? Math.max(50, privateMapLayer.offsetX + (privateMap ? privateMap.width * privateMapLayer.scale * 0.39 : width * 0.39))
          : presence === "central_med" && (gameState.scenarioId === "italy1943" || gameState.scenarioId === "italy1943Include")
          ? Math.max(50, mapRight - 220)
          : Math.max(50, privateMapLayer.offsetX + 118);
        const startY = Math.max(privateMapLayer.gridOffsetY + privateMapLayer.gridRowStep * (9.4 + rowOffset), mapBottom - 155 + rowOffset * 58);
        const columns = 3;
        boxUnits.forEach((unit, index) => {
          const center = {
            x: startX + (index % columns) * 58,
            y: startY + Math.floor(index / columns) * 58
          };
          const size = 50;
          westMedUnitZonesRef.current.push({ unitId: unit.id, left: center.x - size / 2, top: center.y - size / 2, size });
          drawUnitCounter(context, unit, center, size);
        });
      };
      drawMapBoxUnits("west_med", 0);
      drawMapBoxUnits("central_med", gameState.scenarioId === "italy1943" || gameState.scenarioId === "italy1943Include" ? 0 : 1);
      drawMapBoxUnits("east_na", 0);

      if (gameState.phase === GamePhase.OPERATIONS && gameState.subPhase === GameSubPhase.SUPPLY_CHECK) {
        Array.from(gameState.units.values())
          .filter((unit) =>
            unit.side === gameState.currentSide &&
            unit.status !== UnitStatus.DESTROYED &&
            unit.type !== UnitType.AIR &&
            unit.type !== UnitType.FORT &&
            (unit.mapPresence || "france") === "france"
          )
          .forEach((unit) => {
            const fromCenter = hexToPixel(
              unit.position,
              privateMapLayer.gridColumnStep,
              privateMapLayer.gridRowStep,
              privateMapLayer.gridRowShift,
              privateMapLayer.gridOffsetX,
              privateMapLayer.gridOffsetY
            );
            const supply = unit.supplyState || "full";
            const color = supply === "no" ? "#dc2626" : supply === "low" ? "#f59e0b" : "#22c55e";

            if (unit.supplyPath && unit.supplyPath.length > 1) {
              const pathCenters = unit.supplyPath.map((coord) => hexToPixel(
                coord,
                privateMapLayer.gridColumnStep,
                privateMapLayer.gridRowStep,
                privateMapLayer.gridRowShift,
                privateMapLayer.gridOffsetX,
                privateMapLayer.gridOffsetY
              ));
              context.save();
              context.strokeStyle = "rgba(0, 0, 0, 0.72)";
              context.lineWidth = 5;
              context.lineCap = "round";
              context.lineJoin = "round";
              context.setLineDash([8, 5]);
              context.beginPath();
              pathCenters.forEach((point, index) => {
                if (index === 0) context.moveTo(point.x, point.y);
                else context.lineTo(point.x, point.y);
              });
              context.stroke();
              context.strokeStyle = color;
              context.lineWidth = 2.5;
              context.beginPath();
              pathCenters.forEach((point, index) => {
                if (index === 0) context.moveTo(point.x, point.y);
                else context.lineTo(point.x, point.y);
              });
              context.stroke();
              context.setLineDash([]);
              const sourcePoint = pathCenters[pathCenters.length - 1];
              context.fillStyle = color;
              context.strokeStyle = "rgba(0, 0, 0, 0.72)";
              context.lineWidth = 2;
              context.beginPath();
              context.arc(sourcePoint.x, sourcePoint.y, 6, 0, Math.PI * 2);
              context.fill();
              context.stroke();
              context.restore();
            }

            context.save();
            context.strokeStyle = color;
            context.lineWidth = supply === "full" ? 2 : 4;
            context.shadowColor = color;
            context.shadowBlur = supply === "full" ? 4 : 10;
            context.beginPath();
            context.roundRect(fromCenter.x - 30, fromCenter.y - 30, 60, 60, 6);
            context.stroke();
            context.restore();
          });
      }

      const pendingCombat = gameState.pendingCombat;
      if (pendingCombat?.kind === "commit") {
        const defender = gameState.units.get(pendingCombat.defenderId);
        const targetCenter = defender
          ? hexToPixel(
            defender.position,
            privateMapLayer.gridColumnStep,
            privateMapLayer.gridRowStep,
            privateMapLayer.gridRowShift,
            privateMapLayer.gridOffsetX,
            privateMapLayer.gridOffsetY
          )
          : null;

        const centerForAirSupport = (unitId?: string): Point | null => {
          if (!unitId) return null;
          const unit = gameState.units.get(unitId);
          if (!unit || unit.status === UnitStatus.DESTROYED || unit.type !== UnitType.AIR) return null;
          if ((unit.mapPresence || "france") === "france") {
            return hexToPixel(
              unit.position,
              privateMapLayer.gridColumnStep,
              privateMapLayer.gridRowStep,
              privateMapLayer.gridRowShift,
              privateMapLayer.gridOffsetX,
              privateMapLayer.gridOffsetY
            );
          }
          if (unit.mapPresence === "west_med" || unit.mapPresence === "central_med") {
            const zone = westMedUnitZonesRef.current.find((item) => item.unitId === unit.id);
            return zone ? { x: zone.left + zone.size / 2, y: zone.top + zone.size / 2 } : null;
          }
          return null;
        };

        const drawAirSupportArrow = (unitId: string | undefined, color: string) => {
          if (!targetCenter) return;
          const fromCenter = centerForAirSupport(unitId);
          if (!fromCenter) return;
          drawAttackArrow(context, fromCenter, targetCenter, color, 50, 3);
          const mid = { x: (fromCenter.x + targetCenter.x) / 2, y: (fromCenter.y + targetCenter.y) / 2 };
          context.save();
          context.fillStyle = "rgba(11, 17, 20, 0.88)";
          context.strokeStyle = color;
          context.lineWidth = 1.4;
          context.beginPath();
          context.roundRect(mid.x - 12, mid.y - 9, 24, 18, 4);
          context.fill();
          context.stroke();
          context.fillStyle = "#ffffff";
          context.font = "900 10px system-ui, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText("AS", mid.x, mid.y + 0.5);
          context.restore();
        };

        // Evidenzia le unità aeree eleggibili per il lato corrente che deve committare
        const committingSide = pendingCombat.stage === "attacker"
          ? gameState.units.get(pendingCombat.attackerId)?.side
          : gameState.units.get(pendingCombat.defenderId)?.side;
        const committedAirId = pendingCombat.stage === "attacker"
          ? pendingCombat.airSupportAttackerId
          : pendingCombat.airSupportDefenderId;
        if (committingSide && !committedAirId) {
          const eligibleAir = getEligibleAirSupporters(
            gameState, pendingCombat.attackerId, pendingCombat.defenderId,
            pendingCombat.additionalAttackerIds, committingSide
          ).filter((u) => (u.mapPresence || "france") === "france");
          eligibleAir.forEach((u) => {
            const center = displayCenterForUnit(u);
            const size = 50;
            const left = center.x - size / 2;
            const top = center.y - size / 2;
            context.save();
            context.strokeStyle = committingSide === Side.AXIS ? "#38bdf8" : "#fbbf24";
            context.lineWidth = 5;
            context.shadowColor = committingSide === Side.AXIS ? "#38bdf8" : "#fbbf24";
            context.shadowBlur = 14;
            context.beginPath();
            context.roundRect(left - 7, top - 7, size + 14, size + 14, 8);
            context.stroke();
            context.strokeStyle = "#ffffff";
            context.lineWidth = 1.7;
            context.shadowBlur = 0;
            context.strokeRect(left - 3, top - 3, size + 6, size + 6);
            context.restore();
          });
        }

        drawAirSupportArrow(pendingCombat.airSupportAttackerId, "#38bdf8");
        drawAirSupportArrow(pendingCombat.airSupportDefenderId, "#fbbf24");
      }

      const currentSelectedUnit = selectedUnit ? gameState.units.get(selectedUnit.id) : undefined;
      const showMobileAttackPreview =
        currentSelectedUnit &&
        attackMode === "mobile" &&
        currentSelectedUnit.type !== UnitType.AIR &&
        currentSelectedUnit.type !== UnitType.FORT &&
        !gameState.pendingCombat;

      if (showMobileAttackPreview) {
        const fromCenter = hexToPixel(
          currentSelectedUnit.position,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );

        validMoves.forEach((move) => {
          const enemyOnHex = Array.from(gameState.units.values()).find(
            (unit) =>
              unit.status !== UnitStatus.DESTROYED &&
              unit.side !== currentSelectedUnit.side &&
              unit.type !== UnitType.FORT &&
              sameCoord(unit.position, move.coord)
          );
          if (!enemyOnHex) return;

          const targetCenter = hexToPixel(
            move.coord,
            privateMapLayer.gridColumnStep,
            privateMapLayer.gridRowStep,
            privateMapLayer.gridRowShift,
            privateMapLayer.gridOffsetX,
            privateMapLayer.gridOffsetY
          );
          drawAttackArrow(context, fromCenter, targetCenter, "#ef4444", 50, 4);
        });
      }

      validMoves.forEach((move) => {
        const center = hexToPixel(
          move.coord,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        const badgeY = center.y - Math.max(36, privateMapLayer.gridHexHeight * 0.48);
        const isRetreat = gameState.pendingCombat?.kind === "retreat";
        const isMapEvent = Boolean(mapEventPlacement);
        const eventLabel = mapEventPlacement?.markerId.toLowerCase().includes("airdrop")
          ? "AD"
          : mapEventPlacement?.markerId.toLowerCase().includes("mulberry")
            ? "MB"
            : mapEventPlacement?.markerId.toLowerCase().includes("partisans")
              ? "PT"
              : mapEventPlacement?.markerId.toLowerCase().includes("surprise")
                ? "SA"
                : mapEventPlacement?.markerId.toLowerCase().includes("strategic")
                  ? "SM"
                  : mapEventPlacement?.markerId.toLowerCase().includes("naval evacuation")
                    ? "NV"
                    : "EV";

        context.save();
        context.fillStyle = isRetreat
          ? "rgba(248, 113, 113, 0.98)"
          : isMapEvent
            ? "rgba(96, 165, 250, 0.98)"
            : "rgba(255, 224, 102, 0.98)";
        context.beginPath();
        context.arc(center.x, badgeY, isRetreat || isMapEvent ? 16 : 11, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = isRetreat ? "#7f1d1d" : isMapEvent ? "#172554" : "#111111";
        context.lineWidth = isRetreat || isMapEvent ? 2.8 : 1.5;
        context.stroke();
        context.fillStyle = isRetreat || isMapEvent ? "#ffffff" : "#111111";
        context.font = isRetreat || isMapEvent ? "900 15px system-ui, sans-serif" : "800 11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(isRetreat ? "R" : isMapEvent ? eventLabel : String(move.cost || 0), center.x, badgeY + 0.5);
        context.restore();
      });

      const drawMapEventMarker = (key: string, label: string, fill: string) => {
        const [q, r] = key.split(",").map(Number);
        if (!Number.isFinite(q) || !Number.isFinite(r)) return;
        const center = hexToPixel(
          { q, r },
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        const icon = mapEventIcon(label);
        context.save();
        if (icon?.complete && icon.naturalWidth > 0) {
          context.fillStyle = "rgba(17, 24, 39, 0.72)";
          context.strokeStyle = "#fef3c7";
          context.lineWidth = 1.8;
          context.beginPath();
          context.roundRect(center.x - 21, center.y + 4, 42, 42, 6);
          context.fill();
          context.stroke();
          context.drawImage(icon, center.x - 18, center.y + 7, 36, 36);
        } else {
          context.fillStyle = fill;
          context.strokeStyle = "#fef3c7";
          context.lineWidth = 1.8;
          context.beginPath();
          context.roundRect(center.x - 18, center.y + 8, 36, 24, 5);
          context.fill();
          context.stroke();
          context.fillStyle = "#ffffff";
          context.font = "900 13px system-ui, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(label, center.x, center.y + 20);
        }
        context.restore();
      };

      Object.values(gameState.airdropMarkers || {}).forEach((keys) => keys?.forEach((key) => drawMapEventMarker(key, "AD", "#1d4ed8")));
      Object.values(gameState.mulberryMarkers || {}).forEach((keys) => keys?.forEach((key) => drawMapEventMarker(key, "MB", "#0e7490")));
      Object.values(gameState.partisansMarkers || {}).forEach((keys) => keys?.forEach((key) => drawMapEventMarker(key, "PT", "#166534")));
      Object.values(gameState.surpriseAttackMarkers || {}).forEach((keys) => keys?.forEach((key) => drawMapEventMarker(key, "SA", "#991b1b")));

      // Control markers (12.1 / 1.3.1): pedina nella parte alta dell'hex se è città/forte/centro produzione
      // sotto controllo di una fazione. Colore in base al lato.
      gameState.map.forEach((hex) => {
        const claimable = hex.features.city || hex.features.capital || hex.features.productionCenter || hex.features.port;
        if (!claimable) return;
        const controller = hex.features.controller;
        if (!controller || controller === "neutral") return;
        const center = hexToPixel(
          hex.coord,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        const isAxis = controller === Side.AXIS;
        const fill = isAxis ? "#7f1d1d" : "#1e3a8a";
        const label = isAxis ? "AX" : "AL";
        const w = 22;
        const h = 14;
        const left = center.x - w / 2;
        const top = center.y - privateMapLayer.gridHexHeight / 2 + 4;
        context.save();
        context.fillStyle = fill;
        context.strokeStyle = "#fef3c7";
        context.lineWidth = 1.4;
        context.beginPath();
        context.roundRect(left, top, w, h, 3);
        context.fill();
        context.stroke();
        context.fillStyle = "#fef3c7";
        context.font = "800 9px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(label, left + w / 2, top + h / 2 + 0.5);
        context.restore();
      });

      // 14.8: No EZOC marker — cerchio rosso barrato sulla hex
      gameState.map.forEach((hex) => {
        if (!hex.noEzocMarker) return;
        const center = hexToPixel(
          hex.coord,
          privateMapLayer.gridColumnStep,
          privateMapLayer.gridRowStep,
          privateMapLayer.gridRowShift,
          privateMapLayer.gridOffsetX,
          privateMapLayer.gridOffsetY
        );
        context.save();
        context.strokeStyle = "#dc2626";
        context.lineWidth = 2.5;
        context.beginPath();
        context.arc(center.x - 18, center.y + 18, 8, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.moveTo(center.x - 24, center.y + 12);
        context.lineTo(center.x - 12, center.y + 24);
        context.stroke();
        context.restore();
      });
  }, [gameState, hexPaths, mapEventPlacement, privateMapLayer, privateMapVersion, selectedHex, validMoves]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const bounds = canvas.getBoundingClientRect();
    // isPointInPath() uses canvas pixel coordinates (device pixels), not CSS logical pixels.
    // Convert: first from rendered CSS pixels to logical CSS pixels (in case CSS scales the canvas),
    // then multiply by devicePixelRatio to get canvas pixel coordinates.
    const ratio = window.devicePixelRatio || 1;
    const styleWidth = parseFloat(canvas.style.width) || bounds.width;
    const styleHeight = parseFloat(canvas.style.height) || bounds.height;
    const scaleX = (styleWidth / bounds.width) * ratio;
    const scaleY = (styleHeight / bounds.height) * ratio;
    const x = (event.clientX - bounds.left) * scaleX;
    const y = (event.clientY - bounds.top) * scaleY;
    // westMedUnitZones are stored in logical CSS pixels — compare without ratio
    const logicalX = x / ratio;
    const logicalY = y / ratio;
    const westMedHit = westMedUnitZonesRef.current.find(
      (zone) => logicalX >= zone.left && logicalX <= zone.left + zone.size && logicalY >= zone.top && logicalY <= zone.top + zone.size
    );
    if (westMedHit) {
      selectWesternMedUnit(westMedHit.unitId);
      return;
    }
    const hit = hexPaths.find(({ path }) => context.isPointInPath(path, x, y));
    if (hit) clickHex(hit.hex.coord);
  };

  if (!gameState) {
    return (
      <div className={styles.boardContainer}>
        <p className={styles.loadingText}>Initializing game board...</p>
      </div>
    );
  }

  return (
    <div className={styles.boardContainer}>
      <canvas ref={canvasRef} id="gameCanvas" className={styles.canvas} onClick={handleCanvasClick} />
    </div>
  );
};
