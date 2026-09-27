import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Award,
  Sparkles,
  ChevronRight,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle,
  TrendingUp,
  KeyRound,
  Layers,
} from 'lucide-react';
import { ClassRoom, Student } from '../types';
import { exportClassToExcel, exportAllClassesToExcel, getPredicate } from '../utils/excelExport';

interface DashboardViewProps {
  classes: ClassRoom[];
  students: Student[];
  onSelectClass: (classroom: ClassRoom) => void;
  onOpenAdminModal: (defaultTab?: 'csv' | 'codes') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  classes,
  students,
  onSelectClass,
  onOpenAdminModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate statistics per class
  const classStats = useMemo(() => {
    return classes.map((c) => {
      const classStudents = students.filter((s) => s.classId === c.id);
      const studentCount = classStudents.length;
      const totalScore = classStudents.reduce((sum, s) => sum + s.score, 0);
      const avgScore = studentCount > 0 ? Math.round(totalScore / studentCount) : 0;
      const perfectScoreCount = classStudents.filter((s) => s.score === 100).length;
      const pred = getPredicate(avgScore);

      return {
        ...c,
        studentCount,
        averageScore: avgScore,
        predicate: pred,
        perfectScoreCount,
      };
    });
  }, [classes, students]);

  // Overall metrics
  const totalStudents = students.length;
  const overallAvg =
    totalStudents > 0
      ? Math.round(students.reduce((sum, s) => sum + s.score, 0) / totalStudents)
      : 0;
  const masteryPercentage =
    totalStudents > 0
      ? Math.round(
          (students.filter((s) => s.score >= 80).length / totalStudents) * 100
        )
      : 0;

  // Filtered classes
  const filteredClasses = classStats.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.homeroomTeacher && c.homeroomTeacher.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-4 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-200 text-[11px] font-semibold border border-emerald-500/30">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>Kokurikuler P5 SMPN 1 Bengkalis</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black tracking-tight leading-tight">
              Penilaian Sikap: Kreasi Daur Ulang
            </h2>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              Penilaian sikap siswa real-time tersinkronisasi ke Firebase Firestore dan dapat diekspor ke Excel per kelas maupun gabungan.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => exportAllClassesToExcel(classes, students)}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Unduh Rekap Semua (.xlsx)</span>
            </button>
            <button
              onClick={() => onOpenAdminModal('csv')}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 border border-emerald-400/40"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Impor CSV / Spreadsheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 font-semibold truncate">Total Rombel</div>
            <div className="text-lg sm:text-xl font-black text-slate-800">
              {classes.length} <span className="text-xs font-normal text-slate-500">Kelas</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 font-semibold truncate">Total Siswa</div>
            <div className="text-lg sm:text-xl font-black text-slate-800">
              {totalStudents} <span className="text-xs font-normal text-slate-500">Siswa</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 font-semibold truncate">Rata Sikap</div>
            <div className="text-lg sm:text-xl font-black text-slate-800">
              {overallAvg} <span className="text-xs font-normal text-slate-500">/ 100</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 font-semibold truncate">Ketuntasan (≥80)</div>
            <div className="text-lg sm:text-xl font-black text-slate-800">
              {masteryPercentage}% <span className="text-xs font-normal text-emerald-600">Tuntas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Class Section Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2">
            <span>Daftar Kelas Penilaian</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
              {filteredClasses.length} Kelas
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Klik kartu kelas untuk mulai menilai sikap siswa pada karya daur ulangnya.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kelas atau wali..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Grid Kelas (Class Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {filteredClasses.map((cls) => {
          return (
            <div
              key={cls.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-500/70 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group overflow-hidden"
            >
              {/* Card Header & Badge */}
              <div
                onClick={() => onSelectClass(cls)}
                className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-lg shadow-sm group-hover:scale-105 transition-transform">
                    {cls.name.replace(/[^0-9A-Za-z]/g, '').slice(-2) || '7A'}
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      cls.averageScore >= 80
                        ? 'bg-emerald-100 text-emerald-800'
                        : cls.averageScore >= 70
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    Rata: {cls.averageScore} ({cls.predicate.code})
                  </span>
                </div>

                <h4 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                  {cls.name}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Wali: {cls.homeroomTeacher || 'Guru Pembina'}
                </p>

                {/* Progress bar of score */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {cls.studentCount} Siswa
                    </span>
                    <span className="font-bold text-slate-700">
                      {cls.averageScore}/100
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${cls.averageScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer with Quick Excel Export & Open Class */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportClassToExcel(cls, students);
                  }}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 hover:bg-emerald-100/70 transition-colors cursor-pointer"
                  title={`Unduh file Excel untuk ${cls.name}`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ekspor Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectClass(cls)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer"
                >
                  <span>Buka Kelas</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredClasses.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">Kelas tidak ditemukan</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Tidak ada kelas yang sesuai dengan kata kunci pencarian "{searchQuery}".
          </p>
        </div>
      )}
    </div>
  );
};
