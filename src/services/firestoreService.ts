import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ClassRoom, Student, TeacherCode } from '../types';
import {
  DEFAULT_CLASSES,
  DEFAULT_STUDENTS,
  DEFAULT_TEACHER_CODES,
} from '../data/defaultData';
import { recordQuotaUsage, calculateRealtimeStorageSize } from './quotaService';

const STUDENTS_COL = 'students';
const CLASSES_COL = 'classes';
const TEACHER_CODES_COL = 'teacher_codes';

/**
 * Initialize Firestore with default data if empty
 */
export async function initializeFirestoreIfNeeded(): Promise<boolean> {
  try {
    const classesSnap = await getDocs(collection(db, CLASSES_COL));
    recordQuotaUsage({ reads: classesSnap.size || 1 });
    if (!classesSnap.empty) {
      return false; // already seeded
    }

    const batch = writeBatch(db);

    // Seed default classes
    for (const c of DEFAULT_CLASSES) {
      const ref = doc(db, CLASSES_COL, c.id);
      batch.set(ref, c);
    }

    // Seed default teacher login codes
    for (const tc of DEFAULT_TEACHER_CODES) {
      const ref = doc(db, TEACHER_CODES_COL, tc.id);
      batch.set(ref, tc);
    }

    await batch.commit();
    recordQuotaUsage({
      writes: DEFAULT_CLASSES.length + DEFAULT_TEACHER_CODES.length,
      storageBytes: calculateRealtimeStorageSize(
        0,
        DEFAULT_CLASSES.length,
        DEFAULT_TEACHER_CODES.length
      ),
    });
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
          const data = docSnap.data() as Student;
          list.push({
            ...data,
            id: data.id || docSnap.id,
          });
        });
        recordQuotaUsage({ reads: snapshot.docChanges().length || snapshot.size });
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
        recordQuotaUsage({ reads: snapshot.docChanges().length || snapshot.size });
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
        recordQuotaUsage({ reads: snapshot.docChanges().length || snapshot.size });
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
  recordQuotaUsage({ writes: 1 });
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
      recordQuotaUsage({ deletes: 1 });
    } catch (_) {}
  }

  const standardizedStudent: Student = {
    ...student,
    id: targetDocId,
    nisn: cleanNisn,
  };

  const ref = doc(db, STUDENTS_COL, targetDocId);
  await setDoc(ref, cleanObject(standardizedStudent), { merge: true });
  recordQuotaUsage({ writes: 1 });
}

/**
 * Delete student from Firestore immediately
 */
export async function deleteStudentInDb(studentId: string) {
  if (!studentId) return;

  const targetDocIds = new Set<string>();
  targetDocIds.add(studentId);
  const clean = studentId.replace(/^std-/, '').replace(/[^a-zA-Z0-9]/g, '');
  if (clean) {
    targetDocIds.add(`std-${clean}`);
    targetDocIds.add(clean);
  }

  // Delete all direct candidate doc IDs
  for (const docId of targetDocIds) {
    try {
      await deleteDoc(doc(db, STUDENTS_COL, docId));
    } catch (_) {}
  }

  // Query and delete any document with matching NISN
  try {
    const q1 = query(collection(db, STUDENTS_COL), where('nisn', '==', clean || studentId));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      const b = writeBatch(db);
      snap1.docs.forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  } catch (_) {}

  recordQuotaUsage({ deletes: 1 });
}

/**
 * Delete multiple students in batch immediately from Firestore
 */
export async function batchDeleteStudentsInDb(studentIds: string[]): Promise<number> {
  if (!studentIds || studentIds.length === 0) return 0;
  
  const directDocIds = new Set<string>();
  const cleanNisns = new Set<string>();

  for (const rawId of studentIds) {
    if (rawId) {
      directDocIds.add(rawId);
      const clean = rawId.replace(/^std-/, '').replace(/[^a-zA-Z0-9]/g, '');
      if (clean) {
        directDocIds.add(`std-${clean}`);
        directDocIds.add(clean);
        cleanNisns.add(clean);
      }
    }
  }

  const docIdArray = Array.from(directDocIds);
  const chunkSize = 400;

  for (let i = 0; i < docIdArray.length; i += chunkSize) {
    const chunk = docIdArray.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, STUDENTS_COL, id));
    }
    await batch.commit();
  }

  // Also query if any remaining documents match the NISNs
  try {
    const allSnap = await getDocs(collection(db, STUDENTS_COL));
    if (!allSnap.empty) {
      const extraToDelete: any[] = [];
      allSnap.forEach((d) => {
        const data = d.data() as Student;
        const sNisn = (data.nisn || '').trim();
        const sClean = sNisn.replace(/[^a-zA-Z0-9]/g, '');
        if (directDocIds.has(d.id) || cleanNisns.has(sNisn) || cleanNisns.has(sClean)) {
          extraToDelete.push(d.ref);
        }
      });

      for (let i = 0; i < extraToDelete.length; i += chunkSize) {
        const chunk = extraToDelete.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((r) => batch.delete(r));
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn('batchDelete extra scan:', err);
  }

  recordQuotaUsage({ deletes: studentIds.length });
  return studentIds.length;
}

/**
 * Delete a class document from Firestore
 */
export async function deleteClassInDb(classId: string) {
  if (!classId) return;
  try {
    await deleteDoc(doc(db, CLASSES_COL, classId));
    recordQuotaUsage({ deletes: 1 });
  } catch (err) {
    console.warn('deleteClassInDb failed:', err);
  }
}

/**
 * Scan all class documents in Firestore and merge any duplicate classes (e.g. class-kelas7a and class-7a)
 */
export async function deduplicateClassesInDb(): Promise<{
  mergedClasses: number;
  removedClassDuplicates: number;
}> {
  const snap = await getDocs(collection(db, CLASSES_COL));
  if (snap.empty) return { mergedClasses: 0, removedClassDuplicates: 0 };

  const groups = new Map<string, { docId: string; data: ClassRoom }[]>();
  snap.forEach((d) => {
    const data = d.data() as ClassRoom;
    const rawName = (data.name || '').toLowerCase().replace(/^(kelas|class)\s*/i, '').replace(/[^a-z0-9]/g, '');
    const key = rawName || d.id.toLowerCase().replace(/^(class-|kelas-)/i, '').replace(/[^a-z0-9]/g, '');
    if (!key) return;
    const list = groups.get(key) || [];
    list.push({ docId: d.id, data });
    groups.set(key, list);
  });

  let removedClassDuplicates = 0;
  let mergedClasses = 0;
  const docsToDelete: string[] = [];
  const docsToUpsert: ClassRoom[] = [];

  for (const [key, list] of groups.entries()) {
    const standardId = `class-${key}`;
    const standardName = list[0].data.name.toLowerCase().startsWith('kelas ')
      ? list[0].data.name
      : `Kelas ${key.toUpperCase()}`;

    const canonicalClass: ClassRoom = {
      id: standardId,
      name: standardName,
      grade: list[0].data.grade || (key.match(/\d+/) ? key.match(/\d+/)![0] : '7'),
      homeroomTeacher: list.find((c) => c.data.homeroomTeacher)?.data.homeroomTeacher,
    };

    docsToUpsert.push(canonicalClass);

    for (const item of list) {
      if (item.docId !== standardId) {
        docsToDelete.push(item.docId);
        removedClassDuplicates++;
      }
    }
    if (list.length > 1) {
      mergedClasses++;
    }
  }

  if (docsToUpsert.length > 0) {
    const batch = writeBatch(db);
    for (const cls of docsToUpsert) {
      batch.set(doc(db, CLASSES_COL, cls.id), cleanObject(cls), { merge: true });
    }
    await batch.commit();
  }

  if (docsToDelete.length > 0) {
    const batch = writeBatch(db);
    for (const id of docsToDelete) {
      batch.delete(doc(db, CLASSES_COL, id));
    }
    await batch.commit();
  }

  return { mergedClasses, removedClassDuplicates };
}

/**
 * Remove classes that have zero enrolled students from Firestore
 */
export async function clearEmptyClassesInDb(activeClassNames: string[]): Promise<number> {
  const activeNormalized = new Set(
    activeClassNames.map((cn) => cn.toLowerCase().replace(/^(kelas|class)\s*/i, '').replace(/[^a-z0-9]/g, ''))
  );

  const snap = await getDocs(collection(db, CLASSES_COL));
  if (snap.empty) return 0;

  const toDelete: any[] = [];
  snap.forEach((d) => {
    const data = d.data() as ClassRoom;
    const nameKey = (data.name || '').toLowerCase().replace(/^(kelas|class)\s*/i, '').replace(/[^a-z0-9]/g, '');
    const idKey = d.id.toLowerCase().replace(/^(class-|kelas-)/i, '').replace(/[^a-z0-9]/g, '');
    if (!activeNormalized.has(nameKey) && !activeNormalized.has(idKey)) {
      toDelete.push(d.ref);
    }
  });

  if (toDelete.length > 0) {
    const batch = writeBatch(db);
    toDelete.forEach((r) => batch.delete(r));
    await batch.commit();
    recordQuotaUsage({ deletes: toDelete.length });
  }

  return toDelete.length;
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

  // Also clean up any duplicate classes or empty classes with 0 students
  try {
    await deduplicateClassesInDb();
    const activeClassNames = Array.from(groups.values()).map((list) => list[0].data.className).filter(Boolean);
    await clearEmptyClassesInDb(activeClassNames);
  } catch (_) {}

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
