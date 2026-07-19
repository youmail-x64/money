import React, { useState, useEffect } from 'react';
import { 
  initAuth, googleSignIn, logout, getAccessToken 
} from './auth';
import { 
  listSpreadsheets, createSpreadsheet, setupSystem, 
  fetchPockets, fetchTransactions, addPocket, saveTransaction,
  updatePocket, deletePocketById, updateTransaction, deleteTransactionByTimestamp,
  Pocket, Transaction 
} from './googleSheetsService';
import BudgetDashboard from './components/BudgetDashboard';
import TransactionForm from './components/TransactionForm';
import PocketForm from './components/PocketForm';
import AppsScriptExporter from './components/AppsScriptExporter';
import { User } from 'firebase/auth';
import { 
  Wallet, FileSpreadsheet, Plus, HelpCircle, LogOut, ArrowRight, 
  RefreshCw, Layers, CheckCircle2, AlertCircle, Info, ShieldCheck
} from 'lucide-react';

export default function App() {
  // Authentication state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    const saved = localStorage.getItem('g_remember_me');
    return saved !== 'false'; // default to true
  });
  const [sessionTimeLeft, setSessionTimeLeft] = useState<string>('');

  // Spreadsheet selector states
  const [spreadsheetsList, setSpreadsheetsList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>('');
  const [isCreatingNewSheet, setIsCreatingNewSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState('Personal Finance & Budgeting');
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

  // Core business data
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isInitializingSystem, setIsInitializingSystem] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [sysStatusMsg, setSysStatusMsg] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'script-exporter'>('dashboard');

  // Modals Toggles & Edit Target states
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddPocket, setShowAddPocket] = useState(false);
  const [pocketToEdit, setPocketToEdit] = useState<Pocket | undefined>(undefined);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | undefined>(undefined);

  // General alert messages
  const [globalError, setGlobalError] = useState('');

  // 1. Listen for user auth status change on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        loadSpreadsheetOptions(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // 1b. Session expiry timer effect
  useEffect(() => {
    if (!token) {
      setSessionTimeLeft('');
      return;
    }

    const updateTimer = () => {
      const expiresAtStr = localStorage.getItem('g_token_expires_at');
      if (!expiresAtStr) {
        setSessionTimeLeft('');
        return;
      }
      const expiresAt = parseInt(expiresAtStr, 10);
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setSessionTimeLeft('Sesi Kedaluwarsa');
        // Clear auth since token expired
        handleLogout();
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        if (mins > 0) {
          setSessionTimeLeft(`Sisa sesi: ${mins}m`);
        } else {
          setSessionTimeLeft(`Sisa sesi: ${secs}d`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [token]);

  // 2. Fetch list of sheets from Drive when logged in
  const loadSpreadsheetOptions = async (accessToken: string) => {
    setIsLoadingSheets(true);
    setGlobalError('');
    try {
      const sheets = await listSpreadsheets(accessToken);
      setSpreadsheetsList(sheets);
      
      // Auto-select spreadsheet from localStorage if stored and still in list
      const savedId = localStorage.getItem('budget_spreadsheet_id');
      if (savedId && sheets.some(s => s.id === savedId)) {
        setSelectedSpreadsheetId(savedId);
      }
    } catch (err: any) {
      console.error(err);
      setGlobalError('Gagal mengambil daftar Google Sheets dari Drive Anda. Coba segarkan halaman.');
    } finally {
      setIsLoadingSheets(false);
    }
  };

  // 3. User logs in manually
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setGlobalError('');
    try {
      const result = await googleSignIn(rememberMe);
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        await loadSpreadsheetOptions(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setGlobalError('Gagal masuk menggunakan Google Account.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 4. User logs out
  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setSelectedSpreadsheetId('');
      setSpreadsheetsList([]);
      setPockets([]);
      setTransactions([]);
      localStorage.removeItem('budget_spreadsheet_id');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // 5. Create new spreadsheet
  const handleCreateNewSpreadsheet = async () => {
    if (!token || !newSheetName.trim()) return;
    setIsCreatingNewSheet(true);
    setGlobalError('');
    try {
      const newId = await createSpreadsheet(token, newSheetName.trim());
      await loadSpreadsheetOptions(token);
      setSelectedSpreadsheetId(newId);
      localStorage.setItem('budget_spreadsheet_id', newId);
    } catch (err: any) {
      setGlobalError(err.message || 'Gagal membuat Google Sheet baru.');
    } finally {
      setIsCreatingNewSheet(false);
    }
  };

  // 6. Monitor active spreadsheet and setup/load database
  useEffect(() => {
    if (selectedSpreadsheetId && token) {
      localStorage.setItem('budget_spreadsheet_id', selectedSpreadsheetId);
      initializeAndLoadSystem();
    }
  }, [selectedSpreadsheetId, token]);

  const initializeAndLoadSystem = async () => {
    if (!token || !selectedSpreadsheetId) return;
    setIsInitializingSystem(true);
    setIsLoadingData(true);
    setGlobalError('');
    setSysStatusMsg('Sedang memverifikasi tabel & inisialisasi basis data di Google Sheets...');
    
    try {
      // Setup sheets structures & write defaults if empty
      await setupSystem(token, selectedSpreadsheetId);
      setSysStatusMsg('Memuat data kantong dan riwayat transaksi...');
      
      await loadFinancialData(token, selectedSpreadsheetId);
    } catch (err: any) {
      console.error(err);
      setGlobalError('Gagal menyiapkan lembar kerja. Pastikan Anda memiliki hak akses penuh ke file terpilih.');
    } finally {
      setIsInitializingSystem(false);
      setIsLoadingData(false);
    }
  };

  // 7. Core loader to fetch pockets & transactions
  const loadFinancialData = async (accessToken: string, sheetId: string) => {
    try {
      const fetchedPockets = await fetchPockets(accessToken, sheetId);
      const fetchedTx = await fetchTransactions(accessToken, sheetId);
      
      setPockets(fetchedPockets);
      setTransactions(fetchedTx);
    } catch (err) {
      console.error('Failed to load financial data:', err);
      setGlobalError('Gagal sinkronisasi data dari Google Sheets.');
    }
  };

  // 8. Submit new or updated transaction
  const handleSaveTransactionSubmit = async (
    formData: {
      date: string;
      type: 'Masuk' | 'Keluar';
      category: string;
      amount: number;
      description: string;
      pocketId: string;
    },
    originalTimestamp?: string
  ) => {
    if (!token || !selectedSpreadsheetId) return;
    try {
      if (originalTimestamp) {
        await updateTransaction(token, selectedSpreadsheetId, originalTimestamp, formData);
      } else {
        await saveTransaction(token, selectedSpreadsheetId, formData);
      }
      
      // Wait shortly for Sheets formulas to compute, then refresh
      setTimeout(async () => {
        await loadFinancialData(token, selectedSpreadsheetId);
      }, 800);
    } catch (err: any) {
      throw new Error(err.message || 'Gagal menyimpan transaksi.');
    }
  };

  // 9. Submit new or updated pocket
  const handleSavePocketSubmit = async (id: string, name: string, saldoAwal: number) => {
    if (!token || !selectedSpreadsheetId) return;
    try {
      if (pocketToEdit) {
        await updatePocket(token, selectedSpreadsheetId, pocketToEdit.id, { id, name, saldoAwal });
      } else {
        // Row index is 1 (header) + number of existing pockets + 1 (new row)
        const rowCount = pockets.length + 2; 
        await addPocket(token, selectedSpreadsheetId, id, name, saldoAwal, rowCount);
      }
      // Refresh
      await loadFinancialData(token, selectedSpreadsheetId);
    } catch (err: any) {
      throw new Error(err.message || 'Gagal menyimpan kantong.');
    }
  };

  // 10. Delete Pocket
  const handleDeletePocket = async (pocketId: string) => {
    if (!token || !selectedSpreadsheetId) return;
    try {
      setIsLoadingData(true);
      await deletePocketById(token, selectedSpreadsheetId, pocketId);
      await loadFinancialData(token, selectedSpreadsheetId);
    } catch (err: any) {
      setGlobalError(err.message || 'Gagal menghapus kantong.');
    } finally {
      setIsLoadingData(false);
    }
  };

  // 11. Delete Transaction
  const handleDeleteTransaction = async (timestamp: string) => {
    if (!token || !selectedSpreadsheetId) return;
    try {
      setIsLoadingData(true);
      await deleteTransactionByTimestamp(token, selectedSpreadsheetId, timestamp);
      
      // Wait shortly for Sheets formulas to compute, then refresh
      setTimeout(async () => {
        await loadFinancialData(token, selectedSpreadsheetId);
        setIsLoadingData(false);
      }, 800);
    } catch (err: any) {
      setGlobalError(err.message || 'Gagal menghapus transaksi.');
      setIsLoadingData(false);
    }
  };

  // Opening modals with Edit Target
  const handleOpenEditPocket = (pocket: Pocket) => {
    setPocketToEdit(pocket);
    setShowAddPocket(true);
  };

  const handleOpenEditTransaction = (tx: Transaction) => {
    setTransactionToEdit(tx);
    setShowAddTransaction(true);
  };

  return (
    <div className="min-h-screen bg-natural-bg text-natural-text font-sans antialiased selection:bg-natural-soft selection:text-natural-brand-dark flex flex-col justify-between" id="app-root">
      
      {/* HEADER BAR */}
      <header className="bg-white border-b border-natural-border-light sticky top-0 z-40 shadow-xs" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-natural-brand rounded-full flex items-center justify-center text-white">
              <Wallet size={20} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold italic tracking-tight font-serif text-natural-brand-dark">
                Pundi Budgeting
              </h1>
              <p className="text-[9px] text-natural-muted font-bold uppercase tracking-wider">Envelope Budgeting System</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {user && (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-[9px] uppercase tracking-widest text-natural-muted font-bold">Status Sistem</span>
                  <span className="text-xs text-natural-brand flex items-center gap-1 font-semibold justify-end">
                    <span className="w-2 h-2 bg-natural-brand rounded-full"></span> Terhubung Sheets
                  </span>
                  {sessionTimeLeft && (
                    <span className="text-[10px] text-natural-muted font-medium mt-0.5" title="Sisa durasi akses Google API sebelum perlu login ulang">
                      {sessionTimeLeft}
                    </span>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-natural-border-light">
                  <img 
                    src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'} 
                    alt="Avatar" 
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full border border-natural-brand shadow-xs" 
                  />
                  <div className="text-left leading-none">
                    <span className="text-xs font-bold text-natural-brand-dark block">{user.displayName}</span>
                    <span className="text-[9px] text-natural-muted">{user.email}</span>
                  </div>
                </div>
                
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs font-bold text-natural-rust hover:text-red-700 bg-natural-rust/5 hover:bg-natural-rust/10 border border-natural-rust/20 px-4 py-2 rounded-full transition"
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* GLOBAL ERROR ALERTS */}
      {globalError && (
        <div className="bg-[#faf1eb] border-l-4 border-natural-rust text-natural-brand-dark px-6 py-4 text-xs font-medium flex items-center justify-between gap-3 max-w-7xl mx-auto w-full mt-6 rounded-2xl shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-natural-rust shrink-0" />
            <span>{globalError}</span>
          </div>
          <button onClick={() => setGlobalError('')} className="text-natural-muted hover:text-natural-brand-dark font-bold px-2">
            ×
          </button>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {needsAuth ? (
          /* LANDING PAGE SIGN-IN VIEW */
          <div className="max-w-4xl mx-auto py-12 md:py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center" id="landing-container">
            
            {/* Visual description */}
            <div className="space-y-6" id="landing-promo">
              <span className="bg-natural-soft text-natural-brand border border-natural-border font-bold px-4 py-1 rounded-full text-[10px] uppercase tracking-wider inline-block">
                Sistem Anggaran Cerdas
              </span>
              <h2 className="text-3xl sm:text-5xl font-serif text-natural-brand-dark tracking-tight leading-tight italic">
                Kelola Anggaran Keuangan Anda Menggunakan Google Sheets!
              </h2>
              <p className="text-natural-muted leading-relaxed text-sm">
                Sistem Anggaran Amplop (Envelope Budgeting) yang modern dan tangguh. Aplikasi ini menyimpan seluruh rincian transaksi serta anggaran kantong pos-belanja Anda secara aman dan real-time di Spreadsheet Google milik Anda sendiri.
              </p>

              <div className="space-y-4 pt-2" id="promo-points">
                <div className="flex gap-3 text-xs text-natural-text">
                  <CheckCircle2 size={18} className="text-natural-brand shrink-0 mt-0.5" />
                  <span><strong>Keamanan Penuh</strong>: Seluruh dana, riwayat pengeluaran, dan kantong anggaran Anda 100% tersimpan di Google Drive pribadi.</span>
                </div>
                <div className="flex gap-3 text-xs text-natural-text">
                  <CheckCircle2 size={18} className="text-natural-brand shrink-0 mt-0.5" />
                  <span><strong>Envelope Budgeting</strong>: Batasi pengeluaran per pos (makan, transportasi, tagihan) agar keuangan tetap sehat.</span>
                </div>
                <div className="flex gap-3 text-xs text-natural-text">
                  <CheckCircle2 size={18} className="text-natural-brand shrink-0 mt-0.5" />
                  <span><strong>Ekspor Apps Script Mandiri</strong>: Kami menyediakan generator kode Code.gs dan Index.html agar Anda bisa meng-host-nya sendiri langsung di Google Sheets.</span>
                </div>
              </div>
            </div>

            {/* Login Card */}
            <div className="bg-white rounded-[32px] p-8 border border-natural-border shadow-md space-y-6 text-center" id="login-card">
              <div className="bg-[#f8f7f2] p-4 rounded-full inline-block text-natural-brand mx-auto">
                <Wallet size={36} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif text-natural-brand-dark font-semibold">Mulai Kelola Finansial</h3>
                <p className="text-xs text-natural-muted">Hubungkan Google Sheets & Google Drive Anda dengan permission penuh untuk mengaktifkan sistem database budgeting.</p>
              </div>

              {/* GSI BUTTON STYLE */}
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button w-full flex items-center justify-center cursor-pointer border border-natural-border rounded-xl hover:bg-[#f8f7f2] transition py-1 px-4 shadow-xs"
                id="gsi-signin"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper flex items-center gap-3">
                  <div className="gsi-material-button-icon py-2">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '20px', height: '20px' }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents font-bold text-natural-text text-xs">Sign in with Google</span>
                </div>
              </button>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between text-xs text-natural-muted px-1" id="remember-me-container">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setRememberMe(val);
                      localStorage.setItem('g_remember_me', val ? 'true' : 'false');
                    }}
                    className="w-4 h-4 rounded border-natural-border text-natural-brand focus:ring-natural-soft focus:ring-opacity-50"
                  />
                  <span>Ingat saya (Simpan sesi 1 jam)</span>
                </label>
                
                <span className="text-[10px] text-natural-muted">Sesi berakhir otomatis</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-natural-brand bg-natural-soft p-3 rounded-xl border border-natural-border">
                <ShieldCheck size={14} className="text-natural-brand" />
                <span>Otorisasi aman, langsung dikelola oleh Google Firebase Auth.</span>
              </div>
            </div>

          </div>
        ) : (
          /* AUTHENTICATED WORKSPACE */
          <div className="space-y-8" id="auth-workspace">
            
            {/* 1. SPREADSHEET BACKEND SELECTION DRAWER */}
            <div className="bg-white rounded-[32px] p-6 border border-natural-border shadow-xs space-y-4" id="spreadsheet-selector">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#f8f7f2] text-natural-brand rounded-full shrink-0">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-natural-brand-dark text-base">Database Keuangan: Google Sheet Anda</h3>
                    <p className="text-[10px] text-natural-muted font-medium">Pilih lembar kerja Google Sheets di Drive Anda yang akan digunakan sebagai basis penyimpanan data.</p>
                  </div>
                </div>

                {/* Spreadsheet Dropdown or Create Input */}
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  {isLoadingSheets ? (
                    <div className="flex items-center gap-2 text-xs text-natural-muted">
                      <RefreshCw size={12} className="animate-spin text-natural-brand" />
                      <span>Memuat Spreadsheet...</span>
                    </div>
                  ) : (
                    <>
                      {/* Selection dropdown */}
                      <select
                        value={selectedSpreadsheetId}
                        onChange={(e) => setSelectedSpreadsheetId(e.target.value)}
                        className="bg-[#f8f7f2] border border-natural-border rounded-xl px-4 py-2 text-xs text-natural-brand-dark font-medium focus:outline-none focus:ring-1 focus:ring-natural-brand"
                        id="sheet-dropdown"
                      >
                        <option value="" disabled>-- Pilih Spreadsheet --</option>
                        {spreadsheetsList.map(sheet => (
                          <option key={sheet.id} value={sheet.id}>
                            {sheet.name}
                          </option>
                        ))}
                      </select>

                      <span className="text-natural-border text-xs hidden sm:inline">|</span>

                      {/* Manual Sheet Creation section */}
                      <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        <input
                          type="text"
                          value={newSheetName}
                          onChange={(e) => setNewSheetName(e.target.value)}
                          placeholder="Nama spreadsheet baru"
                          className="px-3 py-2 bg-[#f8f7f2] border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-brand w-full sm:w-48"
                        />
                        <button
                          onClick={handleCreateNewSpreadsheet}
                          disabled={isCreatingNewSheet || !newSheetName.trim()}
                          className="flex items-center gap-1 text-xs font-bold text-white bg-natural-brand hover:bg-natural-brand-dark px-4 py-2 rounded-xl shadow-xs transition shrink-0"
                        >
                          {isCreatingNewSheet ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <Plus size={12} />
                          )}
                          <span>Buat</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 2. LOADING DATABASE OR SYSTEM INITIALIZATION */}
            {isInitializingSystem || isLoadingData ? (
              <div className="bg-white rounded-[32px] p-16 border border-natural-border shadow-sm flex flex-col items-center justify-center space-y-4 text-center">
                <RefreshCw size={40} className="text-natural-brand animate-spin" />
                <div className="space-y-1">
                  <h4 className="font-serif font-bold text-natural-brand-dark text-lg">Sinkronisasi Database</h4>
                  <p className="text-xs text-natural-muted max-w-sm">{sysStatusMsg}</p>
                </div>
              </div>
            ) : selectedSpreadsheetId ? (
              /* SYSTEM IS FULLY CONFIGURED & CONNECTED */
              <div className="space-y-8" id="connected-workspace">
                
                {/* Tab Navigation Navigation */}
                <div className="flex border-b border-natural-border-light" id="tabs-bar">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 transition ${
                      activeTab === 'dashboard' 
                        ? 'border-natural-brand text-natural-brand font-serif italic' 
                        : 'border-transparent text-natural-muted hover:text-natural-brand-dark'
                    }`}
                  >
                    Dashboard Anggaran
                  </button>
                  <button
                    onClick={() => setActiveTab('script-exporter')}
                    className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 transition ${
                      activeTab === 'script-exporter' 
                        ? 'border-natural-brand text-natural-brand font-serif italic' 
                        : 'border-transparent text-natural-muted hover:text-natural-brand-dark'
                    }`}
                  >
                    Google Apps Script Exporter
                  </button>
                </div>

                {/* Active Tab View Rendering */}
                {activeTab === 'dashboard' ? (
                  <BudgetDashboard
                    pockets={pockets}
                    transactions={transactions}
                    onRefresh={initializeAndLoadSystem}
                    onOpenAddTransaction={() => {
                      setTransactionToEdit(undefined);
                      setShowAddTransaction(true);
                    }}
                    onOpenAddPocket={() => {
                      setPocketToEdit(undefined);
                      setShowAddPocket(true);
                    }}
                    onEditPocket={handleOpenEditPocket}
                    onDeletePocket={handleDeletePocket}
                    onEditTransaction={handleOpenEditTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                  />
                ) : (
                  <AppsScriptExporter />
                )}

              </div>
            ) : (
              /* LANDING FOR LOGGED IN BUT SPREADSHEET NOT CHOSEN */
              <div className="bg-white rounded-[32px] p-12 border border-natural-border shadow-sm text-center max-w-xl mx-auto space-y-6" id="select-sheet-callout">
                <div className="bg-natural-soft text-natural-brand p-4 rounded-full inline-block">
                  <FileSpreadsheet size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-serif font-bold text-natural-brand-dark">Langkah Terakhir: Pilih Lembar Database</h3>
                  <p className="text-xs text-natural-muted leading-relaxed">
                    Kami membutuhkan sebuah file Spreadsheet di Google Drive Anda untuk digunakan sebagai wadah database tabel keuangan. Anda dapat memilih spreadsheet yang sudah ada pada menu di atas, atau mengetikkan nama di input "Buat" lalu klik tombol untuk membuat lembar baru secara otomatis.
                  </p>
                </div>
                
                <div className="bg-[#faf7f0] p-3.5 rounded-xl border border-natural-border text-natural-brand-dark text-[10px] text-left flex gap-2.5 leading-relaxed">
                  <Info size={18} className="shrink-0 text-natural-brand" />
                  <span>
                    Aplikasi ini hanya akan mengakses file spreadsheet yang Anda pilih atau file yang dibuat oleh aplikasi ini sendiri demi menjaga kerahasiaan berkas-berkas Anda yang lain.
                  </span>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-natural-brand-dark border-t border-natural-brand text-natural-soft py-6 text-center text-xs" id="main-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-1">
          <p className="font-serif italic text-sm">Pundi Budgeting System v2.1</p>
          <p className="text-[10px] text-natural-muted font-medium">Tersambung dengan Google Sheets & Drive API • Powered by Google Apps Script</p>
        </div>
      </footer>

      {/* MODALS */}
      {showAddTransaction && (
        <TransactionForm
          pockets={pockets}
          transactionToEdit={transactionToEdit}
          onClose={() => {
            setShowAddTransaction(false);
            setTransactionToEdit(undefined);
          }}
          onSubmit={handleSaveTransactionSubmit}
        />
      )}

      {showAddPocket && (
        <PocketForm
          existingPockets={pockets}
          pocketToEdit={pocketToEdit}
          onClose={() => {
            setShowAddPocket(false);
            setPocketToEdit(undefined);
          }}
          onSubmit={handleSavePocketSubmit}
        />
      )}

    </div>
  );
}
