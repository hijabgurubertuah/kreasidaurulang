import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ClassRoom, Student, TeacherCode } from '../types';
import {
  DEFAULT_CLASSES,
  DEFAULT_STUDENTS,
  DEFAULT_TEACHER_CODES,
} from '../data/defaultData';

const STUDENTS_COL = 'students';
const CLASSES_COL = 'classes';
const TEACHER_CODES_COL = 'teacher_codes';

/**
 * Initialize Firestore with default data if empty
 */
export async function initializeFirestoreIfNeeded(): Promise<boolean> {
  try {
    const studentsSnap = await getDocs(collection(db, STUDENTS_COL));
    if (!studentsSnap.empty) {
      return false; // already seeded
    }

    const batch = writeBatch(db);

    // Seed classes
    for (const c of DEFAULT_CLASSES) {
      const ref = doc(db, CLASSES_COL, c.id);
      batch.set(ref, c);
    }

    // Seed students
    for (const s of DEFAULT_STUDENTS) {
      const ref = doc(db, STUDENTS_COL, s.id);
      batch.set(ref, s);
    }

    // Seed teacher codes
    for (const tc of DEFAULT_TEACHER_CODES) {
      const ref = doc(db, TEACHER_CODES_COL, tc.id);
      batch.set(ref, tc);
    }

    await batch.commit();
    return true;
  } catch (error) {
    console.warn('Firestore initial seeding fallback or offline:', error);
    return false;
  }
}

/**
 * Real-time listener for students
 */
export function listenToStudents(
  onUpdate: (students: Student[]) => void,
  onError?: (err: Error) => void
) {
  try {
    return onSnapshot(
      collection(db, STUDENTS_COL),
      (snapshot) => {
        const list: Student[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Student);
        });
        onUpdate(list);
      },
      (error) => {
        console.warn('Student snapshot listener error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('listenToStudents failed, using local mode:', err);
    return () => {};
  }
}

/**
 * Real-time listener for classes
 */
export function listenToClasses(
  onUpdate: (classes: ClassRoom[]) => void,
  onError?: (err: Error) => void
) {
  try {
    return onSnapshot(
      collection(db, CLASSES_COL),
      (snapshot) => {
        const list: ClassRoom[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as ClassRoom);
        });
        onUpdate(list);
      },
      (error) => {
        console.warn('Classes snapshot listener error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('listenToClasses failed, using local mode:', err);
    return () => {};
  }
}

/**
 * Real-time listener for teacher access codes
 */
export function listenToTeacherCodes(
  onUpdate: (codes: TeacherCode[]) => void,
  onError?: (err: Error) => void
) {
  try {
    return onSnapshot(
      collection(db, TEACHER_CODES_COL),
      (snapshot) => {
        const list: TeacherCode[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as TeacherCode);
        });
        onUpdate(list);
      },
      (error) => {
        console.warn('Teacher codes snapshot listener error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('listenToTeacherCodes failed, using local mode:', err);
    return () => {};
  }
}

/**
 * Update single student score in Firestore
 */
export async function updateStudentScoreInDb(
  studentId: string,
  newScore: number,
  notes?: string
) {
  const studentRef = doc(db, STUDENTS_COL, studentId);
  const updatePayload: Partial<Student> = {
    score: newScore,
    lastUpdated: new Date().toISOString(),
  };
  if (notes !== undefined) {
    updatePayload.notes = notes;
  }
  await updateDoc(studentRef, updatePayload);
}

/**
 * Batch upload / synchronize imported students and classes from CSV
 */
export async function batchSyncStudentsAndClasses(
  students: Student[],
  classes: ClassRoom[]
) {
  // Firestore batches have limit of 500 operations
  const chunkSize = 400;
  for (let i = 0; i < students.length; i += chunkSize) {
    const chunk = students.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const student of chunk) {
      const ref = doc(db, STUDENTS_COL, student.id);
      batch.set(ref, student, { merge: true });
    }
    await batch.commit();
  }

  // Sync classes
  if (classes.length > 0) {
    const classBatch = writeBatch(db);
    for (const cls of classes) {
      const ref = doc(db, CLASSES_COL, cls.id);
      classBatch.set(ref, cls, { merge: true });
    }
    await classBatch.commit();
  }
}

/**
 * Add or update single student in Firestore
 */
export async function saveStudentInDb(student: Student) {
  const ref = doc(db, STUDENTS_COL, student.id);
  await setDoc(ref, student, { merge: true });
}

/**
 * Delete student from Firestore
 */
export async function deleteStudentInDb(studentId: string) {
  const ref = doc(db, STUDENTS_COL, studentId);
  await deleteDoc(ref);
}

/**
 * Add new teacher access code
 */
export async function createTeacherCodeInDb(teacherCode: TeacherCode) {
  const ref = doc(db, TEACHER_CODES_COL, teacherCode.id);
  await setDoc(ref, teacherCode);
}

/**
 * Delete teacher access code
 */
export async function deleteTeacherCodeInDb(codeId: string) {
  const ref = doc(db, TEACHER_CODES_COL, codeId);
  await deleteDoc(ref);
}

const SETTINGS_COL = 'app_settings';
const SPREADSHEET_DOC = 'spreadsheet_config';

/**
 * Save Google Sheets URL in Firestore
 */
export async function saveSpreadsheetUrlInDb(url: string) {
  try {
    const ref = doc(db, SETTINGS_COL, SPREADSHEET_DOC);
    await setDoc(ref, { url, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Failed to save spreadsheet URL to Firestore:', err);
  }
}

/**
 * Get Google Sheets URL from Firestore
 */
export async function getSpreadsheetUrlFromDb(): Promise<string> {
  try {
    const { getDoc } = await import('firebase/firestore');
    const ref = doc(db, SETTINGS_COL, SPREADSHEET_DOC);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data()?.url || '';
    }
  } catch (err) {
    console.warn('Failed to get spreadsheet URL from Firestore:', err);
  }
  return '';
}
