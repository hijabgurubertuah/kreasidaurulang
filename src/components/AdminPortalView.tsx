import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  QrCode,
  Barcode as BarcodeIcon,
  Sparkles,
  Database,
  RotateCcw,
  CheckSquare,
  Square,
  MinusSquare,
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
import { TeacherBarcodeModal } from './TeacherBarcodeModal';
import { StudentBarcodeModal } from './StudentBarcodeModal';
import { DatabaseUsageView } from './DatabaseUsageView';

interface AdminPortalViewProps {
  students: Student[];
  classes: ClassRoom[];
  teacherCodes: TeacherCode[];
  onBackToDashboard: () => void;
  onSaveStudent: (student: Student) => void | Promise<void>;
  onDeleteStudent: (studentId: string) => void | Promise<void>;
  onBulkDeleteStudents: (studentIds: string[]) => void | Promise<void>;
  onCreateTeacherCode: (newCode: TeacherCode) => Promise<void>;
  onDeleteTeacherCode: (codeId: string) => Promise<void>;
  onSyncCsvData: (students: Student[], classes: ClassRoom[]) => void | Promise<void>;
  onClearStudents: () => Promise<number>;
  onClearTeacherCodes: () => Promise<number>;
  onResetDatabase: () => Promise<void>;
  onDeduplicateStudents: () => Promise<{
    mergedCount: number;
    removedDuplicates: number;
    totalUnique: number;
  }>;
  firebaseConnected?: boolean;
  hasPendingChanges?: boolean;
  pendingChangesCount?: number;
  onSaveToFirebase?: () => Promise<void>;
  isSavingToFirebase?: boolean;
  onDiscardPendingChanges?: () => void;
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({
  students,
  classes,
  teacherCodes,
  onBackToDashboard,
  onSaveStudent,
  onDeleteStudent,
  onBulkDeleteStudents,
  onCreateTeacherCode,
  onDeleteTeacherCode,
  onSyncCsvData,
  onClearStudents,
  onClearTeacherCodes,
  onResetDatabase,
  onDeduplicateStudents,
  firebaseConnected = true,
  hasPendingChanges = false,
  pendingChangesCount = 0,
  onSaveToFirebase,
  isSavingToFirebase = false,
  onDiscardPendingChanges,
}) => {
  const [activeTab, setActiveTab] = useState<'spreadsheet' | 'students' | 'teachers' | 'database'>('spreadsheet');

  // Search & filter for students
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');

  // Checkbox selection state for bulk actions
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Notifications
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Google Sheets Online Sync State
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);

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

  // Barcode Modals
  const [selectedTeacherForBarcode, setSelectedTeacherForBarcode] = useState<TeacherCode | null>(null);
  const [isTeacherBarcodeOpen, setIsTeacherBarcodeOpen] = useState(false);

  const [selectedStudentForBarcode, setSelectedStudentForBarcode] = useState<Student | null>(null);
  const [isStudentBarcodeOpen, setIsStudentBarcodeOpen] = useState(false);

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

  // Cleanup Database State
  const [isExecutingCleanup, setIsExecutingCleanup] = useState(false);
  const [cleanupActionType, setCleanupActionType] = useState<string | null>(null);

  // Deletion Confirmation Modal State (replaces window.confirm for reliable execution in iframes & mobile)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk' | 'teacher';
    student?: Student;
    studentIds?: string[];
    teacherId?: string;
    teacherName?: string;
    teacherCode?: string;
  } | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

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

  // Checkbox Selection Helpers
  const isAllFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudentIds.has(s.id));
  const isSomeFilteredSelected =
    filteredStudents.some((s) => selectedStudentIds.has(s.id)) &&
    !isAllFilteredSelected;

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Deselect all filtered
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        filteredStudents.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        filteredStudents.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  const handleBulkDelete = () => {
    const count = selectedStudentIds.size;
    if (count === 0) return;
    setDeleteConfirm({
      isOpen: true,
      type: 'bulk',
      studentIds: Array.from(selectedStudentIds),
    });
  };

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

      // 3. Parse CSV (handles nama, kelas, nisn, deduplicating duplicate rows)
      const result = parseStudentCsv(csvText);

      if (result.students.length === 0) {
        throw new Error(
          result.errors.length > 0
            ? result.errors.join('; ')
            : 'Tidak ada data siswa ditemukan pada spreadsheet tersebut.'
        );
      }

      // 4. Stage locally with anti-duplication (does NOT write to Firebase yet to save quota)
      onSyncCsvData(result.students, result.classes);

      setSuccessMessage(
        `Berhasil menarik ${result.students.length} siswa ke memori lokal. Belum disimpan ke Firebase untuk menghemat kuota tulis harian. Klik tombol "Simpan ke Firebase" di atas jika sudah selesai.`
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

    // Check if NISN already exists
    const existingStudentWithNisn = students.find(
      (s) => s.nisn.trim().toLowerCase() === cleanNisn.toLowerCase()
    );

    setIsSavingStudent(true);
    setErrorMessage('');

    const classId = `class-${formClassName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const studentId = editingStudent
      ? editingStudent.id
      : (existingStudentWithNisn ? existingStudentWithNisn.id : `std-${cleanNisn.replace(/[^a-zA-Z0-9]/g, '')}`);

    const studentData: Student = {
      ...(existingStudentWithNisn || {}),
      id: studentId,
      nisn: cleanNisn,
      name: cleanName,
      classId,
      className: formClassName,
      score: Math.max(0, Math.min(100, Math.round(formScore / 10) * 10)),
      projectTitle: formProject || existingStudentWithNisn?.projectTitle || 'Kreasi Daur Ulang Mandiri',
      notes: formNotes || existingStudentWithNisn?.notes || '',
      lastUpdated: new Date().toISOString(),
    };

    try {
      await onSaveStudent(studentData);
      setIsStudentModalOpen(false);
      setSuccessMessage(
        existingStudentWithNisn && !editingStudent
          ? `NISN "${cleanNisn}" sudah ada: Data siswa diperbarui langsung di Firebase secara real-time.`
          : editingStudent
          ? `Data siswa "${cleanName}" diperbarui di Firebase secara real-time.`
          : `Siswa "${cleanName}" berhasil ditambahkan ke Firebase Firestore.`
      );
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(`Gagal menyimpan: ${err.message}`);
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleDeleteStudentClick = (student: Student) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'single',
      student,
    });
  };

  const handleDeleteTeacherClick = (teacher: TeacherCode) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'teacher',
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherCode: teacher.code,
    });
  };

  const handleExecuteConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeletingLoading(true);
    setErrorMessage('');
    try {
      if (deleteConfirm.type === 'single' && deleteConfirm.student) {
        const st = deleteConfirm.student;
        await onDeleteStudent(st.id);
        setSelectedStudentIds((prev) => {
          const next = new Set(prev);
          next.delete(st.id);
          return next;
        });
        setSuccessMessage(`Siswa "${st.name}" (${st.nisn}) berhasil dihapus seketika dari Firebase Firestore.`);
        setTimeout(() => setSuccessMessage(''), 3500);
      } else if (deleteConfirm.type === 'bulk' && deleteConfirm.studentIds) {
        const count = deleteConfirm.studentIds.length;
        await onBulkDeleteStudents(deleteConfirm.studentIds);
        setSelectedStudentIds(new Set());
        setSuccessMessage(`${count} siswa berhasil dihapus seketika dari Firebase Firestore & seluruh perangkat!`);
        setTimeout(() => setSuccessMessage(''), 4000);
      } else if (deleteConfirm.type === 'teacher' && deleteConfirm.teacherId) {
        await onDeleteTeacherCode(deleteConfirm.teacherId);
        setSuccessMessage(`Kode login guru "${deleteConfirm.teacherCode || ''}" berhasil dihapus dari Firebase.`);
        setTimeout(() => setSuccessMessage(''), 3500);
      }
    } catch (err: any) {
      setErrorMessage(`Gagal menghapus: ${err.message}`);
    } finally {
      setIsDeletingLoading(false);
      setDeleteConfirm(null);
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
      setErrorMessage(`Kode login "${cleanCode}" sudah terdaftar.`);
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
      setSuccessMessage(
        `Info login guru "${cleanName}" (${cleanCode}) otomatis tersimpan ke Firebase!`
      );
      // Offer opening barcode right away
      setSelectedTeacherForBarcode(newTeacher);
      setIsTeacherBarcodeOpen(true);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(`Gagal menyimpan ke Firebase: ${err.message}`);
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

  const handleSyncManualFile = () => {
    if (!parsedData || parsedData.students.length === 0) return;
    setIsSyncingFile(true);
    try {
      onSyncCsvData(parsedData.students, parsedData.classes);
      setSuccessMessage(
        `Berhasil memuat ${parsedData.students.length} siswa ke memori lokal. Belum disimpan ke Firebase untuk menghemat kuota tulis. Klik "Simpan ke Firebase" jika sudah selesai.`
      );
      setParsedData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setErrorMessage(`Gagal memuat: ${err.message}`);
    } finally {
      setIsSyncingFile(false);
    }
  };

  // Database Cleaning Handlers
  const handleRunClearStudents = async () => {
    if (
      !window.confirm(
        `PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA (${students.length}) data siswa dari Firebase Firestore? Seluruh data nilai dan catatan akan dikosongkan.`
      )
    ) {
      return;
    }
    setIsExecutingCleanup(true);
    setCleanupActionType('clear-students');
    setErrorMessage('');
    try {
      const count = await onClearStudents();
      setSelectedStudentIds(new Set());
      setSuccessMessage(`Berhasil membersihkan ${count} data siswa dari Firebase Firestore.`);
    } catch (err: any) {
      setErrorMessage(`Gagal membersihkan data siswa: ${err.message}`);
    } finally {
      setIsExecutingCleanup(false);
      setCleanupActionType(null);
    }
  };

  const handleRunClearTeachers = async () => {
    if (
      !window.confirm(
        'PERINGATAN: Hapus semua kode login guru tambahan dari Firebase Firestore? (Akun ADMIN123 dan GURU123 akan tetap dipertahankan).'
      )
    ) {
      return;
    }
    setIsExecutingCleanup(true);
    setCleanupActionType('clear-teachers');
    setErrorMessage('');
    try {
      const count = await onClearTeacherCodes();
      setSuccessMessage(`Berhasil membersihkan ${count} kode guru tambahan dari Firebase.`);
    } catch (err: any) {
      setErrorMessage(`Gagal membersihkan kode guru: ${err.message}`);
    } finally {
      setIsExecutingCleanup(false);
      setCleanupActionType(null);
    }
  };

  const handleRunDeduplication = async () => {
    setIsExecutingCleanup(true);
    setCleanupActionType('deduplicate');
    setErrorMessage('');
    try {
      const res = await onDeduplicateStudents();
      if (res.removedDuplicates > 0) {
        setSuccessMessage(
          `Deduplikasi berhasil: ${res.removedDuplicates} data duplikat dihapus, ${res.totalUnique} siswa aktif sekarang bersih dan unik.`
        );
      } else {
        setSuccessMessage(`Database bersih: Tidak ditemukan NISN ganda (${res.totalUnique} siswa unik).`);
      }
    } catch (err: any) {
      setErrorMessage(`Gagal menjalankan deduplikasi: ${err.message}`);
    } finally {
      setIsExecutingCleanup(false);
      setCleanupActionType(null);
    }
  };

  const handleRunResetDatabase = async () => {
    if (
      !window.confirm(
        'KEMBALIKAN KE DATA AWAL: Anda akan mengembalikan seluruh data siswa (24 siswa) dan guru ke bawaan modul Kokurikuler Daur Ulang SMPN 1 Bengkalis. Lanjutkan?'
      )
    ) {
      return;
    }
    setIsExecutingCleanup(true);
    setCleanupActionType('reset-all');
    setErrorMessage('');
    try {
      await onResetDatabase();
      setSelectedStudentIds(new Set());
      setSuccessMessage('Database berhasil direset kembali ke data bawaan modul kokurikuler!');
    } catch (err: any) {
      setErrorMessage(`Gagal mereset database: ${err.message}`);
    } finally {
      setIsExecutingCleanup(false);
      setCleanupActionType(null);
    }
  };

  const guruDefaultCode = teacherCodes.find((t) => t.code === 'GURU123') || {
    id: 'tc-guru123',
    code: 'GURU123',
    name: 'Guru Pembina Kokurikuler Daur Ulang',
    role: 'teacher' as const,
    createdAt: '2026-09-01T08:00:00Z',
  };

  const adminDefaultCode = teacherCodes.find((t) => t.code === 'ADMIN123') || {
    id: 'tc-admin123',
    code: 'ADMIN123',
    name: 'Administrator Portal & Koordinator P5',
    role: 'admin' as const,
    createdAt: '2026-09-01T08:00:00Z',
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
            <p className="text-[11px] text-slate-500 truncate flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${firebaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>Real-time Sync • Centang & Hapus Seketika • Database 1 GB</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Dashboard</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center space-x-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="break-words">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            className="text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center space-x-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="break-words">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Banner Perlindungan Kuota Tulis Firebase */}
      {hasPendingChanges && (
        <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-xs space-y-2 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
                <Save className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight flex items-center space-x-1.5">
                  <span>{pendingChangesCount} Perubahan Belum Disimpan ke Firebase</span>
                  <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    Hemat Kuota Free
                  </span>
                </h4>
                <p className="text-[11px] text-amber-950 mt-0.5 leading-relaxed">
                  Perubahan ditampung di memori lokal agar kuota tulis harian Firebase (20.000 writes/hari) tidak terbuang. Klik <strong>"Simpan ke Firebase"</strong> jika sudah selesai.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
              {onDiscardPendingChanges && (
                <button
                  type="button"
                  onClick={onDiscardPendingChanges}
                  disabled={isSavingToFirebase}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
                >
                  Batal
                </button>
              )}
              {onSaveToFirebase && (
                <button
                  type="button"
                  onClick={onSaveToFirebase}
                  disabled={isSavingToFirebase}
                  className="flex items-center space-x-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95 ring-2 ring-amber-300"
                >
                  <Save className={`w-3.5 h-3.5 ${isSavingToFirebase ? 'animate-spin' : ''}`} />
                  <span>{isSavingToFirebase ? 'Menyimpan...' : 'Simpan ke Firebase'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation - 4 Kolom Proporsional di Layar HP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-200/80 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('spreadsheet');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'spreadsheet'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">Spreadsheet</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('students');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
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
          className={`flex items-center justify-center space-x-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'teachers'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">Kode Guru ({teacherCodes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('database');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'database'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate">Database (1 GB)</span>
        </button>
      </div>

      {/* TAB 1: SPREADSHEET ONLINE SYNC & FILE CSV */}
      {activeTab === 'spreadsheet' && (
        <div className="space-y-4">
          {/* Card Link Spreadsheet */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                  <LinkIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Sinkronisasi Google Spreadsheet Online</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tempel link spreadsheet dengan kolom <span className="font-semibold text-slate-700">nama, kelas, nisn</span>.
                </p>
              </div>

              {spreadsheetUrl && (
                <button
                  type="button"
                  onClick={handleOpenEditSpreadsheet}
                  className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Spreadsheet</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Link Spreadsheet / Google Sheets:
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="url"
                  value={spreadsheetUrl}
                  onChange={(e) => setSpreadsheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
                <button
                  type="button"
                  onClick={handleFetchSpreadsheet}
                  disabled={isFetchingSheet}
                  className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingSheet ? 'animate-spin' : ''}`} />
                  <span>{isFetchingSheet ? 'Menarik Data...' : 'Tarik Data ke Memori'}</span>
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-[11px] text-emerald-950 leading-relaxed flex items-start space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Hemat Kuota & Anti-Duplikasi:</strong> Saat data ditarik dari spreadsheet, data ditampung di memori lokal terlebih dahulu tanpa langsung menulis ke Firebase. Jika ada NISN yang sudah ada, hanya akan di-update. Klik <strong>"Simpan ke Firebase"</strong> untuk menyimpan permanen ke cloud.
              </div>
            </div>
          </div>

          {/* Card Alternatif: Unggah File CSV Manual */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                  <UploadCloud className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Atau Unggah File CSV Manual</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Unggah file .csv yang diunduh dari spreadsheet
                </p>
              </div>

              <button
                type="button"
                onClick={downloadSampleCsvTemplate}
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-slate-600 hover:text-emerald-700 bg-slate-100 rounded-lg text-[11px] font-bold cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span className="hidden xs:inline">Contoh CSV</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
            />

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
                  {isSyncingFile ? 'Memuat...' : 'Muat CSV ke Daftar Siswa (Tanpa Duplikasi)'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PENGATURAN SISWA, CENTANG SEMUA & NISN */}
      {activeTab === 'students' && (
        <div className="space-y-3">
          {/* Floating Bulk Action Bar saat ada siswa yang dicentang */}
          {selectedStudentIds.size > 0 && (
            <div className="sticky top-20 z-20 p-2.5 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 flex items-center justify-between gap-2 animate-fadeIn">
              <div className="flex items-center space-x-2 min-w-0 pl-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse shrink-0" />
                <span className="text-xs font-bold truncate">
                  {selectedStudentIds.size} dari {filteredStudents.length} siswa dicentang
                </span>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-2.5 py-1.5 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    Hapus {selectedStudentIds.size === filteredStudents.length ? 'Semua' : 'Terpilih'} ({selectedStudentIds.size}) Seketika
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Toolbar Search, Centang Semua, Hapus Semua & Tambah Siswa */}
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

            <div className="flex items-center flex-wrap gap-2">
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

              {/* Tombol Centang Semua dengan sekali klik */}
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                  isAllFilteredSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : isSomeFilteredSelected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
                title="Centang semua siswa yang tampil dalam 1 kali klik"
              >
                {isAllFilteredSelected ? (
                  <CheckSquare className="w-4 h-4 text-white" />
                ) : isSomeFilteredSelected ? (
                  <MinusSquare className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span>Centang Semua ({filteredStudents.length})</span>
              </button>

              {/* Tombol Hapus Semua / Hapus Terpilih langsung di toolbar saat ada siswa yang dicentang */}
              {selectedStudentIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer shadow-xs active:scale-95 animate-fadeIn"
                  title="Hapus semua siswa yang dicentang dari Firebase Firestore seketika"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    Hapus {selectedStudentIds.size === filteredStudents.length ? 'Semua' : 'Terpilih'} ({selectedStudentIds.size})
                  </span>
                </button>
              )}

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

          {/* List Siswa - Responsif HP */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Sub-bar Seleksi Cepat di Layar HP */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 sm:hidden text-xs">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center space-x-1.5 font-bold text-slate-700 cursor-pointer"
              >
                {isAllFilteredSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : isSomeFilteredSelected ? (
                  <MinusSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Centang Semua ({filteredStudents.length})</span>
              </button>

              <div className="flex items-center space-x-1.5">
                {selectedStudentIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-black cursor-pointer shadow-xs active:scale-95"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus ({selectedStudentIds.size}) Seketika</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tampilan Kartu di HP (< sm) dengan Checkbox */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((st, idx) => {
                  const isChecked = selectedStudentIds.has(st.id);
                  return (
                    <div
                      key={st.id}
                      className={`p-3 space-y-2 transition-colors ${
                        isChecked ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        {/* Checkbox Siswa */}
                        <div className="pt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectStudent(st.id)}
                            className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                            aria-label={`Pilih ${st.name}`}
                          />
                        </div>

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
                          {/* Tombol Barcode Siswa */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentForBarcode(st);
                              setIsStudentBarcodeOpen(true);
                            }}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 cursor-pointer"
                            title="Lihat Barcode NISN"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

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
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  Tidak ada data siswa ditemukan.
                </div>
              )}
            </div>

            {/* Tampilan Tabel di Layar Tablet/Desktop (>= sm) dengan Kolom Checkbox */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-black text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeFilteredSelected;
                        }}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                        title="Centang Semua"
                      />
                    </th>
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
                    filteredStudents.map((st, idx) => {
                      const isChecked = selectedStudentIds.has(st.id);
                      return (
                        <tr
                          key={st.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isChecked ? 'bg-emerald-50/50' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectStudent(st.id)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                            />
                          </td>
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
                                onClick={() => {
                                  setSelectedStudentForBarcode(st);
                                  setIsStudentBarcodeOpen(true);
                                }}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 cursor-pointer"
                                title="Lihat Barcode NISN"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
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
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        Tidak ada siswa ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center space-x-3">
                <span>Total: {filteredStudents.length} siswa</span>
                {selectedStudentIds.size > 0 && (
                  <span className="font-bold text-emerald-700">
                    ({selectedStudentIds.size} siswa dicentang)
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {hasPendingChanges ? (
                  <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {pendingChangesCount} perubahan belum disimpan ke Firebase
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold italic">
                    ✓ Data tersimpan di Firebase
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENGATURAN KODE LOGIN GURU & BARCODE */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          {/* Section: Sediakan Barcode Untuk Login Guru */}
          <div className="bg-gradient-to-r from-emerald-800 to-slate-900 rounded-2xl p-4 text-white shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1">
                  <QrCode className="w-3 h-3" />
                  <span>Barcode Login Guru</span>
                </div>
                <h3 className="text-sm sm:text-base font-black leading-tight">
                  Sediakan Barcode Untuk Login Cepat Guru
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Guru cukup mengarahkan kamera login ke barcode ini untuk masuk seketika. Klik tombol di bawah untuk menampilkan atau mencetak barcode:
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTeacherForBarcode(guruDefaultCode);
                    setIsTeacherBarcodeOpen(true);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Barcode Guru (GURU123)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTeacherForBarcode(adminDefaultCode);
                    setIsTeacherBarcodeOpen(true);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-xl text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Barcode Admin (ADMIN123)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Form Buat Kode Guru Baru */}
          <form
            onSubmit={handleCreateCodeSubmit}
            className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>Tambah Kode Login Guru / Admin Baru</span>
              </h3>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Otomatis ke Firebase
              </span>
            </div>

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
                  required
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
                  placeholder="Nama Lengkap & Gelar"
                  required
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
                <span>Simpan Kode & Buat Barcode</span>
              </button>
            </div>
          </form>

          {/* Daftar Kode Login Aktif & Barcode Guru */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
            <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Daftar Guru & Kode Akses ({teacherCodes.length})</span>
              <span className="text-[11px] text-slate-500 font-normal">Sediakan Barcode per Guru</span>
            </div>

            {teacherCodes.map((tc) => {
              const isCopied = copiedCodeId === tc.id;
              const isProtected = tc.code === 'ADMIN123' || tc.code === 'GURU123';

              return (
                <div key={tc.id} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded-lg border border-slate-200 shrink-0">
                      {tc.code}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{tc.name}</div>
                      <div className="text-[10px] text-slate-500 capitalize">
                        {tc.role === 'admin' ? 'Administrator' : 'Guru Pembina'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {/* Tombol Barcode Guru */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTeacherForBarcode(tc);
                        setIsTeacherBarcodeOpen(true);
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 transition-colors cursor-pointer"
                      title="Lihat Barcode Login Guru"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden xs:inline">Barcode</span>
                    </button>

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
                        onClick={() => handleDeleteTeacherClick(tc)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Hapus dari Firebase"
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

      {/* TAB 4: DATABASE & GRAFIK PENGGUNAAN KUOTA (1 GB) */}
      {activeTab === 'database' && (
        <DatabaseUsageView
          students={students}
          classes={classes}
          teacherCodes={teacherCodes}
          firebaseConnected={firebaseConnected}
          onClearStudents={onClearStudents}
          onClearTeacherCodes={onClearTeacherCodes}
          onResetDatabase={onResetDatabase}
          onDeduplicateStudents={onDeduplicateStudents}
        />
      )}

      {/* MODAL TAMBAH / EDIT SISWA */}
      {isStudentModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3 my-auto max-h-[88vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {editingStudent ? 'Edit Data & NISN Siswa' : 'Tambah Siswa Baru'}
                </h3>
                <p className="text-[10px] text-emerald-700 font-semibold">
                  Tersimpan langsung ke Firebase Firestore secara real-time
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStudentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  NISN (Kode Login Siswa):
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
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isSavingStudent ? 'Menyimpan...' : 'Terapkan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL KONFIRMASI HAPUS REAL-TIME (Tampil di Layar HP & Desktop Tanpa Terhalang Browser) */}
      {deleteConfirm && deleteConfirm.isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto border border-slate-200">
            {/* Warning Icon */}
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>

            {/* Title & Info */}
            <div className="text-center space-y-1.5">
              <h3 className="font-extrabold text-base text-slate-900">
                {deleteConfirm.type === 'single'
                  ? 'Hapus Siswa dari Firebase?'
                  : deleteConfirm.type === 'bulk'
                  ? `Hapus ${deleteConfirm.studentIds?.length || 0} Siswa Terpilih?`
                  : 'Hapus Kode Login Guru?'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {deleteConfirm.type === 'single' && deleteConfirm.student ? (
                  <>
                    Siswa <strong className="text-slate-900">"{deleteConfirm.student.name}"</strong> (NISN: <span className="font-mono font-bold text-emerald-800">{deleteConfirm.student.nisn}</span>) akan dihapus seketika dari database cloud Firebase Firestore.
                  </>
                ) : deleteConfirm.type === 'bulk' ? (
                  <>
                    Sebanyak <strong className="text-rose-600 font-bold">{deleteConfirm.studentIds?.length || 0} siswa</strong> yang dicentang akan langsung dihapus seketika dari cloud database dan tersinkronisasi ke seluruh perangkat.
                  </>
                ) : (
                  <>
                    Kode login guru <strong className="text-slate-900">"{deleteConfirm.teacherCode}"</strong> ({deleteConfirm.teacherName}) akan dihapus dari Firebase.
                  </>
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeletingLoading}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleExecuteConfirmDelete}
                disabled={isDeletingLoading}
                className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeletingLoading ? 'animate-spin' : ''}`} />
                <span>{isDeletingLoading ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Barcode Login Guru */}
      <TeacherBarcodeModal
        teacher={selectedTeacherForBarcode}
        isOpen={isTeacherBarcodeOpen}
        onClose={() => {
          setIsTeacherBarcodeOpen(false);
          setSelectedTeacherForBarcode(null);
        }}
      />

      {/* Modal Barcode Login Siswa (NISN) */}
      <StudentBarcodeModal
        student={selectedStudentForBarcode}
        isOpen={isStudentBarcodeOpen}
        onClose={() => {
          setIsStudentBarcodeOpen(false);
          setSelectedStudentForBarcode(null);
        }}
      />
    </div>
  );
};
