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
  clearAllStudentsInDb,
  clearAllTeacherCodesInDb,
  resetDatabaseToDefaultsInDb,
  deduplicateStudentsInDb,
  commitStagedChangesToDb,
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

  // Staged / Pending Changes State to protect Firebase daily write quota
  const [modifiedStudentIds, setModifiedStudentIds] = useState<Set<string>>(new Set());
  const [pendingDeletedStudentIds, setPendingDeletedStudentIds] = useState<Set<string>>(new Set());
  const [isSavingToFirebase, setIsSavingToFirebase] = useState(false);
  const [saveSuccessNotification, setSaveSuccessNotification] = useState<string | null>(null);
  const savedSnapshotRef = useRef<Student[]>(DEFAULT_STUDENTS);

  const pendingChangesCount = modifiedStudentIds.size + pendingDeletedStudentIds.size;
  const hasPendingChanges = pendingChangesCount > 0;

  // Initialize and listen to Firestore
  useEffect(() => {
    let isMounted = true;

    // Try seeding default data if Firestore is empty
    initializeFirestoreIfNeeded().catch((e) =>
      console.warn('Initialize firestore error:', e)
    );

    // Subscribe to students
    const unsubscribeStudents = listenToStudents(
      (updatedStudents) => {
        if (!isMounted) return;
        setFirebaseConnected(true);
        // Only overwrite local state if user has no pending unsaved edits
        setModifiedStudentIds((currModified) => {
          setPendingDeletedStudentIds((currDeleted) => {
            if (currModified.size === 0 && currDeleted.size === 0) {
              setStudents(updatedStudents);
              savedSnapshotRef.current = updatedStudents;
            }
            return currDeleted;
          });
          return currModified;
        });
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

  // Update score with local staging - does NOT write to Firebase until "Simpan ke Firebase" is clicked
  const handleUpdateScore = useCallback(
    (studentId: string, newScore: number) => {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, score: newScore } : s))
      );
      setModifiedStudentIds((prev) => new Set(prev).add(studentId));
    },
    []
  );

  // Update notes with local staging - does NOT write to Firebase until "Simpan ke Firebase" is clicked
  const handleUpdateNotes = useCallback(
    (studentId: string, notes: string) => {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, notes } : s))
      );
      setModifiedStudentIds((prev) => new Set(prev).add(studentId));
    },
    []
  );

  // Admin student management - updates if same NISN, stages locally
  const handleSaveStudent = (student: Student) => {
    const cleanNisn = student.nisn.trim().toLowerCase();
    const standardId = getStudentDocId(student.nisn);
    const standardized: Student = {
      ...student,
      id: standardId,
      nisn: student.nisn.trim(),
    };

    setStudents((prev) => {
      const idx = prev.findIndex(
        (s) => s.id === standardId || s.nisn.trim().toLowerCase() === cleanNisn
      );
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...standardized };
        return copy;
      }
      return [standardized, ...prev];
    });

    setModifiedStudentIds((prev) => new Set(prev).add(standardId));
    setPendingDeletedStudentIds((prev) => {
      const next = new Set(prev);
      next.delete(standardId);
      return next;
    });
  };

  // Delete single student - stages locally
  const handleDeleteStudent = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setPendingDeletedStudentIds((prev) => new Set(prev).add(studentId));
    setModifiedStudentIds((prev) => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
  };

  // Bulk Delete students - stages locally
  const handleBulkDeleteStudents = (studentIds: string[]) => {
    const idsSet = new Set(studentIds);
    setStudents((prev) => prev.filter((s) => !idsSet.has(s.id)));
    setPendingDeletedStudentIds((prev) => {
      const next = new Set(prev);
      studentIds.forEach((id) => next.add(id));
      return next;
    });
    setModifiedStudentIds((prev) => {
      const next = new Set(prev);
      studentIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  // Sync CSV data to state - stages locally with anti-duplication
  const handleSyncCsvData = async (
    newStudents: Student[],
    newClasses: ClassRoom[]
  ) => {
    const ids = new Set<string>();
    setStudents((prev) => {
      const map = new Map<string, Student>();
      prev.forEach((s) => map.set(s.nisn.trim().toLowerCase(), s));
      newStudents.forEach((s) => {
        const key = s.nisn.trim().toLowerCase();
        const stdId = getStudentDocId(s.nisn);
        ids.add(stdId);
        const existing = map.get(key);
        if (existing) {
          map.set(key, { ...existing, ...s, id: stdId });
        } else {
          map.set(key, { ...s, id: stdId });
        }
      });
      return Array.from(map.values());
    });

    if (newClasses.length > 0) {
      setClasses((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        newClasses.forEach((c) => map.set(c.id, c));
        return Array.from(map.values());
      });
    }

    setModifiedStudentIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  // Save all staged changes to Firebase in 1 batch write
  const handleSaveToFirebase = async () => {
    if (pendingChangesCount === 0) return;
    setIsSavingToFirebase(true);
    try {
      const studentsToSave = students.filter((s) => modifiedStudentIds.has(s.id));
      const idsToDelete = Array.from(pendingDeletedStudentIds);

      const res = await commitStagedChangesToDb({
        upsertStudents: studentsToSave,
        deletedStudentIds: idsToDelete,
      });

      setModifiedStudentIds(new Set());
      setPendingDeletedStudentIds(new Set());
      savedSnapshotRef.current = [...students];

      setSaveSuccessNotification(
        `Berhasil menyimpan ${res.writesCount} perubahan ke Firebase dalam 1 kali batch write! Kuota tulis harian Anda tetap hemat.`
      );
      setTimeout(() => setSaveSuccessNotification(null), 5000);
    } catch (err: any) {
      console.error('Failed to save to Firebase:', err);
      alert(`Gagal menyimpan ke Firebase: ${err.message}`);
    } finally {
      setIsSavingToFirebase(false);
    }
  };

  // Discard pending changes and revert to Firestore snapshot
  const handleDiscardPendingChanges = () => {
    if (window.confirm('Batalkan semua perubahan yang belum disimpan ke Firebase?')) {
      setStudents([...savedSnapshotRef.current]);
      setModifiedStudentIds(new Set());
      setPendingDeletedStudentIds(new Set());
      setSaveSuccessNotification('Perubahan lokal dibatalkan. Data dikembalikan ke database cloud.');
      setTimeout(() => setSaveSuccessNotification(null), 3000);
    }
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
    savedSnapshotRef.current = [];
    setModifiedStudentIds(new Set());
    setPendingDeletedStudentIds(new Set());
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
    savedSnapshotRef.current = DEFAULT_STUDENTS;
    setModifiedStudentIds(new Set());
    setPendingDeletedStudentIds(new Set());
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
    if (hasPendingChanges) {
      if (!window.confirm('Ada perubahan yang belum disimpan ke Firebase. Apakah Anda yakin ingin keluar?')) {
        return;
      }
    }
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
          hasPendingChanges={hasPendingChanges}
          pendingChangesCount={pendingChangesCount}
          onSaveToFirebase={handleSaveToFirebase}
          isSavingToFirebase={isSavingToFirebase}
        />
      )}

      {/* Global Toast Notification for Save to Firebase */}
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

        {/* Portal Admin (Atur NISN, Kode Guru, CSV & Pembersihan Data) */}
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
              hasPendingChanges={hasPendingChanges}
              pendingChangesCount={pendingChangesCount}
              onSaveToFirebase={handleSaveToFirebase}
              isSavingToFirebase={isSavingToFirebase}
              onDiscardPendingChanges={handleDiscardPendingChanges}
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
              hasPendingChanges={hasPendingChanges}
              pendingChangesCount={pendingChangesCount}
              onSaveToFirebase={handleSaveToFirebase}
              isSavingToFirebase={isSavingToFirebase}
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
