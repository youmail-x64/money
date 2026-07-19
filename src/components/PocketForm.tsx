import React, { useState, useEffect } from 'react';
import { Pocket } from '../googleSheetsService';
import { Layers, DollarSign, X, Check, Key } from 'lucide-react';

interface PocketFormProps {
  existingPockets: Pocket[];
  pocketToEdit?: Pocket;
  onSubmit: (id: string, name: string, saldoAwal: number) => Promise<void>;
  onClose: () => void;
}

export default function PocketForm({ existingPockets, pocketToEdit, onSubmit, onClose }: PocketFormProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [saldoAwal, setSaldoAwal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (pocketToEdit) {
      setId(pocketToEdit.id);
      setName(pocketToEdit.name);
      setSaldoAwal(String(pocketToEdit.saldoAwal));
    } else {
      setId('');
      setName('');
      setSaldoAwal('0');
    }
  }, [pocketToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedId = id.trim().toUpperCase();
    const trimmedName = name.trim();
    const parsedSaldoAwal = parseFloat(saldoAwal);

    if (!trimmedId) {
      setErrorMessage('ID Kantong wajib diisi.');
      return;
    }

    if (!/^[A-Z0-9_-]+$/.test(trimmedId)) {
      setErrorMessage('ID Kantong hanya boleh berisi huruf, angka, garis bawah, atau tanda hubung.');
      return;
    }

    // Only check duplicate if it's not the one we are editing
    if (!pocketToEdit && existingPockets.some(p => p.id === trimmedId)) {
      setErrorMessage(`ID Kantong "${trimmedId}" sudah terpakai. Silakan buat ID unik baru.`);
      return;
    }

    if (!trimmedName) {
      setErrorMessage('Nama Kantong wajib diisi.');
      return;
    }

    if (isNaN(parsedSaldoAwal) || parsedSaldoAwal < 0) {
      setErrorMessage('Saldo awal harus berupa angka valid minimal 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(trimmedId, trimmedName, parsedSaldoAwal);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan kantong anggaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditMode = !!pocketToEdit;

  return (
    <div className="fixed inset-0 bg-[#2d2a26]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="pocket-form-backdrop">
      <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl border border-natural-border overflow-hidden flex flex-col" id="pocket-form-container">
        
        {/* Header */}
        <div className="bg-natural-soft border-b border-natural-border px-6 py-5 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-natural-brand-dark font-serif italic">
              {isEditMode ? 'Ubah Kantong (Envelope)' : 'Buat Kantong (Envelope) Baru'}
            </h3>
            <p className="text-xs text-natural-muted">
              {isEditMode ? 'Edit rincian atau saldo awal kantong terpilih.' : 'Tambah pos pengeluaran/tabungan terarah baru.'}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {errorMessage && (
            <div className="bg-[#faf1eb] text-natural-rust p-3 rounded-xl text-xs border border-natural-rust/20 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Pocket ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-natural-muted uppercase tracking-wide flex items-center gap-1">
              <Key size={13} className="text-natural-muted" />
              ID Kantong (Unik)
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Contoh: K06"
              maxLength={10}
              required
              disabled={isEditMode}
              className={`w-full px-4 py-2.5 bg-natural-bg border border-natural-border focus:outline-none focus:ring-1 focus:ring-natural-brand focus:border-natural-brand rounded-xl text-xs font-bold uppercase ${
                isEditMode ? 'opacity-60 cursor-not-allowed text-natural-muted' : 'text-natural-brand-dark'
              }`}
            />
            {!isEditMode ? (
              <p className="text-[10px] text-natural-muted leading-relaxed italic">
                ID pendek unik yang mendefinisikan kantong ini di spreadsheet, contoh: <strong>K06</strong>, <strong>MEDIS</strong>, <strong>WISATA</strong>.
              </p>
            ) : (
              <p className="text-[10px] text-natural-muted leading-relaxed italic">
                ID kantong tidak dapat diubah setelah dibuat untuk menjaga integritas data transaksi.
              </p>
            )}
          </div>

          {/* Pocket Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-natural-muted uppercase tracking-wide flex items-center gap-1">
              <Layers size={13} className="text-natural-muted" />
              Nama Kantong
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Liburan Akhir Tahun"
              required
              className="w-full px-4 py-2.5 bg-natural-bg border border-natural-border focus:outline-none focus:ring-1 focus:ring-natural-brand focus:border-natural-brand rounded-xl text-xs text-natural-text font-medium"
            />
          </div>

          {/* Saldo Awal */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-natural-muted uppercase tracking-wide flex items-center gap-1">
              <DollarSign size={13} className="text-natural-muted" />
              Saldo Awal (Rupiah)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-natural-muted">
                Rp
              </span>
              <input
                type="number"
                value={saldoAwal}
                onChange={(e) => setSaldoAwal(e.target.value)}
                placeholder="0"
                min="0"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-natural-bg border border-natural-border focus:outline-none focus:ring-1 focus:ring-natural-brand focus:border-natural-brand rounded-xl text-xs text-natural-text font-semibold font-mono"
              />
            </div>
            <p className="text-[10px] text-natural-muted leading-relaxed italic">
              Uang awal yang Anda alokasikan di dalam kantong ini. Saldo saat ini akan otomatis dihitung berdasarkan Saldo Awal ditambah mutasi transaksi.
            </p>
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
                  <span>{isEditMode ? 'Simpan' : 'Buat Kantong'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
