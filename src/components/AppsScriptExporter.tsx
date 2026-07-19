import React, { useState } from 'react';
import { Copy, Check, FileCode, Terminal, HelpCircle, ArrowRight, Play, Eye, BookOpen } from 'lucide-react';

export default function AppsScriptExporter() {
  const [copiedCodeGs, setCopiedCodeGs] = useState(false);
  const [copiedIndexHtml, setCopiedIndexHtml] = useState(false);

  const codeGsContent = `/**
 * Personal Finance & Envelope Budgeting System
 * Google Apps Script - Code.gs
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Envelope Budgeting System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Initialize Sheets if they don't exist
 */
function setupSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup Transaksi Sheet
  var txSheet = ss.getSheetByName('Transaksi');
  if (!txSheet) {
    txSheet = ss.insertSheet('Transaksi');
    txSheet.appendRow(['Timestamp', 'Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Deskripsi', 'ID_Kantong']);
    // Format header
    txSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#E2E8F0');
  }
  
  // 2. Setup Kantong Sheet
  var ktSheet = ss.getSheetByName('Kantong');
  if (!ktSheet) {
    ktSheet = ss.insertSheet('Kantong');
    ktSheet.appendRow(['ID_Kantong', 'Nama_Kantong', 'Saldo_Awal', 'Saldo_Saat_Ini']);
    ktSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#E2E8F0');
    
    // Seed default pockets with native formulas
    var defaultKantongUS = [
      ['K01', 'Makan & Minum', 1000000, '=C2+SUMIF(Transaksi!G:G, A2, Transaksi!E:E)'],
      ['K02', 'Transportasi', 300000, '=C3+SUMIF(Transaksi!G:G, A3, Transaksi!E:E)'],
      ['K03', 'Tagihan & Bulanan', 2000000, '=C4+SUMIF(Transaksi!G:G, A4, Transaksi!E:E)'],
      ['K04', 'Tabungan & Investasi', 1000000, '=C5+SUMIF(Transaksi!G:G, A5, Transaksi!E:E)'],
      ['K05', 'Hiburan & Hobi', 500000, '=C6+SUMIF(Transaksi!G:G, A6, Transaksi!E:E)']
    ];
    
    for (var i = 0; i < defaultKantongUS.length; i++) {
      ktSheet.appendRow(defaultKantongUS[i]);
    }
  }
}

/**
 * Fetch pocket lists
 */
function getKantong() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Kantong');
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var pockets = [];
  for (var i = 1; i < data.length; i++) {
    var id = data[i][0];
    var nama = data[i][1];
    var saldoAwal = parseFloat(data[i][2]) || 0;
    var saldo = parseFloat(data[i][3]) || 0;
    
    if (id) {
      pockets.push({
        id: id,
        name: nama,
        saldoAwal: saldoAwal,
        target: saldoAwal,
        balance: saldo
      });
    }
  }
  return pockets;
}

/**
 * Fetch transaction list
 */
function getTransaksi() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Transaksi');
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var list = [];
  // Load last 150 transactions for performance
  var startRow = Math.max(1, data.length - 150);
  for (var i = data.length - 1; i >= startRow; i--) {
    var row = data[i];
    list.push({
      timestamp: String(row[0]),
      date: Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      type: row[2],
      category: row[3],
      amount: parseFloat(row[4]) || 0,
      description: row[5],
      pocketId: row[6] || ''
    });
  }
  return list;
}

/**
 * Save transaction
 */
function simpanTransaksi(formData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Transaksi');
  if (!sheet) {
    setupSystem();
    sheet = ss.getSheetByName('Transaksi');
  }
  
  var timestamp = new Date().toISOString();
  var amount = parseFloat(formData.amount) || 0;
  
  // Ensure "Keluar" types are negative numbers
  var nominal = formData.type === 'Keluar' ? -Math.abs(amount) : Math.abs(amount);
  
  sheet.appendRow([
    timestamp,
    formData.date,
    formData.type,
    formData.category,
    nominal,
    formData.description,
    formData.pocketId
  ]);
  
  return { success: true, message: 'Transaksi berhasil disimpan!' };
}

/**
 * Update transaction by matching timestamp
 */
function updateTransaksi(originalTimestamp, updatedData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Transaksi');
  if (!sheet) return { success: false, message: 'Lembar Transaksi tidak ditemukan.' };
  
  var data = sheet.getDataRange().getValues();
  var matchIndex = -1;
  for (var i = 1; i < data.length; i++) {
    var rowTimestamp = data[i][0];
    if (rowTimestamp instanceof Date) {
      rowTimestamp = rowTimestamp.toISOString();
    } else {
      rowTimestamp = String(rowTimestamp);
    }
    
    if (rowTimestamp === originalTimestamp || String(data[i][0]) === originalTimestamp) {
      matchIndex = i;
      break;
    }
  }
  
  if (matchIndex === -1) {
    return { success: false, message: 'Transaksi tidak ditemukan.' };
  }
  
  var rowIndex = matchIndex + 1;
  var amount = parseFloat(updatedData.amount) || 0;
  var nominalValue = updatedData.type === 'Keluar' ? -Math.abs(amount) : Math.abs(amount);
  
  sheet.getRange(rowIndex, 1, 1, 7).setValues([[
    originalTimestamp,
    updatedData.date,
    updatedData.type,
    updatedData.category,
    nominalValue,
    updatedData.description,
    updatedData.pocketId
  ]]);
  
  return { success: true, message: 'Transaksi berhasil diubah!' };
}

/**
 * Delete transaction by matching timestamp
 */
function deleteTransaksiByTimestamp(timestamp) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Transaksi');
  if (!sheet) return { success: false, message: 'Lembar Transaksi tidak ditemukan.' };
  
  var data = sheet.getDataRange().getValues();
  var matchIndex = -1;
  for (var i = 1; i < data.length; i++) {
    var rowTimestamp = data[i][0];
    if (rowTimestamp instanceof Date) {
      rowTimestamp = rowTimestamp.toISOString();
    } else {
      rowTimestamp = String(rowTimestamp);
    }
    
    if (rowTimestamp === timestamp || String(data[i][0]) === timestamp) {
      matchIndex = i;
      break;
    }
  }
  
  if (matchIndex === -1) {
    return { success: false, message: 'Transaksi tidak ditemukan.' };
  }
  
  var rowIndex = matchIndex + 1;
  sheet.deleteRow(rowIndex);
  
  return { success: true, message: 'Transaksi berhasil dihapus!' };
}

/**
 * Add a new custom Pocket
 */
function tambahKantongBaru(id, name, saldoAwal) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Kantong');
  if (!sheet) {
    setupSystem();
    sheet = ss.getSheetByName('Kantong');
  }
  
  var lastRow = sheet.getLastRow();
  var nextRow = lastRow + 1;
  var formula = '=C' + nextRow + '+SUMIF(Transaksi!G:G, A' + nextRow + ', Transaksi!E:E)';
  
  sheet.appendRow([id, name, saldoAwal, formula]);
  return { success: true, message: 'Kantong ' + name + ' berhasil dibuat!' };
}

/**
 * Update an existing Pocket
 */
function updateKantong(originalId, updatedData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Kantong');
  if (!sheet) return { success: false, message: 'Lembar Kantong tidak ditemukan.' };
  
  var data = sheet.getDataRange().getValues();
  var matchIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === originalId) {
      matchIndex = i;
      break;
    }
  }
  
  if (matchIndex === -1) {
    return { success: false, message: 'Kantong tidak ditemukan.' };
  }
  
  var rowIndex = matchIndex + 1;
  var formula = '=C' + rowIndex + '+SUMIF(Transaksi!G:G, A' + rowIndex + ', Transaksi!E:E)';
  
  sheet.getRange(rowIndex, 1, 1, 4).setValues([[
    updatedData.id,
    updatedData.name,
    parseFloat(updatedData.saldoAwal) || 0,
    formula
  ]]);
  
  // If the Pocket ID changed, we must also update any transactions referencing the old pocket ID!
  if (originalId !== updatedData.id) {
    var txSheet = ss.getSheetByName('Transaksi');
    if (txSheet) {
      var txData = txSheet.getDataRange().getValues();
      for (var j = 1; j < txData.length; j++) {
        if (txData[j][6] === originalId) {
          txSheet.getRange(j + 1, 7).setValue(updatedData.id);
        }
      }
    }
  }
  
  return { success: true, message: 'Kantong berhasil diubah!' };
}

/**
 * Delete a Pocket by matching pocketId
 */
function deleteKantongById(pocketId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Kantong');
  if (!sheet) return { success: false, message: 'Lembar Kantong tidak ditemukan.' };
  
  var data = sheet.getDataRange().getValues();
  var matchIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === pocketId) {
      matchIndex = i;
      break;
    }
  }
  
  if (matchIndex === -1) {
    return { success: false, message: 'Kantong tidak ditemukan.' };
  }
  
  var rowIndex = matchIndex + 1;
  sheet.deleteRow(rowIndex);
  
  // Clean up references in transactions (set them to empty string)
  var txSheet = ss.getSheetByName('Transaksi');
  if (txSheet) {
    var txData = txSheet.getDataRange().getValues();
    for (var j = 1; j < txData.length; j++) {
      if (txData[j][6] === pocketId) {
        txSheet.getRange(j + 1, 7).setValue('');
      }
    }
  }
  
  // Re-adjust formulas for subsequent rows in Kantong so they point to the correct row C number
  var lastRow = sheet.getLastRow();
  for (var rowNum = rowIndex; rowNum <= lastRow; rowNum++) {
    var formula = '=C' + rowNum + '+SUMIF(Transaksi!G:G, A' + rowNum + ', Transaksi!E:E)';
    sheet.getRange(rowNum, 4).setFormula(formula);
  }
  
  return { success: true, message: 'Kantong berhasil dihapus!' };
}
`;

  const indexHtmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sistem Anggaran Kantong (Envelope Budgeting)</title>
  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- FontAwesome for Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      padding-bottom: 50px;
    }
    .navbar {
      background: linear-gradient(135deg, #0f172a, #1e293b);
    }
    .card-dashboard {
      border: none;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
      background-color: #ffffff;
      transition: all 0.2s ease-in-out;
    }
    .card-dashboard:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    }
    .badge-pocket {
      font-size: 0.75rem;
      padding: 0.35em 0.65em;
      border-radius: 6px;
    }
    .table-responsive {
      border-radius: 12px;
      background: white;
    }
    .progress {
      height: 8px;
      border-radius: 4px;
    }
    .text-nominal-in {
      color: #10b981;
      font-weight: 600;
    }
    .text-nominal-out {
      color: #ef4444;
      font-weight: 600;
    }
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.85);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
  </style>
</head>
<body>

  <!-- Loading Overlay -->
  <div id="loadingOverlay" class="loading-overlay">
    <div class="text-center">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-secondary font-medium">Sedang memuat sistem budgeting...</p>
    </div>
  </div>

  <!-- Navbar -->
  <nav class="navbar navbar-dark shadow-sm py-3 mb-4">
    <div class="container">
      <span class="navbar-brand mb-0 h1">
        <i class="fa-solid fa-wallet text-warning me-2"></i>Sistem Budgeting Kantong
      </span>
      <button class="btn btn-outline-light btn-sm" onclick="initData()">
        <i class="fa-solid fa-arrows-rotate me-1"></i> Segarkan Data
      </button>
    </div>
  </nav>

  <div class="container">
    
    <!-- Top Stats Rows -->
    <div class="row g-3 mb-4">
      <div class="col-md-4">
        <div class="card card-dashboard p-4 text-center">
          <p class="text-secondary text-uppercase fw-semibold mb-1" style="font-size: 0.8rem; tracking-wider: 1px;">Total Saldo Aktif</p>
          <h2 class="fw-bold text-primary mb-0" id="totalSaldo">Rp 0</h2>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card card-dashboard p-4 text-center border-start border-success border-4">
          <p class="text-secondary text-uppercase fw-semibold mb-1" style="font-size: 0.8rem;">Total Pemasukan</p>
          <h2 class="fw-bold text-success mb-0" id="totalPemasukan">Rp 0</h2>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card card-dashboard p-4 text-center border-start border-danger border-4">
          <p class="text-secondary text-uppercase fw-semibold mb-1" style="font-size: 0.8rem;">Total Pengeluaran</p>
          <h2 class="fw-bold text-danger mb-0" id="totalPengeluaran">Rp 0</h2>
        </div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="row g-4">
      
      <!-- Input Transaction Form & Pocket Management -->
      <div class="col-lg-5">
        
        <!-- Form Transaksi -->
        <div class="card card-dashboard p-4 mb-4">
          <h4 class="fw-bold mb-4 text-slate-800"><i class="fa-solid fa-pen-to-square text-primary me-2"></i>Catat Transaksi</h4>
          
          <form id="transaksiForm" onsubmit="handleFormSubmit(event)">
            
            <!-- Tanggal -->
            <div class="mb-3">
              <label class="form-label fw-semibold">Tanggal</label>
              <input type="date" id="tanggal" class="form-control" required>
            </div>
            
            <!-- Tipe Transaksi -->
            <div class="mb-3">
              <label class="form-label fw-semibold d-block">Tipe Transaksi</label>
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="tipe" id="tipeKeluar" value="Keluar" checked onchange="togglePocketReq(true)">
                <label class="form-check-label fw-medium text-danger" for="tipeKeluar">
                  <i class="fa-solid fa-arrow-up-from-bracket me-1"></i> Pengeluaran (Keluar)
                </label>
              </div>
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="tipe" id="tipeMasuk" value="Masuk" onchange="togglePocketReq(false)">
                <label class="form-check-label fw-medium text-success" for="tipeMasuk">
                  <i class="fa-solid fa-arrow-down-to-bracket me-1"></i> Pemasukan (Masuk)
                </label>
              </div>
            </div>
            
            <!-- Kantong Dropdown -->
            <div class="mb-3" id="kantongGroup">
              <label class="form-label fw-semibold">Kantong Tujuan</label>
              <select id="idKantong" class="form-select" required>
                <option value="" disabled selected>Pilih Kantong...</option>
              </select>
              <small class="text-muted">Untuk Pemasukan, jika tidak spesifik bisa memilih Kantong default atau bebas.</small>
            </div>
            
            <!-- Kategori -->
            <div class="mb-3">
              <label class="form-label fw-semibold">Kategori</label>
              <input type="text" id="kategori" class="form-control" placeholder="Contoh: Makanan, Bensin, Gaji, dll." required>
            </div>
            
            <!-- Nominal -->
            <div class="mb-3">
              <label class="form-label fw-semibold">Nominal (Rupiah)</label>
              <div class="input-group">
                <span class="input-group-text">Rp</span>
                <input type="number" id="nominal" class="form-control" placeholder="0" min="1" required>
              </div>
            </div>
            
            <!-- Deskripsi -->
            <div class="mb-3">
              <label class="form-label fw-semibold">Deskripsi</label>
              <textarea id="deskripsi" class="form-control" rows="2" placeholder="Catatan tambahan..." required></textarea>
            </div>
            
            <div id="txButtonContainer" class="d-flex gap-2">
              <button type="submit" id="txSubmitBtn" class="btn btn-primary w-100 py-2.5 fw-bold text-uppercase">
                <i class="fa-solid fa-floppy-disk me-1"></i> Simpan Transaksi
              </button>
              <button type="button" id="txCancelBtn" class="btn btn-outline-secondary w-50 py-2.5 fw-bold text-uppercase" style="display: none;" onclick="cancelTxEdit()">
                Batal
              </button>
            </div>
          </form>
        </div>

        <!-- Tambah Kantong Baru -->
        <div class="card card-dashboard p-4">
          <h5 class="fw-bold mb-3"><i class="fa-solid fa-folder-plus text-success me-2"></i>Kelola Kantong (Envelope)</h5>
          <form id="kantongForm" onsubmit="handleKantongSubmit(event)">
            <div class="row g-2">
              <div class="col-4">
                <input type="text" id="newKantongId" class="form-control form-control-sm text-uppercase" placeholder="ID (cth: K06)" required>
              </div>
              <div class="col-8">
                <input type="text" id="newKantongName" class="form-control form-control-sm" placeholder="Nama Kantong" required>
              </div>
              <div class="col-12 mt-2">
                <div class="input-group input-group-sm">
                  <span class="input-group-text">Saldo Awal Rp</span>
                  <input type="number" id="newKantongTarget" class="form-control form-control-sm" placeholder="Saldo Awal" required>
                </div>
              </div>
              <div class="col-12 mt-2 d-flex gap-2" id="pocketButtonContainer">
                <button type="submit" id="pocketSubmitBtn" class="btn btn-success btn-sm w-100 fw-semibold">
                  <i class="fa-solid fa-plus me-1"></i> Buat Kantong
                </button>
                <button type="button" id="pocketCancelBtn" class="btn btn-outline-secondary btn-sm w-50 fw-semibold" style="display: none;" onclick="cancelPocketEdit()">
                  Batal
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Pocket Balances & Recent Transactions List -->
      <div class="col-lg-7">
        
        <!-- Saldo Per Kantong (Envelopes) -->
        <div class="card card-dashboard p-4 mb-4">
          <h4 class="fw-bold mb-4 text-slate-800"><i class="fa-solid fa-circle-nodes text-warning me-2"></i>Status Anggaran Kantong</h4>
          <div id="pocketsContainer">
            <!-- Dynamic Pocket Cards -->
          </div>
        </div>

        <!-- Riwayat Transaksi -->
        <div class="card card-dashboard p-4">
          <h4 class="fw-bold mb-4 text-slate-800"><i class="fa-solid fa-clock-rotate-left text-info me-2"></i>Transaksi Terakhir</h4>
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0" style="font-size: 0.9rem;">
              <thead class="table-light">
                <tr>
                  <th>Tanggal</th>
                  <th>Kantong</th>
                  <th>Kategori</th>
                  <th>Deskripsi</th>
                  <th class="text-end">Nominal</th>
                  <th class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody id="transaksiContainer">
                <!-- Dynamic Transactions Rows -->
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  </div>

  <!-- Apps Script Client Side JS -->
  <script>
    // Initialize default date to today
    document.getElementById('tanggal').value = new Date().toISOString().substring(0, 10);
    
    // Global States
    let listPockets = [];
    let listTransactions = [];
    let pocketEditingId = null;
    let txEditingTimestamp = null;

    // On Load
    window.onload = function() {
      initData();
    };

    function initData() {
      showLoading(true);
      
      // Load Pockets and Transactions in parallel
      google.script.run
        .withSuccessHandler(function(pockets) {
          listPockets = pockets;
          renderPockets();
          updatePocketsDropdown();
          
          google.script.run
            .withSuccessHandler(function(transactions) {
              listTransactions = transactions;
              renderTransactions();
              calculateSummary();
              showLoading(false);
            })
            .withFailureHandler(function(err) {
              alert("Gagal memuat transaksi: " + err.message);
              showLoading(false);
            })
            .getTransaksi();
        })
        .withFailureHandler(function(err) {
          alert("Gagal memuat kantong: " + err.message);
          showLoading(false);
        })
        .getKantong();
    }

    function showLoading(show) {
      document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
    }

    function togglePocketReq(isExpense) {
      // Pockets is always useful, keep dropdown enabled, but toggle description helpfulness
    }

    function formatRupiah(value) {
      const isNegative = value < 0;
      const absValue = Math.abs(value);
      const formatted = 'Rp ' + absValue.toLocaleString('id-ID', { minimumFractionDigits: 0 });
      return isNegative ? '-' + formatted : formatted;
    }

    // Render Pockets (Envelopes)
    function renderPockets() {
      const container = document.getElementById('pocketsContainer');
      container.innerHTML = '';

      if (listPockets.length === 0) {
        container.innerHTML = '<div class="alert alert-warning py-3">Belum ada Kantong yang terdaftar. Gunakan formulir untuk menambah Kantong.</div>';
        return;
      }

      listPockets.forEach(pocket => {
        // Calculate remaining usage
        const balance = pocket.balance;
        const target = pocket.saldoAwal !== undefined ? pocket.saldoAwal : (pocket.target || 0);
        
        // Expense used up
        let usagePercent = 0;
        if (target > 0) {
          usagePercent = Math.min(100, Math.round((Math.abs(balance) / target) * 100));
        }
        
        let progressColor = 'bg-primary';
        if (usagePercent > 85) {
          progressColor = 'bg-danger';
        } else if (usagePercent > 50) {
          progressColor = 'bg-warning';
        } else {
          progressColor = 'bg-success';
        }

        const pocketCard = \`
          <div class="mb-4 border-bottom pb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <div>
                <span class="fw-bold text-dark font-medium">\${pocket.name}</span>
                <span class="badge bg-secondary badge-pocket ms-2">\${pocket.id}</span>
                <div class="d-inline-flex gap-2 ms-2">
                  <button class="btn btn-link p-0 text-primary" onclick="editPocketInline('\${pocket.id}')" title="Ubah Kantong" style="text-decoration: none;">
                    <i class="fa-solid fa-pen" style="font-size: 0.75rem;"></i>
                  </button>
                  <button class="btn btn-link p-0 text-danger" onclick="deletePocketInline('\${pocket.id}')" title="Hapus Kantong" style="text-decoration: none;">
                    <i class="fa-solid fa-trash" style="font-size: 0.75rem;"></i>
                  </button>
                </div>
              </div>
              <div class="text-end">
                <span class="fw-bold text-primary">\${formatRupiah(balance)}</span>
                <span class="text-muted d-block" style="font-size: 0.75rem;">Awal: \${formatRupiah(target)}</span>
              </div>
            </div>
            <div class="progress mb-1">
              <div class="progress-bar \${progressColor}" role="progressbar" style="width: \${usagePercent}%" aria-valuenow="\${usagePercent}" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
            <div class="d-flex justify-content-between" style="font-size: 0.75rem;">
              <span class="text-muted">Terpakai: \${usagePercent}%</span>
              <span class="text-muted">\${formatRupiah(target - Math.abs(balance))} sisa saldo</span>
            </div>
          </div>
        \`;
        container.innerHTML += pocketCard;
      });
    }

    // Update Dropdown List
    function updatePocketsDropdown() {
      const dropdown = document.getElementById('idKantong');
      dropdown.innerHTML = '<option value="" disabled selected>Pilih Kantong...</option>';
      
      listPockets.forEach(pocket => {
        const option = document.createElement('option');
        option.value = pocket.id;
        option.textContent = pocket.id + ' - ' + pocket.name;
        dropdown.appendChild(option);
      });
    }

    // Render Recent Transactions
    function renderTransactions() {
      const container = document.getElementById('transaksiContainer');
      container.innerHTML = '';

      if (listTransactions.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-secondary">Belum ada transaksi terekam.</td></tr>';
        return;
      }

      listTransactions.forEach(tx => {
        const pocketName = getPocketName(tx.pocketId);
        const nominalClass = tx.type === 'Masuk' ? 'text-nominal-in' : 'text-nominal-out';
        const sign = tx.type === 'Masuk' ? '+' : '';
        
        const row = \`
          <tr>
            <td><span class="text-secondary" style="font-size: 0.8rem;">\${tx.date}</span></td>
            <td><span class="badge bg-light text-dark font-medium">\${pocketName}</span></td>
            <td><span class="fw-medium">\${tx.category}</span></td>
            <td><span class="text-secondary" style="font-size: 0.85rem;">\${tx.description}</span></td>
            <td class="text-end \${nominalClass}">\${sign}\${formatRupiah(tx.amount)}</td>
            <td class="text-center">
              <div class="d-flex justify-content-center gap-2">
                <button class="btn btn-link p-0 text-primary" onclick="editTransaksiInline('\${tx.timestamp}')" title="Ubah Transaksi" style="text-decoration: none;">
                  <i class="fa-solid fa-pen" style="font-size: 0.8rem;"></i>
                </button>
                <button class="btn btn-link p-0 text-danger" onclick="deleteTransaksiInline('\${tx.timestamp}')" title="Hapus Transaksi" style="text-decoration: none;">
                  <i class="fa-solid fa-trash" style="font-size: 0.8rem;"></i>
                </button>
              </div>
            </td>
          </tr>
        \`;
        container.innerHTML += row;
      });
    }

    function getPocketName(id) {
      const p = listPockets.find(pocket => pocket.id === id);
      return p ? p.name : id || 'Tanpa Kantong';
    }

    // Calculate Summary stats
    function calculateSummary() {
      let totalSaldoVal = 0;
      let totalPemasukanVal = 0;
      let totalPengeluaranVal = 0;

      listTransactions.forEach(tx => {
        const amt = Math.abs(tx.amount);
        if (tx.type === 'Masuk') {
          totalPemasukanVal += amt;
          totalSaldoVal += amt;
        } else {
          totalPengeluaranVal += amt;
          totalSaldoVal -= amt;
        }
      });

      // Alternatively, let pockets sum determine the active balance
      let pocketsTotalSaldo = 0;
      listPockets.forEach(p => {
        pocketsTotalSaldo += p.balance;
      });

      document.getElementById('totalSaldo').textContent = formatRupiah(pocketsTotalSaldo);
      document.getElementById('totalPemasukan').textContent = formatRupiah(totalPemasukanVal);
      document.getElementById('totalPengeluaran').textContent = formatRupiah(totalPengeluaranVal);
    }

    // Edit Pocket Inline
    function editPocketInline(id) {
      const pocket = listPockets.find(p => p.id === id);
      if (!pocket) return;

      pocketEditingId = id;
      document.getElementById('newKantongId').value = pocket.id;
      document.getElementById('newKantongId').disabled = true;
      document.getElementById('newKantongName').value = pocket.name;
      
      const targetVal = pocket.saldoAwal !== undefined ? pocket.saldoAwal : (pocket.target || 0);
      document.getElementById('newKantongTarget').value = targetVal;

      // Update submit buttons
      document.getElementById('pocketSubmitBtn').className = "btn btn-primary btn-sm w-100 fw-semibold";
      document.getElementById('pocketSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Simpan Perubahan';
      document.getElementById('pocketCancelBtn').style.display = "block";
    }

    // Cancel Pocket Edit
    function cancelPocketEdit() {
      pocketEditingId = null;
      document.getElementById('newKantongId').value = '';
      document.getElementById('newKantongId').disabled = false;
      document.getElementById('newKantongName').value = '';
      document.getElementById('newKantongTarget').value = '';

      document.getElementById('pocketSubmitBtn').className = "btn btn-success btn-sm w-100 fw-semibold";
      document.getElementById('pocketSubmitBtn').innerHTML = '<i class="fa-solid fa-plus me-1"></i> Buat Kantong';
      document.getElementById('pocketCancelBtn').style.display = "none";
    }

    // Delete Pocket Inline
    function deletePocketInline(id) {
      const pocket = listPockets.find(p => p.id === id);
      if (!pocket) return;

      const confirmMsg = "Apakah Anda yakin ingin menghapus kantong '" + pocket.name + "' (" + pocket.id + ")?\\n" +
                         "Data transaksi yang mengacu ke kantong ini akan dilepas hubungannya secara aman di Google Sheets Anda.";
      
      if (confirm(confirmMsg)) {
        showLoading(true);
        google.script.run
          .withSuccessHandler(function(res) {
            alert(res.message || "Kantong berhasil dihapus!");
            initData();
          })
          .withFailureHandler(function(err) {
            alert("Gagal menghapus kantong: " + err.message);
            showLoading(false);
          })
          .deleteKantongById(id);
      }
    }

    // Edit Transaction Inline
    function editTransaksiInline(timestamp) {
      const tx = listTransactions.find(t => t.timestamp === timestamp);
      if (!tx) return;

      txEditingTimestamp = timestamp;
      document.getElementById('tanggal').value = tx.date;
      
      if (tx.type === 'Masuk') {
        document.getElementById('tipeMasuk').checked = true;
        togglePocketReq(false);
      } else {
        document.getElementById('tipeKeluar').checked = true;
        togglePocketReq(true);
      }

      document.getElementById('idKantong').value = tx.pocketId || '';
      document.getElementById('kategori').value = tx.category;
      document.getElementById('nominal').value = Math.abs(tx.amount);
      document.getElementById('deskripsi').value = tx.description;

      // Update Form Title and buttons
      document.getElementById('transaksiForm').closest('.card').querySelector('h4').innerHTML = '<i class="fa-solid fa-pen-to-square text-warning me-2"></i>Ubah Transaksi';
      document.getElementById('txSubmitBtn').className = "btn btn-warning w-100 py-2.5 fw-bold text-uppercase text-white";
      document.getElementById('txSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Simpan Perubahan';
      document.getElementById('txCancelBtn').style.display = "block";
    }

    // Cancel Transaction Edit
    function cancelTxEdit() {
      txEditingTimestamp = null;
      document.getElementById('tanggal').value = new Date().toISOString().substring(0, 10);
      document.getElementById('tipeKeluar').checked = true;
      togglePocketReq(true);
      document.getElementById('idKantong').value = '';
      document.getElementById('kategori').value = '';
      document.getElementById('nominal').value = '';
      document.getElementById('deskripsi').value = '';

      document.getElementById('transaksiForm').closest('.card').querySelector('h4').innerHTML = '<i class="fa-solid fa-pen-to-square text-primary me-2"></i>Catat Transaksi';
      document.getElementById('txSubmitBtn').className = "btn btn-primary w-100 py-2.5 fw-bold text-uppercase";
      document.getElementById('txSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Simpan Transaksi';
      document.getElementById('txCancelBtn').style.display = "none";
    }

    // Delete Transaction Inline
    function deleteTransaksiInline(timestamp) {
      const tx = listTransactions.find(t => t.timestamp === timestamp);
      if (!tx) return;

      const formatNominal = formatRupiah(tx.amount);
      const confirmMsg = "Apakah Anda yakin ingin menghapus transaksi '" + tx.category + "' (" + formatNominal + ")?\\n" +
                         "Tindakan ini akan menghapus permanen data di Google Sheets Anda.";

      if (confirm(confirmMsg)) {
        showLoading(true);
        google.script.run
          .withSuccessHandler(function(res) {
            alert(res.message || "Transaksi berhasil dihapus!");
            initData();
          })
          .withFailureHandler(function(err) {
            alert("Gagal menghapus transaksi: " + err.message);
            showLoading(false);
          })
          .deleteTransaksiByTimestamp(timestamp);
      }
    }

    // Form Submission for Transaksi
    function handleFormSubmit(event) {
      event.preventDefault();
      showLoading(true);

      const formData = {
        date: document.getElementById('tanggal').value,
        type: document.querySelector('input[name="tipe"]:checked').value,
        pocketId: document.getElementById('idKantong').value,
        category: document.getElementById('kategori').value,
        amount: parseFloat(document.getElementById('nominal').value),
        description: document.getElementById('deskripsi').value
      };

      if (txEditingTimestamp) {
        google.script.run
          .withSuccessHandler(function(res) {
            alert(res.message || "Transaksi berhasil diperbarui!");
            cancelTxEdit();
            initData();
          })
          .withFailureHandler(function(err) {
            alert("Gagal memperbarui transaksi: " + err.message);
            showLoading(false);
          })
          .updateTransaksi(txEditingTimestamp, formData);
      } else {
        google.script.run
          .withSuccessHandler(function(res) {
            alert(res.message);
            // Clear inputs
            document.getElementById('kategori').value = '';
            document.getElementById('nominal').value = '';
            document.getElementById('deskripsi').value = '';
            
            // Re-fetch
            initData();
          })
          .withFailureHandler(function(err) {
            alert("Gagal menyimpan transaksi: " + err.message);
            showLoading(false);
          })
          .simpanTransaksi(formData);
      }
    }

    // Form Submission for New Pocket / Edit Pocket
    function handleKantongSubmit(event) {
      event.preventDefault();
      showLoading(true);

      const id = document.getElementById('newKantongId').value.toUpperCase().trim();
      const name = document.getElementById('newKantongName').value.trim();
      const target = parseFloat(document.getElementById('newKantongTarget').value);

      const updatedData = {
        id: id,
        name: name,
        saldoAwal: target
      };

      if (pocketEditingId) {
        google.script.run
          .withSuccessHandler(function(res) {
            alert(res.message || "Kantong berhasil diperbarui!");
            cancelPocketEdit();
            initData();
          })
          .withFailureHandler(function(err) {
            alert("Gagal merubah kantong: " + err.message);
            showLoading(false);
          })
          .updateKantong(pocketEditingId, updatedData);
      } else {
        if (listPockets.some(p => p.id === id)) {
          alert("ID Kantong sudah terpakai!");
          showLoading(false);
          return;
        }

        google.script.run
          .withSuccessHandler(function(res) {
            alert(res.message);
            // Clear form
            document.getElementById('newKantongId').value = '';
            document.getElementById('newKantongName').value = '';
            document.getElementById('newKantongTarget').value = '';
            
            // Refresh
            initData();
          })
          .withFailureHandler(function(err) {
            alert("Gagal membuat kantong baru: " + err.message);
            showLoading(false);
          })
          .tambahKantongBaru(id, name, target);
      }
    }
  </script>
</body>
</html>
`;

  const copyToClipboard = (text: string, type: 'gs' | 'html') => {
    navigator.clipboard.writeText(text);
    if (type === 'gs') {
      setCopiedCodeGs(true);
      setTimeout(() => setCopiedCodeGs(false), 2000);
    } else {
      setCopiedIndexHtml(true);
      setTimeout(() => setCopiedIndexHtml(false), 2000);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="exporter-root">
      
      {/* Intro Header */}
      <div className="bg-natural-brand-dark text-[#f8f7f2] rounded-[32px] p-8 relative overflow-hidden shadow-md border border-natural-brand/10" id="exporter-header">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <FileCode size={180} />
        </div>
        <div className="max-w-3xl relative z-10 space-y-4">
          <span className="bg-natural-brand/30 text-[#e6e3d8] font-semibold px-4 py-1 rounded-full text-xs uppercase tracking-wider">
            Apps Script Exporter
          </span>
          <h2 className="text-3xl font-bold font-serif italic tracking-tight">Sistem Anggaran Google Sheets Mandiri</h2>
          <p className="text-natural-soft leading-relaxed text-sm md:text-base opacity-90">
            Gunakan kode di bawah ini untuk meng-host <strong>Personal Finance & Envelope Budgeting System</strong> ini secara mandiri langsung di dalam Google Sheets Anda sendiri! Hasilnya adalah sebuah Web App mandiri yang berjalan gratis di Google Cloud infrastruktur Anda.
          </p>
        </div>
      </div>

      {/* Grid of Steps & Code */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="exporter-grid">
        
        {/* Step-by-Step Instructions */}
        <div className="lg:col-span-1 space-y-6" id="instructions-column">
          <div className="bg-white rounded-[32px] p-6 shadow-xs border border-natural-border">
            <h3 className="text-lg font-bold text-natural-brand-dark font-serif italic mb-4 flex items-center gap-2">
              <Terminal size={20} className="text-natural-brand" />
              Langkah-Langkah Panduan
            </h3>

            <div className="space-y-6 relative border-l border-natural-border pl-4 ml-2">
              {/* Step 1 */}
              <div className="relative">
                <div className="absolute -left-6.5 top-0.5 bg-natural-brand text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
                  1
                </div>
                <h4 className="font-semibold text-natural-brand-dark text-sm">Buka Spreadsheet</h4>
                <p className="text-xs text-natural-muted mt-1 leading-relaxed">
                  Buat atau buka Google Sheet baru yang ingin Anda jadikan database keuangan.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="absolute -left-6.5 top-0.5 bg-natural-brand text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
                  2
                </div>
                <h4 className="font-semibold text-natural-brand-dark text-sm">Buka Editor Apps Script</h4>
                <p className="text-xs text-natural-muted mt-1 leading-relaxed">
                  Klik menu <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong> di bilah navigasi atas Spreadsheet Anda.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="absolute -left-6.5 top-0.5 bg-natural-brand text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
                  3
                </div>
                <h4 className="font-semibold text-natural-brand-dark text-sm">Terapkan Code.gs</h4>
                <p className="text-xs text-natural-muted mt-1 leading-relaxed">
                  Hapus semua kode bawaan di dalam file <code>Code.gs</code>, lalu salin dan tempelkan blok kode <strong>Code.gs</strong> dari panel sebelah kanan.
                </p>
              </div>

              {/* Step 4 */}
              <div className="relative">
                <div className="absolute -left-6.5 top-0.5 bg-natural-brand text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
                  4
                </div>
                <h4 className="font-semibold text-natural-brand-dark text-sm">Buat file Index.html</h4>
                <p className="text-xs text-natural-muted mt-1 leading-relaxed">
                  Klik tombol <strong>+</strong> di sebelah file di sebelah kiri Apps Script, pilih <strong>HTML</strong>, beri nama <strong>Index</strong> (tanpa ekstensi .html), hapus isinya dan tempelkan blok kode <strong>Index.html</strong>.
                </p>
              </div>

              {/* Step 5 */}
              <div className="relative">
                <div className="absolute -left-6.5 top-0.5 bg-natural-brand text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
                  5
                </div>
                <h4 className="font-semibold text-natural-brand-dark text-sm">Inisialisasi Sistem (Wajib)</h4>
                <p className="text-xs text-natural-muted mt-1 leading-relaxed">
                  Pada bilah menu Apps Script, pilih fungsi <code>setupSystem</code> dari menu dropdown, lalu klik tombol <strong>Run (Jalankan)</strong>. Google akan meminta otorisasi. Klik setujui/izinkan semua permintaan akses.
                </p>
              </div>

              {/* Step 6 */}
              <div className="relative">
                <div className="absolute -left-6.5 top-0.5 bg-natural-brand text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
                  6
                </div>
                <h4 className="font-semibold text-natural-brand-dark text-sm">Deploy Web App</h4>
                <p className="text-xs text-natural-muted mt-1 leading-relaxed">
                  Klik tombol biru <strong>Deploy</strong> &gt; <strong>New Deployment</strong>. Pilih jenis <strong>Web App (Aplikasi Web)</strong>. Setel 'Who has access' menjadi <strong>Anyone (Siapa saja)</strong> atau <strong>Only myself (Hanya saya)</strong>, klik Deploy, lalu buka URL yang disediakan!
                </p>
              </div>
            </div>
          </div>

          <div className="bg-natural-soft rounded-2xl p-5 border border-natural-border flex gap-3 text-natural-brand-dark text-xs leading-relaxed">
            <HelpCircle size={28} className="text-natural-brand shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block mb-1">Pentingnya fungsi setupSystem()</strong>
              Fungsi ini bertindak sebagai pembangun database otomatis. Dia membuat lembar kerja <strong>Transaksi</strong> dan <strong>Kantong</strong> dengan baris header dan formula <code>SUMIF</code> dinamis. Anda wajib menjalankannya satu kali sebelum membuka link Web App Anda.
            </div>
          </div>
        </div>

        {/* Code Viewers */}
        <div className="lg:col-span-2 space-y-8" id="code-panel">
          
          {/* Code.gs Codeblock */}
          <div className="bg-white rounded-[32px] shadow-xs border border-natural-border overflow-hidden" id="gs-panel">
            <div className="bg-natural-soft border-b border-natural-border px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="bg-[#e6e3d8] text-natural-brand-dark font-bold px-2.5 py-1 rounded-md text-xs">
                  GS
                </span>
                <span className="font-semibold text-natural-brand-dark text-sm">Code.gs (Apps Script Backend)</span>
              </div>
              <button
                onClick={() => copyToClipboard(codeGsContent, 'gs')}
                className="flex items-center gap-1.5 text-xs text-natural-muted hover:text-natural-brand border border-natural-border hover:border-natural-brand bg-white px-3 py-1.5 rounded-full shadow-xs transition cursor-pointer"
              >
                {copiedCodeGs ? (
                  <>
                    <Check size={14} className="text-[#3b7a57]" />
                    <span className="text-[#3b7a57] font-medium">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-0">
              <pre className="text-xs font-mono overflow-x-auto max-h-96 p-6 bg-[#1f1d1a] text-[#edebe6] leading-relaxed rounded-b-[32px]">
                <code>{codeGsContent}</code>
              </pre>
            </div>
          </div>

          {/* Index.html Codeblock */}
          <div className="bg-white rounded-[32px] shadow-xs border border-natural-border overflow-hidden" id="html-panel">
            <div className="bg-natural-soft border-b border-natural-border px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="bg-[#faf1eb] text-natural-rust font-bold px-2 py-1 rounded-md text-xs">
                  HTML
                </span>
                <span className="font-semibold text-natural-brand-dark text-sm">Index.html (Frontend Responsive UI)</span>
              </div>
              <button
                onClick={() => copyToClipboard(indexHtmlContent, 'html')}
                className="flex items-center gap-1.5 text-xs text-natural-muted hover:text-natural-brand border border-natural-border hover:border-natural-brand bg-white px-3 py-1.5 rounded-full shadow-xs transition cursor-pointer"
              >
                {copiedIndexHtml ? (
                  <>
                    <Check size={14} className="text-[#3b7a57]" />
                    <span className="text-[#3b7a57] font-medium">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-0">
              <pre className="text-xs font-mono overflow-x-auto max-h-96 p-6 bg-[#1f1d1a] text-[#edebe6] leading-relaxed rounded-b-[32px]">
                <code>{indexHtmlContent}</code>
              </pre>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
