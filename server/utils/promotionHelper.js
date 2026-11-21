/**
 * Promotion & Smart 3-Tier Roll Number Assignment Helper
 */

/**
 * Extracts a positive integer rank from strings like "1", "1st", "Rank 1", "#2", "03".
 * Returns null if no valid positive integer rank is present.
 * @param {string|number|null|undefined} rankVal
 * @returns {number|null}
 */
function parseRank(rankVal) {
  if (rankVal === null || rankVal === undefined) return null;
  if (typeof rankVal === 'number') {
    return Number.isFinite(rankVal) && rankVal > 0 ? Math.floor(rankVal) : null;
  }
  const str = String(rankVal).trim();
  if (!str) return null;
  const match = str.match(/(\d+)/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

/**
 * Computes the next academic year string from current year string.
 * Examples: "2026-27" -> "2027-28", "2026/27" -> "2027-28", "2026-2027" -> "2027-28"
 * @param {string} currentYear
 * @returns {string}
 */
function computeNextAcademicYear(currentYear) {
  const str = String(currentYear || '').trim();
  const match = str.match(/^(\d{4})[-/](\d{2,4})$/);
  if (match) {
    const startYear = parseInt(match[1], 10) + 1;
    const endYearShort = String(startYear + 1).slice(-2);
    return `${startYear}-${endYearShort}`;
  }
  const nowYear = new Date().getFullYear();
  return `${nowYear + 1}-${String(nowYear + 2).slice(-2)}`;
}

/**
 * Compares two students by previous roll ascending, then name A-Z.
 */
function compareByPrevRollThenName(a, b) {
  const rollA = Number.isFinite(Number(a.roll)) ? Number(a.roll) : Number.MAX_SAFE_INTEGER;
  const rollB = Number.isFinite(Number(b.roll)) ? Number(b.roll) : Number.MAX_SAFE_INTEGER;
  if (rollA !== rollB) return rollA - rollB;
  return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
}

/**
 * Assigns sequential roll numbers (1..N) to students in a target class
 * using the 3-Tier Smart Logic when mode === 'rank'.
 *
 * Each student object may have:
 *  - name: string
 *  - roll: number (previous roll)
 *  - rank or academicStatus.rank: string|number
 *  - isRetained / action === 'retain': boolean
 *
 * Returns a new array of cloned student objects with `parsedRank`, `newRoll`, and `rollOrderReason` attached.
 *
 * @param {Array<Object>} students
 * @param {'rank'|'previous'|'alpha'} [mode='rank']
 * @returns {{ students: Array<Object>, hasAnyRank: boolean, appliedMode: string }}
 */
function assignRollNumbers(students, mode = 'rank') {
  if (!Array.isArray(students) || students.length === 0) {
    return { students: [], hasAnyRank: false, appliedMode: mode };
  }

  const normalized = students.map(s => {
    const rawRank = s.rank !== undefined ? s.rank : (s.academicStatus && s.academicStatus.rank);
    const parsedRank = parseRank(rawRank);
    const isRetained = Boolean(s.isRetained || s.action === 'retain');
    return {
      ...s,
      rawRank: rawRank ? String(rawRank).trim() : '',
      parsedRank,
      isRetained
    };
  });

  if (mode === 'alpha') {
    normalized.sort((a, b) => {
      const nameCmp = String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
      if (nameCmp !== 0) return nameCmp;
      return compareByPrevRollThenName(a, b);
    });
    return {
      students: normalized.map((s, idx) => ({ ...s, newRoll: idx + 1, rollOrderReason: 'A-Z' })),
      hasAnyRank: normalized.some(s => s.parsedRank !== null),
      appliedMode: 'alpha'
    };
  }

  if (mode === 'previous') {
    normalized.sort((a, b) => {
      if (a.isRetained !== b.isRetained) return a.isRetained ? 1 : -1;
      return compareByPrevRollThenName(a, b);
    });
    return {
      students: normalized.map((s, idx) => ({ ...s, newRoll: idx + 1, rollOrderReason: 'Previous Roll' })),
      hasAnyRank: normalized.some(s => s.parsedRank !== null),
      appliedMode: 'previous'
    };
  }

  // Default: 'rank' (3-Tier Smart Logic)
  const hasAnyRank = normalized.some(s => !s.isRetained && s.parsedRank !== null);

  if (!hasAnyRank) {
    // Tier 3: No ranks in this class -> keep previous roll order without gaps (1..N)
    normalized.sort((a, b) => {
      if (a.isRetained !== b.isRetained) return a.isRetained ? 1 : -1;
      return compareByPrevRollThenName(a, b);
    });
    return {
      students: normalized.map((s, idx) => ({ ...s, newRoll: idx + 1, rollOrderReason: 'No Rank Fallback' })),
      hasAnyRank: false,
      appliedMode: 'previous-fallback'
    };
  }

  // Tier 1 & Tier 2:
  // 1) Ranked non-retained students (rank asc -> prev roll asc -> name A-Z)
  // 2) Unranked non-retained students (prev roll asc -> name A-Z)
  // 3) Retained students (prev roll asc -> name A-Z)
  normalized.sort((a, b) => {
    const tierA = a.isRetained ? 2 : (a.parsedRank !== null ? 0 : 1);
    const tierB = b.isRetained ? 2 : (b.parsedRank !== null ? 0 : 1);
    if (tierA !== tierB) return tierA - tierB;

    if (tierA === 0) {
      if (a.parsedRank !== b.parsedRank) return a.parsedRank - b.parsedRank;
      return compareByPrevRollThenName(a, b);
    }
    return compareByPrevRollThenName(a, b);
  });

  return {
    students: normalized.map((s, idx) => ({
      ...s,
      newRoll: idx + 1,
      rollOrderReason: s.isRetained ? 'Retained' : (s.parsedRank !== null ? `Rank ${s.parsedRank}` : 'Unranked')
    })),
    hasAnyRank: true,
    appliedMode: 'rank'
  };
}

module.exports = {
  parseRank,
  computeNextAcademicYear,
  assignRollNumbers
};
