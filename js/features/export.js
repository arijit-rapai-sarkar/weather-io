'use strict';
// ============================================================
// WeatherIQ — Data Export Module
// Supports CSV, JSON, and PDF (via print) export.
// ============================================================

const DataExporter = (() => {

  function formatTimestamp(ts) {
    return new Date(ts).toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ── CSV Export ──────────────────────────────────────────────
  function historyToCSV(history, filename = 'weatheriq-history.csv') {
    if (!history || history.length === 0) {
      alert('No data available to export.');
      return;
    }

    const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Pressure (hPa)',
      'Wind Speed (km/h)', 'AQI', 'UV Index', 'Rainfall (mm)'];

    const rows = history.map(h => [
      formatTimestamp(h.timestamp),
      h.temperature ?? '',
      h.humidity ?? '',
      h.pressure ?? '',
      h.windSpeed ?? '',
      h.aqi ?? '',
      h.uvIndex ?? '',
      h.rainfall ?? 0,
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    downloadBlob(csv, filename, 'text/csv;charset=utf-8;');
  }

  // ── JSON Export ─────────────────────────────────────────────
  function exportJSON(data, filename = 'weatheriq-data.json') {
    const json = JSON.stringify(data, null, 2);
    downloadBlob(json, filename, 'application/json');
  }

  // ── Full data package export ─────────────────────────────────
  function exportFullPackage(iotData, aiPrediction, externalWeather) {
    const pkg = {
      exportedAt: new Date().toISOString(),
      source: 'WeatherIQ v2.0',
      iotStation: {
        deviceId: iotData?.deviceId,
        location: iotData?.location,
        status:   iotData?.status,
        lastUpdate: iotData?.lastUpdate,
        current:  iotData?.current,
      },
      history: iotData?.history || [],
      aiPrediction: {
        modelVersion: aiPrediction?.modelVersion,
        confidence:   aiPrediction?.confidence,
        generated:    aiPrediction?.generated,
        hourly:       aiPrediction?.hourly || [],
        daily:        aiPrediction?.daily || [],
        summary:      aiPrediction?.summary,
      },
      externalWeather: externalWeather || null,
    };
    exportJSON(pkg, `weatheriq-full-export-${new Date().toISOString().slice(0, 10)}.json`);
  }

  // ── PDF Export (via print) ───────────────────────────────────
  function exportPDF(iotData, aiPrediction) {
    const c = iotData?.current || {};
    const loc = iotData?.location || {};
    const daily = aiPrediction?.daily || [];

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>WeatherIQ Report — ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1a1a2e; padding: 24px; max-width: 800px; margin: 0 auto; }
          h1 { color: #3B82F6; font-size: 24px; margin-bottom: 4px; }
          h2 { color: #475569; font-size: 16px; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-top: 24px; }
          .meta { color: #94A3B8; font-size: 13px; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 16px; }
          .stat { background: #F8FAFC; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; text-align: center; }
          .stat-label { font-size: 11px; color: #94A3B8; margin-bottom: 4px; }
          .stat-value { font-size: 20px; font-weight: 700; color: #1a1a2e; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #F1F5F9; padding: 8px 12px; text-align: left; font-weight: 600; color: #475569; }
          td { padding: 8px 12px; border-bottom: 1px solid #E2E8F0; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; }
          .badge-iot { background: #ECFDF5; color: #059669; }
          .badge-ai  { background: #F5F3FF; color: #7C3AED; }
          .footer { margin-top: 32px; color: #94A3B8; font-size: 11px; border-top: 1px solid #E2E8F0; padding-top: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>🌦️ WeatherIQ Intelligence Report</h1>
        <div class="meta">
          Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp;
          Station: ${iotData?.deviceId || 'WX-IOT-001'} &nbsp;|&nbsp;
          Location: ${loc.city || '—'}, ${loc.state || '—'}
        </div>

        <h2>Current Conditions <span class="badge badge-iot">● LIVE IoT</span></h2>
        <div class="grid">
          <div class="stat"><div class="stat-label">Temperature</div><div class="stat-value">${c.temperature || '—'}°C</div></div>
          <div class="stat"><div class="stat-label">Feels Like</div><div class="stat-value">${c.feelsLike || '—'}°C</div></div>
          <div class="stat"><div class="stat-label">Humidity</div><div class="stat-value">${c.humidity || '—'}%</div></div>
          <div class="stat"><div class="stat-label">Wind</div><div class="stat-value">${c.windSpeed || '—'} km/h</div></div>
          <div class="stat"><div class="stat-label">Pressure</div><div class="stat-value">${c.pressure || '—'} hPa</div></div>
          <div class="stat"><div class="stat-label">AQI</div><div class="stat-value">${c.aqi || '—'}</div></div>
          <div class="stat"><div class="stat-label">UV Index</div><div class="stat-value">${c.uvIndex || '—'}</div></div>
          <div class="stat"><div class="stat-label">Visibility</div><div class="stat-value">${c.visibility || '—'} km</div></div>
          <div class="stat"><div class="stat-label">Rainfall</div><div class="stat-value">${c.rainfallMm || 0} mm</div></div>
        </div>

        <h2>7-Day Forecast <span class="badge badge-ai">⬡ AI PREDICTED</span></h2>
        <table>
          <thead><tr><th>Day</th><th>Date</th><th>Condition</th><th>High</th><th>Low</th><th>Rain %</th><th>Wind</th></tr></thead>
          <tbody>
            ${daily.map(d => `<tr>
              <td>${d.day}</td><td>${d.date}</td><td>${d.condition?.replace('_',' ') || '—'}</td>
              <td>${d.high}°C</td><td>${d.low}°C</td>
              <td>${d.rainProbability}%</td><td>${d.wind} km/h</td>
            </tr>`).join('')}
          </tbody>
        </table>

        <h2>AI Summary <span class="badge badge-ai">⬡ AI PREDICTED</span></h2>
        <p>${aiPrediction?.summary || 'AI prediction summary not available.'}</p>
        <p style="font-size:12px;color:#94A3B8">Model: ${aiPrediction?.modelVersion || '—'} &nbsp;|&nbsp; Confidence: ${aiPrediction?.confidence || '—'}% &nbsp;|&nbsp; Data points: ${aiPrediction?.dataPoints?.toLocaleString() || '—'}</p>

        <div class="footer">
          WeatherIQ — AI + IoT Local Weather Intelligence Platform &nbsp;|&nbsp; Exported on ${new Date().toLocaleDateString('en-IN')}
        </div>
      </body>
      </html>`;

    const win = window.open('', '_blank', 'width=850,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.print(); }, 500);
    } else {
      alert('Please allow pop-ups to export PDF.');
    }
  }

  // ── Helper ──────────────────────────────────────────────────
  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { historyToCSV, exportJSON, exportFullPackage, exportPDF };
})();

window.DataExporter = DataExporter;
