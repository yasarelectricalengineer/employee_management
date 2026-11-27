/* Ameer Fire and Safety — Employee, Leave, OT & Advance Management
   Frontend-only. All data is stored in this browser's localStorage. */
(function () {
  'use strict';

  /* ================= Constants ================= */
  var MENU_DEFAULTS = {
    dashboard: 'Dashboard', employees: 'Employees', leaves: 'Leave', ot: 'Employee OT', advances: 'Advance', deductions: 'Deductions', holidays: 'Holidays',
    sepOutside: 'Outside Workers', outsiders: 'Outside Workers', outsiderWork: 'Outside Worker Work', outsiderLeave: 'Outside Worker Leave', outsiderOT: 'Outside Worker OT', outsiderSalary: 'Outside Worker Salary',
    sepOutput: 'Output', salary: 'Salary Calculator', salReport: 'Salary Report', attSheet: 'Attendance Sheet', vouchers: 'Vouchers', reports: 'Monthly Reports', activity: 'Activity Log', backup: 'Backup & Drive',
    tagline: 'Staff · Leave · OT · Advance', whoEmp: 'Company Employee', whoOut: 'Outside Employee'
  };
  var MENU_GROUPS = [['Main menu', ['dashboard', 'employees', 'leaves', 'ot', 'advances', 'deductions', 'holidays']], ['Outside workers section', ['sepOutside', 'outsiders', 'outsiderWork', 'outsiderLeave', 'outsiderOT', 'outsiderSalary']],
    ['Output section', ['sepOutput', 'salary', 'salReport', 'attSheet', 'vouchers', 'reports', 'activity', 'backup']], ['Other labels', ['tagline', 'whoEmp', 'whoOut']]];
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
  function normCalc(c) {
    c = c && typeof c === 'object' ? c : {};
    function n(v, d, mx) { v = Number(v); return isFinite(v) && v > 0 && v <= mx ? v : d; }
    function fl(v) { return !(v === false || v === 'false' || v === 0); }
    var dd = Math.round(Number(c.days));
    return { days: dd >= 1 && dd <= 31 ? dd : 30, hpd: n(c.hpd, 8, 24), mulN: n(c.mulN, 1, 10), mulS: n(c.mulS, 1.5, 10), ob: fl(c.ob), oa: fl(c.oa), lb: fl(c.lb), la: fl(c.la) };
  }
  function normEdits(m) {
    var r = {}, n = 0;
    if (!m || typeof m !== 'object' || Array.isArray(m)) return r;
    Object.keys(m).forEach(function (k) {
      if (n > 5000 || !/^(sal|att)\|\d{4}-(0[1-9]|1[0-2])\|.{1,40}$/.test(k)) return;
      var v = m[k]; if (!v || typeof v !== 'object' || Array.isArray(v)) return;
      var o = {}, any = false, isSal = k.slice(0, 3) === 'sal';
      Object.keys(v).forEach(function (f) {
        if (isSal) { if (/^(wd|cl|al|hr|sp|to|ts|ad|ov)$/.test(f) && v[f] !== '' && v[f] !== null && isFinite(Number(v[f]))) { o[f] = Number(v[f]); any = true; } }
        else if (/^\d{1,2}$/.test(f) && typeof v[f] === 'string' && v[f].length <= 12) { o[f] = v[f]; any = true; }
      });
      if (any) { r[k] = o; n++; }
    });
    return r;
  }
  var DEFAULT_COMPANY = 'Ameer Fire and Safety';
  var COMPANY = DEFAULT_COMPANY;
  var DRIVE_URL = 'https://drive.google.com/drive/folders/12FOBPx6i20ETWm7WgNl1muJILucahRjl?usp=drive_link';
  var DATA_KEYS = ['employees', 'leaves', 'employeeOT', 'advances', 'outsideWorkers', 'outsideWorkerWork', 'outsideWorkerLeave', 'outsideWorkerOT', 'outsideWorkerSalary', 'deductions', 'holidays'];
  var ALL_KEYS = DATA_KEYS.concat(['appSettings']);
  var OT_TYPES = { normal: 'Normal Hour OT', sunday: 'Sunday / Special OT', night: 'Night OT' };
  var DEFAULT_SETTINGS = { currency: 'AED', lastBackup: null, driveUrl: DRIVE_URL, companyName: DEFAULT_COMPANY, companyLogo: '', salaryDate: '', salaryCalc: { days: 30, hpd: 8, mulN: 1, mulS: 1.5, ob: true, oa: true, lb: true, la: true }, reportEdits: {}, voucher: { pvNext: 1001, letterhead: '' } };
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
  var VIEWS = ['dashboard', 'employees', 'leaves', 'ot', 'advances', 'deductions', 'holidays', 'outsiders', 'outsiderWork', 'outsiderLeave', 'outsiderOT', 'outsiderSalary', 'salary', 'salReport', 'attSheet', 'vouchers', 'reports', 'activity', 'backup'];
  var TITLES = {
    dashboard: 'Dashboard', employees: 'Employees', leaves: 'Leave Management', ot: 'Employee OT',
    advances: 'Advances', deductions: 'Deductions', holidays: 'Holidays', outsiders: 'Outside Workers', outsiderWork: 'Outside Worker Work', outsiderLeave: 'Outside Worker Leave', outsiderOT: 'Outside Worker OT', outsiderSalary: 'Outside Worker Salary',
    salary: 'Salary Calculator', salReport: 'Salary Report', attSheet: 'Attendance Sheet', vouchers: 'Vouchers & Pay Slips', reports: 'Monthly Reports', activity: 'Activity & Last Updated', backup: 'Backup & Google Drive'
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
    minus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h2M14 18h2"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
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
  function isEx(e) { return !!e && (e.status === 'Ex-Employee' || (!!e.leavingDate && String(e.leavingDate) <= todayStr())); }
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
        st.salaryDate = isDate(String(st.salaryDate || '')) ? String(st.salaryDate) : '';
        st.salaryCalc = normCalc(st.salaryCalc);
        st.reportEdits = normEdits(st.reportEdits);
        st.voucher = normVoucher(st.voucher);
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
    outsideWorkerSalary: 'Outside Worker Salary', deductions: 'Deductions',
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
  function adminName() { return 'Admin'; }
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
    employees: function () { return { q: '', status: '', dept: '', tab: 'current' }; },
    leaves: function () { return { month: '', emp: '', type: '', q: '' }; },
    ot: function () { return { month: '', emp: '', type: '', q: '' }; },
    advances: function () { return { month: '', emp: '', q: '', status: 'pending' }; },
    deductions: function () { return { month: '', emp: '', type: '', q: '' }; },
    outsiderSalary: function () { return { month: '', worker: '', source: '', q: '' }; },
    salReport: function () { return { month: todayStr().slice(0, 7) }; },
    attSheet: function () { return { month: todayStr().slice(0, 7) }; },
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
    var advNC = db.advances.filter(function (a) { return !isCleared(a); });
    var dedList = db.deductions.filter(function (d) { return inMonth(d, m); });
    var salBal = Object.keys(latestSalary(db.outsideWorkerSalary)).reduce(function (s, k) { return s + (Number(latestSalary(db.outsideWorkerSalary)[k].balance) || 0); }, 0);
    var activeE = db.employees.filter(function (e) { return e.status === 'Active' && !isEx(e); }).length;
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
      stat('Advance Not Cleared', money(sumAdv(advNC)), fmtNum(advNC.length) + ' entr' + (advNC.length === 1 ? 'y' : 'ies') + ' · all months', 'd') +
      stat('Deductions', money(sumAdv(dedList)), fmtNum(dedList.length) + ' record(s)', 'd') +
      stat('Worker Salary Balance', money(salBal), 'Latest pending · outside workers', 'd') +
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

  function empBadge(e) {
    return isEx(e) ? '<span class="badge b-inactive">Ex-Employee</span>' : statusBadge(e.status);
  }
  function renderEmployees() {
    var f = ui.f.employees, all = db.employees, tab = f.tab === 'ex' ? 'ex' : 'current';
    $$('input[name="empTab"]').forEach(function (r) { r.checked = r.value === tab; });
    var nEx = all.filter(isEx).length;
    var exLbl = $('#emp-tab-ex-n'); if (exLbl) exLbl.textContent = nEx;
    var curLbl = $('#emp-tab-cur-n'); if (curLbl) curLbl.textContent = all.length - nEx;
    var scoped = all.filter(function (e) { return (tab === 'ex') === isEx(e); });
    var rows = scoped.filter(function (e) {
      return (!f.status || e.status === f.status) && (!f.dept || (e.department || '') === f.dept) &&
        matchQ(f.q, e.empId, e.name, e.phone, e.designation, e.department, e.notes);
    }).sort(byName);
    $('#employees-count').textContent = all.length ? rows.length + ' of ' + scoped.length + ' ' + (tab === 'ex' ? 'ex-employee(s)' : 'current employee(s)') + ' shown' : 'Manage your staff records.';
    var box = $('#employees-table');
    if (!all.length) { box.innerHTML = emptyState('No employees yet', 'Add your first employee to start tracking leave, overtime and advances.', '+ Add Employee', 'employees'); return; }
    if (!scoped.length) { box.innerHTML = '<div class="empty small"><p>' + (tab === 'ex' ? 'No ex-employees yet. Set a Leaving Date or status "Ex-Employee" on an employee to move them here.' : 'No current employees.') + '</p></div>'; return; }
    if (!rows.length) { box.innerHTML = noMatch('employees'); return; }
    var heads = ['Employee ID', 'Name', 'Phone', 'Designation', 'Department', 'Joining Date'].concat(tab === 'ex' ? ['Leaving Date'] : [], ['Status', 'Notes', 'Actions']);
    box.innerHTML = cardOf(tab === 'ex' ? 'Ex-Employees' : 'Employee List', '', tbl(heads,
      rows.map(function (e) {
        return [esc(e.empId), '<strong>' + esc(e.name) + '</strong>', dash(e.phone), dash(e.designation), dash(e.department),
          e.joiningDate ? fmtDate(e.joiningDate) : '<span class="muted">—</span>'].concat(
          tab === 'ex' ? [e.leavingDate ? fmtDate(e.leavingDate) : '<span class="muted">—</span>'] : [],
          [empBadge(e), '<span class="wrap">' + dash(e.notes) + '</span>', actions('employees', e.id)]);
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

  /* ----- Advance clearing ----- */
  function advStatus(a) {
    if (a.clearedMode === 'cleared') return 'Cleared';
    if (a.clearedMode === 'pending') return 'Not Cleared';
    var sd = db.appSettings.salaryDate;
    return sd && String(a.date) <= sd ? 'Cleared' : 'Not Cleared';
  }
  function isCleared(a) { return advStatus(a) === 'Cleared'; }
  function autoClearedCount() {
    var sd = db.appSettings.salaryDate;
    return sd ? db.advances.filter(function (a) { return (!a.clearedMode || a.clearedMode === 'auto') && String(a.date) <= sd; }).length : 0;
  }
  function salaryBoxHtml(id) {
    var sd = db.appSettings.salaryDate || '';
    return '<div class="salary-box"><label class="fld"><span class="lbl">Previous month salary date</span><span class="addrow">' +
      '<input type="date" id="' + id + '" value="' + esc(sd) + '"><button type="button" class="btn btn-sm btn-accent" data-action="save-salary-date" data-input="' + id + '">Save date</button>' +
      (sd ? '<button type="button" class="btn btn-sm" data-action="clear-salary-date" data-input="' + id + '">Clear date</button>' : '') + '</span></label>' +
      '<p class="hint">' + (sd ? 'Every advance dated on or before <strong>' + esc(fmtDate(sd)) + '</strong> is moved to <strong>Cleared Advance</strong> automatically (' + autoClearedCount() +
        ' right now). You can still change any single advance manually.' : 'Not set — no advance is cleared automatically. Set it after each month\'s salary is paid.') + '</p></div>';
  }
  function saveSalaryDate(el, clear) {
    var inp = $('#' + el.dataset.input), v = clear ? '' : (inp ? inp.value : '');
    if (!clear && !isDate(v)) { if (inp) { inp.classList.add('invalid'); inp.focus(); } toast('Pick a valid date.', 'error'); return; }
    db.appSettings.salaryDate = v;
    if (!save('appSettings')) return;
    renderView(ui.view === 'backup' ? 'backup' : 'advances');
    toast(v ? 'Salary date saved — ' + autoClearedCount() + ' advance(s) are now Cleared automatically.' : 'Salary date cleared.');
  }
  function toggleAdvance(id) {
    var rec = db.advances.find(function (x) { return x.id === id; }); if (!rec) return;
    var wasCleared = isCleared(rec);
    rec.clearedMode = wasCleared ? 'pending' : 'cleared'; rec.updatedAt = new Date().toISOString();
    if (!save('advances')) return;
    touch('advances', 'edit', 1, 'Marked ' + (wasCleared ? 'Not Cleared' : 'Cleared') + ': ' + FORMS.advances.describe(rec));
    renderCurrent(); toast('Marked as ' + (wasCleared ? 'Not Cleared' : 'Cleared') + ' (manual).');
  }
  function statusCell(a) {
    var c = isCleared(a), manual = a.clearedMode === 'cleared' || a.clearedMode === 'pending';
    return '<div class="status-cell"><span class="badge ' + (c ? 'b-cleared' : 'b-pending') + '">' + (c ? 'Cleared' : 'Not Cleared') + '</span><span class="muted small">' + (manual ? 'manual' : 'auto') + '</span>' +
      '<button type="button" class="link-btn" data-action="adv-toggle" data-id="' + esc(a.id) + '">' + (c ? 'Mark not cleared' : 'Mark cleared') + '</button></div>';
  }
  function renderAdvances() {
    var f = ui.f.advances, m = vm(f.month);
    var box = $('#advances-table'), sum = $('#advances-summary'), sb = $('#salary-box-adv');
    $$('input[name="advStatus"]').forEach(function (r) { r.checked = r.value === (f.status || 'pending'); });
    if (sb && !sb.contains(document.activeElement)) sb.innerHTML = salaryBoxHtml('salary-date-adv');
    if (!db.advances.length) { sum.innerHTML = ''; box.innerHTML = emptyState('No advances recorded', 'Add an advance given to an employee.', '+ Add Advance', 'advances'); return; }
    function base(a) { return (!f.emp || a.employeeId === f.emp) && matchQ(f.q, empName(a.employeeId), empCode(a.employeeId), a.reason, a.notes); }
    var scoped = db.advances.filter(base);
    var ncl = scoped.filter(function (a) { return !isCleared(a); }), cl = scoped.filter(isCleared);
    var st = f.status || 'pending';
    var inStatus = scoped.filter(function (a) { return st === 'all' || (st === 'cleared') === isCleared(a); });
    var rows = inStatus.filter(function (a) { return inMonth(a, m); }).sort(byDateDesc);
    var stats = '<div class="stats small" style="margin-bottom:16px">' +
      stat('Not Cleared Advance', money(sumAdv(ncl)), fmtNum(ncl.length) + ' entr' + (ncl.length === 1 ? 'y' : 'ies'), 'd') +
      stat('Cleared Advance', money(sumAdv(cl)), fmtNum(cl.length) + ' entr' + (cl.length === 1 ? 'y' : 'ies')) +
      stat('Cleared up to', db.appSettings.salaryDate ? esc(fmtDate(db.appSettings.salaryDate)) : 'Not set', 'Previous month salary date', 'y') + '</div>';
    if (!rows.length) {
      sum.innerHTML = stats;
      box.innerHTML = '<div class="empty small"><p>' + (inStatus.length ? 'No records match your filters.' : st === 'cleared' ? 'No cleared advances yet.' : st === 'pending' ? 'No pending (not cleared) advances.' : 'No advances.') + '</p>' +
        '<button class="btn btn-sm" data-action="clear-filters" data-view="advances">Clear Filters</button></div>';
      return;
    }
    var g = group(rows, function (a) { return a.employeeId; });
    var erows = Array.from(g.entries()).map(function (en) { return { id: en[0], n: en[1].length, total: sumAdv(en[1]) }; })
      .sort(function (a, b) { return empName(a.id).localeCompare(empName(b.id)); });
    var mg = group(inStatus, function (a) { return String(a.date).slice(0, 7); });
    var mrows = Array.from(mg.entries()).map(function (en) { return { m: en[0], n: en[1].length, total: sumAdv(en[1]) }; })
      .sort(function (a, b) { return b.m.localeCompare(a.m); });
    var tag = st === 'cleared' ? 'Cleared' : st === 'pending' ? 'Not Cleared' : 'All';
    sum.innerHTML = stats + '<div class="grid-2" style="margin-bottom:16px">' +
      cardOf('Employee-wise Advance Totals', tag + ' · ' + periodLabel(m), tbl(['Employee', 'Entries', 'Total Advance'],
        erows.map(function (x) { return [empCell(x.id), fmtNum(x.n), '<strong>' + money(x.total) + '</strong>']; }),
        ['Total', fmtNum(rows.length), money(sumAdv(rows))])) +
      cardOf('Monthly Advance Totals', tag + (f.emp ? ' · Selected employee' : ''), tbl(['Month', 'Entries', 'Total Advance'],
        mrows.map(function (x) { return [esc(monthLabel(x.m)) + (x.m === m ? ' <span class="chip">selected</span>' : ''), fmtNum(x.n), '<strong>' + money(x.total) + '</strong>']; }),
        ['All months', fmtNum(inStatus.length), money(sumAdv(inStatus))])) + '</div>';
    function dim(a, html) { return isCleared(a) ? '<span class="dim">' + html + '</span>' : html; }
    box.innerHTML = cardOf((st === 'cleared' ? 'Cleared' : st === 'pending' ? 'Not Cleared' : 'All') + ' Advance Records', rows.length + ' record(s)', tbl(
      ['Date', 'Employee', 'Amount', 'Status', 'Reason', 'Notes', 'Actions'],
      rows.map(function (a) {
        return [dim(a, fmtDate(a.date)), dim(a, empCell(a.employeeId)), dim(a, '<strong>' + money(a.amount) + '</strong>'), statusCell(a),
          dim(a, '<span class="wrap">' + dash(a.reason) + '</span>'), dim(a, '<span class="wrap">' + dash(a.notes) + '</span>'), actions('advances', a.id)];
      })));
  }

  /* ----- Deductions (employees) ----- */
  function dedCleared(d) { return d.clearedMode === 'cleared'; }
  function dimD(d, h) { return dedCleared(d) ? '<span class="dim">' + h + '</span>' : h; }
  function dedStatusCell(d) {
    var c = dedCleared(d);
    return '<div class="status-cell"><span class="badge ' + (c ? 'b-cleared' : 'b-pending') + '">' + (c ? 'Cleared' : 'Not Cleared') + '</span>' +
      '<button type="button" class="link-btn" data-action="ded-toggle" data-id="' + esc(d.id) + '">' + (c ? 'Mark not cleared' : 'Mark cleared') + '</button></div>';
  }
  function toggleDeduction(id) {
    var rec = db.deductions.find(function (x) { return x.id === id; }); if (!rec) return;
    var was = dedCleared(rec);
    rec.clearedMode = was ? 'pending' : 'cleared'; rec.updatedAt = new Date().toISOString();
    if (!save('deductions')) return;
    touch('deductions', 'edit', 1, 'Marked ' + (was ? 'Not Cleared' : 'Cleared') + ': ' + FORMS.deductions.describe(rec));
    renderCurrent(); toast('Marked as ' + (was ? 'Not Cleared' : 'Cleared') + '.');
  }
  function renderDeductions() {
    var f = ui.f.deductions, m = vm(f.month);
    var box = $('#deductions-table'), sum = $('#deductions-summary');
    if (!db.deductions.length) { sum.innerHTML = ''; box.innerHTML = emptyState('No deductions recorded', 'Record advance or other amounts an employee took earlier that are to be deducted.', '+ Add Deduction', 'deductions'); return; }
    var scoped = db.deductions.filter(function (d) {
      return (!f.emp || d.employeeId === f.emp) && (!f.type || d.type === f.type) && matchQ(f.q, empName(d.employeeId), empCode(d.employeeId), d.reason, d.notes);
    });
    var rows = scoped.filter(function (d) { return inMonth(d, m); }).sort(byDateDesc);
    if (!rows.length) { sum.innerHTML = ''; box.innerHTML = noMatch('deductions'); return; }
    var g = group(rows, function (d) { return d.employeeId; });
    var erows = Array.from(g.entries()).map(function (en) { return { id: en[0], n: en[1].length, total: sumAdv(en[1]) }; })
      .sort(function (a, b) { return empName(a.id).localeCompare(empName(b.id)); });
    sum.innerHTML = cardOf('Employee-wise Deductions', periodLabel(m), tbl(['Employee', 'Entries', 'Total Deduction'],
      erows.map(function (x) { return [empCell(x.id), fmtNum(x.n), '<strong>' + money(x.total) + '</strong>']; }),
      ['Total', fmtNum(rows.length), money(sumAdv(rows))]));
    box.innerHTML = cardOf('Deduction Records', rows.length + ' record(s)', tbl(
      ['Date', 'Employee', 'Type', 'Amount', 'Status', 'Reason', 'Notes', 'Actions'],
      rows.map(function (d) {
        return [dimD(d, fmtDate(d.date)), dimD(d, empCell(d.employeeId)), dimD(d, esc(d.type)), dimD(d, '<strong>' + money(d.amount) + '</strong>'), dedStatusCell(d), '<span class="wrap">' + dash(d.reason) + '</span>', '<span class="wrap">' + dash(d.notes) + '</span>', actions('deductions', d.id)];
      })));
  }

  /* ----- Outside worker salary ----- */
  function latestSalary(list) {
    var best = {};
    list.forEach(function (x) {
      var c = best[x.workerId];
      if (!c || x.date > c.date || (x.date === c.date && String(x.createdAt || x.id) > String(c.createdAt || c.id))) best[x.workerId] = x;
    });
    return best;
  }
  function renderOutsiderSalary() {
    var f = ui.f.outsiderSalary, m = vm(f.month);
    var box = $('#outsiderSalary-table'), sum = $('#outsiderSalary-summary');
    if (!db.outsideWorkerSalary.length) { sum.innerHTML = ''; box.innerHTML = emptyState('No salary records yet', 'Record the salary given to an outside worker up to a date and the balance still pending.', '+ Add Salary Record', 'outsiderSalary'); return; }
    var rows = db.outsideWorkerSalary.filter(function (x) {
      var w = workerById(x.workerId);
      return inMonth(x, m) && (!f.worker || x.workerId === f.worker) && (!f.source || (w && w.source === f.source)) && matchQ(f.q, workerName(x.workerId), workerCode(x.workerId), x.notes);
    }).sort(byDateDesc);
    if (!rows.length) { sum.innerHTML = ''; box.innerHTML = noMatch('outsiderSalary'); return; }
    var g = group(rows, function (x) { return x.workerId; }), late = latestSalary(rows);
    var srows = Array.from(g.entries()).map(function (en) {
      var l = late[en[0]];
      return { id: en[0], n: en[1].length, given: r2(en[1].reduce(function (s, x) { return s + (Number(x.given) || 0); }, 0)), upto: l.date, bal: Number(l.balance) || 0 };
    }).sort(function (a, b) { return workerName(a.id).localeCompare(workerName(b.id)); });
    sum.innerHTML = cardOf('Worker-wise Salary Summary', periodLabel(m), tbl(['Worker', 'Entries', 'Total Given', 'Latest Paid Up To', 'Current Balance'],
      srows.map(function (s) { return [workerCell(s.id), fmtNum(s.n), '<strong>' + money(s.given) + '</strong>', fmtDate(s.upto), '<strong>' + money(s.bal) + '</strong>']; }),
      ['Total', fmtNum(rows.length), money(srows.reduce(function (a, s) { return a + s.given; }, 0)), '', money(srows.reduce(function (a, s) { return a + s.bal; }, 0))]));
    box.innerHTML = cardOf('Salary Records', rows.length + ' record(s)', tbl(
      ['Up To', 'Worker', 'Source', 'Given Salary', 'Balance', 'Notes', 'Actions'],
      rows.map(function (x) {
        var w = workerById(x.workerId);
        return [fmtDate(x.date), workerCell(x.workerId), w ? esc(w.source) : '—', '<strong>' + money(x.given) + '</strong>', '<strong>' + money(x.balance) + '</strong>', '<span class="wrap">' + dash(x.notes) + '</span>', actions('outsiderSalary', x.id)];
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
    }).filter(function (r) { return (r.e.status === 'Active' && !isEx(r.e)) || r.has || f.emp; }).sort(function (a, b) { return byName(a.e, b.e); });
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
    var labels = { deductions: 'Deductions', outsideWorkerSalary: 'Outside worker salary records', employees: 'Employees', leaves: 'Leave records', employeeOT: 'Employee OT', advances: 'Advances', outsideWorkers: 'Outside workers', outsideWorkerWork: 'Outside worker work days', outsideWorkerLeave: 'Outside worker leave records', outsideWorkerOT: 'Outside worker OT', holidays: 'Special holidays' };
    var html = '<div class="count-grid">' + DATA_KEYS.map(function (k) {
      return '<div class="count"><strong>' + db[k].length + '</strong><span>' + labels[k] + '</span></div>';
    }).join('') + '</div>';
    var lb = db.appSettings.lastBackup;
    html += '<p class="hint">Last backup downloaded from this browser: <strong>' + (lb ? esc(new Date(lb).toLocaleString()) : 'never') + '</strong></p>';
    $('#backup-summary').innerHTML = html;
    renderCompanyCard(); renderMenuCard();
    var sbs = $('#salary-box-set'); if (sbs && !sbs.contains(document.activeElement)) sbs.innerHTML = salaryBoxHtml('salary-date-set');
    var di = $('#drive-input');
    if (di && document.activeElement !== di) di.value = driveUrl();
    var dl = $('#drive-open'); if (dl) dl.href = driveUrl();
    var ci = $('#currency-input');
    if (ci && document.activeElement !== ci) ci.value = db.appSettings.currency || '';
  }

  var RENDER = {
    dashboard: renderDashboard, employees: renderEmployees, leaves: renderLeaves, ot: renderOT, advances: renderAdvances, deductions: renderDeductions, outsiderSalary: renderOutsiderSalary, salary: renderSalary, salReport: renderSalReport, attSheet: renderAttSheet, vouchers: renderVouchers,
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
    var a = act(), mods = ['leaves', 'employeeOT', 'advances', 'outsideWorkerWork', 'outsideWorkerLeave', 'outsideWorkerOT', 'outsideWorkerSalary', 'deductions', 'employees', 'outsideWorkers', 'holidays', 'appSettings'];
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


  /* ================= Salary Calculator (password protected) ================= */
  var SAL_HASH = 'be52af43922dd8fd7217ee6023ad713afd4e73632492365bc90ff1070b404790';
  function salSha(pw) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('nosubtle'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode('afs-salary|' + pw)).then(function (b) {
      return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function salUnlock() {
    var inp = $('#sal-pass'); if (!inp) return;
    var pw = inp.value;
    salSha(pw).then(function (h) {
      if (h === SAL_HASH) { ui.salUnlocked = true; ui.salInit = false; renderCurrent(); }
      else { inp.value = ''; inp.classList.add('invalid'); inp.focus(); toast('Wrong password.', 'error'); }
    }, function () { toast('Password check needs a secure page (https / GitHub Pages / localhost).', 'error'); });
  }
  function lockHtml() {
    return '<div class="card sal-lock"><div class="card-body"><h3>Locked</h3><p class="hint">Salary details are hidden. Enter the password to view, add or edit salary.</p>' +
      '<label class="fld"><span class="lbl">Password</span><input type="password" id="sal-pass" autocomplete="off"></label>' +
      '<div style="margin-top:12px"><button type="button" class="btn btn-primary" data-action="sal-unlock">Unlock</button></div></div></div>';
  }
  function lastDayOf(mon) { var p = mon.split('-').map(Number); return mon + '-' + pad(new Date(p[0], p[1], 0).getDate()); }
  function roundRule(x) { var f = Math.floor(x + 1e-9), fr = x - f; return fr >= 0.9 - 1e-9 ? f + 1 : f; }
  function sn(id) { return parseFloat($('#' + id).value) || 0; }
  function fm(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function salPending(coll, empId, mon) {
    var end = lastDayOf(mon);
    return db[coll].filter(function (x) {
      return x.employeeId === empId && String(x.date) <= end && !(coll === 'advances' ? isCleared(x) : dedCleared(x));
    }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id)); });
  }
  function renderSalary() {
    var lock = $('#salary-lock'), main = $('#salary-main');
    if (!ui.salUnlocked) {
      main.classList.add('hidden'); $('#sal-lock-btn').classList.add('hidden');
      $('#sal-result').innerHTML = ''; $('#sal-salaries').innerHTML = '';
      lock.innerHTML = lockHtml();
      return;
    }
    lock.innerHTML = ''; main.classList.remove('hidden'); $('#sal-lock-btn').classList.remove('hidden');
    if (!$('#sal-month').value) { var t = todayStr(); $('#sal-month').value = t.slice(0, 7); }
    fillSalEmp(); ensureCalcSet($('#sal-settings'));
    renderSalaryList();
    if (!ui.salInit) { ui.salInit = true; salFetch(); } else salCalc();
  }
  function fillSalEmp() {
    var sel = $('#sal-emp'), cur = sel.value, mon = vm($('#sal-month').value);
    var list = db.employees.filter(function (e) { return !isEx(e) || (mon && e.leavingDate && String(e.leavingDate) >= mon + '-01'); }).sort(byName);
    sel.innerHTML = '<option value="">Select employee…</option>' + list.map(function (e) {
      return '<option value="' + esc(e.id) + '">' + esc(e.name) + ' (' + esc(e.empId) + ')' + (isEx(e) ? ' — Ex-Employee' : e.status === 'Active' ? '' : ' — Inactive') + '</option>';
    }).join('');
    if (list.some(function (e) { return e.id === cur; })) sel.value = cur;
  }
  function calcSetHtml() {
    return '<details class="sal-set"><summary>Settings (optional)</summary><div class="form-grid">' +
      '<label class="fld"><span class="lbl">Days in month</span><input type="number" data-calc="days" min="1" max="31" step="1"></label>' +
      '<label class="fld"><span class="lbl">Hours per day</span><input type="number" data-calc="hpd" min="1" step="any"></label>' +
      '<label class="fld"><span class="lbl">Normal OT multiplier</span><input type="number" data-calc="mulN" min="0" step="any"></label>' +
      '<label class="fld"><span class="lbl">Special OT multiplier</span><input type="number" data-calc="mulS" min="0" step="any"></label></div>' +
      '<div class="calc-inc"><p class="lbl" style="margin:10px 0 4px">Used for OT rate calculation</p>' +
      '<label class="chk"><input type="checkbox" data-calc="ob"> Base Salary</label> <label class="chk"><input type="checkbox" data-calc="oa"> Allowance</label>' +
      '<p class="lbl" style="margin:10px 0 4px">Used for Leave deduction calculation</p>' +
      '<label class="chk"><input type="checkbox" data-calc="lb"> Base Salary</label> <label class="chk"><input type="checkbox" data-calc="la"> Allowance</label>' +
      '<p class="hint">Room Rent is never used in salary, OT or leave calculation.</p></div>' +
      '<p class="hint">These settings are shared by the Salary Calculator and the Salary Report. Default: 30 days, 8 hours, 1 and 1.5, Base + Allowance both ticked.</p>' +
      '<button type="button" class="btn btn-sm" data-action="calc-reset">Reset to defaults</button></details>';
  }
  function syncCalcInputs() {
    var c = normCalc(db.appSettings.salaryCalc);
    $$('[data-calc]').forEach(function (el) { if (el.type === 'checkbox') el.checked = !!c[el.dataset.calc]; else el.value = c[el.dataset.calc]; });
  }
  function ensureCalcSet(host) { if (host && !host.firstChild) host.innerHTML = calcSetHtml(); syncCalcInputs(); }
  function calcSettingsChanged(el, reset) {
    var box = el && el.closest ? el.closest('.sal-set') : null, old = normCalc(db.appSettings.salaryCalc), c;
    if (reset) c = normCalc({});
    else {
      var raw = {}; $$('[data-calc]', box).forEach(function (x) { raw[x.dataset.calc] = x.type === 'checkbox' ? x.checked : x.value; });
      c = normCalc(raw);
    }
    db.appSettings.salaryCalc = c; save('appSettings'); syncCalcInputs();
    if (reset) toast('Settings reset to defaults.');
    if (ui.view === 'salary') { if (c.days !== old.days) salFetch(); else salCalc(); } else if (ui.view === 'salReport') renderSalReport();
  }
  function renderSalaryList() {
    var rows = db.employees.filter(function (e) { return !isEx(e); }).sort(byName);
    function nv(x) { return x !== '' && x != null ? esc(x) : ''; }
    $('#sal-salaries').innerHTML = cardOf('Employee Salary Details', 'Visible only after unlock', rows.length ?
      '<div class="card-body" style="padding-bottom:0"><p class="hint">Base Salary and Allowance are used in salary calculation. Room Rent is only for Room Rent vouchers (never added to salary). One Save button saves all three values.</p></div>' +
      tbl(['Employee', 'Base Salary', 'Allowance', 'Room Rent', 'Actions'],
      rows.map(function (e) {
        function f(k, v) { return '<input type="number" min="0" step="0.01" class="sal-base-in" id="sal' + k + '-' + esc(e.id) + '" value="' + nv(v) + '" placeholder="Not set">'; }
        return [empCell(e.id), f('b', e.salary), f('a', e.allowance), f('r', e.roomRent),
          '<button type="button" class="btn btn-sm btn-accent" data-action="sal-save-base" data-id="' + esc(e.id) + '">Save</button>'];
      })) + '<div class="card-body"><button type="button" class="btn btn-primary" data-action="sal-save-all">Save all</button></div>' : '<div class="card-body"><p class="hint">Add employees first.</p></div>');
  }
  function salReadRow(e) {
    var out = { e: e }, ok = true;
    [['b', 'salary', 'salary'], ['a', 'allowance', 'allowance'], ['r', 'roomRent', 'room rent']].forEach(function (c) {
      var inp = $('#sal' + c[0] + '-' + e.id); if (!inp) { ok = false; return; }
      var v = inp.value.trim(), n = Number(v);
      if (v !== '' && (!isFinite(n) || n < 0 || n > 100000000)) { inp.classList.add('invalid'); toast('Enter a valid ' + c[2] + ' for ' + e.name + '.', 'error'); ok = false; return; }
      inp.classList.remove('invalid'); out[c[1]] = v === '' ? '' : r2(n);
    });
    return ok ? out : null;
  }
  function salApplyRow(r) {
    var e = r.e, changed = ['salary', 'allowance', 'roomRent'].some(function (k) { return (e[k] === undefined || e[k] === null ? '' : e[k]) !== r[k]; });
    if (!changed) return false;
    e.salary = r.salary; e.allowance = r.allowance; e.roomRent = r.roomRent; e.updatedAt = new Date().toISOString();
    return true;
  }
  function salSaveBase(id) {
    var e = db.employees.find(function (x) { return x.id === id; }); if (!e) return;
    var r = salReadRow(e); if (!r) return;
    if (!salApplyRow(r)) { toast('No changes to save for ' + e.name + '.'); return; }
    if (!save('employees')) return;
    touch('employees', 'edit', 1, 'Salary details updated: ' + e.name);
    toast('Salary details saved for ' + e.name + '.');
    salAfterSave(id);
  }
  function salSaveAll() {
    var rows = db.employees.filter(function (e) { return !isEx(e); }), list = [];
    for (var i = 0; i < rows.length; i++) { var r = salReadRow(rows[i]); if (!r) return; list.push(r); }
    var n = 0; list.forEach(function (r) { if (salApplyRow(r)) n++; });
    if (!n) { toast('No changes to save.'); return; }
    if (!save('employees')) return;
    touch('employees', 'edit', n, 'Salary details updated for ' + n + ' employee(s)');
    toast('Salary details saved for ' + n + ' employee(s).');
    salAfterSave($('#sal-emp').value);
  }
  function salAfterSave(id) {
    var e = db.employees.find(function (x) { return x.id === id; });
    if (e && $('#sal-emp').value === id) { $('#sal-base').value = e.salary === '' || e.salary == null ? '' : e.salary; $('#sal-allow').value = e.allowance === '' || e.allowance == null ? '' : e.allowance; ui.salApplied = false; salCalc(); }
  }
  function salFetch() {
    var id = $('#sal-emp').value, mon = $('#sal-month').value, note = $('#sal-fetchnote');
    ui.salApplied = false;
    var e = db.employees.find(function (x) { return x.id === id; });
    if (!e || !vm(mon)) {
      ['sal-base', 'sal-allow', 'sal-leave', 'sal-otn', 'sal-ots', 'sal-adv', 'sal-ded'].forEach(function (k) { $('#' + k).value = ''; });
      note.textContent = 'Select an employee and a month to fetch records.'; $('#sal-advinfo').textContent = ''; $('#sal-dedinfo').textContent = ''; salCalc(); return;
    }
    var A = attData(e, mon).tot, cfg = normCalc(db.appSettings.salaryCalc), after = cfg.days - leaveCap(e, mon, cfg.days);
    var pa = salPending('advances', id, mon), pd = salPending('deductions', id, mon);
    $('#sal-base').value = e.salary === '' || e.salary == null ? '' : e.salary;
    $('#sal-allow').value = e.allowance === '' || e.allowance == null ? '' : e.allowance;
    $('#sal-leave').value = r2(A.leave + after); $('#sal-otn').value = A.normal; $('#sal-ots').value = A.special;
    $('#sal-adv').value = sumAdv(pa); $('#sal-ded').value = sumAdv(pd);
    note.textContent = 'Fetched for ' + monthLabel(mon) + ' from the Attendance Sheet (' + fm(A.leave) + ' leave day(s), ' + fm(A.normal) + ' normal OT hr, ' + fm(A.special) + ' special OT hr), ' + pa.length + ' pending advance(s), ' + pd.length + ' pending deduction(s). ' +
      (after ? 'Leaving date ' + fmtDate(e.leavingDate) + ': ' + after + ' day(s) after it are counted as not worked. ' : '') + (e.salary === '' || e.salary == null ? 'Base salary not set — enter it below or save it in the list. ' : '') + 'Special OT = ' + db.appSettings.labels.sunday + ' + other OT types.';
    salCalc();
  }
  function salPendInfo() {
    var id = $('#sal-emp').value, mon = $('#sal-month').value; if (!id || !vm(mon)) return { a: 0, d: 0 };
    var a = sumAdv(salPending('advances', id, mon)), d = sumAdv(salPending('deductions', id, mon));
    $('#sal-advinfo').textContent = 'Pending (Not Cleared) advance: ' + fm(a);
    $('#sal-dedinfo').textContent = 'Pending (Not Cleared) deductions: ' + fm(d);
    return { a: a, d: d };
  }
  function salCalc() {
    var box = $('#sal-result'), id = $('#sal-emp').value, mon = $('#sal-month').value;
    if (!ui.salUnlocked) { box.innerHTML = ''; return; }
    var pend = salPendInfo();
    if (!id || !vm(mon)) { box.innerHTML = '<div class="card"><div class="card-body"><p class="hint">Pick an employee and month to see the salary breakdown.</p></div></div>'; return; }
    var cfg = normCalc(db.appSettings.salaryCalc), DAYS = cfg.days, base = sn('sal-base'), otN = sn('sal-otn'), otS = sn('sal-ots'), allow = sn('sal-allow'), leave = sn('sal-leave'), adv = sn('sal-adv'), ded = sn('sal-ded');
    var hpd = cfg.hpd, mN = cfg.mulN, mS = cfg.mulS;
    var perDay = ((cfg.lb ? base : 0) + (cfg.la ? allow : 0)) / DAYS, perHour = ((cfg.ob ? base : 0) + (cfg.oa ? allow : 0)) / DAYS / hpd, rN = perHour * mN, rS = perHour * mS;
    var aN = otN * rN, aS = otS * rS, lDed = leave * perDay, worked = Math.max(0, DAYS - leave);
    var lDedB = cfg.lb ? leave * base / DAYS : 0, lDedA = cfg.la ? leave * allow / DAYS : 0, allowC = Math.max(0, roundRule(allow - lDedA));
    var cleared = Math.max(0, roundRule(base - lDedB)), totOT = roundRule(aN + aS), net = cleared + allowC + totOT - adv - ded;
    var warns = [];
    if (adv > pend.a + 0.001) warns.push('Advance cut (' + fm(adv) + ') is more than the pending advance (' + fm(pend.a) + ').');
    if (ded > pend.d + 0.001) warns.push('Deduction cut (' + fm(ded) + ') is more than the pending deductions (' + fm(pend.d) + ').');
    if (net < 0) warns.push('Deductions are more than the earnings — net salary is negative.');
    if (!base) warns.push('Base salary is 0 — enter it above.');
    function R(l, q, r, a, cls, b) { return ['<span' + (b ? ' style="font-weight:700"' : '') + '>' + l + '</span>', q, r, '<span class="' + cls + '">' + (b ? '<strong>' + a + '</strong>' : a) + '</span>']; }
    var rows = [
      R('Total Worked Days', DAYS + ' - ' + fm(leave), '-', fm(worked) + ' days', '', true),
      R('Base Salary', '-', '-', fm(base), '', false),
      R('Leave Amount', fm(leave) + ' days', fm(perDay), '- ' + fm(lDed), 'minus', false),
      R('Base Cleared Salary', '-', '-', fm(cleared), '', true),
      R('Allowance (after leave)', '-', '-', '+ ' + fm(allowC), 'plus', false),
      R('Normal OT', fm(otN) + ' hrs', fm(rN), '+ ' + fm(aN), 'plus', false),
      R('Special OT', fm(otS) + ' hrs', fm(rS), '+ ' + fm(aS), 'plus', false),
      R('Total OT Amount', '-', '-', fm(totOT), 'plus', true),
      R('Advance cut', '-', '-', '- ' + fm(adv), 'minus', false),
      R('Deduction cut', '-', '-', '- ' + fm(ded), 'minus', false)
    ];
    var e = db.employees.find(function (x) { return x.id === id; });
    box.innerHTML = cardOf('Salary Breakdown', esc(e ? e.name : '') + ' · ' + esc(monthLabel(mon)),
      '<div class="card-body"><div class="sal-rates"><div><small>Per Day</small><b>' + fm(perDay) + '</b></div><div><small>Normal OT / hr</small><b>' + fm(rN) + '</b></div><div><small>Special OT / hr</small><b>' + fm(rS) + '</b></div></div>' +
      tbl(['Item', 'Qty', 'Rate', 'Amount'], rows) +
      '<div class="sal-net"><span>Net Salary</span><b class="' + (net < 0 ? 'minus' : '') + '">' + esc(db.appSettings.currency || '') + ' ' + fm(net) + '</b></div>' +
      warns.map(function (w) { return '<p class="sal-warn">⚠ ' + esc(w) + '</p>'; }).join('') +
      '<p class="hint">Month = ' + DAYS + ' days · day rate = base / ' + DAYS + ' · hour rate = day rate / ' + fm(hpd) + '. Round-off only on Base Cleared Salary and Total OT (.90 and above goes up).</p>' +
      '<div style="margin-top:12px"><button type="button" class="btn btn-primary" data-action="sal-apply"' + (ui.salApplied ? ' disabled' : '') + '>' + (ui.salApplied ? 'Records updated' : 'Apply to records (mark cleared)') + '</button></div></div>');
  }
  function cutRecords(coll, list, cut, empId, mon) {
    var rem = r2(cut), now = new Date().toISOString(), r = { full: 0, split: 0, created: 0 }, tag = ' — cut in ' + monthLabel(mon) + ' salary';
    list.forEach(function (rec) {
      if (rem <= 0.001) return;
      var amt = Number(rec.amount) || 0;
      if (amt <= rem + 0.001) { rec.clearedMode = 'cleared'; rec.updatedAt = now; rem = r2(rem - amt); r.full++; }
      else {
        var part = rem, c = Object.assign({}, rec, { id: uid(), createdAt: now, amount: part, clearedMode: 'cleared', notes: ((rec.notes ? rec.notes + ' · ' : '') + 'Part cut' + tag + '; balance ' + r2(amt - part) + ' kept Not Cleared') });
        delete c.updatedAt;
        rec.amount = r2(amt - part); rec.clearedMode = 'pending'; rec.updatedAt = now;
        db[coll].push(c); rem = 0; r.split++;
      }
    });
    if (rem > 0.001) {
      var o = { id: uid(), createdAt: now, employeeId: empId, date: lastDayOf(mon), amount: rem, clearedMode: 'cleared', reason: 'Added from salary calculation', notes: 'Extra amount cut' + tag };
      if (coll === 'deductions') o.type = 'Other Amount';
      db[coll].push(o); r.created++;
    }
    return r;
  }
  function salApply() {
    var id = $('#sal-emp').value, mon = $('#sal-month').value, e = db.employees.find(function (x) { return x.id === id; });
    if (!e || !vm(mon)) { toast('Pick an employee and month first.', 'error'); return; }
    var adv = r2(sn('sal-adv')), ded = r2(sn('sal-ded'));
    if (adv <= 0 && ded <= 0) { toast('Advance cut and deduction cut are both 0 — nothing to apply.', 'error'); return; }
    var la = salPending('advances', id, mon), ld = salPending('deductions', id, mon), pa = sumAdv(la), pd = sumAdv(ld), lines = [], warn = false;
    function plan(label, cut, pend) {
      if (cut <= 0) return;
      if (cut > pend + 0.001) { warn = true; lines.push('<li><strong>⚠ ' + label + ' cut ' + fm(cut) + ' is MORE than pending ' + fm(pend) + '.</strong> All pending ' + label.toLowerCase() + ' will be marked Cleared and a new Cleared record of <strong>' + fm(r2(cut - pend)) + '</strong> will be created for the difference.</li>'); }
      else if (cut < pend - 0.001) lines.push('<li>' + label + ': cut <strong>' + fm(cut) + '</strong> of pending ' + fm(pend) + ' → cut part becomes Cleared (older entries first, one entry may be split); balance <strong>' + fm(r2(pend - cut)) + '</strong> stays Not Cleared.</li>');
      else lines.push('<li>' + label + ': full pending <strong>' + fm(pend) + '</strong> will be marked Cleared.</li>');
    }
    plan('Advance', adv, pa); plan('Deduction', ded, pd);
    confirmBox({
      title: warn ? 'Warning — values do not tally' : 'Update records?',
      message: (warn ? 'The cut amount does not match the records.' : 'These changes will be made for <strong>' + esc(e.name) + '</strong>:') + '<ul style="margin:10px 0 10px 18px">' + lines.join('') + '</ul>' +
        '<span class="hint">OK = system edits / creates the records. Cancel = no record is changed; you can update the records manually.</span>',
      okText: 'OK, update records', danger: warn
    }).then(function (ok) {
      if (!ok) { toast('No records changed. You can update them manually.'); return; }
      var ra = adv > 0 ? cutRecords('advances', la, adv, id, mon) : null, rd = ded > 0 ? cutRecords('deductions', ld, ded, id, mon) : null;
      if (ra) { save('advances'); touch('advances', 'edit', ra.full + ra.split + ra.created, 'Salary cut for ' + e.name + ' (' + monthLabel(mon) + '): ' + fm(adv)); }
      if (rd) { save('deductions'); touch('deductions', 'edit', rd.full + rd.split + rd.created, 'Salary cut for ' + e.name + ' (' + monthLabel(mon) + '): ' + fm(ded)); }
      ui.salApplied = true; salCalc(); toast('Records updated — cut amounts are Cleared, balance stays Not Cleared.');
    });
  }


  /* ================= Attendance sheet + Salary report ================= */
  function daysIn(mon) { var p = mon.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); }
  function editsOf() { if (!db.appSettings.reportEdits) db.appSettings.reportEdits = {}; return db.appSettings.reportEdits; }
  function parseAtt(txt) {
    var m = /^(HL|L)?\s*(\d+(?:\.\d+)?)?$/i.exec(String(txt).trim());
    if (!m) return null;
    var h = m[2] ? Number(m[2]) : 0;
    if (h > 24) return null;
    return { lv: m[1] ? (m[1].toUpperCase() === 'HL' ? 0.5 : 1) : 0, h: h };
  }
  function attData(e, mon) {
    var n = daysIn(mon), ov = editsOf()['att|' + mon + '|' + e.id] || {}, cells = [], tot = { leave: 0, normal: 0, special: 0 };
    var LV = {}, ON = {}, OS = {};
    db.leaves.forEach(function (l) { if (l.employeeId === e.id && String(l.date).slice(0, 7) === mon) { var d = Number(String(l.date).slice(8)); LV[d] = (LV[d] || 0) + leaveDays(l); } });
    db.employeeOT.forEach(function (o) {
      if (o.employeeId !== e.id || String(o.date).slice(0, 7) !== mon) return;
      var d = Number(String(o.date).slice(8)), h = Number(o.hours) || 0;
      if (o.type === 'normal') ON[d] = (ON[d] || 0) + h; else OS[d] = (OS[d] || 0) + h;
    });
    for (var d = 1; d <= n; d++) {
      var date = mon + '-' + pad(d), hol = !!holidayInfo(date), blocked = !!((e.joiningDate && date < e.joiningDate) || (e.leavingDate && date > e.leavingDate));
      var c = { d: d, hol: hol, blocked: blocked, text: '', auto: '', lv: 0, nh: 0, sh: 0, manual: false };
      if (!blocked) {
        var lv = LV[d] || 0, nh = r2(ON[d] || 0), sh = r2(OS[d] || 0), parts = [];
        if (lv > 0) parts.push(lv === 0.5 ? 'HL' : 'L');
        if (nh + sh > 0) parts.push(String(r2(nh + sh)));
        c.auto = parts.join(' '); c.text = c.auto; c.lv = lv; c.nh = nh; c.sh = sh;
        if (Object.prototype.hasOwnProperty.call(ov, String(d))) {
          var p = parseAtt(ov[String(d)]);
          if (p) { c.manual = true; c.text = String(ov[String(d)]).trim(); c.lv = p.lv; c.nh = hol ? 0 : p.h; c.sh = hol ? p.h : 0; }
        }
        tot.leave += c.lv; tot.normal += c.nh; tot.special += c.sh;
      }
      cells.push(c);
    }
    tot.leave = r2(tot.leave); tot.normal = r2(tot.normal); tot.special = r2(tot.special);
    return { cells: cells, tot: tot };
  }
  function hasRecs(e, mon) { return db.leaves.concat(db.employeeOT).some(function (x) { return x.employeeId === e.id && String(x.date).slice(0, 7) === mon; }); }
  function inScope(e, mon, forSalary) {
    if (isEx(e)) { if (e.leavingDate) return String(e.leavingDate) >= mon + '-01'; return !forSalary && hasRecs(e, mon); }
    return e.status === 'Active' || hasRecs(e, mon);
  }
  function repEmployees(mon, forSalary) { return db.employees.filter(function (e) { return inScope(e, mon, forSalary); }).sort(byName); }
  function leaveCap(e, mon, days) {
    if (e.leavingDate && String(e.leavingDate).slice(0, 7) === mon) return Math.min(days, Number(String(e.leavingDate).slice(8)));
    return days;
  }
  function repHead(title, mon) {
    var p = mon.split('-');
    return '<div class="rep-title"><div class="rep-co">' + esc(COMPANY) + '</div><h2>' + esc(title) + '</h2><p><strong>Month: ' + esc(MONTHS[Number(p[1]) - 1]) + '</strong> &nbsp;&nbsp; <strong>Year: ' + esc(p[0]) + '</strong></p></div>';
  }
  function repMon(view) { var m = vm(ui.f[view].month); return m || todayStr().slice(0, 7); }
  function renderAttSheet() {
    var mon = repMon('attSheet'), box = $('#attSheet-body'), n = daysIn(mon), emps = repEmployees(mon);
    syncFilterInputs('attSheet');
    if (!emps.length) { box.innerHTML = '<div class="card"><div class="card-body"><p class="hint">Add employees to generate the sheet.</p></div></div>'; return; }
    var manual = 0, h = '<th>No</th><th class="nm">Name</th>';
    for (var d = 1; d <= n; d++) h += '<th class="' + (holidayInfo(mon + '-' + pad(d)) ? 'hol' : '') + '">' + d + '</th>';
    h += '<th class="tt">Total Leave</th><th class="tt">Normal OT hrs</th><th class="tt">Sunday OT hrs</th>';
    var body = emps.map(function (e, i) {
      var a = attData(e, mon), r = '<td>' + (i + 1) + '</td><td class="nm">' + esc(e.name) + '</td>';
      a.cells.forEach(function (c) {
        if (c.blocked) { r += '<td class="blk"></td>'; return; }
        if (c.manual) manual++;
        var isL = /L/i.test(c.text);
        r += '<td class="' + (c.hol ? 'hol ' : '') + (c.manual ? 'man ' : '') + (isL ? 'lv' : '') + '" contenteditable="true" data-att="' + esc(e.id) + '|' + c.d + '" data-auto="' + esc(c.auto) + '" title="Click to edit (L, HL = half leave, or OT hours)">' + esc(c.text) + '</td>';
      });
      return '<tr>' + r + '<td class="tt">' + (a.tot.leave || '-') + '</td><td class="tt">' + (a.tot.normal || '-') + '</td><td class="tt">' + (a.tot.special || '-') + '</td></tr>';
    }).join('');
    box.innerHTML = repHead('Monthly Attendance, Leave & OT Sheet', mon) +
      '<p class="hint rep-legend"><strong>L</strong> = Leave, <strong>HL</strong> = half-day leave. Numbers = OT hours. Yellow columns = weekly off / holiday (OT there is Sunday OT). ' +
      '<span class="no-print">Click any cell to edit manually' + (manual ? ' — <strong>' + manual + '</strong> manual edit(s) this month' : '') + '. Clear a cell\'s text to blank it; type back the original to undo.</span></p>' +
      '<div class="att-wrap"><table class="att-table"><thead><tr>' + h + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }
  function attCellEdit(td) {
    var key = td.dataset.att.split('|'), id = key[0], day = key[1], mon = repMon('attSheet');
    var txt = td.textContent.replace(/\s+/g, ' ').trim();
    if (txt === td.textContent && txt === (td.dataset.auto || '') && !td.classList.contains('man')) return;
    var ed = editsOf(), k = 'att|' + mon + '|' + id;
    if (txt !== '' && !parseAtt(txt)) { toast('Use L, HL, or OT hours (e.g. 1.5, L 2).', 'error'); renderAttSheet(); return; }
    var cur = ed[k] && Object.prototype.hasOwnProperty.call(ed[k], day) ? ed[k][day] : null;
    if (cur === txt || (cur === null && txt === (td.dataset.auto || ''))) { if (td.textContent !== txt) renderAttSheet(); return; }
    if (txt === (td.dataset.auto || '')) { if (ed[k]) { delete ed[k][day]; if (!Object.keys(ed[k]).length) delete ed[k]; } }
    else { ed[k] = ed[k] || {}; ed[k][day] = txt; }
    if (save('appSettings')) renderAttSheet();
  }
  function salRowData(e, mon) {
    var a = attData(e, mon).tot, ov = editsOf()['sal|' + mon + '|' + e.id] || {}, c = normCalc(db.appSettings.salaryCalc), base = Number(e.salary) || 0;
    var D = c.days, alw = Number(e.allowance) || 0, pdB = c.lb ? base / D : 0, pdA = c.la ? alw / D : 0, perHour = ((c.ob ? base : 0) + (c.oa ? alw : 0)) / D / c.hpd, has = function (k) { return Object.prototype.hasOwnProperty.call(ov, k); };
    var autoWd = Math.max(0, r2(leaveCap(e, mon, D) - a.leave)), wd = has('wd') ? ov.wd : autoWd, leave = D - wd;
    var autoCl = Math.max(0, roundRule(base - (D - autoWd) * pdB)), cl = has('cl') ? ov.cl : autoCl;
    var hr = has('hr') ? ov.hr : a.normal, sp = has('sp') ? ov.sp : a.special;
    var autoTo = roundRule(hr * perHour * c.mulN + sp * perHour * c.mulS), to = has('to') ? ov.to : autoTo;
    var autoAl = Math.max(0, roundRule(alw - (D - autoWd) * pdA)), al = has('al') ? ov.al : autoAl, autoTs = r2(cl + al + to), ts = has('ts') ? ov.ts : autoTs;
    var m2 = mon;
    var autoAd = r2(db.advances.concat(db.deductions).filter(function (x) { return x.employeeId === e.id && String(x.date).slice(0, 7) === m2; })
      .reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0));
    var ad = has('ad') ? ov.ad : autoAd, autoOv = r2(ts - ad), ovr = has('ov') ? ov.ov : autoOv;
    return { base: base, vals: { wd: wd, cl: cl, al: al, hr: hr, sp: sp, to: to, ts: ts, ad: ad, ov: ovr }, auto: { wd: autoWd, cl: autoCl, al: autoAl, hr: a.normal, sp: a.special, to: autoTo, ts: autoTs, ad: autoAd, ov: autoOv }, has: has, any: Object.keys(ov).length > 0 };
  }
  var SAL_COLS = ['wd', 'cl', 'al', 'hr', 'sp', 'to', 'ts', 'ad', 'ov'];
  function renderSalReport() {
    var lock = $('#salReport-lock'), box = $('#salReport-body'), tools = $('#salReport-tools');
    syncFilterInputs('salReport');
    if (!ui.salUnlocked) { tools.classList.add('hidden'); box.innerHTML = ''; $('#salReport-settings').innerHTML = ''; lock.innerHTML = lockHtml(); return; }
    lock.innerHTML = ''; tools.classList.remove('hidden'); ensureCalcSet($('#salReport-settings'));
    var mon = repMon('salReport'), emps = repEmployees(mon, true);
    if (!emps.length) { box.innerHTML = '<div class="card"><div class="card-body"><p class="hint">Add employees to generate the report.</p></div></div>'; return; }
    var tot = { cl: 0, al: 0, hr: 0, sp: 0, to: 0, ts: 0, ad: 0, ov: 0 }, manual = 0, missing = 0;
    var rows = emps.map(function (e) {
      var r = salRowData(e, mon); if (!r.base) missing++;
      SAL_COLS.forEach(function (k) { if (r.has(k)) manual++; if (tot[k] != null) tot[k] += Number(r.vals[k]) || 0; });
      var cells = SAL_COLS.map(function (k) {
        return '<td class="num"><input type="number" step="any" min="0" class="rep-in' + (r.has(k) ? ' man' : '') + '" data-sr="' + esc(e.id) + '|' + k + '" data-auto="' + r.auto[k] + '" value="' + r.vals[k] + '"></td>';
      }).join('');
      return '<tr><td class="nm">' + esc(e.name) + (r.base ? '' : ' <span class="badge b-pending">No base salary</span>') + '</td><td>' + esc(monthLabel(mon)) + '</td>' + cells +
        '<td class="no-print">' + (r.any ? '<button type="button" class="link-btn" data-action="sal-row-reset" data-id="' + esc(e.id) + '">Reset</button>' : '') + '</td></tr>';
    }).join('');
    box.innerHTML = repHead('Monthly Salary Report', mon) +
      '<p class="hint no-print">Values come from the Attendance Sheet (leave / OT), base salaries and the salary-calculator rules (' + normCalc(db.appSettings.salaryCalc).days + '-day month, round-off on Cleared Salary and Total OT; employees who left are calculated up to their leaving date only). <strong>Advance</strong> = advances + deductions dated in this month. Any box can be edited manually' +
      (manual ? ' — <strong>' + manual + '</strong> manual value(s)' : '') + (missing ? '; <strong>' + missing + '</strong> employee(s) have no base salary yet' : '') + '. Amounts in ' + esc(db.appSettings.currency || '') + '.</p>' +
      '<div class="att-wrap"><table class="rep-table"><thead><tr><th rowspan="2" class="nm">Name</th><th rowspan="2">Month</th><th rowspan="2">Worked Days</th><th rowspan="2">Monthly Cleared Salary</th><th rowspan="2">Allowance</th><th colspan="2">OT</th><th rowspan="2">Total OT</th><th rowspan="2">Total Salary</th><th rowspan="2">Advance</th><th rowspan="2">Overall Cleared Salary</th><th rowspan="2" class="no-print"></th></tr>' +
      '<tr><th>Hr</th><th>Spl</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td colspan="3"><strong>Total</strong></td><td class="num"><strong>' + fm(tot.cl) + '</strong></td><td class="num"><strong>' + fm(tot.al) + '</strong></td><td class="num"><strong>' + fm(tot.hr) + '</strong></td><td class="num"><strong>' + fm(tot.sp) + '</strong></td><td class="num"><strong>' + fm(tot.to) + '</strong></td><td class="num"><strong>' + fm(tot.ts) + '</strong></td><td class="num"><strong>' + fm(tot.ad) + '</strong></td><td class="num"><strong>' + fm(tot.ov) + '</strong></td><td class="no-print"></td></tr></tfoot></table></div>';
  }
  function salRepEdit(el) {
    var p = el.dataset.sr.split('|'), id = p[0], k = p[1], mon = repMon('salReport'), ed = editsOf(), key = 'sal|' + mon + '|' + id, v = el.value.trim();
    if (!ui.salUnlocked) return;
    if (v !== '' && (!isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100000000)) { toast('Enter a valid number.', 'error'); renderSalReport(); return; }
    if (v === '' || r2(Number(v)) === r2(Number(el.dataset.auto))) { if (ed[key]) { delete ed[key][k]; if (!Object.keys(ed[key]).length) delete ed[key]; } }
    else { ed[key] = ed[key] || {}; ed[key][k] = r2(Number(v)); }
    if (save('appSettings')) renderSalReport();
  }
  function repResetRow(id) {
    var mon = repMon('salReport'); delete editsOf()['sal|' + mon + '|' + id];
    if (save('appSettings')) { renderSalReport(); toast('Row reset to calculated values.'); }
  }
  async function repResetMonth(kind) {
    var mon = repMon(kind === 'att' ? 'attSheet' : 'salReport'), ed = editsOf(), pre = kind + '|' + mon + '|';
    var keys = Object.keys(ed).filter(function (k) { return k.indexOf(pre) === 0; });
    if (!keys.length) { toast('No manual edits in ' + monthLabel(mon) + '.'); return; }
    var ok = await confirmBox({ title: 'Reset manual edits?', message: 'Remove all manual edits of <strong>' + esc(monthLabel(mon)) + '</strong> and go back to calculated values?', okText: 'Reset', danger: true });
    if (!ok) return;
    keys.forEach(function (k) { delete ed[k]; });
    if (save('appSettings')) { renderCurrent(); toast('Manual edits removed.'); }
  }
  function printReport(land) {
    var st = null;
    if (land) { st = document.createElement('style'); st.id = 'pg-land'; st.textContent = '@page{size:landscape;margin:8mm}'; document.head.appendChild(st); }
    window.addEventListener('afterprint', function () { var x = document.getElementById('pg-land'); if (x) x.remove(); }, { once: true });
    window.print();
  }
  function attCsv() {
    var mon = repMon('attSheet'), n = daysIn(mon), head = ['No', 'Name'], i;
    for (i = 1; i <= n; i++) head.push(i);
    head.push('Total Leave', 'Normal OT hrs', 'Sunday OT hrs');
    var lines = [csvLine(head)];
    repEmployees(mon).forEach(function (e, ix) {
      var a = attData(e, mon);
      lines.push(csvLine([ix + 1, e.name].concat(a.cells.map(function (c) { return c.blocked ? '' : c.text; }), [a.tot.leave, a.tot.normal, a.tot.special])));
    });
    download('attendance-sheet-' + mon + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }
  function salCsv() {
    if (!ui.salUnlocked) return;
    var mon = repMon('salReport'), lines = [csvLine(['Name', 'Month', 'Worked Days', 'Monthly Cleared Salary', 'Allowance', 'OT Hr', 'OT Spl', 'Total OT', 'Total Salary', 'Advance', 'Overall Cleared Salary'])];
    repEmployees(mon, true).forEach(function (e) {
      var r = salRowData(e, mon).vals; lines.push(csvLine([e.name, monthLabel(mon)].concat(SAL_COLS.map(function (k) { return r[k]; }))));
    });
    download('salary-report-' + mon + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }


  /* ================= Vouchers (Advance / Salary / Room Rent) ================= */
  var DEFAULT_LOGO = 'data:image/jpeg;base64,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';
  var LH_DEF = { ar: '\u0623\u0645\u064A\u0631 \u0644\u062A\u0631\u0643\u064A\u0628 \u0645\u0639\u062F\u0627\u062A \u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0648\u0627\u0637\u0641\u0627\u0621 \u0627\u0644\u062D\u0631\u064A\u0642', en: 'AMEER FIRE AND SAFETY EQUIPMENT INSTALLATION', sub: 'ELECTROMECHANICAL WORKS' };
  function normVoucher(v) {
    v = v && typeof v === 'object' ? v : {};
    var n = Math.round(Number(v.pvNext)), t = v.lhText && typeof v.lhText === 'object' ? v.lhText : {}, lt = {};
    ['ar', 'en', 'sub'].forEach(function (k) { var s = String(t[k] == null ? '' : t[k]).replace(/\s+/g, ' ').trim().slice(0, 90); lt[k] = s || LH_DEF[k]; });
    var lg = typeof v.logo === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(v.logo) && v.logo.length < 700000 ? v.logo : '';
    return { pvNext: n >= 1 && n <= 99999999 ? n : 1001, logo: lg, lhText: lt };
  }
  function lhKey() { var v = normVoucher(db.appSettings.voucher); return (v.logo ? v.logo.length + v.logo.slice(-40) : 'D') + '|' + v.lhText.ar + '|' + v.lhText.en + '|' + v.lhText.sub; }
  function lhUrl() { return ui.lhc && ui.lhc.key === lhKey() ? ui.lhc.url : ''; }
  function buildLh() {
    var key = lhKey();
    if (ui.lhc && ui.lhc.key === key) return Promise.resolve(ui.lhc);
    if (ui.lhP && ui.lhP.key === key) return ui.lhP.p;
    var s = normVoucher(db.appSettings.voucher);
    var p = new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () {
        var W = 2400, H = 380, c = document.createElement('canvas'); c.width = W; c.height = H;
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
        var lhh = H - 24, lw = lhh * im.naturalWidth / im.naturalHeight; if (lw > 460) { lw = 460; lhh = lw * im.naturalHeight / im.naturalWidth; }
        x.drawImage(im, 14, (H - lhh) / 2, lw, lhh);
        var x0 = 14 + lw + 50, x1 = W - 24, cx = (x0 + x1) / 2, bw = x1 - x0;
        function fit(txt, mk, maxW, maxS, sx, minS) { var sz = maxS; for (; sz > minS; sz -= 2) { x.font = mk(sz); if (x.measureText(txt).width * sx <= maxW) break; } return sz; }
        x.textAlign = 'center'; x.textBaseline = 'alphabetic';
        x.direction = 'rtl'; x.fillStyle = '#E4505C';
        var arF = function (z) { return 'bold ' + z + 'px Tahoma, Arial, "Segoe UI", "DejaVu Sans", sans-serif'; };
        var az = fit(s.lhText.ar, arF, bw * 0.92, 150, 1, 40); x.font = arF(az); x.fillText(s.lhText.ar, cx, 140);
        x.direction = 'ltr'; x.fillStyle = '#2F3A9A';
        var enF = function (z) { return 'bold ' + z + 'px Arial, "Liberation Sans", Helvetica, sans-serif'; }, sxE = 0.8;
        var ez = fit(s.lhText.en, enF, bw * 0.98 / sxE, 120, 1, 30);
        x.save(); x.translate(cx, 262); x.scale(sxE, 1); x.font = enF(ez); x.fillText(s.lhText.en, 0, 0); x.restore();
        var sbF = function (z) { return 'bold ' + z + 'px Arial, "Liberation Sans", Helvetica, sans-serif'; };
        var bz = fit(s.lhText.sub, sbF, bw * 0.7, 58, 1, 20); x.font = sbF(bz); try { x.letterSpacing = '3px'; } catch (e) { }
        x.fillText(s.lhText.sub, cx, 336);
        var url = c.toDataURL('image/jpeg', 0.92);
        var o = { key: key, url: url, bytes: b64bytes(url), w: W, h: H }; ui.lhc = o; res(o);
      };
      im.onerror = function () { rej(new Error('logo')); };
      im.src = s.logo || DEFAULT_LOGO;
    });
    ui.lhP = { key: key, p: p };
    return p;
  }
  function vch() { if (!ui.vch) ui.vch = { type: 'adv', month: '', upto: '', lists: { adv: [], sal: [], rent: [] } }; return ui.vch; }
  function pvNext() { return normVoucher(db.appSettings.voucher).pvNext; }
  var W_ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var W_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function w999(n) {
    var s = '';
    if (n >= 100) { s += W_ONES[Math.floor(n / 100)] + ' hundred'; n %= 100; if (n) s += ' and '; }
    if (n >= 20) { s += W_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + W_ONES[n % 10] : ''); }
    else if (n > 0) s += W_ONES[n];
    return s;
  }
  function numWords(n) {
    if (n === 0) return 'zero';
    var parts = [], units = [[1000000000, 'billion'], [1000000, 'million'], [1000, 'thousand']];
    units.forEach(function (u) { if (n >= u[0]) { parts.push(w999(Math.floor(n / u[0])) + ' ' + u[1]); n %= u[0]; } });
    if (n > 0) parts.push((parts.length && n < 100 ? 'and ' : '') + w999(n));
    return parts.join(' ');
  }
  function amountWords(a) {
    a = r2(a); if (!(a > 0)) return '';
    var d = Math.floor(a + 1e-9), f = Math.round((a - d) * 100), s = '';
    if (d > 0) s = numWords(d) + ' dirham' + (d === 1 ? '' : 's');
    if (f > 0) s += (s ? ' and ' : '') + numWords(f) + ' fils';
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return s + (f > 0 ? ' only' : '’ only');
  }
  function fm2(n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function nn(x) { var v = Number(String(x == null ? '' : x).replace(/,/g, '')); return isFinite(v) ? v : 0; }
  function fmtDMY(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso); }
  function mon3(mon) { var p = mon.split('-'); return MONTHS[Number(p[1]) - 1].slice(0, 3).toUpperCase() + '-' + p[0]; }
  function defaultUpto(mon) { var t = todayStr(); return t.slice(0, 7) === mon ? t : lastDayOf(mon); }

  function vchNew(type, o) {
    var base = { id: uid() };
    if (type === 'sal') return Object.assign(base, { name: '', desig: '', month: '', days: '', basic: '', cleared: 0, allowance: '0', overtime: '0', deduction: '0', advance: '0', gross: '0', net: '0', payable: '0', m: {} }, o || {});
    return Object.assign(base, { date: '', pv: '', name: '', amount: '', words: '', wm: false, desc: '' }, o || {});
  }
  function salVRecalc(v) {
    v.m = v.m || {};
    if (!v.m.gross) v.gross = String(r2(nn(v.cleared) + nn(v.allowance) + nn(v.overtime)));
    if (!v.m.net) v.net = String(r2(nn(v.gross) - nn(v.deduction) - nn(v.advance)));
    if (!v.m.payable) v.payable = String(r2(nn(v.net)));
  }
  function salVoucherFor(e, mon, from, to) {
    var c = normCalc(db.appSettings.salaryCalc), D = c.days, endMon = lastDayOf(mon), fd = Number(from.slice(8)), td = to >= endMon ? 31 : Number(to.slice(8));
    var capTo = Math.min(to >= endMon ? D : Math.min(D, td), leaveCap(e, mon, D)), inRange = Math.max(0, capTo - (fd - 1)), lv = 0, nh = 0, sh = 0;
    attData(e, mon).cells.forEach(function (x) { if (!x.blocked && x.d >= fd && x.d <= td) { lv += x.lv; nh += x.nh; sh += x.sh; } });
    var wd = Math.max(0, r2(inRange - lv)), base = Number(e.salary) || 0, alw = Number(e.allowance) || 0, pdB = c.lb ? base / D : 0, pdA = c.la ? alw / D : 0, perHour = ((c.ob ? base : 0) + (c.oa ? alw : 0)) / D / c.hpd;
    function within(x) { return x.employeeId === e.id && String(x.date) >= from && String(x.date) <= to; }
    var v = vchNew('sal', {
      name: String(e.name).toUpperCase(), desig: String(e.designation || '').toUpperCase(), month: mon3(mon), days: String(wd), basic: String(r2(base)), allowance: String(Math.max(0, roundRule(alw - (D - wd) * pdA))),
      cleared: Math.max(0, roundRule(base - (D - wd) * pdB)), overtime: String(roundRule(nh * perHour * c.mulN + sh * perHour * c.mulS)),
      deduction: String(sumAdv(db.deductions.filter(within))), advance: String(sumAdv(db.advances.filter(within)))
    });
    salVRecalc(v); return v;
  }
  function vchGenerate() {
    var V = vch(), mon = vm($('#vch-month').value), from = $('#vch-from').value, upto = $('#vch-upto').value;
    if (!mon) { toast('Pick a month.', 'error'); return; }
    if (!isDate(from)) from = mon + '-01';
    if (!isDate(upto)) upto = lastDayOf(mon);
    if (from > upto) { toast('From date is after the up to date.', 'error'); return; }
    var first = mon + '-01', last = lastDayOf(mon), cf = from > first ? from : first, ct = upto < last ? upto : last, list = [], note = '', pv = Math.round(Number($('#vch-pv').value)) || pvNext();
    if (V.type !== 'adv' && cf > ct) { toast('The date range is outside the selected month.', 'error'); return; }
    V.month = mon; V.from = from; V.upto = upto;
    if (V.type === 'adv') {
      var rows = db.advances.filter(function (a) { return String(a.date) >= from && String(a.date) <= upto && db.employees.some(function (e) { return e.id === a.employeeId; }); })
        .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || empName(a.employeeId).localeCompare(empName(b.employeeId)); });
      list = rows.map(function (a, i) {
        return vchNew('adv', { date: fmtDMY(a.date), pv: String(pv + i), name: empName(a.employeeId).toUpperCase(), amount: String(a.amount), words: amountWords(a.amount),
          desc: 'ADVANCE' + (a.reason && a.reason !== '-' ? ' (' + String(a.reason).toUpperCase() + ')' : '') });
      });
      if (!list.length) note = 'No advances found from ' + fmtDate(from) + ' to ' + fmtDate(upto) + '.';
    } else if (V.type === 'rent') {
      var emps = db.employees.filter(function (e) { return (Number(e.roomRent) || 0) > 0 && inScope(e, mon, true); }).sort(byName);
      var lab = cf === first && ct === last ? monthLabel(mon).toUpperCase() : 'FROM ' + fmtDMY(cf) + ' TO ' + fmtDMY(ct);
      list = emps.map(function (e, i) {
        return vchNew('rent', { date: fmtDMY(ct), pv: String(pv + i), name: String(e.name).toUpperCase(), amount: String(r2(e.roomRent)), words: amountWords(e.roomRent), desc: 'ROOM RENT (' + lab + ')' });
      });
      if (!list.length) note = 'No employee has a Monthly Room Rent set. Edit an employee and enter Monthly Room Rent, or use "Add blank voucher".';
    } else {
      var all = repEmployees(mon, true), skipped = 0;
      all.forEach(function (e) { if (!(Number(e.salary) > 0)) { skipped++; return; } list.push(salVoucherFor(e, mon, cf, ct)); });
      if (skipped) note = skipped + ' employee(s) skipped because no base salary is set.';
      if (!list.length) note = (note ? note + ' ' : '') + 'No salary vouchers to generate.';
    }
    V.lists[V.type] = list; renderVouchers();
    $('#vouchers-note').textContent = note;
    if (list.length) toast(list.length + ' voucher(s) generated. You can edit any field before downloading.');
  }
  function vchAdd() {
    var V = vch(), mon = V.month || todayStr().slice(0, 7), upto = V.upto || defaultUpto(mon), l = V.lists[V.type];
    if (V.type === 'sal') l.push(vchNew('sal', { month: mon3(mon), days: '', basic: '' }));
    else {
      var mx = Math.max.apply(null, [pvNext() - 1].concat(l.map(function (x) { return Math.round(nn(x.pv)); })));
      l.push(vchNew(V.type, { date: fmtDMY(upto), pv: String(mx + 1), desc: V.type === 'rent' ? 'ROOM RENT (' + monthLabel(mon).toUpperCase() + ')' : 'ADVANCE' }));
    }
    renderVouchers();
  }
  function vchBump() {
    var V = vch(); if (V.type === 'sal') return;
    var mx = 0; V.lists[V.type].forEach(function (x) { var n = Math.round(nn(x.pv)); if (n > mx) mx = n; });
    if (mx && mx + 1 > pvNext()) { var s = normVoucher(db.appSettings.voucher); s.pvNext = mx + 1; db.appSettings.voucher = s; save('appSettings'); $('#vch-pv').value = s.pvNext; }
  }
  function esa(s) { return esc(s == null ? '' : s); }
  function vchCardHtml(type, v) {
    var del = '<button type="button" class="v-del no-print" data-action="vch-del" data-id="' + esa(v.id) + '" title="Remove this voucher">&times;</button>';
    var img = '<img class="v-lh" src="' + lhUrl() + '" alt="Letterhead">';
    var sign = '<div class="v-sign"><span>PREPARED BY</span><span>APPROVED BY</span><span>RECEIVED BY</span></div>';
    function inp(f, extra) { var sz = (f === 'days' || f === 'basic' || f === 'payable') ? ' size="' + Math.max(1, String(v[f] == null ? '' : v[f]).length) + '"' : ''; return '<input data-vf="' + f + '" value="' + esa(v[f]) + '" autocomplete="off"' + sz + (extra || '') + '>'; }
    if (type === 'sal') {
      return '<div class="v-card slip" data-vid="' + esa(v.id) + '">' + del + img + '<div class="v-ttl">PAY SLIP</div>' +
        '<div class="v-kv"><span>Name of Employee</span><b>:</b>' + inp('name') + '</div>' +
        '<div class="v-kv"><span>Designation</span><b>:</b>' + inp('desig') + '</div>' +
        '<div class="v-kv"><span>Month</span><b>:</b>' + inp('month') + '</div>' +
        '<div class="v-kv"><span>No of days</span><b>:</b><span class="v-w">' + inp('days', ' inputmode="decimal"') + ' Days</span></div>' +
        '<div class="v-kv"><span>Basic salary</span><b>:</b><span class="v-w">' + inp('basic', ' inputmode="decimal"') + '/- AED</span></div>' +
        '<table class="v-tb"><tr><td>Allowance</td><td>' + inp('allowance', ' inputmode="decimal"') + '</td><td>Deduction</td><td>' + inp('deduction', ' inputmode="decimal"') + '</td></tr>' +
        '<tr><td>Over time</td><td>' + inp('overtime', ' inputmode="decimal"') + '</td><td>Advance</td><td>' + inp('advance', ' inputmode="decimal"') + '</td></tr>' +
        '<tr><td><b>Gross salary</b></td><td>' + inp('gross', ' inputmode="decimal"') + '</td><td><b>Net salary</b></td><td>' + inp('net', ' inputmode="decimal"') + '</td></tr></table>' +
        '<div class="v-pay"><b>Salary Payable:</b> ' + inp('payable', ' inputmode="decimal"') + '<b>/- AED</b></div>' + sign + '</div>';
    }
    return '<div class="v-card" data-vid="' + esa(v.id) + '">' + del + img +
      '<div class="v-r1"><span>DATE: ' + inp('date') + '</span><span>PV.NO.' + inp('pv') + '</span></div>' +
      '<div class="v-mid"><div class="v-lines">' +
      '<div class="v-ln"><span>Paid to Mr./s:</span>' + inp('name') + '</div>' +
      '<div class="v-ln"><span>Amount (In words):</span><textarea data-vf="words" rows="1">' + esa(v.words) + '</textarea></div>' +
      '<div class="v-ln"><span>Begin :</span><textarea data-vf="desc" rows="1">' + esa(v.desc) + '</textarea></div></div>' +
      '<div class="v-box"><b>AED:</b> ' + inp('amount', ' inputmode="decimal"') + '</div></div>' + sign + '</div>';
  }
  function renderVouchers() {
    var V = vch(), lock = $('#vouchers-lock'), body = $('#vouchers-body'), tools = $('#vch-tools'), ctrl = $('#vch-ctrl');
    $$('input[name="vchType"]').forEach(function (r) { r.checked = r.value === V.type; });
    if (V.type === 'sal' && !ui.salUnlocked) {
      ctrl.classList.add('hidden'); tools.classList.add('hidden'); body.innerHTML = ''; $('#vouchers-note').textContent = ''; lock.innerHTML = lockHtml(); return;
    }
    lock.innerHTML = ''; ctrl.classList.remove('hidden');
    if (!V.month) V.month = todayStr().slice(0, 7);
    if (!V.upto) V.upto = defaultUpto(V.month);
    if (!V.from) V.from = V.month + '-01';
    $('#vch-month').value = V.month; $('#vch-from').value = V.from; $('#vch-upto').value = V.upto; $('#vch-pv').value = pvNext();
    var lt = normVoucher(db.appSettings.voucher).lhText;
    $$('[data-lh]').forEach(function (el) { if (document.activeElement !== el) el.value = lt[el.dataset.lh]; });
    if (!lhUrl()) { buildLh().then(function () { if (ui.view === 'vouchers') renderVouchers(); }, function () { toast('Could not build the letterhead.', 'error'); }); }
    $('#vch-pv-wrap').classList.toggle('hidden', V.type === 'sal');
    $('#vch-add-btn').textContent = '+ Add blank ' + (V.type === 'sal' ? 'pay slip' : 'voucher');
    var list = V.lists[V.type]; tools.classList.toggle('hidden', !list.length);
    if (!list.length) { body.innerHTML = '<div class="card"><div class="card-body"><p class="hint">Pick the month and up to date, then click <strong>Generate</strong>. ' +
      (V.type === 'adv' ? 'One voucher is made for every advance in that month up to the date.' : V.type === 'rent' ? 'Vouchers are made for employees who have a Monthly Room Rent set.' : 'One pay slip is made per employee with a base salary.') + ' Two vouchers fit on one A4 sheet.</p></div></div>'; return; }
    var pages = '';
    for (var i = 0; i < list.length; i += 2) pages += '<div class="v-page">' + vchCardHtml(V.type, list[i]) + (list[i + 1] ? vchCardHtml(V.type, list[i + 1]) : '') + '</div>';
    body.innerHTML = '<div class="v-sheets">' + pages + '</div>';
    $$('.v-card textarea').forEach(fitTa);
  }
  function fitTa(t) { t.style.setProperty('height', 'auto', 'important'); t.style.setProperty('height', Math.max(t.scrollHeight, 18) + 'px', 'important'); }
  function vchEdit(card, el) {
    var V = vch(), list = V.lists[V.type], v = list.find(function (x) { return x.id === card.dataset.vid; }); if (!v) return;
    var f = el.dataset.vf, val = el.value;
    if (el.tagName === 'TEXTAREA') fitTa(el);
    function fitIn(t) { if (t && (t.dataset.vf === 'days' || t.dataset.vf === 'basic' || t.dataset.vf === 'payable')) t.size = Math.max(1, String(t.value).length); }
    function setIn(k) { var t = card.querySelector('[data-vf="' + k + '"]'); if (t && t !== el) { t.value = v[k]; fitIn(t); } }
    fitIn(el);
    if (V.type !== 'sal') {
      v[f] = val;
      if (f === 'amount' && !v.wm) { v.words = amountWords(nn(val)); setIn('words'); }
      if (f === 'words') v.wm = val.trim() !== amountWords(nn(v.amount));
      return;
    }
    v.m = v.m || {}; var D = normCalc(db.appSettings.salaryCalc).days;
    if (f === 'gross' || f === 'net' || f === 'payable') {
      v[f] = val; v.m[f] = true;
      var t = Object.assign({}, v, { m: Object.assign({}, v.m) }); t.m[f] = false; salVRecalc(t);
      if (r2(nn(val)) === r2(nn(t[f]))) v.m[f] = false;
    } else v[f] = val;
    if (f === 'days' || f === 'basic') { var b = nn(v.basic); v.cleared = Math.max(0, roundRule(b - (D - nn(v.days)) * (b / D))); }
    salVRecalc(v); ['gross', 'net', 'payable'].forEach(setIn);
  }

  /* ---- ZIP (store) + DOCX ---- */
  var CRC_T = null;
  function crc32(b) {
    if (!CRC_T) { CRC_T = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; } }
    var c2 = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c2 = CRC_T[(c2 ^ b[i]) & 255] ^ (c2 >>> 8);
    return (c2 ^ 0xFFFFFFFF) >>> 0;
  }
  function u8(s) { return new TextEncoder().encode(s); }
  function zipStore(files) {
    var chunks = [], cen = [], off = 0, cs = 0;
    files.forEach(function (f) {
      var nb = u8(f.name), crc = crc32(f.data), sz = f.data.length, lh = new Uint8Array(30 + nb.length), dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(12, 0x21, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, sz, true); dv.setUint32(22, sz, true); dv.setUint16(26, nb.length, true); lh.set(nb, 30);
      chunks.push(lh, f.data);
      var ce = new Uint8Array(46 + nb.length), cv = new DataView(ce.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, sz, true); cv.setUint32(24, sz, true); cv.setUint16(28, nb.length, true); cv.setUint32(42, off, true); ce.set(nb, 46);
      cen.push(ce); cs += ce.length; off += lh.length + sz;
    });
    var end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cs, true); ev.setUint32(16, off, true);
    return new Blob(chunks.concat(cen, [end]), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  function b64bytes(url) { var s = atob(url.split(',')[1]), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function loadLh() { return buildLh(); }
  function xe(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
  var TW = 56.6929;
  function tw(mm) { return Math.round(mm * TW); }
  function dRun(t, o) {
    o = o || {};
    return '<w:r><w:rPr><w:rFonts w:ascii="' + (o.font || 'Arial') + '" w:hAnsi="' + (o.font || 'Arial') + '" w:cs="' + (o.font || 'Arial') + '"/>' + (o.b ? '<w:b/>' : '') + (o.u ? '<w:u w:val="single"/>' : '') +
      '<w:sz w:val="' + (o.sz || 22) + '"/></w:rPr>' + (o.tabBefore ? '<w:tab/>' : '') + '<w:t xml:space="preserve">' + xe(t) + '</w:t></w:r>';
  }
  function dTab(o) { o = o || {}; return '<w:r><w:rPr><w:rFonts w:ascii="' + (o.font || 'Arial') + '" w:hAnsi="' + (o.font || 'Arial') + '"/><w:sz w:val="' + (o.sz || 22) + '"/></w:rPr><w:tab/></w:r>'; }
  function dPara(runs, o) {
    o = o || {};
    return '<w:p><w:pPr>' + (o.keep ? '<w:keepNext/>' : '') + (o.border ? '<w:pBdr><w:top w:val="single" w:sz="8" w:space="6" w:color="000000"/><w:left w:val="single" w:sz="8" w:space="6" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:space="6" w:color="000000"/><w:right w:val="single" w:sz="8" w:space="6" w:color="000000"/></w:pBdr>' : '') +
      (o.tabs ? '<w:tabs>' + o.tabs.map(function (t) { return '<w:tab w:val="' + t[0] + '" w:pos="' + tw(t[1]) + '"/>'; }).join('') + '</w:tabs>' : '') +
      '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after || 0) + '" w:line="' + (o.line || 276) + '" w:lineRule="auto"/>' +
      (o.ind != null || o.indR != null ? '<w:ind w:left="' + tw(o.ind || 0) + '" w:right="' + tw(o.indR || 0) + '"/>' : '') + (o.jc ? '<w:jc w:val="' + o.jc + '"/>' : '') + '</w:pPr>' + runs + '</w:p>';
  }
  var dImgId = 0;
  function dImg(lh, wmm) {
    var cx = Math.round(wmm * 36000), cy = Math.round(wmm * 36000 * lh.h / lh.w), id = ++dImgId;
    return '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="Letterhead ' + id + '"/>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + id + '" name="letterhead.jpg"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="rIdLH"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  }
  var NOB = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
  function dTable(widths, rows, o) {
    o = o || {};
    var bd = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (s) { return '<w:' + s + ' w:val="single" w:sz="' + (o.borders ? 6 : 4) + '" w:space="0" w:color="' + (o.borders ? '000000' : 'FFFFFF') + '"/>'; }).join('') + '</w:tblBorders>';
    return '<w:tbl><w:tblPr><w:tblW w:w="' + tw(widths.reduce(function (a, b) { return a + b; }, 0)) + '" w:type="dxa"/>' + (o.ind ? '<w:tblInd w:w="' + tw(o.ind) + '" w:type="dxa"/>' : '') + bd + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="' + (o.mar == null ? 60 : o.mar) + '" w:type="dxa"/><w:right w:w="' + (o.mar == null ? 60 : o.mar) + '" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      '<w:tblGrid>' + widths.map(function (w) { return '<w:gridCol w:w="' + tw(w) + '"/>'; }).join('') + '</w:tblGrid>' +
      rows.map(function (r, ri) { return '<w:tr><w:trPr><w:cantSplit/>' + (o.rowH ? '<w:trHeight w:val="' + tw(o.rowH) + '" w:hRule="atLeast"/>' : '') + '</w:trPr>' + r.map(function (c, i) { return '<w:tc><w:tcPr><w:tcW w:w="' + tw(widths[i]) + '" w:type="dxa"/>' + ((o.rowBd && o.rowBd[ri]) || '') + '<w:vAlign w:val="' + (o.valign || 'top') + '"/></w:tcPr>' + c + '</w:tc>'; }).join('') + '</w:tr>'; }).join('') + '</w:tbl>';
  }
  function dPayInner(v, lh) {
    var A = { font: 'Arial', sz: 22 };
    return dImg(lh, 172) +
      dPara(dRun('DATE: ' + v.date, A) + dTab(A) + dRun('PV.NO.' + v.pv, A), { before: 200, after: 120, ind: 7, tabs: [['right', 165]] }) +
      dTable([122, 50], [[
        dPara(dRun('Paid to Mr./s: ', A) + dRun(v.name, { font: 'Arial', sz: 22, b: true }), { before: 140, after: 200, ind: 18 }) +
        dPara(dRun('Amount (In words): ', A) + dRun(v.words, A), { after: 200, ind: 18 }) +
        dPara(dRun('Begin : ', A) + dRun(v.desc, A), { after: 0, ind: 18 }),
        dPara(dRun('AED: ' + fm2(nn(v.amount)), { font: 'Arial', sz: 22, b: true }), { before: 160, jc: 'center', border: true, ind: 4, indR: 4 })
      ]], { mar: 0 }) +
      dPara(dTab(A) + dRun('PREPARED BY', { font: 'Arial', sz: 20, b: true }) + dTab(A) + dRun('APPROVED BY', { font: 'Arial', sz: 20, b: true }) + dTab(A) + dRun('RECEIVED BY', { font: 'Arial', sz: 20, b: true }),
        { before: 2500, tabs: [['center', 33], ['center', 88], ['center', 143]] });
  }
  function dSlipInner(v, lh) {
    var T = { font: 'Times New Roman', sz: 20 }, TB = { font: 'Times New Roman', sz: 20, b: true };
    function kv(l, val) { return dPara(dRun(l, T) + dTab(T) + dRun(':', T) + dTab(T) + dRun(val, T), { after: 90, ind: 15, tabs: [['left', 58], ['left', 72]] }); }
    function cell(t, o) { return dPara(dRun(t, o && o.b ? TB : T), { jc: o && o.r ? 'right' : 'left', before: 40, after: 40 }); }
    return dImg(lh, 172) + dPara(dRun('PAY SLIP', { font: 'Times New Roman', sz: 24, b: true, u: true }), { jc: 'center', before: 200, after: 160 }) +
      kv('Name of Employee', v.name) + kv('Designation', v.desig) + kv('Month', v.month) + kv('No of days', v.days + ' Days') + kv('Basic salary', fm2(nn(v.basic)) + '/- AED') +
      dPara('', { after: 60, line: 120 }) +
      dTable([45, 33, 45, 33], [
        [cell('Allowance'), cell(fm2(nn(v.allowance)), { r: 1 }), cell('Deduction'), cell(fm2(nn(v.deduction)), { r: 1 })],
        [cell('Over time'), cell(fm2(nn(v.overtime)), { r: 1 }), cell('Advance'), cell(fm2(nn(v.advance)), { r: 1 })],
        [cell('Gross salary', { b: 1 }), cell(fm2(nn(v.gross)), { r: 1 }), cell('Net salary', { b: 1 }), cell(fm2(nn(v.net)), { r: 1 })]
      ], { borders: true, ind: 15 }) +
      dPara(dRun('Salary Payable: ' + fm2(nn(v.payable)) + '/- AED', TB), { before: 200, after: 0, ind: 15 }) +
      dPara(dRun('PREPARED BY', T) + dTab(T) + dRun('APPROVED BY', T) + dTab(T) + dRun('RECEIVED BY', T), { before: 560, ind: 15, tabs: [['center', 92], ['right', 170]] });
  }
  function buildDocx(type, list, lh) {
    dImgId = 0;
    var body = '', pages = Math.ceil(list.length / 2), NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
    for (var p = 0; p < pages; p++) {
      var rows = [];
      [list[p * 2], list[p * 2 + 1]].forEach(function (v) {
        if (!v) { rows.push(['<w:p/>']); return; }
        rows.push([type === 'sal' ? dSlipInner(v, lh) : dPayInner(v, lh)]);
      });
      var tbl = dTable([190], rows, { mar: 0, rowH: 141, rowBd: list[p * 2 + 1] ? ['<w:tcBorders><w:bottom w:val="dashed" w:sz="6" w:space="0" w:color="B5B5B5"/></w:tcBorders>'] : null });
      tbl = tbl.replace(/<w:trHeight w:val="(\d+)" w:hRule="atLeast"\/>/g, '<w:trHeight w:val="' + tw(141) + '" w:hRule="exact"/>');
      body += tbl + (p < pages - 1 ? '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>' : '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>');
    }
    var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + body +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="' + tw(4) + '" w:right="' + tw(10) + '" w:bottom="' + tw(4) + '" w:left="' + tw(10) + '" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>';
    return zipStore([
      { name: '[Content_Types].xml', data: u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
      { name: '_rels/.rels', data: u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
      { name: 'word/_rels/document.xml.rels', data: u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/letterhead.jpg"/></Relationships>') },
      { name: 'word/document.xml', data: u8(doc) },
      { name: 'word/media/letterhead.jpg', data: lh.bytes }
    ]);
  }

  /* ---- PDF ---- */
  var PDF_MM = 72 / 25.4, PDF_PW = 595.28, PDF_PH = 841.89, mCtx = null;
  var PDF_FONTS = { F1: 'Arial', F2: 'bold Arial', F3: '"Times New Roman"', F4: 'bold "Times New Roman"' };
  function mwMm(s, size, f) {
    if (!mCtx) mCtx = document.createElement('canvas').getContext('2d');
    mCtx.font = (f === 'F2' || f === 'F4' ? 'bold ' : '') + '100px ' + (f === 'F1' || f === 'F2' ? 'Arial, Helvetica, sans-serif' : '"Times New Roman", Times, serif');
    return mCtx.measureText(String(s)).width / 100 * size / PDF_MM;
  }
  function pdfEsc(s) {
    var out = '';
    String(s).split('').forEach(function (ch) {
      var c = ch.charCodeAt(0), m = { 0x2019: 0x92, 0x2018: 0x91, 0x201C: 0x93, 0x201D: 0x94, 0x2013: 0x96, 0x2014: 0x97 };
      if (m[c]) c = m[c]; else if (c > 255) c = 63; else if (c < 32) c = 32;
      if (c === 40 || c === 41 || c === 92) out += '\\' + ch; else if (c > 126) out += '\\' + ('00' + c.toString(8)).slice(-3); else out += String.fromCharCode(c);
    });
    return out;
  }
  function pdfWrap(text, x0, maxX, size, f) {
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (cur && x0 + mwMm(t, size, f) > maxX) { lines.push(cur); cur = w; } else cur = t; });
    if (cur || !lines.length) lines.push(cur);
    return lines;
  }
  function pdfSlot(ops, oy, type, v, lh) {
    function X(x) { return (x * PDF_MM).toFixed(2); }
    function Y(y) { return (PDF_PH - (oy + y) * PDF_MM).toFixed(2); }
    function line(x1, y1, x2, y2, w, grey) { ops.push((grey ? '0.65 G ' : '0 G ') + w + ' w ' + X(x1) + ' ' + Y(y1) + ' m ' + X(x2) + ' ' + Y(y2) + ' l S'); }
    function T(x, y, s, f, size, al, under) {
      s = String(s == null ? '' : s); if (!s) return 0;
      var w = mwMm(s, size, f), xx = al === 'c' ? x - w / 2 : al === 'r' ? x - w : x;
      ops.push('BT /' + f + ' ' + size + ' Tf ' + X(xx) + ' ' + Y(y) + ' Td (' + pdfEsc(s) + ') Tj ET');
      if (under) line(xx, y + 0.9, xx + w, y + 0.9, 0.5);
      return w;
    }
    function rr(x, y, w, h, r) {
      var k = r * 0.5523, x2 = x + w, y2 = y + h;
      ops.push('0 G 0.7 w ' + X(x + r) + ' ' + Y(y) + ' m ' + X(x2 - r) + ' ' + Y(y) + ' l ' + X(x2 - r + k) + ' ' + Y(y) + ' ' + X(x2) + ' ' + Y(y + r - k) + ' ' + X(x2) + ' ' + Y(y + r) + ' c ' +
        X(x2) + ' ' + Y(y2 - r) + ' l ' + X(x2) + ' ' + Y(y2 - r + k) + ' ' + X(x2 - r + k) + ' ' + Y(y2) + ' ' + X(x2 - r) + ' ' + Y(y2) + ' c ' + X(x + r) + ' ' + Y(y2) + ' l ' +
        X(x + r - k) + ' ' + Y(y2) + ' ' + X(x) + ' ' + Y(y2 - r + k) + ' ' + X(x) + ' ' + Y(y2 - r) + ' c ' + X(x) + ' ' + Y(y + r) + ' l ' + X(x) + ' ' + Y(y + r - k) + ' ' + X(x + r - k) + ' ' + Y(y) + ' ' + X(x + r) + ' ' + Y(y) + ' c S');
    }
    var W = 180, lhH = W * lh.h / lh.w;
    ops.push('q ' + (W * PDF_MM).toFixed(2) + ' 0 0 ' + (lhH * PDF_MM).toFixed(2) + ' ' + X(15) + ' ' + Y(8 + lhH) + ' cm /Im1 Do Q');
    if (type === 'sal') {
      var F = 'F3', FB = 'F4', y0 = 8 + lhH + 11, FS = 10;
      T(105, y0, 'PAY SLIP', FB, 12, 'c', true);
      var rows = [['Name of Employee', v.name], ['Designation', v.desig], ['Month', v.month], ['No of days', v.days + ' Days'], ['Basic salary', fm2(nn(v.basic)) + '/- AED']], ry = y0 + 10;
      rows.forEach(function (r, i) { var y = ry + i * 7; T(25, y, r[0], F, FS); T(78, y, ':', F, FS); T(88, y, r[1], F, FS); });
      var top = ry + 5 * 7 - 2, rh = 7, cx = [25, 65, 105, 145, 185];
      var cells = [['Allowance', fm2(nn(v.allowance)), 'Deduction', fm2(nn(v.deduction))], ['Over time', fm2(nn(v.overtime)), 'Advance', fm2(nn(v.advance))], ['Gross salary', fm2(nn(v.gross)), 'Net salary', fm2(nn(v.net))]];
      for (var i = 0; i <= 3; i++) line(25, top + i * rh, 185, top + i * rh, 0.6);
      cx.forEach(function (x) { line(x, top, x, top + 3 * rh, 0.6); });
      cells.forEach(function (r, i) {
        var yb = top + i * rh + 4.8, b = i === 2 ? FB : F;
        T(27, yb, r[0], b, FS); T(103, yb, r[1], F, FS, 'r'); T(107, yb, r[2], b, FS); T(183, yb, r[3], F, FS, 'r');
      });
      T(25, top + 3 * rh + 11, 'Salary Payable: ' + fm2(nn(v.payable)) + '/- AED', FB, 10.5);
      T(25, 140, 'PREPARED BY', F, FS); T(105, 140, 'APPROVED BY', F, FS, 'c'); T(185, 140, 'RECEIVED BY', F, FS, 'r');
      return;
    }
    var y = 8 + lhH + 11, F1 = 'F1', F2 = 'F2';
    T(22, y, 'DATE: ' + v.date, F1, 11); T(188, y, 'PV.NO.' + v.pv, F1, 11, 'r');
    rr(140, y + 9, 50, 16, 3); T(165, y + 19.5, 'AED: ' + fm2(nn(v.amount)), F2, 11, 'c');
    var ly = y + 17, lw = T(32, ly, 'Paid to Mr./s: ', F1, 11); T(32 + lw, ly, v.name, F2, 11);
    var wy = ly + 14, wl = mwMm('Amount (In words): ', 11, F1), xv = 32 + wl;
    T(32, wy, 'Amount (In words): ', F1, 11);
    var lines = pdfWrap(v.words, xv, 190, 11, F1); lines.forEach(function (t, i) { T(xv, wy + i * 5.6, t, F1, 11); });
    var dy = wy + (lines.length - 1) * 5.6 + 13, dl = mwMm('Begin : ', 11, F1);
    T(32, dy, 'Begin : ', F1, 11);
    pdfWrap(v.desc, 32 + dl, 190, 11, F1).forEach(function (t, i) { T(32 + dl, dy + i * 5.6, t, F1, 11); });
    [45, 105, 165].forEach(function (x, i) { T(x, 136, ['PREPARED BY', 'APPROVED BY', 'RECEIVED BY'][i], F2, 10, 'c'); });
  }
  function buildPdf(type, list, lh) {
    var pageOps = [];
    for (var i = 0; i < list.length; i += 2) {
      var ops = []; pdfSlot(ops, 0, type, list[i], lh);
      if (list[i + 1]) {
        pdfSlot(ops, 148.5, type, list[i + 1], lh);
        ops.push('0.7 G [3 3] 0 d 0.4 w ' + (8 * PDF_MM).toFixed(2) + ' ' + (PDF_PH - 148.5 * PDF_MM).toFixed(2) + ' m ' + (202 * PDF_MM).toFixed(2) + ' ' + (PDF_PH - 148.5 * PDF_MM).toFixed(2) + ' l S [] 0 d');
      }
      pageOps.push(ops.join('\n'));
    }
    var parts = [], len = 0, offs = [];
    function add(x) { var b = typeof x === 'string' ? Uint8Array.from(x.split('').map(function (c) { return c.charCodeAt(0) & 255; })) : x; parts.push(b); len += b.length; }
    function obj(n, body) { offs[n] = len; add(n + ' 0 obj\n'); add(body); add('\nendobj\n'); }
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    var nP = pageOps.length, kids = [];
    for (var k = 0; k < nP; k++) kids.push((8 + k * 2) + ' 0 R');
    obj(1, '<</Type/Catalog/Pages 2 0 R>>'); obj(2, '<</Type/Pages/Kids[' + kids.join(' ') + ']/Count ' + nP + '>>');
    ['Helvetica', 'Helvetica-Bold', 'Times-Roman', 'Times-Bold'].forEach(function (f, i) { obj(3 + i, '<</Type/Font/Subtype/Type1/BaseFont/' + f + '/Encoding/WinAnsiEncoding>>'); });
    offs[7] = len; add('7 0 obj\n<</Type/XObject/Subtype/Image/Width ' + lh.w + '/Height ' + lh.h + '/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ' + lh.bytes.length + '>>\nstream\n'); add(lh.bytes); add('\nendstream\nendobj\n');
    pageOps.forEach(function (c, i) {
      var pn = 8 + i * 2;
      obj(pn, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 ' + PDF_PW + ' ' + PDF_PH + ']/Resources<</Font<</F1 3 0 R/F2 4 0 R/F3 5 0 R/F4 6 0 R>>/XObject<</Im1 7 0 R>>>>/Contents ' + (pn + 1) + ' 0 R>>');
      obj(pn + 1, '<</Length ' + c.length + '>>\nstream\n' + c + '\nendstream');
    });
    var total = 8 + nP * 2, xr = len; add('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (var n = 1; n < total; n++) add(('0000000000' + offs[n]).slice(-10) + ' 00000 n \n');
    add('trailer\n<</Size ' + total + '/Root 1 0 R>>\nstartxref\n' + xr + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function vchFileName(ext) {
    var V = vch(), n = V.type === 'adv' ? 'advance-vouchers' : V.type === 'rent' ? 'room-rent-vouchers' : 'salary-payslips';
    return n + '-' + (V.month || 'month') + '.' + ext;
  }
  function vchDownload(kind) {
    var V = vch(), list = V.lists[V.type];
    if (!list.length) { toast('Generate vouchers first.', 'error'); return; }
    loadLh().then(function (lh) {
      var blob = kind === 'pdf' ? buildPdf(V.type, list, lh) : buildDocx(V.type, list, lh);
      download(vchFileName(kind === 'pdf' ? 'pdf' : 'docx'), blob, blob.type); vchBump();
      toast((kind === 'pdf' ? 'PDF' : 'Word') + ' downloaded (' + list.length + ' voucher' + (list.length === 1 ? '' : 's') + ', ' + Math.ceil(list.length / 2) + ' A4 sheet' + (list.length > 2 ? 's' : '') + ').');
    }, function () { toast('Could not read the letterhead image.', 'error'); });
  }
  function vchPrint() {
    var V = vch(); if (!V.lists[V.type].length) { toast('Generate vouchers first.', 'error'); return; }
    var st = document.createElement('style'); st.id = 'pg-a4'; st.textContent = '@page{size:A4 portrait;margin:0}'; document.head.appendChild(st);
    window.addEventListener('afterprint', function () { var x = document.getElementById('pg-a4'); if (x) x.remove(); }, { once: true });
    vchBump(); window.print();
  }
  function vchLogo(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('Choose an image file.', 'error'); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var im = new Image();
      im.onload = function () {
        var sc = Math.min(1, 700 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
        var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(im, 0, 0, c.width, c.height);
        var url = c.toDataURL('image/jpeg', 0.9);
        if (url.length > 650000) { toast('Image is too large — use a smaller logo.', 'error'); return; }
        var s = normVoucher(db.appSettings.voucher); s.logo = url; db.appSettings.voucher = s;
        if (save('appSettings')) { renderVouchers(); toast('Logo updated.'); }
      };
      im.onerror = function () { toast('Could not read that image.', 'error'); };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

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
    return db.employees.filter(function (e) { return (e.status === 'Active' && !isEx(e)) || e.id === cur; }).sort(byName)
      .map(function (e) { return [e.id, e.name + ' (' + e.empId + ')']; });
  }
  function workerOptions(cur) {
    return db.outsideWorkers.filter(function (w) { return w.status === 'Active' || w.id === cur; }).sort(byName)
      .map(function (w) { return [w.id, w.name + ' (' + w.workerId + ')']; });
  }
  var STATUS_OPTS = [['Active', 'Active'], ['Inactive', 'Inactive']];
  var EMP_STATUS_OPTS = [['Active', 'Active'], ['Inactive', 'Inactive'], ['Ex-Employee', 'Ex-Employee (left company)']];
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
          { name: 'leavingDate', label: 'Leaving Date', type: 'date', hint: 'Optional — moves to Ex-Employees on this date' },
          { name: 'status', label: 'Status', type: 'select', required: true, options: EMP_STATUS_OPTS },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { status: 'Active' }; },
      validate: function (v, rec) {
        var dup = db.employees.find(function (e) { return e.empId.toLowerCase() === v.empId.toLowerCase() && (!rec || e.id !== rec.id); });
        if (dup) return { msg: 'Employee ID "' + v.empId + '" is already used by ' + dup.name + '.', field: 'empId' };
        if (v.phone && !/^[0-9+()\-\s]{6,25}$/.test(v.phone)) return { msg: 'Enter a valid phone number.', field: 'phone' };
        if (v.leavingDate && v.joiningDate && v.leavingDate < v.joiningDate) return { msg: 'Leaving date cannot be before the joining date.', field: 'leavingDate' };
        return null;
      },
      normalize: function (v) {
        var o = Object.assign({}, v);
        if (o.status === 'Ex-Employee' && !o.leavingDate) o.leavingDate = todayStr();
        if (!o.leavingDate) o.leavingDate = '';
        return o;
      },
      bulkNames: ['designation', 'department', 'status', 'leavingDate', 'notes'],
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
          { name: 'clearedMode', label: 'Status', type: 'select', options: [['auto', 'Auto (by salary date)'], ['cleared', 'Cleared (manual)'], ['pending', 'Not Cleared (manual)']], hint: 'Auto = Cleared when dated on/before the previous month salary date' },
          { name: 'reason', label: 'Reason', type: 'text', maxlength: 150, wide: true },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { date: todayStr(), clearedMode: 'auto' }; },
      validate: function () { return null; },
      customSave: function (v, people) {
        if (!people) return null;
        var now = new Date().toISOString();
        people.forEach(function (p) { db.advances.push({ id: uid(), createdAt: now, employeeId: p, date: v.date, amount: v.amount, clearedMode: v.clearedMode || 'auto', reason: v.reason, notes: v.notes }); });
        return { msg: 'Advance added for ' + people.length + ' employee(s).', count: people.length };
      },
      bulkNames: ['date', 'amount', 'clearedMode', 'reason', 'notes'],
      describe: function (r) { return 'advance of ' + empName(r.employeeId) + ' on ' + r.date; }
    },
    deductions: {
      title: 'Deduction', coll: 'deductions', needs: NEED_EMP,
      fields: function (rec) {
        return [
          personField('employeeId', 'Employee', 'employee', empOptions(rec && rec.employeeId), rec),
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'type', label: 'Type', type: 'select', required: true, options: [['Previous Advance', 'Previous Advance'], ['Other Amount', 'Other Amount']] },
          { name: 'amount', label: 'Amount', type: 'number', required: true, positive: true, max: 100000000, step: '0.01' },
          { name: 'clearedMode', label: 'Status', type: 'select', options: [['pending', 'Not Cleared'], ['cleared', 'Cleared']] },
          { name: 'reason', label: 'Reason', type: 'text', maxlength: 150, wide: true },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { date: todayStr(), type: 'Previous Advance', clearedMode: 'pending' }; },
      validate: function () { return null; },
      customSave: function (v, people) {
        if (!people) return null;
        var now = new Date().toISOString();
        people.forEach(function (p) { db.deductions.push({ id: uid(), createdAt: now, employeeId: p, date: v.date, type: v.type, amount: v.amount, clearedMode: v.clearedMode === 'cleared' ? 'cleared' : 'pending', reason: v.reason, notes: v.notes }); });
        return { msg: 'Deduction added for ' + people.length + ' employee(s).', count: people.length };
      },
      bulkNames: ['date', 'type', 'amount', 'clearedMode', 'reason', 'notes'],
      describe: function (r) { return 'deduction of ' + empName(r.employeeId) + ' on ' + r.date; }
    },
    outsiderSalary: {
      title: 'Outside Worker Salary', coll: 'outsideWorkerSalary', needs: NEED_WORKER,
      fields: function (rec) {
        return [
          personField('workerId', 'Worker', 'worker', workerOptions(rec && rec.workerId), rec),
          { name: 'date', label: 'Paid up to (date)', type: 'date', required: true, hint: 'Salary calculated and settled up to this date' },
          { name: 'given', label: 'Given Salary', type: 'number', required: true, min: 0, max: 100000000, step: '0.01' },
          { name: 'balance', label: 'Balance (pending)', type: 'number', required: true, min: 0, max: 100000000, step: '0.01', hint: 'Amount still pending — enter 0 if nothing is pending' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { date: todayStr() }; },
      validate: function () { return null; },
      customSave: function (v, people) {
        if (!people) return null;
        var now = new Date().toISOString();
        people.forEach(function (p) { db.outsideWorkerSalary.push({ id: uid(), createdAt: now, workerId: p, date: v.date, given: v.given, balance: v.balance, notes: v.notes }); });
        return { msg: 'Salary record added for ' + people.length + ' worker(s).', count: people.length };
      },
      bulkNames: ['date', 'given', 'balance', 'notes'],
      describe: function (r) { return 'salary of ' + workerName(r.workerId) + ' up to ' + r.date; }
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
    if (kind === 'employees') return db.leaves.concat(db.employeeOT, db.advances, db.deductions).filter(function (x) { return set[x.employeeId]; }).length;
    if (kind === 'outsiders') return db.outsideWorkerOT.concat(db.outsideWorkerWork, db.outsideWorkerLeave, db.outsideWorkerSalary).filter(function (x) { return set[x.workerId]; }).length;
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
    var spec = kind === 'employees' ? [['leaves', 'employeeId'], ['employeeOT', 'employeeId'], ['advances', 'employeeId'], ['deductions', 'employeeId']]
      : kind === 'outsiders' ? [['outsideWorkerOT', 'workerId'], ['outsideWorkerWork', 'workerId'], ['outsideWorkerLeave', 'workerId'], ['outsideWorkerSalary', 'workerId']] : [];
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
      if (f.type === 'number' && v === '' && !f.required) { values[f.name] = ''; continue; }
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
      cascade = db.leaves.filter(function (x) { return x.employeeId === id; }).length + db.employeeOT.filter(function (x) { return x.employeeId === id; }).length + db.advances.filter(function (x) { return x.employeeId === id; }).length + db.deductions.filter(function (x) { return x.employeeId === id; }).length;
      msg = 'Delete employee <strong>' + esc(cfg.describe(rec)) + '</strong>?' + (cascade ? ' Their <strong>' + cascade + '</strong> leave, OT, advance and deduction record(s) will also be deleted.' : '') +
        ' This cannot be undone.<br><br><span class="hint">Tip: set the status to Inactive instead to keep their history.</span>';
    } else if (kind === 'outsiders') {
      cascade = db.outsideWorkerOT.filter(function (x) { return x.workerId === id; }).length + db.outsideWorkerWork.filter(function (x) { return x.workerId === id; }).length + db.outsideWorkerLeave.filter(function (x) { return x.workerId === id; }).length + db.outsideWorkerSalary.filter(function (x) { return x.workerId === id; }).length;
      msg = 'Delete outside worker <strong>' + esc(cfg.describe(rec)) + '</strong>?' + (cascade ? ' Their <strong>' + cascade + '</strong> work, leave, OT and salary record(s) will also be deleted.' : '') +
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
    var dated = ['leaves', 'employeeOT', 'advances', 'outsideWorkerWork', 'outsideWorkerLeave', 'outsideWorkerOT', 'outsideWorkerSalary', 'deductions', 'holidays'];
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
      if (key === 'advances' || key === 'deductions') {
        var a = Number(x.amount);
        if (!isFinite(a) || a < 0) { skipped++; return; }
        x.amount = r2(a);
      }
      if (key === 'employees') ['roomRent', 'allowance'].forEach(function (k) { if (x[k] != null && x[k] !== '') { var rv = Number(x[k]); x[k] = isFinite(rv) && rv >= 0 ? r2(rv) : ''; } });
      if (key === 'employees') x.leavingDate = isDate(String(x.leavingDate || '')) ? String(x.leavingDate) : '';
      if (key === 'employees' && x.salary != null && x.salary !== '') { var sv = Number(x.salary); x.salary = isFinite(sv) && sv >= 0 ? r2(sv) : ''; }
      if (key === 'deductions') x.clearedMode = x.clearedMode === 'cleared' ? 'cleared' : 'pending';
      if (key === 'advances') x.clearedMode = x.clearedMode === 'cleared' || x.clearedMode === 'pending' ? x.clearedMode : 'auto';
      if (key === 'deductions') x.type = x.type === 'Other Amount' ? 'Other Amount' : 'Previous Advance';
      if (key === 'outsideWorkerSalary') {
        var gv = Number(x.given), bl = Number(x.balance);
        if (!isFinite(gv) || gv < 0 || !isFinite(bl) || bl < 0) { skipped++; return; }
        x.given = r2(gv); x.balance = r2(bl);
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
        out[k].salaryDate = isDate(String(s.salaryDate || '')) ? String(s.salaryDate) : '';
        out[k].salaryCalc = normCalc(s.salaryCalc);
        out[k].reportEdits = normEdits(s.reportEdits);
        out[k].voucher = normVoucher(s.voucher);
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
    if (v !== 'salary' && v !== 'salReport' && v !== 'vouchers') {
      ui.salUnlocked = false; if (ui.vch) ui.vch.lists.sal = [];
      ['sal-result', 'sal-salaries', 'salReport-body', 'vouchers-body'].forEach(function (id) { var x = document.getElementById(id); if (x) x.innerHTML = ''; });
    }
    ['salary-lock', 'salReport-lock', 'vouchers-lock'].forEach(function (id) { var x = document.getElementById(id); if (x) x.innerHTML = ''; });
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
      case 'save-company': saveCompanyName(); break;
      case 'adv-toggle': toggleAdvance(el.dataset.id); break;
      case 'ded-toggle': toggleDeduction(el.dataset.id); break;
      case 'sal-unlock': salUnlock(); break;
      case 'vch-gen': vchGenerate(); break;
      case 'vch-add': vchAdd(); break;
      case 'vch-del': var VL = vch().lists[vch().type]; vch().lists[vch().type] = VL.filter(function (x) { return x.id !== el.dataset.id; }); renderVouchers(); break;
      case 'vch-print': vchPrint(); break;
      case 'vch-pdf': vchDownload('pdf'); break;
      case 'vch-docx': vchDownload('docx'); break;
      case 'vch-logo-pick': $('#vch-logo-file').click(); break;
      case 'vch-lh-text-reset': var vt = normVoucher(db.appSettings.voucher); vt.lhText = {}; db.appSettings.voucher = normVoucher(vt); save('appSettings'); renderVouchers(); toast('Header text reset.'); break;
      case 'vch-logo-reset': var vs = normVoucher(db.appSettings.voucher); vs.logo = ''; db.appSettings.voucher = vs; save('appSettings'); renderVouchers(); toast('Default logo restored.'); break;
      case 'rep-print': printReport(el.dataset.land === '1'); break;
      case 'att-csv': attCsv(); break;
      case 'sal-csv': salCsv(); break;
      case 'att-reset': repResetMonth('att'); break;
      case 'sal-reset': repResetMonth('sal'); break;
      case 'sal-row-reset': repResetRow(el.dataset.id); break;
      case 'sal-lock': ui.salUnlocked = false; ui.salInit = false; renderCurrent(); break;
      case 'sal-reload': salFetch(); break;
      case 'calc-reset': calcSettingsChanged(el, true); break;
      case 'sal-apply': salApply(); break;
      case 'sal-save-base': salSaveBase(el.dataset.id); break;
      case 'sal-save-all': salSaveAll(); break;
      case 'save-salary-date': saveSalaryDate(el, false); break;
      case 'clear-salary-date': saveSalaryDate(el, true); break;
      case 'save-menu': saveMenuLabels(false); break;
      case 'reset-menu': saveMenuLabels(true); break;
      case 'pick-logo': $('#logo-file').click(); break;
      case 'reset-logo': resetLogo(); break;
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
    if (e.target.name === 'advStatus') { ui.f.advances.status = e.target.value; ui.sel = {}; renderAdvances(); return; }
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
  document.addEventListener('input', function (e) {
    if (e.target.closest && e.target.closest('#sal-form')) { if (e.target.id === 'sal-emp' || e.target.id === 'sal-month') return; ui.salApplied = false; salCalc(); }
  });
  document.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'sal-month') fillSalEmp();
    if (id === 'sal-emp' || id === 'sal-month') salFetch();
    if (e.target.dataset && e.target.dataset.calc) calcSettingsChanged(e.target, false);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'sal-pass') { e.preventDefault(); salUnlock(); } });
  document.addEventListener('change', function (e) {
    if (e.target.name === 'empTab') { ui.f.employees.tab = e.target.value === 'ex' ? 'ex' : 'current'; ui.sel = {}; renderEmployees(); }
  });
  document.addEventListener('input', function (e) {
    var card = e.target.closest && e.target.closest('.v-card');
    if (card && e.target.dataset && e.target.dataset.vf) vchEdit(card, e.target);
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'vchType') { vch().type = t.value === 'sal' ? 'sal' : t.value === 'rent' ? 'rent' : 'adv'; renderVouchers(); $('#vouchers-note').textContent = ''; return; }
    if (t.id === 'vch-month') { var m = vm(t.value); if (m) { vch().month = m; vch().from = m + '-01'; vch().upto = defaultUpto(m); $('#vch-from').value = vch().from; $('#vch-upto').value = vch().upto; } }
    if (t.id === 'vch-upto' && isDate(t.value)) vch().upto = t.value;
    if (t.id === 'vch-pv') { var s = normVoucher(db.appSettings.voucher); s.pvNext = Math.max(1, Math.round(Number(t.value)) || s.pvNext); db.appSettings.voucher = s; save('appSettings'); t.value = s.pvNext; }
    if (t.id === 'vch-logo-file') { vchLogo(t.files[0]); t.value = ''; }
    if (t.dataset && t.dataset.lh) {
      var vs2 = normVoucher(db.appSettings.voucher); vs2.lhText[t.dataset.lh] = t.value; db.appSettings.voucher = normVoucher(vs2); save('appSettings'); renderVouchers();
    }
    if (t.id === 'vch-from' && isDate(t.value)) vch().from = t.value;
  });
  document.addEventListener('focusout', function (e) {
    var td = e.target.closest && e.target.closest('td[data-att]'); if (td) attCellEdit(td);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('td[data-att]')) { e.preventDefault(); e.target.blur(); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target; if (el.dataset && el.dataset.sr) salRepEdit(el);
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id === 'rec-form') { e.preventDefault(); submitForm(e.target); }
    if (e.target.id === 'bulk-form') { e.preventDefault(); applyBulkEdit(e.target); }
  });
  document.addEventListener('keydown', function (e) {
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
    Object.keys(FILTER_DEFAULTS).forEach(syncFilterInputs);
    showView(location.hash.slice(1));
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
  var APP_VERSION = '20261127b';
  function staleCheck() {
    if (typeof document.getElementById !== 'function') return false;
    var meta = document.querySelector('meta[name="app-version"]');
    var need = ['vch-ctrl', 'sal-form', 'attSheet-body', 'salReport-body', 'deductions-table', 'outsiderSalary-table', 'salary-box-adv', 'menulabels-grid', 'activity-body', 'leave-out-pane', 'outsiderLeave-table'];
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
    startApp();
  }
  init();
})();
