'use strict';
// ============================================================
// WeatherIQ — PWA Support Module
// Service Worker registration, install prompt, offline detection.
// ============================================================

const PWAManager = (() => {
  let _deferredInstallPrompt = null;
  let _isOnline = navigator.onLine;
  let _onlineListeners = [];
  let _offlineListeners = [];
  let _installListeners = [];

  function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(reg => {
          console.log('[WeatherIQ PWA] Service Worker registered:', reg.scope);
        })
        .catch(err => {
          // SW optional — app works without it
          console.warn('[WeatherIQ PWA] Service Worker registration failed:', err.message);
        });
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _deferredInstallPrompt = e;
      _installListeners.forEach(fn => fn(true));
    });

    window.addEventListener('appinstalled', () => {
      _deferredInstallPrompt = null;
      _installListeners.forEach(fn => fn(false));
    });

    // Online / offline detection
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  function handleOnline() {
    _isOnline = true;
    _onlineListeners.forEach(fn => fn());
  }

  function handleOffline() {
    _isOnline = false;
    _offlineListeners.forEach(fn => fn());
  }

  async function promptInstall() {
    if (!_deferredInstallPrompt) return false;
    _deferredInstallPrompt.prompt();
    const { outcome } = await _deferredInstallPrompt.userChoice;
    _deferredInstallPrompt = null;
    return outcome === 'accepted';
  }

  function isInstallable() { return !!_deferredInstallPrompt; }
  function isOnline()      { return _isOnline; }

  function onOnline(fn)   { _onlineListeners.push(fn); }
  function onOffline(fn)  { _offlineListeners.push(fn); }
  function onInstallable(fn) { _installListeners.push(fn); }

  return { init, promptInstall, isInstallable, isOnline, onOnline, onOffline, onInstallable };
})();

window.PWAManager = PWAManager;
