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
  Calendar,
} from 'lucide-react';
import { ClassRoom, Student, MeetingSchedule } from '../types';
import { exportClassToExcel, getPredicate } from '../utils/excelExport';
import { getScoreColorScheme } from './StudentPortalView';
import { getMeetingLockStatus, formatIndonesianDate } from '../utils/scheduleHelper';

const CLASS_GRADIENTS = [
  // 1. Green (Emerald)
  {
    gradient: "from-emerald-500 via-emerald-600 to-teal-800",
    border: "border-emerald-400/40",
    glow: "bg-emerald-400/15"
  },
  // 2. Purple
  {
    gradient: "from-purple-600 via-indigo-600 to-purple-800",
    border: "border-purple-400/40",
    glow: "bg-purple-400/15"
  },
  // 3. Orange/Yellow/Amber
  {
    gradient: "from-amber-500 via-orange-500 to-amber-700",
    border: "border-amber-400/40",
    glow: "bg-amber-300/15"
  },
  // 4. Blue/Sky
  {
    gradient: "from-blue-600 via-sky-600 to-blue-800",
    border: "border-blue-500/40",
    glow: "bg-sky-400/15"
  },
  // 5. Pink/Rose/Crimson
  {
    gradient: "from-rose-500 via-pink-600 to-rose-700",
    border: "border-rose-400/40",
    glow: "bg-rose-300/15"
  },
  // 6. Teal/Cyan
  {
    gradient: "from-teal-500 via-cyan-600 to-teal-800",
    border: "border-teal-400/40",
    glow: "bg-teal-400/15"
  },
  // 7. Violet/Indigo
  {
    gradient: "from-violet-600 via-fuchsia-600 to-violet-800",
    border: "border-violet-500/40",
    glow: "bg-violet-400/15"
  },
  // 8. Crimson/Red/Orange
  {
    gradient: "from-red-500 via-orange-600 to-red-700",
    border: "border-red-400/40",
    glow: "bg-red-400/15"
  }
];

interface ClassDetailViewProps {
  classroom: ClassRoom;
  students: Student[];
  classes?: ClassRoom[];
  schedules?: MeetingSchedule[];
  onBack: () => void;
  onUpdateScore: (studentId: string, newScore: number) => void;
  onUpdateNotes: (studentId: string, notes: string) => void;
  onUpdateMeetingScore?: (studentId: string, meetingIndex: number, newScore: number, notes?: string) => void;
  hasPendingChanges?: boolean;
  pendingChangesCount?: number;
  onSaveToFirebase?: () => Promise<void>;
  isSavingToFirebase?: boolean;
}

export const ClassDetailView: React.FC<ClassDetailViewProps> = ({
  classroom,
  students,
  classes = [],
  schedules = [],
  onBack,
  onUpdateScore,
  onUpdateNotes,
  onUpdateMeetingScore,
  hasPendingChanges = false,
  pendingChangesCount = 0,
  onSaveToFirebase,
  isSavingToFirebase = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [recentUpdatedId, setRecentUpdatedId] = useState<string | null>(null);

  // Active meeting scoring index selection (0 to 19)
  const [selectedMeetingIndex, setSelectedMeetingIndex] = useState<number>(0);

  // Find index of classroom in classes to match color scheme
  const colorScheme = useMemo(() => {
    const classIdx = classes.findIndex((c) => c.id === classroom.id);
    return CLASS_GRADIENTS[classIdx !== -1 ? classIdx % CLASS_GRADIENTS.length : 0];
  }, [classes, classroom]);

  // Auto-detect and pre-select today's active meeting on load
  React.useEffect(() => {
    if (schedules && schedules.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const activeSched = schedules.find((s) => s.activeDate === todayStr);
      if (activeSched) {
        setSelectedMeetingIndex(activeSched.meetingNumber - 1);
      }
    }
  }, [schedules]);

  // Determine current active meeting lock status
  const currentSched = schedules.find((s) => s.meetingNumber === (selectedMeetingIndex + 1));
  const activeDate = currentSched?.activeDate || '';
  const lockStatus = getMeetingLockStatus(activeDate);

  // Penilaian hanya berlaku pada kolom yang di-set tanggal.
  // Jika tanggal belum diatur atau bukan hari H, maka penilaian terkunci otomatis.
  const isDateConfigured = lockStatus.isConfigured;
  const isScoringActive = lockStatus.isOpenToday;

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

  // Get specific meeting score (0 to 19)
  const getMeetingScore = (student: Student, idx: number): number | null => {
    // Penilaian hanya berlaku pada kolom yang di-set tanggal
    const sched = schedules.find((s) => s.meetingNumber === idx + 1);
    if (!sched || !sched.activeDate || sched.activeDate.trim() === '') {
      return null;
    }
    if (student.meetingScores && student.meetingScores[idx] !== undefined && student.meetingScores[idx] !== null && (student.meetingScores[idx] as number) > 0) {
      return student.meetingScores[idx] as number;
    }
    // Nilai awal semua siswa adalah 80. Jika kunci terbuka dan tidak diubah maka nilainya 80.
    return 80;
  };

  // Get specific meeting notes (0 to 19)
  const getMeetingNotes = (student: Student, idx: number): string => {
    const sched = schedules.find((s) => s.meetingNumber === idx + 1);
    if (!sched || !sched.activeDate || sched.activeDate.trim() === '') {
      return '';
    }
    if (student.meetingNotes && student.meetingNotes[idx] !== undefined && student.meetingNotes[idx] !== null) {
      return student.meetingNotes[idx] as string;
    }
    return '';
  };

  // Statistics
  const totalCount = classStudents.length;
  const scoredStudents = classStudents
    .map((s) => getMeetingScore(s, selectedMeetingIndex))
    .filter((score): score is number => score !== null);

  const avgScore =
    scoredStudents.length > 0
      ? Math.round(
          scoredStudents.reduce((sum, s) => sum + s, 0) / scoredStudents.length
        )
      : 0;

  const handleScoreChange = (student: Student, delta: number) => {
    if (!isScoringActive) return; // Prevent edits if locked by schedule or date not set
    
    const currentMScore = getMeetingScore(student, selectedMeetingIndex);
    const baseScore = currentMScore !== null ? currentMScore : 80;
    const newScore = Math.max(0, Math.min(100, baseScore + delta));

    if (newScore !== currentMScore) {
      if (onUpdateMeetingScore) {
        onUpdateMeetingScore(
          student.id,
          selectedMeetingIndex,
          newScore,
          getMeetingNotes(student, selectedMeetingIndex)
        );
      } else {
        onUpdateScore(student.id, newScore);
      }
      setRecentUpdatedId(student.id);
      setTimeout(() => {
        setRecentUpdatedId((prev) => (prev === student.id ? null : prev));
      }, 1000);
    }
  };

  const handleOpenNoteModal = (student: Student) => {
    setEditingStudentId(student.id);
    setTempNotes(getMeetingNotes(student, selectedMeetingIndex));
  };

  const handleSaveNotes = (studentId: string) => {
    if (!isScoringActive) {
      setEditingStudentId(null);
      return;
    }
    const student = students.find((s) => s.id === studentId);
    if (student) {
      const currentMScore = getMeetingScore(student, selectedMeetingIndex);
      if (onUpdateMeetingScore) {
        onUpdateMeetingScore(studentId, selectedMeetingIndex, currentMScore ?? 80, tempNotes);
      } else {
        onUpdateNotes(studentId, tempNotes);
      }
    }
    setEditingStudentId(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-4 animate-fadeIn">
      {/* Banner Header Hijau Besar untuk Kelas Terpilih */}
      <div className={`bg-gradient-to-r ${colorScheme.gradient} text-white p-4 sm:p-6 rounded-3xl shadow-md border ${colorScheme.border} flex items-center justify-between gap-3`}>
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
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/80 block mb-0.5 opacity-90">
              PENILAIAN KELAS
            </span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase drop-shadow-xs truncate">
              {classroom.name.toUpperCase()}
            </h2>
            <p className="text-xs sm:text-sm text-white/90 font-medium truncate pt-0.5">
              {totalCount} Siswa • Rata-rata Sikap: {avgScore}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-xs text-white rounded-2xl border border-white/20 text-xs font-extrabold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
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
          <div className="text-base sm:text-xl font-black text-emerald-700 mt-0.5">
            {scoredStudents.length > 0 ? avgScore : '-'}
          </div>
        </div>
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 text-center">
          <div className="text-[10px] text-teal-700 font-bold uppercase">Sudah Dinilai</div>
          <div className="text-base sm:text-xl font-black text-teal-700 mt-0.5">
            {scoredStudents.length} / {totalCount}
          </div>
        </div>
      </div>

      {/* KONTROL PILIH PERTEMUAN UNTUK DINILAI */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <label className="text-xs sm:text-sm font-extrabold text-slate-800 shrink-0 uppercase tracking-wide">Pilih Pertemuan:</label>
          <select
            value={selectedMeetingIndex}
            onChange={(e) => setSelectedMeetingIndex(Number(e.target.value))}
            className="flex-1 sm:flex-none px-4 py-2 bg-purple-50 border-2 border-purple-500 rounded-xl text-xs sm:text-sm font-black text-purple-950 shadow-2xs cursor-pointer"
          >
            {Array.from({ length: 20 }, (_, idx) => {
              const meetingNum = idx + 1;
              const sched = schedules.find((s) => s.meetingNumber === meetingNum);
              const mDate = sched?.activeDate ? sched.activeDate.trim() : '';
              const mLock = getMeetingLockStatus(mDate);
              return (
                <option key={meetingNum} value={idx}>
                  Pertemuan {meetingNum} {mLock.isConfigured ? `(${mLock.formattedDate} • ${mLock.isOpenToday ? 'Buka Hari Ini' : mLock.isPast ? 'Selesai/Terkunci' : 'Mendatang'})` : '(Belum Ada Jadwal)'}
                </option>
              );
            })}
          </select>
        </div>

        {/* STATUS AKTIF JADWAL PENILAIAN */}
        <div className="flex items-center space-x-2 self-start sm:self-center">
          <span className="text-xs font-bold text-slate-500">Status:</span>
          <span
            className={`inline-flex items-center space-x-1.5 px-3 py-1 border rounded-full text-xs font-bold ${lockStatus.badgeClass}`}
            title={lockStatus.description}
          >
            {lockStatus.isOpenToday && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
            <span>{lockStatus.statusLabel}</span>
          </span>
        </div>
      </div>

      {/* Notice jika tanggal belum diatur */}
      {!isDateConfigured && (
        <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3 flex items-start space-x-2.5 text-xs text-amber-900 shadow-2xs">
          <span className="text-base">⚠️</span>
          <div>
            <strong className="font-extrabold block text-amber-950">Penilaian Terkunci (Tanggal Belum Diatur):</strong>
            <p className="text-amber-800 leading-relaxed mt-0.5">
              Pertemuan {selectedMeetingIndex + 1} belum diatur tanggal aktifnya di Tab Jadwal oleh Admin. Sesuai aturan sistem, penilaian hanya berlaku pada kolom yang telah di-set tanggalnya. Pertemuan tanpa tanggal tidak dapat dinilai dan tidak akan pernah tersimpan ke penilaian.
            </p>
          </div>
        </div>
      )}

      {/* Notice jika tanggal sudah lewat (1 hari setelah jadwal -> terkunci otomatis) */}
      {isDateConfigured && lockStatus.isPast && (
        <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-3 flex items-start space-x-2.5 text-xs text-rose-950 shadow-2xs">
          <span className="text-base">🔒</span>
          <div>
            <strong className="font-extrabold block text-rose-950">Penilaian Terkunci Otomatis (Jadwal Telah Berakhir):</strong>
            <p className="text-rose-800 leading-relaxed mt-0.5">
              Jadwal pertemuan ini telah berlangsung pada <strong>{lockStatus.formattedDate}</strong>. Sistem otomatis mengunci kembali penilaian 1 hari setelah tanggal pelaksanaan untuk menjaga keaslian data nilai.
            </p>
          </div>
        </div>
      )}

      {/* Notice jika tanggal di masa depan (auto terbuka pada tanggal itu) */}
      {isDateConfigured && lockStatus.isFuture && (
        <div className="bg-sky-50 border border-sky-200/90 rounded-2xl p-3 flex items-start space-x-2.5 text-xs text-sky-950 shadow-2xs">
          <span className="text-base">📅</span>
          <div>
            <strong className="font-extrabold block text-sky-950">Auto Terbuka Pada {lockStatus.formattedDate}:</strong>
            <p className="text-sky-800 leading-relaxed mt-0.5">
              Penilaian pertemuan {selectedMeetingIndex + 1} akan terbuka secara otomatis tepat pada tanggal <strong>{lockStatus.formattedDate}</strong>. Saat ini pengisian nilai masih terkunci.
            </p>
          </div>
        </div>
      )}

      {/* Notice jika terbuka hari ini */}
      {isDateConfigured && lockStatus.isOpenToday && (
        <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3 flex items-start space-x-2.5 text-xs text-emerald-950 shadow-2xs">
          <span className="text-base">✨</span>
          <div>
            <strong className="font-extrabold block text-emerald-950">Penilaian Terbuka Otomatis (Hari Ini):</strong>
            <p className="text-emerald-800 leading-relaxed mt-0.5">
              Hari ini adalah tanggal jadwal Pertemuan {selectedMeetingIndex + 1} ({lockStatus.formattedDate}). Pengisian nilai sikap aktif dan dapat langsung dinilai oleh Guru Pembina.
            </p>
          </div>
        </div>
      )}

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
            const mScore = getMeetingScore(student, selectedMeetingIndex);
            const mNotes = getMeetingNotes(student, selectedMeetingIndex);
            
            const predicate = mScore !== null ? getPredicate(mScore) : { text: 'Belum Dinilai', code: '-', color: 'slate' };
            const isUpdatedRecently = recentUpdatedId === student.id;
            const scoreStyle = getScoreColorScheme(mScore);

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
                      {mScore === 100 && (
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

                    {mNotes && (
                      <div className="text-[10px] text-slate-500 italic truncate mt-0.5">
                        "{mNotes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Bagian Kanan: Tombol Catatan + [▼] [ Nilai ] [▲] (Presisi di HP) */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  {/* Predikat label di tablet/desktop */}
                  <span className="hidden md:inline text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {mScore !== null ? predicate.code : '-'}
                  </span>

                  {/* Tombol Catatan */}
                  <button
                    type="button"
                    onClick={() => handleOpenNoteModal(student)}
                    disabled={!isScoringActive}
                    className={`p-1.5 rounded-lg transition-colors ${
                      !isScoringActive
                        ? 'text-slate-300 bg-slate-50 cursor-not-allowed'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer'
                    }`}
                    title={isScoringActive ? 'Tambah Catatan' : 'Terkunci'}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {/* Kontrol Nilai: [▼] Nilai [▲] */}
                  <div className={`flex items-center space-x-1 p-1 rounded-xl border ${
                    !isScoringActive ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-slate-100 border-slate-200/80'
                  }`}>
                    {/* Tombol Panah Bawah (▼) - Merah/Oranye */}
                    <button
                      type="button"
                      onClick={() => handleScoreChange(student, -10)}
                      disabled={!isScoringActive || (mScore !== null && mScore <= 0)}
                      aria-label="Kurangi nilai 10"
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs select-none transition-all ${
                        !isScoringActive || (mScore !== null && mScore <= 0)
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-xs cursor-pointer active:scale-90'
                      }`}
                    >
                      ▼
                    </button>

                    {/* Angka Nilai dengan Latar Berwarna Sesuai Tingkat Nilai */}
                    <div
                      className={`w-9 sm:w-11 px-1 py-1 rounded-lg border text-center flex items-center justify-center font-black text-xs sm:text-sm tracking-tight transition-all duration-300 shadow-2xs ${scoreStyle.card}`}
                      title={mScore !== null ? `Nilai: ${mScore} (${scoreStyle.predicate})` : 'Belum Dinilai'}
                    >
                      {mScore !== null ? mScore : '-'}
                    </div>

                    {/* Tombol Panah Atas (▲) - Hijau */}
                    <button
                      type="button"
                      onClick={() => handleScoreChange(student, 10)}
                      disabled={!isScoringActive || (mScore !== null && mScore >= 100)}
                      aria-label="Tambah nilai 10"
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs select-none transition-all ${
                        !isScoringActive || (mScore !== null && mScore >= 100)
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
                disabled={!isScoringActive}
                onClick={() => handleSaveNotes(editingStudentId)}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-colors ${
                  !isScoringActive
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                }`}
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
