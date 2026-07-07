/**
 * Net Effective Rent (NER) Calculator — pure engine (SPEC.md §T4). A
 * month-level engine turns face rent, free months, escalations, TI, and
 * concessions into a straight-line (and optionally NPV) effective rent. No
 * rounding here — the UI rounds at display (§6). Guards return typed error
 * states, never NaN (§5).
 *
 * Formulas (§T4):
 *   scheduled(m) = face/12 × sf × (1 + esc/100)^floor((m−1)/12)
 *   freeValue    = Σ scheduled(m), m = 1..free
 *   collected    = Σ scheduled(m) − freeValue
 *   NER_straight = (collected − tia×sf − conc) / (term/12) / sf
 *   NPV: i = disc/100/12; NPV = −(tia×sf + conc) + Σ cash(m)/(1+i)^m, cash(m)=0 during free
 *        levelPmt = NPV × i / (1 − (1+i)^−term);  NER_npv = levelPmt × 12 / sf
 */

export type NerInput = {
  term: number;
  sf: number;
  face: number;
  esc: number;
  free: number;
  tia: number;
  conc: number;
  npv: boolean;
  disc: number;
};

export type NerErrorCode = 'INCOMPLETE' | 'FREE_EXCEEDS_TERM';

/** Verbatim UI strings (SPEC.md §T4 Edge cases). */
export const NER_MESSAGES: Record<NerErrorCode | 'NEGATIVE_NER' | 'NNN_NOTE', string> = {
  INCOMPLETE: 'Enter values to calculate.',
  FREE_EXCEEDS_TERM: "Free rent can't cover the whole term.",
  NEGATIVE_NER: 'Concessions exceed total rent — this deal loses money on paper.',
  NNN_NOTE: 'NNN charges usually continue during free-rent periods; model them in the NNN calculator.',
};

export type NerTimelineRow = { month: number; scheduled: number; paid: number };

export type NerResult =
  | {
      ok: true;
      scheduledTotal: number;
      freeValue: number;
      collected: number;
      concessionValue: number; // tia×sf + conc
      nerStraight: number;
      /** Present only when npv mode is on. */
      nerNpv: number | null;
      npvValue: number | null;
      /** Discount off face for the active NER (npv ? nerNpv : nerStraight), as a decimal. */
      discountToFace: number;
      /** True when the active NER is below $0 (concessions exceed rent). */
      negative: boolean;
      timeline: NerTimelineRow[];
    }
  | { ok: false; error: NerErrorCode };

export const DEFAULTS: NerInput = {
  term: 60,
  sf: 5000,
  face: 30,
  esc: 3,
  free: 3,
  tia: 30,
  conc: 0,
  npv: false,
  disc: 8,
};

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function isNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

export function computeNer(input: NerInput): NerResult {
  const { term, sf, face, esc, free, tia, conc, npv, disc } = input;

  if (!isPositive(sf) || !isNonNegative(face) || !isNonNegative(esc)) return { ok: false, error: 'INCOMPLETE' };
  if (!Number.isFinite(term) || term < 1 || !isNonNegative(free)) return { ok: false, error: 'INCOMPLETE' };
  if (!isNonNegative(tia) || !isNonNegative(conc) || !isNonNegative(disc)) return { ok: false, error: 'INCOMPLETE' };
  if (free >= term) return { ok: false, error: 'FREE_EXCEEDS_TERM' };

  const months = Math.floor(term);
  const freeMonths = Math.floor(free);

  const timeline: NerTimelineRow[] = [];
  let scheduledTotal = 0;
  let freeValue = 0;
  for (let m = 1; m <= months; m += 1) {
    const scheduled = (face / 12) * sf * (1 + esc / 100) ** Math.floor((m - 1) / 12);
    const isFree = m <= freeMonths;
    scheduledTotal += scheduled;
    if (isFree) freeValue += scheduled;
    timeline.push({ month: m, scheduled, paid: isFree ? 0 : scheduled });
  }

  const collected = scheduledTotal - freeValue;
  const concessionValue = tia * sf + conc;
  const yearsExact = months / 12;
  const nerStraight = (collected - concessionValue) / yearsExact / sf;

  let nerNpv: number | null = null;
  let npvValue: number | null = null;
  if (npv) {
    const i = disc / 100 / 12;
    if (i === 0) {
      // disc = 0 → NPV equals straight-line (SPEC.md §T4 edge case).
      npvValue = collected - concessionValue;
      nerNpv = nerStraight;
    } else {
      const pv = timeline.reduce((sum, row) => sum + row.paid / (1 + i) ** row.month, 0);
      npvValue = -concessionValue + pv;
      const levelPmt = (npvValue * i) / (1 - (1 + i) ** -months);
      nerNpv = (levelPmt * 12) / sf;
    }
  }

  const activeNer = npv && nerNpv !== null ? nerNpv : nerStraight;
  const discountToFace = face > 0 ? (face - activeNer) / face : 0;

  return {
    ok: true,
    scheduledTotal,
    freeValue,
    collected,
    concessionValue,
    nerStraight,
    nerNpv,
    npvValue,
    discountToFace,
    negative: activeNer < 0,
    timeline,
  };
}
