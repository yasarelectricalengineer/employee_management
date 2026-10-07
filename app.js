/* Ameer Fire and Safety — Employee, Leave, OT & Advance Management
   Frontend-only. All data is stored in this browser's localStorage. */
(function () {
  'use strict';

  /* ================= Constants ================= */
  var COMPANY = 'Ameer Fire and Safety';
  var DRIVE_URL = 'https://drive.google.com/drive/folders/12FOBPx6i20ETWm7WgNl1muJILucahRjl?usp=drive_link';
  var DATA_KEYS = ['employees', 'leaves', 'employeeOT', 'advances', 'outsideWorkers', 'outsideWorkerOT'];
  var ALL_KEYS = DATA_KEYS.concat(['appSettings']);
  var OT_TYPES = { normal: 'Normal Hour OT', sunday: 'Sunday / Special OT', night: 'Night OT' };
  var DEFAULT_SETTINGS = { currency: 'AED', lastBackup: null };
  var MAX_HOURS = 24;
  var LEAVE_BUILTIN = [['Full Day', 'Full Day (1 day)'], ['Half Day', 'Half Day (0.5 day)']];
  var EMP_OT_BUILTIN = [['normal', 'Normal Hour OT'], ['sunday', 'Sunday / Special OT'], ['night', 'Night OT']];
  var WORKER_OT_BUILTIN = [['normal', 'Normal OT'], ['sunday', 'Sunday / Special OT'], ['night', 'Night OT']];
  var SOURCE_BUILTIN = [['From Company', 'From Company'], ['Others', 'Others']];
  function emptyOptions() { return { leaveTypes: [], otTypes: [], workerOtTypes: [], sources: [] }; }
  function defaultSettings() { var s = Object.assign({}, DEFAULT_SETTINGS); s.options = emptyOptions(); return s; }
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
    return r;
  }
  var VIEWS = ['dashboard', 'employees', 'leaves', 'ot', 'advances', 'outsiders', 'outsiderOT', 'reports', 'backup'];
  var TITLES = {
    dashboard: 'Dashboard', employees: 'Employees', leaves: 'Leave Management', ot: 'Employee OT',
    advances: 'Advances', outsiders: 'Outside Workers', outsiderOT: 'Outside Worker OT',
    reports: 'Monthly Reports', backup: 'Backup & Google Drive'
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
  function leaveDays(l) {
    if (l.type === 'Half Day') return 0.5;
    if (l.type === 'Full Day') return 1;
    var c = ((db.appSettings && db.appSettings.options && db.appSettings.options.leaveTypes) || []).find(function (x) { return x.name === l.type; });
    return c ? (Number(c.days) || 1) : 1;
  }
  function sumOT(list) {
    var r = { normal: 0, sunday: 0, night: 0, other: 0, total: 0 };
    list.forEach(function (o) { r[OT_TYPES[o.type] ? o.type : 'other'] += Number(o.hours) || 0; });
    r.normal = r2(r.normal); r.sunday = r2(r.sunday); r.night = r2(r.night); r.other = r2(r.other);
    r.total = r2(r.normal + r.sunday + r.night + r.other);
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
        return st;
      }
      return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object'; }) : [];
    } catch (e) { return defaultFor(k); }
  }
  function loadAll() { ALL_KEYS.forEach(function (k) { db[k] = loadKey(k); }); }
  function save(k) {
    try { localStorage.setItem(k, JSON.stringify(db[k])); return true; }
    catch (e) { toast('Could not save — browser storage is full or blocked.', 'error'); return false; }
  }
  function storageWorks() {
    try { localStorage.setItem('__ameer_test', '1'); localStorage.removeItem('__ameer_test'); return true; }
    catch (e) { return false; }
  }

  /* ================= UI state ================= */
  var ui = { view: 'dashboard', f: {} };
  var FILTER_DEFAULTS = {
    dashboard: function () { return { month: monthNow() }; },
    employees: function () { return { q: '', status: '', dept: '' }; },
    leaves: function () { return { month: '', emp: '', type: '', q: '' }; },
    ot: function () { return { month: '', emp: '', type: '', q: '' }; },
    advances: function () { return { month: '', emp: '', q: '' }; },
    outsiders: function () { return { q: '', source: '', status: '' }; },
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
  function tbl(headers, rows, foot) {
    var th = headers.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('');
    var body = rows.map(function (r) {
      return '<tr>' + r.map(function (c, i) { return '<td data-label="' + esc(headers[i]) + '">' + c + '</td>'; }).join('') + '</tr>';
    }).join('');
    var ft = foot ? '<tfoot><tr>' + foot.map(function (c, i) { return '<td data-label="' + esc(headers[i]) + '">' + c + '</td>'; }).join('') + '</tr></tfoot>' : '';
    return '<div class="table-wrap"><table class="rt"><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody>' + ft + '</table></div>';
  }
  function cardOf(title, chip, inner) {
    return '<div class="card"><div class="card-head"><h3>' + esc(title) + '</h3>' + (chip ? '<span class="chip">' + esc(chip) + '</span>' : '') + '</div>' + inner + '</div>';
  }
  function emptyState(title, text, btnLabel, kind) {
    return '<div class="empty"><div class="ico-big">' + svg('flame') + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
      (btnLabel ? '<button class="btn btn-primary" data-action="add" data-kind="' + kind + '">' + esc(btnLabel) + '</button>' : '') + '</div>';
  }
  function noMatch(view) {
    return '<div class="empty small"><p>No records match your filters.</p><button class="btn btn-sm" data-action="clear-filters" data-view="' + view + '">Clear Filters</button></div>';
  }
  function actions(kind, id) {
    return '<div class="row-actions"><button class="btn btn-sm" data-action="edit" data-kind="' + kind + '" data-id="' + esc(id) + '">Edit</button>' +
      '<button class="btn btn-sm btn-danger-o" data-action="delete" data-kind="' + kind + '" data-id="' + esc(id) + '">Delete</button></div>';
  }
  function statusBadge(s) { return '<span class="badge ' + (s === 'Active' ? 'b-active' : 'b-inactive') + '">' + esc(s || '—') + '</span>'; }
  function otLabel(t) {
    if (OT_TYPES[t]) return OT_TYPES[t];
    var o = db.appSettings.options, hit = o.otTypes.concat(o.workerOtTypes).find(function (x) { return x.id === t; });
    return hit ? hit.name : 'Other';
  }
  function otBadge(t) { return '<span class="badge b-' + (OT_TYPES[t] ? esc(t) : 'other') + '">' + esc(otLabel(t)) + '</span>'; }
  function leaveBadge(t) { return '<span class="badge ' + (leaveDays({ type: t }) < 1 ? 'b-half' : 'b-full') + '">' + esc(t) + '</span>'; }
  function otherOn(list, t) { return ((db.appSettings.options[list] || []).length > 0) || !!(t && t.other > 0); }
  function getOpts(list) {
    var o = (db.appSettings && db.appSettings.options) || emptyOptions();
    if (list === 'leaveTypes') return LEAVE_BUILTIN.concat((o.leaveTypes || []).map(function (x) { return [x.name, x.name + ' (' + fmtNum(x.days) + ' day)']; }));
    if (list === 'otTypes') return EMP_OT_BUILTIN.concat((o.otTypes || []).map(function (x) { return [x.id, x.name]; }));
    if (list === 'workerOtTypes') return WORKER_OT_BUILTIN.concat((o.workerOtTypes || []).map(function (x) { return [x.id, x.name]; }));
    if (list === 'sources') return SOURCE_BUILTIN.concat((o.sources || []).map(function (n) { return [n, n]; }));
    return [];
  }
  function stat(label, value, sub, cls) {
    return '<div class="stat ' + (cls || '') + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
  }
  function dash(v) { return v ? esc(v) : '<span class="muted">—</span>'; }

  /* ================= Views ================= */
  function renderDashboard() {
    var m = vm(ui.f.dashboard.month);
    var leaves = db.leaves.filter(function (l) { return inMonth(l, m); });
    var ot = sumOT(db.employeeOT.filter(function (o) { return inMonth(o, m); }));
    var oot = sumOT(db.outsideWorkerOT.filter(function (o) { return inMonth(o, m); }));
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
      stat('Normal OT Hours', fmtNum(ot.normal), 'Employees', 'y') +
      stat('Sunday / Special OT Hours', fmtNum(ot.sunday), 'Employees', 'y') +
      stat('Night OT Hours', fmtNum(ot.night), 'Employees', 'y') +
      (otherOn('otTypes', ot) ? stat('Other OT Hours', fmtNum(ot.other), 'Custom OT types', 'y') : '') +
      stat('Total OT Hours', fmtNum(ot.total), otherOn('otTypes', ot) ? 'Normal + Sunday/Special + Night + Other' : 'Normal + Sunday/Special + Night') +
      stat('Total Advance', money(adv), m ? 'Given in ' + esc(monthLabel(m)) : 'All time', 'd') +
      '</div>';
    html += cardOf('Outside Worker OT', periodLabel(m),
      '<div class="card-body"><div class="stats small" style="margin:0">' +
      stat('Normal OT', fmtNum(oot.normal), '', 'y') + stat('Sunday / Special OT', fmtNum(oot.sunday), '', 'y') +
      stat('Night OT', fmtNum(oot.night), '', 'y') + (otherOn('workerOtTypes', oot) ? stat('Other OT', fmtNum(oot.other), '', 'y') : '') +
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
    var f = ui.f.leaves, m = vm(f.month);
    var box = $('#leaves-table'), sum = $('#leaves-summary');
    if (!db.leaves.length) { sum.innerHTML = ''; box.innerHTML = emptyState('No leave recorded', 'Add a leave entry to start monthly leave calculation.', '+ Add Leave', 'leaves'); return; }
    var rows = db.leaves.filter(function (l) {
      return inMonth(l, m) && (!f.emp || l.employeeId === f.emp) && (!f.type || l.type === f.type) &&
        matchQ(f.q, empName(l.employeeId), empCode(l.employeeId), l.reason, l.notes);
    }).sort(byDateDesc);
    if (!rows.length) { sum.innerHTML = ''; box.innerHTML = noMatch('leaves'); return; }
    var g = group(rows, function (l) { return l.employeeId; });
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
        return [fmtDate(l.date), empCell(l.employeeId), leaveBadge(l.type), fmtNum(leaveDays(l)),
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
    var t = sumOT(rows), oc = otherOn('otTypes', t);
    sum.innerHTML = cardOf('Employee-wise OT Summary', periodLabel(m), tbl(
      ['Employee', 'Normal OT', 'Sunday/Special OT', 'Night OT'].concat(oc ? ['Other OT'] : [], ['Total OT']),
      srows.map(function (x) { return [empCell(x.id), fmtNum(x.s.normal), fmtNum(x.s.sunday), fmtNum(x.s.night)].concat(oc ? [fmtNum(x.s.other)] : [], ['<strong>' + fmtNum(x.s.total) + '</strong>']); }),
      ['Total', fmtNum(t.normal), fmtNum(t.sunday), fmtNum(t.night)].concat(oc ? [fmtNum(t.other)] : [], [fmtNum(t.total)])));
    box.innerHTML = cardOf('OT Records', rows.length + ' record(s)', tbl(
      ['Date', 'Employee', 'OT Type', 'Hours', 'Notes', 'Actions'],
      rows.map(function (o) {
        return [fmtDate(o.date), empCell(o.employeeId), otBadge(o.type), '<strong>' + fmtNum(o.hours) + '</strong>', '<span class="wrap">' + dash(o.notes) + '</span>', actions('ot', o.id)];
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
    var t = sumOT(rows), oc = otherOn('workerOtTypes', t);
    sum.innerHTML = cardOf('Worker-wise OT Summary', periodLabel(m), tbl(
      ['Worker', 'Normal OT', 'Sunday/Special OT', 'Night OT'].concat(oc ? ['Other OT'] : [], ['Total OT']),
      srows.map(function (x) { return [workerCell(x.id), fmtNum(x.s.normal), fmtNum(x.s.sunday), fmtNum(x.s.night)].concat(oc ? [fmtNum(x.s.other)] : [], ['<strong>' + fmtNum(x.s.total) + '</strong>']); }),
      ['Total', fmtNum(t.normal), fmtNum(t.sunday), fmtNum(t.night)].concat(oc ? [fmtNum(t.other)] : [], [fmtNum(t.total)])));
    box.innerHTML = cardOf('Outside Worker OT Records', rows.length + ' record(s)', tbl(
      ['Date', 'Worker', 'Source', 'OT Type', 'Hours', 'Notes', 'Actions'],
      rows.map(function (o) {
        var w = workerById(o.workerId);
        return [fmtDate(o.date), workerCell(o.workerId), w ? esc(w.source) : '—', otBadge(o.type), '<strong>' + fmtNum(o.hours) + '</strong>', '<span class="wrap">' + dash(o.notes) + '</span>', actions('outsiderOT', o.id)];
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
      return { w: w, ot: ot, has: ot.total > 0 };
    }).filter(function (r) { return r.w.status === 'Active' || r.has || ui.f.reports.worker; }).sort(function (a, b) { return byName(a.w, b.w); });
  }
  function empTotals(rows) {
    var t = { leave: 0, normal: 0, sunday: 0, night: 0, other: 0, total: 0, adv: 0 };
    rows.forEach(function (r) { t.leave += r.leave; t.normal += r.ot.normal; t.sunday += r.ot.sunday; t.night += r.ot.night; t.other += r.ot.other; t.total += r.ot.total; t.adv += r.adv; });
    Object.keys(t).forEach(function (k) { t[k] = r2(t[k]); });
    return t;
  }
  function workerTotals(rows) {
    var t = { normal: 0, sunday: 0, night: 0, other: 0, total: 0 };
    rows.forEach(function (r) { t.normal += r.ot.normal; t.sunday += r.ot.sunday; t.night += r.ot.night; t.other += r.ot.other; t.total += r.ot.total; });
    Object.keys(t).forEach(function (k) { t[k] = r2(t[k]); });
    return t;
  }

  function renderReports() {
    var f = ui.f.reports, m = vm(f.month), body = $('#reports-body');
    if (!db.employees.length && !db.outsideWorkers.length) {
      body.innerHTML = emptyState('Nothing to report yet', 'Add employees or outside workers and their records to see monthly reports.', '+ Add Employee', 'employees');
      return;
    }
    var er = buildEmpReport(f), wr = buildWorkerReport(f);
    var et = empTotals(er), wt = workerTotals(wr);
    var eo = otherOn('otTypes', et), wo = otherOn('workerOtTypes', wt);
    var html = '<div class="print-head"><h2>' + esc(COMPANY) + '</h2><p>Monthly Report — <strong>' + esc(periodLabel(m)) + '</strong> · Generated ' + esc(fmtDate(todayStr())) + '</p></div>';
    html += '<div class="stats">' +
      stat('Leave Days', fmtNum(et.leave), 'Employees') + stat('Normal OT', fmtNum(et.normal), 'hours', 'y') +
      stat('Sunday / Special OT', fmtNum(et.sunday), 'hours', 'y') + stat('Night OT', fmtNum(et.night), 'hours', 'y') +
      (eo ? stat('Other OT', fmtNum(et.other), 'hours', 'y') : '') +
      stat('Total OT', fmtNum(et.total), 'hours') + stat('Total Advance', money(et.adv), '', 'd') + '</div>';

    if (db.employees.length) {
      html += er.length ? cardOf('Employee Report', periodLabel(m), tbl(
        ['Employee', 'Leave Days', 'Normal OT', 'Sunday/Special OT', 'Night OT'].concat(eo ? ['Other OT'] : [], ['Total OT', 'Advance']),
        er.map(function (r) { return [empCell(r.e.id), fmtNum(r.leave), fmtNum(r.ot.normal), fmtNum(r.ot.sunday), fmtNum(r.ot.night)].concat(eo ? [fmtNum(r.ot.other)] : [], ['<strong>' + fmtNum(r.ot.total) + '</strong>', money(r.adv)]); }),
        ['Total', fmtNum(et.leave), fmtNum(et.normal), fmtNum(et.sunday), fmtNum(et.night)].concat(eo ? [fmtNum(et.other)] : [], [fmtNum(et.total), money(et.adv)])))
        : cardOf('Employee Report', periodLabel(m), '<div class="card-body">' + noMatch('reports') + '</div>');
    }
    if (db.outsideWorkers.length) {
      html += wr.length ? cardOf('Outside Worker Report', periodLabel(m), tbl(
        ['Worker', 'Source', 'Normal OT', 'Sunday/Special OT', 'Night OT'].concat(wo ? ['Other OT'] : [], ['Total OT']),
        wr.map(function (r) { return [workerCell(r.w.id), esc(r.w.source), fmtNum(r.ot.normal), fmtNum(r.ot.sunday), fmtNum(r.ot.night)].concat(wo ? [fmtNum(r.ot.other)] : [], ['<strong>' + fmtNum(r.ot.total) + '</strong>']); }),
        ['Total', '', fmtNum(wt.normal), fmtNum(wt.sunday), fmtNum(wt.night)].concat(wo ? [fmtNum(wt.other)] : [], [fmtNum(wt.total)])))
        : cardOf('Outside Worker Report', periodLabel(m), '<div class="card-body">' + noMatch('reports') + '</div>');
    }
    // Detail when a single employee / worker is selected
    var sel = f.emp && empById(f.emp);
    if (sel) {
      var L = db.leaves.filter(function (l) { return l.employeeId === sel.id && inMonth(l, m); }).sort(byDateDesc);
      var O = db.employeeOT.filter(function (o) { return o.employeeId === sel.id && inMonth(o, m); }).sort(byDateDesc);
      var A = db.advances.filter(function (a) { return a.employeeId === sel.id && inMonth(a, m); }).sort(byDateDesc);
      html += cardOf('Employee Detail — ' + sel.name + ' (' + sel.empId + ')', periodLabel(m),
        '<div class="card-body"><h4>Leave</h4>' + (L.length ? tbl(['Date', 'Type', 'Days', 'Reason'], L.map(function (l) { return [fmtDate(l.date), leaveBadge(l.type), fmtNum(leaveDays(l)), dash(l.reason)]; })) : '<p class="hint">No leave.</p>') +
        '<h4 style="margin-top:14px">Overtime</h4>' + (O.length ? tbl(['Date', 'OT Type', 'Hours', 'Notes'], O.map(function (o) { return [fmtDate(o.date), otBadge(o.type), fmtNum(o.hours), dash(o.notes)]; })) : '<p class="hint">No overtime.</p>') +
        '<h4 style="margin-top:14px">Advances</h4>' + (A.length ? tbl(['Date', 'Amount', 'Reason'], A.map(function (a) { return [fmtDate(a.date), money(a.amount), dash(a.reason)]; })) : '<p class="hint">No advances.</p>') + '</div>');
    }
    var selW = f.worker && workerById(f.worker);
    if (selW) {
      var WO = db.outsideWorkerOT.filter(function (o) { return o.workerId === selW.id && inMonth(o, m); }).sort(byDateDesc);
      html += cardOf('Worker Detail — ' + selW.name + ' (' + selW.workerId + ')', periodLabel(m),
        '<div class="card-body">' + (WO.length ? tbl(['Date', 'OT Type', 'Hours', 'Notes'], WO.map(function (o) { return [fmtDate(o.date), otBadge(o.type), fmtNum(o.hours), dash(o.notes)]; })) : '<p class="hint">No overtime.</p>') + '</div>');
    }
    body.innerHTML = html;
  }

  /* ----- Backup view ----- */
  function renderBackup() {
    var labels = { employees: 'Employees', leaves: 'Leave records', employeeOT: 'Employee OT', advances: 'Advances', outsideWorkers: 'Outside workers', outsideWorkerOT: 'Outside worker OT' };
    var html = '<div class="count-grid">' + DATA_KEYS.map(function (k) {
      return '<div class="count"><strong>' + db[k].length + '</strong><span>' + labels[k] + '</span></div>';
    }).join('') + '</div>';
    var lb = db.appSettings.lastBackup;
    html += '<p class="hint">Last backup downloaded from this browser: <strong>' + (lb ? esc(new Date(lb).toLocaleString()) : 'never') + '</strong></p>';
    $('#backup-summary').innerHTML = html;
    var ci = $('#currency-input');
    if (ci && document.activeElement !== ci) ci.value = db.appSettings.currency || '';
  }

  var RENDER = {
    dashboard: renderDashboard, employees: renderEmployees, leaves: renderLeaves, ot: renderOT, advances: renderAdvances,
    outsiders: renderOutsiders, outsiderOT: renderOutsiderOT, reports: renderReports, backup: renderBackup
  };
  function renderView(v) { if (RENDER[v]) RENDER[v](); }
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
      describe: function (r) { return r.name + ' (' + r.empId + ')'; }
    },
    leaves: {
      title: 'Leave', coll: 'leaves', needs: NEED_EMP,
      fields: function (rec) {
        return [
          { name: 'employeeId', label: 'Employee', type: 'select', required: true, placeholder: 'Select employee', options: empOptions(rec && rec.employeeId), wide: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'type', label: 'Leave Type', type: 'select', required: true, options: getOpts('leaveTypes'), addable: 'leaveTypes', addHint: 'New leave type, e.g. Sick Leave' },
          { name: 'reason', label: 'Reason', type: 'text', maxlength: 150, wide: true, fallback: '-', hint: 'Optional — saved as "-" if left empty' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { date: todayStr(), type: 'Full Day' }; },
      validate: function (v, rec) {
        var dup = db.leaves.find(function (l) { return l.employeeId === v.employeeId && l.date === v.date && (!rec || l.id !== rec.id); });
        if (dup) return { msg: 'This employee already has a leave entry on that date. Edit the existing entry instead.', field: 'date' };
        return null;
      },
      describe: function (r) { return 'leave of ' + empName(r.employeeId) + ' on ' + r.date; }
    },
    ot: {
      title: 'OT Entry', coll: 'employeeOT', needs: NEED_EMP,
      fields: function (rec) {
        return [
          { name: 'employeeId', label: 'Employee', type: 'select', required: true, placeholder: 'Select employee', options: empOptions(rec && rec.employeeId), wide: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'type', label: 'OT Type', type: 'select', required: true, options: getOpts('otTypes'), addable: 'otTypes', addHint: 'New OT type, e.g. Holiday OT' },
          { name: 'hours', label: 'Hours', type: 'number', required: true, positive: true, max: MAX_HOURS, step: '0.01', hint: 'e.g. 1.5, 2.5, 3.75' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { date: todayStr(), type: 'normal' }; },
      validate: function () { return null; },
      describe: function (r) { return otLabel(r.type) + ' of ' + empName(r.employeeId) + ' on ' + r.date; }
    },
    advances: {
      title: 'Advance', coll: 'advances', needs: NEED_EMP,
      fields: function (rec) {
        return [
          { name: 'employeeId', label: 'Employee', type: 'select', required: true, placeholder: 'Select employee', options: empOptions(rec && rec.employeeId), wide: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'amount', label: 'Amount', type: 'number', required: true, positive: true, max: 100000000, step: '0.01' },
          { name: 'reason', label: 'Reason', type: 'text', maxlength: 150, wide: true },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { date: todayStr() }; },
      validate: function () { return null; },
      describe: function (r) { return 'advance of ' + empName(r.employeeId) + ' on ' + r.date; }
    },
    outsiders: {
      title: 'Outside Worker', coll: 'outsideWorkers',
      fields: function () {
        return [
          { name: 'workerId', label: 'Worker ID', type: 'text', required: true, maxlength: 30 },
          { name: 'name', label: 'Worker Name', type: 'text', required: true, maxlength: 100 },
          { name: 'phone', label: 'Phone', type: 'tel', maxlength: 25 },
          { name: 'source', label: 'Source', type: 'select', required: true, options: getOpts('sources'), addable: 'sources', addHint: 'New source, e.g. Contractor' },
          { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTS }
        ];
      },
      defaults: function () { return { source: 'From Company', status: 'Active' }; },
      validate: function (v, rec) {
        var dup = db.outsideWorkers.find(function (w) { return w.workerId.toLowerCase() === v.workerId.toLowerCase() && (!rec || w.id !== rec.id); });
        if (dup) return { msg: 'Worker ID "' + v.workerId + '" is already used by ' + dup.name + '.', field: 'workerId' };
        if (v.phone && !/^[0-9+()\-\s]{6,25}$/.test(v.phone)) return { msg: 'Enter a valid phone number.', field: 'phone' };
        return null;
      },
      describe: function (r) { return r.name + ' (' + r.workerId + ')'; }
    },
    outsiderOT: {
      title: 'Outside Worker OT', coll: 'outsideWorkerOT', needs: NEED_WORKER,
      fields: function (rec) {
        return [
          { name: 'workerId', label: 'Worker', type: 'select', required: true, placeholder: 'Select worker', options: workerOptions(rec && rec.workerId), wide: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'type', label: 'OT Type', type: 'select', required: true, options: getOpts('workerOtTypes'), addable: 'workerOtTypes', addHint: 'New OT type, e.g. Holiday OT' },
          { name: 'hours', label: 'Hours', type: 'number', required: true, positive: true, max: MAX_HOURS, step: '0.01', hint: 'e.g. 1.5, 2.5, 3.75' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true }
        ];
      },
      defaults: function () { return { date: todayStr(), type: 'normal' }; },
      validate: function () { return null; },
      describe: function (r) { return otLabel(r.type) + ' of ' + workerName(r.workerId) + ' on ' + r.date; }
    }
  };

  function fieldHtml(f, val) {
    var v = val == null ? '' : val, input;
    if (f.type === 'select') {
      input = '<select name="' + f.name + '">' + (f.placeholder ? '<option value="">' + esc(f.placeholder) + '</option>' : '') +
        f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + (f.addable ? addControls(f) : '');
    } else if (f.type === 'textarea') {
      input = '<textarea name="' + f.name + '" rows="3" maxlength="500">' + esc(v) + '</textarea>';
    } else if (f.type === 'number') {
      input = '<input name="' + f.name + '" type="number" inputmode="decimal" min="0" step="' + (f.step || 'any') + '" value="' + esc(v) + '" placeholder="' + (f.hint ? esc(f.hint) : '0') + '">';
    } else {
      input = '<input name="' + f.name + '" type="' + f.type + '" value="' + esc(v) + '"' +
        (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + (f.hint ? ' placeholder="' + esc(f.hint) + '"' : '') + (f.list ? ' list="dl-' + f.name + '"' : '') + ' autocomplete="off">' +
        (f.list ? '<datalist id="dl-' + f.name + '">' + f.list.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' : '');
    }
    return '<label class="fld' + (f.wide ? ' wide' : '') + '"><span>' + esc(f.label) + (f.required ? ' <b>*</b>' : '') + '</span>' + input + '</label>';
  }

  function optionsHtml(opts, sel) {
    return opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(sel) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }
  function addControls(f) {
    return '<button type="button" class="link-btn" data-action="toggle-add">+ Add new</button>' +
      '<div class="addrow hidden" data-list="' + f.addable + '" data-select="' + f.name + '">' +
      '<input type="text" class="add-name" maxlength="40" placeholder="' + esc(f.addHint || 'New option') + '" autocomplete="off">' +
      (f.addable === 'leaveTypes' ? '<select class="add-days" aria-label="Days counted"><option value="1">Counts as 1 day</option><option value="0.5">Counts as 0.5 day</option></select>' : '') +
      '<button type="button" class="btn btn-sm btn-accent" data-action="save-option">Add</button></div>';
  }
  function allNames(list) {
    var o = db.appSettings.options;
    if (list === 'leaveTypes') return ['Full Day', 'Half Day'].concat(o.leaveTypes.map(function (x) { return x.name; }));
    if (list === 'sources') return SOURCE_BUILTIN.map(function (x) { return x[1]; }).concat(o.sources);
    var base = list === 'otTypes' ? EMP_OT_BUILTIN : WORKER_OT_BUILTIN;
    return base.map(function (x) { return x[1]; }).concat(o[list].map(function (x) { return x.name; }));
  }
  function toggleAdd(btn) {
    var row = btn.parentNode.querySelector('.addrow');
    if (!row) return;
    row.classList.toggle('hidden');
    if (!row.classList.contains('hidden')) row.querySelector('.add-name').focus();
  }
  function saveOption(el) {
    var row = el.closest('.addrow'); if (!row) return;
    var list = row.dataset.list, form = el.closest('form'), inp = row.querySelector('.add-name');
    var name = inp.value.trim().replace(/\s+/g, ' ');
    if (!name) { inp.classList.add('invalid'); inp.focus(); toast('Enter a name first.', 'error'); return; }
    if (allNames(list).some(function (n) { return n.toLowerCase() === name.toLowerCase(); })) {
      inp.classList.add('invalid'); inp.focus(); toast('"' + name + '" already exists.', 'error'); return;
    }
    inp.classList.remove('invalid');
    var o = db.appSettings.options, val;
    if (list === 'leaveTypes') { o.leaveTypes.push({ name: name, days: Number(row.querySelector('.add-days').value) || 1 }); val = name; }
    else if (list === 'sources') { o.sources.push(name); val = name; }
    else { val = 'x' + uid(); o[list].push({ id: val, name: name }); }
    save('appSettings');
    var sel = form.elements[row.dataset.select];
    sel.innerHTML = optionsHtml(getOpts(list), val);
    sel.value = val;
    inp.value = ''; row.classList.add('hidden');
    populateSelects();
    toast('"' + name + '" added and selected.');
  }

  function openForm(kind, id) {
    var cfg = FORMS[kind]; if (!cfg) return;
    var rec = id ? db[cfg.coll].find(function (r) { return r.id === id; }) : null;
    if (id && !rec) { toast('That record no longer exists.', 'error'); return; }
    if (!rec && cfg.needs) {
      var p = cfg.needs();
      if (p) { toast(p.msg, 'error'); location.hash = '#' + p.view; return; }
    }
    var vals = rec || (cfg.defaults ? cfg.defaults() : {});
    var fields = cfg.fields(rec);
    openModal(
      '<form id="rec-form" novalidate data-kind="' + kind + '" data-id="' + esc(id || '') + '">' +
      '<div class="modal-head"><h3>' + (rec ? 'Edit ' : 'Add ') + esc(cfg.title) + '</h3><button type="button" class="icon-x" data-action="close-modal" aria-label="Close">&times;</button></div>' +
      '<div class="modal-body"><div class="form-grid">' + fields.map(function (f) { return fieldHtml(f, vals[f.name]); }).join('') + '</div>' +
      '<p class="hint"><b style="color:var(--red)">*</b> Required</p></div>' +
      '<div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">' + (rec ? 'Save Changes' : 'Save') + '</button></div></form>',
      { label: (rec ? 'Edit ' : 'Add ') + cfg.title }
    );
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
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i], el = form.elements[f.name], v = el ? String(el.value).trim() : '';
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
    var now = new Date().toISOString();
    if (rec) Object.assign(rec, values, { updatedAt: now });
    else db[cfg.coll].push(Object.assign({ id: uid(), createdAt: now }, values));
    save(cfg.coll);
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
      cascade = db.outsideWorkerOT.filter(function (x) { return x.workerId === id; }).length;
      msg = 'Delete outside worker <strong>' + esc(cfg.describe(rec)) + '</strong>?' + (cascade ? ' Their <strong>' + cascade + '</strong> OT record(s) will also be deleted.' : '') +
        ' This cannot be undone.<br><br><span class="hint">Tip: set the status to Inactive instead to keep their history.</span>';
    }
    var ok = await confirmBox({ title: 'Confirm delete', message: msg, okText: 'Delete', danger: true });
    if (!ok) return;
    db[cfg.coll] = db[cfg.coll].filter(function (r) { return r.id !== id; });
    save(cfg.coll);
    if (kind === 'employees') {
      db.leaves = db.leaves.filter(function (x) { return x.employeeId !== id; });
      db.employeeOT = db.employeeOT.filter(function (x) { return x.employeeId !== id; });
      db.advances = db.advances.filter(function (x) { return x.employeeId !== id; });
      save('leaves'); save('employeeOT'); save('advances');
    } else if (kind === 'outsiders') {
      db.outsideWorkerOT = db.outsideWorkerOT.filter(function (x) { return x.workerId !== id; });
      save('outsideWorkerOT');
    }
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
    return { app: 'ameer-fire-safety', version: 1, exportedAt: new Date().toISOString(), data: data };
  }
  function exportJSON() {
    db.appSettings.lastBackup = new Date().toISOString();
    save('appSettings');
    var name = 'ameer-fire-safety-backup-' + todayStr() + '.json';
    download(name, JSON.stringify(buildBackup(), null, 2), 'application/json');
    if (ui.view === 'backup') renderBackup();
    return name;
  }
  function exportToDrive() {
    var name = exportJSON();
    var w = window.open(DRIVE_URL, '_blank');
    if (w) { try { w.opener = null; } catch (e) { /* ignore */ } }
    toast(w ? 'Backup downloaded (' + name + '). Upload it to the Drive folder that just opened.'
      : 'Backup downloaded (' + name + '). The Drive tab was blocked — use the "Open Drive folder" button.', w ? 'success' : 'info');
  }
  function importFromDrive() {
    var w = window.open(DRIVE_URL, '_blank');
    if (w) { try { w.opener = null; } catch (e) { /* ignore */ } }
    var steps = $('#drive-steps');
    steps.classList.remove('pulse'); void steps.offsetWidth; steps.classList.add('pulse');
    steps.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Download your backup JSON from Drive, then use "Select downloaded JSON file".', 'info');
  }

  function cleanList(key, list) {
    var out = [], skipped = 0;
    var dated = ['leaves', 'employeeOT', 'advances', 'outsideWorkerOT'];
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
      if (key === 'advances') {
        var a = Number(x.amount);
        if (!isFinite(a) || a < 0) { skipped++; return; }
        x.amount = r2(a);
      }
      if (key === 'leaves') x.type = x.type === 'Half Day' ? 'Half Day' : 'Full Day';
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
      } else {
        if (!Array.isArray(data[k])) throw new Error('"' + k + '" in this file is not a list — the backup looks damaged.');
        var c = cleanList(k, data[k]); out[k] = c.out; skipped += c.skipped;
      }
    });
    if (!found) throw new Error('No Ameer Fire and Safety data was found in this file.');
    return { data: out, skipped: skipped };
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
        ALL_KEYS.forEach(function (k) { db[k] = d[k]; save(k); });
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
    ALL_KEYS.forEach(function (k) { db[k] = defaultFor(k); save(k); });
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
    var f = ui.f.reports, m = vm(f.month), lines, name;
    if (kind === 'emp') {
      var rows = buildEmpReport(f);
      if (!rows.length) { toast('No employee data to export.', 'error'); return; }
      var t = empTotals(rows);
      var eo = otherOn('otTypes', t);
      lines = [[COMPANY], ['Employee Monthly Report'], ['Month', periodLabel(m)], ['Generated', todayStr()], [],
        ['Employee ID', 'Employee', 'Leave Days', 'Normal OT', 'Sunday/Special OT', 'Night OT'].concat(eo ? ['Other OT'] : [], ['Total OT', 'Advance'])]
        .concat(rows.map(function (r) { return [r.e.empId, r.e.name, r.leave, r.ot.normal, r.ot.sunday, r.ot.night].concat(eo ? [r.ot.other] : [], [r.ot.total, r.adv]); }))
        .concat([['TOTAL', '', t.leave, t.normal, t.sunday, t.night].concat(eo ? [t.other] : [], [t.total, t.adv])]);
      name = 'ameer-fire-safety-employee-report-' + (m || 'all-months') + '.csv';
    } else {
      var wrows = buildWorkerReport(f);
      if (!wrows.length) { toast('No outside worker data to export.', 'error'); return; }
      var wt = workerTotals(wrows);
      var wo = otherOn('workerOtTypes', wt);
      lines = [[COMPANY], ['Outside Worker Monthly Report'], ['Month', periodLabel(m)], ['Generated', todayStr()], [],
        ['Worker ID', 'Worker', 'Source', 'Normal OT', 'Sunday/Special OT', 'Night OT'].concat(wo ? ['Other OT'] : [], ['Total OT'])]
        .concat(wrows.map(function (r) { return [r.w.workerId, r.w.name, r.w.source, r.ot.normal, r.ot.sunday, r.ot.night].concat(wo ? [r.ot.other] : [], [r.ot.total]); }))
        .concat([['TOTAL', '', '', wt.normal, wt.sunday, wt.night].concat(wo ? [wt.other] : [], [wt.total])]);
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
      case 'delete': deleteRecord(el.dataset.kind, el.dataset.id); break;
      case 'clear-filters': clearFilters(el.dataset.view); break;
      case 'all-months': ui.f[el.dataset.view].month = ''; syncFilterInputs(el.dataset.view); renderView(el.dataset.view); break;
      case 'toggle-menu': toggleMenu(); break;
      case 'close-modal': closeModal(); break;
      case 'toggle-add': toggleAdd(el); break;
      case 'save-option': saveOption(el); break;
      case 'export-json': toast('Backup downloaded: ' + exportJSON()); break;
      case 'import-json': $('#import-file').click(); break;
      case 'export-drive': exportToDrive(); break;
      case 'import-drive': importFromDrive(); break;
      case 'print-report': window.print(); break;
      case 'csv-emp': exportCsv('emp'); break;
      case 'csv-out': exportCsv('out'); break;
      case 'clear-all': clearAll(); break;
    }
  });
  document.addEventListener('input', onFilterInput);
  document.addEventListener('change', function (e) {
    onFilterInput(e);
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
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('add-name')) { e.preventDefault(); saveOption(e.target); return; }
    if (e.key === 'Escape') { if ($('#modal-root').classList.contains('open')) closeModal(); else toggleMenu(false); }
  });
  window.addEventListener('hashchange', function () { showView(location.hash.slice(1)); });
  window.addEventListener('storage', function (e) {
    if (e.key === null || ALL_KEYS.indexOf(e.key) !== -1) { loadAll(); populateSelects(); renderCurrent(); }
  });

  /* ================= Init ================= */
  function init() {
    $$('[data-ico]').forEach(function (el) { el.innerHTML = svg(el.dataset.ico); });
    if (!storageWorks()) $('#storage-warning').classList.remove('hidden');
    loadAll();
    Object.keys(FILTER_DEFAULTS).forEach(syncFilterInputs);
    showView(location.hash.slice(1));
  }
  init();
})();
