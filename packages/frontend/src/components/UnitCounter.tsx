import React from "react";
import { Side, Unit, UnitType } from "@uswc/shared";

const COUNTRY_FILL: Record<string, string> = {
  Germany: "#8f8f86", France: "#4f73b8", UK: "#9b6a45", USA: "#6f8fc8",
  Belgium: "#d59a3d", Netherlands: "#d88934", Italy: "#57745a",
  Hungary: "#b9a263", Romania: "#b9854b", Bulgaria: "#7c8b58",
  Greece: "#5f86bd", Yugoslavia: "#6e78aa", Albania: "#9a5d4f",
  USSR: "#a3433a", Finland: "#7fa3c9", Estonia: "#9bc4d2",
  Latvia: "#8dba9b", Lithuania: "#c4a76a", Poland: "#cf9b5a"
};

const COUNTRY_CODE: Record<string, string> = {
  Germany: "GE", France: "FR", UK: "UK", USA: "US", Belgium: "BE",
  Netherlands: "NL", Italy: "IT", Hungary: "HU", Romania: "RO",
  Bulgaria: "BU", Greece: "GR", Yugoslavia: "YU", Albania: "AL",
  USSR: "SU", Finland: "FI", Estonia: "EE", Latvia: "LV",
  Lithuania: "LT", Poland: "PL"
};

const counterLabel = (name: string): string => {
  const id = name.replace(/^(Germany|France|UK|USA|Belgium|Netherlands|Italy|Hungary|Romania|Bulgaria|Greece|Yugoslavia|Albania|USSR|Finland|Estonia|Latvia|Lithuania|Poland)\s+/, "");
  if (id === "Maginot Fort") return "Fort";
  return id.replace(/\s+/g, "");
};

const NatoSymbol: React.FC<{ type: UnitType; size: number }> = ({ type, size }) => {
  const w = size * 0.62;
  const h = size * 0.30;
  const cx = size / 2;
  const cy = size * 0.50;
  const l = cx - w / 2, r = cx + w / 2, t = cy - h / 2, b = cy + h / 2;

  const stroke = { stroke: "#050505", strokeWidth: 1.5, fill: "rgba(246,239,226,0.84)", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <g>
      <rect x={l} y={t} width={w} height={h} rx={1.5} {...stroke} />
      {type === UnitType.INFANTRY && <>
        <line x1={l} y1={t} x2={r} y2={b} stroke="#050505" strokeWidth={1.5} />
        <line x1={r} y1={t} x2={l} y2={b} stroke="#050505" strokeWidth={1.5} />
      </>}
      {type === UnitType.ARMOR && <ellipse cx={cx} cy={cy} rx={w * 0.28} ry={h * 0.34} fill="none" stroke="#050505" strokeWidth={1.5} />}
      {type === UnitType.AIR && <>
        <line x1={l + w * 0.12} y1={cy} x2={r - w * 0.12} y2={cy} stroke="#050505" strokeWidth={1.5} />
        <line x1={cx} y1={t + h * 0.1} x2={cx} y2={b - h * 0.1} stroke="#050505" strokeWidth={1.5} />
        <line x1={l + w * 0.25} y1={b - h * 0.18} x2={r - w * 0.25} y2={b - h * 0.18} stroke="#050505" strokeWidth={1.5} />
      </>}
      {type === UnitType.ARTILLERY && <circle cx={cx} cy={cy} r={Math.min(w, h) * 0.18} fill="none" stroke="#050505" strokeWidth={1.5} />}
      {type === UnitType.FORT && <path d={`M${l + w * 0.15} ${b - h * 0.1} L${l + w * 0.15} ${cy} L${l + w * 0.34} ${cy} L${l + w * 0.34} ${t + h * 0.15} L${r - w * 0.34} ${t + h * 0.15} L${r - w * 0.34} ${cy} L${r - w * 0.15} ${cy} L${r - w * 0.15} ${b - h * 0.1} Z`} fill="none" stroke="#050505" strokeWidth={1.5} />}
    </g>
  );
};

interface UnitCounterProps {
  unit: Pick<Unit, "name" | "type" | "side" | "country" | "reduced" | "sorties">;
  size?: number;
}

export const UnitCounter: React.FC<UnitCounterProps> = ({ unit, size = 44 }) => {
  const fill = COUNTRY_FILL[unit.country || ""] || (unit.side === Side.AXIS ? "#8f8f86" : "#4f73b8");
  const code = COUNTRY_CODE[unit.country || ""] || (unit.country || "").slice(0, 2).toUpperCase();
  const label = counterLabel(unit.name);
  const fontSize = label.length > 5 ? size * 0.18 : size * 0.22;
  const r = size * 0.1;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", flexShrink: 0 }}>
      {/* Shadow */}
      <rect x={2} y={3} width={size - 4} height={size - 4} rx={r} fill="rgba(0,0,0,0.35)" />
      {/* Body */}
      <rect x={1} y={1} width={size - 2} height={size - 2} rx={r} fill={fill} stroke="#f6efe2" strokeWidth={1.5} />
      {/* Header band */}
      <rect x={2} y={2} width={size - 4} height={size * 0.27} rx={r * 0.5} fill="rgba(8,12,14,0.28)" />
      {/* Country code */}
      <text x={5} y={size * 0.19} fill="#f6efe2" fontSize={size * 0.17} fontWeight={800} fontFamily="system-ui,sans-serif" dominantBaseline="middle">{code}</text>
      {/* Reduced corner */}
      {unit.reduced && <path d={`M${size - 2} 2 L${size - size * 0.3} 2 L${size - 2} ${size * 0.3} Z`} fill="#b91c1c" />}
      {/* NATO symbol */}
      <NatoSymbol type={unit.type} size={size} />
      {/* Unit label */}
      <text x={unit.type === UnitType.AIR ? size / 2 - size * 0.1 : size / 2} y={size - size * 0.14} fill="#ffffff" fontSize={fontSize} fontWeight={900} fontFamily="system-ui,sans-serif" textAnchor="middle" dominantBaseline="middle">{label}</text>
      {/* Air sorties box */}
      {unit.type === UnitType.AIR && (
        <>
          <rect x={size - size * 0.35} y={size * 0.05} width={size * 0.30} height={size * 0.30} fill="#f6efe2" stroke="#111" strokeWidth={1} />
          <text x={size - size * 0.20} y={size * 0.205} fill="#111" fontSize={size * 0.18} fontWeight={800} fontFamily="system-ui,sans-serif" textAnchor="middle" dominantBaseline="middle">{unit.sorties ?? 0}</text>
        </>
      )}
    </svg>
  );
};
