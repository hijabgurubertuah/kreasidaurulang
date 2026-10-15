import React, { useState, useEffect, useMemo } from 'react';
import {
  LearningModule,
  ModulePage,
  QuizQuestion,
  StudentModuleProgress,
  Student,
} from '../types';
import {
  listenToModules,
  saveModuleInDb,
  deleteModuleInDb,
  reorderModulesInDb,
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
  Menu,
} from 'lucide-react';

interface ModuleManagementProps {
  students?: Student[];
}

export const ModuleManagement: React.FC<ModuleManagementProps> = ({ students = [] }) => {
  const [subTab, setSubTab] = useState<'modules' | 'scores'>('modules');
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [allProgress, setAllProgress] = useState<StudentModuleProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Active Editing Module
  const [activeModule, setActiveModule] = useState<LearningModule | null>(null);

  // Delete Confirm Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'module' | 'page' | 'quizQuestion';
    id: string;
    title: string;
    pageId?: string;
  } | null>(null);

  // Page Editor Modal
  const [editingPage, setEditingPage] = useState<{
    isNew: boolean;
    page: ModulePage;
  } | null>(null);

  // Game Preview in Editor Modal
  const [showGamePreview, setShowGamePreview] = useState(false);

  // Recap Filter & Search
  const [filterModuleId, setFilterModuleId] = useState<string>('');
  const [searchRecap, setSearchRecap] = useState<string>('');

  // Save Module Toast/Alert
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real-time subscribe to modules
  useEffect(() => {
    setIsLoading(true);
    const unsub = listenToModules(
      (list) => {
        setModules(list);
        setIsLoading(false);
        // If an active module is currently selected, keep it synced, otherwise default to first module
        setActiveModule((prev) => {
          if (prev) {
            return list.find((m) => m.id === prev.id) || list[0] || null;
          }
          return list[0] || null;
        });
      },
      (err) => {
        setIsLoading(false);
        setErrorMsg('Gagal memuat modul dari database.');
      }
    );
    return () => unsub();
  }, [activeModule?.id]);

  // Real-time subscribe to student progress recap
  useEffect(() => {
    const unsub = listenToAllModuleProgress((progList) => {
      setAllProgress(progList);
    });
    return () => unsub();
  }, []);

  // Quick auto-dismiss alerts
  useEffect(() => {
    if (saveSuccessMsg) {
      const timer = setTimeout(() => setSaveSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessMsg]);

  // --- 1. MODUL CRUD ---
  const handleAddNewModule = async () => {
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

    await saveModuleInDb(newModule);
    setActiveModule(newModule);
    setSaveSuccessMsg(`Modul baru berhasil ditambahkan!`);
  };

  const handleUpdateActiveModule = async (updated: LearningModule) => {
    setActiveModule(updated);
    await saveModuleInDb(updated);
    setSaveSuccessMsg('Perubahan modul tersimpan!');
  };

  const handleDeleteModule = async (moduleId: string, moduleTitle: string) => {
    await deleteModuleInDb(moduleId, moduleTitle);
    if (activeModule?.id === moduleId) {
      setActiveModule(null);
    }
    setDeleteConfirm(null);
    setSaveSuccessMsg(`Modul "${moduleTitle}" berhasil dihapus.`);
  };

  const handleMoveModule = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const list = [...modules];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    setModules(list);
    await reorderModulesInDb(list);
  };

  // --- 2. HALAMAN CRUD DALAM MODUL ---
  const handleAddNewPage = (type: 'materi' | 'game' | 'quiz') => {
    if (!activeModule) return;

    const pageCount = (activeModule.pages || []).length;
    const newPage: ModulePage = {
      id: `page-${Date.now()}`,
      title: type === 'materi' ? `Halaman ${pageCount}` : type === 'game' ? 'Game Edukasi' : 'Kuis Akhir',
      type,
      order: pageCount + 1,
      readingDelaySeconds: 10,
      lockQuestion:
        type === 'materi'
          ? {
              id: `q-${Date.now()}`,
              question: 'Pertanyaan penguncian materi...',
              options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
              correctAnswerIndex: 0,
            }
          : undefined,
      gameHtml:
        type === 'game'
          ? '<div style="display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif;background:#f0fdf4;color:#166534;font-size:18px;font-weight:bold;">🎮 Tempelkan kode HTML game Anda di sini</div>'
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

  const handleSavePageModal = async () => {
    if (!activeModule || !editingPage) return;

    let updatedPages = [...(activeModule.pages || [])];

    if (editingPage.isNew) {
      // Pastikan urutan: jika ada halaman Kuis Akhir, letakkan kuis akhir tetap paling bawah!
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

    // Re-index order
    updatedPages.forEach((p, idx) => {
      p.order = idx + 1;
    });

    const updatedModule: LearningModule = {
      ...activeModule,
      pages: updatedPages,
      updatedAt: new Date().toISOString(),
    };

    await handleUpdateActiveModule(updatedModule);
    setEditingPage(null);
  };

  const handleDeletePage = async (pageId: string) => {
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

    await handleUpdateActiveModule(updatedModule);
    setDeleteConfirm(null);
    setSaveSuccessMsg('Halaman berhasil dihapus.');
  };

  const handleMovePage = async (index: number, direction: 'up' | 'down') => {
    if (!activeModule) return;
    const pages = [...activeModule.pages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= pages.length) return;

    // Aturan: Halaman Kuis Akhir harus selalu paling bawah dan tidak boleh dipindah ke tengah!
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

    await handleUpdateActiveModule(updatedModule);
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

    // Sort by latest attempt
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
      `'${p.studentNisn}`, // Prevent Excel from stripping leading zeroes
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
    <div className="space-y-4 animate-fadeIn relative">
      {/* TOMBOL PEMICU SIDEBAR MODUL ADMIN DI KIRI TENGAH: 120 TINGGI, 30 LEBAR */}
      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        title="Buka Daftar Modul"
        aria-label="Buka Daftar Modul"
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 w-[30px] h-[120px] bg-gradient-to-b from-teal-700 via-emerald-700 to-slate-800 hover:from-teal-600 hover:to-emerald-600 text-white rounded-r-2xl shadow-xl shadow-slate-950/30 flex flex-col items-center justify-between py-2.5 cursor-pointer border-r border-y border-teal-400/40 active:scale-95 transition-all group"
      >
        <BookOpen className="w-4 h-4 text-teal-200 group-hover:scale-110 transition-transform shrink-0" />
        <div className="flex flex-col items-center justify-center text-[10px] font-black tracking-tighter leading-[1.1] text-teal-100 select-none">
          <span>M</span>
          <span>O</span>
          <span>D</span>
          <span>U</span>
          <span>L</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-teal-300 animate-pulse shrink-0" />
      </button>

      {/* Toast Notification */}
      {saveSuccessMsg && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center space-x-2 animate-fadeIn text-xs sm:text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* SUB-HEADER TABS */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Tombol Buka Sidebar Modul */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-black rounded-xl border border-emerald-300 flex items-center space-x-1.5 cursor-pointer transition-all"
            title="Buka Daftar Modul di Sidebar"
          >
            <BookOpen className="w-4 h-4 text-emerald-700" />
            <span>Daftar Modul ({modules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('modules')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              subTab === 'modules'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Editor Modul {activeModule ? `(${activeModule.title})` : ''}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('scores')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              subTab === 'scores'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Rekap Nilai Kuis Siswa ({allProgress.length})
          </button>
        </div>

        {subTab === 'modules' && (
          <button
            type="button"
            onClick={handleAddNewModule}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Modul Baru</span>
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: KELOLA MODUL (EDITOR MODUL LANGSUNG DI HALAMAN) */}
      {/* ======================================================== */}
      {subTab === 'modules' && (
        <div className="space-y-4">
          {/* JIKA BELUM ADA MODUL SAMA SEKALI */}
          {modules.length === 0 ? (
            <div className="bg-white p-10 sm:p-14 rounded-3xl border border-slate-200 text-center space-y-4 max-w-md mx-auto shadow-xs">
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
            /* DETAIL EDITOR MODUL YANG AKTIF (LANGSUNG LEBAR PENUH & NYAMAN) */
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                    Editor Modul Pembelajaran Aktif
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    Pengaturan: {activeModule.title}
                  </h3>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl cursor-pointer flex items-center space-x-1.5"
                    title="Buka sidebar untuk ganti atau pilih modul lain"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Pindah Modul (Sidebar)</span>
                  </button>
                </div>
              </div>

              {/* 1. Pengaturan Dasar Modul & Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Judul Modul
                  </label>
                  <input
                    type="text"
                    value={activeModule.title}
                    onChange={(e) =>
                      setActiveModule({ ...activeModule, title: e.target.value })
                    }
                    onBlur={() => handleUpdateActiveModule(activeModule)}
                    placeholder="Contoh: Modul 1 - Pengenalan Daur Ulang"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>Kunci Modul dengan Password</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={activeModule.isLockedWithPassword || false}
                      onChange={(e) => {
                        const updated = {
                          ...activeModule,
                          isLockedWithPassword: e.target.checked,
                        };
                        handleUpdateActiveModule(updated);
                      }}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>

                  {activeModule.isLockedWithPassword && (
                    <div className="pt-1">
                      <input
                        type="text"
                        value={activeModule.password || ''}
                        onChange={(e) =>
                          setActiveModule({ ...activeModule, password: e.target.value })
                        }
                        onBlur={() => handleUpdateActiveModule(activeModule)}
                        placeholder="Ketik password untuk membuka modul ini..."
                        className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold rounded-xl border border-amber-300 bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-[10px] text-slate-500 italic mt-0.5 block">
                        Password hanya terlihat oleh guru. Siswa wajib memasukkan password ini untuk membuka modul.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. DAFTAR HALAMAN DALAM MODUL */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>Daftar Halaman ({activeModule.pages?.length || 0})</span>
                  </h4>

                  {/* Tambah Halaman Buttons */}
                  <div className="flex items-center flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddNewPage('materi')}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Halaman Materi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddNewPage('game')}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Halaman Game</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddNewPage('quiz')}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Kuis Akhir</span>
                    </button>
                  </div>
                </div>

                {/* Halaman List Items */}
                <div className="space-y-2">
                  {(activeModule.pages || []).map((page, pIdx) => {
                    let TypeBadge = {
                      label: 'Materi',
                      color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                      icon: FileText,
                    };
                    if (page.type === 'game') {
                      TypeBadge = {
                        label: 'Game',
                        color: 'bg-purple-100 text-purple-800 border-purple-300',
                        icon: Gamepad2,
                      };
                    } else if (page.type === 'quiz') {
                      TypeBadge = {
                        label: 'Kuis Akhir',
                        color: 'bg-amber-100 text-amber-900 border-amber-300',
                        icon: HelpCircle,
                      };
                    }

                    const BadgeIcon = TypeBadge.icon;

                    return (
                      <div
                        key={page.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between gap-2 transition-all"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {pIdx + 1}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                {page.title}
                              </h5>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center space-x-1 shrink-0 ${TypeBadge.color}`}>
                                <BadgeIcon className="w-2.5 h-2.5" />
                                <span>{TypeBadge.label}</span>
                              </span>
                            </div>

                            <span className="text-[11px] text-slate-500 block truncate">
                              {page.type === 'materi' && `Hitung mundur: ${page.readingDelaySeconds ?? 10}d • Ada 1 Soal Penguncian`}
                              {page.type === 'game' && 'Game Refresing (Tanpa Penguncian)'}
                              {page.type === 'quiz' && `${page.quizQuestions?.length || 0} Soal Pilihan Ganda`}
                            </span>
                          </div>
                        </div>

                        {/* Actions Halaman */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            disabled={pIdx === 0 || page.type === 'quiz'}
                            onClick={() => handleMovePage(pIdx, 'up')}
                            className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                            title="Naik"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={pIdx === (activeModule.pages?.length || 1) - 1 || page.type === 'quiz'}
                            onClick={() => handleMovePage(pIdx, 'down')}
                            className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                            title="Turun"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingPage({ isNew: false, page: { ...page } })}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                            title="Edit Konten Halaman"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                type: 'page',
                                id: page.id,
                                title: page.title,
                              })
                            }
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                            title="Hapus Halaman"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: REKAP NILAI SISWA (TABEL, SEARCH, CSV) */}
      {/* ======================================================== */}
      {subTab === 'scores' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Rekap Nilai Kuis Modul Siswa
              </h3>
              <p className="text-xs text-slate-500">
                Nilai otomatis tersimpan saat siswa menyelesaikan kuis akhir setiap modul.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportRecapCsv}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Rekap CSV</span>
            </button>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchRecap}
                onChange={(e) => setSearchRecap(e.target.value)}
                placeholder="Cari NISN atau Nama Siswa..."
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={filterModuleId}
              onChange={(e) => setFilterModuleId(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Modul</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Tabel Rekap Nilai */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">No</th>
                  <th className="p-3">NISN</th>
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">Kelas</th>
                  <th className="p-3">Modul</th>
                  <th className="p-3 text-center">Nilai Terbaru</th>
                  <th className="p-3 text-center">Nilai Tertinggi</th>
                  <th className="p-3 text-center">Benar / Total</th>
                  <th className="p-3">Waktu Pengerjaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProgress.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Belum ada catatan nilai modul yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredProgress.map((prog, idx) => (
                    <tr key={prog.id} className="hover:bg-slate-50/80">
                      <td className="p-3 text-slate-500 font-bold">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{prog.studentNisn}</td>
                      <td className="p-3 font-bold text-slate-900">{prog.studentName}</td>
                      <td className="p-3 text-slate-600">{prog.studentClass || '-'}</td>
                      <td className="p-3 font-semibold text-emerald-800">{prog.moduleTitle}</td>
                      <td className="p-3 text-center font-black text-slate-900">
                        {prog.quizScore ?? '-'}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-md">
                          {prog.highestQuizScore ?? '-'}
                        </span>
                      </td>
                      <td className="p-3 text-center text-slate-600">
                        {prog.quizCorrectCount ?? 0} / {prog.quizTotalCount ?? 0}
                      </td>
                      <td className="p-3 text-slate-500">
                        {prog.lastQuizAttemptAt ? new Date(prog.lastQuizAttemptAt).toLocaleString('id-ID') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MODAL EDITOR HALAMAN (MATERI / GAME / KUIS) */}
      {/* ======================================================== */}
      {editingPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setEditingPage(null)}
          />

          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 relative z-10 overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  {editingPage.isNew ? 'Tambah Halaman' : 'Edit Halaman'}
                </span>
                <h4 className="text-base font-black text-slate-900">
                  Tipe: {editingPage.page.type.toUpperCase()}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingPage(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Judul Tab Halaman
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
                  placeholder="Contoh: Halaman 1 / Pengenalan Sampah"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* A. FORM MATERI */}
              {editingPage.page.type === 'materi' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Isi Teks Materi Pembelajaran
                    </label>
                    <textarea
                      rows={6}
                      value={editingPage.page.content || ''}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          page: { ...editingPage.page, content: e.target.value },
                        })
                      }
                      placeholder="Tuliskan teks materi di sini (mendukung paragraf dan daftar sederhana)..."
                      className="w-full px-3 py-2 text-xs sm:text-sm font-normal rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Waktu Hitung Mundur Membaca (Detik)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
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
                      className="w-32 px-3 py-2 text-xs sm:text-sm font-bold rounded-xl border border-slate-300 bg-white"
                    />
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Bawaan 10 detik. Soal di bawah baru muncul setelah hitung mundur selesai.
                    </span>
                  </div>

                  {/* 1 Soal Penguncian */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wide block">
                      1 Soal Penguncian Pilihan Ganda
                    </span>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Pertanyaan
                      </label>
                      <input
                        type="text"
                        value={editingPage.page.lockQuestion?.question || ''}
                        onChange={(e) => {
                          const lq = editingPage.page.lockQuestion || {
                            id: `q-${Date.now()}`,
                            question: '',
                            options: ['', '', '', ''],
                            correctAnswerIndex: 0,
                          };
                          setEditingPage({
                            ...editingPage,
                            page: {
                              ...editingPage.page,
                              lockQuestion: { ...lq, question: e.target.value },
                            },
                          });
                        }}
                        placeholder="Ketik pertanyaan terkait materi di atas..."
                        className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-600 block">
                        4 Pilihan Jawaban (Pilih radio untuk Kunci Jawaban Benar)
                      </label>
                      {[0, 1, 2, 3].map((optIdx) => {
                        const lq = editingPage.page.lockQuestion || {
                          id: `q-${Date.now()}`,
                          question: '',
                          options: ['', '', '', ''],
                          correctAnswerIndex: 0,
                        };
                        const isCorrect = lq.correctAnswerIndex === optIdx;

                        return (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="lockCorrect"
                              checked={isCorrect}
                              onChange={() => {
                                setEditingPage({
                                  ...editingPage,
                                  page: {
                                    ...editingPage.page,
                                    lockQuestion: { ...lq, correctAnswerIndex: optIdx },
                                  },
                                });
                              }}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              title="Tandai sebagai jawaban benar"
                            />
                            <span className="text-xs font-black text-slate-500 w-4">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <input
                              type="text"
                              value={lq.options?.[optIdx] || ''}
                              onChange={(e) => {
                                const newOpts = [...(lq.options || ['', '', '', ''])];
                                newOpts[optIdx] = e.target.value;
                                setEditingPage({
                                  ...editingPage,
                                  page: {
                                    ...editingPage.page,
                                    lockQuestion: { ...lq, options: newOpts },
                                  },
                                });
                              }}
                              placeholder={`Pilihan ${String.fromCharCode(65 + optIdx)}`}
                              className={`flex-1 px-3 py-1.5 text-xs rounded-xl border ${
                                isCorrect ? 'border-emerald-500 bg-emerald-50/50 font-bold' : 'border-slate-300 bg-white'
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* B. FORM GAME */}
              {editingPage.page.type === 'game' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Kode HTML Game (Embed Code)
                    </label>
                    <textarea
                      rows={8}
                      value={editingPage.page.gameHtml || ''}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          page: { ...editingPage.page, gameHtml: e.target.value },
                        })
                      }
                      placeholder="Tempelkan kode HTML game dari aplikasi lain di sini..."
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Hanya teks kode HTML yang disimpan ke Firestore. Game terisolasi dalam sandbox yang aman.
                    </span>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowGamePreview(!showGamePreview)}
                      className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>{showGamePreview ? 'Sembunyikan Pratinjau' : 'Pratinjau Tampilan Game'}</span>
                    </button>
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
                      <span>Acak Urutan Soal dan Pilihan Jawaban Saat Siswa Mengerjakan</span>
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

                  {/* List Soal Kuis Akhir */}
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
                          placeholder="Pertanyaan soal..."
                          className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white"
                        />

                        {/* Options */}
                        <div className="space-y-2">
                          {[0, 1, 2, 3].map((optIdx) => {
                            const isCorrect = qItem.correctAnswerIndex === optIdx;
                            return (
                              <div key={optIdx} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`quizCorrect_${qItem.id}`}
                                  checked={isCorrect}
                                  onChange={() => {
                                    const updatedList = [...(editingPage.page.quizQuestions || [])];
                                    updatedList[qIdx] = { ...qItem, correctAnswerIndex: optIdx };
                                    setEditingPage({
                                      ...editingPage,
                                      page: { ...editingPage.page, quizQuestions: updatedList },
                                    });
                                  }}
                                  className="w-4 h-4 text-emerald-600 cursor-pointer"
                                />
                                <span className="text-xs font-black text-slate-500 w-4">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <input
                                  type="text"
                                  value={qItem.options?.[optIdx] || ''}
                                  onChange={(e) => {
                                    const newOpts = [...(qItem.options || ['', '', '', ''])];
                                    newOpts[optIdx] = e.target.value;
                                    const updatedList = [...(editingPage.page.quizQuestions || [])];
                                    updatedList[qIdx] = { ...qItem, options: newOpts };
                                    setEditingPage({
                                      ...editingPage,
                                      page: { ...editingPage.page, quizQuestions: updatedList },
                                    });
                                  }}
                                  placeholder={`Pilihan ${String.fromCharCode(65 + optIdx)}`}
                                  className={`flex-1 px-3 py-1.5 text-xs rounded-xl border ${
                                    isCorrect ? 'border-emerald-500 bg-emerald-50/50 font-bold' : 'border-slate-300 bg-white'
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditingPage(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePageModal}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Halaman</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAL KONFIRMASI HAPUS */}
      {/* ======================================================== */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setDeleteConfirm(null)}
          />

          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative z-10 space-y-4 animate-scaleUp text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-black text-base text-slate-900">
                Konfirmasi Hapus
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin menghapus {deleteConfirm.type === 'module' ? 'modul' : 'halaman'}:{' '}
                <strong>"{deleteConfirm.title}"</strong>? Tindakan ini tidak dapat dibatalkan.
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
        </div>
      )}

      {/* SIDEBAR DAFTAR MODUL GURU (SLIDE DARI KIRI) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Drawer Container */}
          <div className="relative w-84 sm:w-96 max-w-[88vw] bg-white h-full shadow-2xl p-4 flex flex-col z-50 animate-slideRight">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-teal-700" />
                <div>
                  <h3 className="font-black text-sm text-slate-900 leading-tight">Daftar Modul Guru</h3>
                  <span className="text-[10px] text-slate-500 font-semibold block">{modules.length} Modul Tersedia</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                title="Tutup Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions in Sidebar */}
            <div className="py-2.5 space-y-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  handleAddNewModule();
                }}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Modul Baru</span>
              </button>

              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setSubTab('modules');
                    setIsSidebarOpen(false);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                    subTab === 'modules' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Editor Modul
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubTab('scores');
                    setIsSidebarOpen(false);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                    subTab === 'scores' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Rekap Nilai
                </button>
              </div>
            </div>

            {/* Modul List in Sidebar */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {modules.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
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
                          ? 'bg-emerald-50/80 border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div
                          className="flex items-center space-x-2 min-w-0 flex-1 cursor-pointer"
                          onClick={() => {
                            setActiveModule(mod);
                            setSubTab('modules');
                            setIsSidebarOpen(false);
                          }}
                        >
                          <div className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs text-slate-900 truncate">
                              {mod.title}
                            </h4>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {mod.pages?.length || 0} Halaman
                            </span>
                          </div>
                        </div>

                        {/* Status Kunci Password */}
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center space-x-1 shrink-0 ${
                          mod.isLockedWithPassword
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {mod.isLockedWithPassword ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                          <span>{mod.isLockedWithPassword ? 'Kunci' : 'Buka'}</span>
                        </span>
                      </div>

                      {/* Actions Modul */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveModule(idx, 'up');
                            }}
                            className="p-1 hover:bg-slate-100 text-slate-600 disabled:opacity-30 rounded-lg cursor-pointer"
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
                            className="p-1 hover:bg-slate-100 text-slate-600 disabled:opacity-30 rounded-lg cursor-pointer"
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
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                            title="Hapus Modul"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveModule(mod);
                            setSubTab('modules');
                            setIsSidebarOpen(false);
                          }}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                          }`}
                        >
                          {isSelected ? 'Sedang Diedit' : 'Edit Modul'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
