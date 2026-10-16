import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  HardDrive,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  LogOut,
  Folder,
  FileText,
  File,
  X,
  UploadCloud,
  Download,
  Users,
  Award,
  BookOpen,
  Code2,
  Copy,
  Check,
  Sparkles,
  Link2,
  Send
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  signInWithGoogleWorkspace,
  logoutGoogleWorkspace,
  listGoogleDriveFiles,
  createGoogleSpreadsheet,
  createGoogleDriveFolder,
  deleteGoogleDriveFile,
  exportAttitudeScoresToGoogleSheets,
  exportQuizResultsToGoogleSheets,
  exportStudentRosterToGoogleSheets,
  readGoogleSpreadsheetValues,
  getGoogleSpreadsheetMetadata,
  initGoogleAuth,
  sendDataToGoogleAppsScript
} from '../services/googleWorkspaceService';
import {
  saveAppsScriptUrlInDb,
  getAppsScriptUrlFromDb
} from '../services/firestoreService';
import { Student, MeetingSchedule, StudentModuleProgress, GoogleDriveFile } from '../types';

interface GoogleWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  students?: Student[];
  classes?: { id: string; name: string }[];
  schedules?: MeetingSchedule[];
  allQuizProgress?: StudentModuleProgress[];
  onImportStudents?: (importedStudents: Partial<Student>[]) => void;
}

const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = data.sheetTitle || "Rekap Nilai";
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Tulis Header
    if (data.headers && data.headers.length > 0) {
      sheet.appendRow(data.headers);
    }
    
    // Tulis Baris Data
    if (data.rows && data.rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, data.rows.length, data.rows[0].length).setValues(data.rows);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      url: ss.getUrl(),
      rowsAdded: data.rows ? data.rows.length : 0 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export const GoogleWorkspaceModal: React.FC<GoogleWorkspaceModalProps> = ({
  isOpen,
  onClose,
  students = [],
  classes = [],
  schedules = [],
  allQuizProgress = [],
  onImportStudents
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'apps_script' | 'drive' | 'export_scores' | 'export_quiz' | 'import_sheets'>('apps_script');

  // Google Apps Script (Anyone - Tanpa Login) State
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>('');
  const [isSavingAppsScriptUrl, setIsSavingAppsScriptUrl] = useState<boolean>(false);
  const [isSendingAppsScript, setIsSendingAppsScript] = useState<boolean>(false);
  const [isCopiedScript, setIsCopiedScript] = useState<boolean>(false);

  // Drive state
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mimeFilter, setMimeFilter] = useState<'all' | 'spreadsheets' | 'documents' | 'folders'>('all');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string; link?: string } | null>(null);

  // New item modals
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Confirmation dialog for destructive operation (MANDATORY)
  const [fileToDelete, setFileToDelete] = useState<GoogleDriveFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Export selection state
  const [selectedClassForExport, setSelectedClassForExport] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Import from Sheets state
  const [importSpreadsheetId, setImportSpreadsheetId] = useState('');
  const [importRange, setImportRange] = useState('A2:E');
  const [isImporting, setIsImporting] = useState(false);
  const [previewImportRows, setPreviewImportRows] = useState<(string | number)[][]>([]);

  // Init auth & fetch saved Apps Script URL
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (currentUser) => {
        setUser(currentUser);
        setIsAuthenticated(true);
      },
      () => {
        setUser(null);
        setIsAuthenticated(false);
      }
    );

    getAppsScriptUrlFromDb().then((url) => {
      if (url) setAppsScriptUrl(url);
    });

    return () => unsubscribe();
  }, []);

  // Fetch files when tab is drive and authenticated
  useEffect(() => {
    if (isOpen && isAuthenticated && activeTab === 'drive') {
      loadDriveFiles();
    }
  }, [isOpen, isAuthenticated, activeTab, mimeFilter]);

  const loadDriveFiles = async () => {
    setIsLoadingFiles(true);
    setStatusMessage(null);
    try {
      const result = await listGoogleDriveFiles({
        query: searchQuery,
        mimeTypeFilter: mimeFilter,
        pageSize: 40,
      });
      setFiles(result.files);
    } catch (err: any) {
      console.error('Error loading files:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Gagal memuat file Google Drive.' });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setStatusMessage(null);
    try {
      const result = await signInWithGoogleWorkspace();
      setUser(result.user);
      setIsAuthenticated(true);
      setStatusMessage({ type: 'success', text: `Berhasil terhubung dengan akun Google: ${result.user.email}` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Login Google dibatalkan atau gagal.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogleWorkspace();
    setUser(null);
    setIsAuthenticated(false);
    setFiles([]);
    setStatusMessage({ type: 'info', text: 'Telah keluar dari akun Google Workspace.' });
  };

  // Save Apps Script URL to Firestore
  const handleSaveAppsScriptUrl = async () => {
    if (!appsScriptUrl.trim()) return;
    setIsSavingAppsScriptUrl(true);
    try {
      await saveAppsScriptUrlInDb(appsScriptUrl.trim());
      setStatusMessage({
        type: 'success',
        text: 'URL Web App Google Apps Script berhasil disimpan. Siap digunakan tanpa login akun Google!',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Gagal menyimpan URL Apps Script ke database.' });
    } finally {
      setIsSavingAppsScriptUrl(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setIsCopiedScript(true);
    setTimeout(() => setIsCopiedScript(false), 2500);
  };

  // Send Attitude Scores to Apps Script (NO GOOGLE LOGIN REQUIRED)
  const handleSendAttitudeToAppsScript = async () => {
    if (!appsScriptUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Masukkan dan simpan URL Web App Google Apps Script terlebih dahulu.' });
      return;
    }
    setIsSendingAppsScript(true);
    setStatusMessage(null);
    try {
      const filtered = selectedClassForExport
        ? students.filter((s) => s.className?.toLowerCase() === selectedClassForExport.toLowerCase())
        : students;

      if (filtered.length === 0) {
        throw new Error('Tidak ada data siswa untuk dikirim.');
      }

      const headers = [
        'No',
        'NISN',
        'Nama Siswa',
        'Kelas',
        'Judul Proyek',
        ...Array.from({ length: 20 }, (_, i) => `P${i + 1}`),
        'Nilai Akhir',
        'Catatan Guru',
      ];

      const rows = filtered.map((st, idx) => {
        const meetingCols = Array.from({ length: 20 }, (_, i) => {
          if (st.meetingAbsences?.[i]) return 'Tidak Hadir';
          const score = st.meetingScores?.[i];
          return score !== null && score !== undefined ? score : '-';
        });

        return [
          idx + 1,
          `'${st.nisn}`,
          st.name,
          st.className || '-',
          st.projectTitle || '-',
          ...meetingCols,
          st.score ?? 80,
          st.notes || '-',
        ];
      });

      const res = await sendDataToGoogleAppsScript(appsScriptUrl.trim(), {
        action: 'export_attitude',
        title: `Rekap Sikap ${selectedClassForExport || 'Semua Kelas'}`,
        sheetTitle: `Nilai Sikap ${selectedClassForExport || 'Semua'}`,
        headers,
        rows,
      });

      setStatusMessage({
        type: 'success',
        text: `Berhasil mengirim ${filtered.length} nilai sikap ke Google Sheets via Apps Script (Tanpa Login)!`,
        link: res.url,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal mengirim data ke Apps Script.' });
    } finally {
      setIsSendingAppsScript(false);
    }
  };

  // Send Quiz Scores to Apps Script (NO GOOGLE LOGIN REQUIRED)
  const handleSendQuizToAppsScript = async () => {
    if (!appsScriptUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Masukkan dan simpan URL Web App Google Apps Script terlebih dahulu.' });
      return;
    }
    setIsSendingAppsScript(true);
    setStatusMessage(null);
    try {
      if (allQuizProgress.length === 0) {
        throw new Error('Belum ada data nilai kuis modul siswa.');
      }

      const headers = [
        'No',
        'NISN',
        'Nama Siswa',
        'Kelas',
        'Modul',
        'Nilai Terbaru',
        'Nilai Tertinggi',
        'Benar',
        'Total',
        'Status',
        'Waktu',
      ];

      const rows = allQuizProgress.map((p, idx) => [
        idx + 1,
        `'${p.studentNisn}`,
        p.studentName,
        p.studentClass || '-',
        p.moduleTitle || '-',
        p.quizScore ?? '-',
        p.highestQuizScore ?? '-',
        p.quizCorrectCount ?? '-',
        p.quizTotalCount ?? '-',
        p.isCompleted ? 'Selesai' : 'Sedang Dikerjakan',
        p.lastQuizAttemptAt ? new Date(p.lastQuizAttemptAt).toLocaleString('id-ID') : '-',
      ]);

      const res = await sendDataToGoogleAppsScript(appsScriptUrl.trim(), {
        action: 'export_quiz',
        title: 'Rekap Kuis Modul Siswa',
        sheetTitle: 'Rekap Kuis Modul',
        headers,
        rows,
      });

      setStatusMessage({
        type: 'success',
        text: `Berhasil mengirim ${allQuizProgress.length} data kuis ke Google Sheets via Apps Script (Tanpa Login)!`,
        link: res.url,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal mengirim data kuis ke Apps Script.' });
    } finally {
      setIsSendingAppsScript(false);
    }
  };

  // Create new blank Google Sheet
  const handleCreateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;

    setIsExporting(true);
    setStatusMessage(null);
    try {
      const res = await createGoogleSpreadsheet({
        title: newSheetTitle.trim(),
        headers: ['No', 'Kolom A', 'Kolom B', 'Kolom C', 'Catatan'],
        rows: [[1, 'Data 1', 'Data 2', 'Data 3', 'Contoh baris']],
      });
      setIsCreatingSheet(false);
      setNewSheetTitle('');
      setStatusMessage({
        type: 'success',
        text: 'Google Spreadsheet baru berhasil dibuat di Google Drive!',
        link: res.spreadsheetUrl,
      });
      loadDriveFiles();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal membuat Google Spreadsheet.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Create new Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsExporting(true);
    setStatusMessage(null);
    try {
      await createGoogleDriveFolder(newFolderName.trim());
      setIsCreatingFolder(false);
      setNewFolderName('');
      setStatusMessage({ type: 'success', text: `Folder "${newFolderName}" berhasil dibuat di Google Drive.` });
      loadDriveFiles();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal membuat folder di Google Drive.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Delete file with mandatory confirmation dialog
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteGoogleDriveFile(fileToDelete.id);
      setStatusMessage({ type: 'success', text: `File "${fileToDelete.name}" berhasil dihapus dari Google Drive.` });
      setFileToDelete(null);
      loadDriveFiles();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal menghapus file dari Google Drive.' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Export Attitude Scores via OAuth
  const handleExportAttitudeScores = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const filtered = selectedClassForExport
        ? students.filter((s) => s.className?.toLowerCase() === selectedClassForExport.toLowerCase())
        : students;

      if (filtered.length === 0) {
        throw new Error('Tidak ada data siswa untuk diekspor pada filter yang dipilih.');
      }

      const res = await exportAttitudeScoresToGoogleSheets({
        className: selectedClassForExport,
        students: filtered,
        schedules,
      });

      setStatusMessage({
        type: 'success',
        text: `Berhasil mengekspor penilaian sikap ${filtered.length} siswa ke Google Sheets!`,
        link: res.spreadsheetUrl,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal mengekspor penilaian sikap.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Export Quiz Scores via OAuth
  const handleExportQuizScores = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      if (allQuizProgress.length === 0) {
        throw new Error('Belum ada data nilai kuis modul siswa untuk diekspor.');
      }

      const res = await exportQuizResultsToGoogleSheets({
        progressList: allQuizProgress,
      });

      setStatusMessage({
        type: 'success',
        text: `Berhasil mengekspor rekap ${allQuizProgress.length} nilai kuis modul ke Google Sheets!`,
        link: res.spreadsheetUrl,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal mengekspor nilai kuis modul.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Export Student Roster via OAuth
  const handleExportStudentRoster = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const filtered = selectedClassForExport
        ? students.filter((s) => s.className?.toLowerCase() === selectedClassForExport.toLowerCase())
        : students;

      if (filtered.length === 0) {
        throw new Error('Tidak ada siswa untuk diekspor.');
      }

      const res = await exportStudentRosterToGoogleSheets({
        className: selectedClassForExport,
        students: filtered,
      });

      setStatusMessage({
        type: 'success',
        text: `Berhasil mengekspor daftar ${filtered.length} siswa ke Google Sheets!`,
        link: res.spreadsheetUrl,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal mengekspor daftar siswa.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Read Google Sheet preview for importing
  const handlePreviewSheet = async () => {
    if (!importSpreadsheetId.trim()) {
      setStatusMessage({ type: 'error', text: 'Masukkan ID Spreadsheet atau pilih file dari Google Drive.' });
      return;
    }
    setIsImporting(true);
    setStatusMessage(null);
    try {
      let sheetId = importSpreadsheetId.trim();
      const match = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetId = match[1];
      }

      const meta = await getGoogleSpreadsheetMetadata(sheetId);
      const firstSheetTitle = meta.sheets[0]?.title || 'Sheet1';
      const range = `${firstSheetTitle}!${importRange || 'A2:E'}`;

      const rows = await readGoogleSpreadsheetValues(sheetId, range);
      if (rows.length === 0) {
        throw new Error('Tidak ada baris data yang ditemukan pada rentang tersebut.');
      }
      setPreviewImportRows(rows);
      setStatusMessage({
        type: 'info',
        text: `Ditemukan ${rows.length} baris data dari Google Sheet "${meta.title}". Klik "Impor Siswa ke Aplikasi" untuk memproses.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal membaca spreadsheet.' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExecuteImport = () => {
    if (previewImportRows.length === 0) return;
    const parsed: Partial<Student>[] = [];
    previewImportRows.forEach((row) => {
      const nisn = String(row[0] || '').trim();
      const name = String(row[1] || '').trim();
      const className = String(row[2] || '').trim();
      const projectTitle = row[3] ? String(row[3]).trim() : undefined;

      if (nisn && name) {
        parsed.push({
          nisn,
          name,
          className: className || 'Kelas 7A',
          projectTitle,
        });
      }
    });

    if (parsed.length === 0) {
      setStatusMessage({ type: 'error', text: 'Tidak ada data siswa yang valid dengan NISN dan Nama.' });
      return;
    }

    if (onImportStudents) {
      onImportStudents(parsed);
      setStatusMessage({
        type: 'success',
        text: `Berhasil mengimpor ${parsed.length} siswa dari Google Sheets ke dalam aplikasi!`,
      });
      setPreviewImportRows([]);
    } else {
      setStatusMessage({
        type: 'info',
        text: `Berhasil memverifikasi ${parsed.length} siswa siap diimpor.`,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">Google Sheets & Google Drive</h3>
                <span className="text-[10px] bg-teal-400/20 text-teal-200 border border-teal-300/30 px-2 py-0.5 rounded-full font-bold">
                  Dua Pilihan Mode
                </span>
              </div>
              <p className="text-xs text-teal-100/90 font-medium">
                Pilih Mode Apps Script (Tanpa Login Siapa Saja) atau Mode Akun Google (OAuth)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            <div className="flex items-center space-x-2 min-w-0">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <span className="truncate">{statusMessage.text}</span>
            </div>

            {statusMessage.link && (
              <a
                href={statusMessage.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-3 py-1 bg-white text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-300 font-bold text-xs shrink-0 ml-2"
              >
                <span>Buka di Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-2 overflow-x-auto shrink-0">
          {/* TAB 1: APPS SCRIPT (TANPA LOGIN - ANYONE) */}
          <button
            type="button"
            onClick={() => setActiveTab('apps_script')}
            className={`flex items-center space-x-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'apps_script'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Apps Script (Tanpa Login / Anyone)</span>
            <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-black">
              Praktis
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('drive')}
            className={`flex items-center space-x-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'drive'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Google Drive Files (OAuth)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export_scores')}
            className={`flex items-center space-x-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'export_scores'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="w-4 h-4 text-amber-500" />
            <span>Ekspor Nilai Sikap</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export_quiz')}
            className={`flex items-center space-x-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'export_quiz'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4 text-teal-600" />
            <span>Ekspor Nilai Kuis Modul</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import_sheets')}
            className={`flex items-center space-x-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'import_sheets'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Impor Siswa dari Sheets</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50">
          {/* ======================================================== */}
          {/* TAB 1: GOOGLE APPS SCRIPT (ANYONE - TANPA LOGIN SAMA SEKALI) */}
          {/* ======================================================== */}
          {activeTab === 'apps_script' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-4 sm:p-5 rounded-2xl border border-teal-200 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-sm font-black text-slate-900">
                    Mode Bebas Akun Google (Anyone / Tanpa Perlu Login)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Dengan metode <strong>Google Apps Script Web App</strong>, Anda (maupun guru dan siswa) <strong>TIDAK PERLU</strong> melakukan login akun Google di aplikasi ini. Data nilai sikap, kuis modul, dan daftar siswa langsung dikirim secara otomatis ke Google Spreadsheet sekolah Anda!
                </p>
              </div>

              {/* URL Apps Script Input */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
                <label className="text-xs font-bold text-slate-800 block">
                  Tempelkan URL Web App Google Apps Script Anda:
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={appsScriptUrl}
                      onChange={(e) => setAppsScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAppsScriptUrl}
                    disabled={isSavingAppsScriptUrl || !appsScriptUrl.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    {isSavingAppsScriptUrl ? 'Menyimpan...' : 'Simpan URL'}
                  </button>
                </div>
              </div>

              {/* Tombol Ekspor Instan Tanpa Login */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
                <h5 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                  Kirim Data Sekarang (Tanpa Login Akun Google):
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleSendAttitudeToAppsScript}
                    disabled={isSendingAppsScript || !appsScriptUrl.trim()}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Award className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Kirim Rekap Nilai Sikap</div>
                        <div className="text-[10px] text-slate-500">Nilai P1-P20 dan catatan guru</div>
                      </div>
                    </div>
                    <Send className="w-4 h-4 text-emerald-600 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSendQuizToAppsScript}
                    disabled={isSendingAppsScript || !appsScriptUrl.trim()}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl text-left transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <BookOpen className="w-5 h-5 text-teal-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Kirim Rekap Kuis Modul</div>
                        <div className="text-[10px] text-slate-500">Skor kuis modul seluruh siswa</div>
                      </div>
                    </div>
                    <Send className="w-4 h-4 text-teal-600 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Panduan & Kode Google Apps Script */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-slate-600" />
                    <span className="text-xs font-black text-slate-800">Kode Google Apps Script (Siap Pakai)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="flex items-center space-x-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                  >
                    {isCopiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedScript ? 'Tersalin!' : 'Salin Kode'}</span>
                  </button>
                </div>

                <div className="text-xs text-slate-500 space-y-1 leading-relaxed">
                  <p><strong>Cara Pasang (Hanya 1 Menit):</strong></p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Buka Google Spreadsheet baru Anda di Google Drive.</li>
                    <li>Klik menu <strong>Ekstensi (Extensions) &rarr; Apps Script</strong>.</li>
                    <li>Hapus semua teks yang ada, lalu tempel kode di bawah ini.</li>
                    <li>Klik <strong>Terapkan (Deploy) &rarr; Penerapan Baru (New Deployment)</strong>.</li>
                    <li>Pilih jenis <strong>Aplikasi Web (Web App)</strong>.</li>
                    <li>Setel <em>Jalankan sebagai (Execute as)</em>: <strong>Saya (Me)</strong>.</li>
                    <li>Setel <em>Siapa yang memiliki akses (Who has access)</em>: <strong>Siapa saja (Anyone)</strong>.</li>
                    <li>Klik <strong>Terapkan (Deploy)</strong>, lalu salin URL Web App yang dihasilkan dan tempelkan di kotak atas!</li>
                  </ol>
                </div>

                <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                  {APPS_SCRIPT_TEMPLATE}
                </pre>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: GOOGLE DRIVE FILES (OAUTH MODE) */}
          {/* ======================================================== */}
          {activeTab === 'drive' && (
            <div className="space-y-3">
              {/* Auth Banner if not authenticated */}
              {!isAuthenticated ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs max-w-lg mx-auto space-y-4 my-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <HardDrive className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Jelajahi Berkas Google Drive Pribadi</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      Mode ini memerlukan login akun Google jika Anda ingin membuka dan melihat berkas-berkas di Google Drive Anda langsung dari aplikasi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Toolbar Drive */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadDriveFiles()}
                        placeholder="Cari file di Google Drive..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                      />
                    </div>

                    <div className="flex items-center flex-wrap gap-1.5">
                      <select
                        value={mimeFilter}
                        onChange={(e: any) => setMimeFilter(e.target.value)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <option value="all">Semua Jenis File</option>
                        <option value="spreadsheets">Google Sheets (.sheet)</option>
                        <option value="documents">Dokumen & PDF</option>
                        <option value="folders">Folder</option>
                      </select>

                      <button
                        type="button"
                        onClick={loadDriveFiles}
                        disabled={isLoadingFiles}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                        title="Segarkan daftar file"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCreatingSheet(true)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Sheet Baru</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCreatingFolder(true)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Folder Baru</span>
                      </button>
                    </div>
                  </div>

                  {/* Form Modal Buat Spreadsheet Baru */}
                  {isCreatingSheet && (
                    <form onSubmit={handleCreateSheet} className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center gap-2 animate-fadeIn">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                      <input
                        type="text"
                        value={newSheetTitle}
                        onChange={(e) => setNewSheetTitle(e.target.value)}
                        placeholder="Nama file spreadsheet baru..."
                        className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={isExporting || !newSheetTitle.trim()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        {isExporting ? 'Membuat...' : 'Buat'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatingSheet(false)}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Batal
                      </button>
                    </form>
                  )}

                  {/* Form Modal Buat Folder Baru */}
                  {isCreatingFolder && (
                    <form onSubmit={handleCreateFolder} className="p-3 bg-teal-50/80 border border-teal-200 rounded-2xl flex items-center gap-2 animate-fadeIn">
                      <FolderPlus className="w-5 h-5 text-teal-600 shrink-0" />
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Nama folder baru di Google Drive..."
                        className="flex-1 px-3 py-1.5 bg-white border border-teal-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={isExporting || !newFolderName.trim()}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        {isExporting ? 'Membuat...' : 'Buat Folder'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatingFolder(false)}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Batal
                      </button>
                    </form>
                  )}

                  {/* File List */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
                    {isLoadingFiles ? (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                        <p className="text-xs font-semibold">Mengambil file dari Google Drive...</p>
                      </div>
                    ) : files.length > 0 ? (
                      files.map((file) => {
                        const isSheet = file.mimeType.includes('spreadsheet');
                        const isFolder = file.mimeType.includes('folder');
                        const isDoc = file.mimeType.includes('document') || file.mimeType.includes('pdf');

                        return (
                          <div key={file.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                {isSheet ? (
                                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                ) : isFolder ? (
                                  <Folder className="w-4 h-4 text-amber-500" />
                                ) : isDoc ? (
                                  <FileText className="w-4 h-4 text-blue-500" />
                                ) : (
                                  <File className="w-4 h-4 text-slate-500" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">{file.name}</div>
                                <div className="text-[10px] text-slate-400 flex items-center space-x-2 mt-0.5">
                                  <span>
                                    {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString('id-ID') : 'Baru saja'}
                                  </span>
                                  {file.owners && file.owners[0] && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate">{file.owners[0].displayName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1.5 shrink-0">
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-lg transition-colors"
                                  title="Buka di tab baru"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {isSheet && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setImportSpreadsheetId(file.id);
                                    setActiveTab('import_sheets');
                                  }}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                  title="Pilih spreadsheet ini untuk impor data siswa"
                                >
                                  Pilih untuk Impor
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setFileToDelete(file)}
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Hapus file dari Google Drive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-slate-400 space-y-1">
                        <HardDrive className="w-7 h-7 mx-auto text-slate-300" />
                        <p className="text-xs font-semibold">Tidak ada file yang cocok di Google Drive Anda.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: EKSPOR NILAI SIKAP (OAUTH MODE) */}
          {/* ======================================================== */}
          {activeTab === 'export_scores' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Ekspor Rekap Nilai Sikap ke Google Sheets</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Membuat berkas spreadsheet resmi di Google Drive Anda berisi nilai Pertemuan 1-20, nilai akhir, predikat, dan catatan guru setiap siswa.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Filter Kelas:</label>
                  <select
                    value={selectedClassForExport}
                    onChange={(e) => setSelectedClassForExport(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Semua Kelas ({students.length} Siswa)</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({students.filter((s) => s.className === c.name).length} Siswa)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Jumlah Data:</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
                    {selectedClassForExport
                      ? `${students.filter((s) => s.className === selectedClassForExport).length} siswa di ${selectedClassForExport}`
                      : `${students.length} total seluruh siswa`}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>Login Akun Google untuk Ekspor</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleExportAttitudeScores}
                    disabled={isExporting}
                    className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{isExporting ? 'Mengekspor ke Google Sheets...' : 'Buat Google Spreadsheet Penilaian Sikap'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: EKSPOR NILAI KUIS MODUL (OAUTH MODE) */}
          {/* ======================================================== */}
          {activeTab === 'export_quiz' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-200">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Ekspor Rekap Kuis Modul ke Google Sheets</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Membuat spreadsheet di Google Drive Anda berisi daftar nilai kuis modul, nilai tertinggi, jumlah soal benar, dan status penyelesaian setiap siswa.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                <span>Total riwayat kuis siswa tercatat:</span>
                <span className="font-bold text-slate-900">{allQuizProgress.length} data modul</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="flex items-center space-x-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>Login Akun Google untuk Ekspor</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleExportQuizScores}
                    disabled={isExporting || allQuizProgress.length === 0}
                    className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{isExporting ? 'Mengekspor...' : 'Buat Google Spreadsheet Rekap Kuis'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: IMPOR SISWA DARI GOOGLE SHEETS */}
          {/* ======================================================== */}
          {activeTab === 'import_sheets' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Impor Data Siswa dari Google Sheets</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Baca data siswa langsung dari Google Spreadsheet di Google Drive Anda. Format kolom: Kolom A = NISN, Kolom B = Nama Siswa, Kolom C = Kelas, Kolom D = Judul Proyek.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ID Spreadsheet atau Tautan URL Google Sheets:
                  </label>
                  <input
                    type="text"
                    value={importSpreadsheetId}
                    onChange={(e) => setImportSpreadsheetId(e.target.value)}
                    placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Rentang Sel (Range):</label>
                  <input
                    type="text"
                    value={importRange}
                    onChange={(e) => setImportRange(e.target.value)}
                    placeholder="A2:D"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePreviewSheet}
                  disabled={isImporting || !importSpreadsheetId.trim()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isImporting ? 'Membaca...' : 'Pratinjau Data Sheets'}
                </button>

                <button
                  type="button"
                  onClick={handleExportStudentRoster}
                  disabled={isExporting}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Ekspor Daftar Siswa Ini ke Sheets Baru
                </button>
              </div>

              {/* Pratinjau Baris Data */}
              {previewImportRows.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Pratinjau {previewImportRows.length} Baris Data:
                    </span>
                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer active:scale-95"
                    >
                      Impor Siswa ke Aplikasi
                    </button>
                  </div>

                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl overflow-hidden bg-slate-50 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-200/80 text-[11px] font-black uppercase text-slate-700 sticky top-0">
                        <tr>
                          <th className="p-2">NISN</th>
                          <th className="p-2">Nama</th>
                          <th className="p-2">Kelas</th>
                          <th className="p-2">Proyek</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewImportRows.slice(0, 15).map((row, idx) => (
                          <tr key={idx} className="hover:bg-white">
                            <td className="p-2 font-mono font-bold">{row[0] || '-'}</td>
                            <td className="p-2 font-semibold">{row[1] || '-'}</td>
                            <td className="p-2">{row[2] || '-'}</td>
                            <td className="p-2 text-slate-500">{row[3] || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewImportRows.length > 15 && (
                      <div className="p-2 text-center text-[11px] text-slate-500 bg-white">
                        ...dan {previewImportRows.length - 15} baris lainnya
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Mode Bebas Login (Google Apps Script) & Mode OAuth Tersedia</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* MANDATORY USER CONFIRMATION DIALOG FOR DESTRUCTIVE OPERATION (SKILL REQUIREMENT) */}
      {fileToDelete && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">Konfirmasi Hapus File Google Drive</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus file{' '}
                <span className="font-bold text-slate-900">"{fileToDelete.name}"</span> dari Google Drive Anda?
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
