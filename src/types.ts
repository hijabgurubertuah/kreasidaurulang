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

// ==========================================
// MATERI MODUL (PORTAL BELAJAR) TYPES
// ==========================================

export type ModulePageType = 'materi' | 'game' | 'quiz';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[]; // 4 options [A, B, C, D]
  correctAnswerIndex: number; // 0, 1, 2, or 3
}

export interface ModulePage {
  id: string;
  title: string;
  type: ModulePageType;
  order: number;
  // Khusus type === 'materi'
  content?: string; // Rich text / paragraphs / bullet items
  readingDelaySeconds?: number; // default 10 seconds
  lockQuestion?: QuizQuestion; // 1 lock question
  // Khusus type === 'game'
  gameHtml?: string; // HTML embed code as string
  // Khusus type === 'quiz' (Kuis Akhir)
  quizQuestions?: QuizQuestion[];
  randomizeQuestions?: boolean;
}

export interface LearningModule {
  id: string;
  title: string;
  order: number;
  isLockedWithPassword?: boolean;
  password?: string;
  pages: ModulePage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentModuleProgress {
  id: string; // `${studentNisn}_${moduleId}`
  studentNisn: string;
  studentName: string;
  studentClass?: string;
  moduleId: string;
  moduleTitle: string;
  unlockedWithPassword?: boolean;
  unlockedPageIds: string[]; // array of completed / unlocked page IDs
  lastActivePageId?: string;
  isCompleted?: boolean;
  quizScore?: number; // Latest quiz score (0 - 100)
  highestQuizScore?: number; // Highest quiz score (0 - 100)
  quizCorrectCount?: number;
  quizTotalCount?: number;
  lastQuizAttemptAt?: string;
  updatedAt?: string;
}

// ==========================================
// GOOGLE WORKSPACE (DRIVE & SHEETS) TYPES
// ==========================================

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  owners?: { displayName: string; emailAddress: string; photoLink?: string }[];
  shared?: boolean;
}

export interface GoogleSpreadsheetSummary {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: {
    sheetId: number;
    title: string;
    rowCount?: number;
    columnCount?: number;
  }[];
}
