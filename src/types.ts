export interface Student {
  id: string;
  nisn: string;
  name: string;
  classId: string;
  className: string;
  score: number; // 0 - 100, step 10, default 80
  meetingScores?: (number | null)[]; // Scores for up to 20 meetings
  meetingNotes?: (string | null)[]; // Notes for up to 20 meetings
  meetingAbsences?: (boolean | null)[]; // Attendance: true = Tidak Hadir, false/null = Hadir
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

export interface MeetingSchedule {
  id: string;
  meetingNumber: number;
  activeDate: string; // YYYY-MM-DD or empty
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

export interface ScoringCriterion {
  id: string;
  type: 'plus' | 'minus';
  title: string;
  points?: number;
}

export interface EvaluationCriteriaConfig {
  positiveCriteria: ScoringCriterion[];
  negativeCriteria: ScoringCriterion[];
  updatedAt?: string;
}

export interface SystemLog {
  id: string;
  action: string;
  description: string;
  operator: string;
  timestamp: string;
}

