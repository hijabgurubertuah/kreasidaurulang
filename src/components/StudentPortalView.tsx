import React from 'react';
import { LogOut, Award } from 'lucide-react';
import { Student } from '../types';

interface StudentPortalViewProps {
  student: Student;
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

const getQuoteForScore = (score: number, seedStr: string) => {
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
      predicate: '-',
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
    // Kuning / Yellow (70)
    return {
      card: 'bg-yellow-400 text-yellow-950 border-yellow-300 shadow-xs',
      textScore: 'text-yellow-950 font-black',
      label: 'text-yellow-900 font-bold',
      badge: 'bg-yellow-950 text-yellow-200 border-yellow-400 font-extrabold',
      heroBg: 'bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-400 text-yellow-950 border-2 border-yellow-300 shadow-xl shadow-yellow-400/20',
      heroBadge: 'bg-yellow-950 text-yellow-200 border border-yellow-400',
      subtext: 'text-yellow-900',
      predicate: 'Kurang',
    };
  }

  if (score >= 60) {
    // Cokelat Sedang / Medium Brown (60)
    return {
      card: 'bg-amber-900 text-amber-50 border-amber-800 shadow-xs',
      textScore: 'text-amber-50 font-black',
      label: 'text-amber-100 font-bold',
      badge: 'bg-amber-950 text-amber-200 border-amber-600 font-extrabold',
      heroBg: 'bg-gradient-to-br from-amber-800 via-amber-900 to-stone-900 text-amber-50 border-2 border-amber-700 shadow-xl shadow-amber-900/20',
      heroBadge: 'bg-amber-950 text-amber-200 border border-amber-600',
      subtext: 'text-amber-100',
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
  onLogout,
}) => {
  // Calculate average score based on filled meetings (up to 20 meetings)
  const meetingScores = student.meetingScores || [];
  const validScores = meetingScores.filter(
    (s): s is number => typeof s === 'number' && s !== null
  );

  // If no explicit meeting scores array exists, use student.score as Pertemuan 1
  const effectiveValidScores =
    validScores.length > 0 ? validScores : [student.score];
  const totalCompletedMeetings = effectiveValidScores.length;
  const averageScore = Math.round(
    effectiveValidScores.reduce((sum, val) => sum + val, 0) /
      totalCompletedMeetings
  );

  const heroStyle = getScoreColorScheme(averageScore);
  const selectedQuote = getQuoteForScore(averageScore, student.nisn || student.id);

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-4 animate-fadeIn">
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
            Pertemuan Terisi: <strong>{totalCompletedMeetings}</strong> dari 20
          </div>
        </div>

        <div className="flex flex-col items-center justify-center bg-black/15 backdrop-blur-md px-6 py-3.5 rounded-2xl border border-white/20 min-w-[160px] z-10 shrink-0">
          <div className="text-4xl sm:text-5xl font-black tracking-tight">
            {averageScore}
          </div>
          <div className={`mt-2 px-4 py-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider border animate-pulse shadow-xs ${heroStyle.heroBadge}`}>
            {heroStyle.predicate}
          </div>
        </div>

        {/* UCAPAN SESUAI RATA-RATA NILAI (TANPA ICON BALON TEKS) */}
        <div className="w-full z-10 pt-3 mt-1 border-t border-black/10 sm:border-white/20 flex items-center justify-center sm:justify-start">
          <p className={`text-xs sm:text-sm font-bold italic text-center sm:text-left ${heroStyle.subtext}`}>
            "{selectedQuote}"
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/30 rounded-xl transition-colors cursor-pointer text-white/90 hover:text-white"
          title="Keluar / Switch Akun"
        >
          <LogOut className="w-4 h-4" />
        </button>
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
            let score: number | null = null;

            if (meetingScores[idx] !== undefined && meetingScores[idx] !== null) {
              score = meetingScores[idx];
            } else if (idx === 0) {
              score = student.score;
            }

            const itemStyle = getScoreColorScheme(score);

            return (
              <div
                key={meetingNum}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-between space-y-2 transition-all ${itemStyle.card}`}
              >
                {/* Score Value (Besar) */}
                <div className="text-center py-0.5">
                  <div className={`text-3xl sm:text-4xl font-black tracking-tight ${itemStyle.textScore}`}>
                    {score !== null ? score : '-'}
                  </div>
                </div>

                {/* Predikat di Bawah Nilai (Berdenyut) */}
                {score !== null ? (
                  <div className={`text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 rounded-md border animate-pulse shadow-2xs ${itemStyle.badge}`}>
                    {itemStyle.predicate}
                  </div>
                ) : (
                  <div className="text-[10px] italic opacity-60">
                    Belum Terisi
                  </div>
                )}

                {/* Pertemuan Label */}
                <div className={`text-[10px] font-bold uppercase tracking-wider text-center pt-1 border-t border-black/10 sm:border-white/20 w-full ${itemStyle.label}`}>
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
  );
};
