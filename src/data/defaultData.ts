import { ClassRoom, Student, TeacherCode } from '../types';

export const DEFAULT_CLASSES: ClassRoom[] = [
  {
    id: 'class-7a',
    name: 'Kelas 7A',
    grade: '7',
    homeroomTeacher: 'Budi Santoso, S.Pd.',
  },
];

// Empty list - no dummy students
export const DEFAULT_STUDENTS: Student[] = [];

export const DEFAULT_TEACHER_CODES: TeacherCode[] = [
  {
    id: 'tc-admin123',
    code: 'ADMIN123',
    name: 'Administrator Portal & Koordinator P5',
    role: 'admin',
    createdAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'tc-guru123',
    code: 'GURU123',
    name: 'Guru Pembina Kokurikuler Daur Ulang',
    role: 'teacher',
    createdAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'tc-01',
    code: 'GURU2026',
    name: 'Guru Pembina 2026',
    role: 'teacher',
    createdAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'tc-03',
    code: 'GURU7A',
    name: 'Wali Kelas / Pembina 7A',
    role: 'teacher',
    assignedClass: 'class-7a',
    createdAt: '2026-09-05T09:00:00Z',
  },
];
