import React, { useState, useEffect } from 'react';
import { Pocket, Transaction } from '../googleSheetsService';
import { Calendar, DollarSign, Tag, Info, ArrowUpRight, ArrowDownLeft, X, Check } from 'lucide-react';

interface TransactionFormProps {
  pockets: Pocket[];
  transactionToEdit?: Transaction;
  onSubmit: (
    formData: {
      date: string;
      type: 'Masuk' | 'Keluar';
      category: string;
      amount: number;
      description: string;
      pocketId: string;
    },
    originalTimestamp?: string
  ) => Promise<void>;
  onClose: () => void;
}

export default function TransactionForm({ pockets, transactionToEdit, onSubmit, onClose }: TransactionFormProps) {
  const [date, setDate] = useState('');
  const [type, setType] = useState<'Masuk' | 'Keluar'>('Keluar');
  const [pocketId, setPocketId] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Prepopulate if editing, otherwise set defaults
  useEffect(() => {
    if (transactionToEdit) {
      setDate(transactionToEdit.date);
      setType(transactionToEdit.type);
      setPocketId(transactionToEdit.pocketId || '');
      setCategory(transactionToEdit.category);
      setAmount(String(Math.abs(transactionToEdit.amount)));
      setDescription(transactionToEdit.description);
    } else {
      const today = new Date();
      const formatted = today.toISOString().substring(0, 10);
      setDate(formatted);
      setType('Keluar');
      setCategory('');
      setAmount('');
      setDescription('');
      if (pockets.length > 0) {
        setPocketId(pockets[0].id);
      } else {
        setPocketId('');
      }
    }
  }, [transactionToEdit, pockets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Nominal harus berupa angka yang valid dan lebih besar dari 0.');
      return;
    }

    if (!pocketId && type === 'Keluar') {
      setErrorMessage('Silakan pilih kantong anggaran untuk pengeluaran.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        date,
        type,
        category: category.trim(),
        amount: parsedAmount,
        description: description.trim(),
        pocketId: type === 'Masuk' ? pocketId : pocketId // pass pocketId as-is
      }, transactionToEdit?.timestamp);
      
      // Reset form
      setCategory('');
      setAmount('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditMode = !!transactionToEdit;

  return (
    <div className="fixed inset-0 bg-[#2d2a26]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="tx-form-backdrop">
      <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl border border-natural-border overflow-hidden flex flex-col" id="tx-form-container">
        
        {/* Header */}
        <div className="bg-natural-soft border-b border-natural-border px-6 py-5 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-natural-brand-dark font-serif italic">
              {isEditMode ? 'Ubah Transaksi Keuangan' : 'Catat Transaksi Keuangan'}
            </h3>
            <p className="text-xs text-natural-muted">
              {isEditMode ? 'Ubah rincian transaksi keuangan Anda di Google Sheets.' : 'Log transaksi masuk/keluar ke database Google Sheets Anda.'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-natural-border/40 text-natural-muted hover:text-natural-brand-dark rounded-full transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          
          {errorMessage && (
            <div className="bg-[#faf1eb] text-natural-rust p-3 rounded-xl text-xs border border-natural-rust/20 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-natural-muted uppercase tracking-wide flex items-center gap-1">
              <Calendar size={13} className="text-natural-muted" />
              Tanggal Transaksi
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border focus:outline-none focus:ring-1 focus:ring-natural-brand focus:border-natural-brand rounded-xl text-xs text-natural-text"
            />
          </div>

          {/* Type Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-natural-muted uppercase tracking-wide block">
              Tipe Transaksi
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Keluar */}
              <label className={`flex items-center justify-center gap-2 border px-4 py-3 rounded-xl cursor-pointer transition ${
                type === 'Keluar' 
                  ? 'border-natural-rust bg-[#faf1eb] text-natural-rust font-bold' 
                  : 'border-natural-border hover:bg-natural-soft text-natural-muted'
              }`}>
                <input
                  type="radio"
                  name="txType"
                  checked={type === 'Keluar'}
                  onChange={() => setType('Keluar')}
                  className="sr-only"
                />
                <ArrowUpRight size={16} className={type === 'Keluar' ? 'text-natural-rust' : 'text-natural-muted'} />
                <span className="text-xs">Pengeluaran (Keluar)</span>
              </label>

              {/* Masuk */}
              <label className={`flex items-center justify-center gap-2 border px-4 py-3 rounded-xl cursor-pointer transition ${
                type === 'Masuk' 
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-700 font-bold' 
                  : 'border-natural-border hover:bg-natural-soft text-natural-muted'
              }`}>
                <input
                  type="radio"
                  name="txType"
                  checked={type === 'Masuk'}
                  onChange={() => setType('Masuk')}
                  className="sr-only"
                />
                <ArrowDownLeft size={16} className={type === 'Masuk' ? 'text-emerald-700' : 'text-natural-muted'} />
                <span className="text-xs">Pemasukan (Masuk)</span>
              </label>
            </div>
          </div>

          {/* Pocket Dropdown Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-natural-muted uppercase tracking-wide block">
              Kantong Target Anggaran
            </label>
            <select
              value={pocketId}
              onChange={(e) => setPocketId(e.target.value)}
              required={type === 'Keluar'}
              className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border focus:outline-none focus:ring-1 focus:ring-natural-brand focus:border-natural-brand rounded-xl text-xs text-natural-brand-dark font-medium"
            >
              <option value="" disabled={type === 'Keluar'}>
                {type === 'Keluar' ? 'Pilih Kantong...' : 'Pemasukan Umum (Tanpa Kantong)'}
              </option>
              {pockets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} - {p.name}
                </option>
              ))}
            </select>
            {type === 'Masuk' && (
              <p className="text-[10px] text-natural-muted leading-relaxed italic">
                Tips: Jika memasukkan penghasilan ke kantong spesifik, saldo kantong tersebut akan langsung bertambah. Jika tidak memilih kantong, ini dianggap sebagai dana umum tak teralokasi.
              </p>
            )}
          </div>

          {/* Category Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-natural-muted uppercase tracking-wide flex items-center gap-1">
              <Tag size={13} className="text-natural-muted" />
              Kategori Transaksi
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Contoh: Makanan, Transportasi, Gaji Bulanan, dll."
              required
              className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border focus:outline-none focus:ring-1 focus:ring-natural-brand focus:border-natural-brand rounded-xl text-xs text-natural-text"
            />
          </div>

          {/* Nominal Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-natural-muted uppercase tracking-wide flex items-center gap-1">
              <DollarSign size={13} className="text-natural-muted" />
              Nominal (Rupiah)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-natural-muted">
                Rp
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min="1"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-natural-bg border border-natural-border focus:outline-none focus:ring-1 focus:ring-natural-brand focus:border-natural-brand rounded-xl text-xs text-natural-text font-semibold font-mono"
              />
            </div>
          </div>

          {/* Description Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-natural-muted uppercase tracking-wide flex items-center gap-1">
              <Info size={13} className="text-natural-muted" />
              Keterangan / Deskripsi
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ketik rincian tambahan cth: Makan siang warung, beli pulsa internet, dll."
              required
              rows={2}
              className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border focus:outline-none focus:ring-1 focus:ring-natural-brand focus:border-natural-brand rounded-xl text-xs text-natural-text"
            />
          </div>

          {/* Button Actions */}
          <div className="pt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-1/2 text-center py-2.5 border border-natural-border hover:bg-natural-soft text-natural-muted rounded-full text-xs font-bold transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-1/2 text-center py-2.5 bg-natural-brand hover:bg-natural-brand-dark text-white rounded-full text-xs font-bold shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>{isEditMode ? 'Simpan Perubahan' : 'Catat Transaksi'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
