/**
 * Utility helpers for Meeting Schedules and Date-based Locking
 */

export interface MeetingLockStatus {
  isConfigured: boolean;
  isOpenToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  statusLabel: string;
  badgeClass: string;
  dotColorClass: string;
  description: string;
  formattedDate: string;
}

/**
 * Returns date in YYYY-MM-DD using local browser/device time
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format YYYY-MM-DD into Indonesian human-readable string (e.g. 30 September 2026 or 30/09/2026)
 */
export function formatIndonesianDate(dateStr?: string): string {
  if (!dateStr || dateStr.trim() === '') return '-';
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} ${months[monthIndex]} ${year}`;
    }
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

/**
 * Check if a date string is configured (non-empty)
 */
export function isScheduleDateConfigured(activeDate?: string): boolean {
  return Boolean(activeDate && activeDate.trim() !== '');
}

/**
 * Determines whether a meeting's assessment is open today or locked.
 * Rules:
 * 1. If activeDate is not set: LOCKED (Tanggal Belum Diatur).
 * 2. If activeDate is today: OPEN (Terbuka Otomatis Hari Ini).
 * 3. If activeDate is in the past: LOCKED (1 hari setelah jadwal -> Terkunci Otomatis).
 * 4. If activeDate is in the future: LOCKED (Auto Terbuka pada tanggal tersebut).
 */
export function getMeetingLockStatus(activeDate?: string): MeetingLockStatus {
  const trimmed = (activeDate || '').trim();
  const isConfigured = trimmed !== '';

  if (!isConfigured) {
    return {
      isConfigured: false,
      isOpenToday: false,
      isPast: false,
      isFuture: false,
      statusLabel: '🔒 Terkunci (Tanggal Belum Diatur)',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      dotColorClass: 'bg-amber-500',
      description: 'Pertemuan ini belum memiliki jadwal tanggal aktif. Penilaian tidak dapat diisi atau diubah.',
      formattedDate: '-',
    };
  }

  const todayLocal = getLocalDateString();
  const todayUTC = new Date().toISOString().split('T')[0];
  const isOpenToday = trimmed === todayLocal || trimmed === todayUTC;
  const formatted = formatIndonesianDate(trimmed);

  if (isOpenToday) {
    return {
      isConfigured: true,
      isOpenToday: true,
      isPast: false,
      isFuture: false,
      statusLabel: '✓ Penilaian Terbuka (Hari Ini)',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse',
      dotColorClass: 'bg-emerald-500',
      description: `Penilaian sedang berlangsung dan terbuka otomatis khusus hari ini (${formatted}).`,
      formattedDate: formatted,
    };
  }

  // Compare date strings (YYYY-MM-DD format works lexicographically)
  const isPast = trimmed < todayLocal;

  if (isPast) {
    return {
      isConfigured: true,
      isOpenToday: false,
      isPast: true,
      isFuture: false,
      statusLabel: `🔒 Terkunci (Selesai: ${formatted})`,
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
      dotColorClass: 'bg-rose-500',
      description: `Jadwal pertemuan telah berakhir pada ${formatted}. Penilaian otomatis terkunci kembali 1 hari setelah tanggal pelaksanaan.`,
      formattedDate: formatted,
    };
  }

  // Future date
  return {
    isConfigured: true,
    isOpenToday: false,
    isPast: false,
    isFuture: true,
    statusLabel: `🔒 Terkunci (Auto Buka: ${formatted})`,
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
    dotColorClass: 'bg-sky-500',
    description: `Pertemuan ini akan otomatis terbuka untuk penilaian pada tanggal ${formatted}. Saat ini masih terkunci.`,
    formattedDate: formatted,
  };
}
