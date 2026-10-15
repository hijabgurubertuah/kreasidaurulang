import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Award, BookOpen, Calendar, ChevronRight, X } from 'lucide-react';
import { Student, MeetingSchedule } from '../types';
import { isMeetingOpened, formatIndonesianDate } from '../utils/scheduleHelper';
import { StudentModuleLearningView } from './StudentModuleLearningView';

interface StudentPortalViewProps {
  student: Student;
  schedules?: MeetingSchedule[];
  onLogout: () => void;
}

// Quotes based on score tier (2 options each)
const SCORE_QUOTES: Record<number, string[]> = {
  100: [
    'Sikap sangat teladan, terus jadi contoh bagi teman-teman.',
    'Luar biasa! Sikapmu sudah sangat sempurna, pertahankan.',
  ],
  90: [
    'Sikapmu sangat baik, semangat terus menuju lebih baik lagi.',
    'Hebat, sikap yang ditunjukkan sudah sangat positif.',
  ],
  80: [
    'Sikapmu sudah baik, pertahankan dan terus tingkatkan.',
    'Bagus, terus jaga sikap positif ini ya.',
  ],
  70: [
    'Sikap masih perlu diperbaiki, ayo lebih disiplin lagi.',
    'Perlu peningkatan sikap, semangat untuk lebih baik.',
  ],
  60: [
    'Sikap masih jauh dari harapan, perlu perhatian dan bimbingan lebih.',
    'Butuh kesadaran lebih untuk memperbaiki sikap sehari-hari.',
  ],
  50: [
    'Sikap perlu perbaikan serius, perlu bimbingan khusus dari guru dan orang tua.',
    'Sangat memprihatinkan, perlu pendampingan intensif untuk perbaikan sikap.',
  ],
};

export const getQuoteForScore = (score: number, seedStr: string) => {
  let categoryKey = 50;
  if (score >= 100) categoryKey = 100;
  else if (score >= 90) categoryKey = 90;
  else if (score >= 80) categoryKey = 80;
  else if (score >= 70) categoryKey = 70;
  else if (score >= 60) categoryKey = 60;

  const quotes = SCORE_QUOTES[categoryKey];
  let sum = 0;
  for (let i = 0; i < seedStr.length; i++) {
    sum += seedStr.charCodeAt(i);
  }
  const index = sum % quotes.length;
  return quotes[index];
};
// 100 = Emas (Gold)
// 90 = Perak (Silver)
// 80 = Hijau (Green)
// 70 = Kuning (Yellow)
// 60 = Ungu (Purple)
// <60 (50) = Merah (Red)
export const getScoreColorScheme = (score: number | null) => {
  if (score === null || score === undefined) {
    return {
      card: 'bg-slate-100 text-slate-400 border-slate-300 border-dashed',
      textScore: 'text-slate-300',
      label: 'text-slate-400',
      badge: 'bg-slate-200 text-slate-500 border-slate-300',
      heroBg: 'bg-slate-800 text-white border-slate-700',
      heroBadge: 'bg-slate-700 text-slate-300 border-slate-600',
      subtext: 'text-slate-400',
      predicate: 'Terkunci',
    };
  }

  if (score === 0) {
    return {
      card: 'bg-rose-50 text-rose-900 border-rose-300 shadow-xs',
      textScore: 'text-rose-700 font-black',
      label: 'text-rose-900 font-bold',
      badge: 'bg-rose-600 text-white border-rose-700 font-extrabold',
      heroBg: 'bg-gradient-to-br from-rose-800 via-rose-900 to-slate-900 text-white border-2 border-rose-500',
      heroBadge: 'bg-rose-950 text-rose-200 border border-rose-400',
      subtext: 'text-rose-200',
      predicate: 'Tidak Hadir',
    };
  }

  if (score >= 100) {
    // Emas / Gold (100)
    return {
      card: 'bg-amber-400 text-amber-950 border-amber-300 shadow-xs',
      textScore: 'text-amber-950 font-black',
      label: 'text-amber-900 font-bold',
      badge: 'bg-amber-950 text-amber-300 border-amber-400 font-extrabold',
      heroBg: 'bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 text-amber-950 border-2 border-amber-300 shadow-xl shadow-amber-400/20',
      heroBadge: 'bg-amber-950 text-amber-300 border border-amber-400',
      subtext: 'text-amber-900',
      predicate: 'Sempurna',
    };
  }

  if (score >= 90) {
    // Hijau Keemasan / Emerald-Gold Gradient (90)
    return {
      card: 'bg-gradient-to-r from-emerald-700 via-teal-600 to-amber-500 text-white border-amber-300/80 shadow-xs',
      textScore: 'text-white font-black',
      label: 'text-amber-100 font-bold',
      badge: 'bg-emerald-950 text-amber-300 border-amber-400 font-extrabold',
      heroBg: 'bg-gradient-to-br from-emerald-800 via-teal-700 to-amber-500 text-white border-2 border-amber-300 shadow-xl shadow-emerald-600/30',
      heroBadge: 'bg-emerald-950 text-amber-300 border border-amber-400',
      subtext: 'text-amber-100',
      predicate: 'Sangat Baik',
    };
  }

  if (score >= 80) {
    // Hijau / Green (80)
    return {
      card: 'bg-emerald-600 text-white border-emerald-500 shadow-xs',
      textScore: 'text-white font-black',
      label: 'text-emerald-100 font-bold',
      badge: 'bg-emerald-950 text-emerald-200 border-emerald-400 font-extrabold',
      heroBg: 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white border-2 border-emerald-500 shadow-xl shadow-emerald-600/20',
      heroBadge: 'bg-emerald-950 text-emerald-200 border border-emerald-400',
      subtext: 'text-emerald-100',
      predicate: 'Baik',
    };
  }

  if (score >= 70) {
    // Biru Terang Agak Pekat / Vibrant Royal Blue (70)
    return {
      card: 'bg-blue-600 text-white border-blue-500 shadow-xs',
      textScore: 'text-white font-black',
      label: 'text-blue-100 font-bold',
      badge: 'bg-blue-950 text-blue-200 border-blue-400 font-extrabold',
      heroBg: 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white border-2 border-blue-400 shadow-xl shadow-blue-600/20',
      heroBadge: 'bg-blue-950 text-blue-200 border border-blue-400',
      subtext: 'text-blue-100',
      predicate: 'Cukup',
    };
  }

  if (score >= 60) {
    // Lavender / Ungu Lavender (60)
    return {
      card: 'bg-purple-500 text-white border-purple-400 shadow-xs',
      textScore: 'text-white font-black',
      label: 'text-purple-100 font-bold',
      badge: 'bg-purple-950 text-purple-200 border-purple-400 font-extrabold',
      heroBg: 'bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 text-white border-2 border-purple-400 shadow-xl shadow-purple-500/20',
      heroBadge: 'bg-purple-950 text-purple-200 border border-purple-400',
      subtext: 'text-purple-100',
      predicate: 'Sangat kurang',
    };
  }

  // Merah / Red (50 / <60)
  return {
    card: 'bg-rose-600 text-white border-rose-500 shadow-xs',
    textScore: 'text-white font-black',
    label: 'text-rose-100 font-bold',
    badge: 'bg-rose-950 text-rose-200 border-rose-400 font-extrabold',
    heroBg: 'bg-gradient-to-br from-rose-600 via-rose-700 to-rose-800 text-white border-2 border-rose-500 shadow-xl shadow-rose-600/20',
    heroBadge: 'bg-rose-950 text-rose-200 border border-rose-400',
    subtext: 'text-rose-100',
    predicate: 'Buruk',
  };
};

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  student,
  schedules = [],
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'sikap' | 'modul'>('modul');
  const [isSikapSidebarOpen, setIsSikapSidebarOpen] = useState(false);

  // Calculate average score based strictly on OPENED meetings (activeDate <= today)
  const meetingScores = student.meetingScores || [];
  const meetingAbsences = student.meetingAbsences || [];
  const validScores: number[] = [];
  
  for (let i = 0; i < 20; i++) {
    const sched = schedules.find((s) => s.meetingNumber === i + 1);
    if (isMeetingOpened(sched)) {
      if (meetingAbsences[i] === true) {
        validScores.push(0);
      } else {
        const raw = meetingScores[i];
        const sc = typeof raw === 'number' && raw !== null ? raw : 80;
        validScores.push(sc);
      }
    }
  }

  const totalOpenedMeetings = validScores.length;
  const averageScore = totalOpenedMeetings > 0
    ? Math.round(validScores.reduce((sum, val) => sum + val, 0) / totalOpenedMeetings)
    : (student.score && student.score > 0 ? student.score : 80);

  const heroStyle = getScoreColorScheme(averageScore);
  const selectedQuote = totalOpenedMeetings > 0
    ? getQuoteForScore(averageScore, student.nisn || student.id)
    : 'Penilaian kokurikuler belum dimulai. Pantau jadwal pertemuan untuk melihat hasil penilaian sikap.';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#063327] via-[#094233] to-[#041c16] text-slate-100 py-4 px-3 sm:px-6 animate-fadeIn">
      <div className="w-full max-w-5xl mx-auto space-y-4">
        {/* KONTEN TAB: MATERI MODUL */}
        {activeTab === 'modul' && (
          <StudentModuleLearningView
            student={student}
            currentTab={activeTab}
            onSwitchTab={setActiveTab}
            onLogout={onLogout}
          />
        )}

      {/* KONTEN TAB: PENILAIAN SIKAP (FITUR LAMA TETAP TERJAGA 100%) */}
      {activeTab === 'sikap' && (
        <div className="space-y-4 animate-fadeIn">
          {/* PALING ATAS: KOTAK RATA-RATA NILAI SIKAP (WARNA SESUAI NILAI RATA-RATA) */}
          <div className={`rounded-3xl p-5 sm:p-7 pr-12 sm:pr-14 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 relative overflow-hidden ${heroStyle.heroBg}`}>
            <div className="text-center sm:text-left space-y-1.5 z-10 min-w-0 flex-1">
              <div className={`leading-tight uppercase ${heroStyle.subtext}`}>
                <span className="text-sm sm:text-base font-black tracking-wide block">
                  NILAI SIKAP
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold tracking-widest block opacity-90 my-0.5">
                  SELAMA
                </span>
                <span className="text-[11px] sm:text-xs font-extrabold tracking-wider block">
                  KOKURIKULER KREASI DAUR ULANG
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black truncate leading-tight pt-1">
                {student.name}
              </h2>
              <div className={`text-xs font-mono truncate ${heroStyle.subtext}`}>
                NISN: <strong>{student.nisn}</strong> • {student.className}
              </div>
              <div className={`text-xs mt-1 ${heroStyle.subtext}`}>
                Pertemuan Terbuka: <strong>{totalOpenedMeetings}</strong> dari 20
              </div>
            </div>

            <div className="flex flex-col items-center justify-center bg-black/15 backdrop-blur-md px-6 py-3.5 rounded-2xl border border-white/20 min-w-[160px] z-10 shrink-0">
              <div className="text-4xl sm:text-5xl font-black tracking-tight">
                {totalOpenedMeetings > 0 ? averageScore : '-'}
              </div>
              <div className={`mt-2 px-4 py-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider border animate-pulse shadow-xs ${heroStyle.heroBadge}`}>
                {totalOpenedMeetings > 0 ? heroStyle.predicate : 'Belum Ada Penilaian'}
              </div>
            </div>

            {/* UCAPAN SESUAI RATA-RATA NILAI (TANPA ICON BALON TEKS) */}
            <div className="w-full z-10 pt-3 mt-1 border-t border-black/10 sm:border-white/20 flex items-center justify-center sm:justify-start">
              <p className={`text-xs sm:text-sm font-bold italic text-center sm:text-left ${heroStyle.subtext}`}>
                "{selectedQuote}"
              </p>
            </div>
          </div>

          {/* GRID 2 KEKANAN (HP) & 10 KE BAWAH = 20 KOTAK PERTEMUAN */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
              <span>Nilai Pertemuan (1 s.d. 20)</span>
              <span className="text-[11px] text-slate-500 font-normal">20 Kali Penilaian</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 20 }, (_, idx) => {
                const meetingNum = idx + 1;
                const sched = schedules.find((s) => s.meetingNumber === meetingNum);
                const isOpened = isMeetingOpened(sched);
                const isAbsent = meetingAbsences[idx] === true;
                let score: number | null = null;
                let statusText = 'Terkunci';

                if (isOpened) {
                  if (isAbsent) {
                    score = 0;
                    statusText = 'Tidak Hadir';
                  } else {
                    const raw = meetingScores[idx];
                    score = typeof raw === 'number' && raw !== null ? raw : 80;
                  }
                } else if (sched?.activeDate && sched.activeDate.trim() !== '') {
                  statusText = `Buka: ${formatIndonesianDate(sched.activeDate)}`;
                } else {
                  statusText = 'Belum Diatur';
                }

                const itemStyle = getScoreColorScheme(score);

                return (
                  <div
                    key={meetingNum}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-between space-y-2 transition-all ${
                      isOpened ? itemStyle.card : 'bg-slate-50 text-slate-400 border-slate-200 opacity-75'
                    }`}
                  >
                    {/* Score Value (Besar) */}
                    <div className="text-center py-0.5">
                      <div className={`text-3xl sm:text-4xl font-black tracking-tight ${isOpened ? itemStyle.textScore : 'text-slate-300'}`}>
                        {score !== null ? score : '-'}
                      </div>
                    </div>

                    {/* Predikat di Bawah Nilai (Berdenyut) */}
                    {score !== null ? (
                      <div className={`text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 rounded-md border animate-pulse shadow-2xs ${itemStyle.badge}`}>
                        {itemStyle.predicate}
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md truncate max-w-full text-center">
                        {statusText}
                      </div>
                    )}

                    {/* Pertemuan Label */}
                    <div className={`text-[10px] font-bold uppercase tracking-wider text-center pt-1 border-t border-black/10 sm:border-white/20 w-full ${isOpened ? itemStyle.label : 'text-slate-400'}`}>
                      Pertemuan {meetingNum}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Catatan Ringkas Guru (Jika ada) */}
          {student.notes && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-start space-x-3">
              <Award className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700">
                <strong className="font-bold text-slate-900 block mb-0.5">Catatan Guru:</strong>
                <p className="italic">"{student.notes}"</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* JIKA DI TAB SIKAP, SEDIAKAN TOMBOL PEMICU SIDEBAR AGAR SISWA BISA KEMBALI KE MATERI MODUL / KELUAR */}
      {activeTab === 'sikap' && !isSikapSidebarOpen && typeof document !== 'undefined' &&
        createPortal(
          <button
            type="button"
            onClick={() => setIsSikapSidebarOpen(true)}
            title="Buka Menu Navigasi"
            aria-label="Buka Menu Navigasi"
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[9990] w-[30px] h-[120px] bg-gradient-to-b from-teal-600 via-teal-700 to-emerald-800 hover:from-teal-500 hover:to-teal-600 text-white rounded-r-2xl shadow-2xl shadow-teal-950/50 flex flex-col items-center justify-between py-2.5 cursor-pointer border-r-2 border-y border-teal-300/50 active:scale-95 transition-all group select-none pointer-events-auto"
            style={{ position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 9990 }}
          >
            <BookOpen className="w-4 h-4 text-teal-200 group-hover:scale-110 transition-transform shrink-0" />
            <div className="flex flex-col items-center justify-center text-[10px] font-black tracking-tighter leading-[1.1] text-teal-100 select-none pointer-events-none">
              <span>M</span>
              <span>E</span>
              <span>N</span>
              <span>U</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-teal-300 animate-pulse shrink-0" />
          </button>,
          document.body
        )}

      {/* DRAWER SIDEBAR TOSKA SAAT DI TAB SIKAP */}
      {activeTab === 'sikap' && isSikapSidebarOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
              style={{ position: 'fixed', inset: 0 }}
              onClick={() => setIsSikapSidebarOpen(false)}
            />
            <div className="relative w-80 max-w-[85vw] bg-gradient-to-b from-[#0b3838] via-[#082e2f] to-[#041a1b] text-teal-50 h-full shadow-2xl p-4 flex flex-col z-10 animate-slideRight border-r border-teal-500/30">
              <div className="flex items-center justify-between pb-3.5 border-b border-teal-500/20">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-teal-900/90 border border-teal-400/40 p-1 flex items-center justify-center shrink-0 shadow-inner">
                    <img
                      src="https://i.ibb.co.com/nqfqhc29/kdu.png"
                      alt="Logo KDU"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-xs text-white leading-tight truncate">
                      SMP Negeri 1 Bengkalis
                    </h3>
                    <span className="text-[10px] text-teal-300 font-semibold block truncate">
                      Portal Siswa
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSikapSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-teal-300 hover:text-white hover:bg-teal-800/50 cursor-pointer transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1.5 py-3 border-b border-teal-500/20">
                <span className="text-[10px] uppercase font-black text-teal-400 tracking-wider px-1">
                  Menu Utama
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('modul');
                    setIsSikapSidebarOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-black text-teal-100 hover:text-white hover:bg-teal-800/50 transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>Materi Modul</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('sikap');
                    setIsSikapSidebarOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-black bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30 transition-all cursor-pointer"
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>Penilaian Sikap (20 Pertemuan)</span>
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-rose-100 hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Keluar Akun</span>
                  </button>
                )}
              </div>

              <div className="mt-auto pt-3 border-t border-teal-500/20">
                <div className="p-2.5 bg-teal-950/80 rounded-xl border border-teal-500/30 text-xs">
                  <span className="text-[9px] uppercase font-black text-teal-400 block tracking-wider">
                    Siswa Aktif
                  </span>
                  <p className="font-bold text-white truncate">{student.name}</p>
                  <p className="text-[10px] text-teal-300">NISN: {student.nisn} ({student.className})</p>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};
