import * as XLSX from 'xlsx';
import { ClassRoom, Student } from '../types';

export function getPredicate(score: number): { text: string; code: string; color: string } {
  if (score >= 100) return { text: 'Sempurna', code: 'A+', color: 'gold' };
  if (score >= 90) return { text: 'Sangat baik', code: 'A', color: 'silver' };
  if (score >= 80) return { text: 'Baik', code: 'B', color: 'green' };
  if (score >= 70) return { text: 'Kurang', code: 'C', color: 'yellow' };
  if (score >= 60) return { text: 'Sangat kurang', code: 'D', color: 'purple' };
  return { text: 'Buruk', code: 'E', color: 'red' };
}

/**
 * Export single class to Excel (.xlsx)
 */
export function exportClassToExcel(
  classroom: ClassRoom,
  students: Student[]
) {
  const classStudents = students.filter((s) => s.classId === classroom.id);

  const rows = classStudents.map((s, index) => {
    const pred = getPredicate(s.score);
    return {
      'No': index + 1,
      'NISN': s.nisn,
      'Nama Siswa': s.name,
      'Kelas': s.className || classroom.name,
      'Nilai Sikap (0-100)': s.score,
      'Predikat': pred.text,
      'Judul Kreasi Daur Ulang': s.projectTitle || 'Kreasi Daur Ulang Mandiri',
      'Catatan Sikap Siswa': s.notes || 'Aktif mengikuti kegiatan',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 15 }, // NISN
    { wch: 30 }, // Nama Siswa
    { wch: 12 }, // Kelas
    { wch: 20 }, // Nilai
    { wch: 20 }, // Predikat
    { wch: 35 }, // Proyek
    { wch: 45 }, // Catatan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, classroom.name);

  // Generate file name
  const safeClassName = classroom.name.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Nilai_Kokurikuler_Daur_Ulang_${safeClassName}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

/**
 * Export all classes to Excel workbook with multiple sheets + summary
 */
export function exportAllClassesToExcel(
  classes: ClassRoom[],
  students: Student[]
) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = classes.map((c, index) => {
    const classStudents = students.filter((s) => s.classId === c.id);
    const avgScore =
      classStudents.length > 0
        ? Math.round(
            classStudents.reduce((acc, curr) => acc + curr.score, 0) /
              classStudents.length
          )
        : 0;

    const highestScore =
      classStudents.length > 0
        ? Math.max(...classStudents.map((s) => s.score))
        : 0;

    const lowestScore =
      classStudents.length > 0
        ? Math.min(...classStudents.map((s) => s.score))
        : 0;

    return {
      'No': index + 1,
      'Nama Kelas': c.name,
      'Wali Kelas/Pembina': c.homeroomTeacher || '-',
      'Jumlah Siswa': classStudents.length,
      'Rata-rata Nilai Sikap': avgScore,
      'Nilai Tertinggi': highestScore,
      'Nilai Terendah': lowestScore,
      'Predikat Rata-rata': getPredicate(avgScore).text,
    };
  });

  const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows);
  summaryWorksheet['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 25 },
    { wch: 15 },
    { wch: 22 },
    { wch: 15 },
    { wch: 15 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'REKAP_SEMUA_KELAS');

  // Sheet for each class
  classes.forEach((c) => {
    const classStudents = students.filter((s) => s.classId === c.id);
    const rows = classStudents.map((s, index) => {
      const pred = getPredicate(s.score);
      return {
        'No': index + 1,
        'NISN': s.nisn,
        'Nama Siswa': s.name,
        'Kelas': s.className || c.name,
        'Nilai Sikap': s.score,
        'Predikat': pred.text,
        'Judul Kreasi Daur Ulang': s.projectTitle || 'Kreasi Daur Ulang',
        'Catatan Sikap Siswa': s.notes || '-',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 15 },
      { wch: 20 },
      { wch: 35 },
      { wch: 40 },
    ];
    // sheet name max 31 chars
    const sheetName = c.name.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Rekap_Lengkap_Nilai_Kokurikuler_Daur_Ulang_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Download sample CSV template for teachers to fill in Google Sheets / Excel
 */
export function downloadSampleCsvTemplate() {
  const headers = ['nisn', 'nama', 'kelas', 'nilai_sikap', 'judul_kreasi', 'catatan'];
  const sampleRows = [
    ['0081234001', 'Aditya Pratama Putra', 'Kelas 7A', '80', 'Pot Gantung Tanaman dari Botol Bekas', 'Aktif dan disiplin'],
    ['0081234002', 'Aisyah Nur Salsabila', 'Kelas 7A', '90', 'Tempat Pensil Meja dari Tutup Botol', 'Kreatif memilah sampah'],
    ['0082345001', 'Hafiz Al-Fikri', 'Kelas 7B', '80', 'Kotak Tisu Estetik dari Gulungan Koran', 'Kerjasama tim baik'],
    ['0073456001', 'Oki Kurniawan', 'Kelas 8A', '80', 'Lampu Tidur Artistik Kaleng Biskuit', 'Sangat tekun dan rapi'],
  ];

  const csvContent = [
    headers.join(','),
    ...sampleRows.map((r) => r.map((field) => `"${field}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'template_siswa_kreasi_daur_ulang.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
