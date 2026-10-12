'use strict';
// ============================================================
// WeatherIQ — API Integration Layer
//
// HOW TO CONNECT YOUR BACKEND:
//   1. Set BASE_URL to your backend's base URL.
//   2. Replace each method's mock return with the commented
//      fetch() call — the data shape is already correct.
//   3. The frontend will work without any other changes.
// ============================================================

const API = (() => {

  // ── Backend configuration ──────────────────────────────────
  const BASE_URL = 'http://localhost:8000/api/v1';

  const ENDPOINTS = {
    iotLatest:       `${BASE_URL}/iot/latest`,
    aiPrediction:    `${BASE_URL}/prediction/latest`,
    externalWeather: `${BASE_URL}/weather/external`,  // ?lat=&lng=
    searchLocation:  `${BASE_URL}/weather/search`,    // ?q=
    weatherScore:    `${BASE_URL}/analytics/score`,
    deviceHealth:    `${BASE_URL}/iot/health`,
    anomalies:       `${BASE_URL}/analytics/anomalies`,
    modelPerformance:`${BASE_URL}/ai/performance`,
    aiVsActual:      `${BASE_URL}/ai/validation`,
    historicalData:  `${BASE_URL}/iot/history`,       // ?range=
    notifications:   `${BASE_URL}/notifications`,
    analytics:       `${BASE_URL}/analytics/system`,
    assistant:       `${BASE_URL}/ai/assistant`,      // POST {query}
    exportData:      `${BASE_URL}/export`,            // ?format=&range=
  };

  // Simulated network delay for demo realism (ms)
  const MOCK_DELAY = { iot: 700, ai: 950, ext: 600, search: 200, fast: 300, medium: 500 };

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Generic fetch wrapper (for when real backend is connected)
  async function apiFetch(url, options = {}) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        signal: controller.signal,
        ...options,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // ── Public methods ─────────────────────────────────────────

  /**
   * Fetch the latest IoT sensor reading.
   */
  async function getIoTData() {
    try {
      const res = await fetch('http://localhost:8000/api/weather/current');
      if (res.ok) {
        const realData = await res.json();
        const mock = MockData.getIoTData();
        mock.current.temperature = realData.temperature;
        mock.current.humidity = realData.humidity;
        mock.current.pressure = realData.pressure;
        mock.current.aqi = realData.air_quality;
        mock.current.aqiInfo = window.aqiCategory(realData.air_quality);
        mock.lastUpdate = realData.timestamp;
        return mock;
      }
    } catch(e) { console.warn("Backend /weather/current failed, using mock", e); }

    await delay(MOCK_DELAY.iot);
    return MockData.getIoTData();
  }

  /**
   * Fetch the latest AI prediction.
   */
  async function getAIPrediction() {
    try {
      const res = await fetch('http://localhost:8000/api/weather/predict');
      if (res.ok) {
        const realData = await res.json();
        const mock = MockData.getAIPrediction();
        if (!realData.error) {
           mock.summary = `AI predicts max temp: ${realData.predicted_max_temp}°C. Rain tomorrow: ${realData.rain_tomorrow ? 'Yes' : 'No'}.`;
           mock.hourly[0].temperature = realData.predicted_max_temp;
           mock.hourly[0].rainProbability = realData.rain_tomorrow ? 80 : 10;
        }
        return mock;
      }
    } catch(e) { console.warn("Backend /weather/predict failed, using mock", e); }

    await delay(MOCK_DELAY.ai);
    return MockData.getAIPrediction();
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
          wind: Math.round(d.wind_speed_10m_max[i])
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
          isNow: i === 0
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
          aqiInfo: window.aqiCategory ? window.aqiCategory(50) : {label:'Good'},
          uvIndex: 5,
          uvInfo: window.uvCategory ? window.uvCategory(5) : {label:'Moderate'},
          rain: c.precipitation > 0,
          rainfallMm: c.precipitation,
          city: locationObj.city
        },
        hourly,
        daily,
        fetchedAt: new Date()
      };
    } catch (e) {
      console.warn("Open-Meteo failed, using mock", e);
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
          lng: r.longitude
        }));
      }
    } catch(e) { console.warn(e); }
    await delay(MOCK_DELAY.search);
    return MockData.searchCities(query);
  }

  /**
   * Get weather score for current conditions.
   * @param {object} current — IoT current readings
   */
  async function getWeatherScore(current) {
    try {
      const res = await fetch('http://localhost:8000/api/analytics/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current || {})
      });
      if (res.ok) {
        return await res.json();
      }
    } catch(e) { console.warn("Backend /analytics/score failed, using mock", e); }

    await delay(MOCK_DELAY.fast);
    return MockData.getWeatherScore(current);
  }

  /**
   * Get IoT device health status.
   */
  async function getDeviceHealth(status) {
    try {
      const res = await fetch('http://localhost:8000/api/iot/health');
      if (res.ok) {
        return await res.json();
      }
    } catch(e) { console.warn("Backend /iot/health failed, using mock", e); }

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
      const res = await fetch('http://localhost:8000/api/analytics/anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: history || [], current: current || {} })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch(e) { console.warn("Backend /analytics/anomalies failed, using mock", e); }

    await delay(MOCK_DELAY.fast);
    return MockData.getAnomalies(history, current);
  }

  /**
   * Get AI model performance metrics.
   */
  async function getModelPerformance() {
    await delay(MOCK_DELAY.medium);
    // return apiFetch(ENDPOINTS.modelPerformance);
    return MockData.getModelPerformance();
  }

  /**
   * Get AI vs Actual comparison data.
   */
  async function getAIVsActual(hourly, history) {
    await delay(MOCK_DELAY.medium);
    // return apiFetch(ENDPOINTS.aiVsActual);
    return MockData.getAIVsActual(hourly, history);
  }

  /**
   * Get historical sensor data.
   * @param {string} range — '1h'|'6h'|'12h'|'24h'|'7d'|'30d'
   */
  async function getHistoricalData(range = '24h') {
    try {
      const res = await fetch('http://localhost:8000/api/weather/history?limit=48');
      if (res.ok) {
        const realHistory = await res.json();
        if (realHistory && realHistory.length > 0) {
          return realHistory.map(r => ({
            timestamp: r.timestamp,
            temperature: r.temperature,
            humidity: r.humidity,
            pressure: r.pressure,
            windSpeed: 10,
            aqi: r.air_quality,
            uvIndex: 4,
            rainfall: 0,
          }));
        }
      }
    } catch(e) { console.warn("Backend /weather/history failed, using mock", e); }

    await delay(MOCK_DELAY.medium);
    return MockData.getHistoricalData(range);
  }

  /**
   * Get notification history.
   */
  async function getNotifications() {
    await delay(MOCK_DELAY.fast);
    // return apiFetch(ENDPOINTS.notifications);
    return MockData.getNotifications();
  }

  /**
   * Get system analytics.
   */
  async function getSystemAnalytics() {
    await delay(MOCK_DELAY.fast);
    // return apiFetch(ENDPOINTS.analytics);
    return MockData.getSystemAnalytics();
  }

  /**
   * Ask the AI weather assistant.
   * @param {string} query
   * @param {object} iotData
   * @param {object} aiPrediction
   */
  async function askAssistant(query, iotData, aiPrediction) {
    await delay(800); // Simulate AI thinking
    // return apiFetch(ENDPOINTS.assistant, { method:'POST', body: JSON.stringify({ query, context: { iotData, aiPrediction } }) });
    return MockData.askAssistant(query, iotData, aiPrediction);
  }

  /**
   * Get AI prediction explanation.
   */
  async function getAIPredictionExplanation(prediction, current) {
    await delay(MOCK_DELAY.fast);
    return MockData.getAIPredictionExplanation(prediction, current);
  }

  /**
   * Get local vs external comparison.
   */
  async function getLocalVsExternal(iotCurrent, externalCurrent) {
    await delay(MOCK_DELAY.fast);
    return MockData.getLocalVsExternal(iotCurrent, externalCurrent);
  }

  return {
    getIoTData, getAIPrediction, getExternalWeather, searchLocations,
    getWeatherScore, getDeviceHealth, getAnomalies, getModelPerformance,
    getAIVsActual, getHistoricalData, getNotifications, getSystemAnalytics,
    askAssistant, getAIPredictionExplanation, getLocalVsExternal,
    ENDPOINTS,
  };
})();

window.API = API;
