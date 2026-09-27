import React, { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { Student, TeacherCode, CurrentUser } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';

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
    <div className="min-h-screen flex flex-col justify-between items-center px-4 py-8 bg-slate-50">
      {/* Spacer top */}
      <div />

      {/* Main Login Card */}
      <div className="w-full max-w-sm flex flex-col items-center space-y-5">
        {/* Judul di atas kolom login */}
        <div className="text-center px-1 space-y-1">
          <h1 className="text-xs sm:text-sm md:text-base font-black tracking-tight text-slate-900 leading-snug uppercase">
            PENILAIAN SIKAP MODUL KOKURIKULER KREASI DAUR ULANG KELAS 7 SMP NEGERI 1 BENGKALIS
          </h1>
        </div>

        <div className="w-full bg-white rounded-3xl shadow-lg border border-slate-200/90 p-5 sm:p-7 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              {/* Keterangan di atas kolom */}
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                MASUKKAN NISN / KODE LOGIN
              </label>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="NISN / KODE"
                  autoFocus
                  className="flex-1 px-4 py-3 text-sm font-semibold rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all bg-slate-50/50 uppercase"
                />

                {/* Tombol Scan Barcode Kamera Dekat */}
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="p-3 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-2xl border border-slate-300 hover:border-emerald-500 transition-all cursor-pointer shrink-0 active:scale-95"
                  title="Scan Barcode / QR Kamera"
                >
                  <ScanLine className="w-5 h-5" />
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="text-xs text-rose-600 font-semibold px-1">
                {errorMessage}
              </div>
            )}

            {/* Tombol Masuk tanpa tanda panah */}
            <button
              type="submit"
              className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-700/20 transition-all cursor-pointer active:scale-[0.98]"
            >
              Masuk
            </button>
          </form>
        </div>
      </div>

      {/* Footer By. TIM MODUL KREASI DAUR ULANG (Kecil dan miring) */}
      <footer className="text-center pt-8 pb-2">
        <p className="text-xs text-slate-500 italic">
          By. TIM MODUL KREASI DAUR ULANG
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
