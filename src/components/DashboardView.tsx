import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Award,
  ChevronRight,
  Layers,
  X,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { ClassRoom, Student } from '../types';
import { getPredicate } from '../utils/excelExport';
import { getScoreColorScheme, getQuoteForScore } from './StudentPortalView';

interface DashboardViewProps {
  classes: ClassRoom[];
  students: Student[];
  onSelectClass: (classroom: ClassRoom) => void;
  onOpenAdminModal: (defaultTab?: 'csv' | 'codes') => void;
  onUpdateScore?: (studentId: string, newScore: number) => void;
  onUpdateNotes?: (studentId: string, notes: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  classes,
  students,
  onSelectClass,
}) => {
  // Main 2 Tabs for Teacher Page
  const [teacherTab, setTeacherTab] = useState<'classes' | 'all-scores'>('classes');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');

  // Student Detail Modal state
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<Student | null>(null);
  const [selectedMeetingIndex, setSelectedMeetingIndex] = useState<number>(0);

  // Auto-select Kelas 7A by default if no class is selected yet
  React.useEffect(() => {
    if (!selectedClassFilter && classes.length > 0) {
      const class7A = classes.find((c) =>
        c.name.toLowerCase().replace(/\s+/g, '').includes('7a')
      );
      if (class7A) {
        setSelectedClassFilter(class7A.name);
      } else if (classes[0]) {
        setSelectedClassFilter(classes[0].name);
      }
    }
  }, [classes, selectedClassFilter]);

  // Calculate statistics per class
  const classStats = useMemo(() => {
    return classes.map((c) => {
      const classStudents = students.filter((s) => s.classId === c.id);
      const studentCount = classStudents.length;
      const totalScore = classStudents.reduce((sum, s) => sum + s.score, 0);
      const avgScore = studentCount > 0 ? Math.round(totalScore / studentCount) : 0;
      const pred = getPredicate(avgScore);

      return {
        ...c,
        studentCount,
        averageScore: avgScore,
        predicate: pred,
      };
    });
  }, [classes, students]);

  // Filtered classes (Tab 1)
  const filteredClasses = classStats.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.homeroomTeacher && c.homeroomTeacher.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filtered & Sorted Students for Tab 2 (Daftar Nilai Semua Kelas)
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        return selectedClassFilter ? s.className === selectedClassFilter : true;
      })
      .sort((a, b) => {
        // Sort primary by class name (natural class order)
        const classA = (a.className || '').trim();
        const classB = (b.className || '').trim();
        const classComp = classA.localeCompare(classB, 'id', { numeric: true, sensitivity: 'base' });
        if (classComp !== 0) return classComp;

        // Sort secondary by student name alphabetically A-Z
        const nameA = (a.name || '').trim();
        const nameB = (b.name || '').trim();
        return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' });
      });
  }, [students, selectedClassFilter]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 space-y-4 animate-fadeIn">
      {/* 2 MAIN TABS ON TEACHER PAGE */}
      <div className="grid grid-cols-2 bg-slate-200/80 p-1.5 rounded-2xl gap-1 max-w-xl mx-auto shadow-inner">
        <button
          type="button"
          onClick={() => setTeacherTab('classes')}
          className={`flex items-center justify-center py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all cursor-pointer ${
            teacherTab === 'classes'
              ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>MENILAI</span>
        </button>

        <button
          type="button"
          onClick={() => setTeacherTab('all-scores')}
          className={`flex items-center justify-center py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all cursor-pointer ${
            teacherTab === 'all-scores'
              ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>NILAI RATA RATA</span>
        </button>
      </div>

      {/* TAB 1: DAFTAR SEMUA KELAS */}
      {teacherTab === 'classes' && (
        <div className="pt-2">
          {/* Grid Kelas (2 Kotak Hijau Full Ke Kanan Pada HP) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {classes.map((cls) => {
              // Extract clean class display name (e.g., '7A', '7B', '8A')
              const shortName = cls.name.replace(/^Kelas\s+/i, '').trim();

              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => onSelectClass(cls)}
                  className="w-full aspect-4/3 sm:aspect-square bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-3xl p-4 flex items-center justify-center shadow-md hover:shadow-xl hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer border border-emerald-500/40 relative overflow-hidden group"
                >
                  {/* Subtle background glow effect */}
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
                  <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />

                  {/* Clean Big Class Text */}
                  <span className="font-black text-2xl sm:text-3xl tracking-tight drop-shadow-xs group-hover:scale-110 transition-transform">
                    {shortName || cls.name}
                  </span>
                </button>
              );
            })}
          </div>

          {classes.length === 0 && (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-700">Belum ada kelas terdaftar</h4>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAFTAR NILAI SEMUA KELAS (KOTAK 2 KE KANAN PADA HP) */}
      {teacherTab === 'all-scores' && (
        <div className="space-y-4">
          {/* BANNER HIJAU BESAR UNTUK KELAS TERPILIH */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white p-4 sm:p-6 rounded-3xl shadow-md border border-emerald-500/80 flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-200 block mb-1 opacity-90">
                REKAP
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase drop-shadow-xs">
                {selectedClassFilter ? `KELAS ${selectedClassFilter.replace(/^Kelas\s+/i, '')}` : 'SEMUA KELAS'}
              </h2>
            </div>
            <div className="text-right shrink-0 bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-white/20">
              <div className="text-2xl sm:text-3xl font-black">{filteredStudents.length}</div>
              <div className="text-[9px] sm:text-[10px] font-bold text-emerald-100 uppercase tracking-wider">Siswa</div>
            </div>
          </div>

          {/* Controls Bar: Dropdown Pilih Kelas (Dipebesar) */}
          <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {/* Filter Kelas (Diperbesar) */}
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <label className="text-xs sm:text-sm font-extrabold text-slate-800 shrink-0">Pilih Kelas:</label>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-50/90 border-2 border-emerald-500 rounded-2xl text-sm sm:text-base font-extrabold text-emerald-950 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-600 cursor-pointer transition-all"
                >
                  <option value="">Semua Kelas ({classes.length} Kelas)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Legend Indikator Warna Nilai */}
              <div className="hidden lg:flex items-center space-x-1 text-[10px] font-bold overflow-x-auto py-1">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-amber-950 border border-amber-300">100 Emas</span>
                <span className="px-2 py-0.5 rounded bg-gradient-to-r from-emerald-700 via-teal-600 to-amber-500 text-white">90 Hijau Keemasan</span>
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white">80 Hijau</span>
                <span className="px-2 py-0.5 rounded bg-yellow-400 text-yellow-950">70 Kuning</span>
                <span className="px-2 py-0.5 rounded bg-amber-900 text-amber-50">60 Cokelat</span>
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white">≤50 Merah</span>
              </div>
            </div>
          </div>

          {/* Grid Kotak Nilai Siswa (2 Ke Kanan pada HP) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
              <span>Menampilkan {filteredStudents.length} Siswa</span>
            </div>

            {filteredStudents.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {filteredStudents.map((st, idx) => {
                  const style = getScoreColorScheme(st.score);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStudentForModal(st)}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all p-3 flex flex-col justify-between space-y-2 text-left cursor-pointer active:scale-95 group"
                    >
                      <div>
                        {/* Header Badge Kelas */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 truncate max-w-[85%]">
                            {st.className}
                          </span>
                        </div>

                        {/* NAMA SISWA */}
                        <h4
                          className="font-black text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug line-clamp-2"
                          title={st.name}
                        >
                          {idx + 1}. {st.name}
                        </h4>
                      </div>

                      {/* Kotak Nilai Akhir Diwarnai Sesuai Nilainya */}
                      <div className={`p-2.5 rounded-xl text-center border ${style.card}`}>
                        <div className="text-2xl sm:text-3xl font-black tracking-tight">
                          {st.score}
                        </div>
                        <div className="text-[9px] font-extrabold uppercase mt-0.5 tracking-wider opacity-90 truncate">
                          {style.predicate}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2">
                <Award className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">Tidak ada data penilaian siswa ditemukan.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Popup Rekap Penilaian Siswa saat Nama / Kartu Di-tap */}
      {selectedStudentForModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 bg-slate-900/75 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 p-4 sm:p-5 relative space-y-3 my-auto max-h-[90vh] overflow-y-auto">
              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="absolute right-3 top-3 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header Modal Ringkas */}
              <div className="pr-7 space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 inline-block">
                  {selectedStudentForModal.className}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 truncate leading-tight pt-0.5">
                  {selectedStudentForModal.name}
                </h3>
              </div>

              {/* Kotak Nilai Ringkas dengan Warna Sesuai Nilai */}
              {(() => {
                const meetingScores = selectedStudentForModal.meetingScores || [];
                const validScores = meetingScores.filter(
                  (s): s is number => typeof s === 'number' && s !== null
                );
                const effectiveValidScores =
                  validScores.length > 0 ? validScores : [selectedStudentForModal.score];
                const avgScore = Math.round(
                  effectiveValidScores.reduce((sum, val) => sum + val, 0) / effectiveValidScores.length
                );

                const style = getScoreColorScheme(avgScore);
                const quote = getQuoteForScore(
                  avgScore,
                  selectedStudentForModal.nisn || selectedStudentForModal.id
                );

                return (
                  <div className="space-y-2.5">
                    {/* Ringkasan Nilai Rata-rata Akhir */}
                    <div className={`p-3 rounded-2xl text-center border shadow-2xs ${style.card}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                        Nilai Rata-Rata Akhir
                      </div>
                      <div className="text-3xl font-black tracking-tight my-0.5">
                        {avgScore}
                      </div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider">
                        Predikat: {style.predicate}
                      </div>
                    </div>

                    {/* REKAP NILAI SEMUA PERTEMUAN (1 s.d. 20) */}
                    <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-800">
                        <span>Tap Pertemuan (1 - 20) Untuk Detail:</span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                          {effectiveValidScores.length} Terisi
                        </span>
                      </div>

                      {/* Grid P1 - P20 sebagai tombol interaktif */}
                      <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                        {Array.from({ length: 20 }, (_, idx) => {
                          const meetingNum = idx + 1;
                          let mScore: number | null = null;

                          if (meetingScores[idx] !== undefined && meetingScores[idx] !== null) {
                            mScore = meetingScores[idx];
                          } else if (idx === 0) {
                            mScore = selectedStudentForModal.score;
                          }

                          const mStyle = getScoreColorScheme(mScore);
                          const isSelected = selectedMeetingIndex === idx;

                          return (
                            <button
                              key={meetingNum}
                              type="button"
                              onClick={() => setSelectedMeetingIndex(idx)}
                              className={`p-1 rounded-xl border text-center flex flex-col justify-between items-center transition-all cursor-pointer active:scale-95 ${
                                mStyle.card
                              } ${
                                isSelected
                                  ? 'ring-2 ring-emerald-600 ring-offset-1 font-black scale-105 shadow-md z-10'
                                  : 'hover:opacity-90'
                              }`}
                              title={`Klik untuk lihat catatan Pertemuan ${meetingNum}`}
                            >
                              <div className="text-[8px] font-bold uppercase opacity-80 leading-none">
                                P{meetingNum}
                              </div>
                              <div className="text-xs font-black tracking-tight leading-tight my-0.5">
                                {mScore !== null ? mScore : '-'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* DETAIL PERTEMUAN YANG DIPILIH */}
                    {(() => {
                      const currentMeetingNum = selectedMeetingIndex + 1;
                      let currentMeetingScore: number | null = null;
                      if (meetingScores[selectedMeetingIndex] !== undefined && meetingScores[selectedMeetingIndex] !== null) {
                        currentMeetingScore = meetingScores[selectedMeetingIndex];
                      } else if (selectedMeetingIndex === 0) {
                        currentMeetingScore = selectedStudentForModal.score;
                      }

                      const currentMeetingNote =
                        selectedStudentForModal.meetingNotes?.[selectedMeetingIndex] ||
                        (selectedMeetingIndex === 0 && selectedStudentForModal.notes
                          ? selectedStudentForModal.notes
                          : null);

                      const currentMeetingQuote =
                        currentMeetingScore !== null
                          ? getQuoteForScore(
                              currentMeetingScore,
                              (selectedStudentForModal.nisn || selectedStudentForModal.id) + selectedMeetingIndex
                            )
                          : null;

                      const currentStyle = getScoreColorScheme(currentMeetingScore);

                      return (
                        <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200/80 space-y-1.5 animate-fadeIn">
                          <div className="flex items-center justify-between border-b border-emerald-200/60 pb-1">
                            <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                              Detail Pertemuan {currentMeetingNum}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${currentStyle.card}`}>
                              {currentMeetingScore !== null ? `Nilai: ${currentMeetingScore}` : 'Belum Terisi'}
                            </span>
                          </div>

                          {/* Catatan / Apresiasi Pertemuan */}
                          <div className="space-y-1 pt-0.5">
                            <div className="flex items-center space-x-1 text-[11px] font-bold text-emerald-900">
                              <MessageSquare className="w-3 h-3 text-emerald-700 shrink-0" />
                              <span>Catatan / Evaluasi Pertemuan {currentMeetingNum}:</span>
                            </div>
                            <p className="text-[11px] text-slate-800 leading-relaxed font-medium bg-white/80 p-2 rounded-xl border border-emerald-100">
                              {currentMeetingNote && currentMeetingNote.trim()
                                ? currentMeetingNote
                                : currentMeetingQuote
                                ? `"${currentMeetingQuote}"`
                                : 'Belum ada catatan untuk pertemuan ini.'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Footer Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForModal(null)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Tutup Rekap
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
