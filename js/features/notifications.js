'use strict';
// ============================================================
// WeatherIQ — Notifications Manager
// Manages notification state, browser push, and history.
// ============================================================

const NotificationsManager = (() => {
  let _notifications = [];
  let _listeners = [];
  let _settings = {
    enabled: true,
    browserPush: false,
    rain: true,
    aqi: true,
    temperature: true,
    uv: true,
    wind: true,
    pressure: true,
    iotOffline: true,
    thresholds: {
      rain: 60,
      aqi: 100,
      temperatureHigh: 38,
      temperatureLow: 5,
      uv: 8,
      wind: 40,
      pressureChange: 6,
    },
  };
  let _lastChecked = {};

  function loadSettings() {
    try {
      const s = localStorage.getItem('wiq-notif-settings');
      if (s) Object.assign(_settings, JSON.parse(s));
    } catch {}
  }

  function saveSettings() {
    localStorage.setItem('wiq-notif-settings', JSON.stringify(_settings));
  }

  function loadHistory() {
    try {
      const h = localStorage.getItem('wiq-notif-history');
      return h ? JSON.parse(h) : [];
    } catch { return []; }
  }

  function saveHistory(notifications) {
    try {
      localStorage.setItem('wiq-notif-history', JSON.stringify(notifications.slice(0, 50)));
    } catch {}
  }

  function getUnreadCount() {
    return _notifications.filter(n => !n.read).length;
  }

  function emit() {
    _listeners.forEach(fn => fn(_notifications, getUnreadCount()));
  }

  function onUpdate(fn) {
    _listeners.push(fn);
  }

  function init(initialNotifications) {
    loadSettings();
    const stored = loadHistory();
    _notifications = stored.length > 0 ? stored : (initialNotifications || []);
    emit();
  }

  function add(notification) {
    const notif = {
      id:       Date.now(),
      category: notification.category || 'weather',
      icon:     notification.icon || '📊',
      title:    notification.title,
      message:  notification.message,
      time:     new Date(),
      read:     false,
      severity: notification.severity || 'info',
    };
    _notifications.unshift(notif);
    if (_notifications.length > 50) _notifications = _notifications.slice(0, 50);
    saveHistory(_notifications);
    emit();

    // Browser push notification
    if (_settings.browserPush && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`WeatherIQ — ${notif.title}`, {
          body: notif.message,
          icon: '/favicon.ico',
          tag:  `wiq-${notif.category}`,
        });
      } catch {}
    }
  }

  function markRead(id) {
    const notif = _notifications.find(n => n.id === id);
    if (notif) { notif.read = true; saveHistory(_notifications); emit(); }
  }

  function markAllRead() {
    _notifications.forEach(n => n.read = true);
    saveHistory(_notifications);
    emit();
  }

  function clearAll() {
    _notifications = [];
    saveHistory(_notifications);
    emit();
  }

  function getAll() { return _notifications; }

  function getSettings() { return { ..._settings }; }

  function updateSettings(newSettings) {
    Object.assign(_settings, newSettings);
    saveSettings();
  }

  async function requestBrowserPermission() {
    if (!('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    const granted = perm === 'granted';
    _settings.browserPush = granted;
    saveSettings();
    return granted;
  }

  /**
   * Check IoT data against thresholds and add alerts if needed.
   * Call this on each IoT data refresh.
   */
  function checkThresholds(iotData) {
    if (!_settings.enabled || !iotData?.current) return;
    const c = iotData.current;
    const now = Date.now();
    const cooldown = 10 * 60 * 1000; // 10 min

    const check = (key, condition, notif) => {
      if (!_settings[key]) return;
      if (condition && (!_lastChecked[key] || now - _lastChecked[key] > cooldown)) {
        _lastChecked[key] = now;
        add(notif);
      }
    };

    check('rain',        c.rainProbability > _settings.thresholds.rain,
      { category:'weather', icon:'🌧️', title:'High Rain Probability', message:`Rain probability is ${c.rainProbability}% — consider carrying an umbrella.`, severity:'warning' });

    check('aqi',         c.aqi > _settings.thresholds.aqi,
      { category:'sensor', icon:'🫁', title:'Air Quality Alert', message:`AQI reached ${c.aqi} — ${c.aqiInfo?.label || 'Unhealthy'}. Limit outdoor exposure.`, severity:'warning' });

    check('temperature', c.temperature > _settings.thresholds.temperatureHigh,
      { category:'weather', icon:'🌡️', title:'High Temperature Alert', message:`Temperature is ${c.temperature}°C. Stay hydrated and avoid prolonged sun exposure.`, severity:'warning' });

    check('uv',          c.uvIndex > _settings.thresholds.uv,
      { category:'weather', icon:'☀️', title:'High UV Index', message:`UV Index is ${c.uvIndex}. Apply SPF 50+ sunscreen.`, severity:'advisory' });

    check('wind',        c.windSpeed > _settings.thresholds.wind,
      { category:'weather', icon:'💨', title:'Strong Wind', message:`Wind speed at ${c.windSpeed} km/h. Secure loose outdoor items.`, severity:'warning' });

    check('iotOffline',  iotData.status === 'offline',
      { category:'iot', icon:'📡', title:'IoT Device Offline', message:'Weather station WX-IOT-001 is not responding. Data may be stale.', severity:'error' });
  }

  return {
    init, add, markRead, markAllRead, clearAll, getAll, onUpdate,
    getUnreadCount, getSettings, updateSettings, requestBrowserPermission,
    checkThresholds,
  };
})();

window.NotificationsManager = NotificationsManager;
