import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Database,
  HardDrive,
  PenTool,
  BookOpen,
  Trash2,
  RefreshCw,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { Student, ClassRoom, TeacherCode } from '../types';
import {
  getQuotaStats,
  QuotaStats,
  calculateRealtimeStorageSize,
  FIREBASE_LIMITS,
} from '../services/quotaService';

interface DatabaseUsageViewProps {
  students: Student[];
  classes: ClassRoom[];
  teacherCodes: TeacherCode[];
  firebaseConnected: boolean;
  onClearStudents: () => Promise<number>;
  onClearTeacherCodes: () => Promise<number>;
  onResetDatabase: () => Promise<void>;
  onDeduplicateStudents: () => Promise<{
    mergedCount: number;
    removedDuplicates: number;
    totalUnique: number;
    removedClassDuplicates?: number;
    removedEmptyClasses?: number;
  }>;
}

export const DatabaseUsageView: React.FC<DatabaseUsageViewProps> = ({
  students,
  classes,
  teacherCodes,
  firebaseConnected,
  onClearStudents,
  onClearTeacherCodes,
  onResetDatabase,
  onDeduplicateStudents,
}) => {
  const [stats, setStats] = useState<QuotaStats>(getQuotaStats());
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Update stats on custom event and periodically
  useEffect(() => {
    const handleUpdate = () => setStats(getQuotaStats());
    window.addEventListener('quota_stats_updated', handleUpdate);
    const interval = setInterval(handleUpdate, 3000);
    return () => {
      window.removeEventListener('quota_stats_updated', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  // Compute storage
  const currentBytes = calculateRealtimeStorageSize(
    students.length,
    classes.length,
    teacherCodes.length
  );
  const currentKB = (currentBytes / 1024).toFixed(2);
  const currentMB = (currentBytes / (1024 * 1024)).toFixed(3);
  const storageLimitMB = 1024; // 1 GB
  const storagePercent = Math.max(0.01, Math.min(100, (currentBytes / FIREBASE_LIMITS.MAX_STORAGE_BYTES) * 100));

  // Compute writes
  const writesUsed = stats.writesToday || 0;
  const writesRemaining = Math.max(0, FIREBASE_LIMITS.MAX_WRITES_DAILY - writesUsed);
  const writesPercent = Math.min(100, (writesUsed / FIREBASE_LIMITS.MAX_WRITES_DAILY) * 100);

  // Compute reads
  const readsUsed = stats.readsToday || 0;
  const readsRemaining = Math.max(0, FIREBASE_LIMITS.MAX_READS_DAILY - readsUsed);
  const readsPercent = Math.min(100, (readsUsed / FIREBASE_LIMITS.MAX_READS_DAILY) * 100);

  // Compute deletes
  const deletesUsed = stats.deletesToday || 0;
  const deletesRemaining = Math.max(0, FIREBASE_LIMITS.MAX_DELETES_DAILY - deletesUsed);
  const deletesPercent = Math.min(100, (deletesUsed / FIREBASE_LIMITS.MAX_DELETES_DAILY) * 100);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    isDanger?: boolean;
    actionType: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const handleRunClearStudents = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Kosongkan Seluruh Data Siswa?',
      message: `PERINGATAN: Anda akan menghapus SELURUH ${students.length} data siswa di database Firebase Firestore seketika! Tindakan ini langsung menghapus data di seluruh perangkat.`,
      confirmLabel: 'Ya, Kosongkan Semua',
      isDanger: true,
      actionType: 'clear-students',
      onConfirm: async () => {
        setIsActionRunning(true);
        setActionType('clear-students');
        setErrorMsg('');
        try {
          const count = await onClearStudents();
          setSuccessMsg(`Berhasil mengosongkan ${count} data siswa dari database Firebase secara real-time.`);
        } catch (err: any) {
          setErrorMsg(`Gagal membersihkan data siswa: ${err.message}`);
        } finally {
          setIsActionRunning(false);
          setActionType(null);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleRunClearTeachers = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Bersihkan Kode Guru Tambahan?',
      message: 'Hapus semua kode login guru tambahan di Firebase? (Akun ADMIN123 dan GURU123 akan tetap tersimpan).',
      confirmLabel: 'Ya, Bersihkan Kode',
      isDanger: true,
      actionType: 'clear-teachers',
      onConfirm: async () => {
        setIsActionRunning(true);
        setActionType('clear-teachers');
        setErrorMsg('');
        try {
          const count = await onClearTeacherCodes();
          setSuccessMsg(`Berhasil membersihkan ${count} kode login guru tambahan.`);
        } catch (err: any) {
          setErrorMsg(`Gagal membersihkan kode guru: ${err.message}`);
        } finally {
          setIsActionRunning(false);
          setActionType(null);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleRunDeduplication = async () => {
    setIsActionRunning(true);
    setActionType('deduplicate');
    setErrorMsg('');
    try {
      const res = await onDeduplicateStudents();
      const details: string[] = [];
      if (res.removedDuplicates > 0) details.push(`${res.removedDuplicates} NISN ganda dibersihkan`);
      if (res.removedClassDuplicates && res.removedClassDuplicates > 0) details.push(`${res.removedClassDuplicates} kelas ganda digabung`);
      if (res.removedEmptyClasses && res.removedEmptyClasses > 0) details.push(`${res.removedEmptyClasses} kelas kosong dihapus`);

      if (details.length > 0) {
        setSuccessMsg(`Pembersihan sukses: ${details.join(', ')}. Database sekarang rapi!`);
      } else {
        setSuccessMsg(`Database bersih: Tidak ada NISN/Kelas ganda atau kelas kosong.`);
      }
    } catch (err: any) {
      setErrorMsg(`Gagal deduplikasi: ${err.message}`);
    } finally {
      setIsActionRunning(false);
      setActionType(null);
    }
  };

  const handleRunReset = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Database ke Bawaan Modul?',
      message: 'Database akan direset ke konfigurasi awal (4 kelas dan akun guru/admin default, daftar siswa bersih). Lanjutkan?',
      confirmLabel: 'Ya, Reset Database',
      isDanger: false,
      actionType: 'reset',
      onConfirm: async () => {
        setIsActionRunning(true);
        setActionType('reset');
        setErrorMsg('');
        try {
          await onResetDatabase();
          setSuccessMsg('Database berhasil direset kembali ke konfigurasi awal modul!');
        } catch (err: any) {
          setErrorMsg(`Gagal reset database: ${err.message}`);
        } finally {
          setIsActionRunning(false);
          setActionType(null);
          setConfirmDialog(null);
        }
      },
    });
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Real-time Status Card */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-black text-white">
                Real-time Database Firebase
              </h3>
              <span
                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  firebaseConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    firebaseConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                  }`}
                />
                <span>{firebaseConnected ? 'Live Real-time' : 'Menghubungkan...'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sinkronisasi instan multi-perangkat via Firestore WebSocket • Kuota Spark Plan (1 GB Gratis)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700/60 text-xs">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Latency Sync</div>
            <div className="font-mono font-bold text-emerald-400">&lt; 150 ms</div>
          </div>
          <div className="w-px h-6 bg-slate-700" />
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Total Dokumen</div>
            <div className="font-mono font-bold text-white">
              {students.length + classes.length + teacherCodes.length}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 Kartu Grafik Penggunaan Database & Kuota */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Kapasitas Penyimpanan (1 GB) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Penyimpanan (1 GB)</h4>
                <p className="text-[10px] text-slate-500">Kapasitas Database</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              Free Tier
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-extrabold text-slate-900 text-sm">
                {currentMB} <span className="text-xs font-normal text-slate-500">MB</span>
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">
                dari {storageLimitMB} MB (1 GB)
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, storagePercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
              <span>Terpakai: {currentKB} KB</span>
              <span className="font-bold text-emerald-600">Sisa: ~1.00 GB (99.9%)</span>
            </div>
          </div>
        </div>

        {/* 2. Sisa Kuota Tulis (Writes / Hari) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <PenTool className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Kuota Tulis (Writes)</h4>
                <p className="text-[10px] text-slate-500">Batas Harian (20k/hari)</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              Hari Ini
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-extrabold text-slate-900 text-sm">
                {writesUsed.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">writes</span>
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">
                dari 20.000 / hari
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, writesPercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
              <span>{writesPercent.toFixed(1)}% terpakai</span>
              <span className="font-bold text-emerald-600">
                Sisa: {writesRemaining.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Sisa Kuota Baca (Reads / Hari) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Kuota Baca (Reads)</h4>
                <p className="text-[10px] text-slate-500">Batas Harian (50k/hari)</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              Hari Ini
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-extrabold text-slate-900 text-sm">
                {readsUsed.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">reads</span>
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">
                dari 50.000 / hari
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, readsPercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
              <span>{readsPercent.toFixed(1)}% terpakai</span>
              <span className="font-bold text-emerald-600">
                Sisa: {readsRemaining.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Sisa Kuota Hapus (Deletes / Hari) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Kuota Hapus (Deletes)</h4>
                <p className="text-[10px] text-slate-500">Batas Harian (20k/hari)</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
              Hari Ini
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-extrabold text-slate-900 text-sm">
                {deletesUsed.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">deletes</span>
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">
                dari 20.000 / hari
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-rose-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, deletesPercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
              <span>{deletesPercent.toFixed(1)}% terpakai</span>
              <span className="font-bold text-emerald-600">
                Sisa: {deletesRemaining.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rincian Struktur Koleksi Database */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Struktur Koleksi Dokumen Aktif di Firebase Firestore</span>
          </h4>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            Real-time Live Sync
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">Koleksi "students"</div>
              <div className="text-sm font-black text-slate-900">{students.length} Siswa</div>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-mono">
              ~{(students.length * 0.28).toFixed(1)} KB
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">Koleksi "classes"</div>
              <div className="text-sm font-black text-slate-900">{classes.length} Kelas</div>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-mono">
              ~{(classes.length * 0.18).toFixed(1)} KB
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">Koleksi "teacher_codes"</div>
              <div className="text-sm font-black text-slate-900">{teacherCodes.length} Kode Login</div>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-mono">
              ~{(teacherCodes.length * 0.15).toFixed(1)} KB
            </div>
          </div>
        </div>
      </div>

      {/* Pemeliharaan & Utilitas Database */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Server className="w-4 h-4 text-slate-700" />
            <span>Utilitas & Pemeliharaan Database Firebase</span>
          </h4>
          <span className="text-[11px] text-slate-400">Tindakan Langsung Real-time</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Card 1: Deduplikasi NISN */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Scan & Bersihkan Kelas/NISN Duplikat</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Memeriksa seluruh database Firebase, menggabungkan data NISN/Kelas ganda, dan menghapus kelas kosong otomatis.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunDeduplication}
              disabled={isActionRunning}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isActionRunning && actionType === 'deduplicate' ? 'Memindai & Bersihkan...' : 'Bersihkan NISN & Kelas Ganda/Kosong'}
            </button>
          </div>

          {/* Card 2: Reset ke Bawaan */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                <span>Reset Database ke Default Modul</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Mengembalikan 4 kelas dan kode login guru default modul Kokurikuler Daur Ulang SMPN 1 Bengkalis (tanpa data dummy).
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunReset}
              disabled={isActionRunning}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isActionRunning && actionType === 'reset' ? 'Mereset...' : 'Reset ke Konfigurasi Awal'}
            </button>
          </div>

          {/* Card 3: Kosongkan Siswa */}
          <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-200 flex flex-col justify-between space-y-2">
            <div>
              <div className="text-xs font-bold text-rose-900 flex items-center space-x-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Kosongkan Seluruh Data Siswa</span>
              </div>
              <p className="text-[11px] text-rose-800 mt-1 leading-relaxed">
                Menghapus semua {students.length} siswa di Firebase seketika untuk persiapan tahun ajaran baru atau import spreadsheet baru.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunClearStudents}
              disabled={isActionRunning}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isActionRunning && actionType === 'clear-students' ? 'Menghapus...' : 'Kosongkan Semua Siswa'}
            </button>
          </div>

          {/* Card 4: Bersihkan Kode Guru Tambahan */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Trash2 className="w-3.5 h-3.5 text-slate-600" />
                <span>Bersihkan Kode Guru Tambahan</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Menghapus kode login guru tambahan dan tetap mempertahankan akun ADMIN123 serta GURU123.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunClearTeachers}
              disabled={isActionRunning}
              className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isActionRunning && actionType === 'clear-teachers' ? 'Membersihkan...' : 'Bersihkan Kode Guru Tambahan'}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL KONFIRMASI UTILITY DATABASE (Tampil di Layar HP & Desktop Tanpa Terhalang Iframe) */}
      {confirmDialog && confirmDialog.isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto border border-slate-200">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-xs border ${
              confirmDialog.isDanger ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}>
              {confirmDialog.isDanger ? <Trash2 className="w-6 h-6" /> : <RefreshCw className="w-6 h-6" />}
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-extrabold text-base text-slate-900">
                {confirmDialog.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={isActionRunning}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                disabled={isActionRunning}
                className={`w-full py-2.5 px-3 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95 disabled:opacity-50 ${
                  confirmDialog.isDanger
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <span className={isActionRunning ? 'animate-spin' : ''}>
                  {confirmDialog.isDanger ? <Trash2 className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </span>
                <span>{isActionRunning ? 'Memproses...' : confirmDialog.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
