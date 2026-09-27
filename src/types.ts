export interface Student {
  id: string;
  nisn: string;
  name: string;
  classId: string;
  className: string;
  score: number; // 0 - 100, step 10, default 80
  meetingScores?: (number | null)[]; // Scores for up to 20 meetings
  projectTitle?: string; // e.g. "Kreasi Pot Botol Plastik Hidroponik"
  notes?: string;
  aspects?: {
    creativity: number;
    cooperation: number;
    responsibility: number;
  };
  lastUpdated?: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  grade: string;
  homeroomTeacher?: string;
  studentCount?: number;
  averageScore?: number;
}

export interface TeacherCode {
  id: string;
  code: string;
  name: string;
  role: 'teacher' | 'admin';
  assignedClass?: string;
  createdAt: string;
}

export type UserRole = 'student' | 'teacher' | 'admin' | null;

export interface CurrentUser {
  role: UserRole;
  identifier: string; // NISN for student, Code for teacher/admin
  name: string;
  studentData?: Student;
  teacherData?: TeacherCode;
}

export type ActivePage = 'login' | 'dashboard' | 'class-detail' | 'student-view' | 'admin-portal';
