export interface EthiopianDate {
  year: number;
  month: number;
  day: number;
  monthNameAm: string;
  monthNameEn: string;
  hour: number;
  minute: number;
  periodAm: string;
  periodEn: string;
  formattedAm: string;
  formattedEn: string;
  formattedBilingual: string;
}

export const ETHIOPIAN_MONTHS_AM = [
  'መስከረም',
  'ጥቅምት',
  'ኅዳር',
  'ታኅሣሥ',
  'ጥር',
  'የካቲት',
  'መጋቢት',
  'ሚያዝያ',
  'ግንቦት',
  'ሰኔ',
  'ሐምሌ',
  'ነሐሴ',
  'ጳጉሜ',
];

export const ETHIOPIAN_MONTHS_EN = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miyazya',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
];

const JD_EPOCH_OFFSET_AMETE_MIHRET = 1724220;

/**
 * Converts Gregorian year, month (1-12), and day (1-31) to Julian Day Number (JDN).
 */
export function gregToJDN(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * Converts Julian Day Number (JDN) to Ethiopian date components { year, month, day }.
 */
export function jdnToEth(jdn: number): { year: number; month: number; day: number } {
  const daysSinceEpoch = jdn - JD_EPOCH_OFFSET_AMETE_MIHRET;
  let year = Math.floor((4 * daysSinceEpoch + 1463) / 1461);
  let priorDays = daysSinceEpoch - (365 * (year - 1) + Math.floor(year / 4));
  if (priorDays <= 0) {
    year -= 1;
    priorDays = daysSinceEpoch - (365 * (year - 1) + Math.floor(year / 4));
  }
  const month = Math.floor((priorDays - 1) / 30) + 1;
  const day = ((priorDays - 1) % 30) + 1;
  return { year, month, day };
}

/**
 * Converts a JavaScript Date or ISO string into structured Ethiopian Calendar date and time.
 */
export function toEthiopian(dateInput: Date | string | number): EthiopianDate {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  const jdn = gregToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const { year, month, day } = jdnToEth(jdn);

  const monthIdx = Math.max(0, Math.min(12, month - 1));
  const monthNameAm = ETHIOPIAN_MONTHS_AM[monthIdx] || '';
  const monthNameEn = ETHIOPIAN_MONTHS_EN[monthIdx] || '';

  const gregHour = date.getHours();
  const minute = date.getMinutes();
  const minuteStr = minute < 10 ? `0${minute}` : `${minute}`;

  // Ethiopian time calculation: 6-hour shift relative to Gregorian day
  // 06:00 is 12:00 morning in Ethiopian time
  let ethHour = (gregHour + 6) % 12;
  if (ethHour === 0) ethHour = 12;

  let periodAm = 'ጠዋት';
  let periodEn = 'Morning';
  if (gregHour >= 6 && gregHour < 12) {
    periodAm = 'ጠዋት';
    periodEn = 'Morning';
  } else if (gregHour >= 12 && gregHour < 13) {
    periodAm = 'ቀትር';
    periodEn = 'Midday';
  } else if (gregHour >= 13 && gregHour < 18) {
    periodAm = 'ከሰዓት';
    periodEn = 'Afternoon';
  } else if (gregHour >= 18 && gregHour < 24) {
    periodAm = 'ምሽት';
    periodEn = 'Night';
  } else {
    periodAm = 'ሌሊት';
    periodEn = 'Late Night';
  }

  const formattedAm = `${monthNameAm} ${day}, ${year} ዓ.ም • ${ethHour}:${minuteStr} ${periodAm}`;
  const formattedEn = `${monthNameEn} ${day}, ${year} • ${ethHour}:${minuteStr} ${periodEn}`;
  const formattedBilingual = `${monthNameAm} (${monthNameEn}) ${day}, ${year} ዓ.ም • ${ethHour}:${minuteStr} ${periodAm}`;

  return {
    year,
    month,
    day,
    monthNameAm,
    monthNameEn,
    hour: ethHour,
    minute,
    periodAm,
    periodEn,
    formattedAm,
    formattedEn,
    formattedBilingual,
  };
}

/**
 * Formats a Date into a prominent Ethiopian deadline string.
 * Example: "ጥቅምት 30, 2019 ዓ.ም (10:00 ከሰዓት)"
 */
export function formatEthiopianDeadline(dateInput: Date | string | number): string {
  const eth = toEthiopian(dateInput);
  const minuteStr = eth.minute < 10 ? `0${eth.minute}` : `${eth.minute}`;
  return `${eth.monthNameAm} ${eth.day}, ${eth.year} ዓ.ም (${eth.hour}:${minuteStr} ${eth.periodAm})`;
}

