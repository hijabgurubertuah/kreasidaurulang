import { ClassRoom, Student } from '../types';
import { DEFAULT_CLASSES, DEFAULT_STUDENTS } from '../data/defaultData';

export const CLASSES_STORAGE_KEY = 'smpn1bks_classes_cache';
export const STUDENTS_STORAGE_KEY = 'smpn1bks_students_cache';

/**
 * Standardize class name into "Kelas X" format (e.g. "7A" -> "Kelas 7A", "kelas 7b" -> "Kelas 7B")
 */
export function formatStandardClassName(rawName: string): string {
  if (!rawName) return '';
  const clean = rawName.trim();
  const withoutPrefix = clean.replace(/^(kelas|class)\s*/i, '').trim();
  if (!withoutPrefix) return clean;
  return `Kelas ${withoutPrefix.toUpperCase()}`;
}

/**
 * Generate standard class ID from class name (e.g. "Kelas 7A" -> "class-7a")
 */
export function getClassIdFromName(name: string): string {
  const clean = (name || '').toLowerCase().replace(/^(kelas|class)\s*/i, '').replace(/[^a-z0-9]/g, '');
  return clean ? `class-${clean}` : '';
}

/**
 * Test whether a student belongs to a given classroom, supporting both classId and className variations
 */
export function matchStudentToClass(student: Student, classroom: ClassRoom): boolean {
  if (!student || !classroom) return false;
  const cIdStr = (classroom.id || '').trim().toLowerCase();
  const cNameStr = (classroom.name || '').trim().toLowerCase();
  const cCleanName = cNameStr.replace(/^(kelas|class)\s*/i, '').trim();

  const sClassId = (student.classId || '').trim().toLowerCase();
  const sClassName = (student.className || '').trim().toLowerCase();
  const sCleanName = sClassName.replace(/^(kelas|class)\s*/i, '').trim();

  return (
    sClassId === cIdStr ||
    sClassName === cNameStr ||
    (sCleanName && sCleanName === cCleanName) ||
    sClassId === `class-${cCleanName}` ||
    cIdStr === `class-${sCleanName}`
  );
}

/**
 * Consolidate all classes strictly from imported student list and database.
 * No dummy classes or demo data.
 */
export function consolidateClasses(dbClasses: ClassRoom[], studentList: Student[]): ClassRoom[] {
  const classMap = new Map<string, ClassRoom>();

  // 1. Extract classes strictly from imported studentList
  if (Array.isArray(studentList)) {
    for (const st of studentList) {
      if (!st) continue;
      const rawCls = (st.className || '').trim();
      if (rawCls) {
        const key = rawCls.toLowerCase().replace(/^(kelas|class)\s*/i, '').replace(/[^a-z0-9]/g, '');
        if (key && !classMap.has(key)) {
          const stdName = formatStandardClassName(rawCls);
          classMap.set(key, {
            id: st.classId || `class-${key}`,
            name: stdName,
            grade: stdName.match(/\d+/)?.[0] || '7',
          });
        }
      }
    }
  }

  // 2. Add / merge homeroom teacher info from dbClasses if matching an active imported class
  if (Array.isArray(dbClasses)) {
    for (const c of dbClasses) {
      if (!c || !c.name) continue;
      const key = (c.name || '').toLowerCase().replace(/^(kelas|class)\s*/i, '').replace(/[^a-z0-9]/g, '');
      if (key) {
        const existing = classMap.get(key);
        if (existing) {
          classMap.set(key, {
            ...existing,
            id: c.id || existing.id,
            name: formatStandardClassName(c.name) || existing.name,
            grade: c.grade || existing.grade,
            homeroomTeacher: c.homeroomTeacher || existing.homeroomTeacher,
          });
        } else if (c.studentCount && c.studentCount > 0) {
          classMap.set(key, {
            id: c.id || `class-${key}`,
            name: formatStandardClassName(c.name),
            grade: c.grade || key.match(/\d+/)?.[0] || '7',
            homeroomTeacher: c.homeroomTeacher,
          });
        }
      }
    }
  }

  // 3. Calculate accurate studentCount and averageScore
  const result: ClassRoom[] = Array.from(classMap.values()).map((cls) => {
    const classStudents = (studentList || []).filter((s) => matchStudentToClass(s, cls));
    const studentCount = classStudents.length;
    const totalScore = classStudents.reduce((sum, s) => sum + (typeof s.score === 'number' ? s.score : 80), 0);
    const avgScore = studentCount > 0 ? Math.round(totalScore / studentCount) : 80;

    return {
      ...cls,
      studentCount,
      averageScore: avgScore,
    };
  });

  // 4. Sort naturally
  return result.sort((a, b) => {
    return (a.name || '').localeCompare(b.name || '', 'id', { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Load classes from localStorage cache
 */
export function loadClassesFromLocal(): ClassRoom[] {
  try {
    const raw = localStorage.getItem(CLASSES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load classes from local cache:', err);
  }
  return [];
}

/**
 * Save classes to localStorage cache
 */
export function saveClassesToLocal(classes: ClassRoom[]): void {
  try {
    if (Array.isArray(classes)) {
      localStorage.setItem(CLASSES_STORAGE_KEY, JSON.stringify(classes));
    }
  } catch (err) {
    console.warn('Failed to save classes to local cache:', err);
  }
}

/**
 * Load students from localStorage cache
 */
export function loadStudentsFromLocal(): Student[] {
  try {
    const raw = localStorage.getItem(STUDENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load students from local cache:', err);
  }
  return DEFAULT_STUDENTS;
}

/**
 * Save students to localStorage cache
 */
export function saveStudentsToLocal(students: Student[]): void {
  try {
    if (Array.isArray(students)) {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
    }
  } catch (err) {
    console.warn('Failed to save students to local cache:', err);
  }
}
