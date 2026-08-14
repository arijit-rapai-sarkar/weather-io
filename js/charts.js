'use strict';
// ============================================================
// WeatherIQ — Lightweight SVG Chart Engine
// No external dependencies. All charts are inline SVG.
// ============================================================

const Charts = (() => {

  // ── Shared helpers ──────────────────────────────────────────
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function normalize(values) {
    const lo  = Math.min(...values);
    const hi  = Math.max(...values);
    const rng = hi - lo || 1;
    return values.map(v => (v - lo) / rng);
  }

  function svgPoints(values, w, h, pad = 4) {
    const norm = normalize(values);
    return norm.map((n, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - n * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  // Smooth bezier path from point array
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx  = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }

  function parsePoints(values, w, h, pad = 6) {
    const norm = normalize(values);
    return norm.map((n, i) => ({
      x: pad + (i / (values.length - 1)) * (w - pad * 2),
      y: h - pad - n * (h - pad * 2),
    }));
  }

  // ── Sparkline ───────────────────────────────────────────────
  function sparkline(values, { w = 80, h = 32, color = '#3B82F6', fill = true } = {}) {
    if (!values || values.length < 2) return '';
    const pts  = parsePoints(values, w, h);
    const path = smoothPath(pts);

    const last    = pts[pts.length - 1];
    const fillArea = fill
      ? `<path d="${path} L ${last.x} ${h} L ${pts[0].x} ${h} Z"
              fill="${color}" fill-opacity="0.12" stroke="none"/>`
      : '';

    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${fillArea}
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last.x}" cy="${last.y}" r="2.5"
              fill="${color}" stroke="white" stroke-width="1.5"/>
    </svg>`;
  }

  // ── Mini bar chart ───────────────────────────────────────────
  function rainBars(values, { w = 120, h = 28, color = '#60A5FA' } = {}) {
    if (!values || values.length === 0) return '';
    const barW = Math.floor((w - 4) / values.length) - 2;
    const bars = values.map((v, i) => {
      const barH = Math.round((v / 100) * (h - 2));
      const x    = 2 + i * (barW + 2);
      const y    = h - barH;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}"
                    rx="2" fill="${color}" fill-opacity="0.7"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${bars}
    </svg>`;
  }

  // ── 24 h area chart ──────────────────────────────────────────
  function areaChart(values, labels, {
    color    = '#3B82F6',
    fillFrom = '#3B82F6',
    unit     = '°C',
    w        = 460,
    h        = 140,
    showDots = false,
  } = {}) {
    if (!values || values.length < 2) return '<p class="chart-empty">No data</p>';

    const pad   = { t: 16, r: 16, b: 32, l: 36 };
    const cw    = w - pad.l - pad.r;
    const ch    = h - pad.t - pad.b;
    const lo    = Math.min(...values);
    const hi    = Math.max(...values);
    const rng   = hi - lo || 1;

    const pts = values.map((v, i) => ({
      x: pad.l + (i / (values.length - 1)) * cw,
      y: pad.t + (1 - (v - lo) / rng) * ch,
      v,
    }));

    const linePath = smoothPath(pts);
    const last     = pts[pts.length - 1];
    const areaPath = `${linePath} L ${last.x} ${pad.t + ch} L ${pts[0].x} ${pad.t + ch} Z`;

    // Y-axis labels
    const yTicks = [lo, (lo + hi) / 2, hi].map((v, i) => {
      const y = pad.t + (1 - (v - lo) / rng) * ch;
      return `<text x="${pad.l - 6}" y="${y + 4}" text-anchor="end"
                    font-size="10" fill="var(--text-3)">${Math.round(v)}${unit}</text>`;
    }).join('');

    // X-axis labels (every 4th label)
    const xLabels = labels
      ? labels.map((lbl, i) => {
          if (i % Math.ceil(labels.length / 6) !== 0) return '';
          const x = pad.l + (i / (labels.length - 1)) * cw;
          return `<text x="${x}" y="${h - 4}" text-anchor="middle"
                        font-size="10" fill="var(--text-3)">${lbl}</text>`;
        }).join('')
      : '';

    // Dots
    const dots = showDots
      ? pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3"
                               fill="${color}" stroke="white" stroke-width="1.5"/>`).join('')
      : `<circle cx="${last.x}" cy="${last.y}" r="4"
                 fill="${color}" stroke="white" stroke-width="2"/>`;

    // Tooltip-ready data points (invisible but hoverable)
    const tooltipDots = pts.map((p, i) => `
      <circle cx="${p.x}" cy="${p.y}" r="10" fill="transparent" class="chart-hover-dot"
              data-val="${p.v}" data-label="${labels?.[i] || i}"/>
    `).join('');

    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}"
                 xmlns="http://www.w3.org/2000/svg" style="display:block" role="img"
                 aria-label="Sensor history chart">
      <defs>
        <linearGradient id="chartGrad-${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${fillFrom}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${fillFrom}" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <!-- Grid lines -->
      ${[0, 0.5, 1].map(t => {
        const gy = pad.t + t * ch;
        return `<line x1="${pad.l}" y1="${gy}" x2="${pad.l + cw}" y2="${gy}"
                      stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4"/>`;
      }).join('')}
      <!-- Area fill -->
      <path d="${areaPath}" fill="url(#chartGrad-${color.replace('#','')})"/>
      <!-- Line -->
      <path d="${linePath}" fill="none" stroke="${color}"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Axis labels -->
      ${yTicks}
      ${xLabels}
      <!-- Dots -->
      ${dots}
    </svg>`;
  }

  // ── NEW: Multi-line chart (AI vs Actual) ─────────────────────
  function multiLineChart(datasets, labels, {
    w = 480, h = 160,
    unit = '°C',
  } = {}) {
    if (!datasets || datasets.length === 0) return '<p class="chart-empty">No data</p>';

    const allVals = datasets.flatMap(d => d.values);
    const lo  = Math.min(...allVals);
    const hi  = Math.max(...allVals);
    const rng = hi - lo || 1;

    const pad = { t: 16, r: 16, b: 32, l: 36 };
    const cw  = w - pad.l - pad.r;
    const ch  = h - pad.t - pad.b;

    const lines = datasets.map(ds => {
      const pts = ds.values.map((v, i) => ({
        x: pad.l + (i / (ds.values.length - 1)) * cw,
        y: pad.t + (1 - (v - lo) / rng) * ch,
      }));
      const path = smoothPath(pts);
      return `<path d="${path}" fill="none" stroke="${ds.color}" stroke-width="${ds.dashed ? 1.5 : 2}"
            ${ds.dashed ? 'stroke-dasharray="6,3"' : ''} stroke-linecap="round"/>`;
    }).join('');

    const yTicks = [lo, (lo + hi) / 2, hi].map(v => {
      const y = pad.t + (1 - (v - lo) / rng) * ch;
      return `<text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-3)">${Math.round(v)}${unit}</text>`;
    }).join('');

    const xLabels = labels ? labels.map((lbl, i) => {
      if (i % Math.ceil(labels.length / 6) !== 0) return '';
      const x = pad.l + (i / (labels.length - 1)) * cw;
      return `<text x="${x}" y="${h - 4}" text-anchor="middle" font-size="10" fill="var(--text-3)">${lbl}</text>`;
    }).join('') : '';

    const legend = datasets.map((ds, i) =>
      `<text x="${pad.l + i * 120}" y="${h}" font-size="10" fill="${ds.color}">— ${ds.label}</text>`
    ).join('');

    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}"
                 xmlns="http://www.w3.org/2000/svg" style="display:block">
      ${[0, 0.5, 1].map(t => {
        const gy = pad.t + t * ch;
        return `<line x1="${pad.l}" y1="${gy}" x2="${pad.l + cw}" y2="${gy}"
                      stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4"/>`;
      }).join('')}
      ${lines}
      ${yTicks}
      ${xLabels}
    </svg>`;
  }

  // ── NEW: Score ring chart ─────────────────────────────────────
  function scoreRing(score, { size = 120, color = '#3B82F6', label = '', sublabel = '' } = {}) {
    const cx   = size / 2;
    const cy   = size / 2;
    const r    = size / 2 - 12;
    const circ = 2 * Math.PI * r;
    const pct  = clamp(score / 100, 0, 1);
    const dash = pct * circ;
    const gap  = circ - dash;

    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"
                 xmlns="http://www.w3.org/2000/svg" aria-label="${label}: ${score}/100">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
              stroke="var(--border)" stroke-width="8" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
              stroke="${color}" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}"
              stroke-dashoffset="${circ / 4}"
              transform="rotate(-90 ${cx} ${cy})">
        <animate attributeName="stroke-dasharray"
                 from="0 ${circ.toFixed(1)}"
                 to="${dash.toFixed(1)} ${gap.toFixed(1)}"
                 dur="1s" fill="freeze" calcMode="spline"
                 keySplines="0.4 0 0.2 1"/>
      </circle>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle"
            font-size="${size < 80 ? 16 : 22}" font-weight="800" fill="${color}">${score}</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle"
            font-size="8" fill="var(--text-3)">/100</text>
      ${sublabel ? `<text x="${cx}" y="${cy + 24}" text-anchor="middle"
            font-size="7" fill="var(--text-3)">${sublabel}</text>` : ''}
    </svg>`;
  }

  // ── NEW: Horizontal bar chart (Model metrics) ─────────────────
  function horizontalBar(items, { w = 320, barH = 20, gap = 10 } = {}) {
    if (!items || items.length === 0) return '';
    const maxVal = Math.max(...items.map(i => i.value));
    const totalH = items.length * (barH + gap) + 20;

    const bars = items.map((item, i) => {
      const pct = maxVal > 0 ? item.value / maxVal : 0;
      const barW = pct * (w - 80);
      const y    = i * (barH + gap) + 10;
      return `
        <text x="0" y="${y + barH - 4}" font-size="11" fill="var(--text-2)">${item.label}</text>
        <rect x="80" y="${y}" width="${barW.toFixed(1)}" height="${barH}"
              rx="4" fill="${item.color || '#3B82F6'}" fill-opacity="0.85"/>
        <text x="${80 + barW + 6}" y="${y + barH - 4}" font-size="11"
              fill="var(--text-1)" font-weight="600">${item.displayValue || item.value}</text>`;
    }).join('');

    return `<svg viewBox="0 0 ${w} ${totalH}" width="100%" height="${totalH}"
                 xmlns="http://www.w3.org/2000/svg" style="display:block">
      ${bars}
    </svg>`;
  }

  // ── NEW: Accuracy over time line chart ────────────────────────
  function accuracyChart(validations, {
    w = 460, h = 120,
  } = {}) {
    if (!validations || validations.length < 2) return '<p class="chart-empty">Not enough validation data</p>';

    const accs   = validations.map(v => v.accuracies.temperature);
    const labels = validations.map(v => v.time);
    const color  = '#10B981';

    return areaChart(accs, labels, { color, fillFrom: color, unit: '%', w, h });
  }

  // ── Pressure gauge (semicircle) ──────────────────────────────
  function pressureGauge(value, { min = 980, max = 1030, w = 120, h = 70 } = {}) {
    const pct    = clamp((value - min) / (max - min), 0, 1);
    const angle  = -180 + pct * 180;
    const rad    = (angle * Math.PI) / 180;
    const cx = w / 2, cy = h - 10, r = h - 18;
    const nx = cx + r * Math.cos(rad);
    const ny = cy + r * Math.sin(rad);

    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
            fill="none" stroke="var(--border-2)" stroke-width="6" stroke-linecap="round"/>
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${nx} ${ny}"
            fill="none" stroke="#3B82F6" stroke-width="6" stroke-linecap="round"/>
      <circle cx="${nx}" cy="${ny}" r="4" fill="#3B82F6" stroke="white" stroke-width="2"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle"
            font-size="13" font-weight="600" fill="var(--text-1)">${value}</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle"
            font-size="9" fill="var(--text-3)">hPa</text>
    </svg>`;
  }

  // ── UV index arc ─────────────────────────────────────────────
  function uvArc(value, { w = 80, h = 48 } = {}) {
    const colors = ['#10B981','#10B981','#10B981','#F59E0B','#F59E0B','#F97316','#F97316','#EF4444','#EF4444','#7C3AED','#7C3AED'];
    const col = colors[clamp(value, 0, 10)];
    const pct = clamp(value / 11, 0, 1);
    const cx  = w / 2, cy = h - 4, r = h - 12;
    const rad = (-180 + pct * 180) * Math.PI / 180;
    const nx  = cx + r * Math.cos(rad);
    const ny  = cy + r * Math.sin(rad);

    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
            fill="none" stroke="var(--border)" stroke-width="5" stroke-linecap="round"/>
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${nx} ${ny}"
            fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round"/>
    </svg>`;
  }

  // ── Wind direction compass ───────────────────────────────────
  function windCompass(deg, { size = 48 } = {}) {
    const cx = size / 2, cy = size / 2, r = size / 2 - 4;
    const rad = ((deg - 90) * Math.PI) / 180;
    const tip = { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    const tail= { x: cx - (r * 0.5) * Math.cos(rad), y: cy - (r * 0.5) * Math.sin(rad) };

    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"
                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
              stroke="var(--border-2)" stroke-width="1.5"/>
      <line x1="${tail.x}" y1="${tail.y}" x2="${tip.x}" y2="${tip.y}"
            stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="${tip.x}" cy="${tip.y}" r="3" fill="#3B82F6"/>
      <circle cx="${cx}"   cy="${cy}"   r="2" fill="var(--text-3)"/>
    </svg>`;
  }

  // ── NEW: Mini score bar ───────────────────────────────────────
  function scoreBar(value, max = 100, { color = '#3B82F6', h = 6, w = 100 } = {}) {
    const pct = clamp(value / max, 0, 1);
    const barW = (pct * (w - 4)).toFixed(1);
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${h/2}" fill="var(--border)"/>
      <rect x="0" y="0" width="${barW}" height="${h}" rx="${h/2}" fill="${color}"/>
    </svg>`;
  }

  // Public API
  return {
    sparkline, rainBars, areaChart, pressureGauge, uvArc, windCompass,
    multiLineChart, scoreRing, horizontalBar, accuracyChart, scoreBar,
  };
})();

window.Charts = Charts;
