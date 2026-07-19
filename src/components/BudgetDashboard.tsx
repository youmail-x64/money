import React, { useState, useMemo } from 'react';
import { Pocket, Transaction } from '../googleSheetsService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Wallet, TrendingUp, TrendingDown, Layers, Search, Filter, AlertTriangle, 
  ArrowUpRight, ArrowDownLeft, FileText, Calendar, Plus, RefreshCw, Edit2, Trash2 
} from 'lucide-react';

interface BudgetDashboardProps {
  pockets: Pocket[];
  transactions: Transaction[];
  onRefresh: () => void;
  onOpenAddTransaction: () => void;
  onOpenAddPocket: () => void;
  onEditPocket: (pocket: Pocket) => void;
  onDeletePocket: (pocketId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (timestamp: string) => void;
}

export default function BudgetDashboard({
  pockets,
  transactions,
  onRefresh,
  onOpenAddTransaction,
  onOpenAddPocket,
  onEditPocket,
  onDeletePocket,
  onEditTransaction,
  onDeleteTransaction
}: BudgetDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'Semua' | 'Masuk' | 'Keluar'>('Semua');
  const [pocketFilter, setPocketFilter] = useState<string>('Semua');
  const [pocketToDelete, setPocketToDelete] = useState<Pocket | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Format IDR Currency
  const formatIDR = (value: number) => {
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(absValue);
    return isNegative ? `-${formatted}` : formatted;
  };

  // 1. Calculate General Statistics
  const stats = useMemo(() => {
    let totalPemasukan = 0;
    let totalPengeluaran = 0;

    transactions.forEach(tx => {
      const amount = Math.abs(tx.amount);
      if (tx.type === 'Masuk') {
        totalPemasukan += amount;
      } else {
        totalPengeluaran += amount;
      }
    });

    // Total active balance is calculated by summing all pockets balances
    const totalSaldo = pockets.reduce((sum, p) => sum + p.balance, 0);

    return {
      totalSaldo,
      totalPemasukan,
      totalPengeluaran
    };
  }, [pockets, transactions]);

  // 2. Format Data for Bar Chart (Pocket initial balance vs current balance)
  const barChartData = useMemo(() => {
    return pockets.map(p => {
      return {
        nama: p.name,
        'Saldo Awal': p.saldoAwal,
        'Saldo Saat Ini': p.balance
      };
    });
  }, [pockets]);

  // 3. Format Data for Pie Chart (Category Distribution of Expenses)
  const pieChartData = useMemo(() => {
    const categories: Record<string, number> = {};
    transactions
      .filter(tx => tx.type === 'Keluar')
      .forEach(tx => {
        const cat = tx.category || 'Lain-lain';
        categories[cat] = (categories[cat] || 0) + Math.abs(tx.amount);
      });

    const colors = ['#5A5A40', '#3a3a2e', '#b87333', '#8c8a7e', '#D68C45', '#707050', '#a3a192', '#8B8C68'];
    
    return Object.entries(categories).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length]
    })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  // 4. Filter and search transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch = 
        tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = typeFilter === 'Semua' || tx.type === typeFilter;
      
      const matchesPocket = pocketFilter === 'Semua' || tx.pocketId === pocketFilter;

      return matchesSearch && matchesType && matchesPocket;
    });
  }, [transactions, searchQuery, typeFilter, pocketFilter]);

  return (
    <div className="space-y-8 animate-fadeIn" id="dashboard-root">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" id="dashboard-header">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-natural-brand-dark font-serif italic tracking-tight">Ringkasan Anggaran Anda</h2>
          <p className="text-sm text-natural-muted">Pantau seluruh kantong belanja dan mutasi keuangan secara real-time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={onRefresh}
            className="flex items-center gap-2 text-xs font-bold text-natural-brand-dark bg-white border border-natural-border hover:bg-natural-soft px-4.5 py-2.5 rounded-full shadow-xs transition cursor-pointer"
          >
            <RefreshCw size={14} className="text-natural-brand" />
            Segarkan Data
          </button>
          <button
            onClick={onOpenAddPocket}
            className="flex items-center gap-2 text-xs font-bold text-natural-brand bg-natural-soft border border-natural-border hover:bg-natural-border/30 px-4.5 py-2.5 rounded-full transition cursor-pointer"
          >
            <Plus size={14} />
            Buat Kantong
          </button>
          <button
            onClick={onOpenAddTransaction}
            className="flex items-center gap-2 text-xs font-bold text-white bg-natural-brand hover:bg-natural-brand-dark px-5 py-2.5 rounded-full shadow-xs transition cursor-pointer"
          >
            <Plus size={14} />
            Catat Transaksi
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="dashboard-stats-cards">
        
        {/* Active Balance */}
        <div className="bg-white rounded-[32px] p-6 shadow-xs border border-natural-border flex items-center gap-4 relative overflow-hidden">
          <div className="p-3.5 bg-natural-soft text-natural-brand rounded-full">
            <Wallet size={24} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest block">Total Saldo Aktif</span>
            <span className="text-3xl font-bold font-serif text-natural-brand-dark block">{formatIDR(stats.totalSaldo)}</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-natural-brand/5 rounded-full translate-x-8 -translate-y-8" />
        </div>

        {/* Total Income */}
        <div className="bg-white rounded-[32px] p-6 shadow-xs border border-natural-border flex items-center gap-4 relative overflow-hidden">
          <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-full">
            <TrendingUp size={24} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest block">Total Pemasukan</span>
            <span className="text-3xl font-bold font-serif text-emerald-700 block">{formatIDR(stats.totalPemasukan)}</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/20 rounded-full translate-x-8 -translate-y-8" />
        </div>

        {/* Total Expenses */}
        <div className="bg-white rounded-[32px] p-6 shadow-xs border border-natural-border flex items-center gap-4 relative overflow-hidden">
          <div className="p-3.5 bg-[#faf1eb] text-natural-rust rounded-full">
            <TrendingDown size={24} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-natural-muted uppercase tracking-widest block">Total Pengeluaran</span>
            <span className="text-3xl font-bold font-serif text-natural-rust block">{formatIDR(stats.totalPengeluaran)}</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-natural-rust/5 rounded-full translate-x-8 -translate-y-8" />
        </div>

      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts">
        
        {/* Pocket Balance comparison */}
        <div className="lg:col-span-2 bg-white rounded-[32px] p-6 shadow-xs border border-natural-border space-y-4" id="limit-vs-usage">
          <h3 className="text-sm font-bold text-natural-brand-dark uppercase tracking-wider flex items-center gap-2 font-serif italic">
            <Layers size={16} className="text-natural-brand" />
            Perbandingan Saldo Kantong (Awal vs Saat Ini)
          </h3>
          <div className="h-64 md:h-80 w-full text-xs font-mono">
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ece9df" />
                  <XAxis dataKey="nama" stroke="#8c8a7e" />
                  <YAxis stroke="#8c8a7e" tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip 
                    formatter={(value) => formatIDR(Number(value))}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', color: '#2d2a26', border: '1px solid #ece9df' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="Saldo Awal" fill="#5A5A40" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Saldo Saat Ini" fill="#b87333" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-natural-muted text-sm font-sans">
                Belum ada data anggaran kantong.
              </div>
            )}
          </div>
        </div>

        {/* Category Expense Pie Chart */}
        <div className="bg-white rounded-[32px] p-6 shadow-xs border border-natural-border space-y-4 flex flex-col justify-between" id="expense-distribution">
          <div>
            <h3 className="text-sm font-bold text-natural-brand-dark uppercase tracking-wider flex items-center gap-2 font-serif italic">
              <TrendingDown size={16} className="text-natural-rust" />
              Distribusi Pengeluaran
            </h3>
            <p className="text-xs text-natural-muted mt-1">Pembagian pengeluaran Anda berdasarkan kategori.</p>
          </div>
          
          <div className="h-48 w-full flex items-center justify-center text-xs">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatIDR(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-natural-muted text-sm font-sans">
                Belum ada pengeluaran dicatat.
              </div>
            )}
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-32 text-xs" id="pie-legend">
            {pieChartData.slice(0, 4).map((entry, i) => (
              <div key={i} className="flex justify-between items-center text-natural-text">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                  <span className="truncate max-w-[120px] font-medium">{entry.name}</span>
                </div>
                <span className="font-semibold text-natural-brand-dark">{formatIDR(entry.value)}</span>
              </div>
            ))}
            {pieChartData.length > 4 && (
              <div className="text-center text-[10px] text-natural-muted pt-1">
                + {pieChartData.length - 4} Kategori Lainnya
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Pockets/Envelopes List */}
      <div className="space-y-4" id="pockets-grid-section">
        <h3 className="text-base font-bold text-natural-brand-dark uppercase tracking-wider flex items-center gap-2 font-serif italic">
          <Layers size={16} className="text-natural-brand" />
          Status Detail Kantong Anggaran
        </h3>

        {pockets.length === 0 ? (
          <div className="bg-white rounded-[32px] p-8 border border-natural-border text-center text-natural-muted">
            Belum ada kantong. Buat kantong baru di atas untuk memulai Envelope Budgeting.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="pockets-cards-grid">
            {pockets.map((p) => {
              const diff = p.balance - p.saldoAwal;
              const hasDiff = diff !== 0;
              const isPositiveDiff = diff > 0;

              return (
                <div key={p.id} className="bg-white rounded-[32px] p-6 shadow-2xs border border-natural-border space-y-4 hover:shadow-md transition relative group">
                  
                  {/* Actions (Edit / Delete) */}
                  <div className="absolute top-5 right-5 flex items-center gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition duration-200">
                    <button
                      onClick={() => onEditPocket(p)}
                      title="Ubah Kantong"
                      className="p-1.5 hover:bg-natural-soft text-natural-brand hover:text-natural-brand-dark rounded-full transition cursor-pointer border border-natural-border/30 bg-white"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => setPocketToDelete(p)}
                      title="Hapus Kantong"
                      className="p-1.5 hover:bg-red-50 text-natural-rust hover:text-red-700 rounded-full transition cursor-pointer border border-natural-border/30 bg-white"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Title & ID */}
                  <div>
                    <span className="font-bold text-natural-brand-dark text-base block font-serif italic pr-12 truncate">{p.name}</span>
                    <span className="text-[9px] font-bold text-natural-muted uppercase tracking-widest">Kantong: {p.id}</span>
                  </div>

                  {/* Financial amounts */}
                  <div className="space-y-3 pt-2.5 border-t border-natural-soft">
                    
                    {/* Current Balance */}
                    <div>
                      <span className="text-[9px] text-natural-muted block uppercase font-bold tracking-wider">Saldo Saat Ini</span>
                      <span className="text-2xl font-bold font-serif text-natural-brand-dark block">
                        {formatIDR(p.balance)}
                      </span>
                    </div>

                    {/* Initial Balance & Mutation */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-natural-soft/50">
                      <div>
                        <span className="text-[9px] text-natural-muted block uppercase font-bold tracking-wider">Saldo Awal</span>
                        <span className="text-xs font-bold text-natural-brand-dark block">
                          {formatIDR(p.saldoAwal)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-natural-muted block uppercase font-bold tracking-wider">Mutasi</span>
                        {hasDiff ? (
                          <span className={`text-xs font-bold block ${isPositiveDiff ? 'text-emerald-700' : 'text-natural-rust'}`}>
                            {isPositiveDiff ? '+' : ''}{formatIDR(diff)}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-natural-muted block">
                            Tetap
                          </span>
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Transactions History */}
      <div className="bg-white rounded-[32px] shadow-xs border border-natural-border overflow-hidden" id="dashboard-transactions-table">
        
        {/* Table Filters */}
        <div className="p-6 border-b border-natural-border-light space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-natural-brand-dark flex items-center gap-2 font-serif italic">
              <FileText size={18} className="text-natural-brand" />
              Riwayat Transaksi
            </h3>
            
            {/* Search */}
            <div className="relative max-w-sm w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-natural-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kategori atau deskripsi..."
                className="w-full pl-10 pr-4 py-2 bg-[#f8f7f2] border border-natural-border rounded-full text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-brand focus:border-natural-brand"
              />
            </div>
          </div>

          {/* Quick Filter buttons */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
            
            {/* Type filters */}
            <div className="flex bg-natural-bg border border-natural-border p-1 rounded-full">
              {(['Semua', 'Masuk', 'Keluar'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-4 py-1.5 rounded-full transition cursor-pointer ${
                    typeFilter === type 
                      ? 'bg-white text-natural-brand-dark shadow-xs font-serif italic' 
                      : 'text-natural-muted hover:text-natural-brand-dark'
                  }`}
                >
                  {type === 'Semua' ? 'Semua Tipe' : type}
                </button>
              ))}
            </div>

            {/* Pocket filters */}
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-natural-muted" />
              <select
                value={pocketFilter}
                onChange={(e) => setPocketFilter(e.target.value)}
                className="bg-[#f8f7f2] border border-natural-border rounded-full px-4 py-1.5 focus:outline-none text-xs text-natural-brand-dark font-medium cursor-pointer"
              >
                <option value="Semua">Semua Kantong</option>
                {pockets.map(p => (
                  <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Transactions Table view */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: '700px' }}>
            <thead>
              <tr className="bg-natural-soft text-[10px] font-bold text-natural-brand-dark uppercase tracking-wider border-b border-natural-border">
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Kantong</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Deskripsi</th>
                <th className="px-6 py-4 text-right">Nominal</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-natural-border-light text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-natural-muted font-medium">
                    Tidak ada transaksi yang cocok dengan pencarian Anda.
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, 100).map((tx, idx) => {
                  const matchingPocket = pockets.find(p => p.id === tx.pocketId);
                  const isIncoming = tx.type === 'Masuk';
                  
                  return (
                    <tr key={idx} className="hover:bg-natural-soft/30 transition">
                      
                      {/* Date */}
                      <td className="px-6 py-4.5 text-natural-muted font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-natural-muted shrink-0" />
                          <span>{tx.date}</span>
                        </div>
                      </td>

                      {/* Pocket */}
                      <td className="px-6 py-4.5">
                        <span className="inline-block bg-natural-soft text-natural-brand-dark font-bold px-2.5 py-1 rounded-full text-[9px] border border-natural-border">
                          {matchingPocket ? matchingPocket.name : tx.pocketId || 'Pemasukan Umum'}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4.5 text-natural-brand-dark font-bold">
                        {tx.category}
                      </td>

                      {/* Description */}
                      <td className="px-6 py-4.5 text-natural-muted italic max-w-xs truncate font-medium">
                        {tx.description}
                      </td>

                      {/* Amount */}
                      <td className={`px-6 py-4.5 text-right font-bold ${isIncoming ? 'text-emerald-700' : 'text-natural-rust'}`}>
                        <span className="flex items-center justify-end gap-1 font-mono">
                          {isIncoming ? (
                            <ArrowDownLeft size={14} className="shrink-0 text-emerald-600" />
                          ) : (
                            <ArrowUpRight size={14} className="shrink-0 text-natural-rust" />
                          )}
                          <span>{isIncoming ? '+' : ''}{formatIDR(tx.amount)}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            title="Ubah Transaksi"
                            className="p-1.5 hover:bg-natural-soft text-natural-brand rounded-full transition cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setTxToDelete(tx)}
                            title="Hapus Transaksi"
                            className="p-1.5 hover:bg-red-50 text-natural-rust rounded-full transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Info label */}
        <div className="p-4 bg-natural-soft border-t border-natural-border text-[10px] text-natural-muted flex justify-between items-center font-bold">
          <span>Menampilkan {filteredTransactions.length} transaksi</span>
          <span>Transaksi tersimpan di Google Sheet Anda secara aman</span>
        </div>

      </div>

      {/* Pocket Delete Confirmation Modal */}
      {pocketToDelete && (
        <div className="fixed inset-0 bg-[#2d2a26]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl border border-natural-border p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#faf1eb] text-natural-rust rounded-full shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-natural-brand-dark font-serif italic">Hapus Kantong Anggaran?</h4>
                <p className="text-xs text-natural-muted leading-relaxed">
                  Apakah Anda yakin ingin menghapus kantong <strong>{pocketToDelete.name} ({pocketToDelete.id})</strong>? 
                  Data transaksi yang saat ini mengacu ke kantong ini akan dilepas hubungannya secara aman. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPocketToDelete(null)}
                className="w-1/2 text-center py-2.5 border border-natural-border hover:bg-natural-soft text-natural-muted rounded-full text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeletePocket(pocketToDelete.id);
                  setPocketToDelete(null);
                }}
                className="w-1/2 text-center py-2.5 bg-natural-rust hover:bg-red-700 text-white rounded-full text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Hapus Kantong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Delete Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 bg-[#2d2a26]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl border border-natural-border p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#faf1eb] text-natural-rust rounded-full shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-natural-brand-dark font-serif italic">Hapus Transaksi Keuangan?</h4>
                <p className="text-xs text-natural-muted leading-relaxed">
                  Apakah Anda yakin ingin menghapus transaksi kategori <strong>{txToDelete.category}</strong> bernilai <strong>{formatIDR(txToDelete.amount)}</strong>? 
                  Tindakan ini akan menghapus baris transaksi secara permanen dari Google Sheets Anda.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTxToDelete(null)}
                className="w-1/2 text-center py-2.5 border border-natural-border hover:bg-natural-soft text-natural-muted rounded-full text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeleteTransaction(txToDelete.timestamp);
                  setTxToDelete(null);
                }}
                className="w-1/2 text-center py-2.5 bg-natural-rust hover:bg-red-700 text-white rounded-full text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Hapus Transaksi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
