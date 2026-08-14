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
   * Real call: apiFetch(ENDPOINTS.iotLatest)
   */
  async function getIoTData() {
    await delay(MOCK_DELAY.iot);
    // return apiFetch(ENDPOINTS.iotLatest);
    return MockData.getIoTData();
  }

  /**
   * Fetch the latest AI prediction.
   * Real call: apiFetch(ENDPOINTS.aiPrediction)
   */
  async function getAIPrediction() {
    await delay(MOCK_DELAY.ai);
    // return apiFetch(ENDPOINTS.aiPrediction);
    return MockData.getAIPrediction();
  }

  /**
   * Fetch weather for an external searched location.
   * @param {{ city, state, country, lat, lng }} locationObj
   */
  async function getExternalWeather(locationObj) {
    await delay(MOCK_DELAY.ext);
    // return apiFetch(`${ENDPOINTS.externalWeather}?lat=${locationObj.lat}&lng=${locationObj.lng}`);
    return MockData.getExternalWeather(locationObj);
  }

  /**
   * Search for locations matching a query string.
   * @param {string} query
   */
  async function searchLocations(query) {
    await delay(MOCK_DELAY.search);
    // return apiFetch(`${ENDPOINTS.searchLocation}?q=${encodeURIComponent(query)}`);
    return MockData.searchCities(query);
  }

  /**
   * Get weather score for current conditions.
   * @param {object} current — IoT current readings
   */
  async function getWeatherScore(current) {
    await delay(MOCK_DELAY.fast);
    // return apiFetch(ENDPOINTS.weatherScore, { method:'POST', body: JSON.stringify(current) });
    return MockData.getWeatherScore(current);
  }

  /**
   * Get IoT device health status.
   */
  async function getDeviceHealth(status) {
    await delay(MOCK_DELAY.fast);
    // return apiFetch(ENDPOINTS.deviceHealth);
    return MockData.getDeviceHealth(status);
  }

  /**
   * Get anomaly detection results.
   * @param {Array} history
   * @param {object} current
   */
  async function getAnomalies(history, current) {
    await delay(MOCK_DELAY.fast);
    // return apiFetch(ENDPOINTS.anomalies, { method:'POST', body: JSON.stringify({ history, current }) });
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
    await delay(MOCK_DELAY.medium);
    // return apiFetch(`${ENDPOINTS.historicalData}?range=${range}`);
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
