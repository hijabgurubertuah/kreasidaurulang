import React from 'react';
import {
  Recycle,
  Award,
  Sparkles,
  CheckCircle2,
  Calendar,
  LogOut,
  Printer,
  HeartHandshake,
  Lightbulb,
  ShieldCheck,
} from 'lucide-react';
import { Student } from '../types';
import { getPredicate } from '../utils/excelExport';

interface StudentPortalViewProps {
  student: Student;
  onLogout: () => void;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  student,
  onLogout,
}) => {
  const predicate = getPredicate(student.score);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Student Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Recycle className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-200 animate-spin-slow" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              Portal Siswa • SMPN 1 Bengkalis
            </span>
            <h2 className="text-base sm:text-2xl font-black text-slate-900 mt-0.5 truncate">
              {student.name}
            </h2>
            <div className="flex items-center space-x-2 text-xs text-slate-500 truncate mt-0.5">
              <span>NISN: <strong className="text-slate-700 font-mono">{student.nisn}</strong></span>
              <span>•</span>
              <span>{student.className}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="Cetak Ringkasan Nilai"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Main Score Showcase Card */}
      <div className="bg-gradient-to-br from-emerald-800 via-teal-800 to-emerald-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="space-y-3 max-w-lg">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/40 text-xs font-semibold text-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Proyek: Kreasi Daur Ulang Sampah</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Capaian Nilai Sikap
            </h3>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Penilaian sikap mencakup kreativitas pengolahan barang daur ulang, tanggung jawab kebersihan, dan semangat gotong royong dalam tim proyek kokurikuler.
            </p>

            {student.projectTitle && (
              <div className="pt-2">
                <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold">
                  Karya / Proyek yang Dihasilkan:
                </div>
                <div className="text-base font-extrabold text-white mt-0.5 flex items-center gap-2">
                  <span>♻ {student.projectTitle}</span>
                </div>
              </div>
            )}
          </div>

          {/* Big Score Badge */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 sm:p-8 rounded-3xl text-center flex flex-col items-center justify-center min-w-[200px] shadow-inner">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-200">
              Skor Sikap Anda
            </div>
            <div className="text-5xl sm:text-6xl font-black text-white my-1 tracking-tight">
              {student.score}
            </div>
            <div className="text-xs font-bold text-emerald-200 uppercase">
              Skala 0 - 100
            </div>

            <div className="mt-4 px-4 py-1.5 rounded-full bg-white text-emerald-900 font-black text-xs uppercase tracking-wide shadow-xs">
              {predicate.text}
            </div>
          </div>
        </div>
      </div>

      {/* Dimension Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Lightbulb className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-800">Kreativitas & Desain</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Kemampuan mengubah bahan limbah plastik/kertas menjadi produk fungsional dan bernilai estetis.
          </p>
          <div className="pt-1 flex items-center text-xs font-bold text-amber-600">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            <span>Aktif Berinovasi</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-800">Gotong Royong & Kerjasama</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Kekompakan dalam kelompok, kesediaan berbagi alat kreasi daur ulang, dan saling mendukung.
          </p>
          <div className="pt-1 flex items-center text-xs font-bold text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            <span>Solid & Kolaboratif</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-800">Peduli Lingkungan</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Kedisiplinan memilah sampah, membersihkan bengkel karya, dan menjaga ketertiban alat kerja.
          </p>
          <div className="pt-1 flex items-center text-xs font-bold text-teal-600">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            <span>Tanggung Jawab Tinggi</span>
          </div>
        </div>
      </div>

      {/* Teacher Notes & Feedback */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-600" />
          <span>Catatan & Masukan Guru Pembina</span>
        </h4>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-sm text-slate-700 italic leading-relaxed">
          "{student.notes || 'Terus pertahankan semangat kepedulian lingkungan dan kembangkan karya kreasi daur ulang yang bermanfaat bagi masyarakat!'}"
        </div>
        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
          <span>Nilai sikap ini terhubung langsung ke rapor kokurikuler sekolah.</span>
          <span>Status: Terverifikasi oleh Guru Pembina</span>
        </div>
      </div>
    </div>
  );
};
