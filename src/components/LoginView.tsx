import React, { useState } from 'react';
import { ScanLine, Leaf, Sparkles, RefreshCw } from 'lucide-react';
import { Student, TeacherCode, CurrentUser } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginViewProps {
  students: Student[];
  teacherCodes: TeacherCode[];
  onLoginSuccess: (user: CurrentUser) => void;
  isPreloaded?: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({
  students,
  teacherCodes,
  onLoginSuccess,
}) => {
  const [inputValue, setInputValue] = useState(() => {
    try {
      return localStorage.getItem('smpn1bks_saved_code') || '';
    } catch (_) {
      return '';
    }
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const saveLastCode = (code: string) => {
    try {
      localStorage.setItem('smpn1bks_saved_code', code);
    } catch (_) {}
  };

  const attemptLogin = (rawValue: string) => {
    setErrorMessage('');
    const clean = rawValue.trim();

    if (!clean) {
      setErrorMessage('Masukkan NISN siswa atau kode login.');
      return;
    }

    const cleanLower = clean.toLowerCase();

    // 1. Kode Khusus Masuk Portal Admin (admin123)
    if (cleanLower === 'admin123') {
      saveLastCode(clean);
      onLoginSuccess({
        role: 'admin',
        identifier: 'ADMIN123',
        name: 'Administrator Portal & Koordinator P5',
      });
      return;
    }

    // 2. Kode Khusus Masuk Sebagai Guru (guru123)
    if (cleanLower === 'guru123' || cleanLower === 'guru2026') {
      saveLastCode(clean);
      onLoginSuccess({
        role: 'teacher',
        identifier: 'GURU123',
        name: 'Guru Pembina Kokurikuler Daur Ulang',
      });
      return;
    }

    // 3. Kode Khusus Uji Coba Halaman Siswa (siswa123)
    if (cleanLower === 'siswa123') {
      saveLastCode(clean);
      const demoStudent = students[0] || {
        id: 'std-trial-01',
        nisn: 'SISWA123',
        name: 'Siswa Uji Coba (Demo 7A)',
        classId: 'class-7a',
        className: 'Kelas 7A',
        score: 80,
        projectTitle: 'Pot Gantung Tanaman dari Botol Plastik',
        notes: 'Akun uji coba untuk memantau nilai sikap kreasi daur ulang.',
      };
      onLoginSuccess({
        role: 'student',
        identifier: demoStudent.nisn,
        name: demoStudent.name,
        studentData: demoStudent,
      });
      return;
    }

    // 4. Cek NISN Siswa dari database
    const foundStudent = students.find(
      (s) => s.nisn.toLowerCase() === cleanLower
    );
    if (foundStudent) {
      saveLastCode(clean);
      onLoginSuccess({
        role: 'student',
        identifier: foundStudent.nisn,
        name: foundStudent.name,
        studentData: foundStudent,
      });
      return;
    }

    // 5. Cek Kode Akses Guru / Admin dari database
    const cleanUpper = clean.toUpperCase();
    const foundTeacher = teacherCodes.find(
      (tc) => tc.code.toUpperCase() === cleanUpper
    );
    if (foundTeacher) {
      saveLastCode(clean);
      onLoginSuccess({
        role: foundTeacher.role,
        identifier: foundTeacher.code,
        name: foundTeacher.name,
        teacherData: foundTeacher,
      });
      return;
    }

    setErrorMessage('NISN atau Kode tidak terdaftar.');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    attemptLogin(inputValue);
  };

  const handleScanSuccess = (scannedText: string) => {
    setInputValue(scannedText);
    attemptLogin(scannedText);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between items-center px-4 py-8 bg-gradient-to-br from-emerald-700 via-teal-800 to-emerald-950 text-white overflow-hidden select-none">
      {/* Styles for slow-floating recycling/particles & 3D Rotate Y */}
      <style>{`
        @keyframes rotateY3D {
          0% { transform: perspective(800px) rotateY(0deg); }
          50% { transform: perspective(800px) rotateY(180deg); }
          100% { transform: perspective(800px) rotateY(360deg); }
        }
        .anim-rotate-y {
          animation: rotateY3D 9s linear infinite;
          transform-style: preserve-3d;
          will-change: transform;
        }
        @keyframes floatSlow {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(180deg); }
          100% { transform: translateY(0px) rotate(360deg); }
        }
        @keyframes floatFast {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-90deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .anim-float-1 { animation: floatSlow 15s ease-in-out infinite; }
        .anim-float-2 { animation: floatSlow 20s ease-in-out infinite 2s; }
        .anim-float-3 { animation: floatSlow 25s ease-in-out infinite 4s; }
        .anim-float-4 { animation: floatFast 12s ease-in-out infinite 1s; }
        .anim-float-5 { animation: floatFast 18s ease-in-out infinite 3s; }
      `}</style>

      {/* Floating subtle "waste/recycle" organic particles in background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.08] z-0">
        {/* Particle 1: Recycling Logo Icon */}
        <div className="absolute top-[15%] left-[10%] anim-float-1 text-emerald-300">
          <RefreshCw className="w-24 h-24 stroke-[1]" />
        </div>
        {/* Particle 2: Leaf Icon */}
        <div className="absolute top-[60%] left-[8%] anim-float-2 text-teal-200">
          <Leaf className="w-20 h-20 stroke-[1]" />
        </div>
        {/* Particle 3: Plastic Bottle Outline Shape */}
        <div className="absolute top-[25%] right-[12%] anim-float-3 text-cyan-300">
          <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M12 2v3M9 5h6v3H9V5zm-1 3h8c1 0 2 .5 2 1.5v10c0 1.5-1 2.5-2.5 2.5h-9C5 22 4 21 4 19.5v-10C4 8.5 5 8 6 8h2z" />
          </svg>
        </div>
        {/* Particle 4: Crumpled Can/Paper Shape */}
        <div className="absolute bottom-[15%] right-[10%] anim-float-4 text-amber-200">
          <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <polygon points="6 2 18 2 20 6 20 18 18 22 6 22 4 18 4 6" />
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </div>
        {/* Particle 5: Organic Circle Grid */}
        <div className="absolute top-[45%] left-[45%] anim-float-5 text-white">
          <Sparkles className="w-14 h-14 stroke-[1]" />
        </div>
        {/* Additional organic leaf floating */}
        <div className="absolute bottom-[40%] right-[35%] anim-float-2 text-emerald-200">
          <Leaf className="w-16 h-16 stroke-[1] rotate-45" />
        </div>
      </div>

      {/* Spacer top */}
      <div />

      {/* Main Login Container */}
      <div className="w-full max-w-sm flex flex-col items-center space-y-4 z-10">
        {/* LOGO ROTATE Y DI ATAS HALAMAN LOGIN (Lengkap, tidak tertutupi) */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative group p-2">
            {/* Ambient soft glow */}
            <div className="absolute inset-0 bg-emerald-300/30 rounded-full blur-2xl scale-125 pointer-events-none" />
            <img
              src="https://i.ibb.co.com/nqfqhc29/kdu.png"
              alt="Logo Modul Kreasi Daur Ulang"
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)] anim-rotate-y relative z-10"
              loading="eager"
            />
          </div>
        </div>

        {/* Judul di atas kolom login - Multi-line Typographic Hierarchy */}
        <div className="text-center px-2 space-y-1.5">
          <h1 className="font-extrabold tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-amber-300 uppercase text-3xl sm:text-4xl drop-shadow-md">
            Penilaian Sikap
          </h1>
          
          <h2 className="font-extrabold text-xs sm:text-sm text-emerald-200 tracking-wider uppercase block leading-normal max-w-xs mx-auto">
            Modul Kokurikuler Kreasi Daur Ulang
          </h2>
          
          <div className="w-10 h-1 bg-amber-400 mx-auto rounded-full my-2 opacity-80" />
          
          <h3 className="font-semibold text-xs sm:text-xs text-emerald-100/90 tracking-widest uppercase block">
            SMP Negeri 1 Bengkalis
          </h3>
        </div>

        {/* Login Card (Glassmorphism + Modern Clean Aesthetic) */}
        <div className="w-full bg-slate-900/85 backdrop-blur-md rounded-3xl shadow-2xl border border-white/15 p-5 sm:p-7 space-y-4 relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              {/* Keterangan di atas kolom */}
              <label className="block text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-2.5">
                MASUKKAN NISN / KODE LOGIN
              </label>

              {/* UNIFIED INPUT + SCAN BUTTON IN ONE SINGLE FIELD */}
              <div className="relative flex items-center bg-slate-800/90 rounded-2xl border-2 border-emerald-600/40 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/30 overflow-hidden shadow-inner transition-all">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="NISN / KODE AKSES"
                  autoFocus
                  className="w-full pl-4 pr-12 py-3.5 text-sm font-black text-white placeholder:text-slate-500 bg-transparent uppercase border-none outline-none focus:outline-none focus:ring-0"
                />

                {/* Tombol Scan Barcode di satukan di ujung kanan kolom */}
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="absolute right-2 p-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 rounded-xl transition-all cursor-pointer shrink-0 active:scale-90 shadow-sm"
                  title="Scan Barcode / QR Kamera"
                >
                  <ScanLine className="w-4 h-4" />
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="text-xs text-rose-300 font-bold px-2 bg-rose-950/60 border border-rose-700/50 py-2 rounded-xl flex items-center space-x-1.5 animate-fadeIn">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Tombol Masuk dengan gradasi modern berwarna-warni */}
            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-400 hover:from-emerald-400 hover:via-teal-400 hover:to-amber-300 active:scale-[0.98] text-slate-950 font-black rounded-2xl text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
            >
              MASUK KE PORTAL
            </button>
          </form>

          {/* Quick PWA Install Option */}
          <div className="pt-1 flex justify-center">
            <PWAInstallButton variant="login" />
          </div>
        </div>
      </div>

      {/* Footer By. TIM MODUL KREASI DAUR ULANG (Kecil dan miring) */}
      <footer className="text-center pt-8 pb-2 z-10">
        <p className="text-[10px] text-emerald-200/80 font-extrabold uppercase tracking-widest flex items-center justify-center space-x-1.5">
          <span>Oleh:</span>
          <span className="text-amber-300">Tim Modul Kreasi Daur Ulang</span>
        </p>
      </footer>

      {/* Modal Scanner Kamera Barcode */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
};


