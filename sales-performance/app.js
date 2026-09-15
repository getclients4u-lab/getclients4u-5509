// sales-performance/app.js — client-side port of the FRA Sales Performance System engine
// Understand → Measure → Improve → Sustain. Zero-dependency, runs fully in the browser.

(function () {
  'use strict';

  // ---------- helpers ----------
  function num(v, fb) { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : (fb || 0); }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  function money(n) {
    if (!Number.isFinite(n)) return '$0';
    const abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  }
  function $(s) { return document.querySelector(s); }

  const state = { mode: 'simple', result: null, lead: {} };
  const show = function (id) {
    ['#input', '#lead', '#results'].forEach(function (x) { const el = $(x); if (el) el.classList.add('hidden'); });
    const el = $(id); if (el) el.classList.remove('hidden');
  };

  function track(type, extra) {
    try {
      const data = Object.assign({ type: type, page: location.pathname }, extra || {});
      try { window.va('event', { name: type, data: data }); } catch (_) {}
      try { fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(function () {}); } catch (_) {}
    } catch (_) {}
  }

  // ---------- engine ----------
  function analyzeCohort(reps, marginRate) {
    const roster = (reps || [])
      .map(function (r, i) { return { name: (r.name || 'Rep ' + (i + 1)), revenue: num(r.revenue) }; })
      .filter(function (r) { return r.revenue > 0; });

    if (roster.length < 4) {
      return { ok: false, error: 'Need at least 4 sellers with revenue to build a performance distribution.', repCount: roster.length };
    }

    const revenues = roster.map(function (r) { return r.revenue; });
    const sorted = roster.slice().sort(function (a, b) { return b.revenue - a.revenue; });
    const n = sorted.length;

    const q4cut = Math.max(1, Math.round(n * 0.25));
    const q2cut = Math.max(q4cut + 1, Math.round(n * 0.75));

    const top = sorted.slice(0, q4cut);
    const middle = sorted.slice(q4cut, q2cut);
    const bottom = sorted.slice(q2cut);

    const topAvg = mean(top.map(function (r) { return r.revenue; }));
    const midAvg = mean(middle.map(function (r) { return r.revenue; }));
    const bottomAvg = mean(bottom.map(function (r) { return r.revenue; }));
    const overallAvg = mean(revenues);

    const gapVsAverage = overallAvg > 0 ? (topAvg - overallAvg) / overallAvg : 0;
    const gapVsBottom = bottomAvg > 0 ? (topAvg - bottomAvg) / bottomAvg : 0;

    const model = [0.01, 0.05, 0.10].map(function (p) {
      const incRev = overallAvg * n * p;
      const incProfit = marginRate != null ? incRev * num(marginRate) : null;
      return {
        lift: p,
        liftLabel: Math.round(p * 100) + '%',
        incrementalRevenue: Math.round(incRev),
        incrementalRevenueLabel: money(incRev),
        incrementalProfit: incProfit != null ? Math.round(incProfit) : null,
        incrementalProfitLabel: incProfit != null ? money(incProfit) : null
      };
    });

    return {
      ok: true,
      repCount: n,
      averageRevenue: Math.round(overallAvg),
      averageRevenueLabel: money(overallAvg),
      distribution: {
        topQuartile: { count: top.length, average: Math.round(topAvg), label: money(topAvg), members: top.map(function (r) { return r.name; }) },
        middle: { count: middle.length, average: Math.round(midAvg), label: money(midAvg) },
        bottomQuartile: { count: bottom.length, average: Math.round(bottomAvg), label: money(bottomAvg) }
      },
      spread: {
        topVsAverage: Math.round(gapVsAverage * 1000) / 10,
        topVsBottom: Math.round(gapVsBottom * 1000) / 10
      },
      improvementModel: model
    };
  }

  function scoreBand(composite) {
    if (composite >= 80) return { label: 'Systemized', stage: 'Best practice is repeatable and self-sustaining' };
    if (composite >= 60) return { label: 'Diffusing', stage: 'Proven practice is spreading, not yet standardized' };
    if (composite >= 40) return { label: 'Emerging', stage: 'A real gap is identified and quantified' };
    return { label: 'Unaudited', stage: 'Not enough data to measure yet' };
  }

  function runAssessment(input) {
    const cohort = analyzeCohort(input.reps, input.marginRate);
    if (!cohort.ok) return { ok: false, error: cohort.error, repCount: cohort.repCount };

    const top = cohort.distribution.topQuartile.average;
    const bottom = cohort.distribution.bottomQuartile.average;
    const avg = cohort.averageRevenue;
    const topVsAvg = cohort.spread.topVsAverage;

    // Composite score — a proxy that rewards a quantified, meaningful gap and penalizes missing data.
    let composite = 40;
    if (cohort.repCount >= 10) composite += 15; else if (cohort.repCount >= 6) composite += 10;
    if (topVsAvg >= 15) composite += 25; else if (topVsAvg >= 8) composite += 15; else if (topVsAvg >= 3) composite += 8;
    if (input.marginRate != null) composite += 8;
    composite = Math.max(0, Math.min(100, composite));

    const band = scoreBand(composite);
    const five = cohort.improvementModel.find(function (m) { return m.lift === 0.05; });
    const ten = cohort.improvementModel.find(function (m) { return m.lift === 0.10; });

    const findings = [];
    if (topVsAvg >= 15) findings.push({ severity: 'high', text: 'Your top quartile performs ' + topVsAvg + '% above the overall average (' + cohort.distribution.topQuartile.label + ' vs ' + cohort.averageRevenueLabel + '). That gap is your hidden growth opportunity.' });
    else if (topVsAvg >= 3) findings.push({ severity: 'med', text: 'Your top quartile performs ' + topVsAvg + '% above the overall average — a meaningful but not extreme gap, with room to close it.' });
    else findings.push({ severity: 'good', text: 'Your team performs very consistently (top quartile only ' + topVsAvg + '% above average). The opportunity is raising the ceiling, not just the floor.' });
    findings.push({ severity: 'opp', text: 'A 5% shift of your average seller toward demonstrated top-performer behavior is worth ' + five.incrementalRevenueLabel + ' in incremental revenue' + (five.incrementalProfitLabel ? ' (' + five.incrementalProfitLabel + ' at your margin)' : '') + '.' });

    return {
      ok: true,
      composite: composite,
      band: band,
      repCount: cohort.repCount,
      averageRevenueLabel: cohort.averageRevenueLabel,
      distribution: cohort.distribution,
      improvementModel: cohort.improvementModel,
      five: five, ten: ten,
      topVsAverage: topVsAvg,
      findings: findings,
      topAvg: top, bottomAvg: bottom
    };
  }

  // ---------- input parsing ----------
  function parseRoster(text) {
    return text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      const parts = l.split(/[,\t]/).map(function (s) { return s.trim(); });
      return { name: parts[0] || 'Rep', revenue: parseFloat(parts[1]) || 0 };
    });
  }

  function simpleToRoster(headcount, avgRevenue, topRevenue) {
    const reps = [];
    const hc = Math.max(4, Math.round(num(headcount)));
    const avg = num(avgRevenue);
    const top = num(topRevenue);
    for (let i = 0; i < hc; i++) reps.push({ name: 'Seller ' + (i + 1), revenue: avg });
    if (top > avg && reps.length) reps[0] = { name: 'Top performer', revenue: top };
    return reps;
  }

  // ---------- UI wiring ----------
  function bindModeToggle() {
    document.querySelectorAll('#modeToggle button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.mode = b.getAttribute('data-mode');
        document.querySelectorAll('#modeToggle button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        $('#simpleMode').classList.toggle('hidden', state.mode !== 'simple');
        $('#rosterMode').classList.toggle('hidden', state.mode !== 'roster');
      });
    });
  }

  function collectInput() {
    const accountName = ($('#accountName').value || '').trim() || 'Your Organization';
    const marginArg = $('#marginRate').value;
    const marginRate = marginArg !== '' ? parseFloat(marginArg) : null;

    if (state.mode === 'roster') {
      const roster = parseRoster($('#roster').value);
      return { accountName: accountName, marginRate: (marginRate != null && !isNaN(marginRate)) ? marginRate : null, reps: roster };
    }
    const headcount = num($('#headcount').value);
    const avgRevenue = num($('#avgRevenue').value);
    const topRevenue = num($('#topRevenue').value);
    return {
      accountName: accountName,
      marginRate: (marginRate != null && !isNaN(marginRate)) ? marginRate : null,
      reps: simpleToRoster(headcount, avgRevenue, topRevenue)
    };
  }

  function renderResults(r) {
    show('#results');
    $('#resultTitle').textContent = r.band.label + ' — ' + r.repCount + ' sellers analyzed';
    $('#overallScore').textContent = r.composite;
    $('#band').textContent = r.band.label;
    $('#stage').textContent = r.band.stage;
    $('#interpretation').textContent = 'Your team\'s top quartile averages ' + r.distribution.topQuartile.label + ', while the overall average is ' + r.averageRevenueLabel + '.';

    // KPI cards
    $('#kpis').innerHTML =
      '<div class="kpi highlight"><div class="kpi-v">' + r.distribution.topQuartile.label + '</div><div class="kpi-l">Top Quartile Avg</div></div>' +
      '<div class="kpi"><div class="kpi-v">' + r.averageRevenueLabel + '</div><div class="kpi-l">Overall Average</div></div>' +
      '<div class="kpi highlight"><div class="kpi-v">' + r.five.incrementalRevenueLabel + '</div><div class="kpi-l">5% Shift Value</div></div>';
    $('#kpiNote').textContent = 'This is the value of incremental movement across the performance curve — not a promise to make every seller a top performer.';

    // Distribution
    const d = r.distribution;
    $('#distribution').innerHTML =
      '<div class="bar-row"><div class="bar-label"><b>Top quartile</b><span>' + d.topQuartile.label + ' (' + d.topQuartile.count + ')</span></div><div class="bar"><i style="width:100%"></i></div></div>' +
      '<div class="bar-row"><div class="bar-label"><b>Middle</b><span>' + d.middle.label + ' (' + d.middle.count + ')</span></div><div class="bar"><i style="width:' + Math.round((d.middle.average / Math.max(1, d.topQuartile.average)) * 100) + '%"></i></div></div>' +
      '<div class="bar-row"><div class="bar-label"><b>Bottom quartile</b><span>' + d.bottomQuartile.label + ' (' + d.bottomQuartile.count + ')</span></div><div class="bar"><i style="width:' + Math.round((d.bottomQuartile.average / Math.max(1, d.topQuartile.average)) * 100) + '%"></i></div></div>';

    // Improvement model
    $('#improvement').innerHTML = r.improvementModel.map(function (m) {
      return '<div class="bar-row"><div class="bar-label"><b>' + m.liftLabel + ' shift</b><span>' + m.incrementalRevenueLabel + (m.incrementalProfitLabel ? ' (' + m.incrementalProfitLabel + ' profit)' : '') + '</span></div><div class="bar"><i style="width:' + Math.round(m.lift * 1000) + '%"></i></div></div>';
    }).join('');
    $('#improvementNote').textContent = 'Movement of the average seller toward demonstrated top-performer level.';

    // Findings
    $('#findings').innerHTML = r.findings.map(function (f) {
      const cls = f.severity === 'high' ? 'f-high' : f.severity === 'good' ? 'f-good' : f.severity === 'opp' ? 'f-opp' : 'f-med';
      return '<li class="' + cls + '">' + f.text + '</li>';
    }).join('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    track('sales_perf_completed', { score: r.composite, band: r.band.label });
  }

  $('#runBtn').addEventListener('click', function () {
    const input = collectInput();
    const result = runAssessment(input);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    state.result = result;
    state.lead = {};
    show('#lead');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    track('sales_perf_run', { mode: state.mode, reps: result.repCount });
  });

  $('#skipLead').addEventListener('click', function () { renderResults(state.result); });
  $('#leadForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.lead = Object.fromEntries(fd.entries());
    if (state.lead.email && state.lead.consent) {
      track('lead_submitted', { text: 'sales-performance', score: state.result.composite, band: state.result.band.label });
      fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: state.lead, assessment: 'sales-performance', overall: state.result.composite, band: state.result.band.label })
      }).catch(function () {});
    }
    renderResults(state.result);
  });

  $('#restart').addEventListener('click', function () { location.reload(); });

  bindModeToggle();
})();
