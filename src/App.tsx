import React, { useState, useEffect, useCallback } from 'react';
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
  updateStudentScoreInDb,
  saveStudentInDb,
  deleteStudentInDb,
  batchSyncStudentsAndClasses,
  createTeacherCodeInDb,
  deleteTeacherCodeInDb,
} from './services/firestoreService';
import { exportAllClassesToExcel } from './utils/excelExport';

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
        if (updatedStudents.length > 0) {
          setStudents(updatedStudents);
          setFirebaseConnected(true);
        }
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
        if (updatedCodes.length > 0) {
          setTeacherCodes(updatedCodes);
        }
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

  // Update score with optimistic local update + Firestore write
  const handleUpdateScore = useCallback(
    async (studentId: string, newScore: number) => {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, score: newScore } : s))
      );

      try {
        await updateStudentScoreInDb(studentId, newScore);
      } catch (err) {
        console.warn('Failed to update student score in Firestore:', err);
      }
    },
    []
  );

  // Update notes with optimistic local update + Firestore write
  const handleUpdateNotes = useCallback(
    async (studentId: string, notes: string) => {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, notes } : s))
      );

      const target = students.find((s) => s.id === studentId);
      const score = target ? target.score : 80;

      try {
        await updateStudentScoreInDb(studentId, score, notes);
      } catch (err) {
        console.warn('Failed to update student notes in Firestore:', err);
      }
    },
    [students]
  );

  // Admin student management
  const handleSaveStudent = async (student: Student) => {
    setStudents((prev) => {
      const idx = prev.findIndex((s) => s.id === student.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = student;
        return copy;
      }
      return [student, ...prev];
    });
    await saveStudentInDb(student);
  };

  const handleDeleteStudent = async (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    await deleteStudentInDb(studentId);
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
      // Kode admin123 langsung membuka Portal Admin
      setActivePage('admin-portal');
    } else {
      // Kode guru123 langsung membuka Dashboard
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

  // Sync CSV data to Firestore & state
  const handleSyncCsvData = async (
    newStudents: Student[],
    newClasses: ClassRoom[]
  ) => {
    setStudents((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      newStudents.forEach((s) => map.set(s.id, s));
      return Array.from(map.values());
    });

    if (newClasses.length > 0) {
      setClasses((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        newClasses.forEach((c) => map.set(c.id, c));
        return Array.from(map.values());
      });
    }

    await batchSyncStudentsAndClasses(newStudents, newClasses);
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

  const handleExportAll = () => {
    exportAllClassesToExcel(classes, students);
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {activePage === 'login' && (
          <LoginView
            students={students}
            teacherCodes={teacherCodes}
            onLoginSuccess={handleLoginSuccess}
          />
        )}

        {/* Portal Admin (Atur NISN & Kode Guru & CSV) */}
        {activePage === 'admin-portal' && currentUser && currentUser.role === 'admin' && (
          <div className="pb-16 flex-1">
            <AdminPortalView
              students={students}
              classes={classes}
              teacherCodes={teacherCodes}
              onBackToDashboard={() => setActivePage('dashboard')}
              onSaveStudent={handleSaveStudent}
              onDeleteStudent={handleDeleteStudent}
              onCreateTeacherCode={handleCreateTeacherCode}
              onDeleteTeacherCode={handleDeleteTeacherCode}
              onSyncCsvData={handleSyncCsvData}
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

      {/* Admin / CSV Sync / Code Management Modal (jika dipanggil dari tombol dashboard) */}
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
