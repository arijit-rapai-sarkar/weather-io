'use strict';
// ============================================================
// WeatherIQ — API Integration Layer
// Uses relative /api paths when served by FastAPI, with automatic
// fallback to localhost:8000 for separate local dev servers / file://.
// ============================================================

const API = (() => {

  // ── Backend configuration ──────────────────────────────────
  const isSeparateLocalDev =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
      ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        window.location.port &&
        window.location.port !== '8000'));

  const API_BASE = isSeparateLocalDev
    ? `http://${window.location.hostname || 'localhost'}:8000/api`
    : '/api';

  const ENDPOINTS = {
    iotCurrent:       `${API_BASE}/weather/current`,
    iotHistory:       `${API_BASE}/weather/history`,       // ?limit=&range=
    aiPrediction:     `${API_BASE}/weather/predict`,
    forecast:         `${API_BASE}/weather/forecast`,
    intelligence:     `${API_BASE}/weather/intelligence`,
    weatherScore:     `${API_BASE}/analytics/score`,
    deviceHealth:     `${API_BASE}/iot/health`,
    anomalies:        `${API_BASE}/analytics/anomalies`,
    modelPerformance: `${API_BASE}/ai/performance`,
    aiVsActual:       `${API_BASE}/ai/validation`,
    aiExplanation:    `${API_BASE}/ai/explanation`,
    notifications:    `${API_BASE}/notifications`,
    analytics:        `${API_BASE}/analytics/system`,
    assistant:        `${API_BASE}/ai/assistant`,
    assistantStatus:  `${API_BASE}/ai/assistant/status`,
  };

  // Simulated network delay for offline mock fallback (ms)
  const MOCK_DELAY = { iot: 700, ai: 950, ext: 600, search: 200, fast: 300, medium: 500 };

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function apiFetch(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // ── Shared telemetry helpers ───────────────────────────────
  function estimateUv(sunlight, timestamp) {
    if (sunlight !== 'Bright') return 0;
    const hr = new Date(timestamp || Date.now()).getHours();
    return (hr >= 10 && hr <= 16) ? 6 : 3;
  }

  function computeFeelsLikeAndDew(temp, humidity) {
    const T = temp != null ? temp : 25;
    const H = Math.max(1, humidity != null ? humidity : 50);
    const e = (H / 100) * 6.105 * Math.exp((17.27 * T) / (237.7 + T));
    const feelsLike = Math.round((T + 0.33 * e - 4.0) * 10) / 10;
    const gamma = Math.log(H / 100) + (17.27 * T) / (237.7 + T);
    const dewPoint = Math.round(((237.7 * gamma) / (17.27 - gamma)) * 10) / 10;
    return { feelsLike, dewPoint };
  }

  function computePressureTrend(history) {
    if (!Array.isArray(history) || history.length < 3) return 'stable';
    const pressures = history.map(h => h.pressure).filter(p => p != null && p > 500);
    if (pressures.length < 3) return 'stable';
    const recent = pressures.slice(-4);
    const diff = recent[recent.length - 1] - recent[0];
    if (diff > 1) return 'rising';
    if (diff < -1) return 'falling';
    return 'stable';
  }

  function sortChronological(records) {
    return [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  function mapReadingToHistoryPoint(r) {
    const pressure = (r.pressure != null && r.pressure > 500) ? r.pressure : 1013.25;
    return {
      timestamp:   r.timestamp,
      temperature: r.temperature,
      humidity:    r.humidity,
      pressure,
      windSpeed:   null,
      aqi:         r.air_quality != null ? Math.round(r.air_quality) : null,
      uvIndex:     estimateUv(r.sunlight, r.timestamp),
      rainfall:    r.rain === 'Raining' ? 2.5 : 0,
    };
  }

  function buildHourlyFromLive(baseTemp, maxTemp, rainTomorrow, currentForecast) {
    const now = new Date();
    const curHour = now.getHours();
    const base = baseTemp != null ? Number(baseTemp) : 25;
    const hi = maxTemp != null ? Number(maxTemp) : base + 3;
    const mid = (base + hi) / 2;
    const amp = Math.max(1.5, Math.min(6, Math.abs(hi - base) + 1.5));
    const baseRain = currentForecast?.rainProbability != null
      ? Number(currentForecast.rainProbability)
      : (rainTomorrow ? 65 : 15);
    const baseHum = currentForecast?.humidity != null ? Number(currentForecast.humidity) : 62;
    const baseWind = currentForecast?.wind != null ? Number(currentForecast.wind) : 10;

    return Array.from({ length: 24 }, (_, i) => {
      const hour = (curHour + i) % 24;
      const tempVal = i === 0
        ? Math.round(base * 10) / 10
        : Math.round((mid + amp * Math.sin(((hour - 9) * Math.PI) / 12)) * 10) / 10;
      const rainProb = Math.round(
        Math.max(5, Math.min(95, baseRain + Math.sin(i * 0.45) * 12))
      );
      let cond = 'partly_cloudy';
      if (rainProb >= 60) cond = 'rainy';
      else if (hour >= 6 && hour < 18 && rainProb < 30) cond = 'sunny';
      else if (rainProb >= 35) cond = 'cloudy';

      return {
        hour,
        time:            `${String(hour).padStart(2, '0')}:00`,
        condition:       cond,
        temperature:     Math.round(tempVal),
        humidity:        Math.round(Math.max(30, Math.min(95, baseHum - Math.sin(((hour - 9) * Math.PI) / 12) * 8))),
        rainProbability: rainProb,
        windSpeed:       Math.round(baseWind),
        pressure:        1012,
        confidence:      Math.max(70, 92 - Math.floor(i * 0.6)),
        isNow:           i === 0,
      };
    });
  }

  // ── Public methods ─────────────────────────────────────────

  /**
   * Fetch the latest IoT sensor reading, recent DB history,
   * device health, and weather intelligence in parallel.
   */
  async function getIoTData() {
    try {
      const realData = await apiFetch(ENDPOINTS.iotCurrent);
      const T = realData.temperature != null ? realData.temperature : 25;
      const H = realData.humidity != null ? realData.humidity : 50;
      const pressure = (realData.pressure != null && realData.pressure > 500)
        ? Math.round(realData.pressure * 10) / 10
        : 1013.25;
      const aqi = Math.round(realData.air_quality != null ? realData.air_quality : 50);
      const sunlight = realData.sunlight || 'Dark';
      const rainStatus = realData.rain || 'No Rain';
      const isRaining = rainStatus === 'Raining';
      const uvIndex = estimateUv(sunlight, realData.timestamp);
      const { feelsLike, dewPoint } = computeFeelsLikeAndDew(T, H);

      let condition = 'partly_cloudy';
      if (isRaining) condition = 'rainy';
      else if (sunlight === 'Bright') condition = 'sunny';
      else {
        const hr = new Date(realData.timestamp || Date.now()).getHours();
        condition = (hr >= 18 || hr < 6) ? 'clear' : 'partly_cloudy';
      }

      const currentObj = {
        temperature:     Math.round(T * 10) / 10,
        humidity:        Math.round(H),
        pressure,
        pressureTrend:   'stable',
        aqi,
        aqiInfo:         window.aqiCategory ? window.aqiCategory(aqi) : { label: 'Moderate' },
        sunlight,
        rainStatus,
        rain:            isRaining,
        rainfallMm:      isRaining ? 2.5 : 0.0,
        rainProbability: isRaining ? 90 : (H > 80 ? 45 : 15),
        uvIndex,
        uvInfo:          window.uvCategory ? window.uvCategory(uvIndex) : { label: 'Low' },
        feelsLike,
        dewPoint,
        condition,
        windSpeed:       null,
        windDirection:   null,
        visibility:      null,
      };

      const [histRes, healthRes, intelRes] = await Promise.allSettled([
        apiFetch(`${ENDPOINTS.iotHistory}?limit=24`),
        apiFetch(ENDPOINTS.deviceHealth),
        apiFetch(ENDPOINTS.intelligence, {
          method: 'POST',
          body: JSON.stringify({ current: currentObj }),
        }),
      ]);

      const history = (histRes.status === 'fulfilled' && Array.isArray(histRes.value))
        ? sortChronological(histRes.value).map(mapReadingToHistoryPoint)
        : [];
      currentObj.pressureTrend = computePressureTrend(history);

      const health = healthRes.status === 'fulfilled' ? healthRes.value : null;
      const dev = health?.device || {};
      const devLoc = dev.location || {};
      const lat = devLoc.lat ?? 22.7383;
      const lng = devLoc.lng ?? 88.4797;

      const intel = intelRes.status === 'fulfilled' ? intelRes.value : null;

      return {
        source:          'live',
        status:          dev.status || 'connected',
        signal:          dev.wifiQuality || 'Connected',
        signalStrength:  dev.wifiSignal ?? null,
        lastUpdate:      realData.timestamp,
        deviceId:        dev.id || 'ESP8266-WX-001',
        firmwareVersion: dev.firmware || '1.2.0',
        batteryLevel:    dev.battery ?? 100,
        location: {
          lat,
          lng,
          city:    devLoc.city || 'Live IoT Station',
          state:   devLoc.state || 'West Bengal',
          country: 'India',
        },
        current:         currentObj,
        history,
        recommendations: intel?.recommendations || [],
        doDont:          intel?.doDont || { dos: [], donts: [] },
        safetyAlerts:    intel?.safetyAlerts || [],
        sunriseSunset:   window.MockData ? MockData.getSunriseSunset(lat) : null,
      };
    } catch (e) {
      console.warn('Backend /weather/current failed, using mock', e);
    }

    await delay(MOCK_DELAY.iot);
    return MockData.getIoTData();
  }

  /**
   * Fetch the latest AI prediction and 7-day ML forecast.
   */
  async function getAIPrediction() {
    try {
      const [predRes, forecastRes, currentRes] = await Promise.allSettled([
        apiFetch(ENDPOINTS.aiPrediction),
        apiFetch(ENDPOINTS.forecast),
        apiFetch(ENDPOINTS.iotCurrent),
      ]);

      if (predRes.status === 'fulfilled' && predRes.value && !predRes.value.error) {
        const realData = predRes.value;
        const daily = (forecastRes.status === 'fulfilled' && Array.isArray(forecastRes.value) && forecastRes.value.length > 0)
          ? forecastRes.value
          : MockData.getAIPrediction().daily;
        const curTemp = currentRes.status === 'fulfilled' ? currentRes.value?.temperature : null;
        const baseTemp = curTemp != null ? curTemp : (daily[0]?.high != null ? daily[0].high - 2 : realData.predicted_max_temp);

        const hourly = buildHourlyFromLive(
          baseTemp,
          realData.predicted_max_temp,
          realData.rain_tomorrow,
          daily[0]
        );

        const tomorrowForecast = daily[1] || {};
        const rainProbTomorrow = tomorrowForecast.rainProbability != null
          ? tomorrowForecast.rainProbability
          : (realData.rain_tomorrow ? 80 : 15);

        return {
          generated:       new Date().toISOString(),
          modelVersion:    'RandomForest-v1.0',
          confidence:      realData.based_on_live_data ? 88 : 74,
          dataPoints:      daily.length,
          basedOnLiveData: !!realData.based_on_live_data,
          sunAzimuth:      realData.sun_azimuth,
          sunElevation:    realData.sun_elevation,
          hourly,
          daily,
          tomorrow: {
            tempHigh:        realData.predicted_max_temp,
            condition:       realData.rain_tomorrow ? 'rainy' : (tomorrowForecast.condition || 'sunny'),
            rainProbability: rainProbTomorrow,
          },
          summary: `AI predicts max temp: ${realData.predicted_max_temp}°C. Rain tomorrow: ${realData.rain_tomorrow ? 'Yes' : 'No'}.`,
        };
      }
    } catch (e) {
      console.warn('Backend /weather/predict failed, using mock', e);
    }

    await delay(MOCK_DELAY.ai);
    const mock = MockData.getAIPrediction();
    mock.tomorrow = {
      tempHigh: mock.daily?.[1]?.high || 24,
      condition: mock.daily?.[1]?.condition || 'Partly Cloudy',
      rainProbability: mock.daily?.[1]?.rainProbability || 20,
    };
    return mock;
  }

  /**
   * Fetch weather for an external searched location.
   * @param {{ city, state, country, lat, lng }} locationObj
   */
  async function getExternalWeather(locationObj) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${locationObj.lat}&longitude=${locationObj.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,surface_pressure&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();

      const mapCode = (code) => {
        if (code === 0) return 'sunny';
        if (code === 1 || code === 2) return 'partly_cloudy';
        if (code === 3) return 'cloudy';
        if (code >= 45 && code <= 48) return 'foggy';
        if (code >= 51 && code <= 55) return 'drizzle';
        if (code >= 61 && code <= 65) return 'rainy';
        if (code >= 71 && code <= 77) return 'snowy';
        if (code >= 80 && code <= 82) return 'heavy_rain';
        if (code >= 95 && code <= 99) return 'thunderstorm';
        return 'sunny';
      };

      const c = data.current;
      const d = data.daily;
      const h = data.hourly;

      const daily = d.time.map((t, i) => {
        const dateObj = new Date(t);
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        return {
          date: dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          day: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[dateObj.getDay()],
          condition: mapCode(d.weather_code[i]),
          high: Math.round(d.temperature_2m_max[i]),
          low: Math.round(d.temperature_2m_min[i]),
          rainProbability: d.precipitation_probability_max[i],
          humidity: 60,
          wind: Math.round(d.wind_speed_10m_max[i]),
        };
      }).slice(0, 7);

      const currentHourIdx = h.time.findIndex(t => new Date(t) > new Date()) || 0;
      const hourly = [];
      for (let i = 0; i < 24; i++) {
        const idx = currentHourIdx + i;
        if (idx >= h.time.length) break;
        const timeStr = new Date(h.time[idx]).getHours();
        hourly.push({
          hour: timeStr,
          time: `${String(timeStr).padStart(2, '0')}:00`,
          condition: mapCode(h.weather_code[idx]),
          temperature: Math.round(h.temperature_2m[idx]),
          humidity: h.relative_humidity_2m[idx],
          rainProbability: h.precipitation_probability[idx],
          windSpeed: h.wind_speed_10m[idx],
          pressure: h.surface_pressure[idx],
          confidence: 90,
          isNow: i === 0,
        });
      }

      return {
        source: 'external',
        location: locationObj,
        current: {
          temperature: Math.round(c.temperature_2m),
          feelsLike: Math.round(c.apparent_temperature),
          humidity: c.relative_humidity_2m,
          condition: mapCode(c.weather_code),
          windSpeed: c.wind_speed_10m,
          windDirection: 'N',
          pressure: c.surface_pressure,
          visibility: 10,
          aqi: 50,
          aqiInfo: window.aqiCategory ? window.aqiCategory(50) : { label: 'Good' },
          uvIndex: 5,
          uvInfo: window.uvCategory ? window.uvCategory(5) : { label: 'Moderate' },
          rain: c.precipitation > 0,
          rainfallMm: c.precipitation,
          city: locationObj.city,
        },
        hourly,
        daily,
        fetchedAt: new Date(),
      };
    } catch (e) {
      console.warn('Open-Meteo failed, using mock', e);
    }
    await delay(MOCK_DELAY.ext);
    return MockData.getExternalWeather(locationObj);
  }

  /**
   * Search for locations matching a query string.
   * @param {string} query
   */
  async function searchLocations(query) {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8`);
      const data = await res.json();
      if (data.results) {
        return data.results.map(r => ({
          city: r.name,
          state: r.admin1 || '',
          country: r.country,
          lat: r.latitude,
          lng: r.longitude,
        }));
      }
    } catch (e) { console.warn(e); }
    await delay(MOCK_DELAY.search);
    return MockData.searchCities(query);
  }

  /**
   * Get weather intelligence (recommendations, do/don't, safety alerts).
   * @param {object} current
   */
  async function getWeatherIntelligence(current) {
    try {
      return await apiFetch(ENDPOINTS.intelligence, {
        method: 'POST',
        body: JSON.stringify({ current: current || {} }),
      });
    } catch (e) {
      console.warn('Backend /weather/intelligence failed, using mock', e);
    }
    await delay(MOCK_DELAY.fast);
    const c = current || {};
    const cond = c.condition || 'partly_cloudy';
    return {
      recommendations: MockData.getIoTData().recommendations,
      doDont: MockData.getIoTData().doDont,
      safetyAlerts: MockData.getIoTData().safetyAlerts,
      condition: cond,
      basedOnLiveData: false,
    };
  }

  /**
   * Get weather score for current conditions.
   * @param {object} current — IoT current readings
   */
  async function getWeatherScore(current) {
    try {
      return await apiFetch(ENDPOINTS.weatherScore, {
        method: 'POST',
        body: JSON.stringify(current || {}),
      });
    } catch (e) {
      console.warn('Backend /analytics/score failed, using mock', e);
    }

    await delay(MOCK_DELAY.fast);
    return MockData.getWeatherScore(current);
  }

  /**
   * Get IoT device health status.
   */
  async function getDeviceHealth(status) {
    try {
      return await apiFetch(ENDPOINTS.deviceHealth);
    } catch (e) {
      console.warn('Backend /iot/health failed, using mock', e);
    }

    await delay(MOCK_DELAY.fast);
    return MockData.getDeviceHealth(status);
  }

  /**
   * Get anomaly detection results.
   * @param {Array} history
   * @param {object} current
   */
  async function getAnomalies(history, current) {
    try {
      return await apiFetch(ENDPOINTS.anomalies, {
        method: 'POST',
        body: JSON.stringify({ history: history || [], current: current || {} }),
      });
    } catch (e) {
      console.warn('Backend /analytics/anomalies failed, using mock', e);
    }

    await delay(MOCK_DELAY.fast);
    return MockData.getAnomalies(history, current);
  }

  /**
   * Get AI model performance metrics.
   */
  async function getModelPerformance() {
    try {
      return await apiFetch(ENDPOINTS.modelPerformance);
    } catch (e) {
      console.warn('Backend /ai/performance failed, using mock', e);
    }

    await delay(MOCK_DELAY.medium);
    return MockData.getModelPerformance();
  }

  /**
   * Get AI vs Actual comparison data.
   */
  async function getAIVsActual(hourly, history) {
    try {
      return await apiFetch(ENDPOINTS.aiVsActual, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (e) {
      console.warn('Backend /ai/validation failed, using mock', e);
    }

    await delay(MOCK_DELAY.medium);
    return MockData.getAIVsActual(hourly, history);
  }

  /**
   * Get historical sensor data in chronological order.
   * @param {string} range — '1h'|'6h'|'12h'|'24h'|'7d'|'30d'
   */
  async function getHistoricalData(range = '24h') {
    const limits = { '1h': 60, '6h': 120, '12h': 180, '24h': 240, '7d': 400, '30d': 500 };
    const limit = limits[range] || 240;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(
        `${ENDPOINTS.iotHistory}?range=${encodeURIComponent(range)}&limit=${limit}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const totalHeader = res.headers.get('X-Total-Readings');
        const realHistory = await res.json();
        if (Array.isArray(realHistory) && realHistory.length > 0) {
          return sortChronological(realHistory).map(mapReadingToHistoryPoint);
        }
        // If backend DB actually has readings, return [] rather than mixing in mock data
        if (totalHeader !== null && Number(totalHeader) > 0) {
          return [];
        }
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn('Backend /weather/history failed, using mock', e);
    }

    await delay(MOCK_DELAY.medium);
    return MockData.getHistoricalData(range);
  }

  /**
   * Get notification history.
   */
  async function getNotifications() {
    try {
      return await apiFetch(ENDPOINTS.notifications);
    } catch (e) {
      console.warn('Backend /notifications failed, using mock', e);
    }

    await delay(MOCK_DELAY.fast);
    return MockData.getNotifications();
  }

  /**
   * Get system analytics.
   */
  async function getSystemAnalytics() {
    try {
      return await apiFetch(ENDPOINTS.analytics);
    } catch (e) {
      console.warn('Backend /analytics/system failed, using mock', e);
    }

    await delay(MOCK_DELAY.fast);
    return MockData.getSystemAnalytics();
  }

  /**
   * Check active AI assistant backend mode (LLM vs local NLU+ML).
   */
  async function getAssistantStatus() {
    try {
      return await apiFetch(ENDPOINTS.assistantStatus, {}, 4000);
    } catch (e) { /* ignore when backend offline */ }
    return { mode: 'offline', label: 'Offline Fallback' };
  }

  /**
   * Ask the AI weather assistant.
   * @param {string} query
   * @param {object} iotData
   * @param {object} aiPrediction
   * @param {object} extraContext — optional { history, externalWeather, llmConfig }
   */
  async function askAssistant(query, iotData, aiPrediction, extraContext = {}) {
    try {
      return await apiFetch(ENDPOINTS.assistant, {
        method: 'POST',
        body: JSON.stringify({
          query,
          history: extraContext.history || [],
          context: {
            iotData,
            aiPrediction,
            externalWeather: extraContext.externalWeather || null,
          },
          llmConfig: extraContext.llmConfig || null,
        }),
      }, 20000);
    } catch (e) {
      console.warn('Backend /ai/assistant failed, using mock', e);
    }

    await delay(500);
    return MockData.askAssistant(query, iotData, aiPrediction);
  }

  /**
   * Get AI prediction explanation.
   */
  async function getAIPredictionExplanation(prediction, current) {
    try {
      return await apiFetch(ENDPOINTS.aiExplanation, {
        method: 'POST',
        body: JSON.stringify({ prediction, current }),
      });
    } catch (e) {
      console.warn('Backend /ai/explanation failed, using mock', e);
    }

    await delay(MOCK_DELAY.fast);
    return MockData.getAIPredictionExplanation(prediction, current);
  }

  /**
   * Compare local IoT telemetry with an external searched city (null-safe).
   */
  function getLocalVsExternal(iotCurrent, externalCurrent, iotLocationLabel = 'Local IoT Station') {
    if (!externalCurrent || !iotCurrent) {
      return { available: false, reason: 'No external location selected. Search for a city to compare.' };
    }

    const params = [
      { key: 'temperature', label: 'Temperature', unit: '°C',   iotVal: iotCurrent.temperature, extVal: externalCurrent.temperature },
      { key: 'humidity',    label: 'Humidity',    unit: '%',    iotVal: iotCurrent.humidity,    extVal: externalCurrent.humidity },
      { key: 'windSpeed',   label: 'Wind Speed',  unit: 'km/h', iotVal: iotCurrent.windSpeed,   extVal: externalCurrent.windSpeed },
      { key: 'pressure',    label: 'Pressure',    unit: 'hPa',  iotVal: iotCurrent.pressure,    extVal: externalCurrent.pressure },
      { key: 'aqi',         label: 'AQI',         unit: '',     iotVal: iotCurrent.aqi,         extVal: externalCurrent.aqi },
    ];

    const compared = params.map(p => {
      const hasBoth = p.iotVal != null && p.extVal != null && !Number.isNaN(Number(p.iotVal)) && !Number.isNaN(Number(p.extVal));
      if (!hasBoth) {
        return { ...p, diff: null, significance: 'normal' };
      }
      const diff = +(Number(p.iotVal) - Number(p.extVal)).toFixed(1);
      const threshold = p.key === 'pressure' ? 4 : p.key === 'aqi' ? 20 : 3;
      const significance = Math.abs(diff) > threshold ? 'significant' : 'normal';
      return { ...p, diff, significance };
    });

    const significantDiffs = compared.filter(c => c.significance === 'significant' && c.diff != null);
    let insight = 'Local IoT readings closely match the regional weather service.';
    if (significantDiffs.length > 0) {
      const first = significantDiffs[0];
      insight = `Your local sensor shows ${Math.abs(first.diff)} ${first.unit} ${first.diff > 0 ? 'higher' : 'lower'} ${first.label.toLowerCase()} than the regional weather service. This may reflect microclimatic conditions.`;
    }

    return {
      available: true,
      compared,
      insight,
      iotLocation: `${iotLocationLabel} (IoT)`,
      externalLocation: externalCurrent.city || 'Selected City',
    };
  }

  return {
    getIoTData, getAIPrediction, getExternalWeather, searchLocations,
    getWeatherIntelligence, getWeatherScore, getDeviceHealth, getAnomalies,
    getModelPerformance, getAIVsActual, getHistoricalData, getNotifications,
    getSystemAnalytics, askAssistant, getAssistantStatus,
    getAIPredictionExplanation, getLocalVsExternal, ENDPOINTS,
  };
})();

window.API = API;
