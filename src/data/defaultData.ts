import { ClassRoom, Student, TeacherCode, EvaluationCriteriaConfig, LearningModule } from '../types';

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

export const DEFAULT_EVALUATION_CRITERIA: EvaluationCriteriaConfig = {
  positiveCriteria: [
    {
      id: 'crit-pos-1',
      type: 'plus',
      title: 'Membawa bahan/sampah daur ulang dari rumah secara lengkap & tepat waktu',
      points: 10,
    },
    {
      id: 'crit-pos-2',
      type: 'plus',
      title: 'Aktif berpartisipasi, bergotong-royong, dan kompak dalam kerja kelompok',
      points: 10,
    },
    {
      id: 'crit-pos-3',
      type: 'plus',
      title: 'Menghasilkan karya kreasi daur ulang yang rapi, fungsional, dan estetis',
      points: 10,
    },
    {
      id: 'crit-pos-4',
      type: 'plus',
      title: 'Menjaga kebersihan meja kerja dan memilah sisa sampah ke wadah yang benar',
      points: 10,
    },
    {
      id: 'crit-pos-5',
      type: 'plus',
      title: 'Menunjukkan ide kreatif/inovasi orisinal dalam pemanfaatan bahan bekas',
      points: 10,
    },
    {
      id: 'crit-pos-6',
      type: 'plus',
      title: 'Membantu rekan kelompok yang mengalami kesulitan dalam pengerjaan modul',
      points: 10,
    },
  ],
  negativeCriteria: [
    {
      id: 'crit-neg-1',
      type: 'minus',
      title: 'Tidak membawa alat/bahan daur ulang yang telah ditugaskan sebelumnya',
      points: 10,
    },
    {
      id: 'crit-neg-2',
      type: 'minus',
      title: 'Pasif, tidak peduli, atau mengganggu jalannya kerja kelompok',
      points: 10,
    },
    {
      id: 'crit-neg-3',
      type: 'minus',
      title: 'Meninggalkan area kelas/meja kerja dalam keadaan kotor dan berantakan',
      points: 10,
    },
    {
      id: 'crit-neg-4',
      type: 'minus',
      title: 'Datang terlambat tanpa alasan jelas pada jam kegiatan kokurikuler',
      points: 10,
    },
    {
      id: 'crit-neg-5',
      type: 'minus',
      title: 'Merusak bahan, perkakas, atau karya kreasi milik kelompok lain',
      points: 10,
    },
  ],
};

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

export const DEFAULT_MODULES: LearningModule[] = [
  {
    id: 'modul-1',
    title: 'Modul 1',
    order: 1,
    isLockedWithPassword: false,
    pages: [
      {
        id: 'page-1',
        title: 'Halaman 1',
        type: 'materi',
        order: 1,
        content: `Selamat datang di pembelajaran Modul Kreasi Daur Ulang SMP Negeri 1 Bengkalis!

Daur ulang adalah proses pengolahan kembali barang-barang bekas atau sampah yang sudah tidak terpakai menjadi barang baru yang bermanfaat dan memiliki nilai guna. Dengan mendaur ulang sampah anorganik seperti botol plastik, kardus, dan kaleng, kita ikut menyelamatkan lingkungan dari pencemaran serta melatih daya kreativitas kita.

Prinsip utama pengelolaan sampah yang bijak dikenal dengan 3R:
1. Reduce (Mengurangi timbulan sampah)
2. Reuse (Menggunakan kembali barang yang masih layak)
3. Recycle (Mendaur ulang sampah menjadi produk baru)

Mari kita jaga kebersihan lingkungan sekolah dan rumah dengan bijak memilah sampah!`,
        readingDelaySeconds: 10,
        lockQuestion: {
          id: 'q-lock-1',
          question: 'Apa kepanjangan dari prinsip 3R dalam pengelolaan sampah?',
          options: [
            'Reduce, Reuse, Recycle',
            'Remove, Replace, Repair',
            'Refresh, Restart, Return',
            'React, Respond, Recover',
          ],
          correctAnswerIndex: 0,
        },
      },
      {
        id: 'page-quiz',
        title: 'Kuis Akhir',
        type: 'quiz',
        order: 2,
        randomizeQuestions: true,
        quizQuestions: [
          {
            id: 'q-final-1',
            question: 'Manakah dari berikut ini yang termasuk contoh sampah anorganik yang dapat didaur ulang?',
            options: [
              'Sisa daun kering dan ranting pohon',
              'Botol plastik dan kaleng minuman bekas',
              'Sisa makanan dan kulit buah',
              'Kotoran ternak dan kompos',
            ],
            correctAnswerIndex: 1,
          },
          {
            id: 'q-final-2',
            question: 'Prinsip menggunakan kembali barang yang masih dapat dimanfaatkan tanpa melalui proses pengolahan ulang disebut...',
            options: [
              'Recycle',
              'Reduce',
              'Reuse',
              'Replace',
            ],
            correctAnswerIndex: 2,
          },
        ],
      },
    ],
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  },
];
