/* Ameer Fire and Safety — Employee, Leave, OT & Advance Management
   Frontend-only. All data is stored in this browser's localStorage. */
(function () {
  'use strict';

  /* ================= Constants ================= */
  var MENU_DEFAULTS = {
    dashboard: 'Dashboard', employees: 'Employees', leaves: 'Leave', ot: 'Employee OT', advances: 'Advance', holidays: 'Holidays',
    sepOutside: 'Outside Workers', outsiders: 'Outside Workers', outsiderWork: 'Outside Worker Work', outsiderLeave: 'Outside Worker Leave', outsiderOT: 'Outside Worker OT',
    sepOutput: 'Output', reports: 'Monthly Reports', activity: 'Activity Log', backup: 'Backup & Drive',
    tagline: 'Staff · Leave · OT · Advance', whoEmp: 'Company Employee', whoOut: 'Outside Employee'
  };
  var MENU_GROUPS = [['Main menu', ['dashboard', 'employees', 'leaves', 'ot', 'advances', 'holidays']], ['Outside workers section', ['sepOutside', 'outsiders', 'outsiderWork', 'outsiderLeave', 'outsiderOT']],
    ['Output section', ['sepOutput', 'reports', 'activity', 'backup']], ['Other labels', ['tagline', 'whoEmp', 'whoOut']]];
  var MENU_HINT = { sepOutside: 'Section heading', sepOutput: 'Section heading', tagline: 'Small text under company name', whoEmp: 'Leave page switch', whoOut: 'Leave page switch' };
  function normMenu(m) {
    var r = {};
    if (!m || typeof m !== 'object') return r;
    Object.keys(MENU_DEFAULTS).forEach(function (k) {
      var v = String(m[k] == null ? '' : m[k]).trim().replace(/\s+/g, ' ').slice(0, 30);
      if (v && v !== MENU_DEFAULTS[k]) r[k] = v;
    });
    return r;
  }
  function menuLabel(k) { var m = db.appSettings && db.appSettings.menuLabels; return (m && m[k]) || MENU_DEFAULTS[k]; }
  var DEFAULT_COMPANY = 'Ameer Fire and Safety';
  var COMPANY = DEFAULT_COMPANY;
  var DRIVE_URL = 'https://drive.google.com/drive/folders/12FOBPx6i20ETWm7WgNl1muJILucahRjl?usp=drive_link';
  var DATA_KEYS = ['employees', 'leaves', 'employeeOT', 'advances', 'outsideWorkers', 'outsideWorkerWork', 'outsideWorkerLeave', 'outsideWorkerOT', 'holidays'];
  var ALL_KEYS = DATA_KEYS.concat(['appSettings']);
  var OT_TYPES = { normal: 'Normal Hour OT', sunday: 'Sunday / Special OT', night: 'Night OT' };
  var DEFAULT_SETTINGS = { currency: 'AED', lastBackup: null, driveUrl: DRIVE_URL, companyName: DEFAULT_COMPANY, companyLogo: '' };
  function normCompany(n) { n = String(n == null ? '' : n).trim().replace(/\s+/g, ' ').slice(0, 60); return n || DEFAULT_COMPANY; }
  function normLogo(l) { return typeof l === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(l) && l.length < 600000 ? l : ''; }
  function normDrive(u) {
    u = String(u == null ? '' : u).trim();
    return /^https:\/\/(drive|docs)\.google\.com\/\S+$/i.test(u) ? u : DRIVE_URL;
  }
  function driveUrl() { return normDrive(db.appSettings && db.appSettings.driveUrl); }
  var MAX_HOURS = 24;
  var LEAVE_BUILTIN = [['Full Day', 'Full Day (1 day)'], ['Half Day', 'Half Day (0.5 day)']];
  function emptyOptions() { return { leaveTypes: [], otTypes: [], workerOtTypes: [], sources: [], hiddenSrc: [] }; }
  var DEFAULT_LABELS = { normal: 'Normal OT', sunday: 'Sunday OT', src1: 'National', src2: 'Others' };
  function normLabels(l) {
    var r = Object.assign({}, DEFAULT_LABELS);
    if (l && typeof l === 'object') {
      Object.keys(DEFAULT_LABELS).forEach(function (k) {
        var v = String(l[k] == null ? '' : l[k]).trim().replace(/\s+/g, ' ').slice(0, 40);
        if (v) r[k] = v;
      });
    }
    if (r.normal.toLowerCase() === r.sunday.toLowerCase()) { r.normal = DEFAULT_LABELS.normal; r.sunday = DEFAULT_LABELS.sunday; }
    if (r.src1.toLowerCase() === r.src2.toLowerCase()) { r.src1 = DEFAULT_LABELS.src1; r.src2 = DEFAULT_LABELS.src2; }
    return r;
  }
  function normWeekly(w) {
    if (!Array.isArray(w)) return [0];
    var out = [];
    w.forEach(function (x) { x = Number(x); if (isFinite(x) && x >= 0 && x <= 6 && x % 1 === 0 && out.indexOf(x) === -1) out.push(x); });
    return out.sort();
  }
  function defaultSettings() { var s = Object.assign({}, DEFAULT_SETTINGS); s.options = emptyOptions(); s.labels = normLabels(); s.weeklyOff = [0]; s.menuLabels = {}; return s; }
  function normOptions(o) {
    var r = emptyOptions();
    if (!o || typeof o !== 'object') return r;
    function nm(x) { return String(x == null ? '' : x).trim().replace(/\s+/g, ' ').slice(0, 40); }
    (Array.isArray(o.leaveTypes) ? o.leaveTypes : []).forEach(function (x) {
      if (!x || typeof x !== 'object') return;
      var n = nm(x.name), d = Number(x.days);
      if (n && isFinite(d) && d > 0 && d <= 1) r.leaveTypes.push({ name: n, days: d });
    });
    ['otTypes', 'workerOtTypes'].forEach(function (k) {
      (Array.isArray(o[k]) ? o[k] : []).forEach(function (x) {
        if (!x || typeof x !== 'object') return;
        var n = nm(x.name), id = String(x.id || '');
        if (n && id) r[k].push({ id: id, name: n });
      });
    });
    (Array.isArray(o.sources) ? o.sources : []).forEach(function (x) { var n = nm(x); if (n) r.sources.push(n); });
    (Array.isArray(o.hiddenSrc) ? o.hiddenSrc : []).forEach(function (k) { if ((k === 'src1' || k === 'src2') && r.hiddenSrc.indexOf(k) === -1) r.hiddenSrc.push(k); });
    return r;
  }
  var VIEWS = ['dashboard', 'employees', 'leaves', 'ot', 'advances', 'holidays', 'outsiders', 'outsiderWork', 'outsiderLeave', 'outsiderOT', 'reports', 'activity', 'backup'];
  var TITLES = {
    dashboard: 'Dashboard', employees: 'Employees', leaves: 'Leave Management', ot: 'Employee OT',
    advances: 'Advances', holidays: 'Holidays', outsiders: 'Outside Workers', outsiderWork: 'Outside Worker Work', outsiderLeave: 'Outside Worker Leave', outsiderOT: 'Outside Worker OT',
    reports: 'Monthly Reports', activity: 'Activity & Last Updated', backup: 'Backup & Google Drive'
  };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ================= Icons ================= */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    coin: '<circle cx="12" cy="12" r="10"/><path d="M14.5 9a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2A2.5 2 0 0 1 9.5 15M12 6v1.5M12 16.5V18"/>',
    hardhat: '<path d="M2 18h20v2H2zM4 18a8 8 0 0 1 16 0M10 6v5M14 6v5M12 4v7"/>',
    report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
    flame: '<path d="M12 2c1 4-3 6-4.5 9.5C6 15 8 20 12 22c4-2 6-7 4.5-10.5-.8-1.7-2-2.8-2.7-4.5C13 8 12.5 5 12 2z"/>'
  };
  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  /* ================= Helpers ================= */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function monthNow() { return todayStr().slice(0, 7); }
  function fmtNum(n) { return r2(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function money(n) {
    return esc(db.appSettings.currency || '') + ' ' + r2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(s) {
    var p = String(s || '').split('-');
    if (p.length !== 3) return esc(s || '—');
    return p[2] + ' ' + MONTHS[Number(p[1]) - 1].slice(0, 3) + ' ' + p[0];
  }
  function isDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    var a = s.split('-').map(Number), dt = new Date(a[0], a[1] - 1, a[2]);
    return a[0] >= 2000 && a[0] <= 2100 && dt.getFullYear() === a[0] && dt.getMonth() === a[1] - 1 && dt.getDate() === a[2];
  }
  function vm(m) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '') ? m : ''; }
  function monthLabel(m) { var p = m.split('-'); return MONTHS[Number(p[1]) - 1] + ' ' + p[0]; }
  function periodLabel(m) { return m ? monthLabel(m) : 'All months'; }
  function inMonth(rec, m) { return !m || String(rec.date || '').slice(0, 7) === m; }
  function matchQ(q) {
    var s = String(q || '').trim().toLowerCase();
    if (!s) return true;
    var hay = Array.prototype.slice.call(arguments, 1).join(' ').toLowerCase();
    return hay.indexOf(s) !== -1;
  }
  function byName(a, b) { return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }); }
  function byDateDesc(a, b) {
    return (b.date || '').localeCompare(a.date || '') || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  }
  function group(list, keyFn) {
    var m = new Map();
    list.forEach(function (x) { var k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
    return m;
  }
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function dayOfWeek(s) { var p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]).getDay(); }
  function holidayInfo(date) {
    if (!date || !db.appSettings) return null;
    var special = (db.holidays || []).find(function (h) { return h.date === date; });
    var dow = dayOfWeek(date), weekly = (db.appSettings.weeklyOff || []).indexOf(dow) !== -1;
    if (!special && !weekly) return null;
    return { name: special ? special.name : WEEKDAYS[dow], weekly: weekly, special: !!special };
  }
  function isHoliday(date) { return !!holidayInfo(date); }
  function notHoliday(r) { return !isHoliday(r.date); }
  function dcell(date) {
    var h = holidayInfo(date);
    return fmtDate(date) + (h ? ' <span class="badge b-holiday">Holiday</span><span class="sub">' + esc(h.name) + '</span>' : '');
  }
  function otherEntry(coll, workerId, date, excludeId) {
    return db[coll].find(function (x) { return x.workerId === workerId && x.date === date && x.id !== excludeId; });
  }
  function clashMsg(workerId, date, what) {
    return workerName(workerId) + ' already has a ' + what + ' entry on ' + fmtDate(date) + '. A worker cannot have work and leave on the same day.';
  }
  function skipNote(skipped, holi, clash) {
    var p = [];
    if (clash) p.push(clash + ' skipped — same worker already has ' + (clash === 1 ? 'a ' : '') + 'work/leave entry that day');
    if (holi) p.push(holi + ' holiday(s) skipped');
    if (skipped) p.push(skipped + ' already existed and were skipped');
    return p.length ? ' (' + p.join(', ') + ')' : '';
  }
  function leaveDays(l) {
    if (l.date && isHoliday(l.date)) return 0;
    if (l.type === 'Half Day') return 0.5;
    if (l.type === 'Full Day') return 1;
    var c = ((db.appSettings && db.appSettings.options && db.appSettings.options.leaveTypes) || []).find(function (x) { return x.name === l.type; });
    return c ? (Number(c.days) || 1) : 1;
  }
  function sumOT(list) {
    var r = { normal: 0, sunday: 0, other: 0, holiday: 0, total: 0 };
    list.forEach(function (o) {
      var h = Number(o.hours) || 0;
      r[(o.type === 'normal' || o.type === 'sunday') ? o.type : 'other'] += h;
      if (isHoliday(o.date)) r.holiday += h;
    });
    r.normal = r2(r.normal); r.sunday = r2(r.sunday); r.other = r2(r.other); r.holiday = r2(r.holiday);
    r.total = r2(r.normal + r.sunday + r.other);
    return r;
  }
  function sumAdv(list) { return r2(list.reduce(function (s, a) { return s + (Number(a.amount) || 0); }, 0)); }
  function sumLeave(list) { return r2(list.reduce(function (s, l) { return s + leaveDays(l); }, 0)); }

  /* ================= Storage ================= */
  var db = {};
  function defaultFor(k) { return k === 'appSettings' ? defaultSettings() : []; }
  function loadKey(k) {
    try {
      var raw = localStorage.getItem(k);
      if (raw == null) return defaultFor(k);
      var v = JSON.parse(raw);
      if (k === 'appSettings') {
        var st = Object.assign({}, DEFAULT_SETTINGS, (v && typeof v === 'object' && !Array.isArray(v)) ? v : {});
        st.options = normOptions(st.options);
        st.labels = normLabels(st.labels);
        st.weeklyOff = normWeekly(st.weeklyOff);
        st.driveUrl = normDrive(st.driveUrl);
        st.companyName = normCompany(st.companyName);
        st.companyLogo = normLogo(st.companyLogo);
        st.menuLabels = normMenu(st.menuLabels);
        return st;
      }
      return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object'; }) : [];
    } catch (e) { return defaultFor(k); }
  }
  function loadAll() { ALL_KEYS.forEach(function (k) { db[k] = loadKey(k); }); migrateLegacy(); }
  function migrateLegacy() {
    var s1 = db.appSettings.labels.src1, ch = false;
    db.outsideWorkers.forEach(function (w) { if (w.source === 'From Company') { w.source = s1; ch = true; } });
    if (ch) save('outsideWorkers');
  }
  /* ================= Activity tracking (automatic, read-only) ================= */
  var activity = null, suppressAct = 0;
  var ACT_NAMES = { leaves: 'Leave', employeeOT: 'Employee OT', advances: 'Advance', outsideWorkerWork: 'Outside Worker Work', outsideWorkerLeave: 'Outside Worker Leave', outsideWorkerOT: 'Outside Worker OT',
    employees: 'Employees', outsideWorkers: 'Outside Workers', holidays: 'Holidays', appSettings: 'Settings', backup: 'Backup', all: 'All data' };
  function normStamp(s) { s = String(s || ''); return /^\d{4}-\d{2}-\d{2}T/.test(s) && !isNaN(Date.parse(s)) ? s : ''; }
  function normActivity(a) {
    var r = { mods: {}, log: [], lastExport: null, lastImport: null };
    if (!a || typeof a !== 'object') return r;
    if (a.mods && typeof a.mods === 'object') Object.keys(ACT_NAMES).forEach(function (c) {
      var m = a.mods[c]; if (!m || typeof m !== 'object') return;
      ['add', 'edit', 'delete'].forEach(function (k) {
        var e = m[k], at = e && normStamp(e.at); if (!at) return;
        r.mods[c] = r.mods[c] || {}; r.mods[c][k] = { at: at, n: Math.max(1, Math.min(100000, Number(e.n) || 1)), by: String(e.by || '').slice(0, 40) };
      });
    });
    (Array.isArray(a.log) ? a.log : []).slice(0, 100).forEach(function (e) {
      var at = e && normStamp(e.at); if (!at || !ACT_NAMES[e.coll]) return;
      r.log.push({ at: at, coll: e.coll, action: String(e.action || '').slice(0, 12), n: Number(e.n) || 0, msg: String(e.msg || '').slice(0, 160), by: String(e.by || '').slice(0, 40) });
    });
    ['lastExport', 'lastImport'].forEach(function (k) {
      var e = a[k], at = e && normStamp(e.at);
      if (at) r[k] = { at: at, file: String(e.file || '').slice(0, 120), drive: !!e.drive, by: String(e.by || '').slice(0, 40) };
    });
    return r;
  }
  function act() {
    if (!activity) { try { activity = normActivity(JSON.parse(localStorage.getItem('activityLog'))); } catch (e) { activity = normActivity(null); } }
    return activity;
  }
  function saveActivity() { try { localStorage.setItem('activityLog', JSON.stringify(act())); } catch (e) { /* ignore */ } }
  function adminName() { return 'AMEERFIRE'; }
  function touch(coll, action, n, msg) {
    if (suppressAct) return;
    var a = act(), at = new Date().toISOString(), by = adminName(); n = n || 1;
    a.mods[coll] = a.mods[coll] || {};
    a.mods[coll][action] = { at: at, n: n, by: by };
    var top = a.log[0];
    if (top && top.coll === coll && top.action === action && top.msg === (msg || '') && Date.now() - Date.parse(top.at) < 30000) { top.at = at; top.n += (n || 0); }
    else a.log.unshift({ at: at, coll: coll, action: action, n: n, msg: msg || '', by: by });
    a.log = a.log.slice(0, 100);
    saveActivity();
  }
  function save(k) {
    if (k === 'appSettings') touch('appSettings', 'edit', 1, 'Settings changed');
    try { localStorage.setItem(k, JSON.stringify(db[k])); return true; }
    catch (e) { toast('Could not save — browser storage is full or blocked.', 'error'); return false; }
  }
  function storageWorks() {
    try { localStorage.setItem('__ameer_test', '1'); localStorage.removeItem('__ameer_test'); return true; }
    catch (e) { return false; }
  }

  /* ================= UI state ================= */
  var ui = { view: 'dashboard', f: {}, sel: {}, leaveWho: 'emp' };
  var FILTER_DEFAULTS = {
    dashboard: function () { return { month: monthNow() }; },
    employees: function () { return { q: '', status: '', dept: '' }; },
    leaves: function () { return { month: '', emp: '', type: '', q: '' }; },
    ot: function () { return { month: '', emp: '', type: '', q: '' }; },
    advances: function () { return { month: '', emp: '', q: '' }; },
    outsiders: function () { return { q: '', source: '', status: '' }; },
    holidays: function () { return { month: monthNow(), q: '' }; },
    outsiderWork: function () { return { month: '', worker: '', type: '', source: '', q: '' }; },
    outsiderLeave: function () { return { month: '', worker: '', type: '', source: '', q: '' }; },
    leavesOut: function () { return { month: '', worker: '', type: '', source: '', q: '' }; },
    outsiderOT: function () { return { month: '', worker: '', type: '', source: '', q: '' }; },
    reports: function () { return { month: monthNow(), emp: '', worker: '', source: '', q: '' }; }
  };
  Object.keys(FILTER_DEFAULTS).forEach(function (v) { ui.f[v] = FILTER_DEFAULTS[v](); });

  /* ================= Lookups ================= */
  function empById(id) { return db.employees.find(function (e) { return e.id === id; }); }
  function workerById(id) { return db.outsideWorkers.find(function (w) { return w.id === id; }); }
  function empName(id) { var e = empById(id); return e ? e.name : ''; }
  function empCode(id) { var e = empById(id); return e ? e.empId : ''; }
  function workerName(id) { var w = workerById(id); return w ? w.name : ''; }
  function workerCode(id) { var w = workerById(id); return w ? w.workerId : ''; }
  function empCell(id) {
    var e = empById(id);
    return e ? '<strong>' + esc(e.name) + '</strong><span class="sub">' + esc(e.empId) + '</span>' : '<em class="muted">Deleted employee</em>';
  }
  function workerCell(id) {
    var w = workerById(id);
    return w ? '<strong>' + esc(w.name) + '</strong><span class="sub">' + esc(w.workerId) + '</span>' : '<em class="muted">Deleted worker</em>';
  }
  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { x = String(x || '').trim(); if (x && !seen[x.toLowerCase()]) { seen[x.toLowerCase()] = 1; out.push(x); } });
    return out.sort(function (a, b) { return a.localeCompare(b); });
  }
  function departments() { return uniq(db.employees.map(function (e) { return e.department; })); }
  function designations() { return uniq(db.employees.map(function (e) { return e.designation; })); }

  /* ================= Toasts & modal ================= */
  function toast(msg, type) {
    type = type || 'success';
    var box = $('#toasts');
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.textContent = msg;
    box.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, type === 'error' ? 5200 : 3400);
  }
  var modalOnClose = null;
  function openModal(html, opts) {
    closeModal();
    opts = opts || {};
    var root = $('#modal-root');
    root.innerHTML = '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(opts.label || 'Dialog') + '">' + html + '</div></div>';
    root.classList.add('open');
    document.body.classList.add('modal-open');
    modalOnClose = opts.onClose || null;
    var first = root.querySelector('form input:not([type=hidden]), form select, form textarea, .btn-primary, .btn-danger');
    if (first) first.focus();
  }
  function closeModal() {
    var root = $('#modal-root');
    root.classList.remove('open');
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
    var cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
  }
  function confirmBox(o) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      openModal(
        '<div class="modal-head"><h3>' + esc(o.title) + '</h3><button type="button" class="icon-x" data-action="close-modal" aria-label="Close">&times;</button></div>' +
        '<div class="modal-body"><p class="confirm-msg">' + o.message + '</p></div>' +
        '<div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancel</button>' +
        '<button type="button" class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-modal-ok="1">' + esc(o.okText || 'Confirm') + '</button></div>',
        { label: o.title, onClose: function () { finish(false); } }
      );
      $('[data-modal-ok]', $('#modal-root')).addEventListener('click', function () { finish(true); closeModal(); });
    });
  }

  /* ================= Table + empty-state builders ================= */
  function unesc(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }
  function tbl(headers, rows, foot) {
    var selKind = '', selIds = [];
    if (headers[headers.length - 1] === 'Actions' && rows.length) {
      var allEdit = rows.every(function (r) {
        var m = /data-action="edit" data-kind="([^"]+)" data-id="([^"]*)"/.exec(String(r[r.length - 1]));
        if (!m) return false;
        selKind = m[1]; selIds.push(unesc(m[2]));
        return true;
      });
      if (!allEdit) { selKind = ''; selIds = []; }
    }
    var sel = {};
    if (selKind) {
      var prev = ui.sel[selKind] || {};
      selIds.forEach(function (id) { if (prev[id]) sel[id] = true; });
      ui.sel[selKind] = sel;
    }
    var allOn = !!selKind && selIds.length > 0 && selIds.every(function (id) { return sel[id]; });
    var th = (selKind ? '<th scope="col" class="selcol"><input type="checkbox" data-sel-all="' + selKind + '" aria-label="Select all rows"' + (allOn ? ' checked' : '') + '></th>' : '') +
      headers.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('');
    var body = rows.map(function (r, ri) {
      var cells = r.map(function (c, i) { return '<td data-label="' + esc(headers[i]) + '">' + c + '</td>'; }).join('');
      var on = !!selKind && !!sel[selIds[ri]];
      if (selKind) cells = '<td class="selcol" data-label="Select"><input type="checkbox" data-sel="' + selKind + '" data-id="' + esc(selIds[ri]) + '" aria-label="Select row"' + (on ? ' checked' : '') + '></td>' + cells;
      return '<tr' + (on ? ' class="selected"' : '') + '>' + cells + '</tr>';
    }).join('');
    var ft = foot ? '<tfoot><tr>' + (selKind ? '<td class="selcol"></td>' : '') + foot.map(function (c, i) { return '<td data-label="' + esc(headers[i]) + '">' + c + '</td>'; }).join('') + '</tr></tfoot>' : '';
    return '<div class="table-wrap"><table class="rt"><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody>' + ft + '</table></div>';
  }
  function cardOf(title, chip, inner) {
    var m = /data-sel-all="([^"]+)"/.exec(inner), kind = m ? m[1] : '', pick = '', bar = '';
    if (kind) {
      var n = Object.keys(ui.sel[kind] || {}).length, cfg = FORMS[kind], at = ' data-kind="' + kind + '"';
      pick = '<button type="button" class="btn btn-sm btn-ghost" data-action="bulk-all"' + at + '>Select all</button>';
      bar = '<div class="bulkbar' + (n ? '' : ' hidden') + '" data-bulkbar="' + kind + '"><strong class="bulk-count">' + n + ' selected</strong>' +
        (cfg && cfg.bulkNames ? '<button type="button" class="btn btn-sm btn-accent" data-action="bulk-edit"' + at + '>Edit selected</button>' : '') +
        '<button type="button" class="btn btn-sm btn-danger-o" data-action="bulk-delete"' + at + '>Delete selected</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-action="bulk-clear"' + at + '>Clear</button></div>';
    }
    return '<div class="card"><div class="card-head"><h3>' + esc(title) + '</h3><div class="head-right">' + (chip ? '<span class="chip">' + esc(chip) + '</span>' : '') + pick + '</div></div>' + bar + inner + '</div>';
  }
  function emptyState(title, text, btnLabel, kind) {
    return '<div class="empty"><div class="ico-big">' + svg('flame') + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
      (btnLabel ? '<button class="btn btn-primary" data-action="add" data-kind="' + kind + '">' + esc(btnLabel) + '</button>' : '') + '</div>';
  }
  function noMatch(view) {
    return '<div class="empty small"><p>No records match your filters.</p><button class="btn btn-sm" data-action="clear-filters" data-view="' + view + '">Clear Filters</button></div>';
  }
  function actions(kind, id) {
    var at = ' data-kind="' + kind + '" data-id="' + esc(id) + '"';
    return '<div class="row-actions"><button class="btn btn-sm" data-action="edit"' + at + '>Edit</button>' +
      '<button class="btn btn-sm" data-action="duplicate"' + at + '>Duplicate</button>' +
      '<button class="btn btn-sm btn-danger-o" data-action="delete"' + at + '>Delete</button></div>';
  }
  function statusBadge(s) { return '<span class="badge ' + (s === 'Active' ? 'b-active' : 'b-inactive') + '">' + esc(s || '—') + '</span>'; }
  function otLabel(t) {
    var Lb = db.appSettings.labels;
    if (t === 'normal') return Lb.normal;
    if (t === 'sunday') return Lb.sunday;
    if (t === 'night') return 'Night OT';
    var o = db.appSettings.options, hit = o.otTypes.concat(o.workerOtTypes).find(function (x) { return x.id === t; });
    return hit ? hit.name : 'Other';
  }
  function otBadge(t) { return '<span class="badge b-' + (t === 'normal' || t === 'sunday' || t === 'night' ? esc(t) : 'other') + '">' + esc(otLabel(t)) + '</span>'; }
  function leaveBadge(t) { return '<span class="badge ' + (leaveDays({ type: t }) < 1 ? 'b-half' : 'b-full') + '">' + esc(t) + '</span>'; }
  function otherOn(list, t) { return !!(t && t.other > 0); }
  function withCur(opts, cur, fn) {
    if (cur && !opts.some(function (o) { return o[0] === cur; })) return opts.concat([[cur, fn ? fn(cur) : cur]]);
    return opts;
  }
  function getOpts(list) {
    var o = (db.appSettings && db.appSettings.options) || emptyOptions(), Lb = db.appSettings.labels;
    if (list === 'leaveTypes') return LEAVE_BUILTIN.slice();
    var ot = [['normal', Lb.normal], ['sunday', Lb.sunday]];
    if (list === 'otTypes') return ot.concat((o.otTypes || []).map(function (x) { return [x.id, x.name]; }));
    if (list === 'workerOtTypes') return ot.concat((o.workerOtTypes || []).map(function (x) { return [x.id, x.name]; }));
    if (list === 'sources') {
      var hid = o.hiddenSrc || [], base = [];
      if (hid.indexOf('src1') === -1) base.push([Lb.src1, Lb.src1]);
      if (hid.indexOf('src2') === -1) base.push([Lb.src2, Lb.src2]);
      return base.concat((o.sources || []).filter(function (n) { return n !== Lb.src1 && n !== Lb.src2; }).map(function (n) { return [n, n]; }));
    }
    return [];
  }
  function stat(label, value, sub, cls) {
    return '<div class="stat ' + (cls || '') + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
  }
  function dash(v) { return v ? esc(v) : '<span class="muted">—</span>'; }

  /* ================= Views ================= */
  function renderDashboard() {
    var m = vm(ui.f.dashboard.month), Lb = db.appSettings.labels;
    var leaves = db.leaves.filter(function (l) { return inMonth(l, m); });
    var ot = sumOT(db.employeeOT.filter(function (o) { return inMonth(o, m); }));
    var oot = sumOT(db.outsideWorkerOT.filter(function (o) { return inMonth(o, m); }));
    var wdList = db.outsideWorkerWork.filter(function (x) { return inMonth(x, m); });
    var wlList = db.outsideWorkerLeave.filter(function (x) { return inMonth(x, m); });
    var adv = sumAdv(db.advances.filter(function (a) { return inMonth(a, m); }));
    var activeE = db.employees.filter(function (e) { return e.status === 'Active'; }).length;
    var activeW = db.outsideWorkers.filter(function (w) { return w.status === 'Active'; }).length;
    var isEmpty = !DATA_KEYS.some(function (k) { return db[k].length; });
    var html = '';
    if (isEmpty) {
      html += '<div class="empty"><div class="ico-big">' + svg('flame') + '</div><h3>Welcome to ' + esc(COMPANY) + '</h3>' +
        '<p>Nothing has been added yet. Start by adding your employees, or restore a previous backup.</p>' +
        '<div class="btn-row"><button class="btn btn-primary" data-action="add" data-kind="employees">+ Add First Employee</button>' +
        '<button class="btn" data-action="import-json">Import Backup</button></div></div>';
    }
    html += '<p class="period">Showing: <strong>' + esc(periodLabel(m)) + '</strong></p>';
    html += '<div class="stats">' +
      stat('Total Employees', fmtNum(db.employees.length), fmtNum(activeE) + ' active') +
      stat('Total Outside Workers', fmtNum(db.outsideWorkers.length), fmtNum(activeW) + ' active', 'd') +
      stat(m ? 'Monthly Leave Days' : 'Total Leave Days', fmtNum(sumLeave(leaves)), fmtNum(leaves.length) + ' leave record(s)') +
      stat(Lb.normal + ' Hours', fmtNum(ot.normal), 'Employees', 'y') +
      stat(Lb.sunday + ' Hours', fmtNum(ot.sunday), 'Employees', 'y') +
      (otherOn('otTypes', ot) ? stat('Other OT Hours', fmtNum(ot.other), 'Older records', 'y') : '') +
      (ot.holiday > 0 ? stat('Holiday OT Hours', fmtNum(ot.holiday), 'Included in total OT', 'y') : '') +
      stat('Total OT Hours', fmtNum(ot.total), 'Employees') +
      stat('Total Advance', money(adv), m ? 'Given in ' + esc(monthLabel(m)) : 'All time', 'd') +
      '</div>';
    html += cardOf('Outside Workers — Work & OT', periodLabel(m),
      '<div class="card-body"><div class="stats small" style="margin:0">' +
      stat('Work Days', fmtNum(sumLeave(wdList)), fmtNum(wdList.length) + ' entr' + (wdList.length === 1 ? 'y' : 'ies')) +
      stat('Leave Days', fmtNum(sumLeave(wlList)), fmtNum(wlList.length) + ' entr' + (wlList.length === 1 ? 'y' : 'ies')) +
      stat(Lb.normal, fmtNum(oot.normal), '', 'y') + stat(Lb.sunday, fmtNum(oot.sunday), '', 'y') +
      (otherOn('workerOtTypes', oot) ? stat('Other OT', fmtNum(oot.other), '', 'y') : '') +
      (oot.holiday > 0 ? stat('Holiday OT', fmtNum(oot.holiday), 'included in total', 'y') : '') +
      stat('Total', fmtNum(oot.total), 'hours') + '</div></div>');
    $('#dashboard-body').innerHTML = html;
  }

  function renderEmployees() {
    var f = ui.f.employees, all = db.employees;
    var rows = all.filter(function (e) {
      return (!f.status || e.status === f.status) && (!f.dept || (e.department || '') === f.dept) &&
        matchQ(f.q, e.empId, e.name, e.phone, e.designation, e.department, e.notes);
    }).sort(byName);
    $('#employees-count').textContent = all.length ? rows.length + ' of ' + all.length + ' employee(s) shown' : 'Manage your staff records.';
    var box = $('#employees-table');
    if (!all.length) { box.innerHTML = emptyState('No employees yet', 'Add your first employee to start tracking leave, overtime and advances.', '+ Add Employee', 'employees'); return; }
    if (!rows.length) { box.innerHTML = noMatch('employees'); return; }
    box.innerHTML = cardOf('Employee List', '', tbl(
      ['Employee ID', 'Name', 'Phone', 'Designation', 'Department', 'Joining Date', 'Status', 'Notes', 'Actions'],
      rows.map(function (e) {
        return [esc(e.empId), '<strong>' + esc(e.name) + '</strong>', dash(e.phone), dash(e.designation), dash(e.department),
          e.joiningDate ? fmtDate(e.joiningDate) : '<span class="muted">—</span>', statusBadge(e.status),
          '<span class="wrap">' + dash(e.notes) + '</span>', actions('employees', e.id)];
      })));
  }

  function renderLeaves() {
    var out = ui.leaveWho === 'out';
    $$('input[name="leaveWho"]').forEach(function (r) { r.checked = r.value === ui.leaveWho; });
    $('#leave-emp-pane').classList.toggle('hidden', out);
    $('#leave-out-pane').classList.toggle('hidden', !out);
    var ab = $('#leave-add-btn');
    ab.dataset.kind = out ? 'outsiderLeave' : 'leaves';
    ab.textContent = out ? '+ Add Outside Leave' : '+ Add Leave';
    ['outsiderLeave-summary', 'outsiderLeave-table'].forEach(function (id) { $('#' + id).innerHTML = ''; });
    if (out) { renderOutsiderLeave('leavesOut'); return; }
    ['leavesOut-summary', 'leavesOut-table'].forEach(function (id) { $('#' + id).innerHTML = ''; });
    var f = ui.f.leaves, m = vm(f.month);
    var box = $('#leaves-table'), sum = $('#leaves-summary');
    if (!db.leaves.length) { sum.innerHTML = ''; box.innerHTML = emptyState('No leave recorded', 'Add a leave entry to start monthly leave calculation.', '+ Add Leave', 'leaves'); return; }
    var rows = db.leaves.filter(function (l) {
      return inMonth(l, m) && (!f.emp || l.employeeId === f.emp) && (!f.type || l.type === f.type) &&
        matchQ(f.q, empName(l.employeeId), empCode(l.employeeId), l.reason, l.notes);
    }).sort(byDateDesc);
    if (!rows.length) { sum.innerHTML = ''; box.innerHTML = noMatch('leaves'); return; }
    var g = group(rows.filter(notHoliday), function (l) { return l.employeeId; });
    var srows = Array.from(g.entries()).map(function (en) {
      var full = en[1].filter(function (l) { return l.type === 'Full Day'; }).length, half = en[1].filter(function (l) { return l.type === 'Half Day'; }).length;
      return { id: en[0], full: full, half: half, other: en[1].length - full - half, days: sumLeave(en[1]) };
    }).sort(function (a, b) { return empName(a.id).localeCompare(empName(b.id)); });
    var lo = db.appSettings.options.leaveTypes.length > 0 || srows.some(function (s) { return s.other > 0; });
    function sumBy(k) { return srows.reduce(function (a, s) { return a + s[k]; }, 0); }
    sum.innerHTML = cardOf('Employee-wise Leave Summary', periodLabel(m), tbl(
      ['Employee', 'Full Days', 'Half Days'].concat(lo ? ['Other Leaves'] : [], ['Total Leave Days']),
      srows.map(function (s) { return [empCell(s.id), fmtNum(s.full), fmtNum(s.half)].concat(lo ? [fmtNum(s.other)] : [], ['<strong>' + fmtNum(s.days) + '</strong>']); }),
      ['Total', fmtNum(sumBy('full')), fmtNum(sumBy('half'))].concat(lo ? [fmtNum(sumBy('other'))] : [], [fmtNum(sumLeave(rows))])));
    box.innerHTML = cardOf('Leave Records', rows.length + ' record(s)', tbl(
      ['Date', 'Employee', 'Leave Type', 'Days', 'Reason', 'Notes', 'Actions'],
      rows.map(function (l) {
        return [dcell(l.date), empCell(l.employeeId), leaveBadge(l.type), fmtNum(leaveDays(l)),
          '<span class="wrap">' + dash(l.reason) + '</span>', '<span class="wrap">' + dash(l.notes) + '</span>', actions('leaves', l.id)];
      })));
  }

  function renderOT() {
    var f = ui.f.ot, m = vm(f.month);
    var box = $('#ot-table'), sum = $('#ot-summary');
    if (!db.employeeOT.length) { sum.innerHTML = ''; box.innerHTML = emptyState('No overtime recorded', 'Add an OT entry for an employee.', '+ Add OT', 'ot'); return; }
    var rows = db.employeeOT.filter(function (o) {
      return inMonth(o, m) && (!f.emp || o.employeeId === f.emp) && (!f.type || o.type === f.type) &&
        matchQ(f.q, empName(o.employeeId), empCode(o.employeeId), o.notes);
    }).sort(byDateDesc);
    if (!rows.length) { sum.innerHTML = ''; box.innerHTML = noMatch('ot'); return; }
    var g = group(rows, function (o) { return o.employeeId; });
    var srows = Array.from(g.entries()).map(function (en) { return { id: en[0], s: sumOT(en[1]) }; })
      .sort(function (a, b) { return empName(a.id).localeCompare(empName(b.id)); });
    var t = sumOT(rows), oc = otherOn('otTypes', t), ho = t.holiday > 0, Lb = db.appSettings.labels;
    sum.innerHTML = cardOf('Employee-wise OT Summary', periodLabel(m), tbl(
      ['Employee', Lb.normal, Lb.sunday].concat(oc ? ['Other OT'] : [], ['Total OT'], ho ? ['Holiday OT (incl.)'] : []),
      srows.map(function (x) { return [empCell(x.id), fmtNum(x.s.normal), fmtNum(x.s.sunday)].concat(oc ? [fmtNum(x.s.other)] : [], ['<strong>' + fmtNum(x.s.total) + '</strong>'], ho ? [fmtNum(x.s.holiday)] : []); }),
      ['Total', fmtNum(t.normal), fmtNum(t.sunday)].concat(oc ? [fmtNum(t.other)] : [], [fmtNum(t.total)], ho ? [fmtNum(t.holiday)] : [])));
    box.innerHTML = cardOf('OT Records', rows.length + ' record(s)', tbl(
      ['Date', 'Employee', 'OT Type', 'Hours', 'Notes', 'Actions'],
      rows.map(function (o) {
        return [dcell(o.date), empCell(o.employeeId), otBadge(o.type), '<strong>' + fmtNum(o.hours) + '</strong>', '<span class="wrap">' + dash(o.notes) + '</span>', actions('ot', o.id)];
      })));
  }

  function renderAdvances() {
    var f = ui.f.advances, m = vm(f.month);
    var box = $('#advances-table'), sum = $('#advances-summary');
    if (!db.advances.length) { sum.innerHTML = ''; box.innerHTML = emptyState('No advances recorded', 'Add an advance given to an employee.', '+ Add Advance', 'advances'); return; }
    function base(a) { return (!f.emp || a.employeeId === f.emp) && matchQ(f.q, empName(a.employeeId), empCode(a.employeeId), a.reason, a.notes); }
    var scoped = db.advances.filter(base);
    var rows = scoped.filter(function (a) { return inMonth(a, m); }).sort(byDateDesc);
    if (!rows.length) { sum.innerHTML = ''; box.innerHTML = noMatch('advances'); return; }
    var g = group(rows, function (a) { return a.employeeId; });
    var erows = Array.from(g.entries()).map(function (en) { return { id: en[0], n: en[1].length, total: sumAdv(en[1]) }; })
      .sort(function (a, b) { return empName(a.id).localeCompare(empName(b.id)); });
    var mg = group(scoped, function (a) { return String(a.date).slice(0, 7); });
    var mrows = Array.from(mg.entries()).map(function (en) { return { m: en[0], n: en[1].length, total: sumAdv(en[1]) }; })
      .sort(function (a, b) { return b.m.localeCompare(a.m); });
    sum.innerHTML = '<div class="grid-2" style="margin-bottom:16px">' +
      cardOf('Employee-wise Advance Totals', periodLabel(m), tbl(['Employee', 'Entries', 'Total Advance'],
        erows.map(function (x) { return [empCell(x.id), fmtNum(x.n), '<strong>' + money(x.total) + '</strong>']; }),
        ['Total', fmtNum(rows.length), money(sumAdv(rows))])) +
      cardOf('Monthly Advance Totals', f.emp ? 'Selected employee' : 'All employees', tbl(['Month', 'Entries', 'Total Advance'],
        mrows.map(function (x) { return [esc(monthLabel(x.m)) + (x.m === m ? ' <span class="chip">selected</span>' : ''), fmtNum(x.n), '<strong>' + money(x.total) + '</strong>']; }),
        ['All months', fmtNum(scoped.length), money(sumAdv(scoped))])) + '</div>';
    box.innerHTML = cardOf('Advance Records', rows.length + ' record(s)', tbl(
      ['Date', 'Employee', 'Amount', 'Reason', 'Notes', 'Actions'],
      rows.map(function (a) {
        return [fmtDate(a.date), empCell(a.employeeId), '<strong>' + money(a.amount) + '</strong>', '<span class="wrap">' + dash(a.reason) + '</span>', '<span class="wrap">' + dash(a.notes) + '</span>', actions('advances', a.id)];
      })));
  }

  function renderOutsiders() {
    var f = ui.f.outsiders, all = db.outsideWorkers, box = $('#outsiders-table');
    if (!all.length) { box.innerHTML = emptyState('No outside workers yet', 'Outside workers are tracked separately from employees.', '+ Add Worker', 'outsiders'); return; }
    var rows = all.filter(function (w) {
      return (!f.source || w.source === f.source) && (!f.status || w.status === f.status) && matchQ(f.q, w.workerId, w.name, w.phone, w.source);
    }).sort(byName);
    if (!rows.length) { box.innerHTML = noMatch('outsiders'); return; }
    box.innerHTML = cardOf('Outside Worker List', rows.length + ' of ' + all.length + ' shown', tbl(
      ['Worker ID', 'Worker Name', 'Phone', 'Source', 'Status', 'Actions'],
      rows.map(function (w) { return [esc(w.workerId), '<strong>' + esc(w.name) + '</strong>', dash(w.phone), esc(w.source), statusBadge(w.status), actions('outsiders', w.id)]; })));
  }

  function setWeekday(d, on) {
    var cur = db.appSettings.weeklyOff.slice(), ix = cur.indexOf(d);
    if (on && ix === -1) cur.push(d); else if (!on && ix !== -1) cur.splice(ix, 1);
    db.appSettings.weeklyOff = normWeekly(cur);
    save('appSettings');
    renderCurrent();
    var names = db.appSettings.weeklyOff.map(function (i) { return WEEKDAYS[i]; });
    toast(names.length ? 'Weekly holidays: ' + names.join(', ') + '.' : 'No weekly holidays set.');
  }
  function renderHolidays() {
    var f = ui.f.holidays, m = vm(f.month), wk = db.appSettings.weeklyOff;
    $('#holidays-weekly').innerHTML = cardOf('Weekly holidays', wk.length ? wk.map(function (i) { return WEEKDAYS[i]; }).join(', ') : 'None',
      '<div class="card-body"><div class="day-checks">' + WEEKDAYS.map(function (n, i) {
        return '<label class="day-check"><input type="checkbox" data-weekday="' + i + '"' + (wk.indexOf(i) !== -1 ? ' checked' : '') + '><span>' + n + '</span></label>';
      }).join('') + '</div><p class="hint">Ticked days are holidays every week (default: Sunday). Changing this applies to all dates, including past records.</p></div>');
    var pm = m || monthNow(), p = pm.split('-'), days = new Date(Number(p[0]), Number(p[1]), 0).getDate(), list = [];
    for (var d = 1; d <= days; d++) { var ds = pm + '-' + pad(d), h = holidayInfo(ds); if (h) list.push({ date: ds, h: h }); }
    $('#holidays-preview').innerHTML = cardOf('Holidays in ' + monthLabel(pm), list.length + ' day(s)', list.length ? tbl(
      ['Date', 'Day', 'Holiday'],
      list.map(function (x) {
        return [fmtDate(x.date), WEEKDAYS[dayOfWeek(x.date)], '<strong>' + esc(x.h.name) + '</strong>' + (x.h.special ? '<span class="sub">Special holiday' + (x.h.weekly ? ' (also weekly)' : '') + '</span>' : '<span class="sub">Weekly holiday</span>')];
      })) : '<div class="card-body"><p class="hint">No holidays in this month.</p></div>');
    var box = $('#holidays-table');
    if (!db.holidays.length) { box.innerHTML = emptyState('No special holidays added', 'Add festival or company holidays — a single day or several days. Weekly holidays are set above.', '+ Add Holiday', 'holidays'); return; }
    var rows = db.holidays.filter(function (x) { return inMonth(x, m) && matchQ(f.q, x.name, x.notes, x.date); })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (!rows.length) { box.innerHTML = noMatch('holidays'); return; }
    box.innerHTML = cardOf('Special Holidays', rows.length + ' of ' + db.holidays.length + ' shown', tbl(
      ['Date', 'Day', 'Holiday Name', 'Notes', 'Actions'],
      rows.map(function (x) { return [fmtDate(x.date), WEEKDAYS[dayOfWeek(x.date)], '<strong>' + esc(x.name) + '</strong>', '<span class="wrap">' + dash(x.notes) + '</span>', actions('holidays', x.id)]; })));
  }

  function renderOutsiderWork() {
    var f = ui.f.outsiderWork, m = vm(f.month);
    var box = $('#outsiderWork-table'), sum = $('#outsiderWork-summary');
    if (!db.outsideWorkerWork.length) { sum.innerHTML = ''; box.innerHTML = emptyState('No work recorded', 'Add the days your outside workers worked — one day at a time, or many days at once.', '+ Add Work', 'outsiderWork'); return; }
    var rows = db.outsideWorkerWork.filter(function (x) {
      var w = workerById(x.workerId);
      return inMonth(x, m) && (!f.worker || x.workerId === f.worker) && (!f.type || x.type === f.type) &&
        (!f.source || (w && w.source === f.source)) && matchQ(f.q, workerName(x.workerId), workerCode(x.workerId), x.details, x.notes);
    }).sort(byDateDesc);
    if (!rows.length) { sum.innerHTML = ''; box.innerHTML = noMatch('outsiderWork'); return; }
    var g = group(rows.filter(notHoliday), function (x) { return x.workerId; });
    var srows = Array.from(g.entries()).map(function (en) {
      var full = en[1].filter(function (x) { return x.type !== 'Half Day'; }).length, half = en[1].length - full;
      return { id: en[0], full: full, half: half, days: sumLeave(en[1]) };
    }).sort(function (a, b) { return workerName(a.id).localeCompare(workerName(b.id)); });
    sum.innerHTML = cardOf('Worker-wise Work Summary', periodLabel(m), tbl(
      ['Worker', 'Full Days', 'Half Days', 'Total Work Days'],
      srows.map(function (s) { return [workerCell(s.id), fmtNum(s.full), fmtNum(s.half), '<strong>' + fmtNum(s.days) + '</strong>']; }),
      ['Total', fmtNum(srows.reduce(function (a, s) { return a + s.full; }, 0)), fmtNum(srows.reduce(function (a, s) { return a + s.half; }, 0)), fmtNum(sumLeave(rows))]));
    box.innerHTML = cardOf('Work Records', rows.length + ' record(s)', tbl(
      ['Date', 'Worker', 'Source', 'Day Type', 'Days', 'Work / Site', 'Notes', 'Actions'],
      rows.map(function (x) {
        var w = workerById(x.workerId);
        return [dcell(x.date), workerCell(x.workerId), w ? esc(w.source) : '—', leaveBadge(x.type), fmtNum(leaveDays(x)),
          '<span class="wrap">' + dash(x.details) + '</span>', '<span class="wrap">' + dash(x.notes) + '</span>', actions('outsiderWork', x.id)];
      })));
  }

  function renderOutsiderLeave(pre) {
    var f = ui.f[pre], m = vm(f.month);
    var box = $('#' + pre + '-table'), sum = $('#' + pre + '-summary');
    if (pre === 'outsiderLeave') ['leaves-summary', 'leaves-table', 'leavesOut-summary', 'leavesOut-table'].forEach(function (id) { $('#' + id).innerHTML = ''; });
    if (!db.outsideWorkerLeave.length) { sum.innerHTML = ''; box.innerHTML = emptyState('No outside worker leave recorded', 'Add leave for an outside worker — one day, many days, or many workers at once.', '+ Add Outside Leave', 'outsiderLeave'); return; }
    var rows = db.outsideWorkerLeave.filter(function (x) {
      var w = workerById(x.workerId);
      return inMonth(x, m) && (!f.worker || x.workerId === f.worker) && (!f.type || x.type === f.type) &&
        (!f.source || (w && w.source === f.source)) && matchQ(f.q, workerName(x.workerId), workerCode(x.workerId), x.reason, x.notes);
    }).sort(byDateDesc);
    if (!rows.length) { sum.innerHTML = ''; box.innerHTML = noMatch(pre); return; }
    var g = group(rows.filter(notHoliday), function (x) { return x.workerId; });
    var srows = Array.from(g.entries()).map(function (en) {
      var full = en[1].filter(function (x) { return x.type !== 'Half Day'; }).length, half = en[1].length - full;
      return { id: en[0], full: full, half: half, days: sumLeave(en[1]) };
    }).sort(function (a, b) { return workerName(a.id).localeCompare(workerName(b.id)); });
    sum.innerHTML = cardOf('Worker-wise Leave Summary', periodLabel(m), tbl(
      ['Worker', 'Full Days', 'Half Days', 'Total Leave Days'],
      srows.map(function (s) { return [workerCell(s.id), fmtNum(s.full), fmtNum(s.half), '<strong>' + fmtNum(s.days) + '</strong>']; }),
      ['Total', fmtNum(srows.reduce(function (a, s) { return a + s.full; }, 0)), fmtNum(srows.reduce(function (a, s) { return a + s.half; }, 0)), fmtNum(sumLeave(rows))]));
    box.innerHTML = cardOf('Outside Worker Leave Records', rows.length + ' record(s)', tbl(
      ['Date', 'Worker', 'Source', 'Leave Type', 'Days', 'Reason', 'Notes', 'Actions'],
      rows.map(function (x) {
        var w = workerById(x.workerId);
        return [dcell(x.date), workerCell(x.workerId), w ? esc(w.source) : '—', leaveBadge(x.type), fmtNum(leaveDays(x)),
          '<span class="wrap">' + dash(x.reason) + '</span>', '<span class="wrap">' + dash(x.notes) + '</span>', actions('outsiderLeave', x.id)];
      })));
  }

  function renderOutsiderOT() {
    var f = ui.f.outsiderOT, m = vm(f.month);
    var box = $('#outsiderOT-table'), sum = $('#outsiderOT-summary');
    if (!db.outsideWorkerOT.length) { sum.innerHTML = ''; box.innerHTML = emptyState('No outside worker OT recorded', 'Add OT for an outside worker.', '+ Add Worker OT', 'outsiderOT'); return; }
    var rows = db.outsideWorkerOT.filter(function (o) {
      var w = workerById(o.workerId);
      return inMonth(o, m) && (!f.worker || o.workerId === f.worker) && (!f.type || o.type === f.type) &&
        (!f.source || (w && w.source === f.source)) && matchQ(f.q, workerName(o.workerId), workerCode(o.workerId), o.notes);
    }).sort(byDateDesc);
    if (!rows.length) { sum.innerHTML = ''; box.innerHTML = noMatch('outsiderOT'); return; }
    var g = group(rows, function (o) { return o.workerId; });
    var srows = Array.from(g.entries()).map(function (en) { return { id: en[0], s: sumOT(en[1]) }; })
      .sort(function (a, b) { return workerName(a.id).localeCompare(workerName(b.id)); });
    var t = sumOT(rows), oc = otherOn('workerOtTypes', t), ho = t.holiday > 0, Lb = db.appSettings.labels;
    sum.innerHTML = cardOf('Worker-wise OT Summary', periodLabel(m), tbl(
      ['Worker', Lb.normal, Lb.sunday].concat(oc ? ['Other OT'] : [], ['Total OT'], ho ? ['Holiday OT (incl.)'] : []),
      srows.map(function (x) { return [workerCell(x.id), fmtNum(x.s.normal), fmtNum(x.s.sunday)].concat(oc ? [fmtNum(x.s.other)] : [], ['<strong>' + fmtNum(x.s.total) + '</strong>'], ho ? [fmtNum(x.s.holiday)] : []); }),
      ['Total', fmtNum(t.normal), fmtNum(t.sunday)].concat(oc ? [fmtNum(t.other)] : [], [fmtNum(t.total)], ho ? [fmtNum(t.holiday)] : [])));
    box.innerHTML = cardOf('Outside Worker OT Records', rows.length + ' record(s)', tbl(
      ['Date', 'Worker', 'Source', 'OT Type', 'Hours', 'Notes', 'Actions'],
      rows.map(function (o) {
        var w = workerById(o.workerId);
        return [dcell(o.date), workerCell(o.workerId), w ? esc(w.source) : '—', otBadge(o.type), '<strong>' + fmtNum(o.hours) + '</strong>', '<span class="wrap">' + dash(o.notes) + '</span>', actions('outsiderOT', o.id)];
      })));
  }

  /* ----- Reports ----- */
  function buildEmpReport(f) {
    var m = vm(f.month);
    return db.employees.filter(function (e) {
      return (!f.emp || e.id === f.emp) && matchQ(f.q, e.empId, e.name, e.designation, e.department);
    }).map(function (e) {
      var leave = sumLeave(db.leaves.filter(function (l) { return l.employeeId === e.id && inMonth(l, m); }));
      var ot = sumOT(db.employeeOT.filter(function (o) { return o.employeeId === e.id && inMonth(o, m); }));
      var adv = sumAdv(db.advances.filter(function (a) { return a.employeeId === e.id && inMonth(a, m); }));
      return { e: e, leave: leave, ot: ot, adv: adv, has: !!(leave || ot.total || adv) };
    }).filter(function (r) { return r.e.status === 'Active' || r.has || f.emp; }).sort(function (a, b) { return byName(a.e, b.e); });
  }
  function buildWorkerReport(f) {
    var m = vm(f.month);
    return db.outsideWorkers.filter(function (w) {
      return (!f.worker || w.id === f.worker) && (!f.source || w.source === f.source) && matchQ(f.q, w.workerId, w.name);
    }).map(function (w) {
      var ot = sumOT(db.outsideWorkerOT.filter(function (o) { return o.workerId === w.id && inMonth(o, m); }));
      var days = sumLeave(db.outsideWorkerWork.filter(function (x) { return x.workerId === w.id && inMonth(x, m); }));
      var lv = sumLeave(db.outsideWorkerLeave.filter(function (x) { return x.workerId === w.id && inMonth(x, m); }));
      return { w: w, ot: ot, days: days, leave: lv, has: ot.total > 0 || days > 0 || lv > 0 };
    }).filter(function (r) { return r.w.status === 'Active' || r.has || ui.f.reports.worker; }).sort(function (a, b) { return byName(a.w, b.w); });
  }
  function empTotals(rows) {
    var t = { leave: 0, normal: 0, sunday: 0, other: 0, holiday: 0, total: 0, adv: 0 };
    rows.forEach(function (r) { t.leave += r.leave; t.holiday += r.ot.holiday; t.normal += r.ot.normal; t.sunday += r.ot.sunday; t.other += r.ot.other; t.total += r.ot.total; t.adv += r.adv; });
    Object.keys(t).forEach(function (k) { t[k] = r2(t[k]); });
    return t;
  }
  function workerTotals(rows) {
    var t = { days: 0, leave: 0, normal: 0, sunday: 0, other: 0, holiday: 0, total: 0 };
    rows.forEach(function (r) { t.days += r.days; t.leave += r.leave; t.holiday += r.ot.holiday; t.normal += r.ot.normal; t.sunday += r.ot.sunday; t.other += r.ot.other; t.total += r.ot.total; });
    Object.keys(t).forEach(function (k) { t[k] = r2(t[k]); });
    return t;
  }

  function renderReports() {
    var f = ui.f.reports, m = vm(f.month), body = $('#reports-body'), Lb = db.appSettings.labels;
    if (!db.employees.length && !db.outsideWorkers.length) {
      body.innerHTML = emptyState('Nothing to report yet', 'Add employees or outside workers and their records to see monthly reports.', '+ Add Employee', 'employees');
      return;
    }
    var er = buildEmpReport(f), wr = buildWorkerReport(f);
    var et = empTotals(er), wt = workerTotals(wr);
    var eo = otherOn('otTypes', et), wo = otherOn('workerOtTypes', wt), eh = et.holiday > 0, wh = wt.holiday > 0;
    var lg = db.appSettings.companyLogo, html = '<div class="print-head">' + (lg ? '<img class="print-logo" src="' + lg + '" alt="">' : '') + '<h2>' + esc(COMPANY) + '</h2><p>Monthly Report — <strong>' + esc(periodLabel(m)) + '</strong> · Generated ' + esc(fmtDate(todayStr())) + '</p></div>';
    html += '<div class="stats">' +
      stat('Leave Days', fmtNum(et.leave), 'Employees') + stat(Lb.normal, fmtNum(et.normal), 'hours', 'y') +
      stat(Lb.sunday, fmtNum(et.sunday), 'hours', 'y') +
      (eo ? stat('Other OT', fmtNum(et.other), 'hours', 'y') : '') +
      (eh ? stat('Holiday OT (incl.)', fmtNum(et.holiday), 'hours', 'y') : '') +
      stat('Total OT', fmtNum(et.total), 'hours') + stat('Total Advance', money(et.adv), '', 'd') + '</div>';

    if (db.employees.length) {
      html += er.length ? cardOf('Employee Report', periodLabel(m), tbl(
        ['Employee', 'Leave Days', Lb.normal, Lb.sunday].concat(eo ? ['Other OT'] : [], ['Total OT', 'Advance'], eh ? ['Holiday OT (incl.)'] : []),
        er.map(function (r) { return [empCell(r.e.id), fmtNum(r.leave), fmtNum(r.ot.normal), fmtNum(r.ot.sunday)].concat(eo ? [fmtNum(r.ot.other)] : [], ['<strong>' + fmtNum(r.ot.total) + '</strong>', money(r.adv)], eh ? [fmtNum(r.ot.holiday)] : []); }),
        ['Total', fmtNum(et.leave), fmtNum(et.normal), fmtNum(et.sunday)].concat(eo ? [fmtNum(et.other)] : [], [fmtNum(et.total), money(et.adv)], eh ? [fmtNum(et.holiday)] : [])))
        : cardOf('Employee Report', periodLabel(m), '<div class="card-body">' + noMatch('reports') + '</div>');
    }
    if (db.outsideWorkers.length) {
      html += wr.length ? cardOf('Outside Worker Report', periodLabel(m), tbl(
        ['Worker', 'Source', 'Work Days', 'Leave Days', Lb.normal, Lb.sunday].concat(wo ? ['Other OT'] : [], ['Total OT'], wh ? ['Holiday OT (incl.)'] : []),
        wr.map(function (r) { return [workerCell(r.w.id), esc(r.w.source), fmtNum(r.days), fmtNum(r.leave), fmtNum(r.ot.normal), fmtNum(r.ot.sunday)].concat(wo ? [fmtNum(r.ot.other)] : [], ['<strong>' + fmtNum(r.ot.total) + '</strong>'], wh ? [fmtNum(r.ot.holiday)] : []); }),
        ['Total', '', fmtNum(wt.days), fmtNum(wt.leave), fmtNum(wt.normal), fmtNum(wt.sunday)].concat(wo ? [fmtNum(wt.other)] : [], [fmtNum(wt.total)], wh ? [fmtNum(wt.holiday)] : [])))
        : cardOf('Outside Worker Report', periodLabel(m), '<div class="card-body">' + noMatch('reports') + '</div>');
    }
    // Detail when a single employee / worker is selected
    var sel = f.emp && empById(f.emp);
    if (sel) {
      var L = db.leaves.filter(function (l) { return l.employeeId === sel.id && inMonth(l, m); }).sort(byDateDesc);
      var O = db.employeeOT.filter(function (o) { return o.employeeId === sel.id && inMonth(o, m); }).sort(byDateDesc);
      var A = db.advances.filter(function (a) { return a.employeeId === sel.id && inMonth(a, m); }).sort(byDateDesc);
      html += cardOf('Employee Detail — ' + sel.name + ' (' + sel.empId + ')', periodLabel(m),
        '<div class="card-body"><h4>Leave</h4>' + (L.length ? tbl(['Date', 'Type', 'Days', 'Reason'], L.map(function (l) { return [dcell(l.date), leaveBadge(l.type), fmtNum(leaveDays(l)), dash(l.reason)]; })) : '<p class="hint">No leave.</p>') +
        '<h4 style="margin-top:14px">Overtime</h4>' + (O.length ? tbl(['Date', 'OT Type', 'Hours', 'Notes'], O.map(function (o) { return [dcell(o.date), otBadge(o.type), fmtNum(o.hours), dash(o.notes)]; })) : '<p class="hint">No overtime.</p>') +
        '<h4 style="margin-top:14px">Advances</h4>' + (A.length ? tbl(['Date', 'Amount', 'Reason'], A.map(function (a) { return [fmtDate(a.date), money(a.amount), dash(a.reason)]; })) : '<p class="hint">No advances.</p>') + '</div>');
    }
    var selW = f.worker && workerById(f.worker);
    if (selW) {
      var WO = db.outsideWorkerOT.filter(function (o) { return o.workerId === selW.id && inMonth(o, m); }).sort(byDateDesc);
      var WK = db.outsideWorkerWork.filter(function (x) { return x.workerId === selW.id && inMonth(x, m); }).sort(byDateDesc);
      var WL = db.outsideWorkerLeave.filter(function (x) { return x.workerId === selW.id && inMonth(x, m); }).sort(byDateDesc);
      html += cardOf('Worker Detail — ' + selW.name + ' (' + selW.workerId + ')', periodLabel(m),
        '<div class="card-body"><h4>Work days</h4>' + (WK.length ? tbl(['Date', 'Day Type', 'Days', 'Work / Site'], WK.map(function (x) { return [dcell(x.date), leaveBadge(x.type), fmtNum(leaveDays(x)), dash(x.details)]; })) : '<p class="hint">No work entries.</p>') +
        '<h4 style="margin-top:14px">Leave</h4>' + (WL.length ? tbl(['Date', 'Type', 'Days', 'Reason'], WL.map(function (x) { return [dcell(x.date), leaveBadge(x.type), fmtNum(leaveDays(x)), dash(x.reason)]; })) : '<p class="hint">No leave.</p>') +
        '<h4 style="margin-top:14px">Overtime</h4>' + (WO.length ? tbl(['Date', 'OT Type', 'Hours', 'Notes'], WO.map(function (o) { return [dcell(o.date), otBadge(o.type), fmtNum(o.hours), dash(o.notes)]; })) : '<p class="hint">No overtime.</p>') + '</div>');
    }
    body.innerHTML = html;
  }

  /* ----- Backup view ----- */
  function renderBackup() {
    var labels = { employees: 'Employees', leaves: 'Leave records', employeeOT: 'Employee OT', advances: 'Advances', outsideWorkers: 'Outside workers', outsideWorkerWork: 'Outside worker work days', outsideWorkerLeave: 'Outside worker leave records', outsideWorkerOT: 'Outside worker OT', holidays: 'Special holidays' };
    var html = '<div class="count-grid">' + DATA_KEYS.map(function (k) {
      return '<div class="count"><strong>' + db[k].length + '</strong><span>' + labels[k] + '</span></div>';
    }).join('') + '</div>';
    var lb = db.appSettings.lastBackup;
    html += '<p class="hint">Last backup downloaded from this browser: <strong>' + (lb ? esc(new Date(lb).toLocaleString()) : 'never') + '</strong></p>';
    $('#backup-summary').innerHTML = html;
    renderAuthCard(); renderCompanyCard(); renderMenuCard();
    var di = $('#drive-input');
    if (di && document.activeElement !== di) di.value = driveUrl();
    var dl = $('#drive-open'); if (dl) dl.href = driveUrl();
    var ci = $('#currency-input');
    if (ci && document.activeElement !== ci) ci.value = db.appSettings.currency || '';
  }

  var RENDER = {
    dashboard: renderDashboard, employees: renderEmployees, leaves: renderLeaves, ot: renderOT, advances: renderAdvances,
    holidays: renderHolidays, outsiders: renderOutsiders, outsiderWork: renderOutsiderWork, outsiderLeave: function () { renderOutsiderLeave('outsiderLeave'); }, leavesOut: renderLeaves, outsiderOT: renderOutsiderOT, reports: renderReports, activity: renderActivity, backup: renderBackup
  };
  function renderView(v) {
    if (RENDER[v]) RENDER[v]();
    Object.keys(ui.sel).forEach(refreshBulk);
  }
  function stamp(iso) {
    var d = new Date(iso); if (isNaN(d)) return '—';
    return fmtDate(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function modEntry(coll, action) {
    var m = act().mods[coll] && act().mods[coll][action], best = m || null;
    var f = action === 'add' ? 'createdAt' : action === 'edit' ? 'updatedAt' : '';
    if (f && Array.isArray(db[coll])) {
      var mx = ''; db[coll].forEach(function (r) { if (r[f] && r[f] > mx) mx = r[f]; });
      if (mx && normStamp(mx) && (!best || mx > best.at)) best = { at: mx, n: 0, by: '' };
    }
    return best;
  }
  function stampCell(e) {
    if (!e) return '<span class="muted">—</span>';
    var sub = [e.by ? 'by ' + esc(e.by) : '', e.n > 1 ? e.n + ' records' : ''].filter(Boolean).join(' · ');
    return '<strong>' + stamp(e.at) + '</strong>' + (sub ? '<span class="sub">' + sub + '</span>' : '');
  }
  function renderActivity() {
    var a = act(), mods = ['leaves', 'employeeOT', 'advances', 'outsideWorkerWork', 'outsideWorkerLeave', 'outsideWorkerOT', 'employees', 'outsideWorkers', 'holidays', 'appSettings'];
    var overall = '';
    mods.forEach(function (c) { ['add', 'edit', 'delete'].forEach(function (k) { var e = modEntry(c, k); if (e && e.at > overall) overall = e.at; }); });
    a.log.forEach(function (e) { if (e.at > overall) overall = e.at; });
    var rows = mods.map(function (c) {
      var ad = modEntry(c, 'add'), ed = modEntry(c, 'edit'), de = modEntry(c, 'delete'), last = '';
      [ad, ed, de].forEach(function (e) { if (e && e.at > last) last = e.at; });
      return ['<strong>' + ACT_NAMES[c] + '</strong>', stampCell(ad), stampCell(ed), stampCell(de), last ? '<strong>' + stamp(last) + '</strong>' : '<span class="muted">No activity yet</span>'];
    });
    var html = '<div class="stats">' +
      stat('Overall last update', overall ? stamp(overall) : 'No activity yet', 'Admin: ' + esc(adminName()), 'r') +
      stat('Last export', a.lastExport ? stamp(a.lastExport.at) : 'Never', a.lastExport ? esc(a.lastExport.file) + (a.lastExport.drive ? ' · via Drive' : '') : '', 'y') +
      stat('Last import', a.lastImport ? stamp(a.lastImport.at) : 'Never', a.lastImport ? esc(a.lastImport.file) : '', 'y') + '</div>';
    html += cardOf('Last updated by section', '', tbl(['Section', 'Last added', 'Last modified', 'Last deleted', 'Last activity'], rows));
    var lrows = a.log.map(function (e) {
      return [stamp(e.at), esc(ACT_NAMES[e.coll] || e.coll), '<span class="badge ' + (e.action === 'delete' || e.action === 'clear' ? 'b-full' : 'b-half') + '">' + esc(e.action) + '</span>', '<span class="wrap">' + esc(e.msg || '—') + '</span>', esc(e.by || '—')];
    });
    html += cardOf('Recent activity', a.log.length + ' latest', lrows.length ? tbl(['Date & time', 'Section', 'Action', 'Details', 'By'], lrows) :
      '<div class="empty"><h3>No activity recorded yet</h3><p>Changes you make will appear here automatically.</p></div>');
    html += '<p class="hint">Dates and times use this device\'s clock. Kept in this browser (and inside JSON backups); no one can edit this page.</p>';
    $('#activity-body').innerHTML = html;
  }
  function renderCurrent() { renderView(ui.view); }

  /* ================= Filters ================= */
  function populateSelects() {
    $$('select[data-src]').forEach(function (sel) {
      var parts = sel.dataset.f.split('.'), view = parts[0], field = parts[1], src = sel.dataset.src, opts = [];
      if (src === 'employees') opts = db.employees.slice().sort(byName).map(function (e) { return [e.id, e.name + ' (' + e.empId + ')']; });
      else if (src === 'workers') opts = db.outsideWorkers.slice().sort(byName).map(function (w) { return [w.id, w.name + ' (' + w.workerId + ')']; });
      else if (src === 'departments') opts = departments().map(function (d) { return [d, d]; });
      else opts = getOpts(src);
      var cur = ui.f[view][field];
      sel.innerHTML = '<option value="">' + esc(sel.dataset.all || 'All') + '</option>' +
        opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
      if (opts.some(function (o) { return o[0] === cur; })) sel.value = cur; else { sel.value = ''; ui.f[view][field] = ''; }
    });
  }
  function syncFilterInputs(view) {
    $$('[data-f^="' + view + '."]').forEach(function (el) {
      if (el.tagName === 'SELECT' && el.dataset.src) return;
      el.value = ui.f[view][el.dataset.f.split('.')[1]] || '';
    });
  }
  function clearFilters(view) {
    ui.f[view] = FILTER_DEFAULTS[view]();
    populateSelects(); syncFilterInputs(view); renderView(view);
  }
  function onFilterInput(e) {
    var el = e.target.closest ? e.target.closest('[data-f]') : null;
    if (!el) return;
    var p = el.dataset.f.split('.');
    ui.f[p[0]][p[1]] = el.value;
    renderView(p[0]);
  }

  /* ================= Forms ================= */
  function empOptions(cur) {
    return db.employees.filter(function (e) { return e.status === 'Active' || e.id === cur; }).sort(byName)
      .map(function (e) { return [e.id, e.name + ' (' + e.empId + ')']; });
  }
  function workerOptions(cur) {
    return db.outsideWorkers.filter(function (w) { return w.status === 'Active' || w.id === cur; }).sort(byName)
      .map(function (w) { return [w.id, w.name + ' (' + w.workerId + ')']; });
  }
  var STATUS_OPTS = [['Active', 'Active'], ['Inactive', 'Inactive']];
  var OT_OPTS = Object.keys(OT_TYPES).map(function (k) { return [k, OT_TYPES[k]]; });
  var NEED_EMP = function () { return empOptions().length ? null : { msg: 'Add an active employee first.', view: 'employees' }; };
  var NEED_WORKER = function () { return workerOptions().length ? null : { msg: 'Add an active outside worker first.', view: 'outsiders' }; };

  var FORMS = {
    employees: {
      title: 'Employee', coll: 'employees',
      fields: function () {
        return [
          { name: 'empId', label: 'Employee ID', type: 'text', required: true, maxlength: 30 },
          { name: 'name', label: 'Name', type: 'text', required: true, maxlength: 100 },
          { name: 'phone', label: 'Phone', type: 'tel', maxlength: 25 },
          { name: 'designation', label: 'Designation', type: 'text', required: true, maxlength: 80, list: designations() },
          { name: 'department', label: 'Department', type: 'text', maxlength: 80, list: departments() },
          { name: 'joiningDate', label: 'Joining Date', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTS },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { status: 'Active' }; },
      validate: function (v, rec) {
        var dup = db.employees.find(function (e) { return e.empId.toLowerCase() === v.empId.toLowerCase() && (!rec || e.id !== rec.id); });
        if (dup) return { msg: 'Employee ID "' + v.empId + '" is already used by ' + dup.name + '.', field: 'empId' };
        if (v.phone && !/^[0-9+()\-\s]{6,25}$/.test(v.phone)) return { msg: 'Enter a valid phone number.', field: 'phone' };
        return null;
      },
      bulkNames: ['designation', 'department', 'status', 'notes'],
      describe: function (r) { return r.name + ' (' + r.empId + ')'; }
    },
    leaves: {
      title: 'Leave', coll: 'leaves', needs: NEED_EMP, holidayNote: 'leave',
      fields: function (rec) {
        var f = [personField('employeeId', 'Employee', 'employee', empOptions(rec && rec.employeeId), rec)];
        if (!rec) f.push({ name: 'mode', label: 'Leave Dates', type: 'select', required: true, wide: true, options: [['single', 'Single date'], ['range', 'Multiple dates (continuous leave)']] });
        f.push({ name: 'date', label: 'Date', type: 'date', required: true });
        if (!rec) f.push({ name: 'dateTo', label: 'To Date', type: 'date', hidden: true });
        f.push(
          { name: 'type', label: 'Leave Type', type: 'select', required: true, options: withCur(getOpts('leaveTypes'), rec && rec.type) },
          { name: 'reason', label: 'Reason', type: 'text', maxlength: 150, wide: true, fallback: '-', hint: 'Optional — saved as "-" if left empty' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        );
        return f;
      },
      defaults: function () { return { mode: 'single', date: todayStr(), type: 'Full Day' }; },
      validate: function (v, rec) {
        if (v.mode === 'range') {
          if (!isDate(v.dateTo)) return { msg: 'Enter a valid To Date.', field: 'dateTo' };
          if (v.dateTo < v.date) return { msg: 'To Date cannot be before the From Date.', field: 'dateTo' };
          if (datesBetween(v.date, v.dateTo).length > 62) return { msg: 'A leave range can be at most 62 days.', field: 'dateTo' };
          return null;
        }
        var hol = holidayInfo(v.date);
        if (hol && (!rec || rec.date !== v.date)) return { msg: fmtDate(v.date) + ' is a holiday (' + hol.name + '). Leave is not counted on holidays.', field: 'date' };
        var dup = db.leaves.find(function (l) { return l.employeeId === v.employeeId && l.date === v.date && (!rec || l.id !== rec.id); });
        if (dup) return { msg: 'This employee already has a leave entry on that date. Edit the existing entry instead.', field: 'date' };
        return null;
      },
      normalize: function (v) { var o = Object.assign({}, v); delete o.mode; delete o.dateTo; return o; },
      customSave: function (v, people) {
        var range = v.mode === 'range';
        if (!range && !people) return null;
        var ids = people || [v.employeeId], dates = range ? datesBetween(v.date, v.dateTo) : [v.date];
        var have = {}, added = 0, skipped = 0, holi = 0, now = new Date().toISOString();
        db.leaves.forEach(function (l) { have[l.employeeId + '|' + l.date] = 1; });
        ids.forEach(function (pid, pi) {
          dates.forEach(function (d) {
            if (isHoliday(d)) { if (!pi) holi++; return; }
            if (have[pid + '|' + d]) { skipped++; return; }
            db.leaves.push({ id: uid(), createdAt: now, employeeId: pid, date: d, type: v.type, reason: v.reason, notes: v.notes });
            added++;
          });
        });
        if (!added) return { err: 'Nothing to add — every date is a holiday or already has a leave entry.' };
        return { msg: added + ' leave day(s) added' + (people ? ' for ' + ids.length + ' employee(s)' : '') + skipNote(skipped, holi) + '.' };
      },
      bulkNames: ['date', 'type', 'reason', 'notes'],
      bulkCheck: function (c, recs, sel) { return bulkDateCheck(c, recs, sel, db.leaves, 'employeeId', 'employee', 'Leave'); },
      describe: function (r) { return 'leave of ' + empName(r.employeeId) + ' on ' + r.date; }
    },
    ot: {
      title: 'OT Entry', coll: 'employeeOT', needs: NEED_EMP, holidayNote: 'ot',
      fields: function (rec) {
        return [
          personField('employeeId', 'Employee', 'employee', empOptions(rec && rec.employeeId), rec),
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'type', label: 'OT Type', type: 'select', required: true, options: withCur(getOpts('otTypes'), rec && rec.type, otLabel), editable: 'ot', addable: 'otTypes', addHint: 'New OT type, e.g. Holiday OT' },
          { name: 'hours', label: 'Hours', type: 'number', required: true, positive: true, max: MAX_HOURS, step: '0.01', hint: 'e.g. 1.5, 2.5, 3.75' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { date: todayStr(), type: 'normal' }; },
      validate: function () { return null; },
      customSave: function (v, people) {
        if (!people) return null;
        var now = new Date().toISOString();
        people.forEach(function (p) { db.employeeOT.push({ id: uid(), createdAt: now, employeeId: p, date: v.date, type: v.type, hours: v.hours, notes: v.notes }); });
        return { msg: 'OT added for ' + people.length + ' employee(s).' };
      },
      bulkNames: ['date', 'type', 'hours', 'notes'],
      describe: function (r) { return otLabel(r.type) + ' of ' + empName(r.employeeId) + ' on ' + r.date; }
    },
    advances: {
      title: 'Advance', coll: 'advances', needs: NEED_EMP,
      fields: function (rec) {
        return [
          personField('employeeId', 'Employee', 'employee', empOptions(rec && rec.employeeId), rec),
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'amount', label: 'Amount', type: 'number', required: true, positive: true, max: 100000000, step: '0.01' },
          { name: 'reason', label: 'Reason', type: 'text', maxlength: 150, wide: true },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { date: todayStr() }; },
      validate: function () { return null; },
      customSave: function (v, people) {
        if (!people) return null;
        var now = new Date().toISOString();
        people.forEach(function (p) { db.advances.push({ id: uid(), createdAt: now, employeeId: p, date: v.date, amount: v.amount, reason: v.reason, notes: v.notes }); });
        return { msg: 'Advance added for ' + people.length + ' employee(s).' };
      },
      bulkNames: ['date', 'amount', 'reason', 'notes'],
      describe: function (r) { return 'advance of ' + empName(r.employeeId) + ' on ' + r.date; }
    },
    outsiders: {
      title: 'Outside Worker', coll: 'outsideWorkers',
      fields: function (rec) {
        return [
          { name: 'workerId', label: 'Worker ID', type: 'text', required: true, maxlength: 30 },
          { name: 'name', label: 'Worker Name', type: 'text', required: true, maxlength: 100 },
          { name: 'phone', label: 'Phone', type: 'tel', maxlength: 25 },
          { name: 'source', label: 'Source', type: 'select', required: true, options: withCur(getOpts('sources'), rec && rec.source), editable: 'src', addable: 'sources', addHint: 'New source, e.g. Contractor' },
          { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTS }
        ];
      },
      defaults: function () { var so = getOpts('sources'); return { source: so.length ? so[0][0] : '', status: 'Active' }; },
      validate: function (v, rec) {
        var dup = db.outsideWorkers.find(function (w) { return w.workerId.toLowerCase() === v.workerId.toLowerCase() && (!rec || w.id !== rec.id); });
        if (dup) return { msg: 'Worker ID "' + v.workerId + '" is already used by ' + dup.name + '.', field: 'workerId' };
        if (v.phone && !/^[0-9+()\-\s]{6,25}$/.test(v.phone)) return { msg: 'Enter a valid phone number.', field: 'phone' };
        return null;
      },
      bulkNames: ['source', 'status'],
      describe: function (r) { return r.name + ' (' + r.workerId + ')'; }
    },
    holidays: {
      title: 'Holiday', coll: 'holidays',
      fields: function (rec) {
        var f = [];
        if (!rec) f.push({ name: 'mode', label: 'Holiday Dates', type: 'select', required: true, wide: true, options: [['single', 'Single date'], ['range', 'Multiple dates (continuous holidays)']] });
        f.push({ name: 'date', label: 'Date', type: 'date', required: true });
        if (!rec) f.push({ name: 'dateTo', label: 'To Date', type: 'date', hidden: true });
        f.push(
          { name: 'name', label: 'Holiday Name', type: 'text', required: true, maxlength: 80, wide: true, hint: 'e.g. Eid, National Day' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        );
        return f;
      },
      defaults: function () { return { mode: 'single', date: todayStr() }; },
      validate: function (v, rec) {
        if (v.mode === 'range') {
          if (!isDate(v.dateTo)) return { msg: 'Enter a valid To Date.', field: 'dateTo' };
          if (v.dateTo < v.date) return { msg: 'To Date cannot be before the From Date.', field: 'dateTo' };
          if (datesBetween(v.date, v.dateTo).length > 62) return { msg: 'A range can be at most 62 days.', field: 'dateTo' };
          return null;
        }
        var dup = db.holidays.find(function (h) { return h.date === v.date && (!rec || h.id !== rec.id); });
        if (dup) return { msg: fmtDate(v.date) + ' is already added as a holiday (' + dup.name + ').', field: 'date' };
        return null;
      },
      normalize: function (v) { var o = Object.assign({}, v); delete o.mode; delete o.dateTo; return o; },
      customSave: function (v) {
        if (v.mode !== 'range') return null;
        var have = {}, added = 0, skipped = 0, now = new Date().toISOString();
        db.holidays.forEach(function (h) { have[h.date] = 1; });
        datesBetween(v.date, v.dateTo).forEach(function (d) {
          if (have[d]) { skipped++; return; }
          db.holidays.push({ id: uid(), createdAt: now, date: d, name: v.name, notes: v.notes });
          added++;
        });
        if (!added) return { err: 'Every date in that range is already added as a holiday.' };
        return { msg: added + ' holiday date(s) added' + skipNote(skipped, 0) + '.' };
      },
      bulkNames: ['name', 'notes'],
      describe: function (r) { return r.name + ' (' + r.date + ')'; }
    },
    outsiderWork: {
      title: 'Work Entry', coll: 'outsideWorkerWork', needs: NEED_WORKER, holidayNote: 'work',
      fields: function (rec) {
        var f = [personField('workerId', 'Worker', 'worker', workerOptions(rec && rec.workerId), rec)];
        if (!rec) f.push({ name: 'mode', label: 'Work Days', type: 'select', required: true, wide: true, options: [['single', 'Single day'], ['range', 'Multiple days (continuous work)']] });
        f.push({ name: 'date', label: 'Date', type: 'date', required: true });
        if (!rec) f.push({ name: 'dateTo', label: 'To Date', type: 'date', hidden: true });
        f.push(
          { name: 'type', label: 'Day Type', type: 'select', required: true, options: LEAVE_BUILTIN.slice() },
          { name: 'details', label: 'Work / Site Details', type: 'text', maxlength: 150, wide: true, fallback: '-', hint: 'Optional — saved as "-" if left empty' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        );
        return f;
      },
      defaults: function () { return { mode: 'single', date: todayStr(), type: 'Full Day' }; },
      validate: function (v, rec) {
        if (v.mode === 'range') {
          if (!isDate(v.dateTo)) return { msg: 'Enter a valid To Date.', field: 'dateTo' };
          if (v.dateTo < v.date) return { msg: 'To Date cannot be before the From Date.', field: 'dateTo' };
          if (datesBetween(v.date, v.dateTo).length > 62) return { msg: 'A range can be at most 62 days.', field: 'dateTo' };
          return null;
        }
        var hol = holidayInfo(v.date);
        if (hol && (!rec || rec.date !== v.date)) return { msg: fmtDate(v.date) + ' is a holiday (' + hol.name + '). Work days are not counted on holidays — add it as OT if they worked.', field: 'date' };
        var dup = db.outsideWorkerWork.find(function (x) { return x.workerId === v.workerId && x.date === v.date && (!rec || x.id !== rec.id); });
        if (dup) return { msg: 'This worker already has a work entry on that date. Edit the existing entry instead.', field: 'date' };
        if (otherEntry('outsideWorkerLeave', v.workerId, v.date)) return { msg: clashMsg(v.workerId, v.date, 'LEAVE'), field: 'date' };
        return null;
      },
      normalize: function (v) { var o = Object.assign({}, v); delete o.mode; delete o.dateTo; return o; },
      customSave: function (v, people) {
        var range = v.mode === 'range';
        if (!range && !people) return null;
        var ids = people || [v.workerId], dates = range ? datesBetween(v.date, v.dateTo) : [v.date];
        var have = {}, other = {}, added = 0, skipped = 0, holi = 0, clash = 0, now = new Date().toISOString();
        db.outsideWorkerWork.forEach(function (x) { have[x.workerId + '|' + x.date] = 1; });
        db.outsideWorkerLeave.forEach(function (x) { other[x.workerId + '|' + x.date] = 1; });
        ids.forEach(function (pid, pi) {
          dates.forEach(function (d) {
            if (isHoliday(d)) { if (!pi) holi++; return; }
            if (have[pid + '|' + d]) { skipped++; return; }
            if (other[pid + '|' + d]) { clash++; return; }
            db.outsideWorkerWork.push({ id: uid(), createdAt: now, workerId: pid, date: d, type: v.type, details: v.details, notes: v.notes });
            added++;
          });
        });
        if (!added) return { err: clash ? 'Nothing to add — those dates already have a LEAVE entry for the selected worker(s), or are holidays / existing work entries.' : 'Nothing to add — every date is a holiday or already has a work entry.' };
        return { msg: added + ' work day(s) added' + (people ? ' for ' + ids.length + ' worker(s)' : '') + skipNote(skipped, holi, clash) + '.', count: added };
      },
      bulkNames: ['date', 'type', 'details', 'notes'],
      bulkCheck: function (c, recs, sel) { return bulkDateCheck(c, recs, sel, db.outsideWorkerWork, 'workerId', 'worker', 'Work days', 'outsideWorkerLeave', 'LEAVE'); },
      describe: function (r) { return 'work of ' + workerName(r.workerId) + ' on ' + r.date; }
    },
    outsiderLeave: {
      title: 'Outside Worker Leave', coll: 'outsideWorkerLeave', needs: NEED_WORKER, holidayNote: 'leave',
      fields: function (rec) {
        var f = [personField('workerId', 'Worker', 'worker', workerOptions(rec && rec.workerId), rec)];
        if (!rec) f.push({ name: 'mode', label: 'Leave Dates', type: 'select', required: true, wide: true, options: [['single', 'Single date'], ['range', 'Multiple dates (continuous leave)']] });
        f.push({ name: 'date', label: 'Date', type: 'date', required: true });
        if (!rec) f.push({ name: 'dateTo', label: 'To Date', type: 'date', hidden: true });
        f.push(
          { name: 'type', label: 'Leave Type', type: 'select', required: true, options: LEAVE_BUILTIN.slice() },
          { name: 'reason', label: 'Reason', type: 'text', maxlength: 150, wide: true, fallback: '-', hint: 'Optional — saved as "-" if left empty' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        );
        return f;
      },
      defaults: function () { return { mode: 'single', date: todayStr(), type: 'Full Day' }; },
      validate: function (v, rec) {
        if (v.mode === 'range') {
          if (!isDate(v.dateTo)) return { msg: 'Enter a valid To Date.', field: 'dateTo' };
          if (v.dateTo < v.date) return { msg: 'To Date cannot be before the From Date.', field: 'dateTo' };
          if (datesBetween(v.date, v.dateTo).length > 62) return { msg: 'A leave range can be at most 62 days.', field: 'dateTo' };
          return null;
        }
        var hol = holidayInfo(v.date);
        if (hol && (!rec || rec.date !== v.date)) return { msg: fmtDate(v.date) + ' is a holiday (' + hol.name + '). Leave is not counted on holidays.', field: 'date' };
        var dup = db.outsideWorkerLeave.find(function (x) { return x.workerId === v.workerId && x.date === v.date && (!rec || x.id !== rec.id); });
        if (dup) return { msg: 'This worker already has a leave entry on that date. Edit the existing entry instead.', field: 'date' };
        if (otherEntry('outsideWorkerWork', v.workerId, v.date)) return { msg: clashMsg(v.workerId, v.date, 'WORK'), field: 'date' };
        return null;
      },
      normalize: function (v) { var o = Object.assign({}, v); delete o.mode; delete o.dateTo; return o; },
      customSave: function (v, people) {
        var range = v.mode === 'range';
        if (!range && !people) return null;
        var ids = people || [v.workerId], dates = range ? datesBetween(v.date, v.dateTo) : [v.date];
        var have = {}, other = {}, added = 0, skipped = 0, holi = 0, clash = 0, now = new Date().toISOString();
        db.outsideWorkerLeave.forEach(function (x) { have[x.workerId + '|' + x.date] = 1; });
        db.outsideWorkerWork.forEach(function (x) { other[x.workerId + '|' + x.date] = 1; });
        ids.forEach(function (pid, pi) {
          dates.forEach(function (d) {
            if (isHoliday(d)) { if (!pi) holi++; return; }
            if (have[pid + '|' + d]) { skipped++; return; }
            if (other[pid + '|' + d]) { clash++; return; }
            db.outsideWorkerLeave.push({ id: uid(), createdAt: now, workerId: pid, date: d, type: v.type, reason: v.reason, notes: v.notes });
            added++;
          });
        });
        if (!added) return { err: clash ? 'Nothing to add — those dates already have a WORK entry for the selected worker(s), or are holidays / existing leave entries.' : 'Nothing to add — every date is a holiday or already has a leave entry.' };
        return { msg: added + ' leave day(s) added' + (people ? ' for ' + ids.length + ' worker(s)' : '') + skipNote(skipped, holi, clash) + '.', count: added };
      },
      bulkNames: ['date', 'type', 'reason', 'notes'],
      bulkCheck: function (c, recs, sel) { return bulkDateCheck(c, recs, sel, db.outsideWorkerLeave, 'workerId', 'worker', 'Leave', 'outsideWorkerWork', 'WORK'); },
      describe: function (r) { return 'leave of ' + workerName(r.workerId) + ' on ' + r.date; }
    },
    outsiderOT: {
      title: 'Outside Worker OT', coll: 'outsideWorkerOT', needs: NEED_WORKER, holidayNote: 'ot',
      fields: function (rec) {
        return [
          personField('workerId', 'Worker', 'worker', workerOptions(rec && rec.workerId), rec),
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'type', label: 'OT Type', type: 'select', required: true, options: withCur(getOpts('workerOtTypes'), rec && rec.type, otLabel), editable: 'ot', addable: 'workerOtTypes', addHint: 'New OT type, e.g. Holiday OT' },
          { name: 'hours', label: 'Hours', type: 'number', required: true, positive: true, max: MAX_HOURS, step: '0.01', hint: 'e.g. 1.5, 2.5, 3.75' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { date: todayStr(), type: 'normal' }; },
      validate: function () { return null; },
      customSave: function (v, people) {
        if (!people) return null;
        var now = new Date().toISOString();
        people.forEach(function (p) { db.outsideWorkerOT.push({ id: uid(), createdAt: now, workerId: p, date: v.date, type: v.type, hours: v.hours, notes: v.notes }); });
        return { msg: 'OT added for ' + people.length + ' worker(s).' };
      },
      bulkNames: ['date', 'type', 'hours', 'notes'],
      describe: function (r) { return otLabel(r.type) + ' of ' + workerName(r.workerId) + ' on ' + r.date; }
    }
  };

  function personField(name, label, noun, options, rec) {
    if (rec) return { name: name, label: label, type: 'select', required: true, placeholder: 'Select ' + noun, options: options, wide: true };
    return { name: name, label: label, type: 'people', required: true, noun: noun, options: options, wide: true };
  }
  function peopleHtml(f, val) {
    var v = val == null ? '' : val;
    return '<div class="fld wide" data-fld="' + f.name + '"><span><span class="lbl">' + esc(f.label) + '</span> <b>*</b></span>' +
      '<select name="who" aria-label="Single or multiple"><option value="single">Single ' + esc(f.noun) + '</option><option value="multi">Multiple ' + esc(f.noun) + 's</option></select>' +
      '<div data-single><select name="' + f.name + '"><option value="">Select ' + esc(f.noun) + '</option>' + optionsHtml(f.options, v) + '</select></div>' +
      '<div class="multi hidden" data-multi-box><div class="multi-tools">' +
      '<input type="search" class="multi-search" placeholder="Search ' + esc(f.noun) + 's…" aria-label="Search list">' +
      '<button type="button" class="link-btn" data-action="multi-all">Select all</button>' +
      '<button type="button" class="link-btn" data-action="multi-none">Clear</button>' +
      '<span class="multi-count" data-multi-count>0 selected</span></div>' +
      '<div class="multi-list">' + f.options.map(function (o) {
        return '<label class="multi-item" data-text="' + esc(String(o[1]).toLowerCase()) + '"><input type="checkbox" data-multi value="' + esc(o[0]) + '"><span>' + esc(o[1]) + '</span></label>';
      }).join('') + '</div></div></div>';
  }
  function fieldHtml(f, val) {
    if (f.type === 'people') return peopleHtml(f, val);
    var v = val == null ? '' : val, input;
    if (f.type === 'select') {
      input = '<select name="' + f.name + '">' + (f.placeholder ? '<option value="">' + esc(f.placeholder) + '</option>' : '') +
        f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + (f.editable ? editControls(f) : '');
    } else if (f.type === 'textarea') {
      input = '<textarea name="' + f.name + '" rows="3" maxlength="500">' + esc(v) + '</textarea>';
    } else if (f.type === 'number') {
      input = '<input name="' + f.name + '" type="number" inputmode="decimal" min="0" step="' + (f.step || 'any') + '" value="' + esc(v) + '" placeholder="' + (f.hint ? esc(f.hint) : '0') + '">';
    } else {
      input = '<input name="' + f.name + '" type="' + f.type + '" value="' + esc(v) + '"' +
        (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + (f.hint ? ' placeholder="' + esc(f.hint) + '"' : '') + (f.list ? ' list="dl-' + f.name + '"' : '') + ' autocomplete="off">' +
        (f.list ? '<datalist id="dl-' + f.name + '">' + f.list.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' : '');
    }
    return '<label class="fld' + (f.wide ? ' wide' : '') + (f.hidden ? ' hidden' : '') + '" data-fld="' + f.name + '"><span><span class="lbl">' + esc(f.label) + '</span>' + (f.required ? ' <b>*</b>' : '') + '</span>' + input + '</label>';
  }

  function optionsHtml(opts, sel) {
    return opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(sel) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }
  function editControls(f) {
    var Lb = db.appSettings.labels, a = f.editable === 'ot' ? ['normal', 'sunday'] : ['src1', 'src2'];
    return '<div class="opt-links"><button type="button" class="link-btn" data-action="toggle-add" data-row="edit">&#9998; Edit names</button>' +
      '<button type="button" class="link-btn" data-action="toggle-add" data-row="add">+ Add new</button>' +
      (f.editable === 'src' ? '<button type="button" class="link-btn link-danger" data-action="toggle-add" data-row="del">&#128465; Delete names</button>' : '') + '</div>' +
      '<div class="addrow hidden" data-row="edit" data-edit="' + f.editable + '" data-select="' + f.name + '">' +
      '<input type="text" class="edit-a" maxlength="40" value="' + esc(Lb[a[0]]) + '" aria-label="First option name">' +
      '<input type="text" class="edit-b" maxlength="40" value="' + esc(Lb[a[1]]) + '" aria-label="Second option name">' +
      '<button type="button" class="btn btn-sm btn-accent" data-action="save-option">Save names</button></div>' +
      '<div class="addrow hidden" data-row="add" data-list="' + f.addable + '" data-select="' + f.name + '">' +
      '<input type="text" class="add-name" maxlength="40" placeholder="' + esc(f.addHint || 'New option') + '" autocomplete="off">' +
      '<button type="button" class="btn btn-sm btn-accent" data-action="add-option">Add</button></div>' +
      (f.editable === 'src' ? '<div class="addrow hidden delrow" data-row="del" data-select="' + f.name + '">' + srcDelHtml() + '</div>' : '');
  }
  function refreshDel(form) { var d = form && form.querySelector && form.querySelector('.delrow'); if (d) d.innerHTML = srcDelHtml(); }
  function srcDelHtml() {
    var Lb = db.appSettings.labels, o = db.appSettings.options, hid = o.hiddenSrc || [], items = [];
    if (hid.indexOf('src1') === -1) items.push(['src1', Lb.src1]);
    if (hid.indexOf('src2') === -1) items.push(['src2', Lb.src2]);
    (o.sources || []).forEach(function (n) { if (n !== Lb.src1 && n !== Lb.src2) items.push(['x', n]); });
    if (!items.length) return '<span class="muted">No sources left. Use + Add new.</span>';
    return items.map(function (it) {
      return '<span class="chip-del">' + esc(it[1]) + ' <button type="button" class="chip-x" data-action="del-option" data-key="' + it[0] + '" data-name="' + esc(it[1]) + '" aria-label="Delete ' + esc(it[1]) + '" title="Delete">&times;</button></span>';
    }).join('');
  }
  function delSource(el) {
    var key = el.dataset.key, name = el.dataset.name, form = el.closest('form'), row = el.closest('.addrow');
    var o = db.appSettings.options, Lb = db.appSettings.labels;
    var used = db.outsideWorkers.filter(function (w) { return w.source === name; }).length;
    if (used) { toast('"' + name + '" is used by ' + used + ' worker(s). Change their source first.', 'error'); return; }
    if (!el.dataset.arm) {
      el.dataset.arm = '1'; el.innerHTML = 'Delete?'; el.classList.add('armed');
      setTimeout(function () { if (el.isConnected) { delete el.dataset.arm; el.innerHTML = '&times;'; el.classList.remove('armed'); } }, 3000);
      return;
    }
    if (key === 'src1' || key === 'src2') { o.hiddenSrc = o.hiddenSrc || []; if (o.hiddenSrc.indexOf(key) === -1) o.hiddenSrc.push(key); }
    else o.sources = o.sources.filter(function (n) { return n !== name; });
    save('appSettings');
    var sel = form.elements[row.dataset.select], cur = sel.value;
    if (cur === name) cur = '';
    sel.innerHTML = '<option value="">Select source…</option>' + optionsHtml(getOpts('sources'), cur);
    sel.value = cur;
    row.innerHTML = srcDelHtml();
    populateSelects(); renderCurrent();
    toast('"' + name + '" deleted.');
  }
  function allNames(list) { return getOpts(list).map(function (o) { return o[1]; }); }
  function datesBetween(a, b) {
    var p = a.split('-').map(Number), q = b.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]), e = new Date(q[0], q[1] - 1, q[2]), out = [];
    while (d <= e) { out.push(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())); d.setDate(d.getDate() + 1); }
    return out;
  }
  function toggleAdd(btn) {
    var wrap = btn.closest('.fld'); if (!wrap) return;
    var row = wrap.querySelector('.addrow[data-row="' + btn.dataset.row + '"]');
    if (!row) return;
    $$('.addrow', wrap).forEach(function (r) { if (r !== row) r.classList.add('hidden'); });
    row.classList.toggle('hidden');
    var fi = row.querySelector('input'); if (!row.classList.contains('hidden') && fi) fi.focus();
  }
  function addOption(el) {
    var row = el.closest('.addrow'); if (!row) return;
    var list = row.dataset.list, form = el.closest('form'), inp = row.querySelector('.add-name');
    var name = inp.value.trim().replace(/\s+/g, ' ');
    if (!name) { inp.classList.add('invalid'); inp.focus(); toast('Enter a name first.', 'error'); return; }
    if (allNames(list).some(function (n) { return n.toLowerCase() === name.toLowerCase(); })) {
      inp.classList.add('invalid'); inp.focus(); toast('"' + name + '" already exists.', 'error'); return;
    }
    inp.classList.remove('invalid');
    var o = db.appSettings.options, val;
    if (list === 'sources') {
      var dk = ['src1', 'src2'].find(function (k) { return db.appSettings.labels[k].toLowerCase() === name.toLowerCase(); });
      if (dk) { o.hiddenSrc = (o.hiddenSrc || []).filter(function (k) { return k !== dk; }); val = db.appSettings.labels[dk]; }
      else { o.sources.push(name); val = name; }
    }
    else { val = 'x' + uid(); o[list].push({ id: val, name: name }); }
    save('appSettings');
    var sel = form.elements[row.dataset.select];
    sel.innerHTML = optionsHtml(withCur(getOpts(list), val, otLabel), val);
    sel.value = val;
    inp.value = ''; row.classList.add('hidden'); refreshDel(form);
    populateSelects();
    toast('"' + name + '" added and selected.');
  }
  function toggleRange(form, on) {
    var to = form.querySelector('[data-fld="dateTo"]'), lbl = form.querySelector('[data-fld="date"] .lbl');
    if (to) to.classList.toggle('hidden', !on);
    if (lbl) lbl.textContent = on ? 'From Date' : 'Date';
    if (on && form.elements.dateTo && !form.elements.dateTo.value && form.elements.date) form.elements.dateTo.value = form.elements.date.value;
  }
  function toggleWho(form, multi) {
    var s = form.querySelector('[data-single]'), m = form.querySelector('[data-multi-box]');
    if (s) s.classList.toggle('hidden', multi);
    if (m) m.classList.toggle('hidden', !multi);
  }
  function updateMultiCount(form) {
    var n = $$('input[data-multi]', form).filter(function (c) { return c.checked; }).length, box = form.querySelector('[data-multi-count]');
    if (box) box.textContent = n + ' selected';
  }
  function multiSet(el, on) {
    var wrap = el.closest('.fld');
    $$('.multi-item', wrap).forEach(function (it) {
      if (!on || !it.classList.contains('hidden')) it.querySelector('input').checked = !!on;
    });
    updateMultiCount(el.closest('form'));
  }
  function multiSearch(inp) {
    var q = inp.value.trim().toLowerCase();
    $$('.multi-item', inp.closest('.fld')).forEach(function (it) { it.classList.toggle('hidden', !!q && it.dataset.text.indexOf(q) === -1); });
  }

  /* ----- bulk select / edit / delete ----- */
  function selOf(kind) { return ui.sel[kind] || (ui.sel[kind] = {}); }
  function refreshBulk(kind) {
    var n = Object.keys(selOf(kind)).length, bar = $('[data-bulkbar="' + kind + '"]'), all = $('[data-sel-all="' + kind + '"]');
    if (bar) {
      bar.classList.toggle('hidden', !n);
      var c = bar.querySelector('.bulk-count'); if (c) c.textContent = n + ' selected';
    }
    if (all) {
      var boxes = $$('input[data-sel="' + kind + '"]'), k = boxes.filter(function (b) { return b.checked; }).length;
      all.checked = boxes.length > 0 && k === boxes.length;
      all.indeterminate = k > 0 && k < boxes.length;
    }
  }
  function onSelToggle(cb) {
    var kind = cb.dataset.sel, s = selOf(kind);
    if (cb.checked) s[cb.dataset.id] = true; else delete s[cb.dataset.id];
    var tr = cb.closest('tr'); if (tr) tr.classList.toggle('selected', !!cb.checked);
    refreshBulk(kind);
  }
  function setAllSel(kind, on) {
    var s = {};
    $$('input[data-sel="' + kind + '"]').forEach(function (c) {
      c.checked = on; if (on) s[c.dataset.id] = true;
      var tr = c.closest('tr'); if (tr) tr.classList.toggle('selected', on);
    });
    ui.sel[kind] = s;
    refreshBulk(kind);
  }
  function selRecords(kind) {
    var cfg = FORMS[kind];
    return Object.keys(selOf(kind)).map(function (id) { return db[cfg.coll].find(function (r) { return r.id === id; }); }).filter(Boolean);
  }
  function previewList(cfg, recs) {
    return '<ul class="bulk-list">' + recs.slice(0, 5).map(function (r) { return '<li>' + esc(cfg.describe(r)) + '</li>'; }).join('') +
      (recs.length > 5 ? '<li>…and ' + (recs.length - 5) + ' more</li>' : '') + '</ul>';
  }
  function cascadeCount(kind, set) {
    if (kind === 'employees') return db.leaves.concat(db.employeeOT, db.advances).filter(function (x) { return set[x.employeeId]; }).length;
    if (kind === 'outsiders') return db.outsideWorkerOT.concat(db.outsideWorkerWork, db.outsideWorkerLeave).filter(function (x) { return set[x.workerId]; }).length;
    return 0;
  }
  function removeRecords(kind, ids) {
    var cfg = FORMS[kind], set = {};
    ids.forEach(function (i) { set[i] = 1; });
    db[cfg.coll] = db[cfg.coll].filter(function (r) { return !set[r.id]; });
    save(cfg.coll); touch(cfg.coll, 'delete', ids.length, 'Bulk delete: ' + ids.length + ' record(s)');
    cascadeRemove(kind, set);
  }
  function cascadeRemove(kind, set) {
    var spec = kind === 'employees' ? [['leaves', 'employeeId'], ['employeeOT', 'employeeId'], ['advances', 'employeeId']]
      : kind === 'outsiders' ? [['outsideWorkerOT', 'workerId'], ['outsideWorkerWork', 'workerId'], ['outsideWorkerLeave', 'workerId']] : [];
    spec.forEach(function (p) {
      var before = db[p[0]].length;
      db[p[0]] = db[p[0]].filter(function (x) { return !set[x[p[1]]]; });
      save(p[0]);
      if (before !== db[p[0]].length) touch(p[0], 'delete', before - db[p[0]].length, 'Removed with deleted ' + (kind === 'employees' ? 'employee' : 'outside worker'));
    });
  }
  async function bulkDelete(kind) {
    var cfg = FORMS[kind], recs = selRecords(kind);
    if (!recs.length) { toast('Nothing selected.', 'error'); return; }
    var set = {}; recs.forEach(function (r) { set[r.id] = 1; });
    var casc = cascadeCount(kind, set);
    var ok = await confirmBox({
      title: 'Confirm bulk delete',
      message: 'Delete <strong>' + recs.length + '</strong> selected record(s)?' + previewList(cfg, recs) +
        (casc ? 'Their <strong>' + casc + '</strong> related record(s) will also be deleted.<br>' : '') + 'This cannot be undone.',
      okText: 'Delete ' + recs.length, danger: true
    });
    if (!ok) return;
    removeRecords(kind, recs.map(function (r) { return r.id; }));
    ui.sel[kind] = {};
    populateSelects(); renderCurrent();
    toast(recs.length + ' record(s) deleted.');
  }
  function bulkFields(cfg) {
    var names = cfg.bulkNames || [];
    return cfg.fields(null).filter(function (f) { return names.indexOf(f.name) !== -1; }).map(function (f) {
      var g = Object.assign({}, f);
      g.required = false; delete g.fallback; delete g.hidden; delete g.editable; delete g.addable;
      if (g.type === 'select') g.placeholder = '— No change —'; else g.hint = 'No change';
      return g;
    });
  }
  function bulkDateCheck(c, recs, sel, list, key, noun, label, otherColl, otherWhat) {
    if (!c.date) return null;
    var h = holidayInfo(c.date);
    if (h) return { msg: fmtDate(c.date) + ' is a holiday (' + h.name + '). ' + label + ' cannot be set on a holiday.', field: 'date' };
    var seen = {}, clash = 0;
    list.forEach(function (x) { if (!sel[x.id]) seen[x[key] + '|' + x.date] = 1; });
    recs.forEach(function (r) { var k = r[key] + '|' + c.date; if (seen[k]) clash++; else seen[k] = 1; });
    if (clash) return { msg: clash + ' of the selected record(s) would clash with another entry for the same ' + noun + ' on ' + fmtDate(c.date) + '.', field: 'date' };
    if (otherColl) {
      var bad = recs.filter(function (r) { return otherEntry(otherColl, r[key], c.date); });
      if (bad.length) return { msg: bad.length + ' of the selected ' + noun + '(s) already have a ' + otherWhat + ' entry on ' + fmtDate(c.date) + '. A worker cannot have work and leave on the same day.', field: 'date' };
    }
    return null;
  }
  function openBulkEdit(kind) {
    var cfg = FORMS[kind], recs = selRecords(kind);
    if (!cfg || !cfg.bulkNames) return;
    if (!recs.length) { toast('Nothing selected.', 'error'); return; }
    var fields = bulkFields(cfg), heading = 'Edit ' + recs.length + ' selected';
    openModal(
      '<form id="bulk-form" novalidate data-kind="' + kind + '">' +
      '<div class="modal-head"><h3>' + esc(heading) + '</h3><button type="button" class="icon-x" data-action="close-modal" aria-label="Close">&times;</button></div>' +
      '<div class="modal-body"><p class="note" style="margin-bottom:14px">Changes apply to all <strong>' + recs.length + '</strong> selected record(s). Leave a field empty to keep each record\'s current value.</p>' +
      previewList(cfg, recs) +
      '<div class="form-grid">' + fields.map(function (f) { return fieldHtml(f, ''); }).join('') + '</div></div>' +
      '<div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Apply to ' + recs.length + '</button></div></form>',
      { label: heading }
    );
  }
  function applyBulkEdit(form) {
    var kind = form.dataset.kind, cfg = FORMS[kind], recs = selRecords(kind), defs = bulkFields(cfg), changes = {};
    $$('.invalid', form).forEach(function (el) { el.classList.remove('invalid'); });
    function fail(name, msg) {
      var el = form.elements[name];
      if (el) { el.classList.add('invalid'); el.focus(); }
      toast(msg, 'error');
    }
    if (!recs.length) { toast('Nothing selected.', 'error'); return; }
    for (var i = 0; i < defs.length; i++) {
      var f = defs[i], el = form.elements[f.name], v = el ? String(el.value).trim() : '';
      if (!v) continue;
      if (f.type === 'date') {
        if (!isDate(v)) { fail(f.name, 'Enter a valid ' + f.label.toLowerCase() + '.'); return; }
        changes[f.name] = v;
      } else if (f.type === 'number') {
        var n = Number(v.replace(',', '.'));
        if (!isFinite(n)) { fail(f.name, f.label + ' must be a valid number.'); return; }
        if (n < 0) { fail(f.name, f.label + ' cannot be negative.'); return; }
        n = r2(n);
        if (f.positive && n <= 0) { fail(f.name, f.label + ' must be greater than 0.'); return; }
        if (f.max && n > f.max) { fail(f.name, f.label + ' cannot be more than ' + fmtNum(f.max) + '.'); return; }
        changes[f.name] = n;
      } else {
        changes[f.name] = v;
      }
    }
    if (!Object.keys(changes).length) { toast('Nothing to change — fill in at least one field.', 'error'); return; }
    if (cfg.bulkCheck) {
      var selSet = {}; recs.forEach(function (r) { selSet[r.id] = 1; });
      var err = cfg.bulkCheck(changes, recs, selSet);
      if (err) { fail(err.field, err.msg); return; }
    }
    var now = new Date().toISOString();
    recs.forEach(function (r) { Object.assign(r, changes, { updatedAt: now }); });
    save(cfg.coll); touch(cfg.coll, 'edit', recs.length, 'Bulk edit: ' + recs.length + ' record(s)');
    ui.sel[kind] = {};
    closeModal(); populateSelects(); renderCurrent();
    toast(recs.length + ' record(s) updated.');
  }
  function saveOption(el) {
    var row = el.closest('.addrow'); if (!row) return;
    var kind = row.dataset.edit, form = el.closest('form'), Lb = db.appSettings.labels;
    var ia = row.querySelector('.edit-a'), ib = row.querySelector('.edit-b');
    var a = ia.value.trim().replace(/\s+/g, ' '), b = ib.value.trim().replace(/\s+/g, ' ');
    ia.classList.remove('invalid'); ib.classList.remove('invalid');
    if (!a) { ia.classList.add('invalid'); ia.focus(); toast('Option names cannot be empty.', 'error'); return; }
    if (!b) { ib.classList.add('invalid'); ib.focus(); toast('Option names cannot be empty.', 'error'); return; }
    if (a.toLowerCase() === b.toLowerCase()) { ib.classList.add('invalid'); ib.focus(); toast('The two names must be different.', 'error'); return; }
    var ka = kind === 'ot' ? 'normal' : 'src1', kb = kind === 'ot' ? 'sunday' : 'src2', oldA = Lb[ka], oldB = Lb[kb];
    var extras = kind === 'src' ? db.appSettings.options.sources
      : db.appSettings.options.otTypes.concat(db.appSettings.options.workerOtTypes).map(function (x) { return x.name; });
    var clash = [a, b].find(function (n) { return extras.some(function (x) { return x.toLowerCase() === n.toLowerCase(); }); });
    if (clash) { ia.classList.add('invalid'); toast('"' + clash + '" already exists as an extra option.', 'error'); return; }
    if (kind === 'src') {
      var moved = false;
      db.outsideWorkers.forEach(function (w) {
        if (w.source === oldA) { w.source = a; moved = true; } else if (w.source === oldB) { w.source = b; moved = true; }
      });
      if (moved) save('outsideWorkers');
    }
    Lb[ka] = a; Lb[kb] = b;
    save('appSettings');
    var sel = form.elements[row.dataset.select], cur = sel.value;
    if (kind === 'src') cur = cur === oldA ? a : (cur === oldB ? b : cur);
    var list = kind === 'ot' ? (form.dataset.kind === 'outsiderOT' ? 'workerOtTypes' : 'otTypes') : 'sources';
    sel.innerHTML = optionsHtml(withCur(getOpts(list), cur, kind === 'ot' ? otLabel : null), cur);
    sel.value = cur;
    row.classList.add('hidden'); refreshDel(form);
    populateSelects(); renderCurrent();
    toast('Option names updated.');
  }

  var HOLIDAY_TIPS = {
    ot: 'OT will be counted and marked as Holiday OT.',
    leave: 'Leave is not counted on holidays.',
    work: 'Work days are not counted on holidays — add it as OT if they worked.'
  };
  function updateHolidayNote(form) {
    var cfg = form && form.dataset ? FORMS[form.dataset.kind] : null;
    if (!cfg || !cfg.holidayNote || !form.querySelector) return;
    var box = form.querySelector('[data-hol-note]'); if (!box) return;
    var dEl = form.elements && form.elements.date, d = dEl ? dEl.value : '';
    var h = isDate(d) ? holidayInfo(d) : null;
    if (!h) { box.classList.add('hidden'); box.textContent = ''; return; }
    var mEl = form.elements.mode, range = !!(mEl && mEl.value === 'range');
    var tip = cfg.holidayNote !== 'ot' && range ? 'It will be skipped automatically.' : HOLIDAY_TIPS[cfg.holidayNote];
    box.textContent = fmtDate(d) + ' is a holiday (' + h.name + '). ' + tip;
    box.classList.remove('hidden');
  }
  function openForm(kind, id, dup) {
    var cfg = FORMS[kind]; if (!cfg) return;
    var src = id ? db[cfg.coll].find(function (r) { return r.id === id; }) : null;
    if (id && !src) { toast('That record no longer exists.', 'error'); return; }
    var rec = dup ? null : src;
    if (!rec && cfg.needs) {
      var p = cfg.needs();
      if (p) { toast(p.msg, 'error'); location.hash = '#' + p.view; return; }
    }
    var vals;
    if (dup) {
      vals = Object.assign({}, src);
      delete vals.id; delete vals.createdAt; delete vals.updatedAt;
      if (kind === 'employees') vals.empId = '';
      if (kind === 'outsiders') vals.workerId = '';
      vals.mode = 'single';
    } else {
      vals = rec || (cfg.defaults ? cfg.defaults() : {});
    }
    var fields = cfg.fields(rec);
    var heading = (dup ? 'Duplicate ' : rec ? 'Edit ' : 'Add ') + cfg.title;
    openModal(
      '<form id="rec-form" novalidate data-kind="' + kind + '" data-id="' + esc(rec ? id : '') + '">' +
      '<div class="modal-head"><h3>' + esc(heading) + '</h3><button type="button" class="icon-x" data-action="close-modal" aria-label="Close">&times;</button></div>' +
      '<div class="modal-body">' + (dup ? '<p class="note" style="margin-bottom:14px">Copied from an existing entry. Change what you need, then save.</p>' : '') +
      (cfg.holidayNote ? '<div class="note hidden" data-hol-note style="margin-bottom:14px"></div>' : '') +
      '<div class="form-grid">' + fields.map(function (f) { return fieldHtml(f, vals[f.name]); }).join('') + '</div>' +
      '<p class="hint"><b style="color:var(--red)">*</b> Required</p></div>' +
      '<div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">' + (rec ? 'Save Changes' : 'Save') + '</button></div></form>',
      { label: heading }
    );
    updateHolidayNote($('#rec-form'));
  }

  function submitForm(form) {
    var kind = form.dataset.kind, id = form.dataset.id || '', cfg = FORMS[kind];
    var rec = id ? db[cfg.coll].find(function (r) { return r.id === id; }) : null;
    var fields = cfg.fields(rec), values = {};
    $$('.invalid', form).forEach(function (el) { el.classList.remove('invalid'); });
    function fail(f, msg) {
      var el = form.elements[f.name || f];
      if (el) { el.classList.add('invalid'); el.focus(); }
      toast(msg, 'error');
    }
    var multiIds = null, pf = fields.find(function (x) { return x.type === 'people'; });
    if (pf && !rec && form.elements.who && form.elements.who.value === 'multi') {
      multiIds = $$('input[data-multi]', form).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      if (!multiIds.length) { fail('who', 'Select at least one ' + pf.noun + '.'); return; }
    }
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i], el = form.elements[f.name], v = el ? String(el.value).trim() : '';
      if (f.type === 'people' && multiIds) { values[f.name] = ''; continue; }
      if (!v && f.fallback) v = f.fallback;
      if (f.required && !v) { fail(f, f.label + ' is required.'); return; }
      if (f.type === 'date' && v && !isDate(v)) { fail(f, 'Enter a valid ' + f.label.toLowerCase() + '.'); return; }
      if (f.type === 'number') {
        var n = Number(v.replace(',', '.'));
        if (!isFinite(n) || v === '') { fail(f, f.label + ' must be a valid number.'); return; }
        if (n < 0) { fail(f, f.label + ' cannot be negative.'); return; }
        n = r2(n);
        if (f.positive && n <= 0) { fail(f, f.label + ' must be greater than 0.'); return; }
        if (f.max && n > f.max) { fail(f, f.label + ' cannot be more than ' + fmtNum(f.max) + '.'); return; }
        values[f.name] = n;
      } else {
        values[f.name] = v;
      }
    }
    var err = cfg.validate(values, rec);
    if (err) { fail({ name: err.field }, err.msg); return; }
    if (cfg.customSave && !rec) {
      var res = cfg.customSave(values, multiIds);
      if (res) {
        if (res.err) { fail({ name: 'date' }, res.err); return; }
        save(cfg.coll); touch(cfg.coll, 'add', res.count || 1, res.msg); closeModal(); populateSelects(); renderCurrent(); toast(res.msg);
        return;
      }
    }
    if (cfg.normalize) values = cfg.normalize(values);
    var now = new Date().toISOString();
    var saved = rec;
    if (rec) Object.assign(rec, values, { updatedAt: now });
    else { saved = Object.assign({ id: uid(), createdAt: now }, values); db[cfg.coll].push(saved); }
    save(cfg.coll); touch(cfg.coll, rec ? 'edit' : 'add', 1, cfg.describe(saved));
    closeModal(); populateSelects(); renderCurrent();
    toast(cfg.title + (rec ? ' updated' : ' added') + ' successfully.');
  }

  async function deleteRecord(kind, id) {
    var cfg = FORMS[kind], rec = db[cfg.coll].find(function (r) { return r.id === id; });
    if (!rec) return;
    var msg = 'Delete <strong>' + esc(cfg.describe(rec)) + '</strong>? This cannot be undone.', cascade = 0;
    if (kind === 'employees') {
      cascade = db.leaves.filter(function (x) { return x.employeeId === id; }).length + db.employeeOT.filter(function (x) { return x.employeeId === id; }).length + db.advances.filter(function (x) { return x.employeeId === id; }).length;
      msg = 'Delete employee <strong>' + esc(cfg.describe(rec)) + '</strong>?' + (cascade ? ' Their <strong>' + cascade + '</strong> leave, OT and advance record(s) will also be deleted.' : '') +
        ' This cannot be undone.<br><br><span class="hint">Tip: set the status to Inactive instead to keep their history.</span>';
    } else if (kind === 'outsiders') {
      cascade = db.outsideWorkerOT.filter(function (x) { return x.workerId === id; }).length + db.outsideWorkerWork.filter(function (x) { return x.workerId === id; }).length + db.outsideWorkerLeave.filter(function (x) { return x.workerId === id; }).length;
      msg = 'Delete outside worker <strong>' + esc(cfg.describe(rec)) + '</strong>?' + (cascade ? ' Their <strong>' + cascade + '</strong> work, leave and OT record(s) will also be deleted.' : '') +
        ' This cannot be undone.<br><br><span class="hint">Tip: set the status to Inactive instead to keep their history.</span>';
    }
    var ok = await confirmBox({ title: 'Confirm delete', message: msg, okText: 'Delete', danger: true });
    if (!ok) return;
    var desc = cfg.describe(rec), one = {}; one[id] = 1;
    db[cfg.coll] = db[cfg.coll].filter(function (r) { return r.id !== id; });
    save(cfg.coll); touch(cfg.coll, 'delete', 1, desc);
    cascadeRemove(kind, one);
    populateSelects(); renderCurrent();
    toast(cfg.title + ' deleted.');
  }

  /* ================= Export / Import ================= */
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function buildBackup() {
    var data = {};
    ALL_KEYS.forEach(function (k) { data[k] = db[k]; });
    return { app: 'ameer-fire-safety', version: 1, exportedAt: new Date().toISOString(), data: data, activity: act() };
  }
  function exportJSON(viaDrive) {
    db.appSettings.lastBackup = new Date().toISOString();
    suppressAct++; save('appSettings'); suppressAct--;
    var name = 'ameer-fire-safety-backup-' + todayStr() + '.json';
    act().lastExport = { at: new Date().toISOString(), file: name, drive: !!viaDrive, by: adminName() };
    touch('backup', 'export', 1, 'Backup exported' + (viaDrive ? ' (Export to Drive)' : '') + ': ' + name);
    download(name, JSON.stringify(buildBackup(), null, 2), 'application/json');
    if (ui.view === 'backup') renderBackup();
    return name;
  }
  function exportToDrive() {
    var name = exportJSON(true);
    var w = window.open(driveUrl(), '_blank');
    if (w) { try { w.opener = null; } catch (e) { /* ignore */ } }
    toast(w ? 'Backup downloaded (' + name + '). Upload it to the Drive folder that just opened.'
      : 'Backup downloaded (' + name + '). The Drive tab was blocked — use the "Open Drive folder" button.', w ? 'success' : 'info');
  }
  function saveDriveLink(reset) {
    var inp = $('#drive-input'), v = reset ? DRIVE_URL : inp.value.trim();
    if (!reset && !/^https:\/\/(drive|docs)\.google\.com\/\S+$/i.test(v)) {
      inp.classList.add('invalid'); inp.focus();
      toast('Enter a valid Google Drive link (starts with https://drive.google.com/).', 'error'); return;
    }
    inp.classList.remove('invalid');
    db.appSettings.driveUrl = v;
    if (!save('appSettings')) return;
    inp.value = v; renderBackup();
    toast(reset ? 'Drive folder link reset to the default.' : 'Drive folder link saved.');
  }
  function importFromDrive() {
    var w = window.open(driveUrl(), '_blank');
    if (w) { try { w.opener = null; } catch (e) { /* ignore */ } }
    var steps = $('#drive-steps');
    steps.classList.remove('pulse'); void steps.offsetWidth; steps.classList.add('pulse');
    steps.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Download your backup JSON from Drive, then use "Select downloaded JSON file".', 'info');
  }

  function cleanList(key, list) {
    var out = [], skipped = 0;
    var dated = ['leaves', 'employeeOT', 'advances', 'outsideWorkerWork', 'outsideWorkerLeave', 'outsideWorkerOT', 'holidays'];
    list.forEach(function (r) {
      if (!r || typeof r !== 'object' || Array.isArray(r)) { skipped++; return; }
      var x = Object.assign({}, r);
      x.id = x.id ? String(x.id) : uid();
      if (dated.indexOf(key) !== -1 && !isDate(String(x.date || ''))) { skipped++; return; }
      if (key === 'employeeOT' || key === 'outsideWorkerOT') {
        var h = Number(x.hours);
        if (!isFinite(h) || h < 0 || !x.type || typeof x.type !== 'string') { skipped++; return; }
        x.hours = r2(h);
      }
      if (key === 'holidays' && !String(x.name || '').trim()) { skipped++; return; }
      if (key === 'advances') {
        var a = Number(x.amount);
        if (!isFinite(a) || a < 0) { skipped++; return; }
        x.amount = r2(a);
      }
      if (key === 'leaves' || key === 'outsideWorkerWork' || key === 'outsideWorkerLeave') x.type = x.type === 'Half Day' ? 'Half Day' : 'Full Day';
      out.push(x);
    });
    return { out: out, skipped: skipped };
  }
  function parseBackup(text) {
    var obj = JSON.parse(text);
    var data = obj && typeof obj === 'object' && obj.data && typeof obj.data === 'object' ? obj.data : obj;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('This is not a valid backup file.');
    var found = 0, skipped = 0, out = {};
    ALL_KEYS.forEach(function (k) {
      if (data[k] === undefined) { out[k] = defaultFor(k); return; }
      found++;
      if (k === 'appSettings') {
        var s = data[k] && typeof data[k] === 'object' && !Array.isArray(data[k]) ? data[k] : {};
        var cur = typeof s.currency === 'string' && s.currency.trim() && s.currency.length <= 6 ? s.currency.trim() : DEFAULT_SETTINGS.currency;
        out[k] = Object.assign({}, DEFAULT_SETTINGS, s, { currency: cur });
        out[k].options = normOptions(s.options);
        out[k].labels = normLabels(s.labels);
        out[k].weeklyOff = normWeekly(s.weeklyOff);
        out[k].driveUrl = normDrive(s.driveUrl);
        out[k].companyName = normCompany(s.companyName);
        out[k].companyLogo = normLogo(s.companyLogo);
        out[k].menuLabels = normMenu(s.menuLabels);
      } else {
        if (!Array.isArray(data[k])) throw new Error('"' + k + '" in this file is not a list — the backup looks damaged.');
        var c = cleanList(k, data[k]); out[k] = c.out; skipped += c.skipped;
      }
    });
    if (!found) throw new Error('No Ameer Fire and Safety data was found in this file.');
    return { data: out, skipped: skipped, activity: obj && typeof obj === 'object' && obj.activity ? normActivity(obj.activity) : null };
  }
  function handleImportFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onerror = function () { toast('Could not read that file.', 'error'); };
    reader.onload = function () {
      var parsed;
      try { parsed = parseBackup(String(reader.result)); }
      catch (e) { toast(e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message, 'error'); return; }
      var d = parsed.data;
      confirmBox({
        title: 'Restore backup?',
        message: 'This will <strong>replace all data currently in this browser</strong> with the backup:<br><br>' +
          d.employees.length + ' employees · ' + d.leaves.length + ' leave records · ' + d.employeeOT.length + ' OT records · ' + d.advances.length + ' advances · ' +
          d.outsideWorkers.length + ' outside workers · ' + d.outsideWorkerOT.length + ' outside worker OT records.' +
          (parsed.skipped ? '<br><br>' + parsed.skipped + ' invalid record(s) in the file will be skipped.' : '') +
          '<br><br><span class="hint">Download a backup of your current data first if you may need it.</span>',
        okText: 'Restore', danger: true
      }).then(function (ok) {
        if (!ok) return;
        suppressAct++; ALL_KEYS.forEach(function (k) { db[k] = d[k]; save(k); }); suppressAct--;
        if (parsed.activity) activity = parsed.activity;
        act().lastImport = { at: new Date().toISOString(), file: String(file.name || '').slice(0, 120), by: adminName() };
        touch('backup', 'import', 1, 'Backup restored from ' + (file.name || 'file'));
        migrateLegacy();
        applyBranding(); applyMenuLabels();
        populateSelects(); renderCurrent();
        toast('Backup restored successfully.');
      });
    };
    reader.readAsText(file);
  }
  async function clearAll() {
    var ok = await confirmBox({ title: 'Delete all data?', message: 'This permanently deletes <strong>every record</strong> stored in this browser. Make sure you have downloaded a backup.', okText: 'Delete Everything', danger: true });
    if (!ok) return;
    var ok2 = await confirmBox({ title: 'Are you absolutely sure?', message: 'All employees, leave, OT, advances and outside worker data will be erased.', okText: 'Yes, delete all', danger: true });
    if (!ok2) return;
    suppressAct++; ALL_KEYS.forEach(function (k) { db[k] = defaultFor(k); save(k); }); suppressAct--;
    touch('all', 'clear', 1, 'All data deleted');
    applyBranding(); applyMenuLabels();
    populateSelects(); renderCurrent();
    toast('All data deleted.');
  }

  /* ================= CSV ================= */
  function csvCell(v) {
    if (typeof v === 'number') return String(v);
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csvLine(a) { return a.map(csvCell).join(','); }
  function exportCsv(kind) {
    var f = ui.f.reports, m = vm(f.month), lines, name, Lb = db.appSettings.labels;
    if (kind === 'emp') {
      var rows = buildEmpReport(f);
      if (!rows.length) { toast('No employee data to export.', 'error'); return; }
      var t = empTotals(rows);
      var eo = otherOn('otTypes', t), eh = t.holiday > 0;
      lines = [[COMPANY], ['Employee Monthly Report'], ['Month', periodLabel(m)], ['Generated', todayStr()], [],
        ['Employee ID', 'Employee', 'Leave Days', Lb.normal, Lb.sunday].concat(eo ? ['Other OT'] : [], ['Total OT', 'Advance'], eh ? ['Holiday OT (incl.)'] : [])]
        .concat(rows.map(function (r) { return [r.e.empId, r.e.name, r.leave, r.ot.normal, r.ot.sunday].concat(eo ? [r.ot.other] : [], [r.ot.total, r.adv], eh ? [r.ot.holiday] : []); }))
        .concat([['TOTAL', '', t.leave, t.normal, t.sunday].concat(eo ? [t.other] : [], [t.total, t.adv], eh ? [t.holiday] : [])]);
      name = 'ameer-fire-safety-employee-report-' + (m || 'all-months') + '.csv';
    } else {
      var wrows = buildWorkerReport(f);
      if (!wrows.length) { toast('No outside worker data to export.', 'error'); return; }
      var wt = workerTotals(wrows);
      var wo = otherOn('workerOtTypes', wt), wh = wt.holiday > 0;
      lines = [[COMPANY], ['Outside Worker Monthly Report'], ['Month', periodLabel(m)], ['Generated', todayStr()], [],
        ['Worker ID', 'Worker', 'Source', 'Work Days', 'Leave Days', Lb.normal, Lb.sunday].concat(wo ? ['Other OT'] : [], ['Total OT'], wh ? ['Holiday OT (incl.)'] : [])]
        .concat(wrows.map(function (r) { return [r.w.workerId, r.w.name, r.w.source, r.days, r.leave, r.ot.normal, r.ot.sunday].concat(wo ? [r.ot.other] : [], [r.ot.total], wh ? [r.ot.holiday] : []); }))
        .concat([['TOTAL', '', '', wt.days, wt.leave, wt.normal, wt.sunday].concat(wo ? [wt.other] : [], [wt.total], wh ? [wt.holiday] : [])]);
      name = 'ameer-fire-safety-outside-worker-report-' + (m || 'all-months') + '.csv';
    }
    download(name, '\ufeff' + lines.map(csvLine).join('\r\n'), 'text/csv;charset=utf-8');
    toast('CSV exported: ' + name);
  }

  /* ================= Navigation ================= */
  function toggleMenu(force) {
    var open = typeof force === 'boolean' ? force : !$('#sidebar').classList.contains('open');
    $('#sidebar').classList.toggle('open', open);
    $('#scrim').classList.toggle('show', open);
  }
  function showView(v) {
    if (VIEWS.indexOf(v) === -1) v = 'dashboard';
    ui.view = v;
    ui.sel = {};
    $$('.view').forEach(function (s) { s.classList.toggle('active', s.id === 'view-' + v); });
    $$('#nav a').forEach(function (a) {
      var on = a.dataset.view === v;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#top-title').textContent = TITLES[v];
    document.title = TITLES[v] + ' — ' + COMPANY;
    toggleMenu(false);
    populateSelects();
    renderView(v);
    window.scrollTo(0, 0);
  }

  /* ================= Events ================= */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var a = el.dataset.action;
    switch (a) {
      case 'add': openForm(el.dataset.kind); break;
      case 'edit': openForm(el.dataset.kind, el.dataset.id); break;
      case 'duplicate': openForm(el.dataset.kind, el.dataset.id, true); break;
      case 'delete': deleteRecord(el.dataset.kind, el.dataset.id); break;
      case 'clear-filters': clearFilters(el.dataset.view); break;
      case 'all-months': ui.f[el.dataset.view].month = ''; syncFilterInputs(el.dataset.view); renderView(el.dataset.view); break;
      case 'toggle-menu': toggleMenu(); break;
      case 'close-modal': closeModal(); break;
      case 'toggle-add': toggleAdd(el); break;
      case 'save-option': saveOption(el); break;
      case 'add-option': addOption(el); break;
      case 'del-option': delSource(el); break;
      case 'export-json': toast('Backup downloaded: ' + exportJSON()); break;
      case 'import-json': $('#import-file').click(); break;
      case 'export-drive': exportToDrive(); break;
      case 'import-drive': importFromDrive(); break;
      case 'save-drive': saveDriveLink(false); break;
      case 'logout': logout(); break;
      case 'save-company': saveCompanyName(); break;
      case 'save-menu': saveMenuLabels(false); break;
      case 'reset-menu': saveMenuLabels(true); break;
      case 'pick-logo': $('#logo-file').click(); break;
      case 'reset-logo': resetLogo(); break;
      case 'save-auth': saveCredentials(); break;
      case 'auth-forgot': toggleForgot(); break;
      case 'auth-verify': verifySecurity(); break;
      case 'auth-setpw': setNewPassword(); break;
      case 'reset-drive': saveDriveLink(true); break;
      case 'print-report': window.print(); break;
      case 'csv-emp': exportCsv('emp'); break;
      case 'csv-out': exportCsv('out'); break;
      case 'clear-all': clearAll(); break;
      case 'multi-all': multiSet(el, true); break;
      case 'multi-none': multiSet(el, false); break;
      case 'bulk-all': setAllSel(el.dataset.kind, true); break;
      case 'bulk-clear': setAllSel(el.dataset.kind, false); break;
      case 'bulk-edit': openBulkEdit(el.dataset.kind); break;
      case 'bulk-delete': bulkDelete(el.dataset.kind); break;
    }
  });
  document.addEventListener('input', onFilterInput);
  document.addEventListener('input', function (e) { if (e.target.classList && e.target.classList.contains('multi-search')) multiSearch(e.target); });
  document.addEventListener('change', function (e) {
    onFilterInput(e);
    if (e.target.name === 'leaveWho') { ui.leaveWho = e.target.value === 'out' ? 'out' : 'emp'; ui.sel = {}; renderLeaves(); return; }
    if (e.target.name === 'mode' && e.target.form && e.target.form.id === 'rec-form') toggleRange(e.target.form, e.target.value === 'range');
    if (e.target.form && e.target.form.id === 'rec-form' && (e.target.name === 'date' || e.target.name === 'mode')) updateHolidayNote(e.target.form);
    if (e.target.name === 'who' && e.target.form && e.target.form.id === 'rec-form') toggleWho(e.target.form, e.target.value === 'multi');
    if (e.target.dataset && e.target.dataset.multi !== undefined && e.target.form) updateMultiCount(e.target.form);
    if (e.target.dataset && e.target.dataset.sel !== undefined) onSelToggle(e.target);
    if (e.target.dataset && e.target.dataset.selAll !== undefined) setAllSel(e.target.dataset.selAll, !!e.target.checked);
    if (e.target.dataset && e.target.dataset.weekday !== undefined) setWeekday(Number(e.target.dataset.weekday), !!e.target.checked);
    if (e.target.id === 'logo-file') { handleLogoFile(e.target.files[0]); e.target.value = ''; }
    if (e.target.id === 'import-file') { handleImportFile(e.target.files[0]); e.target.value = ''; }
    if (e.target.id === 'currency-input') {
      var c = e.target.value.trim().toUpperCase();
      if (!c) { toast('Currency label cannot be empty.', 'error'); e.target.value = db.appSettings.currency; return; }
      db.appSettings.currency = c; save('appSettings'); e.target.value = c;
      toast('Currency label saved.');
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id === 'rec-form') { e.preventDefault(); submitForm(e.target); }
    if (e.target.id === 'bulk-form') { e.preventDefault(); applyBulkEdit(e.target); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id && e.target.id.indexOf('rs-') === 0) { e.preventDefault(); if (e.target.id === 'rs-new' || e.target.id === 'rs-new2') setNewPassword(); else verifySecurity(); return; }
    if (e.key === 'Enter' && e.target.id === 'company-name') { e.preventDefault(); saveCompanyName(); return; }
    if (e.key === 'Enter' && e.target.id === 'drive-input') { e.preventDefault(); saveDriveLink(false); return; }
    if (e.key === 'Enter' && e.target.classList && (e.target.classList.contains('edit-a') || e.target.classList.contains('edit-b') || e.target.classList.contains('add-name'))) {
      e.preventDefault();
      if (e.target.classList.contains('add-name')) addOption(e.target); else saveOption(e.target);
      return;
    }
    if (e.key === 'Escape') { if ($('#modal-root').classList.contains('open')) closeModal(); else toggleMenu(false); }
  });
  window.addEventListener('hashchange', function () { showView(location.hash.slice(1)); });
  window.addEventListener('storage', function (e) {
    if (e.key === null || ALL_KEYS.indexOf(e.key) !== -1) { loadAll(); populateSelects(); renderCurrent(); }
  });

  /* ================= Init ================= */
  var appStarted = false;
  function startApp() {
    if (appStarted) return; appStarted = true;
    document.body.classList.remove('locked');
    $('#auth-gate').classList.add('hidden');
    Object.keys(FILTER_DEFAULTS).forEach(syncFilterInputs);
    showView(location.hash.slice(1));
  }

  /* ================= Login (screen lock) =================
     Frontend-only: the username and a salted password hash are kept in this browser (key "appAuth",
     never included in backups). This keeps casual users out; it is not server-grade security. */
  var AUTH_USER = 'AMEERFIRE', AUTH_SALT = 'ameerfire-static-v1', AUTH_ITER = 20000;
  var AUTH_HASH = '090af637c89cbbd85df1dbe8b828dfbdb532f447d19c86f202d8742db76ba6b7';
  var SEC_SALT = 'ameerfire-sec-v1';
  var SEC_HASH = { name: 'd27865ebda21eb260b08a325a5a61c72708b16da96f60202f4847af4835a1769', email: '19c6a87d1d05fd456e6a05ccb7c12573c7891edc37d45d5e1a31f68ad21e965d', phone: '59fe0bf1724c7b79f3720eb89ea6274d44c0d8b697ac82700b37454d03691789', eid: '57f3c2936063d8377439e5a6dbbc7cad1f7aef542bda79ac26a9c9a27841df78' };
  /* Pure-JS SHA-256 so login works identically in every browser/context (no dependency on crypto.subtle). */
  var K256 = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  function sha256(msg) {
    var H0 = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], l = msg.length, n = ((l + 9 + 63) >> 6) << 6, p = new Uint8Array(n), w = new Array(64), i, j;
    p.set(msg); p[l] = 0x80;
    var bits = l * 8; p[n - 4] = (bits >>> 24) & 255; p[n - 3] = (bits >>> 16) & 255; p[n - 2] = (bits >>> 8) & 255; p[n - 1] = bits & 255;
    for (var o = 0; o < n; o += 64) {
      for (i = 0; i < 16; i++) w[i] = (p[o + 4 * i] << 24) | (p[o + 4 * i + 1] << 16) | (p[o + 4 * i + 2] << 8) | p[o + 4 * i + 3];
      for (i = 16; i < 64; i++) {
        var a0 = w[i - 15], a1 = w[i - 2];
        var s0 = ((a0 >>> 7) | (a0 << 25)) ^ ((a0 >>> 18) | (a0 << 14)) ^ (a0 >>> 3), s1 = ((a1 >>> 17) | (a1 << 15)) ^ ((a1 >>> 19) | (a1 << 13)) ^ (a1 >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H0[0], b = H0[1], c = H0[2], d = H0[3], e = H0[4], f = H0[5], g = H0[6], hh = H0[7];
      for (j = 0; j < 64; j++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)), ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K256[j] + w[j]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)), mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H0[0] = (H0[0] + a) | 0; H0[1] = (H0[1] + b) | 0; H0[2] = (H0[2] + c) | 0; H0[3] = (H0[3] + d) | 0;
      H0[4] = (H0[4] + e) | 0; H0[5] = (H0[5] + f) | 0; H0[6] = (H0[6] + g) | 0; H0[7] = (H0[7] + hh) | 0;
    }
    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) { out[4 * i] = H0[i] >>> 24; out[4 * i + 1] = (H0[i] >>> 16) & 255; out[4 * i + 2] = (H0[i] >>> 8) & 255; out[4 * i + 3] = H0[i] & 255; }
    return out;
  }
  function utf8(s) {
    s = unescape(encodeURIComponent(String(s)));
    var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b;
  }
  function concatB(a, b) { var r = new Uint8Array(a.length + b.length); r.set(a); r.set(b, a.length); return r; }
  function hex(b) { var s = ''; for (var i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2); return s; }
  function hashPw(pw, salt, iter) {
    var sb = utf8(salt), x = sha256(utf8(salt + '|' + pw));
    for (var i = 1; i < (iter || AUTH_ITER); i++) x = sha256(concatB(x, sb));
    return hex(x);
  }
  function newSalt() {
    try { var a = new Uint8Array(12); window.crypto.getRandomValues(a); return hex(a); } catch (e) { return String(Date.now()) + String(Math.random()).slice(2); }
  }
  /* The login is fixed (AMEERFIRE). A password changed through "Forgot password" / Login & Security
     is stored (salted hash only) under appAuth2 and replaces the built-in password in this browser. */
  function getAuth() {
    try {
      var a = JSON.parse(localStorage.getItem('appAuth2'));
      if (a && a.salt && a.hash) return { user: AUTH_USER, salt: String(a.salt), hash: String(a.hash) };
    } catch (e) { /* ignore */ }
    return { user: AUTH_USER, salt: AUTH_SALT, hash: AUTH_HASH };
  }
  function setPassword(pw) {
    var salt = newSalt();
    try { localStorage.setItem('appAuth2', JSON.stringify({ salt: salt, hash: hashPw(pw, salt) })); return true; } catch (e) { return false; }
  }
  function secNorm(k, v) {
    v = String(v || '').trim().toLowerCase();
    if (k === 'name') return v.replace(/\s+/g, ' ');
    if (k === 'email') return v.replace(/\s+/g, '');
    var d = v.replace(/\D+/g, '');
    if (k === 'phone') { if (d.indexOf('00971') === 0) d = d.slice(5); else if (d.indexOf('971') === 0) d = d.slice(3); if (d && d.charAt(0) !== '0') d = '0' + d; }
    return d;
  }
  function secOk(k, v) { var n = secNorm(k, v); return !!n && hashPw(n, SEC_SALT + '-' + k, 5000) === SEC_HASH[k]; }
  var authFails = 0, secFails = 0, secVerified = false;
  function showGate() {
    var f = $('#auth-form');
    $('#auth-title').textContent = 'Sign in';
    $('#auth-sub').textContent = 'Enter your username and password to continue.';
    f.reset(); $('#auth-err').textContent = '';
    $('#auth-reset-box').classList.add('hidden'); secVerified = false;
    $('#auth-gate').classList.remove('hidden');
    document.body.classList.add('locked');
    setTimeout(function () { f.elements.user.focus(); }, 30);
  }
  function authErr(msg, field) { $('#auth-err').textContent = msg; if (field) field.focus(); }
  function onAuthSubmit(e) {
    e.preventDefault();
    var f = e.target, user = f.elements.user.value.trim(), pw = f.elements.pass.value, btn = $('#auth-submit');
    if (!user) return authErr('Enter your username.', f.elements.user);
    if (!pw) return authErr('Enter your password.', f.elements.pass);
    var a = getAuth(); btn.disabled = true;
    var good = user.toLowerCase() === a.user.toLowerCase() && hashPw(pw, a.salt) === a.hash;
    setTimeout(function () {
      btn.disabled = false;
      if (good) { authFails = 0; sessionOn(f.elements.remember.checked); startApp(); return; }
      authFails++; f.elements.pass.value = '';
      authErr('Wrong username or password.' + (authFails >= 3 ? ' (Attempt ' + authFails + ')' : ''), f.elements.pass);
    }, Math.min(authFails, 5) * 700);
  }
  function toggleForgot() {
    var box = $('#auth-reset-box'); box.classList.toggle('hidden');
    $('#auth-err').textContent = '';
    if (!box.classList.contains('hidden')) { secVerified = false; $('#rs-step1').classList.remove('hidden'); $('#rs-step2').classList.add('hidden'); $('#rs-name').focus(); }
  }
  function verifySecurity() {
    var v = { name: $('#rs-name').value, email: $('#rs-email').value, phone: $('#rs-phone').value, eid: $('#rs-eid').value };
    if (!v.name.trim() || !v.email.trim() || !v.phone.trim() || !v.eid.trim()) { authErr('Answer all four security questions.'); return; }
    var good = ['name', 'email', 'phone', 'eid'].map(function (k) { return secOk(k, v[k]); }).every(Boolean);
    var btn = $('#rs-verify'); btn.disabled = true;
    setTimeout(function () {
      btn.disabled = false;
      if (!good) { secFails++; authErr('Security answers do not match.' + (secFails >= 3 ? ' (Attempt ' + secFails + ')' : '')); return; }
      secFails = 0; secVerified = true; authErr('');
      $('#rs-step1').classList.add('hidden'); $('#rs-step2').classList.remove('hidden'); $('#rs-new').focus();
    }, Math.min(secFails, 5) * 1000);
  }
  function setNewPassword() {
    if (!secVerified) { authErr('Verify the security answers first.'); return; }
    var p = $('#rs-new').value, p2 = $('#rs-new2').value;
    if (p.length < 6) { authErr('New password must be at least 6 characters.', $('#rs-new')); return; }
    if (p !== p2) { authErr('The two passwords do not match.', $('#rs-new2')); return; }
    if (!setPassword(p)) { authErr('Could not save — browser storage is blocked.'); return; }
    ['rs-name', 'rs-email', 'rs-phone', 'rs-eid', 'rs-new', 'rs-new2'].forEach(function (id) { $('#' + id).value = ''; });
    secVerified = false; authFails = 0;
    $('#auth-reset-box').classList.add('hidden');
    $('#auth-err').textContent = 'Password changed. Sign in with the new password.';
    $('#auth-form').elements.pass.focus();
  }
  function sessionOn(remember) {
    try { sessionStorage.setItem('authOk', '1'); } catch (e) { /* ignore */ }
    try { if (remember) localStorage.setItem('authRemember', '1'); else localStorage.removeItem('authRemember'); } catch (e) { /* ignore */ }
  }
  function sessionIsOn() {
    try { return sessionStorage.getItem('authOk') === '1' || localStorage.getItem('authRemember') === '1'; } catch (e) { return false; }
  }
  function logout() {
    try { sessionStorage.removeItem('authOk'); localStorage.removeItem('authRemember'); } catch (e) { /* ignore */ }
    location.reload();
  }
  var DEFAULT_LOGO_HTML = {};
  function applyBranding() {
    var s = db.appSettings; COMPANY = normCompany(s.companyName);
    var logo = normLogo(s.companyLogo);
    ['brand-logo', 'gate-logo'].forEach(function (id) {
      var el = $('#' + id); if (!el) return;
      if (DEFAULT_LOGO_HTML[id] == null) DEFAULT_LOGO_HTML[id] = el.innerHTML;
      el.innerHTML = logo ? '<img src="' + logo + '" alt="">' : DEFAULT_LOGO_HTML[id];
      el.classList.toggle('custom', !!logo);
    });
    ['brand-name', 'gate-name'].forEach(function (id) { var el = $('#' + id); if (el) el.textContent = COMPANY; });
    var fav = document.querySelector('link[rel="icon"]');
    if (fav && fav.getAttribute) { if (fav.dataset.def == null) fav.dataset.def = fav.getAttribute('href'); fav.setAttribute('href', logo || fav.dataset.def); }
    document.title = (ui.view && TITLES[ui.view] ? TITLES[ui.view] : 'Dashboard') + ' — ' + COMPANY;
  }
  var DEFAULT_TITLES = null;
  function applyMenuLabels() {
    if (!DEFAULT_TITLES) DEFAULT_TITLES = Object.assign({}, TITLES);
    $$('[data-lbl]').forEach(function (el) { el.textContent = menuLabel(el.dataset.lbl); });
    VIEWS.forEach(function (v) {
      var custom = db.appSettings.menuLabels && db.appSettings.menuLabels[v];
      TITLES[v] = custom || DEFAULT_TITLES[v];
      var h2 = document.querySelector('#view-' + v + ' .view-head h2');
      if (h2) { if (h2.dataset.def == null) h2.dataset.def = h2.textContent; h2.textContent = custom || h2.dataset.def; }
    });
    var tt = $('#top-title'); if (tt && TITLES[ui.view]) tt.textContent = TITLES[ui.view];
    document.title = (TITLES[ui.view] || 'Dashboard') + ' — ' + COMPANY;
  }
  function renderMenuCard() {
    var g = $('#menulabels-grid'); if (!g) return;
    if (g.contains && g.contains(document.activeElement)) return;
    g.innerHTML = MENU_GROUPS.map(function (grp) {
      return '<div class="wide ml-group">' + esc(grp[0]) + '</div>' + grp[1].map(function (k) {
        return '<label class="fld"><span class="lbl">' + esc(MENU_DEFAULTS[k]) + (MENU_HINT[k] ? ' <span class="hint">(' + esc(MENU_HINT[k]) + ')</span>' : '') + '</span>' +
          '<input type="text" maxlength="30" data-menu="' + k + '" value="' + esc(menuLabel(k)) + '" placeholder="' + esc(MENU_DEFAULTS[k]) + '" autocomplete="off"></label>';
      }).join('');
    }).join('');
  }
  function saveMenuLabels(reset) {
    var m = {};
    if (!reset) $$('[data-menu]').forEach(function (i) { m[i.dataset.menu] = i.value; });
    db.appSettings.menuLabels = normMenu(m);
    if (!save('appSettings')) return;
    applyMenuLabels(); var g = $('#menulabels-grid'); if (g) { g.innerHTML = ''; } renderMenuCard();
    toast(reset ? 'Names reset to defaults.' : 'Names saved.');
  }
  function renderCompanyCard() {
    var n = $('#company-name'), p = $('#logo-preview'); if (!n) return;
    if (document.activeElement !== n) n.value = COMPANY;
    var lg = normLogo(db.appSettings.companyLogo);
    p.innerHTML = lg ? '<img src="' + lg + '" alt="Logo">' : '<span class="muted">Default logo</span>';
  }
  function saveCompanyName() {
    var n = $('#company-name'), v = n.value.trim().replace(/\s+/g, ' ');
    if (!v) { n.classList.add('invalid'); n.focus(); toast('Company name cannot be empty.', 'error'); return; }
    n.classList.remove('invalid');
    db.appSettings.companyName = v.slice(0, 60);
    if (!save('appSettings')) return;
    applyBranding(); renderCompanyCard(); renderCurrent();
    toast('Company name saved.');
  }
  function handleLogoFile(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) { toast('Choose a PNG, JPG, WEBP, GIF or SVG image.', 'error'); return; }
    if (file.size > 4 * 1024 * 1024) { toast('Image is too large (max 4 MB).', 'error'); return; }
    var rd = new FileReader();
    rd.onerror = function () { toast('Could not read that image.', 'error'); };
    rd.onload = function () {
      var img = new Image();
      img.onerror = function () { toast('That image could not be opened.', 'error'); };
      img.onload = function () {
        var w = img.naturalWidth || 256, hh = img.naturalHeight || 256, k = Math.min(1, 256 / Math.max(w, hh));
        var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(hh * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var url = ''; try { url = c.toDataURL('image/png'); } catch (e) { /* ignore */ }
        if (!normLogo(url)) { toast('Could not process that image — try a PNG or JPG.', 'error'); return; }
        db.appSettings.companyLogo = url;
        if (!save('appSettings')) return;
        applyBranding(); renderCompanyCard();
        toast('Logo updated.');
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function resetLogo() {
    db.appSettings.companyLogo = ''; if (!save('appSettings')) return;
    applyBranding(); renderCompanyCard(); toast('Logo removed — default logo restored.');
  }
  function renderAuthCard() {
    var u = $('#sec-user'); if (u) u.value = AUTH_USER;
  }
  function saveCredentials() {
    var a = getAuth(), cur = $('#sec-cur'), p = $('#sec-new'), p2 = $('#sec-new2');
    function bad(m, el) { toast(m, 'error'); if (el) { el.classList.add('invalid'); el.focus(); } }
    [cur, p, p2].forEach(function (x) { x.classList.remove('invalid'); });
    if (!cur.value) return bad('Enter your current password.', cur);
    if (hashPw(cur.value, a.salt) !== a.hash) return bad('Current password is wrong.', cur);
    if (p.value.length < 6) return bad('New password must be at least 6 characters.', p);
    if (p.value !== p2.value) return bad('The two new passwords do not match.', p2);
    if (!setPassword(p.value)) return toast('Could not save — browser storage is blocked.', 'error');
    cur.value = ''; p.value = ''; p2.value = '';
    toast('Password updated.');
  }
  var APP_VERSION = '20261026b';
  function staleCheck() {
    if (typeof document.getElementById !== 'function') return false;
    var meta = document.querySelector('meta[name="app-version"]');
    var need = ['auth-form', 'auth-gate', 'menulabels-grid', 'activity-body', 'leave-out-pane', 'outsiderLeave-table'];
    var missing = need.some(function (id) { return !document.getElementById(id); });
    if (!missing && meta && meta.getAttribute('content') === APP_VERSION) return false;
    var d = document.createElement('div'); d.className = 'banner stale-banner';
    d.innerHTML = 'This browser is showing an <strong>older cached copy</strong> of the app files. Press <strong>Ctrl + Shift + R</strong> (Mac: Cmd + Shift + R) to refresh. ' +
      '<button type="button" onclick="location.reload()">Reload now</button>';
    document.body.insertBefore(d, document.body.firstChild);
    return missing;
  }
  function init() {
    if (staleCheck()) return;
    $$('[data-ico]').forEach(function (el) { el.innerHTML = svg(el.dataset.ico); });
    if (!storageWorks()) $('#storage-warning').classList.remove('hidden');
    loadAll();
    applyBranding(); applyMenuLabels();
    $('#auth-form').addEventListener('submit', onAuthSubmit);
    if (sessionIsOn()) startApp(); else showGate();
  }
  init();
})();
