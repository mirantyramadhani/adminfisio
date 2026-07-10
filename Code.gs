const SHEET_PATIENTS = 'Patients';
const SHEET_ADMINS = 'AdminUsers';
const SHEET_AUDITLOG = 'AuditLog';

const CATEGORIES = ['Terapi Elektro', 'Terapi Latihan', 'Terapi Anak', 'Hydro Terapi', 'Exo', 'C-Mill', 'CX', 'Robotic'];
const STATUS_OPTIONS = ['Menunggu', 'Sedang Terapi', 'Selesai', 'Batal'];

function doGet(e) {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:sans-serif">Akses ditolak. Pastikan kamu login dengan akun Google, ' +
      'lalu buka ulang link AdminFisio ini.</p>'
    );
  }
  const info = getUserRole_(email);
  if (!info) {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:sans-serif">Email <b>' + email + '</b> belum terdaftar sebagai admin ' +
      'AdminFisio. Minta penanggung jawab sistem menambahkan emailmu di sheet "AdminUsers".</p>'
    );
  }
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('AdminFisio')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUserRole_(email) {
  const sheet = getSheet_(SHEET_ADMINS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email.trim().toLowerCase()) {
      return { name: data[i][1], role: data[i][2] };
    }
  }
  return null;
}

function getCurrentUser() {
  const email = Session.getActiveUser().getEmail();
  const info = getUserRole_(email);
  if (!info) throw new Error('User tidak terdaftar sebagai admin AdminFisio.');
  return { email: email, name: info.name, role: info.role };
}

function requireAdmin_() {
  const user = getCurrentUser();
  if (user.role !== 'Admin') {
    throw new Error('Aksi ini hanya bisa dilakukan oleh Admin (kamu login sebagai Supervisor / read-only).');
  }
  return user;
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" tidak ditemukan. Cek PANDUAN_SETUP.md.');
  return sheet;
}

function getCategories() {
  return CATEGORIES;
}

function getStatusOptions() {
  return STATUS_OPTIONS;
}

function registerPatient(payload) {
  const user = getCurrentUser();

  if (!payload.nama || !payload.kategori) {
    throw new Error('Nama pasien dan kategori wajib diisi.');
  }
  if (CATEGORIES.indexOf(payload.kategori) === -1) {
    throw new Error('Kategori tidak dikenali: ' + payload.kategori);
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(15000);
  if (!gotLock) {
    throw new Error('Sistem sedang sibuk (admin lain sedang menyimpan data). Coba lagi sebentar.');
  }

  try {
    const sheet = getSheet_(SHEET_PATIENTS);
    const id = generatePatientId_(sheet);
    const now = new Date();

    sheet.appendRow([
      id,
      now,
      payload.nama,
      payload.noRM || '',
      payload.noTelepon || '',
      payload.kategori,
      '-',
      'Menunggu',
      payload.catatan || '',
      user.email
    ]);

    logAudit_(user.email, 'REGISTER', 'Pasien baru: ' + payload.nama + ' (' + id + ')');
    return { id: id, message: 'Pasien "' + payload.nama + '" berhasil didaftarkan dengan ID ' + id + '.' };
  } finally {
    lock.releaseLock();
  }
}

function generatePatientId_(sheet) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const data = sheet.getDataRange().getValues();
  let countToday = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).indexOf('FIS-' + today) === 0) countToday++;
  }
  const seq = String(countToday + 1).padStart(3, '0');
  return 'FIS-' + today + '-' + seq;
}

function getPatients(filter) {
  const sheet = getSheet_(SHEET_PATIENTS);
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();

  let rows = data.slice(1).map(function (r) {
    return {
      id: r[0],
      timestamp: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, 'dd/MM/yyyy HH:mm') : r[1],
      nama: r[2], noRM: r[3], noTelepon: r[4],
      kategori: r[5], status: r[7], catatan: r[8], dicatatOleh: r[9]
    };
  });

  if (filter) {
    if (filter.kategori) rows = rows.filter(function (r) { return r.kategori === filter.kategori; });
    if (filter.status) rows = rows.filter(function (r) { return r.status === filter.status; });
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      rows = rows.filter(function (r) {
        return r.nama.toLowerCase().indexOf(kw) > -1 || String(r.id).toLowerCase().indexOf(kw) > -1;
      });
    }
  }
  return rows.reverse();
}

function getQueueByPos(kategori) {
  const sheet = getSheet_(SHEET_PATIENTS);
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const rows = data.slice(1)
    .filter(function (r) {
      const ts = r[1];
      const tsStr = ts instanceof Date ? Utilities.formatDate(ts, tz, 'yyyy-MM-dd') : '';
      return r[5] === kategori && tsStr === today && (r[7] === 'Menunggu' || r[7] === 'Sedang Terapi');
    })
    .map(function (r) {
      return {
        id: r[0],
        jam: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, 'HH:mm') : '',
        nama: r[2],
        status: r[7]
      };
    });

  rows.sort(function (a, b) { return a.jam < b.jam ? -1 : 1; });
  return rows;
}

function updatePatientStatus(id, newStatus) {
  const user = requireAdmin_();
  if (STATUS_OPTIONS.indexOf(newStatus) === -1) throw new Error('Status tidak valid: ' + newStatus);

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(15000);
  if (!gotLock) throw new Error('Sistem sedang sibuk, coba lagi sebentar.');

  try {
    const sheet = getSheet_(SHEET_PATIENTS);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const oldStatus = data[i][7];
        sheet.getRange(i + 1, 8).setValue(newStatus);
        logAudit_(user.email, 'UPDATE_STATUS', id + ': ' + oldStatus + ' -> ' + newStatus);
        return { message: 'Status pasien ' + id + ' diperbarui jadi "' + newStatus + '".' };
      }
    }
    throw new Error('Pasien dengan ID ' + id + ' tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

function logAudit_(email, aksi, detail) {
  const sheet = getSheet_(SHEET_AUDITLOG);
  sheet.appendRow([new Date(), email, aksi, detail]);
}

function getAuditLog() {
  requireAdmin_();
  const sheet = getSheet_(SHEET_AUDITLOG);
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  return data.slice(1).reverse().map(function (r) {
    return {
      timestamp: r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'dd/MM/yyyy HH:mm') : r[0],
      email: r[1], aksi: r[2], detail: r[3]
    };
  });
}

function getDashboardSummary() {
  const sheet = getSheet_(SHEET_PATIENTS);
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);

  const perKategori = {};
  CATEGORIES.forEach(function (k) { perKategori[k] = 0; });

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  let todayCount = 0;

  rows.forEach(function (r) {
    const kategori = r[5];
    if (perKategori[kategori] !== undefined) perKategori[kategori]++;

    const ts = r[1];
    if (ts instanceof Date) {
      const tsStr = Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      if (tsStr === today) todayCount++;
    }
  });

  return {
    totalPasien: rows.length,
    pasienHariIni: todayCount,
    perKategori: perKategori
  };
}

const ARCHIVE_PREFIX = 'Patients_';

function getCurrentMonthKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
}

/**
 * Mindahin data bulan-bulan lama dari sheet 'Patients' ke sheet arsip
 * terpisah (misal 'Patients_2026-06'), sisain cuma data bulan berjalan.
 * Dipanggil otomatis tiap tanggal 1 lewat trigger (lihat setupMonthlyArchiveTrigger).
 */
function archiveOldMonths_() {
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(30000);
  if (!gotLock) throw new Error('Tidak bisa lock untuk proses arsip, coba lagi nanti.');

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheet_(SHEET_PATIENTS);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return; // cuma header, tidak ada apa-apa buat diarsip

    const header = data[0];
    const tz = Session.getScriptTimeZone();
    const currentMonthKey = getCurrentMonthKey_();

    const keepRows = [];
    const archiveGroups = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const ts = row[1];
      const monthKey = ts instanceof Date ? Utilities.formatDate(ts, tz, 'yyyy-MM') : currentMonthKey;
      if (monthKey === currentMonthKey) {
        keepRows.push(row);
      } else {
        if (!archiveGroups[monthKey]) archiveGroups[monthKey] = [];
        archiveGroups[monthKey].push(row);
      }
    }

    Object.keys(archiveGroups).forEach(function (monthKey) {
      const sheetName = ARCHIVE_PREFIX + monthKey;
      let archiveSheet = ss.getSheetByName(sheetName);
      if (!archiveSheet) {
        archiveSheet = ss.insertSheet(sheetName);
        archiveSheet.appendRow(header);
      }
      const rowsToWrite = archiveGroups[monthKey];
      archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToWrite.length, header.length)
        .setValues(rowsToWrite);
    });

    sheet.clearContents();
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    if (keepRows.length > 0) {
      sheet.getRange(2, 1, keepRows.length, header.length).setValues(keepRows);
    }

    logAudit_('SYSTEM', 'ARCHIVE',
      'Arsip bulan: ' + (Object.keys(archiveGroups).join(', ') || '(tidak ada)') +
      '. Sisa di Patients: ' + keepRows.length + ' baris.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Jalankan fungsi ini SEKALI aja secara manual dari editor Apps Script
 * (pilih fungsi ini di dropdown atas, klik Run) buat masang trigger otomatis.
 * Nggak perlu dipanggil lagi setelahnya.
 */
function setupMonthlyArchiveTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'archiveOldMonths_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('archiveOldMonths_')
    .timeBased()
    .onMonthDay(1)
    .atHour(1)
    .create();
}

function getLaporan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const allSheets = ss.getSheets();

  const perPosTotal = {};
  CATEGORIES.forEach(function (k) { perPosTotal[k] = 0; });

  const monthlyMap = {};

  allSheets.forEach(function (sh) {
    const name = sh.getName();
    if (name !== SHEET_PATIENTS && name.indexOf(ARCHIVE_PREFIX) !== 0) return;

    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return;

    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const kategori = r[5];
      if (perPosTotal[kategori] !== undefined) perPosTotal[kategori]++;

      const ts = r[1];
      let monthKey;
      if (ts instanceof Date) {
        monthKey = Utilities.formatDate(ts, tz, 'yyyy-MM');
      } else if (name.indexOf(ARCHIVE_PREFIX) === 0) {
        monthKey = name.substring(ARCHIVE_PREFIX.length);
      } else {
        monthKey = getCurrentMonthKey_();
      }
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;
    }
  });

  const monthlyTrend = Object.keys(monthlyMap).sort().map(function (mk) {
    return { bulan: mk, total: monthlyMap[mk] };
  });

  return { perPosTotal: perPosTotal, monthlyTrend: monthlyTrend };
}