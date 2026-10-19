import { useState } from "react";
import { formatNumber, shortDay } from "../format.js";

// Single-series bar chart: successful logins per day (last 14 days).
// One series -> no legend (title names it). Hover tooltip per bar. Table view for accessibility.

const W = 560;
const H = 220;
const PAD = { top: 16, right: 8, bottom: 28, left: 32 };

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export default function SignupsChart({ data }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">عمليات الدخول في آخر 14 يوم</h2>
        <button className="btn btn-small btn-ghost" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "عرض كرسم" : "عرض كجدول"}
        </button>
      </div>

      {!data ? (
        <div className="skeleton" style={{ height: H }} />
      ) : asTable ? (
        <table className="mini-table">
          <thead>
            <tr><th>اليوم</th><th>عمليات الدخول</th></tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.date}><td>{shortDay(d.date)}</td><td className="num">{formatNumber(d.count)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Chart data={data} hover={hover} setHover={setHover} />
      )}
    </section>
  );
}

// Keep the tooltip inside the card near the edges.
function tooltipPos(pct) {
  if (pct > 80) return { left: `${pct}%`, transform: "translate(-100%, -4px)" };
  if (pct < 20) return { left: `${pct}%`, transform: "translate(0, -4px)" };
  return { left: `${pct}%` };
}

function Chart({ data, hover, setHover }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.count)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.max(4, Math.min(28, slot - 2)); // >= 2px surface gap between bars
  const y = (v) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];

  // Chart reads left -> right in time even in an RTL page.
  return (
    <div className="chart-wrap" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="عدد عمليات الدخول الناجحة في كل يوم" className="chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tick">
              {formatNumber(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const top = y(d.count);
          const h = PAD.top + innerH - top;
          const r = Math.min(4, h / 2, barW / 2);
          const x0 = cx - barW / 2;
          const base = PAD.top + innerH;
          // bar with 4px rounded top, square at the baseline
          const path =
            h <= 0
              ? null
              : `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base} Z`;
          const showLabel = (data.length - 1 - i) % 3 === 0; // every 3rd day, counted back from today
          return (
            <g key={d.date}>
              {path && <path d={path} className={`bar ${hover === i ? "bar-hover" : ""}`} />}
              {showLabel && (
                <text x={cx} y={H - 8} textAnchor="middle" className="tick">
                  {shortDay(d.date)}
                </text>
              )}
              {/* hit target bigger than the mark */}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div
          className="tooltip"
          style={tooltipPos(((PAD.left + slot * hover + slot / 2) / W) * 100)}
          role="status"
        >
          <strong className="num">{formatNumber(data[hover].count)}</strong> دخول
          <span className="muted"> · {shortDay(data[hover].date)}</span>
        </div>
      )}
    </div>
  );
}
