import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Award,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { ClassRoom, Student } from '../types';
import { getPredicate } from '../utils/excelExport';
import { getScoreColorScheme } from './StudentPortalView';

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
  onUpdateScore,
}) => {
  // Main 2 Tabs for Teacher Page
  const [teacherTab, setTeacherTab] = useState<'classes' | 'all-scores'>('classes');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [searchStudent, setSearchStudent] = useState('');

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
        const matchClass = selectedClassFilter ? s.className === selectedClassFilter : true;
        const matchSearch =
          s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
          s.nisn.includes(searchStudent);
        return matchClass && matchSearch;
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
  }, [students, selectedClassFilter, searchStudent]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 space-y-4 animate-fadeIn">
      {/* 2 MAIN TABS ON TEACHER PAGE */}
      <div className="grid grid-cols-2 bg-slate-200/80 p-1.5 rounded-2xl gap-1 max-w-xl mx-auto shadow-inner">
        <button
          type="button"
          onClick={() => setTeacherTab('classes')}
          className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            teacherTab === 'classes'
              ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-600" />
          <span>Daftar Semua Kelas ({classes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTeacherTab('all-scores')}
          className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            teacherTab === 'all-scores'
              ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4 text-amber-500" />
          <span>Daftar Nilai Semua Kelas ({students.length})</span>
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
          {/* Controls Bar */}
          <div className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              {/* Filter Kelas */}
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="">Semua Kelas ({classes.length} Kelas)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

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

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Cari nama siswa..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
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
                    <div
                      key={st.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-3 flex flex-col justify-between space-y-2"
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
                          className="font-black text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2"
                          title={st.name}
                        >
                          {idx + 1}. {st.name}
                        </h4>
                      </div>

                      {/* Kotak Nilai Diwarnai Sesuai Nilainya */}
                      <div className={`p-2 rounded-xl text-center border ${style.card}`}>
                        <div className="text-2xl sm:text-3xl font-black tracking-tight">
                          {st.score}
                        </div>
                        <div className="text-[9px] font-extrabold uppercase mt-0.5 tracking-wider opacity-90 truncate">
                          {style.predicate}
                        </div>
                      </div>

                      {/* Quick Real-time Grading (+ / -) */}
                      {onUpdateScore && (
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => onUpdateScore(st.id, Math.max(0, st.score - 10))}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 font-black text-xs flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
                            title="Kurangi Nilai (-10)"
                          >
                            -
                          </button>
                          <span className="text-[10px] font-bold text-slate-500 text-center flex-1">
                            Ubah
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateScore(st.id, Math.min(100, st.score + 10))}
                            className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-black text-xs flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
                            title="Tambah Nilai (+10)"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
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
    </div>
  );
};
