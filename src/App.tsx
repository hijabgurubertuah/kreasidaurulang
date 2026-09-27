import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { ClassDetailView } from './components/ClassDetailView';
import { StudentPortalView } from './components/StudentPortalView';
import { AdminPortalView } from './components/AdminPortalView';
import { AdminSyncModal } from './components/AdminSyncModal';
import {
  ClassRoom,
  Student,
  TeacherCode,
  CurrentUser,
  ActivePage,
} from './types';
import {
  DEFAULT_CLASSES,
  DEFAULT_STUDENTS,
  DEFAULT_TEACHER_CODES,
} from './data/defaultData';
import {
  initializeFirestoreIfNeeded,
  listenToStudents,
  listenToClasses,
  listenToTeacherCodes,
  createTeacherCodeInDb,
  deleteTeacherCodeInDb,
  getStudentDocId,
  saveStudentInDb,
  deleteStudentInDb,
  batchDeleteStudentsInDb,
  batchSyncStudentsAndClasses,
  updateStudentScoreInDb,
  clearAllStudentsInDb,
  clearAllTeacherCodesInDb,
  resetDatabaseToDefaultsInDb,
  deduplicateStudentsInDb,
} from './services/firestoreService';
import { exportAllClassesToExcel } from './utils/excelExport';
import { CheckCircle2, X } from 'lucide-react';

export default function App() {
  const [classes, setClasses] = useState<ClassRoom[]>(DEFAULT_CLASSES);
  const [students, setStudents] = useState<Student[]>(DEFAULT_STUDENTS);
  const [teacherCodes, setTeacherCodes] = useState<TeacherCode[]>(DEFAULT_TEACHER_CODES);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activePage, setActivePage] = useState<ActivePage>('login');
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminModalTab, setAdminModalTab] = useState<'csv' | 'codes'>('csv');
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [saveSuccessNotification, setSaveSuccessNotification] = useState<string | null>(null);

  // Initialize and listen to Firestore in real-time
  useEffect(() => {
    let isMounted = true;

    // Try seeding default data if Firestore is empty
    initializeFirestoreIfNeeded().catch((e) =>
      console.warn('Initialize firestore error:', e)
    );

    // Subscribe to students with instant real-time sync across devices
    const unsubscribeStudents = listenToStudents(
      (updatedStudents) => {
        if (!isMounted) return;
        setFirebaseConnected(true);
        setStudents(updatedStudents);
      },
      () => setFirebaseConnected(false)
    );

    // Subscribe to classes
    const unsubscribeClasses = listenToClasses(
      (updatedClasses) => {
        if (!isMounted) return;
        if (updatedClasses.length > 0) {
          setClasses(updatedClasses);
        }
      },
      () => {}
    );

    // Subscribe to teacher codes
    const unsubscribeTeacherCodes = listenToTeacherCodes(
      (updatedCodes) => {
        if (!isMounted) return;
        setTeacherCodes(updatedCodes);
      },
      () => {}
    );

    return () => {
      isMounted = false;
      unsubscribeStudents();
      unsubscribeClasses();
      unsubscribeTeacherCodes();
    };
  }, []);

  // Update current user's student data if live students state changes
  useEffect(() => {
    if (currentUser?.role === 'student' && currentUser.studentData) {
      const fresh = students.find((s) => s.nisn === currentUser.identifier);
      if (fresh && fresh.score !== currentUser.studentData.score) {
        setCurrentUser((prev) => (prev ? { ...prev, studentData: fresh } : null));
      }
    }
  }, [students, currentUser?.identifier, currentUser?.role]);

  // Update score with immediate Firestore real-time persistence
  const handleUpdateScore = useCallback(
    async (studentId: string, newScore: number) => {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, score: newScore } : s))
      );
      try {
        await updateStudentScoreInDb(studentId, newScore);
      } catch (err) {
        console.error('Failed to update student score:', err);
      }
    },
    []
  );

  // Update notes with immediate Firestore real-time persistence
  const handleUpdateNotes = useCallback(
    async (studentId: string, notes: string) => {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, notes } : s))
      );
      const student = students.find((s) => s.id === studentId);
      try {
        await updateStudentScoreInDb(studentId, student?.score || 80, notes);
      } catch (err) {
        console.error('Failed to update student notes:', err);
      }
    },
    [students]
  );

  // Admin student management - saves immediately to Firebase
  const handleSaveStudent = async (student: Student) => {
    const cleanNisn = student.nisn.trim();
    const standardId = getStudentDocId(cleanNisn);
    const standardized: Student = {
      ...student,
      id: standardId,
      nisn: cleanNisn,
      lastUpdated: new Date().toISOString(),
    };

    setStudents((prev) => {
      const idx = prev.findIndex(
        (s) => s.id === standardId || s.nisn.trim().toLowerCase() === cleanNisn.toLowerCase()
      );
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...standardized };
        return copy;
      }
      return [standardized, ...prev];
    });

    await saveStudentInDb(standardized);
  };

  // Delete single student - deletes immediately from Firebase
  const handleDeleteStudent = async (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    await deleteStudentInDb(studentId);
    setSaveSuccessNotification('Siswa berhasil dihapus langsung dari database Firebase.');
    setTimeout(() => setSaveSuccessNotification(null), 3000);
  };

  // Bulk Delete students - deletes immediately from Firebase seketika
  const handleBulkDeleteStudents = async (studentIds: string[]) => {
    const idsSet = new Set(studentIds);
    setStudents((prev) => prev.filter((s) => !idsSet.has(s.id)));
    const deletedCount = await batchDeleteStudentsInDb(studentIds);
    setSaveSuccessNotification(
      `${deletedCount} siswa berhasil dihapus seketika dari Firebase Firestore & tersinkronisasi ke seluruh perangkat!`
    );
    setTimeout(() => setSaveSuccessNotification(null), 4000);
  };

  // Sync CSV data to Firebase immediately with anti-duplication
  const handleSyncCsvData = async (
    newStudents: Student[],
    newClasses: ClassRoom[]
  ) => {
    await batchSyncStudentsAndClasses(newStudents, newClasses);
    setSaveSuccessNotification(
      `Berhasil menyinkronkan ${newStudents.length} siswa langsung ke Firebase Firestore!`
    );
    setTimeout(() => setSaveSuccessNotification(null), 4000);
  };

  // Create new Teacher Code
  const handleCreateTeacherCode = async (newCode: TeacherCode) => {
    setTeacherCodes((prev) => [...prev, newCode]);
    await createTeacherCodeInDb(newCode);
  };

  // Delete Teacher Code
  const handleDeleteTeacherCode = async (codeId: string) => {
    setTeacherCodes((prev) => prev.filter((c) => c.id !== codeId));
    await deleteTeacherCodeInDb(codeId);
  };

  // Clear all students from Firebase
  const handleClearAllStudents = async (): Promise<number> => {
    const count = await clearAllStudentsInDb();
    setStudents([]);
    return count;
  };

  // Clear custom teacher codes from Firebase
  const handleClearTeacherCodes = async (): Promise<number> => {
    const count = await clearAllTeacherCodesInDb();
    setTeacherCodes((prev) =>
      prev.filter((t) => t.code === 'ADMIN123' || t.code === 'GURU123')
    );
    return count;
  };

  // Reset entire database to default
  const handleResetDatabase = async (): Promise<void> => {
    await resetDatabaseToDefaultsInDb();
    setStudents(DEFAULT_STUDENTS);
    setClasses(DEFAULT_CLASSES);
    setTeacherCodes(DEFAULT_TEACHER_CODES);
  };

  // Deduplicate students in Firebase
  const handleDeduplicateStudents = async () => {
    const result = await deduplicateStudentsInDb();
    return result;
  };

  const handleExportAll = () => {
    exportAllClassesToExcel(classes, students);
  };

  // Navigation handlers
  const handleSelectClass = (cls: ClassRoom) => {
    setSelectedClass(cls);
    setActivePage('class-detail');
  };

  const handleBackToDashboard = () => {
    setSelectedClass(null);
    setActivePage('dashboard');
  };

  const handleLoginSuccess = (user: CurrentUser) => {
    setCurrentUser(user);
    if (user.role === 'student') {
      setActivePage('student-view');
    } else if (user.role === 'admin') {
      setActivePage('admin-portal');
    } else {
      setActivePage('dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedClass(null);
    setActivePage('login');
  };

  const handleOpenAdminModal = (tab: 'csv' | 'codes' = 'csv') => {
    setAdminModalTab(tab);
    setIsAdminModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-200 selection:text-emerald-900">
      {/* Top Navigation - Hanya tampil setelah login */}
      {activePage !== 'login' && (
        <Navbar
          currentUser={currentUser}
          activePage={activePage}
          onNavigate={(page) => setActivePage(page)}
          onLogout={handleLogout}
          onExportAll={handleExportAll}
          firebaseConnected={firebaseConnected}
        />
      )}

      {/* Global Toast Notification */}
      {saveSuccessNotification && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center space-x-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold leading-relaxed flex-1">
            {saveSuccessNotification}
          </span>
          <button
            type="button"
            onClick={() => setSaveSuccessNotification(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {activePage === 'login' && (
          <LoginView
            students={students}
            teacherCodes={teacherCodes}
            onLoginSuccess={handleLoginSuccess}
          />
        )}

        {/* Portal Admin (Atur NISN, Kode Guru, CSV & Database 1 GB) */}
        {activePage === 'admin-portal' && currentUser && currentUser.role === 'admin' && (
          <div className="pb-16 flex-1">
            <AdminPortalView
              students={students}
              classes={classes}
              teacherCodes={teacherCodes}
              onBackToDashboard={() => setActivePage('dashboard')}
              onSaveStudent={handleSaveStudent}
              onDeleteStudent={handleDeleteStudent}
              onBulkDeleteStudents={handleBulkDeleteStudents}
              onCreateTeacherCode={handleCreateTeacherCode}
              onDeleteTeacherCode={handleDeleteTeacherCode}
              onSyncCsvData={handleSyncCsvData}
              onClearStudents={handleClearAllStudents}
              onClearTeacherCodes={handleClearTeacherCodes}
              onResetDatabase={handleResetDatabase}
              onDeduplicateStudents={handleDeduplicateStudents}
              firebaseConnected={firebaseConnected}
            />
          </div>
        )}

        {/* Dashboard Penilaian Kelas */}
        {activePage === 'dashboard' && currentUser && currentUser.role !== 'student' && (
          <div className="pb-16 flex-1">
            <DashboardView
              classes={classes}
              students={students}
              onSelectClass={handleSelectClass}
              onOpenAdminModal={handleOpenAdminModal}
            />
          </div>
        )}

        {/* Detail Kelas & Penilaian Real-time */}
        {activePage === 'class-detail' && selectedClass && currentUser && currentUser.role !== 'student' && (
          <div className="pb-16 flex-1">
            <ClassDetailView
              classroom={selectedClass}
              students={students}
              onBack={handleBackToDashboard}
              onUpdateScore={handleUpdateScore}
              onUpdateNotes={handleUpdateNotes}
            />
          </div>
        )}

        {/* Portal Siswa */}
        {activePage === 'student-view' && currentUser && currentUser.studentData && (
          <div className="pb-16 flex-1">
            <StudentPortalView
              student={
                students.find((s) => s.nisn === currentUser.identifier) ||
                currentUser.studentData
              }
              onLogout={handleLogout}
            />
          </div>
        )}
      </main>

      {/* Admin / CSV Sync / Code Management Modal */}
      <AdminSyncModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        defaultTab={adminModalTab}
        classes={classes}
        teacherCodes={teacherCodes}
        onSyncCsvData={handleSyncCsvData}
        onCreateTeacherCode={handleCreateTeacherCode}
        onDeleteTeacherCode={handleDeleteTeacherCode}
      />

      {/* Footer hanya tampil ketika sudah login */}
      {activePage !== 'login' && (
        <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-center text-xs">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-300">
                E-Penilaian Kokurikuler: Kreasi Daur Ulang
              </span>
              <span>•</span>
              <span className="italic">By. TIM MODUL KREASI DAUR ULANG</span>
            </div>
            <div className="text-slate-500">
              SMP Negeri 1 Bengkalis • Terhubung ke Firebase Firestore
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
