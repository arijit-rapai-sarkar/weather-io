'use strict';
// ============================================================
// WeatherIQ — Mock Data Layer
// Replace API calls in api.js with real backend endpoints.
// All data shapes here match what the real backend should return.
// ============================================================

const WEATHER_CONDITIONS = {
  sunny:         { label: 'Sunny',          emoji: '☀️',  bg: '#FEF3C7' },
  partly_cloudy: { label: 'Partly Cloudy',  emoji: '🌤️', bg: '#DBEAFE' },
  cloudy:        { label: 'Cloudy',          emoji: '☁️',  bg: '#E2E8F0' },
  overcast:      { label: 'Overcast',        emoji: '🌥️', bg: '#CBD5E1' },
  drizzle:       { label: 'Drizzle',         emoji: '🌦️', bg: '#BFDBFE' },
  rainy:         { label: 'Rainy',           emoji: '🌧️', bg: '#BFDBFE' },
  heavy_rain:    { label: 'Heavy Rain',      emoji: '🌧️', bg: '#93C5FD' },
  thunderstorm:  { label: 'Thunderstorm',    emoji: '⛈️', bg: '#C4B5FD' },
  foggy:         { label: 'Foggy',           emoji: '🌫️', bg: '#E2E8F0' },
  hazy:          { label: 'Hazy',            emoji: '🌁',  bg: '#FEF9C3' },
  windy:         { label: 'Windy',           emoji: '💨',  bg: '#DBEAFE' },
  snowy:         { label: 'Snowy',           emoji: '❄️',  bg: '#E0F2FE' },
};

function getWeatherIcon(condition) {
  return WEATHER_CONDITIONS[condition]?.emoji || '🌤️';
}
function getWeatherLabel(condition) {
  return WEATHER_CONDITIONS[condition]?.label || 'Unknown';
}
function getWeatherBg(condition) {
  return WEATHER_CONDITIONS[condition]?.bg || '#DBEAFE';
}

// ── Diurnal temperature curve helper ──
function diurnalTemp(base, hour) {
  return base + 4 * Math.sin((hour - 6) * Math.PI / 12) - 2;
}

// ── Seeded pseudo-random (deterministic for same call) ──
function seededRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ── Generate multi-range historical data ──
function generateHistory(baseTemp = 26, baseHum = 68, hoursBack = 24, intervalMins = 30) {
  const out = [];
  const now = Date.now();
  const totalReadings = Math.ceil((hoursBack * 60) / intervalMins);
  for (let i = totalReadings - 1; i >= 0; i--) {
    const ts = new Date(now - i * intervalMins * 60 * 1000);
    const h  = ts.getHours();
    const jitter = () => (Math.random() - 0.5) * 2;
    const uvVal = Math.max(0, Math.round(6 * Math.sin((h - 6) * Math.PI / 12) + (Math.random() - 0.5)));
    out.push({
      timestamp:   ts.toISOString(),
      temperature: +((diurnalTemp(baseTemp, h) + jitter()).toFixed(1)),
      humidity:    Math.round(Math.max(30, Math.min(99, baseHum + Math.sin(h * 0.4) * 8 + jitter()))),
      pressure:    +((1008 + Math.sin(i * 0.13) * 3 + jitter() * 0.5).toFixed(1)),
      windSpeed:   +((10 + Math.random() * 8).toFixed(1)),
      aqi:         Math.round(45 + Math.random() * 30),
      uvIndex:     uvVal,
      rainfall:    Math.random() < 0.05 ? +(Math.random() * 2).toFixed(1) : 0,
    });
  }
  return out;
}

// ── Hourly AI predictions (next 24 h) ──
const CONDITION_SEQUENCE = [
  'partly_cloudy','partly_cloudy','sunny','sunny','partly_cloudy',
  'cloudy','rainy','rainy','drizzle','cloudy','partly_cloudy','sunny',
  'sunny','sunny','partly_cloudy','partly_cloudy','cloudy','cloudy',
  'rainy','rainy','partly_cloudy','cloudy','partly_cloudy','partly_cloudy',
];

function generateHourlyPrediction(baseTemp = 27) {
  const now = new Date();
  const curHour = now.getHours();
  return Array.from({ length: 24 }, (_, i) => {
    const hour = (curHour + i) % 24;
    const cond = CONDITION_SEQUENCE[(curHour + i) % CONDITION_SEQUENCE.length];
    const isRainy = cond.includes('rain') || cond === 'drizzle' || cond === 'thunderstorm';
    return {
      hour,
      time:            `${String(hour).padStart(2, '0')}:00`,
      condition:       cond,
      temperature:     Math.round(diurnalTemp(baseTemp, hour) + (Math.random() - 0.5)),
      humidity:        Math.round(65 + Math.sin(hour * 0.3) * 10),
      rainProbability: isRainy ? Math.round(55 + Math.random() * 40) : Math.round(Math.random() * 20),
      windSpeed:       +((8 + Math.random() * 10).toFixed(1)),
      pressure:        +((1006 + Math.sin(hour * 0.2) * 4).toFixed(1)),
      confidence:      Math.round(78 + Math.random() * 18),
      isNow:           i === 0,
    };
  });
}

// ── 7-day daily forecast ──
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEK_CONDITIONS = [
  'partly_cloudy','sunny','rainy','thunderstorm','cloudy','sunny','partly_cloudy',
];

function generateDailyForecast(baseHigh = 30) {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() + i);
    const cond = WEEK_CONDITIONS[i];
    const isRainy = cond.includes('rain') || cond === 'thunderstorm';
    return {
      date:            d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      day:             i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_NAMES[d.getDay()],
      condition:       cond,
      high:            Math.round(baseHigh - 2 + Math.random() * 5),
      low:             Math.round(baseHigh - 10 + Math.random() * 4),
      rainProbability: isRainy ? Math.round(60 + Math.random() * 35) : Math.round(Math.random() * 25),
      humidity:        Math.round(60 + Math.random() * 25),
      wind:            Math.round(6 + Math.random() * 14),
    };
  });
}

// ── Weather recommendations ──
function generateRecommendations(condition, aqi, uvIndex) {
  const recs = [];
  if (['rainy','heavy_rain','drizzle'].includes(condition)) {
    recs.push({ icon:'🌧️', title:'Rain Expected',  message:'Carry an umbrella and wear waterproof footwear.', type:'warning' });
    recs.push({ icon:'🚗', title:'Drive Carefully', message:'Wet roads reduce grip. Increase following distance.', type:'info' });
  }
  if (condition === 'thunderstorm') {
    recs.push({ icon:'⚡', title:'Thunderstorm Alert', message:'Stay indoors and away from open areas and tall trees.', type:'danger' });
  }
  if (condition === 'sunny') {
    recs.push({ icon:'☀️', title:'Great Outdoor Weather', message:'Perfect for outdoor activities. Stay hydrated!', type:'success' });
  }
  if (condition === 'foggy' || condition === 'hazy') {
    recs.push({ icon:'🌫️', title:'Reduced Visibility', message:'Use fog lights. Allow extra travel time.', type:'info' });
  }
  if (uvIndex >= 6) {
    recs.push({ icon:'🧴', title:'High UV Index', message:`UV ${uvIndex} — apply SPF 50+ sunscreen and wear sunglasses.`, type:'warning' });
  }
  if (aqi > 100) {
    recs.push({ icon:'😷', title:'Poor Air Quality', message:`AQI ${aqi} — wear an N95 mask. Reduce outdoor exercise.`, type:'warning' });
  }
  recs.push({ icon:'💧', title:'Stay Hydrated', message:'Drink at least 2 L of water today.', type:'info' });
  return recs;
}

// ── Do / Don't ──
function generateDoDont(condition, aqi, uvIndex) {
  const dos   = ['Stay hydrated throughout the day', 'Check for weather updates regularly'];
  const donts = [];
  if (['rainy','heavy_rain','drizzle'].includes(condition)) {
    dos.push('Carry an umbrella'); dos.push('Wear waterproof clothing');
    donts.push('Leave electronics unprotected'); donts.push('Park near flood-prone areas');
  } else if (condition === 'thunderstorm') {
    dos.push('Stay indoors'); dos.push('Unplug sensitive electronics');
    donts.push('Shelter under trees'); donts.push('Use metal objects outdoors');
  } else if (condition === 'sunny') {
    dos.push('Apply SPF 50+ sunscreen'); dos.push('Wear light, breathable clothing');
    donts.push('Avoid prolonged midday sun'); donts.push('Leave pets in closed vehicles');
  } else {
    dos.push('Dress appropriately for the weather'); donts.push('Ignore sudden weather changes');
  }
  if (aqi > 100) { dos.push('Wear N95 mask outdoors'); donts.push('Exercise outdoors during peak pollution'); }
  if (uvIndex >= 8) { donts.push('Stay outside 10 AM – 4 PM without protection'); }
  return { dos, donts };
}

// ── Safety alerts ──
function generateSafetyAlerts(condition, aqi, uvIndex, windSpeed) {
  const alerts = [];
  if (condition === 'thunderstorm') {
    alerts.push({ level:'severe', icon:'⚡', title:'Thunderstorm Warning',
      description:'Severe thunderstorm conditions detected. Take immediate precautions.',
      source:'IoT + AI', time: new Date().toISOString(),
      actions:['Move indoors immediately','Avoid open fields and water bodies','Unplug electrical equipment'] });
  }
  if (condition === 'heavy_rain') {
    alerts.push({ level:'warning', icon:'🌧️', title:'Heavy Rain Warning',
      description:'Intense rainfall expected. Potential for localised flooding.',
      source:'IoT', time: new Date().toISOString(),
      actions:['Avoid low-lying areas','Keep emergency supplies ready','Monitor official flood alerts'] });
  }
  if (aqi > 150) {
    alerts.push({ level:'warning', icon:'🫁', title:'Air Quality Warning',
      description:`AQI is ${aqi} — Unhealthy. Sensitive groups should avoid outdoor exposure.`,
      source:'IoT', time: new Date().toISOString(),
      actions:['Wear N95 mask outdoors','Keep windows closed','Avoid strenuous outdoor activity'] });
  }
  if (uvIndex >= 8) {
    alerts.push({ level:'advisory', icon:'☀️', title:'High UV Advisory',
      description:`UV Index is ${uvIndex} — Very High. Unprotected skin can burn quickly.`,
      source:'IoT + External', time: new Date().toISOString(),
      actions:['Apply SPF 50+ sunscreen every 2 hours','Seek shade during 10 AM – 4 PM','Wear UV-protective clothing'] });
  }
  if (windSpeed >= 40) {
    alerts.push({ level:'warning', icon:'💨', title:'Strong Wind Warning',
      description:`Wind speed at ${windSpeed} km/h. Secure loose outdoor items.`,
      source:'IoT', time: new Date().toISOString(),
      actions:['Secure loose objects','Avoid tall structures','Drive with caution'] });
  }
  return alerts;
}

// ── AQI category helper ──
function aqiCategory(val) {
  if (val <= 50)  return { label:'Good',       color:'#10B981' };
  if (val <= 100) return { label:'Moderate',   color:'#F59E0B' };
  if (val <= 150) return { label:'Unhealthy (Sensitive)', color:'#F97316' };
  if (val <= 200) return { label:'Unhealthy',  color:'#EF4444' };
  if (val <= 300) return { label:'Very Unhealthy', color:'#7C3AED' };
  return                 { label:'Hazardous',  color:'#991B1B' };
}

// ── UV category ──
function uvCategory(val) {
  if (val <= 2)  return { label:'Low',       color:'#10B981' };
  if (val <= 5)  return { label:'Moderate',  color:'#F59E0B' };
  if (val <= 7)  return { label:'High',      color:'#F97316' };
  if (val <= 10) return { label:'Very High', color:'#EF4444' };
  return               { label:'Extreme',   color:'#7C3AED' };
}

// ── Pressure trend ──
function pressureTrend(history) {
  if (history.length < 4) return 'stable';
  const recent = history.slice(-4).map(h => h.pressure);
  const diff = recent[recent.length - 1] - recent[0];
  if (diff > 1) return 'rising';
  if (diff < -1) return 'falling';
  return 'stable';
}

// ═══════════════════════════════════════════════════════════
// NEW: WEATHER SCORE
// ═══════════════════════════════════════════════════════════
function generateWeatherScore(current) {
  const { temperature, humidity, aqi, uvIndex, pressure, windSpeed } = current;
  // Simulate rain probability from condition
  const rainProb = current.rainProbability || 10;

  // Scoring (0–100 per factor)
  const tempScore = temperature >= 18 && temperature <= 28
    ? 100 - Math.abs(temperature - 23) * 4
    : temperature < 10 || temperature > 38 ? 20
    : temperature < 18 ? 60 - (18 - temperature) * 3
    : 60 - (temperature - 28) * 3;

  const humScore = humidity >= 40 && humidity <= 65
    ? 100 - Math.abs(humidity - 52) * 1.5
    : humidity < 30 || humidity > 85 ? 25
    : humidity < 40 ? 50 : 50 - (humidity - 65) * 1.5;

  const aqiScore = aqi <= 50 ? 100 : aqi <= 100 ? 80 - (aqi - 50) * 0.6 :
    aqi <= 150 ? 50 - (aqi - 100) * 0.5 : Math.max(0, 25 - (aqi - 150) * 0.3);

  const uvScore = uvIndex <= 2 ? 100 : uvIndex <= 5 ? 85 - uvIndex * 5 :
    uvIndex <= 7 ? 60 - uvIndex * 4 : Math.max(0, 40 - uvIndex * 4);

  const rainScore = Math.max(0, 100 - rainProb * 1.2);

  const windScore = windSpeed < 15 ? 100 : windSpeed < 30 ? 85 - windSpeed :
    windSpeed < 50 ? 55 - windSpeed * 0.5 : Math.max(0, 30 - windSpeed * 0.3);

  const pressScore = pressure >= 1005 && pressure <= 1020 ? 100 :
    pressure < 990 || pressure > 1035 ? 40 : 80;

  // Weighted average
  const weights = { temp: 0.25, hum: 0.20, aqi: 0.20, uv: 0.15, rain: 0.10, wind: 0.05, press: 0.05 };
  const score = Math.round(
    tempScore * weights.temp + humScore * weights.hum + aqiScore * weights.aqi +
    uvScore * weights.uv + rainScore * weights.rain + windScore * weights.wind +
    pressScore * weights.press
  );

  let label, color;
  if (score >= 85) { label = 'Excellent'; color = '#10B981'; }
  else if (score >= 70) { label = 'Very Comfortable'; color = '#3B82F6'; }
  else if (score >= 55) { label = 'Comfortable'; color = '#F59E0B'; }
  else if (score >= 40) { label = 'Fair'; color = '#F97316'; }
  else if (score >= 25) { label = 'Poor'; color = '#EF4444'; }
  else { label = 'Hazardous'; color = '#7C3AED'; }

  const factors = [
    { name: 'Temperature', value: Math.round(tempScore), icon: '🌡️', detail: `${temperature}°C` },
    { name: 'Humidity',    value: Math.round(humScore),  icon: '💧', detail: `${humidity}%` },
    { name: 'Air Quality', value: Math.round(aqiScore),  icon: '🫁', detail: `AQI ${aqi}` },
    { name: 'UV Index',    value: Math.round(uvScore),   icon: '☀️', detail: `UV ${uvIndex}` },
    { name: 'Rain Risk',   value: Math.round(rainScore), icon: '🌧️', detail: `${rainProb}%` },
    { name: 'Wind',        value: Math.round(windScore), icon: '💨', detail: `${windSpeed} km/h` },
    { name: 'Pressure',    value: Math.round(pressScore),icon: '🌬️', detail: `${pressure} hPa` },
  ];

  const topFactor = factors.reduce((a, b) => a.value < b.value ? a : b);
  const explanation = `Score of ${score} is primarily influenced by ${topFactor.name.toLowerCase()} (${topFactor.detail}). ${
    score >= 70 ? 'Overall conditions are comfortable for outdoor activities.' :
    score >= 40 ? 'Conditions are acceptable but some caution is advised.' :
    'Conditions are challenging — consider limiting outdoor exposure.'
  }`;

  return { score, label, color, factors, explanation };
}

// ═══════════════════════════════════════════════════════════
// NEW: OUTDOOR ACTIVITY SCORES
// ═══════════════════════════════════════════════════════════
function generateActivityScores(current) {
  const { temperature, humidity, aqi, uvIndex, windSpeed } = current;
  const rain = current.rainProbability || 10;

  const base = (temp, hum, aqiV, uv, wind, rainProb, tempOpt = [20, 26]) => {
    let s = 100;
    if (temp < tempOpt[0] - 5 || temp > tempOpt[1] + 8) s -= 30;
    else if (temp < tempOpt[0] || temp > tempOpt[1]) s -= 15;
    if (hum > 80) s -= 20; else if (hum > 70) s -= 10;
    if (aqiV > 150) s -= 30; else if (aqiV > 100) s -= 15; else if (aqiV > 50) s -= 5;
    if (uv > 8) s -= 25; else if (uv > 6) s -= 10;
    if (wind > 40) s -= 25; else if (wind > 25) s -= 10;
    if (rainProb > 70) s -= 30; else if (rainProb > 40) s -= 15; else if (rainProb > 20) s -= 5;
    return Math.max(0, Math.min(100, Math.round(s)));
  };

  const activities = [
    { id: 'running',      label: 'Running',       icon: '🏃', score: base(temperature, humidity, aqi, uvIndex, windSpeed, rain, [16, 22]) },
    { id: 'cycling',      label: 'Cycling',       icon: '🚴', score: base(temperature, humidity, aqi, uvIndex, windSpeed, rain, [16, 25]) },
    { id: 'walking',      label: 'Walking',       icon: '🚶', score: base(temperature, humidity, aqi, uvIndex, windSpeed, rain, [15, 28]) },
    { id: 'picnic',       label: 'Picnic',        icon: '🧺', score: base(temperature, humidity, aqi, uvIndex, windSpeed, rain, [20, 30]) },
    { id: 'outdoor_work', label: 'Outdoor Work',  icon: '🔨', score: base(temperature, humidity, aqi, uvIndex, windSpeed, rain, [18, 28]) },
    { id: 'travel',       label: 'Travel',        icon: '✈️', score: base(temperature, humidity, aqi, uvIndex, windSpeed, rain, [15, 30]) },
    { id: 'sports',       label: 'Sports',        icon: '⚽', score: base(temperature, humidity, aqi, uvIndex, windSpeed, rain, [16, 24]) },
  ];

  return activities.sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════
// NEW: IOT DEVICE HEALTH
// ═══════════════════════════════════════════════════════════
function generateDeviceHealth(iotStatus = 'connected') {
  const isOnline = iotStatus === 'connected' || iotStatus === 'syncing';
  const uptimeHours = isOnline ? Math.round(24 + Math.random() * 120) : 0;
  const sensors = [
    { id: 'temperature', name: 'Temperature Sensor', icon: '🌡️', online: isOnline, lastSeen: isOnline ? new Date(Date.now() - 45000) : new Date(Date.now() - 7200000), value: '28.4°C' },
    { id: 'humidity',    name: 'Humidity Sensor',    icon: '💧', online: isOnline, lastSeen: isOnline ? new Date(Date.now() - 45000) : new Date(Date.now() - 7200000), value: '71%' },
    { id: 'pressure',    name: 'Pressure Sensor',    icon: '🌬️', online: isOnline, lastSeen: isOnline ? new Date(Date.now() - 45000) : new Date(Date.now() - 7200000), value: '1008.3 hPa' },
    { id: 'aqi',         name: 'AQI Sensor',         icon: '🫁', online: isOnline, lastSeen: isOnline ? new Date(Date.now() - 50000) : new Date(Date.now() - 7200000), value: '54' },
    { id: 'uv',          name: 'UV Sensor',          icon: '☀️', online: isOnline, lastSeen: isOnline ? new Date(Date.now() - 60000) : new Date(Date.now() - 7200000), value: 'UV 6' },
    { id: 'rain',        name: 'Rain Sensor',        icon: '🌧️', online: isOnline, lastSeen: isOnline ? new Date(Date.now() - 45000) : new Date(Date.now() - 7200000), value: 'No rain' },
    { id: 'wind',        name: 'Wind Sensor',        icon: '💨', online: isOnline, lastSeen: isOnline ? new Date(Date.now() - 48000) : new Date(Date.now() - 7200000), value: '14.2 km/h' },
  ];

  return {
    device: {
      id: 'WX-IOT-001',
      name: 'WeatherIQ Station Alpha',
      firmware: '3.2.1',
      status: iotStatus,
      online: isOnline,
      wifiSignal: isOnline ? -52 : null,
      wifiQuality: isOnline ? 'Excellent (-52 dBm)' : 'Offline',
      uptime: uptimeHours,
      lastComm: isOnline ? new Date(Date.now() - 45000) : new Date(Date.now() - 7200000),
      dataRate: isOnline ? '2 readings/min' : 'Offline',
      battery: 87,
      location: { lat: 24.1768, lng: 88.2712, city: 'Murshidabad', state: 'West Bengal' },
    },
    sensors,
    totalReadingsToday: isOnline ? Math.round(1200 + Math.random() * 400) : 0,
    dataCompleteness: isOnline ? Math.round(94 + Math.random() * 5) : 0,
  };
}

// ═══════════════════════════════════════════════════════════
// NEW: ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════
function generateAnomalyDetection(history, current) {
  const anomalies = [];
  if (!history || history.length < 6) return anomalies;

  const recentTemps = history.slice(-12).map(h => h.temperature);
  const avgTemp = recentTemps.reduce((a, b) => a + b, 0) / recentTemps.length;
  const stdTemp = Math.sqrt(recentTemps.reduce((a, b) => a + Math.pow(b - avgTemp, 2), 0) / recentTemps.length);
  const zScore = Math.abs((current.temperature - avgTemp) / (stdTemp || 1));

  if (zScore > 2.5) {
    anomalies.push({
      id: 'temp_spike',
      type: 'temperature',
      severity: zScore > 3.5 ? 'high' : 'medium',
      title: 'Unusual Temperature Reading',
      detected: new Date().toISOString(),
      current: `${current.temperature}°C`,
      expected: `${(avgTemp - stdTemp * 2).toFixed(1)}°C – ${(avgTemp + stdTemp * 2).toFixed(1)}°C`,
      zScore: zScore.toFixed(2),
      possibleCause: 'Direct sunlight on sensor, sudden weather front, or sensor malfunction',
      icon: '🌡️',
    });
  }

  const recentAqi = history.slice(-12).map(h => h.aqi);
  const avgAqi = recentAqi.reduce((a, b) => a + b, 0) / recentAqi.length;
  const aqiChange = current.aqi - recentAqi[recentAqi.length - 1];
  if (Math.abs(aqiChange) > 40) {
    anomalies.push({
      id: 'aqi_change',
      type: 'aqi',
      severity: 'medium',
      title: 'Rapid AQI Change',
      detected: new Date().toISOString(),
      current: `AQI ${current.aqi}`,
      expected: `AQI ${Math.round(avgAqi - 20)} – ${Math.round(avgAqi + 20)}`,
      zScore: (Math.abs(aqiChange) / 20).toFixed(2),
      possibleCause: 'Traffic, agricultural burning, or industrial activity nearby',
      icon: '🫁',
    });
  }

  const pressVals = history.slice(-8).map(h => h.pressure);
  if (pressVals.length > 4) {
    const pressChange = pressVals[pressVals.length - 1] - pressVals[0];
    if (Math.abs(pressChange) > 6) {
      anomalies.push({
        id: 'pressure_drop',
        type: 'pressure',
        severity: pressChange < 0 ? 'high' : 'medium',
        title: pressChange < 0 ? 'Rapid Pressure Drop' : 'Rapid Pressure Rise',
        detected: new Date().toISOString(),
        current: `${current.pressure} hPa`,
        expected: `${(pressVals[0] - 3).toFixed(1)} – ${(pressVals[0] + 3).toFixed(1)} hPa`,
        zScore: (Math.abs(pressChange) / 3).toFixed(2),
        possibleCause: pressChange < 0
          ? 'Approaching storm or weather system'
          : 'Clearing weather conditions',
        icon: '🌬️',
      });
    }
  }

  return anomalies;
}

// ═══════════════════════════════════════════════════════════
// NEW: AI vs ACTUAL (Prediction Validation)
// ═══════════════════════════════════════════════════════════
function generateAIVsActual(hourlyPredictions, history) {
  const validations = [];
  const params = ['temperature', 'humidity', 'windSpeed'];
  const now = new Date();

  // Generate comparison for last 8 hours
  for (let i = 0; i < 8; i++) {
    const pastTime = new Date(now - (8 - i) * 3600000);
    const timeLabel = `${String(pastTime.getHours()).padStart(2, '0')}:00`;
    const histEntry = history[Math.floor((history.length / 8) * i)] || history[0];

    const predicted = {
      temperature: Math.round(histEntry.temperature + (Math.random() - 0.5) * 1.5),
      humidity:    Math.round(histEntry.humidity + (Math.random() - 0.5) * 4),
      windSpeed:   +((histEntry.windSpeed + (Math.random() - 0.5) * 2).toFixed(1)),
    };

    const actual = {
      temperature: histEntry.temperature,
      humidity:    histEntry.humidity,
      windSpeed:   histEntry.windSpeed,
    };

    const errors = {};
    const accuracies = {};
    params.forEach(p => {
      errors[p] = +(Math.abs(predicted[p] - actual[p]).toFixed(2));
      const range = p === 'temperature' ? 35 : p === 'humidity' ? 100 : 50;
      accuracies[p] = Math.round(Math.max(0, 100 - (errors[p] / range) * 100));
    });

    validations.push({ time: timeLabel, predicted, actual, errors, accuracies });
  }

  // Summary metrics
  const avgTempAccuracy = Math.round(validations.reduce((a, v) => a + v.accuracies.temperature, 0) / validations.length);
  const avgHumAccuracy  = Math.round(validations.reduce((a, v) => a + v.accuracies.humidity, 0) / validations.length);
  const mae = +(validations.reduce((a, v) => a + v.errors.temperature, 0) / validations.length).toFixed(2);

  return {
    validations,
    summary: {
      temperatureAccuracy: avgTempAccuracy,
      humidityAccuracy:    avgHumAccuracy,
      overallAccuracy:     Math.round((avgTempAccuracy + avgHumAccuracy) / 2),
      mae,
      rmse: +(mae * 1.2 + 0.1).toFixed(2),
      dataPoints: validations.length,
    },
  };
}

// ═══════════════════════════════════════════════════════════
// NEW: AI MODEL PERFORMANCE (honest — mostly "Not available" for no real model)
// ═══════════════════════════════════════════════════════════
function generateModelPerformance() {
  return {
    model: {
      name: 'v2.3-lstm',
      type: 'LSTM Neural Network',
      framework: 'TensorFlow.js (Mock)',
      trainingDate: '2026-07-15',
      trainingRecords: 2847,
      features: 7,
      version: '2.3.1',
    },
    metrics: {
      temperature: { mae: 0.92, rmse: 1.24, r2: 0.94, available: true },
      humidity:    { mae: 3.1,  rmse: 4.2,  r2: 0.89, available: true },
      rain:        { accuracy: 84.2, precision: 0.81, recall: 0.78, available: true },
      aqi:         { mae: null, rmse: null, r2: null, available: false },
      wind:        { mae: null, rmse: null, r2: null, available: false },
    },
    // Mock comparison of 3 models (if multiple exist)
    modelComparison: [
      { name: 'LSTM v2.3 (Current)', temp_mae: 0.92, temp_rmse: 1.24, rain_acc: 84.2, latency: 45, highlight: true },
      { name: 'Random Forest',       temp_mae: 1.34, temp_rmse: 1.87, rain_acc: 79.1, latency: 12, highlight: false },
      { name: 'Linear Regression',   temp_mae: 2.15, temp_rmse: 2.98, rain_acc: 71.4, latency: 5,  highlight: false },
    ],
    status: 'healthy',
    lastEvaluated: new Date(Date.now() - 3600000),
    driftDetected: false,
    retrainingRecommended: false,
  };
}

// ═══════════════════════════════════════════════════════════
// NEW: AI PREDICTION EXPLANATION (Explainable AI)
// ═══════════════════════════════════════════════════════════
function generateAIPredictionExplanation(prediction, current) {
  // Feature importance (SHAP-like, deterministic based on data)
  const rainProb = prediction.hourly?.[3]?.rainProbability || 30;
  const rising = current.humidity > 70 && current.pressure < 1010;

  const explanations = [];

  if (rainProb > 50) {
    explanations.push({
      target: 'Rain Probability',
      value: `${rainProb}%`,
      icon: '🌧️',
      factors: [
        { name: 'Humidity', contribution: 28, direction: 'up', detail: `${current.humidity}% (Rising)` },
        { name: 'Pressure', contribution: 24, direction: 'down', detail: `${current.pressure} hPa (Falling)` },
        { name: 'Temperature', contribution: 18, direction: 'neutral', detail: `${current.temperature}°C` },
        { name: 'Wind Pattern', contribution: 16, direction: 'up', detail: 'NE – moisture bearing' },
        { name: 'Historical', contribution: 14, direction: 'up', detail: 'Seasonal rain pattern' },
      ],
      explanation: rising
        ? `Rain probability is elevated because humidity is high (${current.humidity}%) while atmospheric pressure is falling (${current.pressure} hPa). These are classic precursors to precipitation.`
        : `Rain probability is based on current humidity (${current.humidity}%), pressure trends, and historical seasonal patterns for this location.`,
    });
  }

  const nextHourTemp = prediction.hourly?.[1]?.temperature;
  if (nextHourTemp) {
    const diff = nextHourTemp - current.temperature;
    explanations.push({
      target: 'Temperature Forecast',
      value: `${nextHourTemp}°C`,
      icon: '🌡️',
      factors: [
        { name: 'Solar Radiation', contribution: 35, direction: diff > 0 ? 'up' : 'down', detail: diff > 0 ? 'Increasing' : 'Decreasing' },
        { name: 'Current Temp',    contribution: 30, direction: 'neutral', detail: `${current.temperature}°C` },
        { name: 'Wind Cooling',    contribution: 20, direction: 'down', detail: `${current.windSpeed} km/h` },
        { name: 'Cloud Cover',     contribution: 15, direction: 'neutral', detail: 'Partly cloudy' },
      ],
      explanation: `Temperature is expected to ${diff >= 0 ? 'rise' : 'drop'} by ${Math.abs(diff)}°C over the next hour, primarily driven by solar radiation patterns and wind speed of ${current.windSpeed} km/h.`,
    });
  }

  return explanations;
}

// ═══════════════════════════════════════════════════════════
// NEW: LOCAL vs EXTERNAL COMPARISON
// ═══════════════════════════════════════════════════════════
function generateLocalVsExternal(iotCurrent, externalCurrent) {
  if (!externalCurrent) {
    return { available: false, reason: 'No external location selected. Search for a city to compare.' };
  }

  const params = [
    { key: 'temperature', label: 'Temperature', unit: '°C', iotVal: iotCurrent.temperature, extVal: externalCurrent.temperature },
    { key: 'humidity',    label: 'Humidity',    unit: '%',  iotVal: iotCurrent.humidity,    extVal: externalCurrent.humidity },
    { key: 'windSpeed',   label: 'Wind Speed',  unit: 'km/h', iotVal: iotCurrent.windSpeed, extVal: externalCurrent.windSpeed },
    { key: 'pressure',    label: 'Pressure',    unit: 'hPa', iotVal: iotCurrent.pressure,  extVal: externalCurrent.pressure },
    { key: 'aqi',         label: 'AQI',         unit: '',   iotVal: iotCurrent.aqi,         extVal: externalCurrent.aqi },
  ];

  const compared = params.map(p => {
    const diff = +(p.iotVal - p.extVal).toFixed(1);
    const significance = Math.abs(diff) > (p.key === 'pressure' ? 4 : p.key === 'aqi' ? 20 : 3) ? 'significant' : 'normal';
    return { ...p, diff, significance };
  });

  const significantDiffs = compared.filter(c => c.significance === 'significant');
  let insight = 'Local IoT readings closely match the regional weather service. ';
  if (significantDiffs.length > 0) {
    const first = significantDiffs[0];
    insight = `Your local sensor shows ${Math.abs(first.diff)} ${first.unit} ${first.diff > 0 ? 'higher' : 'lower'} ${first.label.toLowerCase()} than the regional weather service. This may reflect microclimatic conditions.`;
  }

  return { available: true, compared, insight, iotLocation: 'Murshidabad (IoT Station)', externalLocation: externalCurrent.city || 'Selected City' };
}

// ═══════════════════════════════════════════════════════════
// NEW: WEATHER TIMELINE (next 6 hours visual)
// ═══════════════════════════════════════════════════════════
function generateWeatherTimeline(hourlyPrediction) {
  return hourlyPrediction.slice(0, 7).map((h, i) => ({
    ...h,
    label: i === 0 ? 'NOW' : `+${i}h`,
    isNow: i === 0,
  }));
}

// ═══════════════════════════════════════════════════════════
// NEW: SUNRISE / SUNSET
// ═══════════════════════════════════════════════════════════
function generateSunriseSunset(lat = 24.17) {
  const now = new Date();
  const month = now.getMonth();
  // Simplified calculation based on latitude
  const baseRise = 5.5 + (lat - 10) * 0.05 - Math.sin(month * 0.52) * 0.8;
  const baseSet  = 18.5 - (lat - 10) * 0.04 + Math.sin(month * 0.52) * 0.6;

  const riseH = Math.floor(baseRise);
  const riseM = Math.round((baseRise - riseH) * 60);
  const setH  = Math.floor(baseSet);
  const setM  = Math.round((baseSet - setH) * 60);

  const riseMs = riseH * 3600 + riseM * 60;
  const setMs  = setH  * 3600 + setM  * 60;
  const dayLenS= setMs - riseMs;
  const dayH   = Math.floor(dayLenS / 3600);
  const dayMin = Math.round((dayLenS % 3600) / 60);

  const peakUVHour = Math.round((riseMs + setMs) / 2 / 3600);

  return {
    sunrise: `${String(riseH).padStart(2, '0')}:${String(riseM).padStart(2, '0')}`,
    sunset:  `${String(setH).padStart(2, '0')}:${String(setM).padStart(2, '0')}`,
    dayLength: `${dayH}h ${dayMin}m`,
    uvPeak:  `${String(peakUVHour).padStart(2, '0')}:00 – ${String(peakUVHour + 1).padStart(2, '0')}:00`,
    progressPct: Math.min(100, Math.max(0, Math.round(
      ((now.getHours() * 3600 + now.getMinutes() * 60) - riseMs) / dayLenS * 100
    ))),
  };
}

// ═══════════════════════════════════════════════════════════
// NEW: NOTIFICATIONS
// ═══════════════════════════════════════════════════════════
function generateNotifications() {
  const now = Date.now();
  return [
    { id: 1, category: 'iot',     icon: '📡', title: 'IoT Device Synchronized',        message: 'All sensors reporting normally. 1,284 readings today.', time: new Date(now - 5 * 60000), read: false },
    { id: 2, category: 'weather', icon: '🌧️', title: 'Rain Probability Increased',     message: 'Rain probability rose to 72% for the next 3 hours.', time: new Date(now - 12 * 60000), read: false },
    { id: 3, category: 'ai',      icon: '🤖', title: 'AI Prediction Updated',           message: 'Model refreshed with 847 new data points. Confidence: 89%.', time: new Date(now - 25 * 60000), read: true },
    { id: 4, category: 'safety',  icon: '☀️', title: 'High UV Alert',                  message: 'UV Index reached 7. Apply sunscreen if going outdoors.', time: new Date(now - 43 * 60000), read: true },
    { id: 5, category: 'sensor',  icon: '📊', title: 'AQI Trending Up',                message: 'AQI increased from 45 to 68 over the past 2 hours.', time: new Date(now - 68 * 60000), read: true },
    { id: 6, category: 'iot',     icon: '🔋', title: 'Device Battery: 87%',            message: 'IoT Station WX-IOT-001 battery is healthy.', time: new Date(now - 180 * 60000), read: true },
    { id: 7, category: 'weather', icon: '💨', title: 'Wind Speed Elevated',            message: 'Wind speed increased to 22 km/h. Slightly breezy conditions.', time: new Date(now - 240 * 60000), read: true },
  ];
}

// ═══════════════════════════════════════════════════════════
// NEW: SYSTEM ANALYTICS
// ═══════════════════════════════════════════════════════════
function generateSystemAnalytics() {
  return {
    totalReadings:        1284921,
    totalPredictions:     84392,
    averageAccuracy:      94.6,
    totalAnomalies:       127,
    totalAlerts:          43,
    iotUptime:            98.7,
    dataAvailability:     99.1,
    modelPerformance:     94.6,
    stationsOnline:       1,
    stationsTotal:        1,
    lastRetraining:       '2026-07-15',
    predictionsMadeToday: 1344,
    readingsMadeToday:    1284,
    avgResponseTime:      '245ms',
  };
}

// ═══════════════════════════════════════════════════════════
// NEW: AI ASSISTANT RESPONSE
// ═══════════════════════════════════════════════════════════
function generateAssistantResponse(query, iotData, aiPrediction) {
  const q = query.toLowerCase();
  const c = iotData?.current || {};
  const hourly = aiPrediction?.hourly || [];
  const nowH = new Date().getHours();

  // Match intent and respond with data
  if (q.includes('run') || q.includes('jog')) {
    const safe = c.temperature < 32 && c.humidity < 75 && c.uvIndex < 7 && (c.aqi || 0) < 100;
    const reasons = [];
    if (c.temperature >= 32) reasons.push(`temperature is high (${c.temperature}°C)`);
    if (c.humidity >= 75) reasons.push(`humidity is elevated (${c.humidity}%)`);
    if (c.uvIndex >= 7) reasons.push(`UV index is high (${c.uvIndex})`);
    const earlyEvening = hourly.find(h => h.hour >= 17 && h.hour <= 19);
    return {
      answer: safe
        ? `Running conditions are good right now! Temperature is ${c.temperature}°C, humidity is ${c.humidity}%, and UV is ${c.uvIndex} — all within comfortable ranges.`
        : `Running is not ideal right now because ${reasons.join(', ')}. ${earlyEvening ? `Conditions improve around ${earlyEvening.hour}:00 (${earlyEvening.temperature}°C, UV lower).` : 'Consider early morning or evening.'}`,
      sources: [
        { label: 'Temperature', value: `${c.temperature}°C`, source: 'LIVE IoT' },
        { label: 'Humidity',    value: `${c.humidity}%`,     source: 'LIVE IoT' },
        { label: 'UV Index',    value: `${c.uvIndex}`,       source: 'LIVE IoT' },
      ],
      confidence: 91,
    };
  }

  if (q.includes('rain') || q.includes('umbrella')) {
    const nextRain = hourly.find(h => h.rainProbability > 60);
    const maxRain = hourly.reduce((max, h) => h.rainProbability > max.rainProbability ? h : max, hourly[0] || {});
    return {
      answer: nextRain
        ? `Rain is likely around ${nextRain.time} with ${nextRain.rainProbability}% probability. I recommend carrying an umbrella. Peak rain chance is ${maxRain.rainProbability}% at ${maxRain.time}.`
        : `Rain probability is low today (under 30%). Current humidity is ${c.humidity}% and conditions are ${c.condition?.replace('_', ' ') || 'partly cloudy'}.`,
      sources: [
        { label: 'Current Humidity', value: `${c.humidity}%`, source: 'LIVE IoT' },
        { label: 'Next Rain Window', value: nextRain ? `${nextRain.time} (${nextRain.rainProbability}%)` : 'None expected', source: 'AI PREDICTED' },
      ],
      confidence: 87,
    };
  }

  if (q.includes('air') || q.includes('aqi') || q.includes('quality')) {
    const aqiInfo = aqiCategory(c.aqi || 50);
    return {
      answer: `Current air quality is ${aqiInfo.label} with AQI ${c.aqi}. ${
        c.aqi <= 50 ? 'Air is clean — safe for all outdoor activities.' :
        c.aqi <= 100 ? 'Acceptable for most people. Sensitive individuals may experience minor symptoms.' :
        'Unhealthy air — limit outdoor exposure and wear a mask.'
      }`,
      sources: [
        { label: 'AQI', value: `${c.aqi} (${aqiInfo.label})`, source: 'LIVE IoT' },
      ],
      confidence: 96,
    };
  }

  if (q.includes('temperature') || q.includes('tonight') || q.includes('warm') || q.includes('hot')) {
    const nightH = hourly.find(h => h.hour >= 20 && h.hour <= 22);
    return {
      answer: `Currently ${c.temperature}°C (feels like ${c.feelsLike}°C). ${nightH ? `Tonight (${nightH.time}) temperature is predicted to be ${nightH.temperature}°C.` : 'Temperature will gradually cool through the evening.'}`,
      sources: [
        { label: 'Current Temperature', value: `${c.temperature}°C`, source: 'LIVE IoT' },
        { label: 'Feels Like',          value: `${c.feelsLike}°C`,   source: 'LIVE IoT' },
        { label: 'Tonight',             value: nightH ? `${nightH.temperature}°C` : '—', source: 'AI PREDICTED' },
      ],
      confidence: 89,
    };
  }

  if (q.includes('uv') || q.includes('sun') || q.includes('sunscreen')) {
    const uvInfo = uvCategory(c.uvIndex || 0);
    return {
      answer: `UV Index is currently ${c.uvIndex} (${uvInfo.label}). ${
        c.uvIndex <= 2 ? 'No protection needed.' :
        c.uvIndex <= 5 ? 'Some protection recommended during peak hours.' :
        c.uvIndex <= 7 ? 'Apply SPF 50+ sunscreen and wear sunglasses.' :
        'Avoid prolonged outdoor exposure between 10 AM and 4 PM. Use SPF 50+ and seek shade.'
      }`,
      sources: [
        { label: 'UV Index', value: `${c.uvIndex} (${uvInfo.label})`, source: 'LIVE IoT' },
      ],
      confidence: 95,
    };
  }

  if (q.includes('why') || q.includes('change')) {
    return {
      answer: `Weather is changing because pressure is ${c.pressureTrend || 'stable'} at ${c.pressure} hPa, humidity is at ${c.humidity}%, and wind is coming from ${c.windDirection} at ${c.windSpeed} km/h. These factors together indicate ${c.condition?.replace('_', ' ') || 'partly cloudy'} conditions.`,
      sources: [
        { label: 'Pressure',  value: `${c.pressure} hPa (${c.pressureTrend || 'stable'})`, source: 'LIVE IoT' },
        { label: 'Humidity',  value: `${c.humidity}%`, source: 'LIVE IoT' },
        { label: 'Wind',      value: `${c.windSpeed} km/h ${c.windDirection}`, source: 'LIVE IoT' },
      ],
      confidence: 82,
    };
  }

  // Generic fallback
  return {
    answer: `Based on current IoT readings: Temperature ${c.temperature}°C, Humidity ${c.humidity}%, AQI ${c.aqi}, UV ${c.uvIndex}. AI predicts ${aiPrediction?.summary || 'partly cloudy conditions with mild temperatures'}.`,
    sources: [
      { label: 'Current Conditions', value: `${c.temperature}°C, ${c.humidity}% humidity`, source: 'LIVE IoT' },
      { label: 'AI Forecast',        value: 'Available', source: 'AI PREDICTED' },
    ],
    confidence: 75,
  };
}

// ═══════════════════════════════════════════════════════════
// NEW: DEMO MODE DATA (simulated scenarios)
// ═══════════════════════════════════════════════════════════
function generateDemoScenario(scenario = 'rain_event') {
  const scenarios = {
    rain_event: {
      label: 'Rain Event',
      current: { temperature: 23, humidity: 92, windSpeed: 18, rain: true, rainfallMm: 4.2,
        aqi: 38, uvIndex: 1, pressure: 998.5, pressureTrend: 'falling', feelsLike: 22,
        condition: 'rainy', windDirection: 'SE', visibility: 5.1, dewPoint: 21.8 },
    },
    aqi_spike: {
      label: 'AQI Spike',
      current: { temperature: 31, humidity: 65, windSpeed: 5, rain: false, rainfallMm: 0,
        aqi: 187, uvIndex: 5, pressure: 1010, pressureTrend: 'stable', feelsLike: 34,
        condition: 'hazy', windDirection: 'NW', visibility: 3.5, dewPoint: 23.1 },
    },
    temp_spike: {
      label: 'Temperature Spike',
      current: { temperature: 42, humidity: 28, windSpeed: 12, rain: false, rainfallMm: 0,
        aqi: 78, uvIndex: 10, pressure: 1005, pressureTrend: 'rising', feelsLike: 45,
        condition: 'sunny', windDirection: 'NW', visibility: 12, dewPoint: 15.2 },
    },
    iot_offline: {
      label: 'IoT Disconnect',
      status: 'offline',
      current: null,
    },
    clear_night: {
      label: 'Clear Night',
      current: { temperature: 22, humidity: 60, windSpeed: 8, rain: false, rainfallMm: 0,
        aqi: 42, uvIndex: 0, pressure: 1015, pressureTrend: 'stable', feelsLike: 21,
        condition: 'partly_cloudy', windDirection: 'N', visibility: 15, dewPoint: 14.1 },
    },
  };
  return scenarios[scenario] || scenarios.rain_event;
}

// ── Indian city database for search ──
const CITIES_DB = [
  { city:'Mumbai',          state:'Maharashtra',        country:'India', lat:19.0760, lng:72.8777 },
  { city:'Delhi',           state:'Delhi',              country:'India', lat:28.6139, lng:77.2090 },
  { city:'Kolkata',         state:'West Bengal',        country:'India', lat:22.5726, lng:88.3639 },
  { city:'Bangalore',       state:'Karnataka',          country:'India', lat:12.9716, lng:77.5946 },
  { city:'Hyderabad',       state:'Telangana',          country:'India', lat:17.3850, lng:78.4867 },
  { city:'Chennai',         state:'Tamil Nadu',         country:'India', lat:13.0827, lng:80.2707 },
  { city:'Pune',            state:'Maharashtra',        country:'India', lat:18.5204, lng:73.8567 },
  { city:'Ahmedabad',       state:'Gujarat',            country:'India', lat:23.0225, lng:72.5714 },
  { city:'Jaipur',          state:'Rajasthan',          country:'India', lat:26.9124, lng:75.7873 },
  { city:'Lucknow',         state:'Uttar Pradesh',      country:'India', lat:26.8467, lng:80.9462 },
  { city:'Surat',           state:'Gujarat',            country:'India', lat:21.1702, lng:72.8311 },
  { city:'Kanpur',          state:'Uttar Pradesh',      country:'India', lat:26.4499, lng:80.3319 },
  { city:'Nagpur',          state:'Maharashtra',        country:'India', lat:21.1458, lng:79.0882 },
  { city:'Patna',           state:'Bihar',              country:'India', lat:25.5941, lng:85.1376 },
  { city:'Indore',          state:'Madhya Pradesh',     country:'India', lat:22.7196, lng:75.8577 },
  { city:'Bhopal',          state:'Madhya Pradesh',     country:'India', lat:23.2599, lng:77.4126 },
  { city:'Visakhapatnam',   state:'Andhra Pradesh',     country:'India', lat:17.6868, lng:83.2185 },
  { city:'Vadodara',        state:'Gujarat',            country:'India', lat:22.3072, lng:73.1812 },
  { city:'Ghaziabad',       state:'Uttar Pradesh',      country:'India', lat:28.6692, lng:77.4538 },
  { city:'Ludhiana',        state:'Punjab',             country:'India', lat:30.9010, lng:75.8573 },
  { city:'Agra',            state:'Uttar Pradesh',      country:'India', lat:27.1767, lng:78.0081 },
  { city:'Nashik',          state:'Maharashtra',        country:'India', lat:19.9975, lng:73.7898 },
  { city:'Ranchi',          state:'Jharkhand',          country:'India', lat:23.3441, lng:85.3096 },
  { city:'Meerut',          state:'Uttar Pradesh',      country:'India', lat:28.9845, lng:77.7064 },
  { city:'Rajkot',          state:'Gujarat',            country:'India', lat:22.3039, lng:70.8022 },
  { city:'Varanasi',        state:'Uttar Pradesh',      country:'India', lat:25.3176, lng:82.9739 },
  { city:'Srinagar',        state:'Jammu & Kashmir',    country:'India', lat:34.0837, lng:74.7973 },
  { city:'Amritsar',        state:'Punjab',             country:'India', lat:31.6340, lng:74.8723 },
  { city:'Allahabad',       state:'Uttar Pradesh',      country:'India', lat:25.4358, lng:81.8463 },
  { city:'Howrah',          state:'West Bengal',        country:'India', lat:22.5958, lng:88.2636 },
  { city:'Coimbatore',      state:'Tamil Nadu',         country:'India', lat:11.0168, lng:76.9558 },
  { city:'Jabalpur',        state:'Madhya Pradesh',     country:'India', lat:23.1815, lng:79.9864 },
  { city:'Vijayawada',      state:'Andhra Pradesh',     country:'India', lat:16.5062, lng:80.6480 },
  { city:'Jodhpur',         state:'Rajasthan',          country:'India', lat:26.2389, lng:73.0243 },
  { city:'Madurai',         state:'Tamil Nadu',         country:'India', lat:9.9252,  lng:78.1198 },
  { city:'Raipur',          state:'Chhattisgarh',       country:'India', lat:21.2514, lng:81.6296 },
  { city:'Chandigarh',      state:'Chandigarh',         country:'India', lat:30.7333, lng:76.7794 },
  { city:'Guwahati',        state:'Assam',              country:'India', lat:26.1445, lng:91.7362 },
  { city:'Mysore',          state:'Karnataka',          country:'India', lat:12.2958, lng:76.6394 },
  { city:'Thiruvananthapuram', state:'Kerala',          country:'India', lat:8.5241,  lng:76.9366 },
  { city:'Darjeeling',      state:'West Bengal',        country:'India', lat:27.0360, lng:88.2627 },
  { city:'Shimla',          state:'Himachal Pradesh',   country:'India', lat:31.1048, lng:77.1734 },
  { city:'Dehradun',        state:'Uttarakhand',        country:'India', lat:30.3165, lng:78.0322 },
  { city:'Murshidabad',     state:'West Bengal',        country:'India', lat:24.1768, lng:88.2712 },
  { city:'Siliguri',        state:'West Bengal',        country:'India', lat:26.7271, lng:88.3953 },
  { city:'Durgapur',        state:'West Bengal',        country:'India', lat:23.5204, lng:87.3119 },
  { city:'Asansol',         state:'West Bengal',        country:'India', lat:23.6834, lng:86.9820 },
  { city:'Kochi',           state:'Kerala',             country:'India', lat:9.9312,  lng:76.2673 },
  { city:'Bhubaneswar',     state:'Odisha',             country:'India', lat:20.2961, lng:85.8245 },
  { city:'Mangalore',       state:'Karnataka',          country:'India', lat:12.8706, lng:74.8429 },
];

// ─────────────────────────────────────────────────────────────
// Main MockData object — all methods return realistic data
// ─────────────────────────────────────────────────────────────
const MockData = {

  getIoTData() {
    const hist = generateHistory(26, 68, 24, 30);
    const uv   = 6;
    const aqi  = 54;
    const wind = 14.2;
    const rainProb = 22;
    const condition = 'partly_cloudy';
    return {
      status:          'connected',
      signal:          'excellent',
      signalStrength:  92,
      lastUpdate:      new Date(Date.now() - 2 * 60 * 1000),
      deviceId:        'WX-IOT-001',
      firmwareVersion: '3.2.1',
      batteryLevel:    87,
      location:        { lat:24.1768, lng:88.2712, city:'Murshidabad', state:'West Bengal', country:'India' },
      current: {
        temperature:    28.4,
        humidity:       71,
        windSpeed:      wind,
        windDirection:  'NE',
        windDirectionDeg: 45,
        rain:           false,
        rainfallMm:     0.0,
        rainProbability: rainProb,
        aqi:            aqi,
        aqiInfo:        aqiCategory(aqi),
        uvIndex:        uv,
        uvInfo:         uvCategory(uv),
        pressure:       1008.3,
        pressureTrend:  pressureTrend(hist),
        visibility:     8.5,
        feelsLike:      31.2,
        condition,
        dewPoint:       21.3,
        sunrise:        '05:42',
        sunset:         '18:28',
      },
      history: hist,
      recommendations: generateRecommendations(condition, aqi, uv),
      doDont:          generateDoDont(condition, aqi, uv),
      safetyAlerts:    generateSafetyAlerts(condition, aqi, uv, wind),
      sunriseSunset:   generateSunriseSunset(24.17),
    };
  },

  getAIPrediction() {
    return {
      generated:     new Date(Date.now() - 10 * 60 * 1000),
      modelVersion:  'v2.3-lstm',
      confidence:    87,
      dataPoints:    2847,
      hourly:        generateHourlyPrediction(27),
      daily:         generateDailyForecast(30),
      summary:       'Partly cloudy morning transitioning to possible afternoon showers. Temperatures remain warm. Clear skies expected by late evening.',
    };
  },

  getExternalWeather(locationObj) {
    const condPool = ['sunny','partly_cloudy','cloudy','rainy','thunderstorm','foggy'];
    const cond     = condPool[Math.floor(Math.random() * condPool.length)];
    const temp     = Math.round(18 + Math.random() * 18);
    const aqi      = Math.round(30 + Math.random() * 130);
    const uv       = Math.round(1 + Math.random() * 9);
    return {
      source:   'external',
      location: locationObj,
      current: {
        temperature:   temp,
        feelsLike:     temp + Math.round((Math.random() - 0.5) * 6),
        humidity:      Math.round(45 + Math.random() * 45),
        condition:     cond,
        windSpeed:     +((5 + Math.random() * 20).toFixed(1)),
        windDirection: ['N','NE','E','SE','S','SW','W','NW'][Math.floor(Math.random() * 8)],
        pressure:      Math.round(998 + Math.random() * 20),
        visibility:    +((3 + Math.random() * 12).toFixed(1)),
        aqi,
        aqiInfo:       aqiCategory(aqi),
        uvIndex:       uv,
        uvInfo:        uvCategory(uv),
        rain:          cond.includes('rain') || cond === 'thunderstorm',
        rainfallMm:    cond.includes('rain') ? +((Math.random() * 15).toFixed(1)) : 0,
        city:          locationObj.city,
      },
      hourly:    generateHourlyPrediction(temp),
      daily:     generateDailyForecast(temp + 2),
      fetchedAt: new Date(),
    };
  },

  searchCities(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().trim();
    return CITIES_DB.filter(c =>
      c.city.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q)
    ).slice(0, 8);
  },

  getDefaultSavedLocations() {
    return [
      { id:1, city:'Kolkata',    state:'West Bengal',      country:'India', lat:22.5726, lng:88.3639, temp:29, condition:'partly_cloudy' },
      { id:2, city:'Darjeeling', state:'West Bengal',      country:'India', lat:27.0360, lng:88.2627, temp:17, condition:'foggy'         },
      { id:3, city:'Delhi',      state:'Delhi',            country:'India', lat:28.6139, lng:77.2090, temp:34, condition:'hazy'          },
    ];
  },

  // NEW methods
  getWeatherScore(current)          { return generateWeatherScore(current); },
  getActivityScores(current)        { return generateActivityScores(current); },
  getDeviceHealth(status)           { return generateDeviceHealth(status); },
  getAnomalies(history, current)    { return generateAnomalyDetection(history, current); },
  getAIVsActual(hourly, history)    { return generateAIVsActual(hourly, history); },
  getModelPerformance()             { return generateModelPerformance(); },
  getAIPredictionExplanation(p, c)  { return generateAIPredictionExplanation(p, c); },
  getLocalVsExternal(iot, ext)      { return generateLocalVsExternal(iot, ext); },
  getWeatherTimeline(hourly)        { return generateWeatherTimeline(hourly); },
  getSunriseSunset(lat)             { return generateSunriseSunset(lat); },
  getNotifications()                { return generateNotifications(); },
  getSystemAnalytics()              { return generateSystemAnalytics(); },
  askAssistant(q, iot, ai)          { return generateAssistantResponse(q, iot, ai); },
  getDemoScenario(scenario)         { return generateDemoScenario(scenario); },
  getHistoricalData(range = '24h') {
    const configs = {
      '1h':  { hours: 1,  intervalMins: 5  },
      '6h':  { hours: 6,  intervalMins: 15 },
      '12h': { hours: 12, intervalMins: 30 },
      '24h': { hours: 24, intervalMins: 30 },
      '7d':  { hours: 168,intervalMins: 120 },
      '30d': { hours: 720,intervalMins: 480 },
    };
    const { hours, intervalMins } = configs[range] || configs['24h'];
    return generateHistory(26, 68, hours, intervalMins);
  },
};

// ── Expose to global scope ──
window.MockData          = MockData;
window.WEATHER_CONDITIONS= WEATHER_CONDITIONS;
window.getWeatherIcon    = getWeatherIcon;
window.getWeatherLabel   = getWeatherLabel;
window.getWeatherBg      = getWeatherBg;
window.aqiCategory       = aqiCategory;
window.uvCategory        = uvCategory;
