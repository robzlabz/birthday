import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { addYears, setYear, isLeapYear, getDate, getMonth } from "date-fns";

export class SchedulerService {
    /**
     * Menghitung jadwal notifikasi berikutnya (jam 09:00 local time)
     * dengan konversi ke UTC timestamp.
     *
     * Rules:
     * 1. Target jam 09:00 pagi waktu lokal user.
     * 2. Jika waktu tersebut sudah lewat di tahun ini, schedule untuk tahun depan.
     * 3. Handle 29 Feb:
     *    - Jika tahun target bukan kabisat, geser ke 1 Maret.
     */
    static calculateNextRun(birthDateStr: string, timezone: string): Date {
        const now = new Date();
        const serverTime = toZonedTime(now, timezone); // Waktu sekarang di lokasi user

        // Parse birthDate (YYYY-MM-DD)
        const [birthYear, birthMonth, birthDay] = birthDateStr.split("-").map(Number);

        // Asumsi birthMonth 1-12, di JS Date butuh 0-11
        const month = birthMonth - 1;

        // 1. Tentukan target tahun ini
        let targetYear = serverTime.getFullYear();
        let targetDate = this.getValidTargetDate(targetYear, month, birthDay);

        // Set waktu ke 09:00:00 lokal
        targetDate.setHours(9, 0, 0, 0);

        // 2. Jika target tahun ini sudah lewat (atau hari ini tapi lewat jam 9), pindah tahun depan
        // Kita bandingkan target lokal vs serverTime (lokal)
        if (targetDate <= serverTime) {
            targetYear++;
            targetDate = this.getValidTargetDate(targetYear, month, birthDay);
            targetDate.setHours(9, 0, 0, 0);
        }

        // 3. Konversi target lokal tersebut kembali ke UTC (absolute timestamp)
        // fromZonedTime mengambil waktu "seolah-olah lokal" dan timezone, lalu output Date (UTC)
        const utcResult = fromZonedTime(targetDate, timezone);

        return utcResult;
    }

    /**
     * Helper untuk menangani Logic Kabisat (Leap Year)
     * Jika target 29 Feb di tahun non-kabisat -> return 1 Maret
     */
    private static getValidTargetDate(year: number, month: number, day: number): Date {
        const date = new Date(year, month, day);

        // Cek apakah input original adalah 29 Feb (Month 1 in 0-index)
        const isFeb29 = month === 1 && day === 29;

        if (isFeb29) {
            // Cek apakah tahun target valid untuk 29 Feb
            // date-fns/isLeapYear butuh object Date atau number year
            // Tapi logic native JS: new Date(2025, 1, 29) otomatis jadi 1 Maret 2025 jika bukan kabisat.
            // Namun kita ingin eksplisit memastikan logic ini sesuai spec.

            if (!isLeapYear(new Date(year, 0, 1))) {
                // Jika bukan kabisat, JS otomatis geser ke 1 Mar sebenarnya,
                // tapi mari kita pastikan returnnya benar.
                // new Date(2025, 1, 29) -> 1 Mar 2025
                return new Date(year, 2, 1); // Bulan 2 = Maret
            }
        }

        return date;
    }
}
