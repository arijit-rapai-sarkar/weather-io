'use strict';
// ============================================================
// WeatherIQ — Main Application Controller v2.0
// Manages: state, routing, rendering, events, polling, theme,
//          AI Lab, Analytics, Maps, Notifications, AI Assistant,
//          Weather Score, Device Health, Anomalies, PWA
// ============================================================

// ── Application state ──────────────────────────────────────
const state = {
  currentPage: 'dashboard',
  theme: localStorage.getItem('wiq-theme') || 'light',
  iotData: null,
  aiPrediction: null,
  externalWeather: null,
  savedLocations: [],
  searchQuery: '',
  isLoading: true,
  iotPollingTimer: null,
  searchDebounce: null,
  // New state
  weatherScore: null,
  activityScores: null,
  deviceHealth: null,
  anomalies: null,
  modelPerformance: null,
  aiVsActual: null,
  aiExplanation: null,
  historicalData: null,
  systemAnalytics: null,
  analyticsRange: '24h',
  analyticsSensor: 'temperature',
  exportRange: '24h',
  notifPanelOpen: false,
  assistantPanelOpen: false,
  demoMode: false,
  demoScenario: null,
  aiLabTab: 'performance',
  settingsTab: 'general',
  mapLayer: 'station',
  notifFilter: 'all',
  lastUpdatedAt: null,
};

// ── Sensor definitions ─────────────────────────────────────
const SENSORS = [
  { key: 'temperature', label: 'Temperature', icon: '🌡️', unit: '°C', color: '#EF4444', sparkColor: '#EF4444' },
  { key: 'humidity', label: 'Humidity', icon: '💧', unit: '%', color: '#3B82F6', sparkColor: '#3B82F6' },
  { key: 'windSpeed', label: 'Wind Speed', icon: '💨', unit: 'km/h', color: '#6366F1', sparkColor: '#6366F1' },
  { key: 'rain', label: 'Rainfall', icon: '🌧️', unit: 'mm', color: '#0EA5E9', sparkColor: '#0EA5E9' },
  { key: 'aqi', label: 'Air Quality', icon: '🫁', unit: 'AQI', color: '#F59E0B', sparkColor: '#F59E0B' },
  { key: 'uvIndex', label: 'UV Index', icon: '☀️', unit: 'UV', color: '#F97316', sparkColor: '#F97316' },
  { key: 'pressure', label: 'Pressure', icon: '🌬️', unit: 'hPa', color: '#8B5CF6', sparkColor: '#8B5CF6' },
  { key: 'visibility', label: 'Visibility', icon: '👁️', unit: 'km', color: '#10B981', sparkColor: '#10B981' },
];

// Source badge helpers

// ── Lucide icon updater ────────────────────────────────────
let iconRenderScheduled = false;
function refreshIcons(root = null) {
  if (typeof window === 'undefined' || !window.lucide) return;
  if (root) {
    try { lucide.createIcons({ root }); } catch (e) {}
    return;
  }
  if (!iconRenderScheduled) {
    iconRenderScheduled = true;
    requestAnimationFrame(() => {
      try {
        if (window.lucide) lucide.createIcons();
      } catch (e) {}
      iconRenderScheduled = false;
    });
  }
}

const SOURCE_BADGES = {
  iot: '<span class="badge badge-iot" style="font-size:0.6rem">● LIVE IoT</span>',
  ai: '<span class="badge badge-ai" style="font-size:0.6rem">⬡ AI PREDICTED</span>',
  ext: '<span class="badge badge-ext" style="font-size:0.6rem">↗ EXTERNAL</span>',
  cached: '<span class="badge badge-warning" style="font-size:0.6rem">⏱ CACHED</span>',
  demo: '<span style="padding:2px 6px;background:#F59E0B;color:white;border-radius:99px;font-size:0.6rem;font-weight:700">🎭 DEMO</span>',
};

// ── DOM helpers ────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function show(el) { if (el) el.hidden = false; }
function hide(el) { if (el) el.hidden = true; }
function setText(id, val) { const el = $(id); if (el) el.textContent = val; }

function timeAgo(date) {
  const secs = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function formatTime(dateOrString) {
  return new Date(dateOrString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Theme management ───────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('theme-icon');
  if (icon) {
    icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    if (window.lucide) refreshIcons();
  }
  localStorage.setItem('wiq-theme', theme);
  state.theme = theme;
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ── Dynamic weather background ─────────────────────────────
function updateWeatherBackground(condition) {
  const bg = $('weather-bg');
  if (!bg) return;
  bg.innerHTML = '';
  bg.className = 'weather-bg';

  const lat = state.iotData?.location?.lat || 22.738318;
  const lon = state.iotData?.location?.lng || 88.479709;
  const pos = calculateSolarPosition(new Date(), lat, lon);
  const isNight = pos.elevation < 0;

  if (isNight) {
    bg.classList.add('night');
    return;
  }

  if (condition === 'sunny' || condition === 'partly_cloudy') {
    bg.classList.add('sunny');
  }

  if (condition === 'cloudy' || condition === 'overcast') {
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.className = 'cloud-element';
      const size = 100 + Math.random() * 200;
      el.style.cssText = `
        width:${size}px; height:${size * 0.4}px;
        top:${10 + Math.random() * 30}%;
        left:-${size}px;
        animation-duration:${30 + Math.random() * 30}s;
        animation-delay:${-Math.random() * 20}s;`;
      bg.appendChild(el);
    }
  }

  if (condition === 'rainy' || condition === 'heavy_rain' || condition === 'drizzle' || condition === 'thunderstorm') {
    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const count = condition === 'drizzle' ? 15 : 30;
    for (let i = 0; i < count; i++) {
      const drop = document.createElement('div');
      drop.className = 'rain-drop';
      drop.style.cssText = `
        left:${Math.random() * 100}%;
        height:${8 + Math.random() * 12}px;
        animation-duration:${0.6 + Math.random() * 0.8}s;
        animation-delay:${-Math.random() * 2}s;
        opacity:${0.3 + Math.random() * 0.4};`;
      bg.appendChild(drop);
    }
  }
}

// ── Last Updated chip ──────────────────────────────────────
function updateLastUpdatedChip() {
  const chip = $('last-updated-chip');
  const text = $('last-updated-text');
  if (!chip || !text) return;
  chip.style.display = '';
  if (state.iotData?.lastUpdate) {
    text.textContent = formatRelativeTime(state.iotData.lastUpdate);
  }
}

// ── Page navigation ────────────────────────────────────────
function navigateTo(page) {
  state.currentPage = page;

  $$('.page').forEach(p => p.classList.remove('active'));
  const target = $(`page-${page}`);
  if (target) target.classList.add('active');

  $$('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  $$('.mobile-nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Page-specific renders
  if (page === 'sensors') renderSensorsPage();
  if (page === 'ai') renderAIPage();
  if (page === 'ailab') renderAILabPage();
  if (page === 'forecast') renderForecastPage();
  if (page === 'intelligence') renderIntelligencePage();
  if (page === 'analytics') renderAnalyticsPage();
  if (page === 'map') renderMapPage();
  if (page === 'saved') renderSavedLocations();
  if (page === 'settings') renderSettings();

  const content = $('page-content');
  if (content) content.scrollTop = 0;
}

// ── IoT Status rendering ───────────────────────────────────
function renderIoTStatus(data) {
  const bar = $('iot-status-bar');
  const dot = $('iot-dot');
  const text = $('iot-status-text');
  const time = $('iot-update-time');
  if (!bar) return;

  const statusMap = {
    connected: { dotClass: 'connected', label: 'IoT Connected', barClass: '' },
    syncing: { dotClass: 'syncing', label: 'Syncing…', barClass: 'syncing' },
    offline: { dotClass: 'offline', label: 'Device Offline', barClass: 'offline' },
    error: { dotClass: 'error', label: 'Sensor Error', barClass: 'error' },
  };

  const s = statusMap[data.status] || statusMap.connected;
  dot.className = `iot-dot ${s.dotClass}`;
  text.textContent = s.label;
  bar.className = `iot-status-bar ${s.barClass}`;
  time.textContent = data.lastUpdate ? timeAgo(data.lastUpdate) : '';
}

// ── Location rendering ─────────────────────────────────────
function renderLocation(loc) {
  setText('location-city', loc.city);
  setText('location-detail', `${loc.state}, ${loc.country}`);
}

// ── Current weather card ───────────────────────────────────
function renderCurrentWeather(data) {
  hide($('cw-skeleton'));
  hide($('cw-error'));
  show($('cw-content'));

  const c = data.current;
  setText('cw-condition', getWeatherLabel(c.condition));
  setText('cw-icon', getWeatherIcon(c.condition));
  setText('cw-temp', Math.round(c.temperature));
  setText('cw-feels', `${Math.round(c.feelsLike)}°C`);
  setText('cw-humidity', `${c.humidity}%`);
  setText('cw-wind', `${c.windSpeed} km/h ${c.windDirection}`);
  setText('cw-vis', `${c.visibility} km`);
  setText('cw-pressure', `${c.pressure} hPa`);

  // NEW: Conditions summary grid (5 extra parameters)
  const sumEl = $('conditions-summary');
  if (sumEl) {
    const items = [
      { icon: '🌡️', label: 'Temp', value: `${c.temperature}°C`, source: 'IoT' },
      { icon: '💧', label: 'Humidity', value: `${c.humidity}%`, source: 'IoT' },
      { icon: '🫁', label: 'AQI', value: `${c.aqi}`, source: 'IoT' },
      { icon: '☀️', label: 'UV', value: `${c.uvIndex}`, source: 'IoT' },
      { icon: '🌬️', label: 'Pressure', value: `${c.pressure} hPa`, source: 'IoT' },
      { icon: '💨', label: 'Wind', value: `${c.windSpeed} km/h`, source: 'IoT' },
      { icon: '🌧️', label: 'Rain %', value: `${c.rainProbability || 0}%`, source: 'AI' },
      { icon: '👁️', label: 'Visibility', value: `${c.visibility} km`, source: 'IoT' },
      { icon: '🌡️', label: 'Dew Point', value: `${c.dewPoint || '—'}°C`, source: 'IoT' },
      { icon: '⬆️', label: 'Trend', value: c.pressureTrend || '—', source: 'IoT' },
    ];
    sumEl.innerHTML = items.slice(0, 5).map(it => `
      <div class="cs-item">
        <div class="cs-icon">${it.icon}</div>
        <div class="cs-value">${it.value}</div>
        <div class="cs-label">${it.label}</div>
        <div class="cs-source">${it.source}</div>
      </div>`).join('');
  }

  // Dynamic update for AQI card
  const aqiCard = $('aqi-card');
  if (aqiCard) {
    const aqiVal = $('aqi-val') || aqiCard.querySelector('.wh-temp');
    if (aqiVal) aqiVal.textContent = Math.round(c.aqi);

    const aqiLabel = $('aqi-label') || aqiCard.querySelector('.wh-condition');
    const aqiInfo = c.aqiInfo || (window.aqiCategory ? window.aqiCategory(c.aqi) : { label: 'Moderate' });
    if (aqiLabel) aqiLabel.textContent = aqiInfo.label;

    const fill = $('aqi-bar-fill') || aqiCard.querySelector('.aqi-bar-fill');
    const thumb = $('aqi-bar-thumb') || aqiCard.querySelector('.aqi-bar-thumb');
    const pct = Math.min(100, Math.max(10, Math.round((c.aqi / 300) * 100)));
    if (fill) fill.style.width = `${pct}%`;
    if (thumb) {
      thumb.style.left = `${pct}%`;
      thumb.textContent = aqiInfo.label;
    }
  }

  // Dynamic update for hardware Rain and Sunlight sensor chips
  const rainEl = $('cw-rain');
  if (rainEl) {
    rainEl.textContent = c.rainStatus || (c.rain ? 'Raining' : 'No Rain');
    rainEl.style.color = c.rain ? '#38BDF8' : '';
  }
  const sunEl = $('cw-sunlight');
  if (sunEl) {
    sunEl.textContent = c.sunlight || 'Dark';
    sunEl.style.color = (c.sunlight === 'Bright') ? '#FBBF24' : '';
  }

  // Dynamic update for UVI card
  const uviVal = $('uvi-val');
  if (uviVal) uviVal.textContent = `${c.uvIndex || 0} UVI`;
  const uviBadge = $('uvi-badge');
  if (uviBadge) {
    const uvInfo = c.uvInfo || (window.uvCategory ? window.uvCategory(c.uvIndex || 0) : { label: 'Low', color: '#10B981' });
    uviBadge.textContent = uvInfo.label || 'Low';
    if (uvInfo.color) uviBadge.style.background = uvInfo.color;
  }
  const uviDesc = $('uvi-desc');
  if (uviDesc) {
    uviDesc.textContent = (c.uvIndex <= 2) ? 'Low risk from UV rays' : (c.uvIndex <= 5 ? 'Moderate risk from UV rays' : 'High UV exposure — wear sunscreen');
  }

  renderIoTStatus(data);
  renderLocation(data.location);
  updateWeatherBackground(c.condition);
  updateWeatherCardAnimation(c.condition);
  updateAqiCardImage(c.aqi);
  if (state.aiPrediction?.tomorrow) {
    updateTomorrowCard(state.aiPrediction.tomorrow);
  } else if (data.daily && data.daily.length > 1) {
    updateTomorrowCard(data.daily[1]);
  }
  updateLastUpdatedChip();
}

function renderCurrentWeatherError() {
  hide($('cw-skeleton'));
  hide($('cw-content'));
  show($('cw-error'));
}

// ── Weather Score ──────────────────────────────────────────
async function renderWeatherScore(iotData) {
  const wrap = $('weather-score-content');
  if (!wrap || !iotData?.current) return;

  try {
    const score = await API.getWeatherScore(iotData.current);
    state.weatherScore = score;

    const ringColor = score.color;
    const ring = Charts.scoreRing(score.score, { size: 110, color: ringColor, sublabel: score.label });

    wrap.innerHTML = `
      <div class="weather-score-card">
        <div class="ws-ring-wrap">
          ${ring}
          <div class="ws-label-main" style="color:${ringColor}">${score.label}</div>
        </div>
        <div class="ws-right">
          <div class="ws-factors">
            ${score.factors.map(f => {
      const barColor = f.value >= 70 ? '#10B981' : f.value >= 50 ? '#3B82F6' : f.value >= 30 ? '#F59E0B' : '#EF4444';
      return `
              <div class="ws-factor">
                <div class="ws-factor-name">${f.icon} ${f.name}</div>
                <div>${Charts.scoreBar(f.value, 100, { color: barColor, w: 80, h: 6 })}</div>
                <div class="ws-factor-val">${f.detail}</div>
              </div>`;
    }).join('')}
          </div>
          <div class="ws-explanation">${score.explanation}</div>
        </div>
      </div>`;
  } catch (e) {
    wrap.innerHTML = '<p style="color:var(--text-3);font-size:0.875rem">Weather score unavailable.</p>';
  }
}

// ── Activity Scores ────────────────────────────────────────
async function renderActivityScores(iotData) {
  const grid = $('activity-grid');
  if (!grid || !iotData?.current) return;

  const scores = MockData.getActivityScores(iotData.current);
  state.activityScores = scores;

  grid.innerHTML = scores.map(a => {
    const cls = a.score >= 80 ? 'score-excellent' : a.score >= 60 ? 'score-good' : a.score >= 40 ? 'score-fair' : 'score-poor';
    const barColor = a.score >= 80 ? '#10B981' : a.score >= 60 ? '#3B82F6' : a.score >= 40 ? '#F59E0B' : '#EF4444';
    return `
      <div class="activity-card">
        <div class="activity-icon">${a.icon}</div>
        <div class="activity-name">${a.label}</div>
        <div class="activity-score ${cls}">${a.score}</div>
        <div class="activity-bar-wrap">
          ${Charts.scoreBar(a.score, 100, { color: barColor, w: 90, h: 5 })}
        </div>
      </div>`;
  }).join('');
}

// ── Weather Timeline ───────────────────────────────────────
function renderWeatherTimeline(aiPrediction) {
  const container = $('weather-timeline');
  if (!container || !aiPrediction?.hourly) return;

  const timeline = MockData.getWeatherTimeline(aiPrediction.hourly);
  container.innerHTML = timeline.map(h => `
    <div class="timeline-item ${h.isNow ? 'now' : ''}" role="listitem">
      <div class="timeline-label">${h.isNow ? 'NOW' : '+' + (timeline.indexOf(h)) + 'h'}</div>
      <div class="timeline-icon">${getWeatherIcon(h.condition)}</div>
      <div class="timeline-temp">${h.temperature}°C</div>
      <div class="timeline-rain">💧 ${h.rainProbability}%</div>
      <div class="timeline-wind">${h.windSpeed} km/h</div>
    </div>`).join('');
}

function calculateSolarPosition(date, lat, lon) {
  const t = date.getTime() / 1000;
  const n = (t / 86400.0) - 10957.5;
  const L = (280.460 + 0.9856474 * n) % 360.0;
  const g = (357.528 + 0.9856003 * n) % 360.0;
  const lambda_ = L + 1.915 * Math.sin(g * Math.PI / 180) + 0.020 * Math.sin(2 * g * Math.PI / 180);
  const epsilon = 23.439 - 0.0000004 * n;
  const delta = Math.asin(Math.sin(epsilon * Math.PI / 180) * Math.sin(lambda_ * Math.PI / 180));
  let alpha = Math.atan2(Math.cos(epsilon * Math.PI / 180) * Math.sin(lambda_ * Math.PI / 180), Math.cos(lambda_ * Math.PI / 180)) * 180 / Math.PI;
  alpha = alpha % 360.0;
  if (alpha < 0) alpha += 360;
  let GMST = (280.46061837 + 360.98564736629 * n) % 360.0;
  if (GMST < 0) GMST += 360;
  let LST = (GMST + lon) % 360.0;
  if (LST < 0) LST += 360;
  let H = (LST - alpha) % 360.0;
  if (H > 180.0) H -= 360.0;
  else if (H < -180.0) H += 360.0;
  const lat_rad = lat * Math.PI / 180.0;
  const H_rad = H * Math.PI / 180.0;
  const el_rad = Math.asin(Math.sin(lat_rad) * Math.sin(delta) + Math.cos(lat_rad) * Math.cos(delta) * Math.cos(H_rad));
  const elevation = el_rad * 180 / Math.PI;
  const az_rad = Math.atan2(Math.sin(H_rad), Math.cos(H_rad) * Math.sin(lat_rad) - Math.tan(delta) * Math.cos(lat_rad));
  let azimuth = (az_rad * 180 / Math.PI) + 180.0;
  if (azimuth >= 360) azimuth -= 360;
  if (azimuth < 0) azimuth += 360;
  return { azimuth, elevation };
}

function calculateMoonPosition(date, lat, lon) {
  const t = date.getTime() / 1000;
  const n = (t / 86400.0) - 10957.5;
  
  const L = (218.316 + 13.176396 * n) % 360.0;
  const M = (134.963 + 13.064993 * n) % 360.0;
  const F = (93.272 + 13.229350 * n) % 360.0;
  
  const l = L + 6.289 * Math.sin(M * Math.PI / 180.0);
  const b = 5.128 * Math.sin(F * Math.PI / 180.0);
  
  const epsilon = 23.439 - 0.0000004 * n;
  
  const l_rad = l * Math.PI / 180.0;
  const b_rad = b * Math.PI / 180.0;
  const e_rad = epsilon * Math.PI / 180.0;
  
  const ra_y = Math.sin(l_rad) * Math.cos(e_rad) - Math.tan(b_rad) * Math.sin(e_rad);
  const ra_x = Math.cos(l_rad);
  
  let alpha = Math.atan2(ra_y, ra_x) * 180.0 / Math.PI;
  alpha = alpha % 360.0;
  if (alpha < 0) alpha += 360.0;
  
  const decl = Math.asin(Math.sin(b_rad) * Math.cos(e_rad) + Math.cos(b_rad) * Math.sin(e_rad) * Math.sin(l_rad));
  
  let GMST = (280.46061837 + 360.98564736629 * n) % 360.0;
  if (GMST < 0) GMST += 360.0;
  let LST = (GMST + lon) % 360.0;
  if (LST < 0) LST += 360.0;
  
  let H = (LST - alpha) % 360.0;
  if (H > 180.0) H -= 360.0;
  else if (H < -180.0) H += 360.0;
  
  const lat_rad = lat * Math.PI / 180.0;
  const H_rad = H * Math.PI / 180.0;
  
  const el_rad = Math.asin(Math.sin(lat_rad) * Math.sin(decl) + Math.cos(lat_rad) * Math.cos(decl) * Math.cos(H_rad));
  const elevation = el_rad * 180.0 / Math.PI;
  
  const az_rad = Math.atan2(Math.sin(H_rad), Math.cos(H_rad) * Math.sin(lat_rad) - Math.tan(decl) * Math.cos(lat_rad));
  let azimuth = (az_rad * 180.0 / Math.PI) + 180.0;
  if (azimuth >= 360.0) azimuth -= 360.0;
  if (azimuth < 0) azimuth += 360.0;
  
  return { azimuth, elevation };
}

// ── Sunrise / Sunset ───────────────────────────────────────
function renderSunriseSunset(iotData) {
  const widget = $('sun-widget');
  if (!widget) return;
  const sun = iotData?.sunriseSunset || MockData.getSunriseSunset(24.17);
  
  // Temporary: calculate solar position dynamically in frontend based on IoT data timestamp (or now)
  const dt = iotData?.lastUpdate ? new Date(iotData.lastUpdate) : new Date();
  const lat = iotData?.location?.lat || 22.738318;
  const lon = iotData?.location?.lng || 88.479709;
  const pos = calculateSolarPosition(dt, lat, lon);
  const moonPos = calculateMoonPosition(dt, lat, lon);

  // Calculate arc position
  const parseTime = (str) => {
    const match = str.match(/(\d+):(\d+)(?:\s*(am|pm))?/i);
    if (!match) return 0;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[3] ? match[3].toLowerCase() : null;
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return h * 60 + m;
  };
  
  const riseMins = parseTime(sun.sunrise);
  const setMins = parseTime(sun.sunset);
  const nowMins = dt.getHours() * 60 + dt.getMinutes();
  
  let progress = 0;
  if (nowMins > setMins) progress = 1;
  else if (nowMins < riseMins) progress = 0;
  else progress = (nowMins - riseMins) / (setMins - riseMins);
  
  // Calculate SVG coordinates for the sun and path
  const theta = Math.PI - (progress * Math.PI); // 180deg to 0deg
  const cx = 100 + 90 * Math.cos(theta);
  const cy = 90 - 90 * Math.sin(theta);
  
  // If progress is 0, drawing an arc with 0 length causes issues in some browsers, so handle it
  const arcPath = progress > 0 
    ? `<path d="M 10 90 A 90 90 0 0 1 ${cx.toFixed(2)} ${cy.toFixed(2)}" fill="none" stroke="var(--accent)" stroke-width="3" />` 
    : '';
    
  const sunCircle = pos.elevation >= -5 // Draw sun even if slightly below horizon for visual effect
    ? `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="6" fill="var(--accent)" stroke="white" stroke-width="2" />`
    : '';

  widget.innerHTML = `
    <div class="rw-header">
      <div>
        <h3 style="font-size:1.1rem">Sun & Moon</h3>
        <span style="font-size:0.75rem;color:var(--text-3)">Local Sensor Unit</span>
      </div>
      <div class="rw-temp" style="font-size:1.5rem;font-weight:700;color:var(--accent)">
        ${iotData?.current?.temperature || '--'}°C
      </div>
    </div>
    <div class="sun-arc-container" style="padding:20px 0;">
      <svg viewBox="0 0 200 100" width="100%">
        <path d="M 10 90 A 90 90 0 0 1 190 90" fill="none" stroke="#E2E8F0" stroke-width="2" stroke-dasharray="4 4" />
        ${arcPath}
        ${sunCircle}
        <line x1="0" y1="90" x2="200" y2="90" stroke="#E2E8F0" stroke-width="2" />
      </svg>
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:0.75rem;font-weight:600;">
        <div style="text-align:left;">Sunrise<br><span style="color:var(--text-3);font-weight:400">${sun.sunrise}</span></div>
        <div style="text-align:center;color:var(--text-2);font-weight:400;line-height:1.4;">
          <span style="color:var(--accent)">Sun:</span> Az ${pos.azimuth.toFixed(1)}° El ${pos.elevation.toFixed(1)}°<br>
          <span style="color:#94A3B8">Moon:</span> Az ${moonPos.azimuth.toFixed(1)}° El ${moonPos.elevation.toFixed(1)}°
        </div>
        <div style="text-align:right;">Sunset<br><span style="color:var(--text-3);font-weight:400">${sun.sunset}</span></div>
      </div>
    </div>`;
}

// ── AI Prediction card ─────────────────────────────────────
function renderAIPredictionCard(data) {
  hide($('ai-skeleton'));
  hide($('ai-error'));
  show($('ai-content'));

  setText('ai-confidence', `${data.confidence}% confidence`);
  setText('ai-summary', data.summary);

  const timeline = $('ai-timeline');
  if (!timeline) return;

  timeline.innerHTML = data.hourly.slice(0, 6).map(h => `
    <div class="ai-timeline-item ${h.isNow ? 'current-hour' : ''}" role="listitem">
      <span class="ai-time">${h.time}</span>
      <span class="ai-icon" aria-hidden="true">${getWeatherIcon(h.condition)}</span>
      <span class="ai-temp">${h.temperature}°C</span>
      <div class="ai-rain-prob">
        <i data-lucide="droplets" aria-hidden="true"></i>
        ${h.rainProbability}%
      </div>
    </div>
  `).join('');

  const predList = $('prediction-list');
  if (predList && data.daily) {
    predList.innerHTML = data.daily.slice(0, 3).map(d => `
      <div class="prediction-item card">
        <i data-lucide="${(d.condition || '').includes('rain') ? 'cloud-rain' : ((d.condition || '').includes('sun') || d.condition === 'clear' ? 'sun' : 'cloud')}" style="color:var(--accent);width:32px;height:32px"></i>
        <div style="flex:1;">
          <div style="font-size:0.75rem;color:var(--text-3)">${d.day || d.date}</div>
          <div style="font-weight:600">${getWeatherLabel(d.condition)}</div>
        </div>
        <div style="font-weight:600;color:var(--accent)">${d.high}° <span style="color:var(--text-3)">/ ${d.low}°</span></div>
      </div>
    `).join('');
  }

  refreshIcons();
}

function renderAIError() {
  hide($('ai-skeleton'));
  hide($('ai-content'));
  show($('ai-error'));
}

let currentChartMetric = 'temperature';

window.setChartMetric = function (metric) {
  currentChartMetric = metric;

  const buttons = document.querySelectorAll('.chart-filters .icon-btn');
  buttons.forEach(btn => {
    const isActive = btn.dataset.metric === metric;
    btn.classList.toggle('active', isActive);
    btn.style.background = '';
    btn.style.color = '';
  });

  if (state.aiPrediction) {
    renderMainTempChart(state.aiPrediction);
  }
};

function renderMainTempChart(data) {
  const container = $('main-temp-chart-container');
  if (!container || !data || !data.hourly) return;

  const hourly = data.hourly.slice(0, 24);
  let values, color, unit;

  if (currentChartMetric === 'temperature') {
    values = hourly.map(h => h.temperature);
    color = '#FF8A00';
    unit = '°C';
  } else if (currentChartMetric === 'rain') {
    values = hourly.map(h => h.rainProbability || 0);
    color = '#3B82F6';
    unit = '%';
  } else if (currentChartMetric === 'wind') {
    values = hourly.map(h => h.windSpeed || 0);
    color = '#10B981';
    unit = 'km/h';
  }

  const labels = hourly.map(h => h.time);
  const containerWidth = container.clientWidth || container.parentElement?.clientWidth || 420;

  container.innerHTML = Charts.areaChart(values, labels, {
    w: Math.max(280, containerWidth - 8),
    h: 120,
    color: color,
    fillFrom: color,
    unit: unit,
    showDots: false
  });
}

// ── Sensor grid (dashboard) ────────────────────────────────
function getSensorValue(data, key) {
  const c = data.current;
  switch (key) {
    case 'temperature': return { val: c.temperature, display: `${c.temperature}°C`, trend: getTrend(data.history, 'temperature') };
    case 'humidity': return { val: c.humidity, display: `${c.humidity}%`, trend: getTrend(data.history, 'humidity') };
    case 'windSpeed': return { val: c.windSpeed, display: `${c.windSpeed}`, trend: null };
    case 'rain': return { val: c.rainfallMm, display: c.rain ? `${c.rainfallMm} mm` : 'No Rain', trend: null };
    case 'aqi': return { val: c.aqi, display: `${c.aqi}`, trend: getTrend(data.history, 'aqi') };
    case 'uvIndex': return { val: c.uvIndex, display: `${c.uvIndex}`, trend: null };
    case 'pressure': return { val: c.pressure, display: `${c.pressure}`, trend: c.pressureTrend };
    case 'visibility': return { val: c.visibility, display: `${c.visibility}`, trend: null };
    default: return { val: 0, display: '—', trend: null };
  }
}

function getTrend(history, key) {
  if (!history || history.length < 6) return null;
  const recent = history.slice(-6).map(h => h[key]).filter(v => v != null);
  if (recent.length < 2) return null;
  const diff = recent[recent.length - 1] - recent[0];
  if (diff > 0.5) return { dir: 'up', label: `↑ ${Math.abs(diff).toFixed(1)}` };
  if (diff < -0.5) return { dir: 'down', label: `↓ ${Math.abs(diff).toFixed(1)}` };
  return { dir: 'stable', label: '→ Stable' };
}

function getSensorStatus(key, val) {
  switch (key) {
    case 'aqi':
      if (val <= 50) return { cls: 'good', label: 'Good' };
      if (val <= 100) return { cls: 'moderate', label: 'Moderate' };
      if (val <= 150) return { cls: 'high', label: 'Unhealthy' };
      return { cls: 'dangerous', label: 'Hazardous' };
    case 'uvIndex':
      if (val <= 2) return { cls: 'good', label: 'Low' };
      if (val <= 5) return { cls: 'moderate', label: 'Moderate' };
      if (val <= 7) return { cls: 'high', label: 'High' };
      return { cls: 'dangerous', label: 'Very High' };
    case 'humidity':
      if (val < 40) return { cls: 'moderate', label: 'Dry' };
      if (val <= 70) return { cls: 'good', label: 'Comfortable' };
      return { cls: 'moderate', label: 'Humid' };
    case 'windSpeed':
      if (val < 20) return { cls: 'good', label: 'Calm' };
      if (val < 40) return { cls: 'moderate', label: 'Moderate' };
      return { cls: 'high', label: 'Strong' };
    case 'rain':
      return val === 0 ? { cls: 'good', label: 'No Rain' } : { cls: 'moderate', label: 'Raining' };
    default:
      return { cls: 'good', label: 'Normal' };
  }
}

function getSparklineData(history, key) {
  if (!history) return [];
  return history.slice(-16).map(h => h[key] != null ? h[key] : 0);
}

function renderSensorGrid(data) {
  const grid = $('sensor-grid');
  if (!grid) return;

  const isInitialRender = grid.childElementCount === 0;

  grid.innerHTML = SENSORS.map((sensor, idx) => {
    const { val, display, trend } = getSensorValue(data, sensor.key);
    const status = getSensorStatus(sensor.key, val);
    const sparkData = getSparklineData(data.history, sensor.key === 'windSpeed' ? 'windSpeed' : sensor.key);
    const spark = sparkData.length > 2 ? Charts.sparkline(sparkData, { w: 80, h: 30, color: sensor.sparkColor }) : '';

    const trendHtml = trend
      ? `<div class="sc-trend ${trend.dir}">${trend.label}</div>`
      : '';

    const animClass = isInitialRender ? `anim-fade-up anim-delay-${Math.min(idx + 1, 6)}` : '';

    return `
      <div class="sensor-card ${animClass}"
           role="listitem"
           tabindex="0"
           data-sensor="${sensor.key}"
           aria-label="${sensor.label}: ${display}"
           title="Click for details">
        <div class="sc-top">
          <div class="sc-icon" style="background:${sensor.color}18" aria-hidden="true">${sensor.icon}</div>
          <span class="sc-status ${status.cls}" aria-label="Status: ${status.label}">${status.label}</span>
        </div>
        <div class="sc-label">${sensor.label}</div>
        <div class="sc-value" aria-live="polite">
          ${display.includes('°') || display.includes('%') || display.includes('km') || display.includes('hPa')
        ? display
        : `${display}<span class="sc-unit">${sensor.unit}</span>`}
        </div>
        ${trendHtml}
        <div class="sc-sparkline" aria-hidden="true">${spark}</div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.sensor-card').forEach(card => {
    card.addEventListener('click', () => openSensorModal(card.dataset.sensor));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openSensorModal(card.dataset.sensor); });
  });
}

// ── Hourly forecast ────────────────────────────────────────
function renderHourlyForecast(data) {
  const container = $('hourly-scroll');
  if (!container) return;

  container.innerHTML = data.hourly.slice(0, 12).map(h => `
    <div class="hourly-item ${h.isNow ? 'current-hour' : ''}" role="listitem"
         aria-label="${h.time}: ${getWeatherLabel(h.condition)}, ${h.temperature}°C">
      <div class="hourly-time">${h.isNow ? 'Now' : h.time}</div>
      <div class="hourly-icon" aria-hidden="true">${getWeatherIcon(h.condition)}</div>
      <div class="hourly-temp">${h.temperature}°C</div>
      <div class="hourly-rain" aria-label="${h.rainProbability}% rain chance">
        <i data-lucide="droplets" style="width:10px;height:10px"></i>
        ${h.rainProbability}%
      </div>
    </div>
  `).join('');

  refreshIcons();
}

// ── 7-Day forecast ─────────────────────────────────────────
function renderSevenDayForecast(data) {
  const list = $('seven-day-list');
  if (!list) return;

  list.innerHTML = data.daily.map((d, i) => `
    <div class="forecast-row ${i === 0 ? 'today' : ''}" role="listitem"
         aria-label="${d.day}: ${getWeatherLabel(d.condition)}, high ${d.high}°C low ${d.low}°C">
      <span class="fr-day">${d.day}</span>
      <span class="fr-icon" aria-hidden="true">${getWeatherIcon(d.condition)}</span>
      <span class="fr-desc">${getWeatherLabel(d.condition)}</span>
      <span class="fr-rain" aria-label="${d.rainProbability}% rain chance">
        <i data-lucide="droplets"></i>${d.rainProbability}%
      </span>
      <span class="fr-temps">
        ${d.high}° <span class="fr-low">/ ${d.low}°</span>
      </span>
    </div>
  `).join('');

  refreshIcons();
}

// ── Recommendations ────────────────────────────────────────
function renderRecommendations(iotData) {
  const list = $('reco-list');
  const doDontWrap = $('do-dont-wrap');
  if (!list) return;

  const recs = iotData.recommendations || [];
  const doDont = iotData.doDont || { dos: [], donts: [] };

  list.innerHTML = recs.slice(0, 4).map(r => `
    <div class="reco-item type-${r.type}" role="listitem">
      <span class="reco-icon" aria-hidden="true">${r.icon}</span>
      <div>
        <div class="reco-title">${r.title}</div>
        <div class="reco-message">${r.message}</div>
      </div>
    </div>
  `).join('') || '<div class="reco-item type-info"><span class="reco-icon">✅</span><div><div class="reco-title">All Good</div><div class="reco-message">Current conditions are comfortable.</div></div></div>';

  if (doDontWrap) {
    doDontWrap.innerHTML = `
      <div class="do-col">
        <h4>✓ DO</h4>
        <ul class="do-list">
          ${doDont.dos.slice(0, 4).map(d => `<li>${d}</li>`).join('')}
        </ul>
      </div>
      <div class="dont-col">
        <h4>✕ DON'T</h4>
        <ul class="dont-list">
          ${doDont.donts.slice(0, 4).map(d => `<li>${d}</li>`).join('')}
        </ul>
      </div>`;
  }
}

// ── Safety alerts ──────────────────────────────────────────
function renderSafetyAlerts(iotData) {
  const container = $('safety-alerts');
  if (!container) return;

  const alerts = iotData.safetyAlerts || [];
  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="safety-ok" role="status">
        <span class="ok-icon">✅</span>
        <span>No active weather warnings. Conditions are safe.</span>
      </div>`;
    return;
  }

  container.innerHTML = alerts.map(a => `
    <div class="safety-alert level-${a.level}" role="alert">
      <div class="alert-icon" aria-hidden="true">${a.icon}</div>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.description}</div>
        <div class="alert-actions">
          ${a.actions.map(ac => `<div class="alert-action">${ac}</div>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// ── Sensor detail modal (enhanced) ────────────────────────
function openSensorModal(sensorKey) {
  const sensor = SENSORS.find(s => s.key === sensorKey);
  if (!sensor || !state.iotData) return;

  const data = state.iotData;
  const { val, display } = getSensorValue(data, sensorKey);
  const history = data.history;
  const c = data.current;

  const histVals = getSparklineData(history, sensorKey).filter(v => v != null);
  const allHist = history.map(h => h[sensorKey]).filter(v => v != null);
  const minVal = allHist.length ? Math.min(...allHist).toFixed(1) : '—';
  const maxVal = allHist.length ? Math.max(...allHist).toFixed(1) : '—';
  const avgVal = allHist.length ? (allHist.reduce((a, b) => a + b, 0) / allHist.length).toFixed(1) : '—';
  const lastUpdate = data.lastUpdate ? timeAgo(data.lastUpdate) : '—';

  const histLabels = history.slice(-16).map(h => formatTime(h.timestamp));

  const chart = histVals.length > 2
    ? Charts.areaChart(histVals, histLabels, { color: sensor.sparkColor, fillFrom: sensor.sparkColor, unit: ` ${sensor.unit}`, w: 480, h: 140 })
    : '<p class="chart-empty" style="color:var(--text-3);padding:16px;text-align:center">Not enough data for chart</p>';

  let extraHtml = '';
  if (sensorKey === 'pressure') {
    extraHtml = `<div style="display:flex;justify-content:center;margin-top:8px">
      ${Charts.pressureGauge(val, { w: 140, h: 80 })}</div>`;
  }
  if (sensorKey === 'uvIndex') {
    extraHtml = `<div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:8px">
      ${Charts.uvArc(val, { w: 100, h: 56 })}
      <span style="font-size:0.8125rem;color:var(--text-2)">${uvCategory(val).label}</span></div>`;
  }
  if (sensorKey === 'windSpeed') {
    extraHtml = `<div style="display:flex;justify-content:center;gap:16px;align-items:center;margin-top:8px">
      ${Charts.windCompass(c.windDirectionDeg || 45, { size: 60 })}
      <div style="font-size:0.8125rem;color:var(--text-2)">Direction: <strong>${c.windDirection || 'NE'}</strong></div>
    </div>`;
  }
  if (sensorKey === 'aqi') {
    const aqiInfo = aqiCategory(val);
    extraHtml = `<div style="padding:8px 12px;background:${aqiInfo.color}15;border-radius:var(--radius-sm);margin-top:8px;font-size:0.875rem">
      <strong style="color:${aqiInfo.color}">${aqiInfo.label}</strong> — AQI ${val}</div>`;
  }

  // Check for anomaly
  const anomaly = state.anomalies?.find(a => a.type === sensorKey);
  const anomalyHtml = anomaly ? `
    <div style="margin-top:12px;padding:10px 14px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--radius-sm);font-size:0.8125rem">
      ⚠️ <strong>${anomaly.title}</strong> — ${anomaly.possibleCause}
    </div>` : '';

  $('modal-header').innerHTML = `
    <div class="modal-header-icon" style="background:${sensor.color}18" aria-hidden="true">${sensor.icon}</div>
    <div>
      <div class="modal-title">${sensor.label}</div>
      <div class="modal-subtitle">Live IoT · Updated ${lastUpdate}</div>
    </div>`;

  $('modal-body').innerHTML = `
    <div class="modal-stat-grid-4">
      <div class="modal-stat">
        <div class="ms-label">Current</div>
        <div class="ms-value" style="color:${sensor.color}">${display}</div>
      </div>
      <div class="modal-stat">
        <div class="ms-label">24h Min</div>
        <div class="ms-value">${minVal} ${sensor.unit}</div>
      </div>
      <div class="modal-stat">
        <div class="ms-label">24h Max</div>
        <div class="ms-value">${maxVal} ${sensor.unit}</div>
      </div>
      <div class="modal-stat">
        <div class="ms-label">24h Avg</div>
        <div class="ms-value">${avgVal} ${sensor.unit}</div>
      </div>
    </div>
    ${anomalyHtml}
    ${extraHtml}
    <div class="modal-chart-wrap">
      <div class="modal-chart-label">24-Hour Trend</div>
      ${chart}
    </div>`;

  $('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  refreshIcons();
}

function closeModal() {
  $('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Sensors page ───────────────────────────────────────────
async function renderSensorsPage() {
  const grid = $('sensor-grid-detailed');
  if (!grid || !state.iotData) {
    if (grid) grid.innerHTML = renderLoadingGrid(8);
    return;
  }

  const data = state.iotData;

  // Device Health
  await renderDeviceHealth(data);

  // Anomaly Detection
  await renderAnomalyDetection(data);

  // Detailed sensor grid
  const isInitialRender = grid.querySelectorAll('.sensor-card').length === 0;

  grid.innerHTML = SENSORS.map((sensor, idx) => {
    const { val, display, trend } = getSensorValue(data, sensor.key);
    const status = getSensorStatus(sensor.key, val);
    const sparkData = getSparklineData(data.history, sensor.key);
    const spark = sparkData.length > 2 ? Charts.sparkline(sparkData, { w: 120, h: 36, color: sensor.sparkColor }) : '';
    const trendHtml = trend ? `<div class="sc-trend ${trend.dir}">${trend.label}</div>` : '';
    const animClass = isInitialRender ? `anim-fade-up anim-delay-${Math.min(idx + 1, 6)}` : '';

    return `
      <div class="sensor-card detailed ${animClass}"
           role="listitem" tabindex="0" data-sensor="${sensor.key}"
           aria-label="${sensor.label}: ${display}">
        <div class="sc-top">
          <div class="sc-icon" style="background:${sensor.color}18">${sensor.icon}</div>
          <span class="sc-status ${status.cls}">${status.label}</span>
        </div>
        <div class="sc-label">${sensor.label}</div>
        <div class="sc-value">${display}</div>
        ${trendHtml}
        <div class="sc-sparkline" aria-hidden="true">${spark}</div>
        <button class="btn-add-location" style="margin-top:8px;font-size:0.75rem" onclick="openSensorModal('${sensor.key}')">
          View Details
        </button>
      </div>`;
  }).join('');

  grid.querySelectorAll('.sensor-card').forEach(card => {
    card.addEventListener('click', () => openSensorModal(card.dataset.sensor));
  });
  refreshIcons();
}

// ── IoT Device Health ──────────────────────────────────────
async function renderDeviceHealth(iotData) {
  const content = $('device-health-content');
  const badge = $('device-status-badge');
  if (!content) return;

  try {
    const health = await API.getDeviceHealth(iotData?.status);
    state.deviceHealth = health;
    const device = health.device;
    const online = device.online;

    if (badge) {
      badge.className = `model-status-badge ${online ? 'healthy' : 'warning'}`;
      badge.textContent = online ? '● Healthy' : '⚠ Offline';
    }

    content.innerHTML = `
      <div class="device-hero">
        <div class="device-status-icon ${online ? 'online' : 'offline'}">
          ${online ? '📡' : '📵'}
        </div>
        <div class="device-info-header">
          <h3>${device.name}</h3>
          <p>${device.id} · Firmware ${device.firmware}</p>
          <div class="device-meta-row">
            <div class="device-meta-badge ${online ? 'online' : 'offline'}">
              ${online ? '● Online' : '● Offline'}
            </div>
            <div class="device-meta-badge">🔋 ${device.battery}%</div>
            <div class="device-meta-badge">📶 ${device.wifiQuality}</div>
            <div class="device-meta-badge">⏱ Uptime: ${device.uptime}h</div>
            <div class="device-meta-badge">📊 ${health.totalReadingsToday} readings today</div>
            <div class="device-meta-badge">📍 ${device.location.city}</div>
          </div>
        </div>
      </div>
      <div class="sensor-health-grid">
        ${health.sensors.map(s => {
      const minsSince = Math.round((Date.now() - new Date(s.lastSeen).getTime()) / 60000);
      const statusCls = !s.online ? 'offline' : minsSince > 5 ? 'stale' : 'online';
      const statusLabel = !s.online ? 'Offline' : minsSince > 5 ? 'Stale' : 'Live';
      return `
          <div class="sensor-health-item">
            <div class="shi-icon">${s.icon}</div>
            <div class="shi-info">
              <div class="shi-name">${s.name}</div>
              <div class="shi-val">${s.value} · ${statusLabel} · ${minsSince < 1 ? 'now' : minsSince + 'm ago'}</div>
            </div>
            <div class="shi-dot ${statusCls}"></div>
          </div>`;
    }).join('')}
      </div>`;
  } catch {
    content.innerHTML = '<p style="color:var(--text-3);padding:16px">Device health data unavailable.</p>';
  }
}

// ── Anomaly Detection ──────────────────────────────────────
async function renderAnomalyDetection(iotData) {
  const content = $('anomaly-content');
  if (!content || !iotData) return;

  try {
    const anomalies = await API.getAnomalies(iotData.history, iotData.current);
    state.anomalies = anomalies;

    if (anomalies.length === 0) {
      content.innerHTML = `
        <div class="anomaly-ok">
          <span style="font-size:1.5rem">✅</span>
          <div>
            <strong>All readings are within normal ranges.</strong><br>
            <span style="font-size:0.8125rem;color:var(--text-3)">Continuous statistical monitoring is active. Z-score and IQR checks passed.</span>
          </div>
        </div>`;
      return;
    }

    content.innerHTML = `
      <div class="anomaly-list">
        ${anomalies.map(a => `
          <div class="anomaly-card severity-${a.severity}">
            <div class="anomaly-icon">${a.icon}</div>
            <div class="anomaly-body">
              <div class="anomaly-title">${a.title}</div>
              <div class="anomaly-detail">
                Current: <strong>${a.current}</strong> — Expected range: ${a.expected}
              </div>
              <div class="anomaly-detail" style="margin-top:4px;font-style:italic">
                Possible cause: ${a.possibleCause}
              </div>
              <div class="anomaly-meta">
                <span class="anomaly-badge">Z-score: ${a.zScore}</span>
                <span class="anomaly-badge">${a.severity.toUpperCase()}</span>
                <span class="anomaly-badge" style="background:rgba(0,0,0,0.05);color:var(--text-3)">
                  ${formatTime(a.detected)}
                </span>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch {
    content.innerHTML = '<p style="color:var(--text-3);padding:16px">Anomaly detection unavailable.</p>';
  }
}

// ── AI full page ───────────────────────────────────────────
function renderAIPage() {
  const container = $('ai-full-content');
  if (!container || !state.aiPrediction) {
    if (container) container.innerHTML = renderSkeletonState('AI prediction loading…');
    return;
  }

  const data = state.aiPrediction;
  const histTemps = data.hourly.map(h => h.temperature);
  const histLabels = data.hourly.slice(0, 16).map(h => h.time);
  const chart = Charts.areaChart(histTemps.slice(0, 16), histLabels, {
    color: '#8B5CF6', fillFrom: '#8B5CF6', unit: '°C', w: 680, h: 160
  });

  container.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="section-header">
        <div>
          <h3>Temperature Forecast — Next 24 Hours</h3>
          <p style="margin-top:4px;font-size:0.8125rem;color:var(--text-3)">Model: ${data.modelVersion} · ${data.dataPoints?.toLocaleString()} training points · ${data.confidence}% confidence</p>
        </div>
        <span class="badge badge-ai">⬡ AI PREDICTED</span>
      </div>
      <div style="margin-top:8px;overflow:hidden;border-radius:var(--radius-md);background:var(--surface-2);padding:12px">
        ${chart}
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="section-header"><h3>Hourly Detail</h3></div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
          <thead>
            <tr style="color:var(--text-3);font-size:0.75rem;font-weight:600;border-bottom:1px solid var(--border)">
              <th style="padding:8px 12px;text-align:left">Time</th>
              <th style="padding:8px 12px;text-align:left">Condition</th>
              <th style="padding:8px 12px;text-align:right">Temp</th>
              <th style="padding:8px 12px;text-align:right">Humidity</th>
              <th style="padding:8px 12px;text-align:right">Rain %</th>
              <th style="padding:8px 12px;text-align:right">Wind</th>
              <th style="padding:8px 12px;text-align:right">Confidence</th>
            </tr>
          </thead>
          <tbody>
            ${data.hourly.slice(0, 24).map(h => `
              <tr style="${h.isNow ? 'background:var(--ai-bg);font-weight:600' : ''};border-bottom:1px solid var(--border)">
                <td style="padding:8px 12px">${h.isNow ? '<strong>Now</strong>' : h.time}</td>
                <td style="padding:8px 12px">${getWeatherIcon(h.condition)} ${getWeatherLabel(h.condition)}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:600">${h.temperature}°C</td>
                <td style="padding:8px 12px;text-align:right">${h.humidity}%</td>
                <td style="padding:8px 12px;text-align:right;color:#60A5FA">${h.rainProbability}%</td>
                <td style="padding:8px 12px;text-align:right">${h.windSpeed} km/h</td>
                <td style="padding:8px 12px;text-align:right;color:var(--text-3)">${h.confidence}%</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card" style="padding:14px 16px;background:var(--ai-bg);border:1px solid var(--ai-border)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:1.2rem">🤖</span>
        <strong style="color:var(--ai-color)">AI Summary</strong>
        <span class="badge badge-ai" style="margin-left:auto">Generated by Local AI Model</span>
      </div>
      <p style="color:var(--text-2);line-height:1.6">${data.summary}</p>
      <p style="font-size:0.75rem;color:var(--text-3);margin-top:8px">
        Generated: ${formatTime(data.generated)} · Confidence: ${data.confidence}% · Model: ${data.modelVersion}
      </p>
    </div>`;
}

// ── AI Lab page ────────────────────────────────────────────
async function renderAILabPage() {
  // Model performance
  await loadAndRenderModelPerformance();
  // AI vs Actual
  await loadAndRenderAIVsActual();
  // XAI
  await loadAndRenderXAI();
  // Model comparison
  renderModelComparison();
  // Local vs External
  renderLocalVsExternal();
}

async function loadAndRenderModelPerformance() {
  const grid = $('model-info-grid');
  const metrics = $('model-metrics-content');
  const badge = $('model-status-badge');
  if (!grid) return;

  try {
    const perf = state.modelPerformance || await API.getModelPerformance();
    state.modelPerformance = perf;
    const m = perf.model;

    if (badge) {
      badge.className = `model-status-badge ${perf.status}`;
      badge.textContent = `● ${perf.status.charAt(0).toUpperCase() + perf.status.slice(1)}`;
    }

    grid.innerHTML = [
      { label: 'Model Name', value: m.name },
      { label: 'Type', value: m.type },
      { label: 'Trained', value: m.trainingDate },
      { label: 'Training Data', value: m.trainingRecords.toLocaleString() + ' records' },
      { label: 'Features', value: m.features + ' inputs' },
      { label: 'Version', value: m.version },
    ].map(s => `
      <div class="model-info-stat">
        <div class="mis-label">${s.label}</div>
        <div class="mis-value">${s.value}</div>
      </div>`).join('');

    if (metrics) {
      const pm = perf.metrics;
      metrics.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <h4 style="font-size:0.8125rem;color:var(--text-3);margin-bottom:10px">Temperature Model</h4>
            ${pm.temperature.available ? `
            <div class="metric-row"><span class="metric-name">MAE</span><span class="metric-value">${pm.temperature.mae}°C</span></div>
            <div class="metric-row"><span class="metric-name">RMSE</span><span class="metric-value">${pm.temperature.rmse}°C</span></div>
            <div class="metric-row"><span class="metric-name">R²</span><span class="metric-value">${pm.temperature.r2}</span></div>
            ` : '<div class="metric-na">Not available yet</div>'}
          </div>
          <div>
            <h4 style="font-size:0.8125rem;color:var(--text-3);margin-bottom:10px">Rain Prediction</h4>
            ${pm.rain.available ? `
            <div class="metric-row"><span class="metric-name">Accuracy</span><span class="metric-value">${pm.rain.accuracy}%</span></div>
            <div class="metric-row"><span class="metric-name">Precision</span><span class="metric-value">${pm.rain.precision}</span></div>
            <div class="metric-row"><span class="metric-name">Recall</span><span class="metric-value">${pm.rain.recall}</span></div>
            ` : '<div class="metric-na">Not available yet</div>'}
          </div>
          <div>
            <h4 style="font-size:0.8125rem;color:var(--text-3);margin-bottom:10px">AQI Model</h4>
            <div class="metric-na" style="padding:12px 0;font-size:0.8125rem">⚠ Not available yet<br><span style="font-size:0.75rem">Requires additional sensor calibration data.</span></div>
          </div>
          <div>
            <h4 style="font-size:0.8125rem;color:var(--text-3);margin-bottom:10px">Wind Model</h4>
            <div class="metric-na" style="padding:12px 0;font-size:0.8125rem">⚠ Not available yet<br><span style="font-size:0.75rem">Wind speed prediction model in development.</span></div>
          </div>
        </div>`;
    }
  } catch {
    if (grid) grid.innerHTML = '<p class="metric-na">Model performance data unavailable.</p>';
  }
}

async function loadAndRenderAIVsActual() {
  const summary = $('ai-vs-actual-summary');
  const chartWrap = $('ai-vs-actual-chart');
  const tableWrap = $('ai-vs-actual-table-wrap');
  if (!summary) return;

  try {
    const iotData = state.iotData;
    const aiPred = state.aiPrediction;
    if (!iotData || !aiPred) {
      if (summary) summary.innerHTML = '<p class="metric-na">Load IoT data first.</p>';
      return;
    }

    const result = await API.getAIVsActual(aiPred.hourly, iotData.history);
    state.aiVsActual = result;
    const s = result.summary;

    if (summary) {
      summary.innerHTML = `
        <div class="model-info-grid">
          <div class="model-info-stat"><div class="mis-label">Overall Accuracy</div><div class="mis-value" style="color:var(--primary)">${s.overallAccuracy}%</div></div>
          <div class="model-info-stat"><div class="mis-label">Temp Accuracy</div><div class="mis-value">${s.temperatureAccuracy}%</div></div>
          <div class="model-info-stat"><div class="mis-label">Humidity Accuracy</div><div class="mis-value">${s.humidityAccuracy}%</div></div>
          <div class="model-info-stat"><div class="mis-label">Temp MAE</div><div class="mis-value">${s.mae}°C</div></div>
          <div class="model-info-stat"><div class="mis-label">RMSE</div><div class="mis-value">${s.rmse}°C</div></div>
          <div class="model-info-stat"><div class="mis-label">Data Points</div><div class="mis-value">${s.dataPoints}</div></div>
        </div>`;
    }

    // Multi-line chart
    if (chartWrap) {
      const predicted = result.validations.map(v => v.predicted.temperature);
      const actual = result.validations.map(v => v.actual.temperature);
      const labels = result.validations.map(v => v.time);
      chartWrap.innerHTML = `
        <div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-md)">
          ${Charts.multiLineChart([
        { label: 'AI Predicted', values: predicted, color: '#8B5CF6', dashed: true },
        { label: 'Actual (IoT)', values: actual, color: '#10B981', dashed: false },
      ], labels, { unit: '°C' })}
          <div style="display:flex;gap:16px;margin-top:8px;font-size:0.75rem">
            <span style="color:#8B5CF6">— — AI Predicted</span>
            <span style="color:#10B981">—— Actual (IoT)</span>
          </div>
        </div>`;
    }

    // Table
    if (tableWrap) {
      tableWrap.innerHTML = `
        <table class="ai-vs-actual-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Predicted Temp</th>
              <th>Actual Temp</th>
              <th>Temp Error</th>
              <th>Temp Accuracy</th>
              <th>Humidity Accuracy</th>
            </tr>
          </thead>
          <tbody>
            ${result.validations.map(v => {
        const tempCls = v.accuracies.temperature >= 90 ? 'good' : v.accuracies.temperature >= 75 ? 'ok' : 'bad';
        const humCls = v.accuracies.humidity >= 90 ? 'good' : v.accuracies.humidity >= 75 ? 'ok' : 'bad';
        return `
              <tr>
                <td>${v.time}</td>
                <td>${v.predicted.temperature}°C</td>
                <td>${v.actual.temperature}°C</td>
                <td>${v.errors.temperature}°C</td>
                <td><span class="acc-chip ${tempCls}">${v.accuracies.temperature}%</span></td>
                <td><span class="acc-chip ${humCls}">${v.accuracies.humidity}%</span></td>
              </tr>`;
      }).join('')}
          </tbody>
        </table>`;
    }
  } catch {
    if (summary) summary.innerHTML = '<p class="metric-na">AI validation data unavailable.</p>';
  }
}

async function loadAndRenderXAI() {
  const content = $('xai-content');
  if (!content) return;

  try {
    const iotData = state.iotData;
    const aiPred = state.aiPrediction;
    if (!iotData || !aiPred) {
      content.innerHTML = '<p class="metric-na">Load data first.</p>';
      return;
    }

    const explanations = await API.getAIPredictionExplanation(aiPred, iotData.current);
    state.aiExplanation = explanations;

    if (!explanations || explanations.length === 0) {
      content.innerHTML = '<p class="metric-na">No predictions available to explain yet.</p>';
      return;
    }

    content.innerHTML = explanations.map(ex => `
      <div style="margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <span style="font-size:1.4rem">${ex.icon}</span>
          <div>
            <div style="font-size:0.9375rem;font-weight:700">${ex.target}</div>
            <div style="font-size:0.8125rem;color:var(--text-3)">Predicted: <strong>${ex.value}</strong></div>
          </div>
        </div>
        <div style="margin-bottom:12px">
          ${ex.factors.map(f => `
            <div class="xai-factor-bar">
              <div class="xai-name">${f.name}</div>
              <div class="xai-bar-track">
                <div class="xai-bar-fill xai-fill-${f.direction}" style="width:${f.contribution}%"></div>
              </div>
              <div class="xai-pct">${f.contribution}%</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-3);margin-bottom:4px;padding-left:0">${f.detail}</div>
          `).join('')}
        </div>
        <div class="xai-explanation">${ex.explanation}</div>
      </div>`).join('<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">');
  } catch {
    content.innerHTML = '<p class="metric-na">Explanation engine unavailable.</p>';
  }
}

function renderModelComparison() {
  const content = $('model-compare-content');
  if (!content || !state.modelPerformance) return;

  const models = state.modelPerformance.modelComparison;
  content.innerHTML = `
    <table class="model-compare-table">
      <thead>
        <tr>
          <th>Model</th>
          <th>Temp MAE</th>
          <th>Temp RMSE</th>
          <th>Rain Accuracy</th>
          <th>Latency</th>
        </tr>
      </thead>
      <tbody>
        ${models.map(m => `
          <tr class="${m.highlight ? 'best-model' : ''}">
            <td>${m.name}${m.highlight ? '<span class="best-badge">CURRENT</span>' : ''}</td>
            <td>${m.temp_mae}°C</td>
            <td>${m.temp_rmse}°C</td>
            <td>${m.rain_acc}%</td>
            <td>${m.latency}ms</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <p style="font-size:0.75rem;color:var(--text-3);margin-top:10px">
      Comparison based on validation set from July 2026. Lower MAE/RMSE = better.
    </p>`;
}

function renderLocalVsExternal() {
  const content = $('local-vs-ext-content');
  if (!content) return;

  const iotData = state.iotData;
  const extData = state.externalWeather;

  const result = MockData.getLocalVsExternal(iotData?.current, extData?.current);

  if (!result.available) {
    content.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--text-3)">
        <div style="font-size:2rem;margin-bottom:8px">📍</div>
        <p style="font-size:0.875rem">${result.reason}</p>
        <button class="btn-add-location" style="margin:12px auto;display:flex" onclick="navigateTo('search')">
          Search Location
        </button>
      </div>`;
    return;
  }

  content.innerHTML = `
    <table class="lve-table">
      <thead>
        <tr>
          <th>Parameter</th>
          <th>🏠 ${result.iotLocation}</th>
          <th>🌐 ${result.externalLocation}</th>
          <th>Difference</th>
        </tr>
      </thead>
      <tbody>
        ${result.compared.map(row => `
          <tr>
            <td>${row.label}</td>
            <td class="iot-val">${row.iotVal} ${row.unit}</td>
            <td class="ext-val">${row.extVal} ${row.unit}</td>
            <td class="${row.significance === 'significant' ? 'diff-sig' : 'diff-norm'}">
              ${row.diff > 0 ? '+' : ''}${row.diff} ${row.unit}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="lve-insight">💡 ${result.insight}</div>`;

  // Also render on search page
  const searchResult = $('local-vs-ext-search');
  if (searchResult && extData) {
    searchResult.style.display = '';
    searchResult.innerHTML = `
      <div class="card">
        <div class="section-header" style="margin-bottom:12px">
          <h3>📍 Local vs External Comparison</h3>
        </div>
        <table class="lve-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>🏠 Local IoT</th>
              <th>🌐 ${result.externalLocation}</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            ${result.compared.map(row => `
              <tr>
                <td>${row.label}</td>
                <td class="iot-val">${row.iotVal} ${row.unit}</td>
                <td class="ext-val">${row.extVal} ${row.unit}</td>
                <td class="${row.significance === 'significant' ? 'diff-sig' : 'diff-norm'}">
                  ${row.diff > 0 ? '+' : ''}${row.diff} ${row.unit}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div class="lve-insight">💡 ${result.insight}</div>
      </div>`;
  }
}

// ── Forecast page ──────────────────────────────────────────
function renderForecastPage() {
  const container = $('forecast-full-content');
  if (!container || !state.aiPrediction) {
    if (container) container.innerHTML = renderSkeletonState('Loading forecast…');
    return;
  }

  const daily = state.aiPrediction.daily;
  container.innerHTML = `
    <div class="card">
      <div class="section-header"><h3>7-Day Forecast Overview</h3></div>
      <div class="seven-day-list">
        ${daily.map((d, i) => `
          <div class="forecast-row ${i === 0 ? 'today' : ''}" style="border-bottom:1px solid var(--border);padding:14px 12px">
            <span class="fr-day" style="width:100px">${d.day}<br><span style="font-size:0.75rem;color:var(--text-3)">${d.date}</span></span>
            <span class="fr-icon">${getWeatherIcon(d.condition)}</span>
            <span class="fr-desc" style="display:block">${getWeatherLabel(d.condition)}</span>
            <div style="flex:1;margin-left:8px">
              <div style="display:flex;align-items:center;gap:6px;font-size:0.8125rem;color:var(--text-3)">
                <i data-lucide="droplets" style="width:12px;height:12px"></i> ${d.rainProbability}% rain
                &nbsp;·&nbsp;
                <i data-lucide="wind" style="width:12px;height:12px"></i> ${d.wind} km/h
                &nbsp;·&nbsp;
                💧 ${d.humidity}% humid
              </div>
            </div>
            <span class="fr-temps">${d.high}° <span class="fr-low">/ ${d.low}°</span></span>
          </div>`).join('')}
      </div>
    </div>`;

  refreshIcons();
}

// ── Intelligence page ──────────────────────────────────────
function renderIntelligencePage() {
  const container = $('intelligence-full-content');
  if (!container || !state.iotData) {
    if (container) container.innerHTML = renderSkeletonState('Loading…');
    return;
  }

  const iotData = state.iotData;
  const recs = iotData.recommendations || [];
  const doDont = iotData.doDont || { dos: [], donts: [] };
  const alerts = iotData.safetyAlerts || [];

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card">
        <div class="section-header"><h3>Recommendations</h3></div>
        <div class="reco-list">
          ${recs.map(r => `
            <div class="reco-item type-${r.type}">
              <span class="reco-icon">${r.icon}</span>
              <div>
                <div class="reco-title">${r.title}</div>
                <div class="reco-message">${r.message}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="section-header"><h3>Do's &amp; Don'ts</h3></div>
        <div class="do-dont">
          <div class="do-col">
            <h4>✓ DO</h4>
            <ul class="do-list">${doDont.dos.map(d => `<li>${d}</li>`).join('')}</ul>
          </div>
          <div class="dont-col">
            <h4>✕ DON'T</h4>
            <ul class="dont-list">${doDont.donts.map(d => `<li>${d}</li>`).join('')}</ul>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="section-header"><h3>Safety Status</h3></div>
      <div class="safety-alerts">
        ${alerts.length === 0
      ? `<div class="safety-ok"><span class="ok-icon">✅</span><span>No active warnings. All conditions are within safe ranges.</span></div>`
      : alerts.map(a => `
            <div class="safety-alert level-${a.level}">
              <div class="alert-icon">${a.icon}</div>
              <div class="alert-body">
                <div class="alert-title">${a.title}</div>
                <div class="alert-desc">${a.description}</div>
                <div class="alert-actions">${a.actions.map(ac => `<div class="alert-action">${ac}</div>`).join('')}</div>
              </div>
            </div>`).join('')}
      </div>
    </div>`;
}

// ── Analytics page ─────────────────────────────────────────
async function renderAnalyticsPage() {
  await loadHistoricalData(state.analyticsRange);
  renderSystemAnalytics();
}

async function loadHistoricalData(range) {
  const chartWrap = $('analytics-chart-wrap');
  const statsRow = $('analytics-stats-row');
  const title = $('analytics-chart-title');
  const sensor = state.analyticsSensor;

  if (chartWrap) chartWrap.innerHTML = '<div class="skeleton skel-block" style="height:160px"></div>';

  try {
    const history = await API.getHistoricalData(range);
    state.historicalData = history;

    const values = history.map(h => h[sensor]).filter(v => v != null);
    const labels = history.map(h => formatTime(h.timestamp));

    const sensorDef = SENSORS.find(s => s.key === sensor) || SENSORS[0];

    if (title) {
      const sensorName = sensorDef.label;
      const rangeLabel = { '1h': 'Last 1h', '6h': 'Last 6h', '12h': 'Last 12h', '24h': 'Last 24h', '7d': 'Last 7 days', '30d': 'Last 30 days' }[range] || range;
      title.textContent = `${sensorName} — ${rangeLabel}`;
    }

    if (chartWrap && values.length > 2) {
      chartWrap.innerHTML = `
        <div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-md);overflow:hidden">
          ${Charts.areaChart(values, labels, {
        color: sensorDef.sparkColor,
        fillFrom: sensorDef.sparkColor,
        unit: ` ${sensorDef.unit}`,
        w: 720, h: 160
      })}
        </div>`;
    } else if (chartWrap) {
      chartWrap.innerHTML = '<p style="color:var(--text-3);padding:24px;text-align:center">Not enough data points for this range.</p>';
    }

    // Stats
    if (statsRow && values.length) {
      const min = Math.min(...values).toFixed(1);
      const max = Math.max(...values).toFixed(1);
      const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
      statsRow.innerHTML = `
        <div class="astat"><div class="astat-label">Min</div><div class="astat-value">${min}<span class="astat-unit">${sensorDef.unit}</span></div></div>
        <div class="astat"><div class="astat-label">Max</div><div class="astat-value">${max}<span class="astat-unit">${sensorDef.unit}</span></div></div>
        <div class="astat"><div class="astat-label">Average</div><div class="astat-value">${avg}<span class="astat-unit">${sensorDef.unit}</span></div></div>
        <div class="astat"><div class="astat-label">Readings</div><div class="astat-value">${values.length}</div></div>`;
    }
  } catch {
    if (chartWrap) chartWrap.innerHTML = '<p style="color:var(--text-3);padding:24px;text-align:center">Failed to load historical data.</p>';
  }
}

async function renderSystemAnalytics() {
  const grid = $('system-analytics-grid');
  if (!grid) return;

  try {
    const analytics = await API.getSystemAnalytics();
    state.systemAnalytics = analytics;

    const items = [
      { icon: '📡', value: analytics.totalReadings.toLocaleString(), label: 'Total Readings' },
      { icon: '🤖', value: analytics.totalPredictions.toLocaleString(), label: 'Total Predictions' },
      { icon: '🎯', value: analytics.averageAccuracy + '%', label: 'Avg Accuracy' },
      { icon: '⚡', value: analytics.totalAnomalies, label: 'Anomalies Detected' },
      { icon: '🔔', value: analytics.totalAlerts, label: 'Alerts Generated' },
      { icon: '📶', value: analytics.iotUptime + '%', label: 'IoT Uptime' },
      { icon: '🗃️', value: analytics.dataAvailability + '%', label: 'Data Availability' },
      { icon: '⏱', value: analytics.avgResponseTime, label: 'Avg Response Time' },
    ];

    grid.innerHTML = items.map(it => `
      <div class="sag-card">
        <div class="sag-icon">${it.icon}</div>
        <div class="sag-value">${it.value}</div>
        <div class="sag-label">${it.label}</div>
      </div>`).join('');
  } catch {
    grid.innerHTML = '<p style="color:var(--text-3)">Analytics unavailable.</p>';
  }
}

// ── Map page ───────────────────────────────────────────────
function renderMapPage() {
  const stationReadings = $('map-station-readings');
  if (!stationReadings || !state.iotData?.current) return;

  const c = state.iotData.current;
  stationReadings.innerHTML = [
    { label: 'Temperature', value: `${c.temperature}°C` },
    { label: 'Humidity', value: `${c.humidity}%` },
    { label: 'AQI', value: `${c.aqi}` },
    { label: 'Wind', value: `${c.windSpeed} km/h` },
  ].map(r => `
    <div class="sic-reading">
      <div class="sic-reading-label">${r.label}</div>
      <div class="sic-reading-value">${r.value}</div>
    </div>`).join('');
}

// ── Search page ────────────────────────────────────────────
function renderSearchResults(results, containerId) {
  const container = $(containerId);
  if (!container) return;

  if (!results || results.length === 0) {
    container.innerHTML = `
      <div class="state-card">
        <div class="state-icon">🔍</div>
        <div class="state-title">No results found</div>
        <div class="state-msg">Try a different city name</div>
      </div>`;
    return;
  }

  container.innerHTML = results.map(loc => `
    <div class="search-result-card" role="option" data-loc='${JSON.stringify(loc)}' tabindex="0">
      <div class="src-location">
        <i data-lucide="map-pin"></i>
        <div>
          <div class="src-city">${loc.city}</div>
          <div class="src-state">${loc.state}, ${loc.country}</div>
        </div>
      </div>
      <div class="src-arrow"><i data-lucide="chevron-right"></i></div>
    </div>`).join('');

  container.querySelectorAll('.search-result-card').forEach(card => {
    const loc = JSON.parse(card.dataset.loc);
    card.addEventListener('click', () => loadExternalWeather(loc));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') loadExternalWeather(loc); });
  });

  refreshIcons();
}

async function loadExternalWeather(loc) {
  const resultDiv = $('ext-weather-result');
  if (!resultDiv) return;

  show(resultDiv);
  resultDiv.innerHTML = `<div class="card" style="text-align:center;padding:32px">
    <div class="spinner" style="margin:0 auto"></div>
    <p style="margin-top:10px;color:var(--text-3)">Loading weather for ${loc.city}…</p>
  </div>`;

  try {
    const data = await API.getExternalWeather(loc);
    state.externalWeather = data;
    renderExternalWeatherCard(data, resultDiv);

    // Show comparison after external weather loads
    renderLocalVsExternal();

    const lveSearch = $('local-vs-ext-search');
    if (lveSearch) lveSearch.style.display = '';
  } catch {
    resultDiv.innerHTML = `<div class="state-card card">
      <div class="state-icon">⚠️</div>
      <div class="state-title">Weather Unavailable</div>
      <div class="state-msg">Could not load weather for ${loc.city}. Try again.</div>
    </div>`;
  }
}

function renderExternalWeatherCard(data, container) {
  const c = data.current;
  const loc = data.location;
  const isSaved = state.savedLocations.some(s => s.city === loc.city);

  container.innerHTML = `
    <div class="card ext-weather-card">
      <div class="ext-header">
        <div>
          <span class="badge badge-ext">↗ EXTERNAL WEATHER</span>
          <div style="margin-top:8px">
            <div style="font-size:1rem;font-weight:700">${loc.city}</div>
            <div style="font-size:0.8125rem;color:var(--text-3)">${loc.state}, ${loc.country}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${!isSaved
      ? `<button class="btn-add-location" id="save-ext-loc" data-loc='${JSON.stringify(loc)}'>
                <i data-lucide="bookmark-plus"></i> Save Location
               </button>`
      : `<span class="badge badge-success">✓ Saved</span>`}
        </div>
      </div>
      <div class="ext-temp-row">
        <div class="ext-icon" aria-hidden="true">${getWeatherIcon(c.condition)}</div>
        <div class="ext-temp">${Math.round(c.temperature)}</div>
        <div class="ext-unit">°C</div>
        <div style="margin-left:12px">
          <div style="font-size:1.1rem;font-weight:600;color:var(--text-1)">${getWeatherLabel(c.condition)}</div>
          <div style="font-size:0.875rem;color:var(--text-3)">Feels like ${Math.round(c.feelsLike)}°C</div>
        </div>
      </div>
      <div class="ext-details">
        <div class="ext-detail-item"><div class="label">Humidity</div><div class="value">${c.humidity}%</div></div>
        <div class="ext-detail-item"><div class="label">Wind</div><div class="value">${c.windSpeed} km/h</div></div>
        <div class="ext-detail-item"><div class="label">Pressure</div><div class="value">${c.pressure} hPa</div></div>
        <div class="ext-detail-item"><div class="label">Visibility</div><div class="value">${c.visibility} km</div></div>
        <div class="ext-detail-item"><div class="label">AQI</div><div class="value" style="color:${c.aqiInfo?.color}">${c.aqi}</div></div>
        <div class="ext-detail-item"><div class="label">UV Index</div><div class="value" style="color:${c.uvInfo?.color}">${c.uvIndex}</div></div>
      </div>
      <p style="font-size:0.75rem;color:var(--text-3);margin-top:12px;text-align:right">
        Fetched at ${formatTime(data.fetchedAt)}
      </p>
    </div>`;

  const saveBtn = $('save-ext-loc');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveLocation(JSON.parse(saveBtn.dataset.loc), c.temperature, c.condition));
  }

  refreshIcons();
}

// ── Topbar search dropdown ─────────────────────────────────
function renderTopbarSearchDropdown(results) {
  const dd = $('topbar-search-dropdown');
  if (!dd) return;

  if (!results || results.length === 0) {
    dd.classList.remove('visible');
    return;
  }

  dd.innerHTML = results.map(loc => `
    <div class="search-result-item" role="option" data-loc='${JSON.stringify(loc)}' tabindex="0">
      <i data-lucide="map-pin" aria-hidden="true"></i>
      <div>
        <div class="sri-city">${loc.city}</div>
        <div class="sri-state">${loc.state}, ${loc.country}</div>
      </div>
    </div>`).join('');

  dd.querySelectorAll('.search-result-item').forEach(item => {
    const loc = JSON.parse(item.dataset.loc);
    item.addEventListener('click', () => {
      dd.classList.remove('visible');
      $('topbar-search-input').value = '';
      navigateTo('search');
      setTimeout(() => loadExternalWeather(loc), 100);
    });
  });

  dd.classList.add('visible');
  refreshIcons();
}

// ── Saved locations ────────────────────────────────────────
function loadSavedLocations() {
  try {
    const stored = localStorage.getItem('wiq-saved');
    state.savedLocations = stored ? JSON.parse(stored) : MockData.getDefaultSavedLocations();
  } catch {
    state.savedLocations = MockData.getDefaultSavedLocations();
  }
}

function persistSavedLocations() {
  localStorage.setItem('wiq-saved', JSON.stringify(state.savedLocations));
}

function saveLocation(loc, temp, condition) {
  if (state.savedLocations.find(s => s.city === loc.city)) return;
  state.savedLocations.push({
    id: Date.now(),
    city: loc.city,
    state: loc.state,
    country: loc.country,
    lat: loc.lat,
    lng: loc.lng,
    temp: Math.round(temp),
    condition: condition,
  });
  persistSavedLocations();
  renderSavedLocations();
}

function removeLocation(id) {
  state.savedLocations = state.savedLocations.filter(s => s.id !== id);
  persistSavedLocations();
  renderSavedLocations();
}

function renderSavedLocations() {
  const list = $('saved-list');
  if (!list) return;

  if (state.savedLocations.length === 0) {
    list.innerHTML = `
      <div class="saved-empty">
        <div class="empty-icon">📍</div>
        <p>No saved locations yet.<br>Search for a city and save it here.</p>
      </div>`;
    return;
  }

  list.innerHTML = state.savedLocations.map(loc => `
    <div class="saved-card" role="listitem" data-loc='${JSON.stringify(loc)}'>
      <div class="saved-info">
        <span class="saved-icon-wrap" aria-hidden="true">📍</span>
        <div>
          <div class="saved-city">${loc.city}</div>
          <div class="saved-state">${loc.state}, ${loc.country}</div>
        </div>
      </div>
      <div class="saved-weather">
        <span class="saved-temp">${loc.temp}°C</span>
        <span aria-hidden="true">${getWeatherIcon(loc.condition)}</span>
        <button class="saved-remove" data-id="${loc.id}" aria-label="Remove ${loc.city} from saved locations">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.saved-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.saved-remove')) return;
      const loc = JSON.parse(card.dataset.loc);
      navigateTo('search');
      setTimeout(() => loadExternalWeather(loc), 100);
    });
  });

  list.querySelectorAll('.saved-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeLocation(+btn.dataset.id);
    });
  });

  refreshIcons();
}

// ── Settings page (extended with tabs) ────────────────────
function renderSettings() {
  const container = $('settings-content');
  if (!container) return;

  const iotData = state.iotData;
  const notifSettings = window.NotificationsManager ? NotificationsManager.getSettings() : {};

  container.innerHTML = `
    <!-- Settings Tabs -->
    <div class="settings-tab-row">
      <button class="settings-tab active" data-settings-tab="general">⚙️ General</button>
      <button class="settings-tab" data-settings-tab="alerts">🔔 Alerts</button>
      <button class="settings-tab" data-settings-tab="device">📡 Device</button>
      <button class="settings-tab" data-settings-tab="demo">🎭 Demo</button>
      <button class="settings-tab" data-settings-tab="about">ℹ️ About</button>
    </div>

    <!-- Tab: General -->
    <div class="settings-panel active" id="settings-panel-general">
      <div class="settings-section">
        <h3>Appearance</h3>
        <div class="settings-row">
          <div>
            <div class="sr-label">Dark Mode</div>
            <div class="sr-desc">Switch between light and dark interface</div>
          </div>
          <label class="toggle" aria-label="Toggle dark mode">
            <input type="checkbox" id="dark-toggle" ${state.theme === 'dark' ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="settings-section">
        <h3>Location</h3>
        <div class="settings-row">
          <div>
            <div class="sr-label">Auto-Detect Location</div>
            <div class="sr-desc">Use browser geolocation to detect your location</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="auto-location-toggle">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="settings-section">
        <h3>Data Refresh</h3>
        <div class="settings-row">
          <div>
            <div class="sr-label">Auto-Refresh</div>
            <div class="sr-desc">Automatically refresh IoT data every 60 seconds</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="auto-refresh-toggle" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- Tab: Alerts -->
    <div class="settings-panel" id="settings-panel-alerts">
      <div class="settings-section">
        <h3>Alert Preferences</h3>
        <div class="alert-pref-item">
          <div class="apref-left">
            <div class="apref-icon">🌧️</div>
            <div>
              <div class="apref-label">Rain Alerts</div>
              <div class="apref-desc">Threshold: <input class="threshold-input" id="thresh-rain" type="number" value="${notifSettings.thresholds?.rain || 60}" min="0" max="100">% probability</div>
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="alert-rain" ${notifSettings.rain !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="alert-pref-item">
          <div class="apref-left">
            <div class="apref-icon">🫁</div>
            <div>
              <div class="apref-label">Air Quality Alerts</div>
              <div class="apref-desc">Threshold: AQI > <input class="threshold-input" id="thresh-aqi" type="number" value="${notifSettings.thresholds?.aqi || 100}" min="0" max="500"></div>
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="alert-aqi" ${notifSettings.aqi !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="alert-pref-item">
          <div class="apref-left">
            <div class="apref-icon">🌡️</div>
            <div>
              <div class="apref-label">High Temperature Alerts</div>
              <div class="apref-desc">Alert when temperature exceeds <input class="threshold-input" id="thresh-temp" type="number" value="${notifSettings.thresholds?.temperatureHigh || 38}" min="20" max="60">°C</div>
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="alert-temp" ${notifSettings.temperature !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="alert-pref-item">
          <div class="apref-left">
            <div class="apref-icon">☀️</div>
            <div>
              <div class="apref-label">UV Index Alerts</div>
              <div class="apref-desc">Alert when UV Index exceeds <input class="threshold-input" id="thresh-uv" type="number" value="${notifSettings.thresholds?.uv || 8}" min="0" max="11"></div>
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="alert-uv" ${notifSettings.uv !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="alert-pref-item">
          <div class="apref-left">
            <div class="apref-icon">📡</div>
            <div>
              <div class="apref-label">IoT Device Offline Alert</div>
              <div class="apref-desc">Alert when IoT station goes offline</div>
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="alert-iot" ${notifSettings.iotOffline !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="settings-section">
        <h3>Browser Notifications</h3>
        <div class="settings-row">
          <div>
            <div class="sr-label">Push Notifications</div>
            <div class="sr-desc">Receive browser push notifications for weather alerts</div>
          </div>
          <button class="btn-add-location" id="request-push-btn">Enable Push</button>
        </div>
      </div>
    </div>

    <!-- Tab: Device -->
    <div class="settings-panel" id="settings-panel-device">
      <div class="settings-section">
        <h3>IoT Station</h3>
        <div class="device-info-card">
          <div class="di-row"><span class="di-key">Device ID</span><span class="di-value">${iotData?.deviceId || '—'}</span></div>
          <div class="di-row"><span class="di-key">Firmware</span><span class="di-value">${iotData?.firmwareVersion || '—'}</span></div>
          <div class="di-row"><span class="di-key">Battery</span><span class="di-value">${iotData?.batteryLevel != null ? iotData.batteryLevel + '%' : '—'}</span></div>
          <div class="di-row"><span class="di-key">Signal Strength</span><span class="di-value">${iotData?.signalStrength != null ? iotData.signalStrength + '%' : iotData?.signal || '—'}</span></div>
          <div class="di-row"><span class="di-key">Status</span>
            <span class="di-value" style="color:var(--iot-color)">${iotData?.status || '—'}</span>
          </div>
          <div class="di-row"><span class="di-key">Last Update</span>
            <span class="di-value">${iotData?.lastUpdate ? timeAgo(iotData.lastUpdate) : '—'}</span>
          </div>
          <div class="di-row"><span class="di-key">Location</span>
            <span class="di-value">${iotData?.location?.city || '—'}, ${iotData?.location?.state || '—'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: Demo Mode -->
    <div class="settings-panel" id="settings-panel-demo">
      <div class="settings-section">
        <h3>🎭 Demo Mode</h3>
        <p style="font-size:0.8125rem;color:var(--text-3);margin-bottom:16px">
          Demo mode lets you simulate specific weather events to preview how WeatherIQ responds. Data will be clearly labelled as DEMO.
        </p>
        <div class="settings-row">
          <div>
            <div class="sr-label">Enable Demo Mode</div>
            <div class="sr-desc">Replace live data with simulated scenario</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="demo-toggle" ${state.demoMode ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div style="margin-top:14px">
          <div style="font-size:0.875rem;font-weight:600;margin-bottom:8px;color:var(--text-2)">Scenario</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${[
      { key: 'rain_event', label: '🌧️ Rain Event' },
      { key: 'aqi_spike', label: '🫁 AQI Spike' },
      { key: 'temp_spike', label: '🌡️ Heat Wave' },
      { key: 'clear_night', label: '🌙 Clear Night' },
    ].map(s => `
              <button class="trn-btn demo-scenario-btn ${state.demoScenario === s.key ? 'active' : ''}"
                      data-scenario="${s.key}">${s.label}</button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: About -->
    <div class="settings-panel" id="settings-panel-about">
      <div class="settings-section">
        <h3>About WeatherIQ</h3>
        <div class="device-info-card">
          <div class="di-row"><span class="di-key">Application</span><span class="di-value">WeatherIQ</span></div>
          <div class="di-row"><span class="di-key">Version</span><span class="di-value">2.0.0</span></div>
          <div class="di-row"><span class="di-key">AI Model</span><span class="di-value">${state.aiPrediction?.modelVersion || '—'}</span></div>
          <div class="di-row"><span class="di-key">Training Data</span><span class="di-value">${state.aiPrediction?.dataPoints?.toLocaleString() || '—'} points</span></div>
          <div class="di-row"><span class="di-key">Features</span><span class="di-value">IoT Sensors, AI Prediction, Anomaly Detection, Smart Alerts, PWA</span></div>
        </div>
      </div>
    </div>`;

  // Wire settings tabs
  container.querySelectorAll('[data-settings-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('[data-settings-tab]').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = $(`settings-panel-${tab.dataset.settingsTab}`);
      if (panel) panel.classList.add('active');
    });
  });

  // Dark mode toggle
  const dt = $('dark-toggle');
  if (dt) dt.addEventListener('change', () => toggleTheme());

  // Demo toggle
  const demoT = $('demo-toggle');
  if (demoT) demoT.addEventListener('change', () => toggleDemoMode(demoT.checked));

  // Demo scenario buttons
  container.querySelectorAll('.demo-scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.demoScenario = btn.dataset.scenario;
      container.querySelectorAll('.demo-scenario-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (state.demoMode) applyDemoScenario();
    });
  });

  // Push notifications
  const pushBtn = $('request-push-btn');
  if (pushBtn && window.NotificationsManager) {
    pushBtn.addEventListener('click', async () => {
      const granted = await NotificationsManager.requestBrowserPermission();
      pushBtn.textContent = granted ? '✅ Enabled' : '❌ Blocked';
    });
  }

  // Alert preference toggles
  ['rain', 'aqi', 'uv', 'temp', 'iot'].forEach(type => {
    const toggle = $(`alert-${type}`);
    if (toggle && window.NotificationsManager) {
      toggle.addEventListener('change', () => {
        const key = type === 'temp' ? 'temperature' : type === 'iot' ? 'iotOffline' : type;
        NotificationsManager.updateSettings({ [key]: toggle.checked });
      });
    }
  });
}

// ── Demo Mode ──────────────────────────────────────────────
function toggleDemoMode(enabled) {
  state.demoMode = enabled;
  const banner = $('demo-banner');
  if (banner) banner.classList.toggle('hidden', !enabled);
  if (enabled) {
    if (!state.demoScenario) state.demoScenario = 'rain_event';
    applyDemoScenario();
  } else {
    // Restore real data
    if (state.iotData) {
      renderCurrentWeather(state.iotData);
      renderSensorGrid(state.iotData);
      renderRecommendations(state.iotData);
      renderSafetyAlerts(state.iotData);
    }
  }
}

function applyDemoScenario() {
  if (!state.demoScenario) return;
  const scenario = MockData.getDemoScenario(state.demoScenario);

  const bannerLabel = $('demo-scenario-label');
  if (bannerLabel) bannerLabel.textContent = `${scenario.label} Simulation`;

  if (scenario.current) {
    const demoIoT = {
      ...state.iotData,
      status: 'connected',
      current: { ...state.iotData?.current, ...scenario.current },
    };
    renderCurrentWeather(demoIoT);
    renderSensorGrid(demoIoT);
    renderWeatherScore(demoIoT);
    renderActivityScores(demoIoT);
    renderSunriseSunset(demoIoT);
  }
}

// ── Notifications ──────────────────────────────────────────
function setupNotifications() {
  if (!window.NotificationsManager) return;

  // Load initial notifications
  API.getNotifications().then(notifs => {
    NotificationsManager.init(notifs);
  });

  // Listen for updates
  NotificationsManager.onUpdate((notifications, unread) => {
    const badge = $('notif-unread-badge');
    const dot = $('notif-dot');
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = unread > 0 ? '' : 'none';
    }
    if (dot) dot.style.display = unread > 0 ? '' : 'none';
    renderNotificationList(notifications);
  });
}

function renderNotificationList(notifications) {
  const list = $('notif-list');
  if (!list) return;

  const filter = state.notifFilter || 'all';
  const filtered = filter === 'all' ? notifications
    : notifications.filter(n => n.category === filter);

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">🔔</div>
        <p>No ${filter === 'all' ? '' : filter + ' '}notifications</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-notif-id="${n.id}" role="listitem">
      <div class="notif-item-icon">${n.icon}</div>
      <div class="notif-item-body">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-msg">${n.message}</div>
        <div class="notif-item-time">${timeAgo(n.time)}</div>
      </div>
    </div>`).join('');

  list.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.NotificationsManager) NotificationsManager.markRead(+item.dataset.notifId);
      item.classList.remove('unread');
    });
  });
}

function toggleNotifPanel() {
  state.notifPanelOpen = !state.notifPanelOpen;
  const panel = $('notif-panel');
  if (panel) panel.classList.toggle('open', state.notifPanelOpen);
}

// ── AI Assistant ───────────────────────────────────────────
function setupAssistant() {
  const fab = $('assistant-fab');
  const panel = $('assistant-panel');
  const close = $('assistant-close');
  const input = $('assistant-input');
  const send = $('assistant-send');

  if (!fab) return;

  fab.addEventListener('click', () => {
    state.assistantPanelOpen = !state.assistantPanelOpen;
    panel?.classList.toggle('open', state.assistantPanelOpen);
    if (state.assistantPanelOpen) input?.focus();
  });

  if (close) close.addEventListener('click', () => {
    state.assistantPanelOpen = false;
    panel?.classList.remove('open');
  });

  const handleSend = async () => {
    const query = input?.value?.trim();
    if (!query) return;
    input.value = '';
    appendAssistantMessage(query, 'user');
    appendAssistantMessage('Thinking…', 'bot typing');

    try {
      const response = await API.askAssistant(query, state.iotData, state.aiPrediction);
      removeTypingMessage();
      appendAssistantBotMessage(response);
    } catch {
      removeTypingMessage();
      appendAssistantMessage('Sorry, I couldn\'t process that. Please try again.', 'bot');
    }
  };

  if (send) send.addEventListener('click', handleSend);
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });

  // Suggestion chips
  const suggestions = document.querySelectorAll('.suggestion-chip');
  suggestions.forEach(chip => {
    chip.addEventListener('click', () => {
      if (input) input.value = chip.dataset.query;
      handleSend();
      state.assistantPanelOpen = true;
      panel?.classList.add('open');
    });
  });
}

function appendAssistantMessage(text, cls) {
  const messages = $('assistant-messages');
  if (!messages) return;
  const div = document.createElement('div');
  div.className = `assistant-msg ${cls}`;
  div.textContent = text;
  if (cls.includes('typing')) div.dataset.typing = 'true';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function appendAssistantBotMessage(response) {
  const messages = $('assistant-messages');
  if (!messages) return;

  const sourceBadgeColors = { 'LIVE IoT': 'background:#10B981;color:white', 'AI PREDICTED': 'background:#8B5CF6;color:white', 'EXTERNAL': 'background:#F59E0B;color:white' };

  const div = document.createElement('div');
  div.className = 'assistant-msg bot';
  div.innerHTML = `
    <div>${response.answer}</div>
    ${response.sources && response.sources.length > 0 ? `
    <div class="assistant-sources">
      ${response.sources.map(s => `
        <div class="assistant-source-item">
          <span>${s.label}: <strong>${s.value}</strong></span>
          <span class="assistant-source-badge" style="${sourceBadgeColors[s.source] || 'background:var(--border);color:var(--text-2)'}">${s.source}</span>
        </div>`).join('')}
    </div>` : ''}
    <div class="assistant-confidence">Confidence: ${response.confidence}%</div>`;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function removeTypingMessage() {
  const messages = $('assistant-messages');
  if (!messages) return;
  const typing = messages.querySelector('[data-typing="true"]');
  if (typing) typing.remove();
}

// ── PWA Setup ──────────────────────────────────────────────
function setupPWA() {
  if (!window.PWAManager) return;
  PWAManager.init();

  PWAManager.onInstallable(canInstall => {
    const bar = $('pwa-install-bar');
    if (bar) bar.classList.toggle('hidden', !canInstall);
  });

  PWAManager.onOffline(() => {
    const banner = $('offline-banner');
    if (banner) banner.classList.remove('hidden');
  });

  PWAManager.onOnline(() => {
    const banner = $('offline-banner');
    if (banner) banner.classList.add('hidden');
    // Refresh data on reconnection
    loadIoTData().then(data => { if (data) loadAIPrediction(); });
  });

  const installBtn = $('btn-pwa-install');
  const dismissBtn = $('btn-pwa-dismiss');
  const installBar = $('pwa-install-bar');

  if (installBtn) installBtn.addEventListener('click', () => PWAManager.promptInstall());
  if (dismissBtn) dismissBtn.addEventListener('click', () => {
    if (installBar) installBar.classList.add('hidden');
  });
}

// ── Export wiring ──────────────────────────────────────────
function setupExport() {
  if (!window.DataExporter) return;

  const exportCsv = $('export-csv');
  const exportJson = $('export-json');
  const exportPdf = $('export-pdf');

  if (exportCsv) exportCsv.addEventListener('click', () => {
    DataExporter.historyToCSV(
      state.historicalData || state.iotData?.history || [],
      `weatheriq-history-${state.exportRange}.csv`
    );
  });

  if (exportJson) exportJson.addEventListener('click', () => {
    DataExporter.exportFullPackage(state.iotData, state.aiPrediction, state.externalWeather);
  });

  if (exportPdf) exportPdf.addEventListener('click', () => {
    DataExporter.exportPDF(state.iotData, state.aiPrediction);
  });
}

// ── Helper states ──────────────────────────────────────────
function renderSkeletonState(message) {
  return `<div class="state-card"><div class="spinner"></div><div class="state-msg">${message}</div></div>`;
}

function renderLoadingGrid(count) {
  return Array.from({ length: count }, () =>
    `<div class="skeleton skel-block" style="height:160px;border-radius:12px"></div>`
  ).join('');
}

// ── IoT polling ────────────────────────────────────────────
function setupPolling() {
  // Update relative time every 5 seconds
  setInterval(() => {
    if (state.iotData?.lastUpdate) {
      const el = $('iot-update-time');
      if (el) el.textContent = timeAgo(state.iotData.lastUpdate);
      updateLastUpdatedChip();
    }
  }, 5_000);

  // Refresh IoT data every 5 seconds
  state.iotPollingTimer = setInterval(async () => {
    try {
      const data = await API.getIoTData();
      state.iotData = data;
      renderCurrentWeather(data);
      renderSensorGrid(data);
      renderIoTStatus(data);
      renderWeatherScore(data);
      renderActivityScores(data);
      renderSunriseSunset(data);
      if (state.currentPage === 'sensors') renderSensorsPage();

      // Check alert thresholds
      if (window.NotificationsManager) NotificationsManager.checkThresholds(data);
    } catch { /* keep showing last known data */ }
  }, 5_000);
}

// ── Event listeners ────────────────────────────────────────
function setupEventListeners() {
  // Sidebar nav items
  $$('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.page);
      closeSidebarOnMobile();
    });
  });

  // Mobile bottom nav
  $$('.mobile-nav-item[data-page]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  // Sidebar toggle
  const toggle = $('sidebar-toggle');
  const sidebar = $('sidebar');
  const overlay = $('sidebar-overlay');

  if (toggle) toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    overlay.classList.toggle('show', open);
  });

  if (overlay) overlay.addEventListener('click', closeSidebarOnMobile);

  // Theme toggle
  const themeBtn = $('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Notification button
  const notifBtn = $('notification-btn');
  if (notifBtn) notifBtn.addEventListener('click', () => toggleNotifPanel());

  const notifClose = $('notif-close');
  if (notifClose) notifClose.addEventListener('click', () => {
    state.notifPanelOpen = false;
    $('notif-panel')?.classList.remove('open');
  });

  const notifMarkAll = $('notif-mark-all');
  if (notifMarkAll && window.NotificationsManager) {
    notifMarkAll.addEventListener('click', () => NotificationsManager.markAllRead());
  }

  // Notification filter buttons
  const filterRow = $('notif-filter-row');
  if (filterRow) {
    filterRow.querySelectorAll('.notif-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterRow.querySelectorAll('.notif-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.notifFilter = btn.dataset.filter;
        renderNotificationList(window.NotificationsManager ? NotificationsManager.getAll() : []);
      });
    });
  }

  // Location refresh
  const refreshBtn = $('location-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', async () => {
    refreshBtn.style.animation = 'spin 1s linear infinite';
    await loadIoTData();
    refreshBtn.style.animation = '';
  });

  // Modal close
  const modalClose = $('modal-close');
  if (modalClose) modalClose.addEventListener('click', closeModal);

  const modalOverlay = $('modal-overlay');
  if (modalOverlay) modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });

  // Keyboard: Escape closes modal/panels
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      if (state.notifPanelOpen) { state.notifPanelOpen = false; $('notif-panel')?.classList.remove('open'); }
      if (state.assistantPanelOpen) { state.assistantPanelOpen = false; $('assistant-panel')?.classList.remove('open'); }
    }
  });

  // Topbar search with debounce
  const topbarInput = $('topbar-search-input');
  if (topbarInput) {
    topbarInput.addEventListener('input', () => {
      const q = topbarInput.value.trim();
      clearTimeout(state.searchDebounce);
      if (q.length < 2) {
        $('topbar-search-dropdown')?.classList.remove('visible');
        return;
      }
      state.searchDebounce = setTimeout(async () => {
        const results = await API.searchLocations(q);
        renderTopbarSearchDropdown(results);
      }, 300);
    });

    topbarInput.addEventListener('blur', () => {
      setTimeout(() => $('topbar-search-dropdown')?.classList.remove('visible'), 200);
    });
  }

  // Search page input
  const searchPageInput = $('search-page-input');
  if (searchPageInput) {
    searchPageInput.addEventListener('input', () => {
      const q = searchPageInput.value.trim();
      const hint = $('search-page-hint');
      clearTimeout(state.searchDebounce);

      if (q.length < 2) {
        const res = $('search-page-results');
        if (res) res.innerHTML = '';
        if (hint) hint.style.display = '';
        return;
      }
      if (hint) hint.style.display = 'none';

      state.searchDebounce = setTimeout(async () => {
        const results = await API.searchLocations(q);
        renderSearchResults(results, 'search-page-results');
      }, 300);
    });
  }

  // AI Lab tabs
  const aiLabTabs = $('ai-lab-tabs');
  if (aiLabTabs) {
    aiLabTabs.querySelectorAll('.ai-lab-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        aiLabTabs.querySelectorAll('.ai-lab-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const panelId = `ailab-panel-${tab.dataset.tab}`;
        document.querySelectorAll('.ai-lab-panel').forEach(p => p.classList.remove('active'));
        const panel = $(panelId);
        if (panel) panel.classList.add('active');
        state.aiLabTab = tab.dataset.tab;
      });
    });
  }

  // Time range selector (analytics)
  const rangeSelector = $('time-range-selector');
  if (rangeSelector) {
    rangeSelector.querySelectorAll('.trn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        rangeSelector.querySelectorAll('.trn-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.analyticsRange = btn.dataset.range;
        loadHistoricalData(state.analyticsRange);
      });
    });
  }

  // Sensor selector (analytics)
  const sensorSelect = $('analytics-sensor-select');
  if (sensorSelect) {
    sensorSelect.querySelectorAll('.sensor-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sensorSelect.querySelectorAll('.sensor-select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.analyticsSensor = btn.dataset.sensor;
        loadHistoricalData(state.analyticsRange);
      });
    });
  }

  // Export range selector
  const exportRange = $('export-range-selector');
  if (exportRange) {
    exportRange.querySelectorAll('.trn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        exportRange.querySelectorAll('.trn-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.exportRange = btn.dataset.exportRange;
      });
    });
  }

  // Map layer controls
  const mapControls = document.querySelectorAll('.map-layer-btn');
  mapControls.forEach(btn => {
    btn.addEventListener('click', () => {
      mapControls.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mapLayer = btn.dataset.layer;
    });
  });

  // Demo banner close
  const demoBannerClose = $('demo-banner-close');
  if (demoBannerClose) demoBannerClose.addEventListener('click', () => {
    toggleDemoMode(false);
    const demoToggle = $('demo-toggle');
    if (demoToggle) demoToggle.checked = false;
  });
}

function closeSidebarOnMobile() {
  const sidebar = $('sidebar');
  const overlay = $('sidebar-overlay');
  const toggle = $('sidebar-toggle');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

// ── Data loading ───────────────────────────────────────────
async function loadIoTData() {
  try {
    const data = await API.getIoTData();
    state.iotData = data;
    state.lastUpdatedAt = new Date();
    renderCurrentWeather(data);
    renderSensorGrid(data);
    renderRecommendations(data);
    renderSafetyAlerts(data);
    renderWeatherScore(data);
    renderActivityScores(data);
    renderSunriseSunset(data);
    return data;
  } catch {
    renderCurrentWeatherError();
  }
}

async function loadAIPrediction() {
  try {
    const data = await API.getAIPrediction();
    state.aiPrediction = data;
    renderAIPredictionCard(data);
    renderHourlyForecast(data);
    renderSevenDayForecast(data);
    renderWeatherTimeline(data);
    renderMainTempChart(data);
    if (data.tomorrow) {
      updateTomorrowCard(data.tomorrow);
    } else if (data.daily && data.daily.length > 1) {
      updateTomorrowCard(data.daily[1]);
    }
    return data;
  } catch {
    renderAIError();
  }
}

// ── Initialise ─────────────────────────────────────────────
async function init() {
  // Apply saved theme immediately
  applyTheme(state.theme);

  // Preload weather card assets for seamless transitions
  preloadCardImages();

  // Load saved locations
  loadSavedLocations();

  // Setup PWA
  setupPWA();

  // Setup Notifications
  setupNotifications();

  // Setup AI Assistant
  setupAssistant();

  // Setup Export
  setupExport();

  // Fetch data in parallel
  await Promise.all([
    loadIoTData(),
    loadAIPrediction(),
  ]);

  state.isLoading = false;

  // Start background polling
  setupPolling();

  // Wire up all event listeners
  setupEventListeners();

  // Re-render Lucide icons after all dynamic content
  if (window.lucide) refreshIcons();
}

// ── Boot ───────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
window.runTemporaryPrediction = function() {
  if (!state.iotData || !state.iotData.current) return;
  const current = state.iotData.current;
  
  // Create an overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); animation: fadeIn 0.3s ease;';
  
  // Logic
  let predTitle = "Weather Stable";
  let predDesc = "Based on the last IoT readings, conditions remain stable for the next hour.";
  let color = "#10B981"; // Green
  
  if (current.pressure < 1010 && current.humidity > 70) {
    predTitle = "High Rain Probability";
    predDesc = "Pressure is dropping with high humidity. Expect rain shortly.";
    color = "#3B82F6";
  } else if (current.temperature > 30 && current.uvIndex > 6) {
    predTitle = "Intense Heat Warning";
    predDesc = "High temperature and UV detected. Stay hydrated.";
    color = "#EF4444";
  } else if (current.windSpeed > 15) {
    predTitle = "Breezy Conditions";
    predDesc = "Wind speed is elevated. It will remain breezy.";
    color = "#F59E0B";
  }
  
  overlay.innerHTML = `
    <div style="background: var(--surface); padding: 32px; border-radius: 24px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 2px solid ${color}44;">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: ${color}22; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 16px;">
        <i data-lucide="zap"></i>
      </div>
      <h3 style="color: var(--text-1); font-size: 1.5rem; margin-bottom: 8px;">${predTitle}</h3>
      <p style="color: var(--text-2); font-size: 0.95rem; line-height: 1.5; margin-bottom: 24px;">
        ${predDesc}
        <br><br>
        <small style="color: var(--text-3); display: block;">Generated live from IoT Sensor: T:${current.temperature}°C, H:${current.humidity}%, P:${current.pressure}hPa</small>
      </p>
      <div style="display: flex; gap: 8px; justify-content: center;">
        <span class="badge badge-iot" style="font-size: 0.7rem; background: rgba(144, 202, 249, 0.15); color: #90CAF9;">⚡ LIVE IoT DATA</span>
        <span class="badge badge-ai" style="font-size: 0.7rem; background: rgba(16, 185, 129, 0.15); color: #10B981;">✨ AI ANALYSIS</span>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons({root: overlay});
  
  // Close after 5 seconds
  setTimeout(() => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => overlay.remove(), 300);
  }, 5000);
  
  overlay.onclick = () => overlay.remove();
};

window.showCelestialDetails = function() {
  const headerHtml = `
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:40px;height:40px;border-radius:12px;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;">
        <i data-lucide="globe" style="width:24px;height:24px;"></i>
      </div>
      <div>
        <h2 style="font-size:1.1rem;font-weight:600;margin:0;color:var(--text-1);">Celestial Details</h2>
        <div style="font-size:0.8rem;color:var(--text-3);">Extended Sun & Moon Data</div>
      </div>
    </div>
`;

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:24px;padding-top:10px;">
      <!-- Sun Section -->
      <div style="background:var(--surface-2);border-radius:16px;padding:16px;border:1px solid rgba(255,167,38,0.2);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;color:#FFA726;font-weight:600;">
          <i data-lucide="sun"></i> Solar Tracking
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div style="font-size:0.75rem;color:var(--text-3);">Sunrise</div>
            <div style="font-weight:600;color:var(--text-1);font-size:1.1rem;">06:24 AM</div>
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-3);">Sunset</div>
            <div style="font-weight:600;color:var(--text-1);font-size:1.1rem;">18:42 PM</div>
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-3);">Solar Noon</div>
            <div style="font-weight:600;color:var(--text-1);font-size:1.1rem;">12:33 PM</div>
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-3);">Day Length</div>
            <div style="font-weight:600;color:var(--text-1);font-size:1.1rem;">12h 18m</div>
          </div>
        </div>
      </div>

      <!-- Moon Section -->
      <div style="background:var(--surface-2);border-radius:16px;padding:16px;border:1px solid rgba(144,202,249,0.2);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;color:#90CAF9;font-weight:600;">
          <i data-lucide="moon"></i> Lunar Tracking
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div style="font-size:0.75rem;color:var(--text-3);">Moon Phase</div>
            <div style="font-weight:600;color:var(--text-1);font-size:1.1rem;">Waxing Gibbous</div>
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-3);">Illumination</div>
            <div style="font-weight:600;color:var(--text-1);font-size:1.1rem;">78%</div>
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-3);">Moonrise</div>
            <div style="font-weight:600;color:var(--text-1);font-size:1.1rem;">14:15 PM</div>
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-3);">Moonset</div>
            <div style="font-weight:600;color:var(--text-1);font-size:1.1rem;">02:30 AM</div>
          </div>
        </div>
      </div>
    </div>
`;

  document.getElementById('modal-header').innerHTML = headerHtml;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (window.lucide) refreshIcons();
};

function updateWeatherCardAnimation(condition) {
  const card = document.getElementById('current-weather-card');
  if (card) {
    card.classList.remove('bg-sunset', 'bg-sky', 'bg-rain', 'bg-clear', 'bg-clouds', 'bg-fog');
    const cond = (condition || '').toLowerCase();
    if (cond.includes('sun') || cond.includes('clear') || cond === 'partly_cloudy') {
      card.classList.add('bg-clear');
    } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('thunder') || cond.includes('shower')) {
      card.classList.add('bg-rain');
    } else if (cond.includes('fog') || cond.includes('mist')) {
      card.classList.add('bg-fog');
    } else {
      card.classList.add('bg-clouds');
    }
  }
}


// ── Optimized Weather Card Background & Animation Engine ───────────────────
const cardImageCache = new Map();

function preloadCardImages() {
  const images = [
    'images/Tommorow prediction/cloudy.png',
    'images/Tommorow prediction/sunnny.png',
    'images/Tommorow prediction/Rainy.png',
    'images/Tommorow prediction/Foggy.png',
    'images/Tommorow prediction/Stromy.png',
    'images/Tommorow prediction/Snnoye.png',
    'images/Tommorow prediction/Windy.png',
    'images/Aqi Condition/Under 50 aqi.png',
    'images/Aqi Condition/between 50-100 aqi.png',
    'images/Aqi Condition/Between 100-150 aqi.png',
    'images/Aqi Condition/Between 150-200 aqi.png',
    'images/Aqi Condition/Between 200-300 Aqi.png',
    'images/Aqi Condition/300+Aqi.png'
  ];
  images.forEach(src => {
    const img = new Image();
    img.src = src;
    cardImageCache.set(src, img);
  });
}

function loadCardBackgroundImage(card, imageUrl) {
  if (!card) return;
  const cached = cardImageCache.get(imageUrl);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    card.style.backgroundImage = `url('${imageUrl}')`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
    card.classList.remove('skeleton');
    return;
  }

  card.classList.add('skeleton');
  const img = new Image();
  img.onload = () => {
    cardImageCache.set(imageUrl, img);
    card.style.backgroundImage = `url('${imageUrl}')`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
    card.classList.remove('skeleton');
  };
  img.onerror = () => {
    card.classList.remove('skeleton');
  };
  img.src = imageUrl;
}

function updateWeatherCardAnimation(condition) {
  const card = document.getElementById('current-weather-card');
  if (card) {
    card.classList.remove('bg-sunset', 'bg-sky', 'bg-rain', 'bg-clear', 'bg-clouds', 'bg-fog');
    const cond = (condition || '').toLowerCase();
    
    let img = 'cloudy.png';
    if (cond.includes('sun') || cond.includes('clear') || cond === 'partly_cloudy') img = 'sunnny.png';
    else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('thunder') || cond.includes('shower')) img = 'Rainy.png';
    else if (cond.includes('fog') || cond.includes('mist')) img = 'Foggy.png';
    else if (cond.includes('storm')) img = 'Stromy.png';
    else if (cond.includes('snow')) img = 'Snnoye.png';
    else if (cond.includes('wind')) img = 'Windy.png';

    loadCardBackgroundImage(card, `images/Tommorow prediction/${img}`);
  }
}

function updateAqiCardImage(aqi) {
  const card = document.getElementById('aqi-card');
  if (card) {
    let img = 'Under 50 aqi.png';
    if (aqi > 300) img = '300+Aqi.png';
    else if (aqi >= 200) img = 'Between 200-300 Aqi.png';
    else if (aqi >= 150) img = 'Between 150-200 aqi.png';
    else if (aqi >= 100) img = 'Between 100-150 aqi.png';
    else if (aqi >= 50) img = 'between 50-100 aqi.png';

    loadCardBackgroundImage(card, `images/Aqi Condition/${img}`);
  }
}

function updateTomorrowCard(forecastItem) {
  const card = document.getElementById('tomorrow-card');
  if (card && forecastItem) {
    card.classList.remove('bg-sunset', 'bg-sky', 'bg-rain', 'bg-clear', 'bg-clouds', 'bg-fog');
    const cond = (forecastItem.condition || '').toLowerCase();
    
    let img = 'cloudy.png';
    if (cond.includes('sun') || cond.includes('clear') || cond === 'partly_cloudy') img = 'sunnny.png';
    else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('thunder') || cond.includes('shower')) img = 'Rainy.png';
    else if (cond.includes('fog') || cond.includes('mist')) img = 'Foggy.png';
    else if (cond.includes('storm')) img = 'Stromy.png';
    else if (cond.includes('snow')) img = 'Snnoye.png';
    else if (cond.includes('wind')) img = 'Windy.png';

    loadCardBackgroundImage(card, `images/Tommorow prediction/${img}`);
    
    const tempEl = card.querySelector('.wh-temp');
    const tempVal = forecastItem.tempHigh != null ? forecastItem.tempHigh : (forecastItem.high != null ? forecastItem.high : forecastItem.temperature);
    if (tempEl && tempVal != null) tempEl.textContent = `${Math.round(tempVal)}°C`;
    const condEl = card.querySelector('.wh-condition');
    if (condEl && forecastItem.condition) condEl.textContent = forecastItem.condition;
  }
}

// Chart Resize Observer for responsive recalculation
if (typeof window !== 'undefined' && window.ResizeObserver) {
  const chartWrapper = document.getElementById('main-temp-chart-container');
  if (chartWrapper) {
    let rzTimer;
    new ResizeObserver(() => {
      clearTimeout(rzTimer);
      rzTimer = setTimeout(() => {
        if (state.aiPrediction) renderMainTempChart(state.aiPrediction);
      }, 150);
    }).observe(chartWrapper);
  }
}
