import { useMemo, useState, type ReactNode } from 'react';
import { formatCurrency, formatDollars, formatPerSf, formatPercent } from '../../calc-core/money';
import { computeNer, DEFAULTS, NER_MESSAGES, type NerInput, type NerResult } from '../../calc-core/netEffectiveRent';
import { enumParam, numberParam, type ParamCodec, type ParamSchema } from '../../lib/urlState';
import { useUrlState } from '../../hooks/useUrlState';
import { useCalcTelemetry } from '../../hooks/useCalcTelemetry';
import { track } from '../../lib/analytics';
import CalcShell from './CalcShell';
import NumberInput from './NumberInput';
import RentInput from './RentInput';
import ResultCard, { type ResultRow } from './ResultCard';
import LineChart from './LineChart';
import ScenarioCompare, { type CompareMetric } from './ScenarioCompare';
import ShareBar from '../ShareBar';
import EmbedModal from '../EmbedModal';

const SLUG = 'net-effective-rent-calculator';
const TITLE = 'Net Effective Rent Calculator';

const NUM_FIELDS = ['term', 'sf', 'face', 'esc', 'free', 'tia', 'conc', 'disc'] as const;

type Prefix = '' | 'b_';
type NerUrlState = Omit<NerInput, 'npv'> & { npv: string } & { cmp: string } & {
  [K in keyof Omit<NerInput, 'npv'> as `b_${string & K}`]: number;
} & { b_npv: string };

function scenarioParams(prefix: Prefix): Record<string, ParamCodec<number> | ParamCodec<string>> {
  const out: Record<string, ParamCodec<number> | ParamCodec<string>> = {
    [`${prefix}npv`]: enumParam(['0', '1'], '0'),
  };
  for (const f of NUM_FIELDS) out[`${prefix}${f}`] = numberParam(DEFAULTS[f]);
  return out;
}

const SCHEMA = {
  ...scenarioParams(''),
  cmp: enumParam(['0', '1'], '0'),
  ...scenarioParams('b_'),
} as ParamSchema<NerUrlState>;

const DEFAULT_STATE: NerUrlState = (() => {
  const base = { npv: DEFAULTS.npv ? '1' : '0', cmp: '0', b_npv: DEFAULTS.npv ? '1' : '0' } as Record<string, unknown>;
  for (const f of NUM_FIELDS) {
    base[f] = DEFAULTS[f];
    base[`b_${f}`] = DEFAULTS[f];
  }
  return base as NerUrlState;
})();

function detectEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/$/, '').endsWith('/embed') ||
    new URLSearchParams(window.location.search).get('embed') === '1';
}

function extractScenario(state: NerUrlState, prefix: Prefix): NerInput {
  const s = state as Record<string, unknown>;
  const out = { npv: s[`${prefix}npv`] === '1' } as Record<string, unknown>;
  for (const f of NUM_FIELDS) out[f] = s[`${prefix}${f}`] as number;
  return out as NerInput;
}

export type NetEffectiveRentCalculatorProps = { embed?: boolean };

export default function NetEffectiveRentCalculator({ embed: embedProp }: NetEffectiveRentCalculatorProps) {
  const [state, setState] = useUrlState<NerUrlState>(SCHEMA);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embed] = useState(() => embedProp ?? detectEmbed());

  const compareOn = state.cmp === '1';
  const scenarioA = extractScenario(state, '');
  const scenarioB = extractScenario(state, 'b_');
  const resultA = useMemo(() => computeNer(scenarioA), [JSON.stringify(scenarioA)]);
  useCalcTelemetry(SLUG, JSON.stringify(state), resultA.ok);
  const resultB = useMemo(() => computeNer(scenarioB), [JSON.stringify(scenarioB)]);

  const setField = (prefix: Prefix, field: keyof NerInput, value: number | boolean) => {
    const key = `${prefix}${field}` as keyof NerUrlState;
    const encoded = field === 'npv' ? (value ? '1' : '0') : (value as number);
    setState((prev) => ({ ...prev, [key]: encoded }) as NerUrlState);
  };

  const enableCompare = () =>
    setState((prev) => {
      const next = { ...prev, cmp: '1' } as Record<string, unknown>;
      next.b_npv = prev.npv;
      for (const f of NUM_FIELDS) next[`b_${f}`] = (prev as Record<string, unknown>)[f];
      return next as NerUrlState;
    });

  const activeNer = (r: Extract<NerResult, { ok: true }>) => (r.nerNpv !== null ? r.nerNpv : r.nerStraight);

  const renderInputs = (prefix: Prefix, s: NerInput, result: NerResult): ReactNode => {
    const freeError = !result.ok && result.error === 'FREE_EXCEEDS_TERM' ? NER_MESSAGES.FREE_EXCEEDS_TERM : undefined;
    return (
      <>
        <NumberInput id={`${prefix}term`} label="Term" value={s.term} onChange={(v) => setField(prefix, 'term', v)} min={12} max={360} step={12} suffix="months" />
        <NumberInput id={`${prefix}sf`} label="Area" value={s.sf} onChange={(v) => setField(prefix, 'sf', v)} min={100} max={2_000_000} step={100} suffix="SF" />
        <RentInput id={`${prefix}face`} label="Face rent" valuePerYr={s.face} onChangePerYr={(v) => setField(prefix, 'face', v)} minPerYr={0} maxPerYr={500} unitLabel="SF" />
        <NumberInput id={`${prefix}esc`} label="Escalation" value={s.esc} onChange={(v) => setField(prefix, 'esc', v)} min={0} max={15} step={0.25} suffix="%/yr" />
        <NumberInput id={`${prefix}free`} label="Free rent" value={s.free} onChange={(v) => setField(prefix, 'free', v)} min={0} max={Math.max(0, s.term - 1)} step={1} suffix="months" errorText={freeError} tooltip={NER_MESSAGES.NNN_NOTE} />
        <NumberInput id={`${prefix}tia`} label="TI allowance" value={s.tia} onChange={(v) => setField(prefix, 'tia', v)} min={0} max={500} step={1} suffix="$/SF" />
        <NumberInput id={`${prefix}conc`} label="Other concessions" value={s.conc} onChange={(v) => setField(prefix, 'conc', v)} min={0} step={1000} suffix="$" tooltip="Moving allowance, cash, or other one-time landlord concessions." />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.npv} onChange={(e) => setField(prefix, 'npv', e.target.checked)} />
          NPV mode (discount cash flows)
        </label>
        {s.npv && (
          <NumberInput id={`${prefix}disc`} label="Discount rate" value={s.disc} onChange={(v) => setField(prefix, 'disc', v)} min={0} max={20} step={0.25} suffix="%/yr" tooltip="Annual discount rate for the NPV-equivalent NER. 0% equals the straight-line result." />
        )}
      </>
    );
  };

  const resultRows = (result: NerResult): ResultRow[] => {
    if (!result.ok) return [];
    const ner = activeNer(result);
    const rows: ResultRow[] = [
      { label: result.nerNpv !== null ? 'Net effective rent (NPV)' : 'Net effective rent', value: formatPerSf(ner), emphasis: true },
      { label: 'Discount to face', value: formatPercent(result.discountToFace) },
      { label: 'Total scheduled rent', value: formatDollars(result.scheduledTotal) },
      { label: 'Free-rent value', value: formatDollars(result.freeValue) },
      { label: 'TI + concessions', value: formatDollars(result.concessionValue) },
      { label: 'Total collected', value: formatDollars(result.collected) },
    ];
    if (result.nerNpv !== null && result.npvValue !== null) {
      rows.push({ label: 'NPV of deal', value: formatDollars(result.npvValue) });
    }
    return rows;
  };

  const renderResults = (result: NerResult): ReactNode => (
    <>
      <div aria-live="polite">
        <ResultCard rows={resultRows(result)} emptyState={!result.ok && result.error === 'FREE_EXCEEDS_TERM' ? NER_MESSAGES.FREE_EXCEEDS_TERM : NER_MESSAGES.INCOMPLETE} title="Effective rent" />
      </div>
      {result.ok && result.negative && (
        <p className="text-xs" style={{ color: 'var(--color-error)' }}>
          {NER_MESSAGES.NEGATIVE_NER}
        </p>
      )}
    </>
  );

  const compareMetrics: CompareMetric[] = [
    { label: 'Net effective rent / SF / yr', a: resultA.ok ? activeNer(resultA) : null, b: resultB.ok ? activeNer(resultB) : null, format: formatCurrency },
    { label: 'Total collected', a: resultA.ok ? resultA.collected : null, b: resultB.ok ? resultB.collected : null, format: formatDollars },
    { label: 'TI + concessions', a: resultA.ok ? resultA.concessionValue : null, b: resultB.ok ? resultB.concessionValue : null, format: formatDollars },
  ];

  const timelineView = resultA.ok ? (
    <div className="mt-6 space-y-2">
      {compareOn && <p className="text-sm font-medium">Scenario A — monthly rent paid</p>}
      <LineChart
        ariaLabel={`Monthly rent paid over ${resultA.timeline.length} months, showing the free-rent gap and escalation steps`}
        formatValue={formatDollars}
        points={resultA.timeline.map((row) => ({ label: `M${row.month}`, value: row.paid }))}
      />
    </div>
  ) : null;

  const toolbar = embed ? null : (
    <div className="mt-4 flex flex-wrap items-center gap-2" data-print-hide>
      {!compareOn && (
        <button type="button" onClick={() => { track('scenario_added', { tool: SLUG }); enableCompare(); }} className="rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--color-border)' }}>
          Compare scenarios
        </button>
      )}
      <ShareBar
        tool={SLUG}
        onCopyLink={() => navigator.clipboard.writeText(window.location.href)}
        onEmbed={() => setEmbedOpen(true)}
        onReset={() => setState(DEFAULT_STATE)}
      />
    </div>
  );

  return (
    <>
      {compareOn ? (
        <ScenarioCompare
          labelA="Scenario A"
          labelB="Scenario B"
          inputsA={renderInputs('', scenarioA, resultA)}
          inputsB={renderInputs('b_', scenarioB, resultB)}
          metrics={compareMetrics}
          onRemove={() => setState((prev) => ({ ...prev, cmp: '0' }))}
        />
      ) : (
        <CalcShell inputs={renderInputs('', scenarioA, resultA)} results={renderResults(resultA)} />
      )}
      {toolbar}
      {timelineView}
      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} slug={SLUG} title={TITLE} height={780} />
    </>
  );
}
