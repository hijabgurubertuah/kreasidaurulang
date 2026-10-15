import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { GoogleDriveFile, GoogleSpreadsheetSummary, Student, MeetingSchedule, StudentModuleProgress } from '../types';

// In-memory token cache (MANDATORY: Never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Provider setup with Google Drive and Sheets scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Initialize Firebase Auth listener for Google Workspace session.
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (!user) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Trigger Google Sign In popup to acquire OAuth access token with Drive & Sheets scopes.
 */
export const signInWithGoogleWorkspace = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token Google Workspace.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Workspace sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current in-memory access token.
 */
export const getGoogleAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sign out Google Workspace session and clear memory token.
 */
export const logoutGoogleWorkspace = async (): Promise<void> => {
  try {
    await signOut(auth);
  } finally {
    cachedAccessToken = null;
  }
};

/**
 * Check if currently authenticated with Google Workspace.
 */
export const isGoogleAuthenticated = (): boolean => {
  return !!(auth.currentUser && cachedAccessToken);
};

// ==========================================
// GOOGLE DRIVE API METHODS
// ==========================================

export interface ListFilesOptions {
  query?: string;
  mimeTypeFilter?: 'all' | 'spreadsheets' | 'folders' | 'documents';
  pageSize?: number;
  pageToken?: string;
}

/**
 * List files from Google Drive with optional search and type filtering.
 */
export const listGoogleDriveFiles = async (
  options: ListFilesOptions = {}
): Promise<{ files: GoogleDriveFile[]; nextPageToken?: string }> => {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('Silakan login ke Google Workspace terlebih dahulu.');

  const { query = '', mimeTypeFilter = 'all', pageSize = 30, pageToken } = options;

  const queryParts: string[] = ['trashed = false'];

  if (mimeTypeFilter === 'spreadsheets') {
    queryParts.push("mimeType = 'application/vnd.google-apps.spreadsheet'");
  } else if (mimeTypeFilter === 'folders') {
    queryParts.push("mimeType = 'application/vnd.google-apps.folder'");
  } else if (mimeTypeFilter === 'documents') {
    queryParts.push("(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/pdf')");
  }

  if (query.trim()) {
    const escaped = query.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  const q = queryParts.join(' and ');
  const fields = 'nextPageToken, files(id, name, mimeType, webViewLink, webContentLink, iconLink, thumbnailLink, createdTime, modifiedTime, size, owners, shared)';

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('pageSize', pageSize.toString());
  url.searchParams.set('fields', fields);
  url.searchParams.set('orderBy', 'modifiedTime desc');
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal mengambil data Google Drive (${res.status})`);
  }

  const data = await res.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
};

/**
 * Create a new folder in Google Drive.
 */
export const createGoogleDriveFolder = async (folderName: string, parentId?: string): Promise<GoogleDriveFile> => {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('Silakan login ke Google Workspace terlebih dahulu.');

  const body: Record<string, any> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    body.parents = [parentId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal membuat folder di Google Drive');
  }

  return await res.json();
};

/**
 * Permanently delete or trash a file in Google Drive.
 * (Note: Caller MUST require explicit user confirmation before executing).
 */
export const deleteGoogleDriveFile = async (fileId: string): Promise<void> => {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('Silakan login ke Google Workspace terlebih dahulu.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal menghapus file dari Google Drive');
  }
};

// ==========================================
// GOOGLE SHEETS API METHODS
// ==========================================

export interface CreateSpreadsheetParams {
  title: string;
  sheetTitle?: string;
  headers?: string[];
  rows?: (string | number)[][];
  parentFolderId?: string;
}

/**
 * Create a new Google Spreadsheet with optional initial sheet data.
 */
export const createGoogleSpreadsheet = async (
  params: CreateSpreadsheetParams
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('Silakan login ke Google Workspace terlebih dahulu.');

  const requestBody: any = {
    properties: {
      title: params.title,
    },
  };

  if (params.sheetTitle) {
    requestBody.sheets = [
      {
        properties: {
          title: params.sheetTitle,
        },
      },
    ];
  }

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal membuat Google Spreadsheet baru');
  }

  const spreadsheet = await res.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const spreadsheetUrl = spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Move to parent folder if specified
  if (params.parentFolderId) {
    try {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${params.parentFolderId}&fields=id,parents`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (e) {
      console.warn('Gagal memindahkan file ke folder:', e);
    }
  }

  // If headers and rows provided, insert data into the sheet
  if (params.headers || (params.rows && params.rows.length > 0)) {
    const allValues: (string | number)[][] = [];
    if (params.headers) {
      allValues.push(params.headers);
    }
    if (params.rows && params.rows.length > 0) {
      allValues.push(...params.rows);
    }

    const targetSheet = params.sheetTitle ? `'${params.sheetTitle}'!A1` : 'A1';
    await updateGoogleSpreadsheetValues(spreadsheetId, targetSheet, allValues);
  }

  return { spreadsheetId, spreadsheetUrl };
};

/**
 * Read metadata (sheet names, etc.) of a Google Spreadsheet.
 */
export const getGoogleSpreadsheetMetadata = async (
  spreadsheetId: string
): Promise<GoogleSpreadsheetSummary> => {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('Silakan login ke Google Workspace terlebih dahulu.');

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets.properties`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal memuat metadata spreadsheet');
  }

  const data = await res.json();
  const sheets = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
    rowCount: s.properties.gridProperties?.rowCount,
    columnCount: s.properties.gridProperties?.columnCount,
  }));

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Spreadsheet',
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheets,
  };
};

/**
 * Read range values from a Google Spreadsheet.
 */
export const readGoogleSpreadsheetValues = async (
  spreadsheetId: string,
  range: string
): Promise<(string | number)[][]> => {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('Silakan login ke Google Workspace terlebih dahulu.');

  const encodedRange = encodeURIComponent(range);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal membaca isi sel Google Sheets');
  }

  const data = await res.json();
  return data.values || [];
};

/**
 * Write / update cell values in Google Spreadsheet.
 */
export const updateGoogleSpreadsheetValues = async (
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
): Promise<void> => {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('Silakan login ke Google Workspace terlebih dahulu.');

  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal menyimpan data ke Google Sheets');
  }
};

/**
 * Append cell values to the end of a sheet in Google Spreadsheet.
 */
export const appendGoogleSpreadsheetValues = async (
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
): Promise<void> => {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error('Silakan login ke Google Workspace terlebih dahulu.');

  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal menambahkan baris ke Google Sheets');
  }
};

// ==========================================
// HIGH LEVEL SCHOOL EXPORT & SYNC WORKFLOWS
// ==========================================

/**
 * Export Attitude Scores (Penilaian Sikap) directly to Google Sheets with detailed meeting columns.
 */
export const exportAttitudeScoresToGoogleSheets = async (params: {
  title?: string;
  className?: string;
  students: Student[];
  schedules?: MeetingSchedule[];
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const docTitle =
    params.title ||
    `Rekap Penilaian Sikap ${params.className ? `Kelas ${params.className}` : 'Semua Kelas'} - ${dateStr}`;

  // Headers: No, NISN, Nama Siswa, Kelas, Judul Proyek, Pertemuan 1..20, Nilai Akhir, Predikat, Catatan
  const headers = [
    'No',
    'NISN',
    'Nama Siswa',
    'Kelas',
    'Judul Proyek',
    ...Array.from({ length: 20 }, (_, i) => `P${i + 1}`),
    'Nilai Rata-rata / Akhir',
    'Predikat',
    'Catatan Guru',
  ];

  const getPredicate = (score: number) => {
    if (score >= 90) return 'Sangat Baik (A)';
    if (score >= 80) return 'Baik (B)';
    if (score >= 70) return 'Cukup (C)';
    return 'Perlu Bimbingan (D)';
  };

  const rows = params.students.map((st, idx) => {
    // 20 meeting scores
    const meetingCols = Array.from({ length: 20 }, (_, i) => {
      const isAbsent = st.meetingAbsences?.[i];
      if (isAbsent) return 'Tidak Hadir';
      const score = st.meetingScores?.[i];
      return score !== null && score !== undefined ? score : '-';
    });

    return [
      idx + 1,
      `'${st.nisn}`, // Keep leading zeroes
      st.name,
      st.className || '-',
      st.projectTitle || '-',
      ...meetingCols,
      st.score ?? 80,
      getPredicate(st.score ?? 80),
      st.notes || '-',
    ];
  });

  return await createGoogleSpreadsheet({
    title: docTitle,
    sheetTitle: 'Rekap Nilai Sikap',
    headers,
    rows,
  });
};

/**
 * Export Module Quiz Results (Rekap Nilai Kuis Modul) to Google Sheets.
 */
export const exportQuizResultsToGoogleSheets = async (params: {
  title?: string;
  progressList: StudentModuleProgress[];
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const docTitle = params.title || `Rekap Nilai Kuis Modul Siswa - ${dateStr}`;

  const headers = [
    'No',
    'NISN',
    'Nama Siswa',
    'Kelas',
    'Judul Modul',
    'Nilai Kuis Terbaru',
    'Nilai Kuis Tertinggi',
    'Jawaban Benar',
    'Total Soal',
    'Status Modul',
    'Waktu Pengerjaan Terakhir',
  ];

  const rows = params.progressList.map((p, idx) => [
    idx + 1,
    `'${p.studentNisn}`,
    p.studentName,
    p.studentClass || '-',
    p.moduleTitle || '-',
    p.quizScore ?? '-',
    p.highestQuizScore ?? '-',
    p.quizCorrectCount ?? '-',
    p.quizTotalCount ?? '-',
    p.isCompleted ? 'Selesai' : 'Sedang Dikerjakan',
    p.lastQuizAttemptAt ? new Date(p.lastQuizAttemptAt).toLocaleString('id-ID') : '-',
  ]);

  return await createGoogleSpreadsheet({
    title: docTitle,
    sheetTitle: 'Rekap Kuis Modul',
    headers,
    rows,
  });
};

/**
 * Export Students Roster to Google Sheets.
 */
export const exportStudentRosterToGoogleSheets = async (params: {
  title?: string;
  className?: string;
  students: Student[];
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const docTitle =
    params.title ||
    `Daftar Siswa ${params.className ? `Kelas ${params.className}` : 'SMPN 1'} - ${dateStr}`;

  const headers = ['No', 'NISN', 'Nama Siswa', 'Kelas', 'Judul Proyek Kreasi Daur Ulang'];

  const rows = params.students.map((st, idx) => [
    idx + 1,
    `'${st.nisn}`,
    st.name,
    st.className || '-',
    st.projectTitle || '-',
  ]);

  return await createGoogleSpreadsheet({
    title: docTitle,
    sheetTitle: 'Data Siswa',
    headers,
    rows,
  });
};
