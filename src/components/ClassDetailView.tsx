import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  Users,
  TrendingUp,
  Award,
  MessageSquare,
  Sparkles,
  X,
  Save,
} from 'lucide-react';
import { ClassRoom, Student } from '../types';
import { exportClassToExcel, getPredicate } from '../utils/excelExport';
import { getScoreColorScheme } from './StudentPortalView';

interface ClassDetailViewProps {
  classroom: ClassRoom;
  students: Student[];
  onBack: () => void;
  onUpdateScore: (studentId: string, newScore: number) => void;
  onUpdateNotes: (studentId: string, notes: string) => void;
  hasPendingChanges?: boolean;
  pendingChangesCount?: number;
  onSaveToFirebase?: () => Promise<void>;
  isSavingToFirebase?: boolean;
}

export const ClassDetailView: React.FC<ClassDetailViewProps> = ({
  classroom,
  students,
  onBack,
  onUpdateScore,
  onUpdateNotes,
  hasPendingChanges = false,
  pendingChangesCount = 0,
  onSaveToFirebase,
  isSavingToFirebase = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [recentUpdatedId, setRecentUpdatedId] = useState<string | null>(null);

  // Filter students for this class (Sorted Alphabetically A-Z)
  const classStudents = useMemo(() => {
    const classIdStr = (classroom.id || '').trim().toLowerCase();
    const classNameStr = (classroom.name || '').replace(/^Kelas\s+/i, '').trim().toLowerCase();

    return students
      .filter((s) => {
        if (!s) return false;
        const sClassId = (s.classId || '').trim().toLowerCase();
        const sClassName = (s.className || '').trim().toLowerCase();
        const sCleanClassName = (s.className || '').replace(/^Kelas\s+/i, '').trim().toLowerCase();

        return (
          sClassId === classIdStr ||
          sClassName === (classroom.name || '').trim().toLowerCase() ||
          sCleanClassName === classNameStr ||
          sClassId === classNameStr
        );
      })
      .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim(), 'id', { sensitivity: 'base' }));
  }, [students, classroom]);

  // Filter by search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase();
    return classStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nisn.includes(q) ||
        (s.projectTitle && s.projectTitle.toLowerCase().includes(q))
    );
  }, [classStudents, searchQuery]);

  // Statistics
  const totalCount = classStudents.length;
  const avgScore =
    totalCount > 0
      ? Math.round(classStudents.reduce((sum, s) => sum + s.score, 0) / totalCount)
      : 0;

  const handleScoreChange = (student: Student, delta: number) => {
    const newScore = Math.max(0, Math.min(100, student.score + delta));
    if (newScore !== student.score) {
      onUpdateScore(student.id, newScore);
      setRecentUpdatedId(student.id);
      setTimeout(() => {
        setRecentUpdatedId((prev) => (prev === student.id ? null : prev));
      }, 1000);
    }
  };

  const handleOpenNoteModal = (student: Student) => {
    setEditingStudentId(student.id);
    setTempNotes(student.notes || '');
  };

  const handleSaveNotes = (studentId: string) => {
    onUpdateNotes(studentId, tempNotes);
    setEditingStudentId(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-4 animate-fadeIn">
      {/* Banner Header Hijau Besar untuk Kelas Terpilih */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white p-4 sm:p-6 rounded-3xl shadow-md border border-emerald-500/80 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center space-x-1 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-2xl border border-white/30 font-extrabold text-xs shadow-xs transition-colors shrink-0 cursor-pointer active:scale-95 backdrop-blur-xs"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Kembali</span>
          </button>

          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-200 block mb-0.5 opacity-90">
              PENILAIAN KELAS
            </span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase drop-shadow-xs truncate">
              {classroom.name.toUpperCase()}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 font-medium truncate pt-0.5">
              {totalCount} Siswa • Rata-rata Sikap: {avgScore}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-xs text-white rounded-2xl border border-white/20 text-xs font-extrabold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Real-time Live</span>
          </div>
        </div>
      </div>

      {/* KPI Ringkas di HP */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 text-center">
          <div className="text-[10px] text-slate-500 font-bold uppercase">Siswa</div>
          <div className="text-base sm:text-xl font-black text-slate-800 mt-0.5">{totalCount}</div>
        </div>
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 text-center">
          <div className="text-[10px] text-emerald-700 font-bold uppercase">Rata Sikap</div>
          <div className="text-base sm:text-xl font-black text-emerald-700 mt-0.5">{avgScore}</div>
        </div>
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 text-center">
          <div className="text-[10px] text-teal-700 font-bold uppercase">Nilai 100</div>
          <div className="text-base sm:text-xl font-black text-teal-700 mt-0.5">
            {classStudents.filter((s) => s.score === 100).length}
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama, NISN, atau proyek daur ulang..."
          className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
      </div>

      {/* Student List - 100% Responsif dan Pas di HP */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filteredStudents.length > 0 ? (
          filteredStudents.map((student, idx) => {
            const predicate = getPredicate(student.score);
            const isUpdatedRecently = recentUpdatedId === student.id;
            const scoreStyle = getScoreColorScheme(student.score);

            return (
              <div
                key={student.id}
                className={`p-3 sm:px-4 sm:py-3.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors ${
                  isUpdatedRecently ? 'bg-emerald-50/60' : ''
                }`}
              >
                {/* Bagian Kiri: Nomor + Nama Siswa (rata kiri) + NISN */}
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-400 w-5 shrink-0 text-center">
                    {idx + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 truncate flex items-center gap-1.5">
                      <span className="truncate">{student.name}</span>
                      {student.score === 100 && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                          ★ 100
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 truncate mt-0.5">
                      <span className="font-mono text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/60 shrink-0">
                        {student.nisn}
                      </span>
                      <span className="truncate text-slate-500 text-[10px] sm:text-xs">
                        {student.projectTitle || 'Kreasi Daur Ulang'}
                      </span>
                    </div>

                    {student.notes && (
                      <div className="text-[10px] text-slate-500 italic truncate mt-0.5">
                        "{student.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Bagian Kanan: Tombol Catatan + [▼] [ Nilai ] [▲] (Presisi di HP) */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  {/* Predikat label di tablet/desktop */}
                  <span className="hidden md:inline text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {predicate.code}
                  </span>

                  {/* Tombol Catatan */}
                  <button
                    type="button"
                    onClick={() => handleOpenNoteModal(student)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Tambah Catatan"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {/* Kontrol Nilai: [▼] Nilai [▲] */}
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                    {/* Tombol Panah Bawah (▼) - Merah/Oranye */}
                    <button
                      type="button"
                      onClick={() => handleScoreChange(student, -10)}
                      disabled={student.score <= 0}
                      aria-label="Kurangi nilai 10"
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs select-none transition-all ${
                        student.score <= 0
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                          : 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-xs cursor-pointer active:scale-90'
                      }`}
                    >
                      ▼
                    </button>

                    {/* Angka Nilai dengan Latar Berwarna Sesuai Tingkat Nilai */}
                    <div
                      className={`w-9 sm:w-11 px-1 py-1 rounded-lg border text-center flex items-center justify-center font-black text-xs sm:text-sm tracking-tight transition-all duration-300 shadow-2xs ${scoreStyle.card}`}
                      title={`Nilai: ${student.score} (${scoreStyle.predicate})`}
                    >
                      {student.score}
                    </div>

                    {/* Tombol Panah Atas (▲) - Hijau */}
                    <button
                      type="button"
                      onClick={() => handleScoreChange(student, 10)}
                      disabled={student.score >= 100}
                      aria-label="Tambah nilai 10"
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs select-none transition-all ${
                        student.score >= 100
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                          : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs cursor-pointer active:scale-90'
                      }`}
                    >
                      ▲
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">
            Tidak ada siswa ditemukan pada kelas ini.
          </div>
        )}
      </div>

      {/* Modal Edit Catatan Siswa */}
      {editingStudentId && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3 my-auto max-h-[88vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                Catatan Sikap Daur Ulang
              </h3>
              <button
                type="button"
                onClick={() => setEditingStudentId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              value={tempNotes}
              onChange={(e) => setTempNotes(e.target.value)}
              rows={3}
              placeholder="Catatan sikap dan ketekunan..."
              className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            />

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingStudentId(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleSaveNotes(editingStudentId)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
