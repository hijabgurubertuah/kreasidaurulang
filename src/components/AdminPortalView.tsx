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
  Award,
  MessageSquare,
  Calendar,
  ListChecks,
  PlusCircle,
  MinusCircle,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  ClassRoom,
  Student,
  TeacherCode,
  MeetingSchedule,
  SystemLog,
  EvaluationCriteriaConfig,
  ScoringCriterion,
} from '../types';
import { parseStudentCsv, ParsedCsvResult } from '../utils/csvParser';
import { downloadSampleCsvTemplate } from '../utils/excelExport';
import { getScoreColorScheme, getQuoteForScore } from './StudentPortalView';
import { isMeetingOpened, formatIndonesianDate } from '../utils/scheduleHelper';
import {
  parseGoogleSheetsUrl,
  fetchGoogleSheetCsv,
} from '../utils/googleSheetsSync';
import {
  getSpreadsheetUrlFromDb,
  saveSpreadsheetUrlInDb,
  deleteSpreadsheetUrlFromDb,
  saveCriteriaInDb,
  listenToSystemLogs,
} from '../services/firestoreService';
import { DEFAULT_EVALUATION_CRITERIA } from '../data/defaultData';
import { TeacherBarcodeModal } from './TeacherBarcodeModal';
import { StudentBarcodeModal } from './StudentBarcodeModal';
import { DatabaseUsageView } from './DatabaseUsageView';

interface AdminPortalViewProps {
  students: Student[];
  classes: ClassRoom[];
  teacherCodes: TeacherCode[];
  schedules?: MeetingSchedule[];
  criteria?: EvaluationCriteriaConfig;
  onSaveSchedule?: (schedule: MeetingSchedule) => void | Promise<void>;
  onSaveCriteria?: (criteria: EvaluationCriteriaConfig) => Promise<void>;
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
    removedClassDuplicates?: number;
    removedEmptyClasses?: number;
  }>;
  onResetStudentScores?: () => Promise<number>;
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
  schedules = [],
  criteria,
  onSaveSchedule,
  onSaveCriteria,
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
  onResetStudentScores,
  firebaseConnected = true,
  hasPendingChanges = false,
  pendingChangesCount = 0,
  onSaveToFirebase,
  isSavingToFirebase = false,
  onDiscardPendingChanges,
}) => {
  const [activeTab, setActiveTab] = useState<'students' | 'scores' | 'teachers' | 'database' | 'schedule' | 'criteria'>('students');

  // Reset Scores States (Jadwal tab)
  const [isResettingScores, setIsResettingScores] = useState(false);
  const [showResetScoresConfirm, setShowResetScoresConfirm] = useState(false);

  // Criteria Management States
  const [localPositiveCriteria, setLocalPositiveCriteria] = useState<ScoringCriterion[]>(
    () => criteria?.positiveCriteria || DEFAULT_EVALUATION_CRITERIA.positiveCriteria
  );
  const [localNegativeCriteria, setLocalNegativeCriteria] = useState<ScoringCriterion[]>(
    () => criteria?.negativeCriteria || DEFAULT_EVALUATION_CRITERIA.negativeCriteria
  );
  const [newPosTitle, setNewPosTitle] = useState('');
  const [newNegTitle, setNewNegTitle] = useState('');
  const [isSavingCriteria, setIsSavingCriteria] = useState(false);
  const [hasCriteriaChanges, setHasCriteriaChanges] = useState(false);

  // Editing Criterion State
  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [editCriterionTitle, setEditCriterionTitle] = useState<string>('');

  // Sync criteria when updated remotely
  useEffect(() => {
    if (criteria && !hasCriteriaChanges) {
      setLocalPositiveCriteria(criteria.positiveCriteria || DEFAULT_EVALUATION_CRITERIA.positiveCriteria);
      setLocalNegativeCriteria(criteria.negativeCriteria || DEFAULT_EVALUATION_CRITERIA.negativeCriteria);
    }
  }, [criteria, hasCriteriaChanges]);

  // Scheduling edit states
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [tempActiveDate, setTempActiveDate] = useState<string>('');

  // Search & filter for students
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('Kelas 7A');

  // Checkbox selection state for bulk actions
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Notifications
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Google Sheets Online Sync State
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [savedSpreadsheetUrl, setSavedSpreadsheetUrl] = useState('');
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [isSavingSpreadsheetUrl, setIsSavingSpreadsheetUrl] = useState(false);
  const [isDeletingSpreadsheetUrl, setIsDeletingSpreadsheetUrl] = useState(false);

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

  // Modal Student Recaps (identical to teacher's tab view)
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<Student | null>(null);
  const [selectedMeetingIndex, setSelectedMeetingIndex] = useState<number>(0);

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
        setSavedSpreadsheetUrl(savedUrl);
      }
    });
  }, []);

  // System logs state
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);

  // Subscribe to real-time system logs
  useEffect(() => {
    const unsubscribe = listenToSystemLogs((logs) => {
      setSystemLogs(logs);
    });
    return () => unsubscribe();
  }, []);

  // Filtered Students (Sorted by Class Name, then Alphabetically by Student Name A-Z)
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        const matchSearch =
          s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
          s.nisn.includes(searchStudent);
        const matchClass = selectedClassFilter ? s.className === selectedClassFilter : true;
        return matchSearch && matchClass;
      })
      .sort((a, b) => {
        // Sort primary by class name (e.g. Kelas 7A, Kelas 7B)
        const classA = (a.className || '').trim();
        const classB = (b.className || '').trim();
        const classComp = classA.localeCompare(classB, 'id', { numeric: true, sensitivity: 'base' });
        if (classComp !== 0) return classComp;

        // Sort secondary by student name alphabetically A-Z
        const nameA = (a.name || '').trim();
        const nameB = (b.name || '').trim();
        return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' });
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

  // Handler reset seluruh nilai penilaian siswa (Tab Jadwal)
  const handleConfirmResetScores = async () => {
    if (!onResetStudentScores) return;
    setIsResettingScores(true);
    try {
      const count = await onResetStudentScores();
      setShowResetScoresConfirm(false);
      setSuccessMessage(`Berhasil mereset penilaian pertemuan tanpa tanggal untuk ${count} siswa. Nilai pada pertemuan berjadwal tetap dipertahankan.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Failed to reset student scores:', err);
      setErrorMessage('Gagal mereset penilaian siswa. Silakan coba lagi.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsResettingScores(false);
    }
  };

  // Criteria Action Handlers
  const handleStartEditCriterion = (criterion: ScoringCriterion) => {
    setEditingCriterionId(criterion.id);
    setEditCriterionTitle(criterion.title);
  };

  const handleCancelEditCriterion = () => {
    setEditingCriterionId(null);
    setEditCriterionTitle('');
  };

  const handleSaveEditedCriterion = (id: string, type: 'plus' | 'minus') => {
    const cleanTitle = editCriterionTitle.trim();
    if (!cleanTitle) return;

    if (type === 'plus') {
      setLocalPositiveCriteria((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, title: cleanTitle, points: 10 } : c
        )
      );
    } else {
      setLocalNegativeCriteria((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, title: cleanTitle, points: 10 } : c
        )
      );
    }
    setEditingCriterionId(null);
    setEditCriterionTitle('');
    setHasCriteriaChanges(true);
  };

  const handleDeletePositiveCriterion = (id: string) => {
    setLocalPositiveCriteria((prev) => prev.filter((c) => c.id !== id));
    setHasCriteriaChanges(true);
  };

  const handleDeleteNegativeCriterion = (id: string) => {
    setLocalNegativeCriteria((prev) => prev.filter((c) => c.id !== id));
    setHasCriteriaChanges(true);
  };

  const handleAddPositiveCriterion = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTitle = newPosTitle.trim();
    if (!cleanTitle) return;
    const newItem: ScoringCriterion = {
      id: `crit-pos-${Date.now()}`,
      type: 'plus',
      title: cleanTitle,
      points: 10,
    };
    setLocalPositiveCriteria((prev) => [...prev, newItem]);
    setNewPosTitle('');
    setHasCriteriaChanges(true);
  };

  const handleAddNegativeCriterion = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTitle = newNegTitle.trim();
    if (!cleanTitle) return;
    const newItem: ScoringCriterion = {
      id: `crit-neg-${Date.now()}`,
      type: 'minus',
      title: cleanTitle,
      points: 10,
    };
    setLocalNegativeCriteria((prev) => [...prev, newItem]);
    setNewNegTitle('');
    setHasCriteriaChanges(true);
  };

  // Reorder functions for criteria (drag & drop / long-press / move up-down)
  const handleMovePositiveCriterion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= localPositiveCriteria.length || fromIndex === toIndex) return;
    setLocalPositiveCriteria((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setHasCriteriaChanges(true);
  };

  const handleMoveNegativeCriterion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= localNegativeCriteria.length || fromIndex === toIndex) return;
    setLocalNegativeCriteria((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setHasCriteriaChanges(true);
  };

  // State for drag and drop & touch long-press
  const [draggedPosIndex, setDraggedPosIndex] = useState<number | null>(null);
  const [dragOverPosIndex, setDragOverPosIndex] = useState<number | null>(null);

  const [draggedNegIndex, setDraggedNegIndex] = useState<number | null>(null);
  const [dragOverNegIndex, setDragOverNegIndex] = useState<number | null>(null);

  // Long press for touch devices
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartIndexRef = useRef<number | null>(null);
  const [touchActiveItem, setTouchActiveItem] = useState<{ type: 'plus' | 'minus'; index: number } | null>(null);

  const handleTouchStartCriterion = (type: 'plus' | 'minus', index: number) => {
    touchStartIndexRef.current = index;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      setTouchActiveItem({ type, index });
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(35); } catch (_) {}
      }
    }, 220);
  };

  const handleTouchEndCriterion = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    setTouchActiveItem(null);
    touchStartIndexRef.current = null;
  };

  const handleTouchMoveCriterion = (e: React.TouchEvent, type: 'plus' | 'minus') => {
    if (!touchActiveItem || touchActiveItem.type !== type) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetRow = element?.closest('[data-criteria-index]');
    if (targetRow) {
      const targetIdxStr = targetRow.getAttribute('data-criteria-index');
      const targetType = targetRow.getAttribute('data-criteria-type');
      if (targetIdxStr !== null && targetType === type) {
        const targetIdx = parseInt(targetIdxStr, 10);
        if (!isNaN(targetIdx) && targetIdx !== touchActiveItem.index) {
          if (type === 'plus') {
            handleMovePositiveCriterion(touchActiveItem.index, targetIdx);
          } else {
            handleMoveNegativeCriterion(touchActiveItem.index, targetIdx);
          }
          setTouchActiveItem({ type, index: targetIdx });
        }
      }
    }
  };

  const handleSaveCriteriaClick = async () => {
    setIsSavingCriteria(true);
    setErrorMessage('');
    try {
      const payload: EvaluationCriteriaConfig = {
        positiveCriteria: localPositiveCriteria,
        negativeCriteria: localNegativeCriteria,
        updatedAt: new Date().toISOString(),
      };
      if (onSaveCriteria) {
        await onSaveCriteria(payload);
      } else {
        await saveCriteriaInDb(payload);
      }
      setHasCriteriaChanges(false);
      setSuccessMessage('Kriteria penilaian berhasil disimpan ke Firebase Firestore secara real-time!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(`Gagal menyimpan kriteria: ${err.message}`);
    } finally {
      setIsSavingCriteria(false);
    }
  };

  // Simpan link spreadsheet ke Firebase
  const handleSaveSpreadsheetLink = async () => {
    const cleanUrl = spreadsheetUrl.trim();
    if (!cleanUrl) {
      setErrorMessage('Tempelkan link Google Spreadsheet terlebih dahulu sebelum menyimpan.');
      return;
    }

    setIsSavingSpreadsheetUrl(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await saveSpreadsheetUrlInDb(cleanUrl);
      setSavedSpreadsheetUrl(cleanUrl);
      setSuccessMessage('Link spreadsheet berhasil disimpan ke Firebase!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(`Gagal menyimpan link ke Firebase: ${err.message}`);
    } finally {
      setIsSavingSpreadsheetUrl(false);
    }
  };

  // Hapus link spreadsheet dari Firebase
  const handleDeleteSpreadsheetLink = async () => {
    if (
      !window.confirm(
        'Apakah Anda yakin ingin menghapus link Google Spreadsheet ini dari Firebase?'
      )
    ) {
      return;
    }

    setIsDeletingSpreadsheetUrl(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await deleteSpreadsheetUrlFromDb();
      setSpreadsheetUrl('');
      setSavedSpreadsheetUrl('');
      setSuccessMessage('Link spreadsheet berhasil dihapus dari Firebase!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(`Gagal menghapus link dari Firebase: ${err.message}`);
    } finally {
      setIsDeletingSpreadsheetUrl(false);
    }
  };

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
      setSavedSpreadsheetUrl(cleanUrl);

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

  const handleExportScoresToCsv = () => {
    const classNameLabel = selectedClassFilter || 'Semua Kelas';
    const headers = ['No', 'Nama Siswa', 'NISN', 'Kelas'];
    for (let i = 1; i <= 20; i++) {
      headers.push(`P${i}`);
    }
    headers.push('Rata-Rata Akhir');

    const rows = filteredStudents.map((st, idx) => {
      const meetingScores = st.meetingScores || [];
      const meetingAbsences = st.meetingAbsences || [];
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

      const effectiveValidScores = validScores;
      const avgScore = effectiveValidScores.length > 0
        ? Math.round(effectiveValidScores.reduce((sum, val) => sum + val, 0) / effectiveValidScores.length)
        : (st.score > 0 ? st.score : 80);

      const rowData = [
        String(idx + 1),
        st.name,
        st.nisn,
        st.className,
      ];

      for (let i = 0; i < 20; i++) {
        let mScoreStr = '-';
        const sched = schedules.find((s) => s.meetingNumber === i + 1);
        if (isMeetingOpened(sched)) {
          if (meetingAbsences[i] === true) {
            mScoreStr = '0 (Absen)';
          } else {
            const raw = meetingScores[i];
            const sc = typeof raw === 'number' && raw !== null ? raw : 80;
            mScoreStr = String(sc);
          }
        }
        rowData.push(mScoreStr);
      }

      rowData.push(String(avgScore));
      return rowData;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Nilai_${classNameLabel.replace(/\s+/g, '_')}_SMPN_1_Bengkalis.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Data Siswa (Nama, Kelas, NISN) ke CSV dengan preservasi angka 0 di awal NISN
  const handleExportStudentsToCsv = () => {
    const studentsToExport = selectedStudentIds.size > 0
      ? filteredStudents.filter((s) => selectedStudentIds.has(s.id))
      : filteredStudents;

    if (studentsToExport.length === 0) {
      setErrorMessage('Tidak ada data siswa untuk diekspor.');
      return;
    }

    const classNameLabel = selectedClassFilter || 'Semua_Kelas';
    // Kolom CSV: Nama, Kelas, NISN
    const headers = ['Nama', 'Kelas', 'NISN'];

    const rows = studentsToExport.map((st) => {
      const escapedName = `"${(st.name || '').replace(/"/g, '""')}"`;
      const escapedClass = `"${(st.className || '').replace(/"/g, '""')}"`;

      // Agar Excel & Google Sheets tidak menghilangkan angka 0 di awal NISN,
      // kita format sebagai formula text: ="0012345678"
      const rawNisn = String(st.nisn ?? '').replace(/^['\t]/, '').trim();
      const escapedNisnVal = rawNisn.replace(/"/g, '""');
      const formattedNisn = `="` + escapedNisnVal + `"`;

      return [escapedName, escapedClass, formattedNisn].join(',');
    });

    // Tambahkan UTF-8 BOM (\uFEFF) agar aplikasi spreadsheet membuka file dalam encoding UTF-8 dengan benar
    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Data_Siswa_${classNameLabel.replace(/\s+/g, '_')}_SMPN_1_Bengkalis.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccessMessage(
      `Berhasil mengekspor ${studentsToExport.length} data siswa ke CSV (Nama, Kelas, NISN lengkap dengan awalan angka 0 terjaga)!`
    );
    setTimeout(() => setSuccessMessage(''), 4000);
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
        'PERINGATAN: Hapus semua kode login guru dari Firebase Firestore? (Hanya akun ADMIN123 yang akan dipertahankan).'
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
      const details: string[] = [];
      if (res.removedDuplicates > 0) details.push(`${res.removedDuplicates} NISN ganda dibersihkan`);
      if (res.removedClassDuplicates && res.removedClassDuplicates > 0) details.push(`${res.removedClassDuplicates} kelas ganda digabung`);
      if (res.removedEmptyClasses && res.removedEmptyClasses > 0) details.push(`${res.removedEmptyClasses} kelas kosong dihapus`);

      if (details.length > 0) {
        setSuccessMessage(`Pembersihan sukses: ${details.join(', ')}. Database sekarang rapi!`);
      } else {
        setSuccessMessage(`Database bersih: Tidak ditemukan NISN/Kelas ganda atau kelas kosong.`);
      }
    } catch (err: any) {
      setErrorMessage(`Gagal menjalankan pembersihan: ${err.message}`);
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

      {/* Tab Navigation - 6 Kolom Proporsional */}
      <div className="grid grid-cols-3 sm:grid-cols-6 bg-slate-200/80 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('students');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1 py-1.5 px-0.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'students'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate ml-1">SISWA</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('scores');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1 py-1.5 px-0.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'scores'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate ml-1">NILAI SISWA</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('teachers');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1 py-1.5 px-0.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'teachers'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate ml-1">KODE GURU</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('schedule');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1 py-1.5 px-0.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'schedule'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span className="truncate ml-1">JADWAL</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('criteria');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1 py-1.5 px-0.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'criteria'
              ? 'bg-white text-teal-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ListChecks className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span className="truncate ml-1">KRITERIA</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('database');
            setErrorMessage('');
          }}
          className={`flex items-center justify-center space-x-1 py-1.5 px-0.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
            activeTab === 'database'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate ml-1">DATABASE</span>
        </button>
      </div>

      {/* TAB 1: PENGATURAN SISWA, CENTANG SEMUA, NISN, SPREADSHEET & CSV */}
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

              {/* Tombol Export Data Siswa ke CSV */}
              <button
                type="button"
                onClick={handleExportStudentsToCsv}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Ekspor data siswa (Nama, Kelas, NISN) ke file CSV dengan format angka 0 terjaga"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  Export CSV {selectedStudentIds.size > 0 ? `(${selectedStudentIds.size})` : ''}
                </span>
              </button>

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
                <button
                  type="button"
                  onClick={handleExportStudentsToCsv}
                  className="flex items-center space-x-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold cursor-pointer shadow-xs active:scale-95"
                  title="Ekspor data siswa ke file CSV"
                >
                  <Download className="w-3 h-3 text-emerald-700" />
                  <span>CSV</span>
                </button>

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

          {/* SINKRONISASI SPREADSHEET ONLINE & FILE CSV (DI BAWAH TAB SISWA) */}
          <div className="space-y-4 pt-2">
            {/* Card Link Google Spreadsheet */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      Link Google Spreadsheet
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Sinkronisasi dan hubungkan link Google Spreadsheet langsung ke Firebase Firestore
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {savedSpreadsheetUrl && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tersimpan di Firebase</span>
                    </span>
                  )}

                  {spreadsheetUrl && (
                    <button
                      type="button"
                      onClick={handleOpenEditSpreadsheet}
                      className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95"
                      title="Buka link spreadsheet di tab browser baru"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Spreadsheet</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Link Spreadsheet / Google Sheets:
                  </label>
                  <input
                    type="url"
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  />
                </div>

                {/* Action Buttons: Simpan ke Firebase, Hapus dari Firebase, & Tarik Data */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Tombol Simpan Link ke Firebase */}
                  <button
                    type="button"
                    onClick={handleSaveSpreadsheetLink}
                    disabled={isSavingSpreadsheetUrl || !spreadsheetUrl.trim()}
                    className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                    title="Simpan tautan spreadsheet ini ke Firebase agar tersimpan secara permanen"
                  >
                    <Save className={`w-3.5 h-3.5 ${isSavingSpreadsheetUrl ? 'animate-spin' : ''}`} />
                    <span>{isSavingSpreadsheetUrl ? 'Menyimpan...' : 'Simpan Link ke Firebase'}</span>
                  </button>

                  {/* Tombol Hapus Link dari Firebase */}
                  <button
                    type="button"
                    onClick={handleDeleteSpreadsheetLink}
                    disabled={isDeletingSpreadsheetUrl || (!spreadsheetUrl && !savedSpreadsheetUrl)}
                    className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 active:scale-95"
                    title="Hapus tautan spreadsheet dari Firebase"
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${isDeletingSpreadsheetUrl ? 'animate-spin' : ''}`} />
                    <span>{isDeletingSpreadsheetUrl ? 'Menghapus...' : 'Hapus Link'}</span>
                  </button>

                  {/* Tombol Tarik Data ke Memori */}
                  <button
                    type="button"
                    onClick={handleFetchSpreadsheet}
                    disabled={isFetchingSheet || !spreadsheetUrl.trim()}
                    className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-95 sm:ml-auto"
                    title="Tarik data siswa dari spreadsheet ke memori"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingSheet ? 'animate-spin' : ''}`} />
                    <span>{isFetchingSheet ? 'Menarik Data...' : 'Tarik Data ke Memori'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card Alternatif: Unggah File CSV Manual */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <UploadCloud className="w-4 h-4 text-slate-600 shrink-0" />
                    <span>Unggah CSV Manual</span>
                  </h3>
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
        </div>
      )}

      {/* TAB: REKAP PENILAIAN SISWA PER KELAS */}
      {activeTab === 'scores' && (
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
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleExportScoresToCsv}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-emerald-800 font-extrabold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Ekspor Nilai ({selectedClassFilter ? selectedClassFilter.replace(/^Kelas\s+/i, '') : 'Semua'})</span>
              </button>
              <div className="text-right shrink-0 bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-white/20">
                <div className="text-2xl sm:text-3xl font-black">{filteredStudents.length}</div>
                <div className="text-[9px] sm:text-[10px] font-bold text-emerald-100 uppercase tracking-wider">Siswa</div>
              </div>
            </div>
          </div>

          {/* Controls Bar: Dropdown Pilih Kelas */}
          <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {/* Filter Kelas */}
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
                <span className="px-2 py-0.5 rounded bg-blue-600 text-white">70 Biru Pekat</span>
                <span className="px-2 py-0.5 rounded bg-purple-500 text-white">60 Lavender</span>
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

      {/* TAB 3: PENGATURAN KODE LOGIN GURU & BARCODE */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          {/* Daftar Kode Login Guru & Barcode Guru */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
            <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Daftar Guru & Kode Akses ({teacherCodes.length})</span>
              <span className="text-[11px] text-slate-500 font-normal">Sediakan Barcode per Guru</span>
            </div>

            {teacherCodes.map((tc) => {
              const isCopied = copiedCodeId === tc.id;
              const isProtected = tc.code.trim().toUpperCase() === 'ADMIN123';

              return (
                <div key={tc.id} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{tc.name}</div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="font-mono font-bold text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200 shrink-0">
                          {tc.code}
                        </span>
                        <span className="text-[10px] text-slate-500 capitalize">
                          {tc.role === 'admin' ? 'Administrator' : 'Guru Pembina'}
                        </span>
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

          {/* Form Buat Kode Guru Baru */}
          <form
            onSubmit={handleCreateCodeSubmit}
            className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>Tambah Guru</span>
              </h3>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Otomatis ke Firebase
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
        </div>
      )}

      {/* TAB: JADWAL PENGAKTIFAN PERTEMUAN */}
      {activeTab === 'schedule' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-2xl p-3.5 sm:p-4 text-white shadow-md flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/30">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs sm:text-sm font-black tracking-tight text-white uppercase truncate">
                Jadwal 20 Pertemuan
              </span>
            </div>

            {/* Tombol Reset Penilaian Siswa */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowResetScoresConfirm(true)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 shadow-xs active:scale-95 border border-rose-400/50"
                title="Reset seluruh penilaian siswa agar kosong kembali"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Penilaian Siswa</span>
              </button>
            </div>
          </div>

          {/* Minimal Grid of 20 boxes */}
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {Array.from({ length: 20 }, (_, idx) => {
              const meetingNum = idx + 1;
              const sched = schedules.find((s) => s.meetingNumber === meetingNum);
              const activeDate = sched?.activeDate || '';

              // Format date nicely for Indonesian display if valid
              let displayDate = 'Belum Diaktifkan';
              if (activeDate) {
                const parts = activeDate.split('-');
                if (parts.length === 3) {
                  const months = [
                    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                    'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
                  ];
                  const day = parseInt(parts[2], 10);
                  const monthIdx = parseInt(parts[1], 10) - 1;
                  const year = parts[0];
                  if (monthIdx >= 0 && monthIdx < 12) {
                    displayDate = `${day} ${months[monthIdx]} ${year}`;
                  } else {
                    displayDate = activeDate;
                  }
                } else {
                  displayDate = activeDate;
                }
              }

              const isEditing = editingScheduleId === `meeting-${meetingNum}`;

              return (
                <div
                  key={meetingNum}
                  className={`bg-white rounded-2xl border transition-all p-3.5 flex flex-col justify-between items-center text-center space-y-2 relative shadow-xs ${
                    activeDate
                      ? 'border-purple-300 bg-purple-50/20 ring-1 ring-purple-100'
                      : 'border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                    Pertemuan {meetingNum}
                  </div>

                  {isEditing ? (
                    <div className="w-full space-y-2 pt-1 z-10 bg-white p-2 rounded-xl border border-purple-200 absolute inset-x-0 top-0 shadow-lg">
                      <input
                        type="date"
                        value={tempActiveDate}
                        onChange={(e) => setTempActiveDate(e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingScheduleId(null);
                          }}
                          className="py-1 px-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (onSaveSchedule) {
                              await onSaveSchedule({
                                id: `meeting-${meetingNum}`,
                                meetingNumber: meetingNum,
                                activeDate: tempActiveDate,
                              });
                              setEditingScheduleId(null);
                              setSuccessMessage(`Pertemuan ${meetingNum} berhasil diaktifkan pada tanggal ${tempActiveDate}.`);
                              setTimeout(() => setSuccessMessage(''), 3000);
                            }
                          }}
                          className="py-1 px-1 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md cursor-pointer"
                        >
                          Simpan
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (onSaveSchedule) {
                            await onSaveSchedule({
                              id: `meeting-${meetingNum}`,
                              meetingNumber: meetingNum,
                              activeDate: '',
                            });
                            setEditingScheduleId(null);
                            setSuccessMessage(`Jadwal Pertemuan ${meetingNum} dinonaktifkan.`);
                            setTimeout(() => setSuccessMessage(''), 3000);
                          }
                        }}
                        className="w-full text-center text-[9px] text-rose-600 hover:underline pt-1 font-semibold cursor-pointer"
                      >
                        Matikan Jadwal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingScheduleId(`meeting-${meetingNum}`);
                        setTempActiveDate(activeDate || new Date().toISOString().split('T')[0]);
                      }}
                      className="w-full flex flex-col items-center justify-center cursor-pointer group"
                    >
                      <div
                        className={`text-xs font-black tracking-tight leading-tight px-2.5 py-1 rounded-xl transition-all ${
                          activeDate
                            ? 'bg-purple-100 text-purple-900 font-extrabold shadow-2xs group-hover:scale-105'
                            : 'bg-slate-50 text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-700'
                        }`}
                      >
                        {displayDate}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase tracking-wider">
                        Atur Tanggal
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: DATABASE & GRAFIK PENGGUNAAN KUOTA (1 GB) */}
      {activeTab === 'database' && (
        <div className="space-y-4 animate-fadeIn">
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

          {/* CARD: LOG PERUBAHAN DATA SISTEM */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide flex items-center space-x-1">
                  <span>Log Perubahan Data Sistem</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold">Real-time</span>
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-500">
                {systemLogs.length} Aktivitas Terbaru
              </span>
            </div>

            {systemLogs.length > 0 ? (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 divide-y divide-slate-100/70">
                {systemLogs.map((log) => {
                  let badgeColor = "bg-slate-100 text-slate-800 border-slate-200";
                  if (log.action.includes("TAMBAH")) badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
                  else if (log.action.includes("EDIT") || log.action.includes("UPDATE")) badgeColor = "bg-blue-50 text-blue-800 border-blue-200";
                  else if (log.action.includes("HAPUS") || log.action.includes("BERSIHKAN")) badgeColor = "bg-rose-50 text-rose-800 border-rose-200";
                  else if (log.action.includes("SINKRONISASI")) badgeColor = "bg-amber-50 text-amber-800 border-amber-200";
                  else if (log.action.includes("RESET")) badgeColor = "bg-purple-50 text-purple-800 border-purple-200";

                  // Format timestamp elegantly
                  let timeStr = "";
                  try {
                    const d = new Date(log.timestamp);
                    timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " - " + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                  } catch (e) {
                    timeStr = log.timestamp;
                  }

                  return (
                    <div key={log.id} className="pt-2.5 first:pt-0 flex items-start justify-between gap-3 text-xs leading-relaxed">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${badgeColor}`}>
                            {log.action}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Oleh: <strong className="text-slate-800">{log.operator}</strong>
                          </span>
                        </div>
                        <p className="text-slate-700 font-bold break-all">
                          {log.description}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0 whitespace-nowrap text-right pt-0.5">
                        {timeStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs font-semibold bg-slate-50 rounded-xl border border-slate-100">
                Belum ada catatan aktivitas perubahan sistem.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: KRITERIA PENILAIAN SIKAP */}
      {activeTab === 'criteria' && (
        <div className="space-y-4">
          {/* Header Action Bar with Save to Firebase Button */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700 shrink-0">
                <ListChecks className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-600">
                Tekan lama / seret untuk mengatur urutan posisi
              </span>
            </div>

            <button
              type="button"
              onClick={handleSaveCriteriaClick}
              disabled={isSavingCriteria}
              className={`flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer active:scale-95 shrink-0 ${
                hasCriteriaChanges
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title="Simpan kriteria ke Firebase Firestore agar terlihat oleh semua guru"
            >
              <Save className={`w-3.5 h-3.5 ${isSavingCriteria ? 'animate-spin' : ''}`} />
              <span>
                {isSavingCriteria
                  ? 'Menyimpan...'
                  : hasCriteriaChanges
                  ? 'Simpan ke Firebase *'
                  : 'Simpan ke Firebase'}
              </span>
            </button>
          </div>

          {/* Grid 2 Kolom: Kriteria Penambah Poin (+) dan Kriteria Pengurang Poin (-) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* KOLOM KIRI: Penambah Poin (+) */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-xs space-y-3.5 flex flex-col">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                <span className="flex items-center space-x-2 text-xs font-black text-emerald-800 uppercase tracking-wider">
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  <span>Kriteria Penambah Poin (+)</span>
                </span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                  {localPositiveCriteria.length} Kriteria
                </span>
              </div>

              {/* Form Tambah Kriteria Positif */}
              <form onSubmit={handleAddPositiveCriterion} className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newPosTitle}
                    onChange={(e) => setNewPosTitle(e.target.value)}
                    placeholder="Ketik kriteria penambah poin..."
                    className="w-full pl-3 pr-14 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-medium"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300 select-none">
                    +10
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={!newPosTitle.trim()}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
                >
                  Tambah
                </button>
              </form>

              {/* Daftar Kriteria Positif */}
              <div
                onTouchMove={(e) => handleTouchMoveCriterion(e, 'plus')}
                className="space-y-2 flex-1 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin select-none"
              >
                {localPositiveCriteria.map((item, idx) => {
                  const isTouchActive = touchActiveItem?.type === 'plus' && touchActiveItem.index === idx;
                  const isDragOver = dragOverPosIndex === idx;

                  return (
                    <div
                      key={item.id || `pos-${idx}`}
                      data-criteria-index={idx}
                      data-criteria-type="plus"
                      draggable={editingCriterionId !== item.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(idx));
                        setDraggedPosIndex(idx);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverPosIndex !== idx) setDragOverPosIndex(idx);
                      }}
                      onDragLeave={() => {
                        if (dragOverPosIndex === idx) setDragOverPosIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedPosIndex !== null && draggedPosIndex !== idx) {
                          handleMovePositiveCriterion(draggedPosIndex, idx);
                        }
                        setDraggedPosIndex(null);
                        setDragOverPosIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedPosIndex(null);
                        setDragOverPosIndex(null);
                      }}
                      className={`transition-all ${
                        isTouchActive
                          ? 'ring-2 ring-emerald-500 bg-emerald-50 rounded-xl shadow-md scale-[1.01]'
                          : isDragOver
                          ? 'border-t-2 border-t-emerald-600'
                          : ''
                      }`}
                    >
                      {editingCriterionId === item.id ? (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 space-y-2 animate-fadeIn">
                          <div className="relative">
                            <input
                              type="text"
                              value={editCriterionTitle}
                              onChange={(e) => setEditCriterionTitle(e.target.value)}
                              placeholder="Ubah kriteria penambah poin..."
                              className="w-full pl-2.5 pr-14 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                              autoFocus
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black select-none">
                              +10
                            </span>
                          </div>
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={handleCancelEditCriterion}
                              className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditedCriterion(item.id, 'plus')}
                              disabled={!editCriterionTitle.trim()}
                              className="flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Terapkan</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 transition-colors group">
                          {/* Drag Grip Handle & Touch Long-Press */}
                          <div
                            onTouchStart={() => handleTouchStartCriterion('plus', idx)}
                            onTouchEnd={handleTouchEndCriterion}
                            onTouchCancel={handleTouchEndCriterion}
                            className="p-1 text-slate-400 hover:text-emerald-700 cursor-grab active:cursor-grabbing shrink-0 select-none touch-none"
                            title="Tekan lama / drag naik turun untuk memindahkan posisi"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>

                          {/* Quick Up/Down Buttons */}
                          <div className="flex flex-col -space-y-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMovePositiveCriterion(idx, idx - 1)}
                              className="p-0.5 text-slate-400 hover:text-emerald-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                              title="Pindahkan ke atas"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === localPositiveCriteria.length - 1}
                              onClick={() => handleMovePositiveCriterion(idx, idx + 1)}
                              className="p-0.5 text-slate-400 hover:text-emerald-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                              title="Pindahkan ke bawah"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Criteria Badge & Title */}
                          <div className="flex items-start space-x-2 min-w-0 flex-1 ml-0.5">
                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black shadow-xs">
                              +10
                            </span>
                            <p className="text-xs text-slate-800 font-medium leading-snug break-words">
                              {item.title}
                            </p>
                          </div>

                          {/* Action Buttons: Edit & Delete */}
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditCriterion(item)}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit kriteria ini"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePositiveCriterion(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus kriteria ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {localPositiveCriteria.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400 italic">
                    Belum ada kriteria penambah poin.
                  </div>
                )}
              </div>
            </div>

            {/* KOLOM KANAN: Pengurang Poin (-) */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/80 shadow-xs space-y-3.5 flex flex-col">
              <div className="flex items-center justify-between border-b border-rose-100 pb-2.5">
                <span className="flex items-center space-x-2 text-xs font-black text-rose-800 uppercase tracking-wider">
                  <MinusCircle className="w-4 h-4 text-rose-600" />
                  <span>Kriteria Pengurang Poin (-10)</span>
                </span>
                <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                  {localNegativeCriteria.length} Kriteria
                </span>
              </div>

              {/* Form Tambah Kriteria Negatif */}
              <form onSubmit={handleAddNegativeCriterion} className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newNegTitle}
                    onChange={(e) => setNewNegTitle(e.target.value)}
                    placeholder="Ketik kriteria pengurang poin..."
                    className="w-full pl-3 pr-14 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50 font-medium"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-300 select-none">
                    -10
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={!newNegTitle.trim()}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
                >
                  Tambah
                </button>
              </form>

              {/* Daftar Kriteria Negatif */}
              <div
                onTouchMove={(e) => handleTouchMoveCriterion(e, 'minus')}
                className="space-y-2 flex-1 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin select-none"
              >
                {localNegativeCriteria.map((item, idx) => {
                  const isTouchActive = touchActiveItem?.type === 'minus' && touchActiveItem.index === idx;
                  const isDragOver = dragOverNegIndex === idx;

                  return (
                    <div
                      key={item.id || `neg-${idx}`}
                      data-criteria-index={idx}
                      data-criteria-type="minus"
                      draggable={editingCriterionId !== item.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(idx));
                        setDraggedNegIndex(idx);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverNegIndex !== idx) setDragOverNegIndex(idx);
                      }}
                      onDragLeave={() => {
                        if (dragOverNegIndex === idx) setDragOverNegIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedNegIndex !== null && draggedNegIndex !== idx) {
                          handleMoveNegativeCriterion(draggedNegIndex, idx);
                        }
                        setDraggedNegIndex(null);
                        setDragOverNegIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedNegIndex(null);
                        setDragOverNegIndex(null);
                      }}
                      className={`transition-all ${
                        isTouchActive
                          ? 'ring-2 ring-rose-500 bg-rose-50 rounded-xl shadow-md scale-[1.01]'
                          : isDragOver
                          ? 'border-t-2 border-t-rose-600'
                          : ''
                      }`}
                    >
                      {editingCriterionId === item.id ? (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 space-y-2 animate-fadeIn">
                          <div className="relative">
                            <input
                              type="text"
                              value={editCriterionTitle}
                              onChange={(e) => setEditCriterionTitle(e.target.value)}
                              placeholder="Ubah kriteria pengurang poin..."
                              className="w-full pl-2.5 pr-14 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                              autoFocus
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black select-none">
                              -10
                            </span>
                          </div>
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={handleCancelEditCriterion}
                              className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditedCriterion(item.id, 'minus')}
                              disabled={!editCriterionTitle.trim()}
                              className="flex items-center space-x-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Terapkan</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-slate-50 hover:bg-rose-50/50 border border-slate-200 transition-colors group">
                          {/* Drag Grip Handle & Touch Long-Press */}
                          <div
                            onTouchStart={() => handleTouchStartCriterion('minus', idx)}
                            onTouchEnd={handleTouchEndCriterion}
                            onTouchCancel={handleTouchEndCriterion}
                            className="p-1 text-slate-400 hover:text-rose-700 cursor-grab active:cursor-grabbing shrink-0 select-none touch-none"
                            title="Tekan lama / drag naik turun untuk memindahkan posisi"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>

                          {/* Quick Up/Down Buttons */}
                          <div className="flex flex-col -space-y-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveNegativeCriterion(idx, idx - 1)}
                              className="p-0.5 text-slate-400 hover:text-rose-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                              title="Pindahkan ke atas"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === localNegativeCriteria.length - 1}
                              onClick={() => handleMoveNegativeCriterion(idx, idx + 1)}
                              className="p-0.5 text-slate-400 hover:text-rose-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                              title="Pindahkan ke bawah"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Criteria Badge & Title */}
                          <div className="flex items-start space-x-2 min-w-0 flex-1 ml-0.5">
                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black shadow-xs">
                              -10
                            </span>
                            <p className="text-xs text-slate-800 font-medium leading-snug break-words">
                              {item.title}
                            </p>
                          </div>

                          {/* Action Buttons: Edit & Delete */}
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditCriterion(item)}
                              className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit kriteria ini"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNegativeCriterion(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus kriteria ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {localNegativeCriteria.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400 italic">
                    Belum ada kriteria pengurang poin.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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

      {/* Modal Konfirmasi Reset Seluruh Penilaian Siswa */}
      {showResetScoresConfirm && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 bg-slate-900/75 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-6 relative space-y-4 my-auto">
              <div className="flex items-center space-x-3 text-rose-600">
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    Reset Seluruh Penilaian Siswa?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mengosongkan semua riwayat nilai 20 pertemuan
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200/70 text-xs text-slate-700 space-y-2">
                <p className="font-bold text-rose-950">
                  Apakah Anda yakin ingin mereset penilaian pada pertemuan tanpa jadwal?
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-slate-600 text-[11px] leading-relaxed">
                  <li>
                    <strong className="text-emerald-700">Pertemuan berjadwal aman:</strong> Nilai yang sudah terisi pada pertemuan yang telah di-set tanggalnya <strong>TIDAK IKUT TER-RESET</strong> (tetap tersimpan aman).
                  </li>
                  <li>
                    <strong className="text-rose-700">Pertemuan tanpa jadwal:</strong> Hanya nilai dan catatan uji coba pada pertemuan yang belum di-set tanggalnya yang akan dikosongkan.
                  </li>
                  <li>
                    Rata-rata sikap untuk {students.length} siswa akan otomatis dihitung ulang berdasarkan pertemuan resmi berjadwal.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  disabled={isResettingScores}
                  onClick={() => setShowResetScoresConfirm(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isResettingScores}
                  onClick={handleConfirmResetScores}
                  className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isResettingScores ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mereset Data...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ya, Reset Nilai Tanpa Tanggal</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
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
                const validScores: number[] = [];
                for (let i = 0; i < 20; i++) {
                  const sched = schedules.find((s) => s.meetingNumber === i + 1);
                  const isDateSet = Boolean(sched?.activeDate && sched.activeDate.trim() !== '');
                  if (isDateSet) {
                    const raw = meetingScores[i];
                    const sc = typeof raw === 'number' && raw !== null && (raw as number) > 0 ? (raw as number) : 80;
                    validScores.push(sc);
                  }
                }

                const effectiveValidScores =
                  validScores.length > 0 ? validScores : (selectedStudentForModal.score > 0 ? [selectedStudentForModal.score] : [80]);
                const avgScore = effectiveValidScores.length > 0
                  ? Math.round(effectiveValidScores.reduce((sum, val) => sum + val, 0) / effectiveValidScores.length)
                  : 80;

                const style = getScoreColorScheme(avgScore);
                const quote = avgScore !== null ? getQuoteForScore(
                  avgScore,
                  selectedStudentForModal.nisn || selectedStudentForModal.id
                ) : 'Penilaian kokurikuler belum dimulai.';

                return (
                  <div className="space-y-2.5">
                    {/* Ringkasan Nilai Rata-rata Akhir */}
                    <div className={`p-3 rounded-2xl text-center border shadow-2xs ${style.card}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                        Nilai Rata-Rata Akhir
                      </div>
                      <div className="text-3xl font-black tracking-tight my-0.5">
                        {avgScore !== null ? avgScore : '-'}
                      </div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider">
                        Predikat: {avgScore !== null ? style.predicate : 'Belum Dinilai'}
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
                          const sched = schedules.find((s) => s.meetingNumber === meetingNum);
                          const isDateSet = Boolean(sched?.activeDate && sched.activeDate.trim() !== '');
                          let mScore: number | null = null;

                          if (isDateSet) {
                            const raw = meetingScores[idx];
                            mScore = raw !== undefined && raw !== null && (raw as number) > 0 ? (raw as number) : 80;
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
                      const currentSched = schedules.find((s) => s.meetingNumber === currentMeetingNum);
                      const isCurrentDateSet = Boolean(currentSched?.activeDate && currentSched.activeDate.trim() !== '');
                      let currentMeetingScore: number | null = null;
                      if (isCurrentDateSet) {
                        const raw = meetingScores[selectedMeetingIndex];
                        currentMeetingScore = raw !== undefined && raw !== null && (raw as number) > 0 ? (raw as number) : 80;
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
