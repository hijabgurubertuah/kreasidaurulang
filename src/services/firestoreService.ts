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
 * Helper to strip undefined fields so Firestore doesn't reject writes
 */
function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Generate standard Firestore document ID from NISN
 */
export function getStudentDocId(nisn: string): string {
  const clean = nisn.trim().replace(/[^a-zA-Z0-9]/g, '');
  return `std-${clean}`;
}

/**
 * Batch upload / synchronize imported students and classes from CSV.
 * Deduplicates by NISN: if a student with the same NISN already exists,
 * it UPDATES that student instead of creating a duplicate document.
 */
export async function batchSyncStudentsAndClasses(
  incomingStudents: Student[],
  incomingClasses: ClassRoom[]
) {
  // 1. Fetch existing students in Firestore to check for matching NISNs
  const existingSnap = await getDocs(collection(db, STUDENTS_COL));
  const existingByNisn = new Map<string, { docId: string; data: Student }>();
  existingSnap.forEach((d) => {
    const data = d.data() as Student;
    if (data.nisn) {
      existingByNisn.set(data.nisn.trim().toLowerCase(), { docId: d.id, data });
    }
  });

  // 2. Deduplicate incoming students by NISN
  const deduplicatedIncoming = new Map<string, Student>();
  for (const st of incomingStudents) {
    const key = st.nisn.trim().toLowerCase();
    const existing = deduplicatedIncoming.get(key);
    if (!existing) {
      deduplicatedIncoming.set(key, st);
    } else {
      // Merge / update existing entry with latest row
      deduplicatedIncoming.set(key, {
        ...existing,
        ...st,
        score: st.score !== 80 ? st.score : existing.score,
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  const finalStudentsList: Student[] = [];
  const oldDocIdsToDelete: string[] = [];

  for (const [key, inc] of deduplicatedIncoming.entries()) {
    const cleanNisn = inc.nisn.trim();
    const targetDocId = getStudentDocId(cleanNisn);
    const existingInDb = existingByNisn.get(key);

    let mergedStudent: Student;
    if (existingInDb) {
      // If the existing doc has an older non-standard ID, mark for deletion to avoid duplicates
      if (existingInDb.docId !== targetDocId) {
        oldDocIdsToDelete.push(existingInDb.docId);
      }
      mergedStudent = {
        ...existingInDb.data,
        ...inc,
        id: targetDocId,
        nisn: cleanNisn,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      mergedStudent = {
        ...inc,
        id: targetDocId,
        nisn: cleanNisn,
        lastUpdated: new Date().toISOString(),
      };
    }
    finalStudentsList.push(mergedStudent);
  }

  // 3. Batch delete any old duplicate docs with non-standard IDs
  if (oldDocIdsToDelete.length > 0) {
    const deleteBatch = writeBatch(db);
    for (const oldId of oldDocIdsToDelete) {
      deleteBatch.delete(doc(db, STUDENTS_COL, oldId));
    }
    await deleteBatch.commit();
  }

  // 4. Batch upsert the clean students (400 items per chunk)
  const chunkSize = 400;
  for (let i = 0; i < finalStudentsList.length; i += chunkSize) {
    const chunk = finalStudentsList.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const student of chunk) {
      const ref = doc(db, STUDENTS_COL, student.id);
      batch.set(ref, cleanObject(student), { merge: true });
    }
    await batch.commit();
  }

  // 5. Sync classes
  if (incomingClasses.length > 0) {
    const classBatch = writeBatch(db);
    for (const cls of incomingClasses) {
      const ref = doc(db, CLASSES_COL, cls.id);
      classBatch.set(ref, cleanObject(cls), { merge: true });
    }
    await classBatch.commit();
  }
}

/**
 * Commit all staged student changes (upserts and deletes) in a single batch write to save Firestore write quota.
 * This ensures writes are only made when user clicks "Simpan ke Firebase".
 */
export async function commitStagedChangesToDb({
  upsertStudents = [],
  deletedStudentIds = [],
  classes = [],
}: {
  upsertStudents?: Student[];
  deletedStudentIds?: string[];
  classes?: ClassRoom[];
}): Promise<{ writesCount: number }> {
  type Op =
    | { type: 'delete'; col: string; id: string }
    | { type: 'set'; col: string; id: string; data: any };

  const opMap = new Map<string, Op>();

  // 1. Delete staged student docs
  for (const rawId of deletedStudentIds) {
    if (rawId) {
      opMap.set(`${STUDENTS_COL}/${rawId}`, { type: 'delete', col: STUDENTS_COL, id: rawId });
      // Also ensure standard NISN doc ID is deleted if student id had a prefix or vice versa
      const clean = rawId.replace(/^std-/, '').replace(/[^a-zA-Z0-9]/g, '');
      if (clean && `std-${clean}` !== rawId) {
        const stdId = `std-${clean}`;
        opMap.set(`${STUDENTS_COL}/${stdId}`, { type: 'delete', col: STUDENTS_COL, id: stdId });
      }
    }
  }

  // 2. Set/merge staged student docs (overrides delete if re-added)
  for (const student of upsertStudents) {
    const cleanNisn = student.nisn.trim();
    const standardId = getStudentDocId(cleanNisn);
    const standardized: Student = {
      ...student,
      id: standardId,
      nisn: cleanNisn,
      lastUpdated: new Date().toISOString(),
    };
    opMap.set(`${STUDENTS_COL}/${standardId}`, {
      type: 'set',
      col: STUDENTS_COL,
      id: standardId,
      data: cleanObject(standardized),
    });
  }

  // 3. Classes updates if any
  for (const cls of classes) {
    opMap.set(`${CLASSES_COL}/${cls.id}`, {
      type: 'set',
      col: CLASSES_COL,
      id: cls.id,
      data: cleanObject(cls),
    });
  }

  const ops = Array.from(opMap.values());

  if (ops.length === 0) {
    return { writesCount: 0 };
  }

  // Write in chunks of 400 (under Firestore's 500 limit)
  const chunkSize = 400;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const chunk = ops.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'delete') {
        batch.delete(doc(db, op.col, op.id));
      } else {
        batch.set(doc(db, op.col, op.id), op.data, { merge: true });
      }
    }
    await batch.commit();
  }

  return { writesCount: ops.length };
}

/**
 * Add or update single student in Firestore.
 * Always keys document ID to NISN to ensure no duplicate documents exist.
 */
export async function saveStudentInDb(student: Student) {
  const cleanNisn = student.nisn.trim();
  const targetDocId = getStudentDocId(cleanNisn);

  // If student had a different previous ID, delete the old document to prevent duplicates
  if (student.id && student.id !== targetDocId) {
    try {
      await deleteDoc(doc(db, STUDENTS_COL, student.id));
    } catch (_) {}
  }

  const standardizedStudent: Student = {
    ...student,
    id: targetDocId,
    nisn: cleanNisn,
  };

  const ref = doc(db, STUDENTS_COL, targetDocId);
  await setDoc(ref, cleanObject(standardizedStudent), { merge: true });
}

/**
 * Delete student from Firestore
 */
export async function deleteStudentInDb(studentId: string) {
  const ref = doc(db, STUDENTS_COL, studentId);
  await deleteDoc(ref);
}

/**
 * Scan all student documents in Firestore and merge any duplicate NISNs
 */
export async function deduplicateStudentsInDb(): Promise<{
  mergedCount: number;
  removedDuplicates: number;
  totalUnique: number;
}> {
  const snap = await getDocs(collection(db, STUDENTS_COL));
  if (snap.empty) {
    return { mergedCount: 0, removedDuplicates: 0, totalUnique: 0 };
  }

  // Group docs by lowercase trimmed NISN
  const groups = new Map<string, { docId: string; data: Student }[]>();
  snap.forEach((d) => {
    const data = d.data() as Student;
    const nisnKey = (data.nisn || '').trim().toLowerCase();
    if (!nisnKey) return;
    const list = groups.get(nisnKey) || [];
    list.push({ docId: d.id, data });
    groups.set(nisnKey, list);
  });

  let mergedCount = 0;
  let removedDuplicates = 0;
  const docsToDelete: string[] = [];
  const docsToUpdate: Student[] = [];

  for (const [key, docsList] of groups.entries()) {
    const cleanNisn = docsList[0].data.nisn.trim();
    const targetDocId = getStudentDocId(cleanNisn);

    if (docsList.length > 1) {
      mergedCount++;
      // Pick best document (highest score or latest update)
      const sorted = [...docsList].sort((a, b) => {
        const timeA = new Date(a.data.lastUpdated || 0).getTime();
        const timeB = new Date(b.data.lastUpdated || 0).getTime();
        return timeB - timeA;
      });

      const best = sorted[0].data;
      docsToUpdate.push({
        ...best,
        id: targetDocId,
        nisn: cleanNisn,
      });

      // Mark other duplicates for deletion
      for (const item of docsList) {
        if (item.docId !== targetDocId) {
          docsToDelete.push(item.docId);
          removedDuplicates++;
        }
      }
    } else {
      // Only 1 doc, but make sure document ID is standard
      const item = docsList[0];
      if (item.docId !== targetDocId) {
        docsToDelete.push(item.docId);
        docsToUpdate.push({
          ...item.data,
          id: targetDocId,
          nisn: cleanNisn,
        });
      }
    }
  }

  // Commit updates and deletes
  if (docsToUpdate.length > 0) {
    const batch = writeBatch(db);
    for (const st of docsToUpdate) {
      batch.set(doc(db, STUDENTS_COL, st.id), cleanObject(st), { merge: true });
    }
    await batch.commit();
  }

  if (docsToDelete.length > 0) {
    const batch = writeBatch(db);
    for (const id of docsToDelete) {
      batch.delete(doc(db, STUDENTS_COL, id));
    }
    await batch.commit();
  }

  return {
    mergedCount,
    removedDuplicates,
    totalUnique: groups.size,
  };
}

/**
 * Clear all student records in Firestore (Empty student database)
 */
export async function clearAllStudentsInDb(): Promise<number> {
  const snap = await getDocs(collection(db, STUDENTS_COL));
  if (snap.empty) return 0;

  const docs = snap.docs;
  const chunkSize = 400;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = writeBatch(db);
    docs.slice(i, i + chunkSize).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

/**
 * Clear custom teacher codes in Firestore (Keeps ADMIN123 and GURU123)
 */
export async function clearAllTeacherCodesInDb(): Promise<number> {
  const snap = await getDocs(collection(db, TEACHER_CODES_COL));
  if (snap.empty) return 0;

  const toDelete = snap.docs.filter((d) => {
    const data = d.data() as TeacherCode;
    const code = (data.code || '').toUpperCase();
    return code !== 'ADMIN123' && code !== 'GURU123';
  });

  if (toDelete.length === 0) return 0;

  const chunkSize = 400;
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + chunkSize).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return toDelete.length;
}

/**
 * Reset entire database to clean default dataset
 */
export async function resetDatabaseToDefaultsInDb(): Promise<void> {
  // 1. Clear students
  await clearAllStudentsInDb();

  // 2. Clear classes
  const classSnap = await getDocs(collection(db, CLASSES_COL));
  if (!classSnap.empty) {
    const batch = writeBatch(db);
    classSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // 3. Clear custom teacher codes
  await clearAllTeacherCodesInDb();

  // 4. Seed clean defaults
  const seedBatch = writeBatch(db);
  for (const c of DEFAULT_CLASSES) {
    seedBatch.set(doc(db, CLASSES_COL, c.id), cleanObject(c));
  }
  for (const s of DEFAULT_STUDENTS) {
    const standardId = getStudentDocId(s.nisn);
    seedBatch.set(doc(db, STUDENTS_COL, standardId), cleanObject({ ...s, id: standardId }));
  }
  for (const tc of DEFAULT_TEACHER_CODES) {
    seedBatch.set(doc(db, TEACHER_CODES_COL, tc.id), cleanObject(tc));
  }
  await seedBatch.commit();
}

/**
 * Add new teacher access code
 */
export async function createTeacherCodeInDb(teacherCode: TeacherCode) {
  const ref = doc(db, TEACHER_CODES_COL, teacherCode.id);
  await setDoc(ref, cleanObject(teacherCode), { merge: true });
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
