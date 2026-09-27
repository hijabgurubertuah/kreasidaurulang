import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { ClassRoom, Student } from '../types';
import { exportClassToExcel, getPredicate } from '../utils/excelExport';

interface ClassDetailViewProps {
  classroom: ClassRoom;
  students: Student[];
  onBack: () => void;
  onUpdateScore: (studentId: string, newScore: number) => void;
  onUpdateNotes: (studentId: string, notes: string) => void;
}

export const ClassDetailView: React.FC<ClassDetailViewProps> = ({
  classroom,
  students,
  onBack,
  onUpdateScore,
  onUpdateNotes,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [recentUpdatedId, setRecentUpdatedId] = useState<string | null>(null);

  // Filter students for this class
  const classStudents = useMemo(() => {
    return students.filter((s) => s.classId === classroom.id);
  }, [students, classroom.id]);

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
      {/* Top Header & Navigation - Responsif & Proporsional di Layar HP */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer active:scale-95"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Kembali</span>
          </button>

          <div className="min-w-0">
            <h2 className="text-sm sm:text-lg font-black text-slate-900 truncate leading-tight">
              {classroom.name}
            </h2>
            <p className="text-[11px] text-slate-500 truncate">
              {totalCount} Siswa • Rata-rata: {avgScore}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => exportClassToExcel(classroom, students)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95"
          title={`Unduh Excel ${classroom.name}`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
          <span>Ekspor Excel</span>
        </button>
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

                    {/* Angka Nilai */}
                    <div className="w-8 sm:w-10 text-center select-none">
                      <span
                        className={`font-black text-xs sm:text-sm tracking-tight ${
                          student.score >= 90
                            ? 'text-emerald-700'
                            : student.score >= 80
                            ? 'text-teal-700'
                            : student.score >= 70
                            ? 'text-amber-700'
                            : 'text-rose-600'
                        }`}
                      >
                        {student.score}
                      </span>
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
      {editingStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                Catatan Sikap Daur Ulang
              </h3>
              <button
                type="button"
                onClick={() => setEditingStudentId(null)}
                className="text-slate-400 hover:text-slate-600"
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
        </div>
      )}
    </div>
  );
};
