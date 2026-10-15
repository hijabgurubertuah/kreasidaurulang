import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LearningModule,
  ModulePage,
  QuizQuestion,
  StudentModuleProgress,
  Student,
} from '../types';
import {
  listenToModules,
  saveAllModulesInDb,
  listenToAllModuleProgress,
} from '../services/firestoreService';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  MoveUp,
  MoveDown,
  Lock,
  Unlock,
  KeyRound,
  FileText,
  Gamepad2,
  HelpCircle,
  Eye,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Home,
  Award,
} from 'lucide-react';

interface ModuleManagementProps {
  students?: Student[];
  onBackToAdminPortal?: () => void;
}

export const ModuleManagement: React.FC<ModuleManagementProps> = ({
  students = [],
  onBackToAdminPortal,
}) => {
  const [subTab, setSubTab] = useState<'modules' | 'scores'>('modules');
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [allProgress, setAllProgress] = useState<StudentModuleProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);

  // Unsaved Changes Tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingToFirebase, setIsSavingToFirebase] = useState(false);
  const [pendingDeletedModuleIds, setPendingDeletedModuleIds] = useState<string[]>([]);

  // Active Selected Module & Page Index
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [addPageDropdownOpen, setAddPageDropdownOpen] = useState(false);

  // Delete Confirm Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'module' | 'page' | 'quizQuestion';
    id: string;
    title: string;
  } | null>(null);

  // Page Editor Modal
  const [editingPage, setEditingPage] = useState<{
    isNew: boolean;
    page: ModulePage;
  } | null>(null);

  // Live Game Preview in Editor Modal
  const [showGamePreview, setShowGamePreview] = useState(false);

  // Recap Filter & Search
  const [filterModuleId, setFilterModuleId] = useState<string>('');
  const [searchRecap, setSearchRecap] = useState<string>('');

  // Alerts & Notifications
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active module & active page resolution
  const activeModule = useMemo(() => {
    return modules.find((m) => m.id === activeModuleId) || modules[0] || null;
  }, [modules, activeModuleId]);

  const activePage = useMemo(() => {
    if (!activeModule || !activeModule.pages || activeModule.pages.length === 0) return null;
    const safeIdx = Math.min(Math.max(0, activePageIndex), activeModule.pages.length - 1);
    return activeModule.pages[safeIdx] || null;
  }, [activeModule, activePageIndex]);

  // Initial Real-time Subscribe to modules from Firestore
  useEffect(() => {
    setIsLoading(true);
    const unsub = listenToModules(
      (list) => {
        setIsLoading(false);
        // Only initialize state on first load to preserve local drafts without overwriting
        if (!hasLoadedInitially) {
          setModules(list);
          if (list.length > 0 && !activeModuleId) {
            setActiveModuleId(list[0].id);
          }
          setHasLoadedInitially(true);
        }
      },
      (err) => {
        setIsLoading(false);
        setErrorMsg('Gagal memuat modul dari database.');
      }
    );
    return () => unsub();
  }, [hasLoadedInitially, activeModuleId]);

  // Real-time subscribe to student progress recap
  useEffect(() => {
    const unsub = listenToAllModuleProgress((progList) => {
      setAllProgress(progList);
    });
    return () => unsub();
  }, []);

  // Auto-dismiss alerts
  useEffect(() => {
    if (saveSuccessMsg) {
      const timer = setTimeout(() => setSaveSuccessMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // --- SAVE ALL CHANGES TO FIREBASE ---
  const handleSaveToFirebase = async () => {
    setIsSavingToFirebase(true);
    try {
      await saveAllModulesInDb(modules, pendingDeletedModuleIds);
      setPendingDeletedModuleIds([]);
      setHasUnsavedChanges(false);
      setSaveSuccessMsg('Semua pengaturan modul berhasil disimpan ke Firebase!');
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal menyimpan ke Firebase. Cek koneksi Anda.');
    } finally {
      setIsSavingToFirebase(false);
    }
  };

  // --- 1. MODUL LOCAL ACTIONS (TIDAK LANGSUNG SIMPAN KE FIREBASE) ---
  const handleAddNewModule = () => {
    const newModNumber = modules.length + 1;
    const newId = `modul-${Date.now()}`;
    const newModule: LearningModule = {
      id: newId,
      title: `Modul ${newModNumber}`,
      order: newModNumber,
      isLockedWithPassword: false,
      password: '',
      pages: [
        {
          id: `page-${Date.now()}-1`,
          title: 'Halaman 1',
          type: 'materi',
          order: 1,
          content: 'Tuliskan materi pembelajaran kreasi daur ulang di sini...',
          readingDelaySeconds: 10,
          lockQuestion: {
            id: `q-${Date.now()}-1`,
            question: 'Pertanyaan pemahaman materi...',
            options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
            correctAnswerIndex: 0,
          },
        },
        {
          id: `page-${Date.now()}-quiz`,
          title: 'Kuis Akhir',
          type: 'quiz',
          order: 2,
          randomizeQuestions: true,
          quizQuestions: [
            {
              id: `q-quiz-${Date.now()}-1`,
              question: 'Contoh soal kuis akhir nomor 1...',
              options: ['Jawaban A', 'Jawaban B', 'Jawaban C', 'Jawaban D'],
              correctAnswerIndex: 0,
            },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
    };

    setModules([...modules, newModule]);
    setActiveModuleId(newModule.id);
    setActivePageIndex(0);
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(`Modul baru ditambahkan. Klik "Simpan ke Firebase" untuk menyimpan.`);
  };

  const handleUpdateActiveModule = (updated: LearningModule) => {
    setModules(modules.map((m) => (m.id === updated.id ? updated : m)));
    setHasUnsavedChanges(true);
  };

  const handleDeleteModule = (moduleId: string, moduleTitle: string) => {
    const remaining = modules.filter((m) => m.id !== moduleId);
    setModules(remaining);
    setPendingDeletedModuleIds([...pendingDeletedModuleIds, moduleId]);
    if (activeModuleId === moduleId) {
      setActiveModuleId(remaining.length > 0 ? remaining[0].id : null);
      setActivePageIndex(0);
    }
    setDeleteConfirm(null);
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(`Modul "${moduleTitle}" dihapus (belum disimpan ke Firebase).`);
  };

  const handleMoveModule = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const list = [...modules];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    list.forEach((m, i) => {
      m.order = i + 1;
    });

    setModules(list);
    setHasUnsavedChanges(true);
  };

  // --- 2. HALAMAN LOCAL ACTIONS (TIDAK LANGSUNG SIMPAN KE FIREBASE) ---
  const handleAddNewPage = (type: 'materi' | 'game' | 'quiz') => {
    if (!activeModule) return;
    setAddPageDropdownOpen(false);

    const pageCount = (activeModule.pages || []).length;
    const newPage: ModulePage = {
      id: `page-${Date.now()}`,
      title: type === 'materi' ? `Halaman ${pageCount + 1}` : type === 'game' ? 'Game Edukasi' : 'Kuis Akhir',
      type,
      order: pageCount + 1,
      readingDelaySeconds: 10,
      lockQuestion:
        type === 'materi'
          ? {
              id: `q-${Date.now()}`,
              question: 'Pertanyaan pemahaman materi...',
              options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
              correctAnswerIndex: 0,
            }
          : undefined,
      gameHtml:
        type === 'game'
          ? '<div style="display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif;background:#064e3b;color:#a7f3d0;font-size:18px;font-weight:bold;">🎮 Tempelkan kode HTML game Anda di sini</div>'
          : undefined,
      quizQuestions:
        type === 'quiz'
          ? [
              {
                id: `q-quiz-${Date.now()}`,
                question: 'Pertanyaan soal kuis 1...',
                options: ['Opsi 1', 'Opsi 2', 'Opsi 3', 'Opsi 4'],
                correctAnswerIndex: 0,
              },
            ]
          : undefined,
      randomizeQuestions: true,
    };

    setEditingPage({ isNew: true, page: newPage });
  };

  const handleSavePageModal = () => {
    if (!activeModule || !editingPage) return;

    let updatedPages = [...(activeModule.pages || [])];

    if (editingPage.isNew) {
      // Kuis akhir selalu paling bawah
      const quizPages = updatedPages.filter((p) => p.type === 'quiz');
      const nonQuizPages = updatedPages.filter((p) => p.type !== 'quiz');

      if (editingPage.page.type === 'quiz') {
        updatedPages = [...nonQuizPages, ...quizPages, editingPage.page];
      } else {
        updatedPages = [...nonQuizPages, editingPage.page, ...quizPages];
      }
    } else {
      updatedPages = updatedPages.map((p) => (p.id === editingPage.page.id ? editingPage.page : p));
    }

    updatedPages.forEach((p, idx) => {
      p.order = idx + 1;
    });

    const updatedModule: LearningModule = {
      ...activeModule,
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    };

    handleUpdateActiveModule(updatedModule);
    setEditingPage(null);
    setHasUnsavedChanges(true);
    // Point active page to the newly created/edited page
    const foundIdx = updatedPages.findIndex((p) => p.id === editingPage.page.id);
    if (foundIdx !== -1) setActivePageIndex(foundIdx);
  };

  const handleDeletePage = (pageId: string) => {
    if (!activeModule) return;
    const updatedPages = activeModule.pages.filter((p) => p.id !== pageId);
    updatedPages.forEach((p, idx) => {
      p.order = idx + 1;
    });

    const updatedModule: LearningModule = {
      ...activeModule,
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    };

    handleUpdateActiveModule(updatedModule);
    setDeleteConfirm(null);
    setHasUnsavedChanges(true);
    setActivePageIndex((prev) => Math.max(0, Math.min(prev, updatedPages.length - 1)));
    setSaveSuccessMsg('Halaman dihapus. Tekan "Simpan ke Firebase" untuk menyimpan permanen.');
  };

  const handleMovePage = (index: number, direction: 'up' | 'down') => {
    if (!activeModule) return;
    const pages = [...activeModule.pages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= pages.length) return;

    if (pages[index].type === 'quiz' && direction === 'up') {
      alert('Halaman Kuis Akhir harus selalu berada paling akhir modul.');
      return;
    }
    if (pages[targetIndex].type === 'quiz') {
      alert('Halaman Kuis Akhir tidak dapat dipindah ke tengah.');
      return;
    }

    const temp = pages[index];
    pages[index] = pages[targetIndex];
    pages[targetIndex] = temp;

    pages.forEach((p, idx) => {
      p.order = idx + 1;
    });

    const updatedModule: LearningModule = {
      ...activeModule,
      pages,
      updatedAt: new Date().toISOString(),
    };

    handleUpdateActiveModule(updatedModule);
    setActivePageIndex(targetIndex);
    setHasUnsavedChanges(true);
  };

  // --- 3. REKAP NILAI & CSV EXPORT ---
  const filteredProgress = useMemo(() => {
    let list = [...allProgress];

    if (filterModuleId) {
      list = list.filter((p) => p.moduleId === filterModuleId);
    }

    if (searchRecap.trim()) {
      const q = searchRecap.toLowerCase();
      list = list.filter(
        (p) =>
          p.studentName.toLowerCase().includes(q) ||
          p.studentNisn.toLowerCase().includes(q) ||
          (p.studentClass || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => (b.lastQuizAttemptAt || '').localeCompare(a.lastQuizAttemptAt || ''));
    return list;
  }, [allProgress, filterModuleId, searchRecap]);

  const handleExportRecapCsv = () => {
    if (filteredProgress.length === 0) {
      alert('Tidak ada data nilai untuk diekspor.');
      return;
    }

    const headers = ['NISN', 'Nama Siswa', 'Kelas', 'Modul', 'Nilai Terbaru', 'Nilai Tertinggi', 'Benar', 'Total Soal', 'Status', 'Waktu Pengerjaan'];
    const rows = filteredProgress.map((p) => [
      `'${p.studentNisn}`,
      `"${p.studentName.replace(/"/g, '""')}"`,
      `"${p.studentClass || '-'}"`,
      `"${p.moduleTitle || '-'}"`,
      p.quizScore ?? '-',
      p.highestQuizScore ?? '-',
      p.quizCorrectCount ?? '-',
      p.quizTotalCount ?? '-',
      p.isCompleted ? 'Selesai' : 'Sedang Dikerjakan',
      p.lastQuizAttemptAt ? new Date(p.lastQuizAttemptAt).toLocaleString('id-ID') : '-',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rekap_nilai_modul_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#063327] via-[#094233] to-[#041c16] text-slate-100 py-4 px-3 sm:px-6 relative animate-fadeIn">
      {/* TOMBOL PEMICU SIDEBAR MODUL ADMIN DI KIRI TENGAH: 120 TINGGI, 30 LEBAR - MENGGUNAKAN PORTAL AGAR TIDAK BISA TERSCROLL */}
      {!isSidebarOpen && typeof document !== 'undefined' &&
        createPortal(
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            title="Buka Menu Modul Admin"
            aria-label="Buka Menu Modul"
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[9990] w-[30px] h-[120px] bg-gradient-to-b from-teal-600 via-teal-700 to-emerald-800 hover:from-teal-500 hover:to-teal-600 text-white rounded-r-2xl shadow-2xl shadow-teal-950/50 flex flex-col items-center justify-between py-2.5 cursor-pointer border-r-2 border-y border-teal-300/50 active:scale-95 transition-all group select-none pointer-events-auto"
            style={{ position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 9990 }}
          >
            <BookOpen className="w-4 h-4 text-teal-200 group-hover:scale-110 transition-transform shrink-0" />
            <div className="flex flex-col items-center justify-center text-[10px] font-black tracking-tighter leading-[1.1] text-teal-100 select-none pointer-events-none">
              <span>M</span>
              <span>O</span>
              <span>D</span>
              <span>U</span>
              <span>L</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-teal-300 animate-pulse shrink-0" />
          </button>,
          document.body
        )}

      {/* Toast Notification */}
      {saveSuccessMsg && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-emerald-600 text-white rounded-2xl shadow-2xl flex items-center space-x-2 animate-fadeIn text-xs sm:text-sm font-bold border border-emerald-400/50">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-rose-600 text-white rounded-2xl shadow-2xl flex items-center space-x-2 animate-fadeIn text-xs sm:text-sm font-bold border border-rose-400/50">
          <AlertTriangle className="w-5 h-5 text-white shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="w-full max-w-5xl mx-auto space-y-4">
        {/* ======================================================== */}
        {/* VIEW 1: REKAP NILAI KUIS SISWA (JIKA DIPILIH DI SIDEBAR) */}
        {/* ======================================================== */}
        {subTab === 'scores' ? (
          <div className="space-y-4 animate-fadeIn">
            {/* Top Bar Switcher Rekap */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-3 sm:p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-teal-300" />
                <h3 className="text-sm sm:text-base font-black text-white">
                  Rekap Nilai Kuis Modul Siswa
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSubTab('modules')}
                  className="px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Kembali ke Editor Modul
                </button>
                <button
                  type="button"
                  onClick={handleExportRecapCsv}
                  className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center space-x-1 border border-white/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh CSV</span>
                </button>
              </div>
            </div>

            {/* Filter & Search */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl p-4 sm:p-6 space-y-4 text-slate-800">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchRecap}
                    onChange={(e) => setSearchRecap(e.target.value)}
                    placeholder="Cari siswa berdasarkan nama, NISN, atau kelas..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <select
                  value={filterModuleId}
                  onChange={(e) => setFilterModuleId(e.target.value)}
                  className="px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700"
                >
                  <option value="">Semua Modul Pembelajaran</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Table Data */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">No</th>
                      <th className="py-3 px-3">Siswa</th>
                      <th className="py-3 px-3">Kelas</th>
                      <th className="py-3 px-3">Modul</th>
                      <th className="py-3 px-3 text-center">Nilai Terbaru</th>
                      <th className="py-3 px-3 text-center">Nilai Tertinggi</th>
                      <th className="py-3 px-3 text-center">Benar/Total</th>
                      <th className="py-3 px-3 text-right">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProgress.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          Belum ada data nilai kuis modul siswa.
                        </td>
                      </tr>
                    ) : (
                      filteredProgress.map((p, idx) => (
                        <tr key={`${p.studentNisn}-${p.moduleId}`} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-black text-slate-900 block truncate">{p.studentName}</span>
                            <span className="text-[10px] text-slate-500">NISN: {p.studentNisn}</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{p.studentClass || '-'}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{p.moduleTitle}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-lg font-black text-xs ${
                              (p.quizScore ?? 0) >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {p.quizScore ?? '-'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                            {p.highestQuizScore ?? '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 font-semibold">
                            {p.quizCorrectCount ?? 0}/{p.quizTotalCount ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[10px] text-slate-500">
                            {p.lastQuizAttemptAt ? new Date(p.lastQuizAttemptAt).toLocaleDateString('id-ID') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* VIEW 2: PENGATURAN MODUL (MENGIKUTI TAMPILAN SISWA) */
          /* ======================================================== */
          <div className="space-y-4">
            {/* JIKA BELUM ADA MODUL SAMA SEKALI */}
            {modules.length === 0 ? (
              <div className="bg-white/95 backdrop-blur-md p-10 sm:p-14 rounded-3xl border border-white/20 text-center space-y-4 max-w-md mx-auto shadow-2xl text-slate-800">
                <BookOpen className="w-14 h-14 text-slate-300 mx-auto" />
                <h3 className="text-base sm:text-lg font-black text-slate-800">Belum Ada Modul</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Anda belum membuat modul pembelajaran. Silakan tekan tombol di bawah untuk membuat modul materi pertama Anda.
                </p>
                <button
                  type="button"
                  onClick={handleAddNewModule}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Modul Pertama</span>
                </button>
              </div>
            ) : activeModule && (
              <>
                {/* 1. PALING ATAS LANGSUNG TAB-TAB MATERI (GLASSMORPHISM & MINIMALIS, TIDAK KELUAR DARI HP) */}
                <div className="w-full max-w-full overflow-hidden bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl shadow-emerald-950/25 rounded-2xl p-1.5 sm:p-2 flex items-center justify-between gap-2">
                  {/* Left: Scrollable Minimal Page Tabs */}
                  <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none max-w-full py-1 px-1 scroll-smooth flex-1 min-w-0">
                    {(activeModule.pages || []).map((p, idx) => {
                      const isActive = activePageIndex === idx;

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setActivePageIndex(idx)}
                          title={`${p.title} (${p.type})`}
                          className={`flex items-center justify-center rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 border select-none ${
                            isActive
                              ? 'min-w-[56px] sm:min-w-[68px] h-10 px-3.5 bg-white text-emerald-950 border-white shadow-xl shadow-black/25 ring-2 ring-emerald-300 scale-105 space-x-1.5'
                              : 'w-10 h-10 bg-white/15 hover:bg-white/25 text-white border-white/20 hover:border-white/40 active:scale-95'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <span>{idx + 1}</span>
                              {p.type === 'game' && <Gamepad2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />}
                              {p.type === 'quiz' && <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                            </>
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </button>
                      );
                    })}

                    {/* Tombol Tambah Halaman (+) di Samping Tab */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setAddPageDropdownOpen(!addPageDropdownOpen)}
                        className="h-10 px-3 bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-100 border border-emerald-400/40 rounded-xl text-xs font-black flex items-center space-x-1.5 transition-all cursor-pointer shrink-0"
                        title="Tambah Halaman Baru ke Modul Ini"
                      >
                        <Plus className="w-4 h-4 text-emerald-200" />
                        <span className="hidden sm:inline">Halaman</span>
                      </button>

                      {/* Dropdown Menu Tambah Halaman */}
                      {addPageDropdownOpen && (
                        <div className="absolute left-0 mt-2 w-48 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-1.5 z-50 animate-scaleUp">
                          <button
                            type="button"
                            onClick={() => handleAddNewPage('materi')}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold hover:bg-emerald-50 rounded-xl text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer text-left"
                          >
                            <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>+ Halaman Materi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddNewPage('game')}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold hover:bg-purple-50 rounded-xl text-slate-700 hover:text-purple-800 transition-colors cursor-pointer text-left"
                          >
                            <Gamepad2 className="w-4 h-4 text-purple-600 shrink-0" />
                            <span>+ Halaman Game HTML</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddNewPage('quiz')}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold hover:bg-amber-50 rounded-xl text-slate-700 hover:text-amber-800 transition-colors cursor-pointer text-left"
                          >
                            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>+ Kuis Akhir</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: TOMBOL SIMPAN KE FIREBASE */}
                  <div className="shrink-0 flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={handleSaveToFirebase}
                      disabled={isSavingToFirebase || !hasUnsavedChanges}
                      className={`h-10 px-3.5 sm:px-4 rounded-xl text-xs font-black flex items-center space-x-2 shrink-0 transition-all cursor-pointer ${
                        hasUnsavedChanges
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xl shadow-amber-400/30 ring-2 ring-amber-300 animate-pulse active:scale-95'
                          : 'bg-white/10 text-white/60 border border-white/20 cursor-default'
                      }`}
                      title={hasUnsavedChanges ? 'Klik untuk menyimpan seluruh perubahan ke Firebase' : 'Semua perubahan sudah tersimpan di Firebase'}
                    >
                      {isSavingToFirebase ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin shrink-0" />
                          <span className="hidden sm:inline">Menyimpan...</span>
                        </>
                      ) : hasUnsavedChanges ? (
                        <>
                          <Save className="w-4 h-4 text-slate-950 shrink-0" />
                          <span>Simpan ke Firebase</span>
                          <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                          <span className="hidden sm:inline">Tersimpan</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. KONTEN HALAMAN YANG SEDANG AKTIF DIEDIT */}
                {activePage ? (
                  <div className="bg-white/95 text-slate-800 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl p-4 sm:p-7 space-y-6">
                    {/* Header Halaman */}
                    <div className="border-b border-slate-200 pb-3 flex items-center justify-between flex-wrap gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                          Halaman {activePageIndex + 1} dari {activeModule.pages.length}
                        </span>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <h3 className="text-lg sm:text-2xl font-black text-slate-900 truncate">
                            {activePage.title}
                          </h3>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center space-x-1 shrink-0 ${
                            activePage.type === 'game'
                              ? 'bg-purple-100 text-purple-800 border-purple-300'
                              : activePage.type === 'quiz'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}>
                            {activePage.type === 'game' && <Gamepad2 className="w-3 h-3" />}
                            {activePage.type === 'quiz' && <HelpCircle className="w-3 h-3" />}
                            {activePage.type === 'materi' && <FileText className="w-3 h-3" />}
                            <span className="uppercase">{activePage.type}</span>
                          </span>
                        </div>
                      </div>

                      {/* Tombol Aksi Halaman */}
                      <div className="flex items-center space-x-1.5 shrink-0">
                        {/* Geser Urutan */}
                        <button
                          type="button"
                          disabled={activePageIndex === 0 || activePage.type === 'quiz'}
                          onClick={() => handleMovePage(activePageIndex, 'up')}
                          className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-20 cursor-pointer"
                          title="Geser Halaman ke Kiri / Sebelumnya"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={activePageIndex === (activeModule.pages.length - 1) || activePage.type === 'quiz'}
                          onClick={() => handleMovePage(activePageIndex, 'down')}
                          className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-20 cursor-pointer"
                          title="Geser Halaman ke Kanan / Berikutnya"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Detail Halaman Modal */}
                        <button
                          type="button"
                          onClick={() => setEditingPage({ isNew: false, page: { ...activePage } })}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
                          title="Edit Pengaturan & Konten Halaman"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Halaman</span>
                        </button>

                        {/* Hapus Halaman */}
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'page',
                              id: activePage.id,
                              title: activePage.title,
                            })
                          }
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                          title="Hapus Halaman Ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* A. TAMPILAN MATERI */}
                    {activePage.type === 'materi' && (
                      <div className="space-y-6">
                        {/* Teks Materi Pembelajaran */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span>Isi Teks Pembelajaran:</span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              Klik "Edit Halaman" untuk mengubah secara mendalam
                            </span>
                          </label>
                          <div className="bg-emerald-50/40 p-4 sm:p-6 rounded-2xl border border-emerald-100 text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal">
                            {activePage.content || 'Materi pembelajaran belum diisi.'}
                          </div>
                        </div>

                        {/* Info Jeda Baca & Soal Penguncian */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                              <Clock className="w-4 h-4 text-emerald-600" />
                              <span>Waktu Jeda Baca Siswa</span>
                            </span>
                            <p className="text-sm font-black text-slate-900">
                              {activePage.readingDelaySeconds ?? 10} detik
                            </p>
                            <span className="text-[11px] text-slate-500 block">
                              Siswa harus menunggu timer membaca sebelum soal penguncian muncul.
                            </span>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                              <Lock className="w-4 h-4 text-amber-600" />
                              <span>Soal Penguncian Halaman</span>
                            </span>
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {activePage.lockQuestion?.question || 'Belum diatur'}
                            </p>
                            <span className="text-[11px] text-emerald-700 font-semibold block">
                              Kunci: {activePage.lockQuestion?.options[activePage.lockQuestion?.correctAnswerIndex ?? 0] || '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* B. TAMPILAN GAME EDUKASI */}
                    {activePage.type === 'game' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                            <Gamepad2 className="w-4 h-4 text-purple-600" />
                            <span>Game Edukasi (HTML Sandbox)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowGamePreview(!showGamePreview)}
                            className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center space-x-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{showGamePreview ? 'Sembunyikan Pratinjau' : 'Lihat Pratinjau Game'}</span>
                          </button>
                        </div>

                        {showGamePreview ? (
                          <div className="h-80 w-full rounded-2xl overflow-hidden border-2 border-purple-300 shadow-md bg-slate-900">
                            <iframe
                              srcDoc={activePage.gameHtml || '<div style="color:white;padding:20px;">Kosong</div>'}
                              title="Pratinjau Game"
                              sandbox="allow-scripts allow-same-origin allow-forms"
                              className="w-full h-full border-none"
                            />
                          </div>
                        ) : (
                          <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 text-xs text-purple-950 space-y-1.5">
                            <p className="font-bold">Kode HTML Game terpasang ({activePage.gameHtml?.length || 0} karakter).</p>
                            <p className="text-slate-600">Tekan tombol "Lihat Pratinjau Game" di atas untuk mencoba memainkan game secara langsung.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* C. TAMPILAN KUIS AKHIR */}
                    {activePage.type === 'quiz' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-black text-slate-900 flex items-center space-x-1.5">
                              <HelpCircle className="w-4 h-4 text-amber-600" />
                              <span>Daftar Soal Kuis Akhir ({activePage.quizQuestions?.length || 0} Soal)</span>
                            </h4>
                            <span className="text-[11px] text-slate-500">
                              {activePage.randomizeQuestions ? 'Soal dan opsi diacak untuk setiap siswa' : 'Urutan soal tetap'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingPage({ isNew: false, page: { ...activePage } })}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Kelola Soal Kuis</span>
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {(activePage.quizQuestions || []).map((q, qIdx) => (
                            <div key={q.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                              <div className="flex items-center justify-between font-black text-slate-900">
                                <span>{qIdx + 1}. {q.question}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                                {q.options.map((opt, optIdx) => (
                                  <div
                                    key={optIdx}
                                    className={`p-2 rounded-xl border ${
                                      optIdx === q.correctAnswerIndex
                                        ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-black'
                                        : 'bg-white border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    <span className="font-bold mr-1">{String.fromCharCode(65 + optIdx)}.</span>
                                    <span>{opt}</span>
                                    {optIdx === q.correctAnswerIndex && ' ✓ (Benar)'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/95 rounded-3xl p-8 text-center text-slate-500">
                    Modul ini belum memiliki halaman materi. Silakan klik tombol "+ Halaman" di atas.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. SIDEBAR DAFTAR MODUL GURU (SLIDE DARI KIRI) - MODERN TOSKA */}
      {/* ======================================================== */}
      {isSidebarOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
              style={{ position: 'fixed', inset: 0 }}
              onClick={() => setIsSidebarOpen(false)}
            />

            {/* Drawer Container - MODERN TOSKA */}
            <div className="relative w-84 sm:w-96 max-w-[88vw] bg-gradient-to-b from-[#0b3838] via-[#082e2f] to-[#041a1b] text-teal-50 h-full shadow-2xl p-4 flex flex-col z-50 animate-slideRight border-r border-teal-500/30">
              {/* Header Sidebar: Logo Aplikasi Kecil Saja */}
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
                      Pengaturan Modul Admin
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-teal-300 hover:text-white hover:bg-teal-800/50 cursor-pointer transition-colors shrink-0"
                  title="Tutup Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Menu Navigasi Admin */}
              <div className="space-y-1.5 py-3 border-b border-teal-500/20">
                <span className="text-[10px] uppercase font-black text-teal-400 tracking-wider px-1">
                  Menu Utama
                </span>

                {onBackToAdminPortal && (
                  <button
                    type="button"
                    onClick={() => {
                      onBackToAdminPortal();
                      setIsSidebarOpen(false);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-teal-100 hover:text-white hover:bg-teal-800/50 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 text-teal-300 shrink-0" />
                    <span>Kembali ke Menu Admin (Siswa/Nilai)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSubTab('modules');
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    subTab === 'modules'
                      ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                      : 'text-teal-100 hover:text-white hover:bg-teal-800/50'
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>Pengaturan Modul & Halaman</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubTab('scores');
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    subTab === 'scores'
                      ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                      : 'text-teal-100 hover:text-white hover:bg-teal-800/50'
                  }`}
                >
                  <Award className="w-4 h-4 shrink-0" />
                  <span>Rekap Nilai Kuis Siswa</span>
                </button>

                {/* Tombol Simpan ke Firebase di Sidebar */}
                <button
                  type="button"
                  onClick={handleSaveToFirebase}
                  disabled={isSavingToFirebase || !hasUnsavedChanges}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    hasUnsavedChanges
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-400/30 ring-2 ring-amber-300 animate-pulse'
                      : 'bg-teal-950/60 text-teal-300/60 border border-teal-500/20 cursor-default'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Save className="w-4 h-4" />
                    <span>{hasUnsavedChanges ? 'Simpan ke Firebase' : 'Tersimpan di Firebase'}</span>
                  </div>
                  {hasUnsavedChanges && (
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  )}
                </button>
              </div>

              {/* Daftar Modul Belajar */}
              <div className="flex items-center justify-between pt-3 pb-1.5 px-1">
                <span className="text-[10px] uppercase font-black text-teal-400 tracking-wider">
                  Daftar Modul Belajar ({modules.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddNewModule}
                  className="px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 text-[10px] font-black rounded-lg shadow-xs transition-all cursor-pointer flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah</span>
                </button>
              </div>

              {/* Modul List in Sidebar */}
              <div className="flex-1 overflow-y-auto py-2 space-y-2">
                {modules.length === 0 ? (
                  <div className="text-center py-8 text-xs text-teal-300/60">
                    Belum ada modul.
                  </div>
                ) : (
                  modules.map((mod, idx) => {
                    const isSelected = activeModule?.id === mod.id && subTab === 'modules';
                    return (
                      <div
                        key={mod.id}
                        className={`p-3 rounded-2xl border transition-all flex flex-col space-y-2 ${
                          isSelected
                            ? 'bg-teal-700/80 border-teal-300 text-white shadow-lg shadow-teal-950/40 ring-1 ring-teal-300'
                            : 'bg-teal-950/50 hover:bg-teal-900/60 border-teal-500/25 text-teal-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div
                            className="flex items-center space-x-2 min-w-0 flex-1 cursor-pointer"
                            onClick={() => {
                              setActiveModuleId(mod.id);
                              setActivePageIndex(0);
                              setSubTab('modules');
                              setIsSidebarOpen(false);
                            }}
                          >
                            <div className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-white text-emerald-950 font-black' : 'bg-teal-900/80 text-teal-200'
                            }`}>
                              {idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <input
                                type="text"
                                value={mod.title}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const updated = { ...mod, title: e.target.value };
                                  handleUpdateActiveModule(updated);
                                }}
                                className="font-bold text-xs bg-transparent border-b border-transparent hover:border-teal-400 focus:border-teal-300 focus:outline-none w-full text-white truncate"
                                title="Klik untuk mengubah judul modul"
                              />
                              <span className="text-[10px] text-teal-300/80 block">
                                {mod.pages?.length || 0} Halaman Materi
                              </span>
                            </div>
                          </div>

                          {/* Status Kunci Password */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = { ...mod, isLockedWithPassword: !mod.isLockedWithPassword };
                              handleUpdateActiveModule(updated);
                            }}
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center space-x-1 shrink-0 cursor-pointer ${
                              mod.isLockedWithPassword
                                ? 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                                : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                            }`}
                            title="Klik untuk kunci / buka password"
                          >
                            {mod.isLockedWithPassword ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            <span>{mod.isLockedWithPassword ? 'Terkunci' : 'Terbuka'}</span>
                          </button>
                        </div>

                        {/* Input Password Jika Terkunci */}
                        {mod.isLockedWithPassword && (
                          <div className="pt-1">
                            <input
                              type="text"
                              value={mod.password || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const updated = { ...mod, password: e.target.value };
                                handleUpdateActiveModule(updated);
                              }}
                              placeholder="Password modul..."
                              className="w-full px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg bg-teal-950 border border-teal-500/40 text-teal-100 focus:outline-none focus:ring-1 focus:ring-teal-300"
                            />
                          </div>
                        )}

                        {/* Actions Modul */}
                        <div className="pt-2 border-t border-teal-500/20 flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveModule(idx, 'up');
                              }}
                              className="p-1 hover:bg-teal-800/50 text-teal-300 disabled:opacity-20 rounded-lg cursor-pointer"
                              title="Geser Naik"
                            >
                              <MoveUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === modules.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveModule(idx, 'down');
                              }}
                              className="p-1 hover:bg-teal-800/50 text-teal-300 disabled:opacity-20 rounded-lg cursor-pointer"
                              title="Geser Turun"
                            >
                              <MoveDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({
                                  type: 'module',
                                  id: mod.id,
                                  title: mod.title,
                                });
                              }}
                              className="p-1 hover:bg-rose-950/50 text-rose-300 rounded-lg cursor-pointer"
                              title="Hapus Modul"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveModuleId(mod.id);
                              setActivePageIndex(0);
                              setSubTab('modules');
                              setIsSidebarOpen(false);
                            }}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white text-emerald-950 font-black'
                                : 'bg-teal-900/80 text-teal-200 hover:bg-teal-800'
                            }`}
                          >
                            {isSelected ? 'Aktif' : 'Buka'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* 4. MODAL KONFIRMASI HAPUS */}
      {/* ======================================================== */}
      {deleteConfirm && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
            style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
          >
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              style={{ position: 'fixed', inset: 0 }}
              onClick={() => setDeleteConfirm(null)}
            />

            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative z-10 space-y-4 animate-scaleUp text-slate-800">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="font-black text-base text-slate-900">
                  Konfirmasi Hapus {deleteConfirm.type === 'module' ? 'Modul' : 'Halaman'}
                </h3>
                <p className="text-xs text-slate-600">
                  Apakah Anda yakin ingin menghapus <strong>"{deleteConfirm.title}"</strong>?
                  Perubahan akan permanen setelah Anda klik <em>Simpan ke Firebase</em>.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deleteConfirm.type === 'module') {
                      handleDeleteModule(deleteConfirm.id, deleteConfirm.title);
                    } else if (deleteConfirm.type === 'page') {
                      handleDeletePage(deleteConfirm.id);
                    }
                  }}
                  className="flex-1 py-2.5 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  Hapus Sekarang
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* 5. MODAL EDITOR HALAMAN LENGKAP */}
      {/* ======================================================== */}
      {editingPage && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
          >
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              style={{ position: 'fixed', inset: 0 }}
              onClick={() => setEditingPage(null)}
            />

            <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 relative z-10 space-y-4 max-h-[92vh] overflow-y-auto text-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    {editingPage.isNew ? 'Tambah Halaman Baru' : 'Edit Pengaturan Halaman'}
                  </span>
                  <h3 className="font-black text-base text-slate-900">
                    {editingPage.page.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPage(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Input Dasar */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Judul Halaman
                  </label>
                  <input
                    type="text"
                    value={editingPage.page.title}
                    onChange={(e) =>
                      setEditingPage({
                        ...editingPage,
                        page: { ...editingPage.page, title: e.target.value },
                      })
                    }
                    placeholder="Contoh: Pengantar Daur Ulang Plastik"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* A. FORM MATERI */}
                {editingPage.page.type === 'materi' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Isi Materi Pembelajaran (Teks Bebas)
                      </label>
                      <textarea
                        rows={7}
                        value={editingPage.page.content || ''}
                        onChange={(e) =>
                          setEditingPage({
                            ...editingPage,
                            page: { ...editingPage.page, content: e.target.value },
                          })
                        }
                        placeholder="Tuliskan materi pembelajaran kreasi daur ulang..."
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                      />
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                          <Clock className="w-4 h-4 text-emerald-600" />
                          <span>Waktu Jeda Baca Siswa (Detik)</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={editingPage.page.readingDelaySeconds ?? 10}
                          onChange={(e) =>
                            setEditingPage({
                              ...editingPage,
                              page: {
                                ...editingPage.page,
                                readingDelaySeconds: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-20 px-2 py-1 text-center font-bold text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Siswa harus menunggu timer membaca sebelum soal penguncian pemahaman muncul.
                      </p>
                    </div>

                    {/* Soal Penguncian Materi */}
                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-3">
                      <div className="flex items-center space-x-2 text-emerald-800 font-black text-xs">
                        <Lock className="w-4 h-4" />
                        <span>Pertanyaan Penguncian Pemahaman Materi</span>
                      </div>

                      <input
                        type="text"
                        value={editingPage.page.lockQuestion?.question || ''}
                        onChange={(e) => {
                          const currentLock = editingPage.page.lockQuestion || {
                            id: `q-${Date.now()}`,
                            question: '',
                            options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
                            correctAnswerIndex: 0,
                          };
                          setEditingPage({
                            ...editingPage,
                            page: {
                              ...editingPage.page,
                              lockQuestion: { ...currentLock, question: e.target.value },
                            },
                          });
                        }}
                        placeholder="Pertanyaan pemahaman materi..."
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white"
                      />

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Pilihan Jawaban (Pilih Lingkaran untuk Kunci Jawaban Benar):
                        </label>
                        {(editingPage.page.lockQuestion?.options || ['A', 'B', 'C', 'D']).map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="lockCorrectAnswer"
                              checked={(editingPage.page.lockQuestion?.correctAnswerIndex ?? 0) === optIdx}
                              onChange={() => {
                                const currentLock = editingPage.page.lockQuestion || {
                                  id: `q-${Date.now()}`,
                                  question: '',
                                  options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
                                  correctAnswerIndex: 0,
                                };
                                setEditingPage({
                                  ...editingPage,
                                  page: {
                                    ...editingPage.page,
                                    lockQuestion: { ...currentLock, correctAnswerIndex: optIdx },
                                  },
                                });
                              }}
                              className="w-4 h-4 text-emerald-600 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const currentLock = editingPage.page.lockQuestion || {
                                  id: `q-${Date.now()}`,
                                  question: '',
                                  options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
                                  correctAnswerIndex: 0,
                                };
                                const updatedOpts = [...currentLock.options];
                                updatedOpts[optIdx] = e.target.value;
                                setEditingPage({
                                  ...editingPage,
                                  page: {
                                    ...editingPage.page,
                                    lockQuestion: { ...currentLock, options: updatedOpts },
                                  },
                                });
                              }}
                              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* B. FORM GAME EDUKASI */}
                {editingPage.page.type === 'game' && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 block">
                          Kode HTML / Game Interaktif
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowGamePreview(!showGamePreview)}
                          className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center space-x-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{showGamePreview ? 'Sembunyikan Pratinjau' : 'Lihat Pratinjau Game'}</span>
                        </button>
                      </div>
                      <textarea
                        rows={8}
                        value={editingPage.page.gameHtml || ''}
                        onChange={(e) =>
                          setEditingPage({
                            ...editingPage,
                            page: { ...editingPage.page, gameHtml: e.target.value },
                          })
                        }
                        placeholder="<style>...</style><canvas id='game'></canvas><script>...</script>"
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-slate-900 text-teal-300 focus:outline-none"
                      />
                    </div>

                    {showGamePreview && (
                      <div className="p-2 bg-slate-900 rounded-2xl border border-slate-700">
                        <div className="h-64 w-full rounded-xl overflow-hidden bg-slate-950">
                          <iframe
                            srcDoc={editingPage.page.gameHtml || '<div style="color:white;padding:20px;">Kosong</div>'}
                            title="Preview Game"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                            className="w-full h-full border-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* C. FORM KUIS AKHIR */}
                {editingPage.page.type === 'quiz' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={editingPage.page.randomizeQuestions ?? true}
                          onChange={(e) =>
                            setEditingPage({
                              ...editingPage,
                              page: { ...editingPage.page, randomizeQuestions: e.target.checked },
                            })
                          }
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <span>Acak Urutan Soal & Pilihan Jawaban Saat Siswa Mengerjakan</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          const currentQs = editingPage.page.quizQuestions || [];
                          const newQ: QuizQuestion = {
                            id: `q-quiz-${Date.now()}`,
                            question: `Soal nomor ${currentQs.length + 1}...`,
                            options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
                            correctAnswerIndex: 0,
                          };
                          setEditingPage({
                            ...editingPage,
                            page: { ...editingPage.page, quizQuestions: [...currentQs, newQ] },
                          });
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Soal</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(editingPage.page.quizQuestions || []).map((qItem, qIdx) => (
                        <div
                          key={qItem.id}
                          className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-700">
                              Soal #{qIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const filtered = (editingPage.page.quizQuestions || []).filter(
                                  (_, idx) => idx !== qIdx
                                );
                                setEditingPage({
                                  ...editingPage,
                                  page: { ...editingPage.page, quizQuestions: filtered },
                                });
                              }}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Hapus Soal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <input
                            type="text"
                            value={qItem.question}
                            onChange={(e) => {
                              const updatedList = [...(editingPage.page.quizQuestions || [])];
                              updatedList[qIdx] = { ...qItem, question: e.target.value };
                              setEditingPage({
                                ...editingPage,
                                page: { ...editingPage.page, quizQuestions: updatedList },
                              });
                            }}
                            placeholder="Pertanyaan soal kuis..."
                            className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white"
                          />

                          <div className="space-y-2">
                            {qItem.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`correct-${qItem.id}`}
                                  checked={qItem.correctAnswerIndex === optIdx}
                                  onChange={() => {
                                    const updatedList = [...(editingPage.page.quizQuestions || [])];
                                    updatedList[qIdx] = { ...qItem, correctAnswerIndex: optIdx };
                                    setEditingPage({
                                      ...editingPage,
                                      page: { ...editingPage.page, quizQuestions: updatedList },
                                    });
                                  }}
                                  className="w-4 h-4 text-amber-600 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const updatedList = [...(editingPage.page.quizQuestions || [])];
                                    const updatedOpts = [...qItem.options];
                                    updatedOpts[optIdx] = e.target.value;
                                    updatedList[qIdx] = { ...qItem, options: updatedOpts };
                                    setEditingPage({
                                      ...editingPage,
                                      page: { ...editingPage.page, quizQuestions: updatedList },
                                    });
                                  }}
                                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Modal */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingPage(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePageModal}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Halaman</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
