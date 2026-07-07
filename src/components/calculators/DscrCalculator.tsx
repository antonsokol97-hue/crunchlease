import { useMemo, useState, type ReactNode } from 'react';
import { formatCurrency, formatDollars, formatNumber } from '../../calc-core/money';
import {
  computeDscr,
  DEFAULTS,
  DSCR_BAND_LABELS,
  DSCR_MESSAGES,
  type DscrDebtMode,
  type DscrInput,
  type DscrResult,
} from '../../calc-core/dscr';
import { enumParam, numberParam, type ParamCodec, type ParamSchema } from '../../lib/urlState';
import { useUrlState } from '../../hooks/useUrlState';
import CalcShell from './CalcShell';
import ModeTabs from './ModeTabs';
import NumberInput from './NumberInput';
import ResultCard from './ResultCard';
import DscrGauge from './DscrGauge';
import ScenarioCompare, { type CompareMetric } from './ScenarioCompare';
import ShareBar from '../ShareBar';
import EmbedModal from '../EmbedModal';

const SLUG = 'dscr-calculator';
const TITLE = 'DSCR Calculator';

const NUM_FIELDS = ['noi', 'ds', 'loan', 'rate', 'am', 'target'] as const;

type Prefix = '' | 'b_';
type DscrUrlState = Omit<DscrInput, 'io'> & { io: string } & { cmp: string } & {
  [K in keyof Omit<DscrInput, 'io' | 'dmode'> as `b_${string & K}`]: number;
} & { b_dmode: DscrDebtMode; b_io: string };

type AnyCodec = ParamCodec<number> | ParamCodec<string> | ParamCodec<DscrDebtMode>;

function scenarioParams(prefix: Prefix): Record<string, AnyCodec> {
  const out: Record<string, AnyCodec> = {
    [`${prefix}dmode`]: enumParam<DscrDebtMode>(['build', 'direct'], DEFAULTS.dmode),
    [`${prefix}io`]: enumParam(['0', '1'], '0'),
  };
  for (const f of NUM_FIELDS) out[`${prefix}${f}`] = numberParam(DEFAULTS[f]);
  return out;
}

const SCHEMA = {
  ...scenarioParams(''),
  cmp: enumParam(['0', '1'], '0'),
  ...scenarioParams('b_'),
} as ParamSchema<DscrUrlState>;

const DEFAULT_STATE: DscrUrlState = (() => {
  const base = { dmode: DEFAULTS.dmode, io: '0', cmp: '0', b_dmode: DEFAULTS.dmode, b_io: '0' } as Record<string, unknown>;
  for (const f of NUM_FIELDS) {
    base[f] = DEFAULTS[f];
    base[`b_${f}`] = DEFAULTS[f];
  }
  return base as DscrUrlState;
})();

const MODE_OPTIONS = [
  { value: 'build' as const, label: 'Build from loan' },
  { value: 'direct' as const, label: 'Enter debt service' },
];

function detectEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/$/, '').endsWith('/embed') ||
    new URLSearchParams(window.location.search).get('embed') === '1';
}

function extractScenario(state: DscrUrlState, prefix: Prefix): DscrInput {
  const s = state as Record<string, unknown>;
  const out = { dmode: s[`${prefix}dmode`] as DscrDebtMode, io: s[`${prefix}io`] === '1' } as Record<string, unknown>;
  for (const f of NUM_FIELDS) out[f] = s[`${prefix}${f}`] as number;
  return out as DscrInput;
}

export type DscrCalculatorProps = { embed?: boolean };

export default function DscrCalculator({ embed: embedProp }: DscrCalculatorProps) {
  const [state, setState] = useUrlState<DscrUrlState>(SCHEMA);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embed] = useState(() => embedProp ?? detectEmbed());

  const compareOn = state.cmp === '1';
  const scenarioA = extractScenario(state, '');
  const scenarioB = extractScenario(state, 'b_');
  const resultA = useMemo(() => computeDscr(scenarioA), [JSON.stringify(scenarioA)]);
  const resultB = useMemo(() => computeDscr(scenarioB), [JSON.stringify(scenarioB)]);

  const setField = (prefix: Prefix, field: keyof DscrInput, value: number | boolean | DscrDebtMode) => {
    const key = `${prefix}${field}` as keyof DscrUrlState;
    const encoded = field === 'io' ? (value ? '1' : '0') : value;
    setState((prev) => ({ ...prev, [key]: encoded }) as DscrUrlState);
  };

  const enableCompare = () =>
    setState((prev) => {
      const next = { ...prev, cmp: '1' } as Record<string, unknown>;
      next.b_dmode = prev.dmode;
      next.b_io = prev.io;
      for (const f of NUM_FIELDS) next[`b_${f}`] = (prev as Record<string, unknown>)[f];
      return next as DscrUrlState;
    });

  const renderInputs = (prefix: Prefix, s: DscrInput, result: DscrResult): ReactNode => {
    const rateError = !result.ok && result.error === 'IO_ZERO_RATE' ? DSCR_MESSAGES.IO_ZERO_RATE : undefined;
    return (
      <>
        <NumberInput id={`${prefix}noi`} label="Net operating income" value={s.noi} onChange={(v) => setField(prefix, 'noi', v)} min={0} max={100_000_000} step={1000} suffix="$/yr" tooltip="Income after operating expenses, before debt service. Need NOI? Build it in the Cap Rate calculator." />
        <ModeTabs label="Debt input" options={MODE_OPTIONS} value={s.dmode} onChange={(v) => setField(prefix, 'dmode', v)} />
        {s.dmode === 'build' ? (
          <NumberInput id={`${prefix}loan`} label="Loan amount" value={s.loan} onChange={(v) => setField(prefix, 'loan', v)} min={1} max={1_000_000_000} step={10_000} suffix="$" />
        ) : (
          <NumberInput id={`${prefix}ds`} label="Annual debt service" value={s.ds} onChange={(v) => setField(prefix, 'ds', v)} min={1} step={1000} suffix="$/yr" />
        )}
        <NumberInput id={`${prefix}rate`} label="Interest rate" value={s.rate} onChange={(v) => setField(prefix, 'rate', v)} min={0} max={20} step={0.05} suffix="%/yr" errorText={rateError} tooltip={s.dmode === 'direct' ? 'Used with amortization to size the maximum loan.' : undefined} />
        <NumberInput id={`${prefix}am`} label="Amortization" value={s.am} onChange={(v) => setField(prefix, 'am', v)} min={1} max={40} step={1} suffix="years" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.io} onChange={(e) => setField(prefix, 'io', e.target.checked)} />
          Interest-only
        </label>
        <NumberInput id={`${prefix}target`} label="Target DSCR" value={s.target} onChange={(v) => setField(prefix, 'target', v)} min={1} max={2.5} step={0.05} suffix="x" tooltip="Coverage ratio for the max-loan solver — lenders commonly require 1.20–1.35x." />
      </>
    );
  };

  const renderResults = (result: DscrResult, dmode: DscrDebtMode): ReactNode => (
    <>
      <div aria-live="polite">
        <ResultCard
          title="Debt coverage"
          emptyState={!result.ok && result.error === 'IO_ZERO_RATE' ? DSCR_MESSAGES.IO_ZERO_RATE : DSCR_MESSAGES.INCOMPLETE}
          rows={
            result.ok
              ? [
                  { label: 'DSCR', value: result.dscr === null ? 'N/A' : `${formatNumber(result.dscr, 2)}x`, emphasis: true },
                  { label: 'Monthly debt service', value: formatCurrency(result.monthlyDebtService) },
                  { label: 'Annual debt service', value: formatDollars(result.annualDebtService) },
                  { label: 'Max supportable loan', value: formatDollars(result.maxLoan), emphasis: true },
                ]
              : []
          }
        />
      </div>
      {result.ok && result.dscr !== null && result.band !== null && (
        <>
          <DscrGauge dscr={result.dscr} band={result.band} />
          <p className="text-xs" style={{ color: result.band === 'fail' ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
            {DSCR_BAND_LABELS[result.band]}
          </p>
        </>
      )}
      {result.ok && result.dscr === null && (
        <p className="text-xs" style={{ color: 'var(--color-error)' }}>
          {DSCR_BAND_LABELS.fail}
        </p>
      )}
      {result.ok && dmode === 'build' && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {result.delta >= 0
            ? `You're ${formatDollars(result.delta)} under the max at ${formatNumber(scenarioA.target, 2)}x.`
            : `You're ${formatDollars(-result.delta)} over the max at ${formatNumber(scenarioA.target, 2)}x.`}
        </p>
      )}
    </>
  );

  const compareMetrics: CompareMetric[] = [
    { label: 'DSCR', a: resultA.ok ? resultA.dscr : null, b: resultB.ok ? resultB.dscr : null, format: (n) => `${formatNumber(n, 2)}x` },
    { label: 'Annual debt service', a: resultA.ok ? resultA.annualDebtService : null, b: resultB.ok ? resultB.annualDebtService : null, format: formatDollars },
    { label: 'Max supportable loan', a: resultA.ok ? resultA.maxLoan : null, b: resultB.ok ? resultB.maxLoan : null, format: formatDollars },
  ];

  const toolbar = embed ? null : (
    <div className="mt-4 flex flex-wrap items-center gap-2" data-print-hide>
      {!compareOn && (
        <button type="button" onClick={enableCompare} className="rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--color-border)' }}>
          Compare scenarios
        </button>
      )}
      <ShareBar
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
          labelA="Loan A"
          labelB="Loan B"
          inputsA={renderInputs('', scenarioA, resultA)}
          inputsB={renderInputs('b_', scenarioB, resultB)}
          metrics={compareMetrics}
          onRemove={() => setState((prev) => ({ ...prev, cmp: '0' }))}
        />
      ) : (
        <CalcShell inputs={renderInputs('', scenarioA, resultA)} results={renderResults(resultA, scenarioA.dmode)} />
      )}
      {toolbar}
      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} slug={SLUG} title={TITLE} height={760} />
    </>
  );
}
