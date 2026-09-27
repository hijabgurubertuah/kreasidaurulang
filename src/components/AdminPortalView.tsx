import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users,
  KeyRound,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  UploadCloud,
  Download,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  GraduationCap,
  Save,
  X,
  Link as LinkIcon,
  LayoutDashboard,
} from 'lucide-react';
import { ClassRoom, Student, TeacherCode } from '../types';
import { parseStudentCsv, ParsedCsvResult } from '../utils/csvParser';
import { downloadSampleCsvTemplate } from '../utils/excelExport';
import {
  parseGoogleSheetsUrl,
  fetchGoogleSheetCsv,
} from '../utils/googleSheetsSync';
import {
  getSpreadsheetUrlFromDb,
  saveSpreadsheetUrlInDb,
} from '../services/firestoreService';

interface AdminPortalViewProps {
  students: Student[];
  classes: ClassRoom[];
  teacherCodes: TeacherCode[];
  onBackToDashboard: () => void;
  onSaveStudent: (student: Student) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
  onCreateTeacherCode: (newCode: TeacherCode) => Promise<void>;
  onDeleteTeacherCode: (codeId: string) => Promise<void>;
  onSyncCsvData: (students: Student[], classes: ClassRoom[]) => Promise<void>;
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({
  students,
  classes,
  teacherCodes,
  onBackToDashboard,
  onSaveStudent,
  onDeleteStudent,
  onCreateTeacherCode,
  onDeleteTeacherCode,
  onSyncCsvData,
}) => {
  const [activeTab, setActiveTab] = useState<'spreadsheet' | 'students' | 'teachers'>('spreadsheet');

  // Search & filter for students
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');

  // Notifications
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Google Sheets Online Sync State
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  // Student Form (Add / Edit Modal)
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formNisn, setFormNisn] = useState('');
  const [formName, setFormName] = useState('');
  const [formClassName, setFormClassName] = useState('Kelas 7A');
  const [formScore, setFormScore] = useState(80);
  const [formProject, setFormProject] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  // Teacher Code Form
  const [newCodeInput, setNewCodeInput] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newRole, setNewRole] = useState<'teacher' | 'admin'>('teacher');
  const [assignedClass, setAssignedClass] = useState('');
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Manual File CSV State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedCsvResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSyncingFile, setIsSyncingFile] = useState(false);

  // Load saved spreadsheet URL from Firestore on mount
  useEffect(() => {
    getSpreadsheetUrlFromDb().then((savedUrl) => {
      if (savedUrl) {
        setSpreadsheetUrl(savedUrl);
      }
    });
  }, []);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
        s.nisn.includes(searchStudent);
      const matchClass = selectedClassFilter ? s.className === selectedClassFilter : true;
      return matchSearch && matchClass;
    });
  }, [students, searchStudent, selectedClassFilter]);

  // Parsed Sheet Info (for edit link)
  const sheetInfo = useMemo(() => {
    return parseGoogleSheetsUrl(spreadsheetUrl);
  }, [spreadsheetUrl]);

  // Pull / Fetch data directly from Google Sheets Link
  const handleFetchSpreadsheet = async () => {
    const cleanUrl = spreadsheetUrl.trim();
    if (!cleanUrl) {
      setErrorMessage('Tempelkan link Google Spreadsheet terlebih dahulu.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsFetchingSheet(true);

    try {
      // 1. Save URL in Firestore & memory so it's remembered
      await saveSpreadsheetUrlInDb(cleanUrl);

      // 2. Fetch CSV text from Google
      const csvText = await fetchGoogleSheetCsv(cleanUrl);

      // 3. Parse CSV (handles nama, kelas, nisn)
      const result = parseStudentCsv(csvText);

      if (result.students.length === 0) {
        throw new Error(
          result.errors.length > 0
            ? result.errors.join('; ')
            : 'Tidak ada data siswa ditemukan pada spreadsheet tersebut.'
        );
      }

      // 4. Sync immediately to Firebase Firestore
      await onSyncCsvData(result.students, result.classes);

      setSuccessMessage(
        `Berhasil menarik dan menyinkronkan ${result.students.length} siswa (${result.classes.length} kelas) ke Firebase!`
      );
    } catch (err: any) {
      console.error('Error fetching spreadsheet:', err);
      setErrorMessage(
        err.message || 'Gagal menarik data dari Google Spreadsheet. Periksa akses link.'
      );
    } finally {
      setIsFetchingSheet(false);
    }
  };

  // Open Edit Spreadsheet link directly
  const handleOpenEditSpreadsheet = () => {
    const targetUrl = sheetInfo.editUrl || spreadsheetUrl.trim();
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Student Form open handlers
  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setFormNisn('');
    setFormName('');
    setFormClassName(classes[0]?.name || 'Kelas 7A');
    setFormScore(80);
    setFormProject('Kreasi Daur Ulang Mandiri');
    setFormNotes('');
    setErrorMessage('');
    setIsStudentModalOpen(true);
  };

  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setFormNisn(student.nisn);
    setFormName(student.name);
    setFormClassName(student.className);
    setFormScore(student.score);
    setFormProject(student.projectTitle || '');
    setFormNotes(student.notes || '');
    setErrorMessage('');
    setIsStudentModalOpen(true);
  };

  const handleSaveStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNisn = formNisn.trim();
    const cleanName = formName.trim();

    if (!cleanNisn || !cleanName) {
      setErrorMessage('NISN dan Nama siswa wajib diisi.');
      return;
    }

    const duplicate = students.find(
      (s) => s.nisn === cleanNisn && (!editingStudent || s.id !== editingStudent.id)
    );
    if (duplicate) {
      setErrorMessage(`NISN "${cleanNisn}" sudah digunakan oleh siswa "${duplicate.name}".`);
      return;
    }

    setIsSavingStudent(true);
    setErrorMessage('');

    const classId = `class-${formClassName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const studentId = editingStudent
      ? editingStudent.id
      : `std-${cleanNisn.replace(/[^a-zA-Z0-9]/g, '') || Date.now()}`;

    const studentData: Student = {
      id: studentId,
      nisn: cleanNisn,
      name: cleanName,
      classId,
      className: formClassName,
      score: Math.max(0, Math.min(100, Math.round(formScore / 10) * 10)),
      projectTitle: formProject || 'Kreasi Daur Ulang Mandiri',
      notes: formNotes || '',
      lastUpdated: new Date().toISOString(),
    };

    try {
      await onSaveStudent(studentData);
      setIsStudentModalOpen(false);
      setSuccessMessage(`Data siswa "${cleanName}" tersimpan ke Firebase.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(`Gagal menyimpan: ${err.message}`);
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleDeleteStudentClick = async (student: Student) => {
    if (window.confirm(`Hapus siswa "${student.name}" (${student.nisn})?`)) {
      try {
        await onDeleteStudent(student.id);
        setSuccessMessage(`Siswa "${student.name}" berhasil dihapus.`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err: any) {
        setErrorMessage(`Gagal menghapus: ${err.message}`);
      }
    }
  };

  // Teacher Code Submit
  const handleCreateCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCodeInput.trim().toUpperCase();
    const cleanName = newTeacherName.trim();

    if (!cleanCode || !cleanName) {
      setErrorMessage('Kode login dan nama wajib diisi.');
      return;
    }

    if (teacherCodes.some((tc) => tc.code.toUpperCase() === cleanCode)) {
      setErrorMessage(`Kode login "${cleanCode}" sudah ada.`);
      return;
    }

    setIsSavingCode(true);
    setErrorMessage('');

    try {
      const newTeacher: TeacherCode = {
        id: `tc-${Date.now()}`,
        code: cleanCode,
        name: cleanName,
        role: newRole,
        assignedClass: assignedClass || undefined,
        createdAt: new Date().toISOString(),
      };
      await onCreateTeacherCode(newTeacher);
      setNewCodeInput('');
      setNewTeacherName('');
      setAssignedClass('');
      setSuccessMessage(`Kode login "${cleanCode}" berhasil disimpan.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(`Gagal: ${err.message}`);
    } finally {
      setIsSavingCode(false);
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 1500);
  };

  // Manual File CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseStudentCsv(text);
        setParsedData(result);
        if (result.errors.length > 0 && result.students.length === 0) {
          setErrorMessage(result.errors.join(', '));
        }
      } catch (err: any) {
        setErrorMessage(`Gagal membaca CSV: ${err.message}`);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleSyncManualFile = async () => {
    if (!parsedData || parsedData.students.length === 0) return;
    setIsSyncingFile(true);
    try {
      await onSyncCsvData(parsedData.students, parsedData.classes);
      setSuccessMessage(`Berhasil mengimpor ${parsedData.students.length} siswa ke Firebase.`);
      setParsedData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setErrorMessage(`Gagal sinkron: ${err.message}`);
    } finally {
      setIsSyncingFile(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-4 animate-fadeIn">
      {/* Header bar - minimalis & proporsional di HP */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-lg font-black text-slate-900 truncate leading-tight">
              Portal Admin
            </h2>
            <p className="text-[11px] text-slate-500 truncate">
              Kelola link spreadsheet, NISN siswa & kode guru
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToDashboard}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Dashboard</span>
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="break-words">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="break-words">{errorMessage}</span>
        </div>
      )}

      {/* Tab Navigation - Proporsional pas di bingkai layar HP */}
      <div className="grid grid-cols-3 bg-slate-200/80 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('spreadsheet');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1 sm:space-x-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'spreadsheet'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">Link Spreadsheet</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('students');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1 sm:space-x-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'students'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">Siswa ({students.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('teachers');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1 sm:space-x-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'teachers'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">Kode Guru ({teacherCodes.length})</span>
        </button>
      </div>

      {/* TAB 1: SPREADSHEET ONLINE SYNC & FILE CSV */}
      {activeTab === 'spreadsheet' && (
        <div className="space-y-4">
          {/* Main Card: Link Google Spreadsheet Online */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <LinkIcon className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wide">
                  Tautkan Link Google Spreadsheet
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Otomatis Sync Firebase
              </span>
            </div>

            {/* Input URL */}
            <div className="space-y-1">
              <input
                type="url"
                value={spreadsheetUrl}
                onChange={(e) => setSpreadsheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono text-slate-800"
              />
              <p className="text-[11px] text-slate-500">
                Format kolom spreadsheet: <strong>nama, kelas, nisn</strong> (pastikan link disetel: <em>Siapa saja dengan link dapat melihat</em>).
              </p>
            </div>

            {/* Tombol aksi: Buka Link & Tarik Data - Proporsional di HP */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              {/* Tombol Tarik Data & Update ke Firebase */}
              <button
                type="button"
                onClick={handleFetchSpreadsheet}
                disabled={isFetchingSheet || !spreadsheetUrl.trim()}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isFetchingSheet ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menarik Data & Update ke Firebase...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Tarik Data Baru & Simpan</span>
                  </>
                )}
              </button>

              {/* Tombol Buka Link Edit Spreadsheet Langsung */}
              <button
                type="button"
                onClick={handleOpenEditSpreadsheet}
                disabled={!spreadsheetUrl.trim()}
                className="flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-bold border border-slate-300 transition-colors cursor-pointer disabled:opacity-40"
                title="Buka Spreadsheet di tab baru untuk menambah atau mengedit siswa"
              >
                <ExternalLink className="w-4 h-4 text-slate-600" />
                <span>Buka Spreadsheet</span>
              </button>
            </div>
          </div>

          {/* Opsi Cadangan: Impor File CSV Manual */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-slate-500" />
                <span>Atau Unggah File CSV Manual</span>
              </span>
              <button
                type="button"
                onClick={downloadSampleCsvTemplate}
                className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Contoh CSV</span>
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-3 sm:p-4 text-center cursor-pointer bg-slate-50 hover:bg-emerald-50/40 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-xs font-semibold text-slate-700">
                {isParsing ? 'Memproses...' : 'Klik untuk memilih file CSV dari HP/Komputer'}
              </p>
            </div>

            {parsedData && (
              <div className="space-y-2 pt-1">
                <div className="text-xs font-bold text-slate-800">
                  Ditemukan: {parsedData.students.length} Siswa ({parsedData.classes.length} Kelas)
                </div>
                <button
                  type="button"
                  onClick={handleSyncManualFile}
                  disabled={isSyncingFile}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {isSyncingFile ? 'Menyinkronkan...' : 'Sinkronkan CSV ke Firebase'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PENGATURAN SISWA & NISN */}
      {activeTab === 'students' && (
        <div className="space-y-3">
          {/* Toolbar Search & Add Student */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Cari NISN atau Nama..."
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="flex-1 sm:flex-none px-2.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleOpenAddStudent}
                className="flex items-center justify-center space-x-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          {/* List Siswa - Responsif HP (Tampilan Kartu di Layar Kecil, Tabel di Layar Sedang/Besar) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Tampilan Kartu di HP (< sm) agar tidak keluar bingkai */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((st, idx) => (
                  <div key={st.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {idx + 1}. {st.name}
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-500">
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            NISN: {st.nisn}
                          </span>
                          <span>{st.className}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <span className="text-xs font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-lg">
                          {st.score}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditStudent(st)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudentClick(st)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  Tidak ada data siswa ditemukan.
                </div>
              )}
            </div>

            {/* Tampilan Tabel di Layar Tablet/Desktop (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-black text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">NISN (Kode Login)</th>
                    <th className="py-2.5 px-3">Nama Siswa</th>
                    <th className="py-2.5 px-3">Kelas</th>
                    <th className="py-2.5 px-3 text-center">Nilai</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((st, idx) => (
                      <tr key={st.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">
                          {st.nisn}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{st.className}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                          {st.score}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditStudent(st)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                              title="Ubah NISN / Siswa"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudentClick(st)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Tidak ada siswa ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between items-center">
              <span>Total: {filteredStudents.length} siswa</span>
              <span className="italic">Tersinkron ke Firebase</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENGATURAN KODE LOGIN GURU */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          {/* Form Buat Kode Guru */}
          <form
            onSubmit={handleCreateCodeSubmit}
            className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3"
          >
            <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-500" />
              <span>Tambah Kode Login Guru / Admin</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Kode Akses:
                </label>
                <input
                  type="text"
                  value={newCodeInput}
                  onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
                  placeholder="Misal: GURU7A"
                  className="w-full px-3 py-2 text-xs uppercase font-mono font-bold tracking-wider rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nama Guru:
                </label>
                <input
                  type="text"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="Nama Lengkap"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Peran:
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'teacher' | 'admin')}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                >
                  <option value="teacher">Guru Pembina</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSavingCode}
                className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan Kode</span>
              </button>
            </div>
          </form>

          {/* Daftar Kode Login Aktif */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {teacherCodes.map((tc) => {
              const isCopied = copiedCodeId === tc.id;
              const isProtected = tc.code === 'ADMIN123' || tc.code === 'GURU123';

              return (
                <div key={tc.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded-lg border border-slate-200 shrink-0">
                      {tc.code}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{tc.name}</div>
                      <div className="text-[10px] text-slate-500 capitalize">
                        {tc.role === 'admin' ? 'Admin' : 'Guru Pembina'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(tc.code, tc.id)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                      title="Salin Kode"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {!isProtected && (
                      <button
                        type="button"
                        onClick={() => onDeleteTeacherCode(tc.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT SISWA (Proporsional di layar HP) */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                {editingStudent ? 'Edit Siswa' : 'Tambah Siswa'}
              </h3>
              <button
                type="button"
                onClick={() => setIsStudentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  NISN:
                </label>
                <input
                  type="text"
                  value={formNisn}
                  onChange={(e) => setFormNisn(e.target.value)}
                  placeholder="0081234001"
                  required
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Nama Siswa:
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nama Lengkap"
                  required
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Kelas:
                  </label>
                  <input
                    type="text"
                    value={formClassName}
                    onChange={(e) => setFormClassName(e.target.value)}
                    placeholder="Kelas 7A"
                    required
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Nilai Sikap:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={10}
                    value={formScore}
                    onChange={(e) => setFormScore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Judul Kreasi:
                </label>
                <input
                  type="text"
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                  placeholder="Pot Bunga Daur Ulang"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
