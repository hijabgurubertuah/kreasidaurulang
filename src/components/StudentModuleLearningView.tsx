import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LearningModule,
  ModulePage,
  Student,
  StudentModuleProgress,
  QuizQuestion,
} from '../types';
import {
  listenToModules,
  listenToStudentProgress,
  saveStudentProgressInDb,
} from '../services/firestoreService';
import { sanitizeHtml } from '../utils/sanitize';
import {
  BookOpen,
  Lock,
  Unlock,
  CheckCircle2,
  ChevronRight,
  Menu,
  X,
  Play,
  RotateCcw,
  Sparkles,
  Gamepad2,
  HelpCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  Award,
  Clock,
  KeyRound,
  Maximize2,
  Check,
  Calendar,
  LogOut,
} from 'lucide-react';

interface StudentModuleLearningViewProps {
  student: Student;
  currentTab?: 'modul' | 'sikap';
  onSwitchTab?: (tab: 'modul' | 'sikap') => void;
  onLogout?: () => void;
}

export const StudentModuleLearningView: React.FC<StudentModuleLearningViewProps> = ({
  student,
  currentTab = 'modul',
  onSwitchTab,
  onLogout,
}) => {
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [progressList, setProgressList] = useState<StudentModuleProgress[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Password Unlock Modal State
  const [passwordModalModule, setPasswordModalModule] = useState<LearningModule | null>(null);
  const [inputPassword, setInputPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Materi reading countdown and lock question state
  const [readingTimer, setReadingTimer] = useState<number>(10);
  const [canShowLockQuestion, setCanShowLockQuestion] = useState<boolean>(false);
  const [selectedLockAnswer, setSelectedLockAnswer] = useState<number | null>(null);
  const [lockQuestionError, setLockQuestionError] = useState<string | null>(null);
  const [lockQuestionSuccess, setLockQuestionSuccess] = useState<boolean>(false);

  // Kuis Akhir State
  const [currentQuizIndex, setCurrentQuizIndex] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [shuffledQuestions, setShuffledQuestions] = useState<QuizQuestion[]>([]);
  const [isQuizSubmitted, setIsQuizSubmitted] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<{
    score: number;
    correct: number;
    total: number;
  } | null>(null);

  // Game fullscreen mode
  const [isGameFullscreen, setIsGameFullscreen] = useState(false);

  // Real-time subscribe to modules
  useEffect(() => {
    setIsLoading(true);
    const unsubModules = listenToModules(
      (mods) => {
        setModules(mods);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );
    return () => unsubModules();
  }, []);

  // Real-time subscribe to student progress
  useEffect(() => {
    if (!student.nisn) return;
    const unsubProgress = listenToStudentProgress(student.nisn, (progs) => {
      setProgressList(progs);
    });
    return () => unsubProgress();
  }, [student.nisn]);

  // Find progress for current module
  const currentProgress = useMemo(() => {
    if (!selectedModuleId) return null;
    return progressList.find((p) => p.moduleId === selectedModuleId) || null;
  }, [selectedModuleId, progressList]);

  // Get active module
  const activeModule = useMemo(() => {
    return modules.find((m) => m.id === selectedModuleId) || null;
  }, [modules, selectedModuleId]);

  // Get active page
  const activePage = useMemo(() => {
    if (!activeModule || !activeModule.pages || activeModule.pages.length === 0) return null;
    return activeModule.pages[activePageIndex] || activeModule.pages[0];
  }, [activeModule, activePageIndex]);

  // Check if a module is unlocked for the student
  const isModuleUnlocked = (mod: LearningModule) => {
    if (!mod.isLockedWithPassword) return true;
    const prog = progressList.find((p) => p.moduleId === mod.id);
    return prog?.unlockedWithPassword === true;
  };

  // Get module status badge
  const getModuleStatus = (mod: LearningModule) => {
    const isUnlocked = isModuleUnlocked(mod);
    if (!isUnlocked) {
      return { label: 'Terkunci', color: 'bg-rose-100 text-rose-700 border-rose-300', icon: Lock };
    }
    const prog = progressList.find((p) => p.moduleId === mod.id);
    if (prog?.isCompleted) {
      const scoreText = prog.highestQuizScore !== undefined ? `Nilai: ${prog.highestQuizScore}` : 'Selesai';
      return { label: scoreText, color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 };
    }
    if (prog && prog.unlockedPageIds && prog.unlockedPageIds.length > 0) {
      return { label: 'Sedang Dikerjakan', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock };
    }
    return { label: 'Belum Dimulai', color: 'bg-slate-100 text-slate-600 border-slate-300', icon: BookOpen };
  };

  // Select module handler
  const handleSelectModule = (mod: LearningModule) => {
    if (mod.isLockedWithPassword && !isModuleUnlocked(mod)) {
      setPasswordModalModule(mod);
      setInputPassword('');
      setPasswordError('');
      return;
    }

    setSelectedModuleId(mod.id);
    setIsSidebarOpen(false); // Close sidebar on mobile
    setIsQuizSubmitted(false);
    setQuizResult(null);

    // Determine starting page based on student progress
    const prog = progressList.find((p) => p.moduleId === mod.id);
    if (prog && prog.lastActivePageId && mod.pages) {
      const foundIdx = mod.pages.findIndex((p) => p.id === prog.lastActivePageId);
      setActivePageIndex(foundIdx >= 0 ? foundIdx : 0);
    } else {
      setActivePageIndex(0);
    }
  };

  // Password verification
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalModule) return;

    if (inputPassword.trim() === (passwordModalModule.password || '').trim()) {
      // Save password unlock to Firestore
      const existingProg = progressList.find((p) => p.moduleId === passwordModalModule.id);
      const firstPageId = passwordModalModule.pages?.[0]?.id || '';
      const updatedProg: StudentModuleProgress = {
        id: `${student.nisn}_${passwordModalModule.id}`,
        studentNisn: student.nisn,
        studentName: student.name,
        studentClass: student.className,
        moduleId: passwordModalModule.id,
        moduleTitle: passwordModalModule.title,
        unlockedWithPassword: true,
        unlockedPageIds: existingProg?.unlockedPageIds || (firstPageId ? [firstPageId] : []),
        lastActivePageId: existingProg?.lastActivePageId || firstPageId,
        isCompleted: existingProg?.isCompleted || false,
        quizScore: existingProg?.quizScore,
        highestQuizScore: existingProg?.highestQuizScore,
      };

      await saveStudentProgressInDb(updatedProg);
      setSelectedModuleId(passwordModalModule.id);
      setActivePageIndex(0);
      setPasswordModalModule(null);
      setInputPassword('');
      setPasswordError('');
      setIsSidebarOpen(false);
    } else {
      setPasswordError('Password kurang tepat. Silakan tanyakan kepada bapak/ibu guru ya!');
    }
  };

  // Initialize page & timers whenever activePage changes
  useEffect(() => {
    if (!activePage || !activeModule) return;

    // Reset lock question state
    setSelectedLockAnswer(null);
    setLockQuestionError(null);
    setLockQuestionSuccess(false);

    // If page is materi: show lock question immediately
    if (activePage.type === 'materi') {
      setCanShowLockQuestion(true);
    }

    // If page is quiz: shuffle questions if requested
    if (activePage.type === 'quiz' && activePage.quizQuestions) {
      let qList = [...activePage.quizQuestions];
      if (activePage.randomizeQuestions) {
        qList = qList.sort(() => Math.random() - 0.5);
      }
      setShuffledQuestions(qList);
      setCurrentQuizIndex(0);
      setQuizAnswers({});
      setIsQuizSubmitted(false);
      setQuizResult(null);
    }

    // Record lastActivePageId
    if (currentProgress) {
      saveStudentProgressInDb({
        ...currentProgress,
        lastActivePageId: activePage.id,
      }).catch(() => {});
    }
  }, [activePage?.id]);

  // Reading countdown timer effect
  useEffect(() => {
    if (activePage?.type !== 'materi' || canShowLockQuestion || readingTimer <= 0) return;

    const timer = setInterval(() => {
      setReadingTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanShowLockQuestion(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activePage?.id, canShowLockQuestion, readingTimer]);

  // Verify lock question answer
  const handleCheckLockAnswer = async () => {
    if (!activePage || !activePage.lockQuestion || selectedLockAnswer === null || !activeModule) return;

    if (selectedLockAnswer === activePage.lockQuestion.correctAnswerIndex) {
      setLockQuestionSuccess(true);
      setLockQuestionError(null);

      // Save progress to Firestore: unlock next page
      const currentUnlocked = new Set(currentProgress?.unlockedPageIds || []);
      currentUnlocked.add(activePage.id);

      // Determine next page index
      const nextIdx = activePageIndex + 1;
      if (nextIdx < activeModule.pages.length) {
        currentUnlocked.add(activeModule.pages[nextIdx].id);
      }

      const nextProg: StudentModuleProgress = {
        id: `${student.nisn}_${activeModule.id}`,
        studentNisn: student.nisn,
        studentName: student.name,
        studentClass: student.className,
        moduleId: activeModule.id,
        moduleTitle: activeModule.title,
        unlockedWithPassword: true,
        unlockedPageIds: Array.from(currentUnlocked),
        lastActivePageId: nextIdx < activeModule.pages.length ? activeModule.pages[nextIdx].id : activePage.id,
        isCompleted: currentProgress?.isCompleted || false,
        quizScore: currentProgress?.quizScore,
        highestQuizScore: currentProgress?.highestQuizScore,
      };

      await saveStudentProgressInDb(nextProg);

      // Auto move to next page after 1.5 seconds delay with nice feedback
      setTimeout(() => {
        if (nextIdx < activeModule.pages.length) {
          setActivePageIndex(nextIdx);
        }
      }, 1200);
    } else {
      setLockQuestionError('Jawaban belum tepat. Silakan baca kembali materi di atas dan coba lagi ya!');
      setSelectedLockAnswer(null);
    }
  };

  // Next page for Game (no lock question)
  const handleNextFromGame = async () => {
    if (!activePage || !activeModule) return;
    const currentUnlocked = new Set(currentProgress?.unlockedPageIds || []);
    currentUnlocked.add(activePage.id);

    const nextIdx = activePageIndex + 1;
    if (nextIdx < activeModule.pages.length) {
      currentUnlocked.add(activeModule.pages[nextIdx].id);
    }

    const nextProg: StudentModuleProgress = {
      id: `${student.nisn}_${activeModule.id}`,
      studentNisn: student.nisn,
      studentName: student.name,
      studentClass: student.className,
      moduleId: activeModule.id,
      moduleTitle: activeModule.title,
      unlockedWithPassword: true,
      unlockedPageIds: Array.from(currentUnlocked),
      lastActivePageId: nextIdx < activeModule.pages.length ? activeModule.pages[nextIdx].id : activePage.id,
      isCompleted: currentProgress?.isCompleted || false,
      quizScore: currentProgress?.quizScore,
      highestQuizScore: currentProgress?.highestQuizScore,
    };

    await saveStudentProgressInDb(nextProg);
    if (nextIdx < activeModule.pages.length) {
      setActivePageIndex(nextIdx);
    }
  };

  // Submit Kuis Akhir
  const handleSubmitFinalQuiz = async () => {
    if (!activeModule || shuffledQuestions.length === 0) return;

    let correct = 0;
    shuffledQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctAnswerIndex) {
        correct += 1;
      }
    });

    const total = shuffledQuestions.length;
    const calculatedScore = Math.round((correct / total) * 100);

    const prevHighest = currentProgress?.highestQuizScore ?? 0;
    const newHighest = Math.max(prevHighest, calculatedScore);

    const currentUnlocked = new Set(currentProgress?.unlockedPageIds || []);
    if (activePage) currentUnlocked.add(activePage.id);

    const nextProg: StudentModuleProgress = {
      id: `${student.nisn}_${activeModule.id}`,
      studentNisn: student.nisn,
      studentName: student.name,
      studentClass: student.className,
      moduleId: activeModule.id,
      moduleTitle: activeModule.title,
      unlockedWithPassword: true,
      unlockedPageIds: Array.from(currentUnlocked),
      lastActivePageId: activePage?.id,
      isCompleted: true,
      quizScore: calculatedScore,
      highestQuizScore: newHighest,
      quizCorrectCount: correct,
      quizTotalCount: total,
      lastQuizAttemptAt: new Date().toISOString(),
    };

    await saveStudentProgressInDb(nextProg);
    setQuizResult({ score: calculatedScore, correct, total });
    setIsQuizSubmitted(true);
  };

  // Auto select active module if none selected
  useEffect(() => {
    if (modules.length > 0 && !selectedModuleId) {
      const inProg = progressList.find(
        (p) => !p.isCompleted && modules.some((m) => m.id === p.moduleId)
      );
      if (inProg) {
        setSelectedModuleId(inProg.moduleId);
      } else {
        setSelectedModuleId(modules[0].id);
      }
    }
  }, [modules, selectedModuleId, progressList]);

  // Check if a specific page tab is unlocked
  const isPageUnlocked = (page: ModulePage, pageIdx: number) => {
    if (pageIdx === 0) return true; // First page is always unlocked once module is opened
    return currentProgress?.unlockedPageIds?.includes(page.id) === true;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 animate-fadeIn relative">
      {/* TOMBOL PEMICU SIDEBAR MODUL DI KIRI TENGAH: 120 TINGGI, 30 LEBAR - MENGGUNAKAN PORTAL AGAR TIDAK BISA TERSCROLL */}
      {!isSidebarOpen && typeof document !== 'undefined' &&
        createPortal(
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            title="Buka Menu Modul & Navigasi"
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

      {/* JIKA BELUM ADA MODUL SAMA SEKALI DI DATABASE */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-600">Memuat modul pembelajaran...</p>
        </div>
      ) : modules.length === 0 ? (
        <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-3 max-w-lg mx-auto shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-800">Belum Ada Modul Tersedia</h3>
          <p className="text-xs text-slate-500">
            Bapak/Ibu guru belum menerbitkan materi modul saat ini. Silakan hubungi guru kelas Anda.
          </p>
        </div>
      ) : activeModule && !isModuleUnlocked(activeModule) ? (
        /* KETIKA MODUL TERPILIH MASIH TERKUNCI DENGAN PASSWORD */
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
              Modul Terkunci
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {activeModule.title}
            </h3>
            <p className="text-xs text-slate-500 mt-2">
              Modul ini dilindungi kata sandi oleh bapak/ibu guru. Silakan masukkan password untuk mulai membaca materi.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => handleSelectModule(activeModule)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center space-x-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Buka Password Modul</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Pilih Modul Lain
            </button>
          </div>
        </div>
      ) : activeModule && activePage ? (
        /* 2. TAMPILAN DALAM MODUL: PALING ATAS LANGSUNG TAB-TAB MATERI */
        <div className="space-y-3">
          {/* TAB HALAMAN MATERI (MODERN GLASSMORPHISM & MINIMALIS, TIDAK KELUAR DARI HP) */}
          <div className="w-full max-w-full overflow-hidden bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl shadow-emerald-950/20 rounded-2xl p-1.5 sm:p-2">
            <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none max-w-full py-1 px-1 scroll-smooth">
              {activeModule.pages.map((p, idx) => {
                const unlocked = isPageUnlocked(p, idx);
                const isActive = activePageIndex === idx;

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      if (unlocked) setActivePageIndex(idx);
                    }}
                    title={p.title}
                    className={`flex items-center justify-center rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 border select-none ${
                      isActive
                        ? 'min-w-[56px] sm:min-w-[68px] h-10 px-3.5 bg-white text-emerald-950 border-white shadow-xl shadow-black/25 ring-2 ring-emerald-300 scale-105 space-x-1.5'
                        : unlocked
                        ? 'w-10 h-10 bg-white/15 hover:bg-white/25 text-white border-white/20 hover:border-white/40 active:scale-95'
                        : 'w-10 h-10 bg-black/25 text-white/30 border-white/10 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {!unlocked ? (
                      <Lock className="w-3.5 h-3.5 text-white/40" />
                    ) : isActive ? (
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
            </div>
          </div>

          {/* KONTEN HALAMAN */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-7 space-y-6">
            {/* Header Halaman */}
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  Halaman {activePageIndex + 1} dari {activeModule.pages.length}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  {activePage.title}
                </h3>
              </div>

              {activePage.type === 'game' && (
                <span className="px-2.5 py-1 bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-xs font-black flex items-center space-x-1">
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>Zona Game</span>
                </span>
              )}
              {activePage.type === 'quiz' && (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-black flex items-center space-x-1">
                  <Award className="w-3.5 h-3.5 text-amber-700" />
                  <span>Kuis Akhir</span>
                </span>
              )}
            </div>

            {/* A. HALAMAN MATERI */}
            {activePage.type === 'materi' && (
              <div className="space-y-6">
                {/* Teks Materi */}
                <div 
                  className="prose prose-slate max-w-none text-slate-800 text-sm sm:text-base leading-relaxed font-normal bg-emerald-50/40 p-4 sm:p-6 rounded-2xl border border-emerald-100 konten-dokumen"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(activePage.content || '<p><br></p>', true) }}
                />

                    {/* SOAL PENGUNCIAN */}
                    {activePage.lockQuestion && (
                      <div className="border-t border-slate-200 pt-5 space-y-4">
                        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4 animate-fadeIn">
                          <div className="flex items-center space-x-2 text-emerald-800 font-black text-xs sm:text-sm uppercase tracking-wide">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Jawab untuk maju ke halaman berikutnya</span>
                          </div>

                          <p className="font-bold text-slate-900 text-sm sm:text-base">
                            {activePage.lockQuestion.question}
                          </p>

                          {/* Pilihan Ganda */}
                          <div className="space-y-2">
                            {activePage.lockQuestion.options.map((opt, oIdx) => {
                              const isSelected = selectedLockAnswer === oIdx;
                              return (
                                <button
                                  key={oIdx}
                                  type="button"
                                  disabled={lockQuestionSuccess}
                                  onClick={() => {
                                    setSelectedLockAnswer(oIdx);
                                    setLockQuestionError(null);
                                  }}
                                  className={`w-full text-left p-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all border cursor-pointer flex items-center space-x-3 ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                      : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300'
                                  }`}
                                >
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                    isSelected ? 'bg-white text-emerald-800' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {String.fromCharCode(65 + oIdx)}
                                  </span>
                                  <span className="flex-1">{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Feedback Galat / Sukses */}
                          {lockQuestionError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>{lockQuestionError}</span>
                            </div>
                          )}

                          {lockQuestionSuccess && (
                            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 animate-bounce">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                              <span>Hebat! Jawabanmu benar. Membuka halaman berikutnya...</span>
                            </div>
                          )}

                          {!lockQuestionSuccess && (
                            <button
                              type="button"
                              disabled={selectedLockAnswer === null}
                              onClick={handleCheckLockAnswer}
                              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                                selectedLockAnswer !== null
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <span>Periksa Jawaban & Lanjut</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
              </div>
            )}

            {/* B. HALAMAN GAME */}
            {activePage.type === 'game' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Game Edukasi Refreshing</span>
                  <button
                    type="button"
                    onClick={() => setIsGameFullscreen(!isGameFullscreen)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 flex items-center space-x-1 cursor-pointer font-bold"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>{isGameFullscreen ? 'Kecilkan' : 'Layar Penuh'}</span>
                  </button>
                </div>

                {/* Bingkai Game Terisolasi (Sandbox iFrame) */}
                <div className={`w-full rounded-2xl overflow-hidden border border-slate-300 bg-slate-950 transition-all ${
                  isGameFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-[360px] sm:h-[480px]'
                }`}>
                  {isGameFullscreen && (
                    <div className="bg-slate-900 p-2 text-white flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsGameFullscreen(false)}
                        className="px-3 py-1 bg-rose-600 rounded-lg text-xs font-bold"
                      >
                        Tutup Layar Penuh
                      </button>
                    </div>
                  )}
                  {activePage.gameHtml ? (
                    <iframe
                      srcDoc={activePage.gameHtml}
                      title="Educational Game"
                      sandbox="allow-scripts allow-same-origin allow-forms"
                      className="w-full h-full border-none"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs sm:text-sm p-4 text-center">
                      <Gamepad2 className="w-12 h-12 text-slate-600 mb-2" />
                      <span>Kode game belum disematkan oleh guru.</span>
                    </div>
                  )}
                </div>

                {/* Tombol Lanjut ke Halaman Berikutnya */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleNextFromGame}
                    className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>Lanjut ke Halaman Berikutnya</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* C. HALAMAN KUIS AKHIR */}
            {activePage.type === 'quiz' && (
              <div className="space-y-6">
                {!isQuizSubmitted ? (
                  <>
                    {shuffledQuestions.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-sm">
                        Belum ada soal pada kuis akhir ini.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Indikator Kemajuan Soal */}
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                          <span>Soal {currentQuizIndex + 1} dari {shuffledQuestions.length}</span>
                          <span>{Object.keys(quizAnswers).length} Dijawab</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full transition-all duration-300"
                            style={{
                              width: `${((currentQuizIndex + 1) / shuffledQuestions.length) * 100}%`,
                            }}
                          />
                        </div>

                        {/* 1 Soal per layar HP */}
                        {shuffledQuestions[currentQuizIndex] && (
                          <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
                            <h4 className="font-black text-slate-900 text-sm sm:text-base leading-relaxed">
                              {shuffledQuestions[currentQuizIndex].question}
                            </h4>

                            {/* Pilihan Jawaban */}
                            <div className="space-y-2">
                              {shuffledQuestions[currentQuizIndex].options.map((opt, optIdx) => {
                                const isSelected = quizAnswers[currentQuizIndex] === optIdx;
                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    onClick={() => {
                                      setQuizAnswers((prev) => ({
                                        ...prev,
                                        [currentQuizIndex]: optIdx,
                                      }));
                                    }}
                                    className={`w-full text-left p-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all border cursor-pointer flex items-center space-x-3 ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                        : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300'
                                    }`}
                                  >
                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                      isSelected ? 'bg-white text-emerald-800' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>
                                    <span className="flex-1">{opt}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Navigasi Kuis */}
                        <div className="flex items-center justify-between gap-2 pt-2">
                          <button
                            type="button"
                            disabled={currentQuizIndex === 0}
                            onClick={() => setCurrentQuizIndex((prev) => Math.max(0, prev - 1))}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Sebelumnya
                          </button>

                          {currentQuizIndex < shuffledQuestions.length - 1 ? (
                            <button
                              type="button"
                              onClick={() => setCurrentQuizIndex((prev) => prev + 1)}
                              className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-xs cursor-pointer flex items-center space-x-1"
                            >
                              <span>Berikutnya</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={Object.keys(quizAnswers).length < shuffledQuestions.length}
                              onClick={handleSubmitFinalQuiz}
                              className={`px-6 py-2.5 rounded-xl font-black text-xs text-white shadow-xs cursor-pointer flex items-center space-x-1.5 ${
                                Object.keys(quizAnswers).length === shuffledQuestions.length
                                  ? 'bg-amber-500 hover:bg-amber-600'
                                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              <Check className="w-4 h-4" />
                              <span>Selesai & Kumpulkan</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* HASIL KUIS AKHIR */
                  <div className="text-center py-6 space-y-4">
                    <div className="inline-flex p-4 rounded-3xl bg-emerald-100 text-emerald-800 border-2 border-emerald-300">
                      <Award className="w-12 h-12 text-emerald-600" />
                    </div>

                    <h4 className="text-2xl font-black text-slate-900">
                      Hasil Kuis Akhir Modul
                    </h4>

                    <div className="max-w-xs mx-auto bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                      <div className="text-5xl font-black text-emerald-600">
                        {quizResult?.score ?? 0}
                      </div>
                      <div className="text-xs font-bold text-slate-600">
                        Skala Nilai 0 - 100
                      </div>
                      <div className="pt-2 border-t border-slate-200 text-xs text-slate-700 flex justify-between">
                        <span>Jawaban Benar:</span>
                        <strong className="text-emerald-700">{quizResult?.correct} dari {quizResult?.total}</strong>
                      </div>
                      <div className="text-xs text-slate-700 flex justify-between">
                        <span>Nilai Tertinggi Disimpan:</span>
                        <strong className="text-amber-700">{currentProgress?.highestQuizScore ?? quizResult?.score}</strong>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Selamat! Modul ini telah ditandai <strong>Selesai</strong> dan nilai tersimpan otomatis ke akunmu.
                    </p>

                    <div className="flex items-center justify-center space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuizSubmitted(false);
                          setQuizAnswers({});
                          setCurrentQuizIndex(0);
                        }}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Ulangi Kuis</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsSidebarOpen(true)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center space-x-1.5"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>Pilih Modul Lain</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* 3. SIDEBAR DAFTAR MODUL (SLIDE DARI KIRI DI HP & DESKTOP) - PORTAL KE BODY */}
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
            <div className="relative w-80 max-w-[85vw] bg-gradient-to-b from-[#0b3838] via-[#082e2f] to-[#041a1b] text-teal-50 h-full shadow-2xl p-4 flex flex-col z-10 animate-slideRight border-r border-teal-500/30">
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
                      Portal Siswa
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

              {/* Menu Navigasi Siswa */}
              <div className="space-y-1.5 py-3 border-b border-teal-500/20">
                <span className="text-[10px] uppercase font-black text-teal-400 tracking-wider px-1">
                  Menu Utama
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onSwitchTab?.('modul');
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    currentTab === 'modul'
                      ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                      : 'text-teal-100 hover:text-white hover:bg-teal-800/50'
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>Materi Modul</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSwitchTab?.('sikap');
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    currentTab === 'sikap'
                      ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                      : 'text-teal-100 hover:text-white hover:bg-teal-800/50'
                  }`}
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

              {/* Daftar Modul Belajar */}
              <div className="flex items-center justify-between pt-3 pb-1.5 px-1">
                <span className="text-[10px] uppercase font-black text-teal-400 tracking-wider">
                  Daftar Modul Belajar
                </span>
                <span className="text-[10px] font-bold text-teal-300/80">
                  {modules.length} Modul
                </span>
              </div>

              <div className="flex-1 overflow-y-auto py-1 space-y-2">
                {modules.map((m, idx) => {
                  const status = getModuleStatus(m);
                  const isSelected = selectedModuleId === m.id;
                  const StatusIcon = status.icon;
                  const prog = progressList.find((p) => p.moduleId === m.id);

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        handleSelectModule(m);
                        if (onSwitchTab) onSwitchTab('modul');
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col space-y-1.5 ${
                        isSelected
                          ? 'bg-teal-700/80 border-teal-300 text-white shadow-lg shadow-teal-950/40 ring-1 ring-teal-300'
                          : 'bg-teal-950/50 hover:bg-teal-900/60 border-teal-500/25 text-teal-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-black truncate">
                          {idx + 1}. {m.title}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center space-x-1 shrink-0 ${status.color}`}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          <span>{status.label}</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-teal-300/80">
                        <span>{m.pages?.length || 0} halaman materi</span>
                        {prog?.isCompleted && (
                          <span className="font-bold text-emerald-300">
                            Nilai: {prog.quizScore ?? '-'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Profil Siswa Singkat */}
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

      {/* 4. MODAL PASSWORD MODUL */}
      {passwordModalModule && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
            style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
          >
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              style={{ position: 'fixed', inset: 0 }}
              onClick={() => setPasswordModalModule(null)}
            />

            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative z-10 space-y-4 animate-scaleUp">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="font-black text-base text-slate-900">
                  Modul Ini Terkunci
                </h3>
                <p className="text-xs text-slate-500">
                  Silakan masukkan kata sandi (password) untuk membuka <strong>{passwordModalModule.title}</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifyPassword} className="space-y-3">
                <div>
                  <input
                    type="password"
                    value={inputPassword}
                    onChange={(e) => {
                      setInputPassword(e.target.value);
                      setPasswordError('');
                    }}
                    placeholder="Ketik password modul..."
                    className="w-full px-4 py-3 text-center text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    autoFocus
                  />
                  {passwordError && (
                    <p className="text-rose-600 text-xs font-semibold text-center mt-2">
                      {passwordError}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPasswordModalModule(null)}
                    className="flex-1 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                  >
                    Buka Modul
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
