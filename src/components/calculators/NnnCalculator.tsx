import { useMemo, useState, type ReactNode } from 'react';
import { formatCurrency, formatDollars, formatPercent } from '../../calc-core/money';
import { computeNnn, DEFAULTS, NNN_MESSAGES, type NnnInput, type NnnMode, type NnnResult } from '../../calc-core/nnn';
import { enumParam, numberParam, type ParamCodec, type ParamSchema } from '../../lib/urlState';
import { useUrlState } from '../../hooks/useUrlState';
import CalcShell from './CalcShell';
import ModeTabs from './ModeTabs';
import NumberInput from './NumberInput';
import ResultCard, { type ResultRow } from './ResultCard';
import YearTable from './YearTable';
import StackedBarChart from './StackedBarChart';
import ScenarioCompare, { type CompareMetric } from './ScenarioCompare';
import ShareBar from '../ShareBar';
import EmbedModal from '../EmbedModal';

const SLUG = 'nnn-lease-calculator';
const TITLE = 'NNN Lease Calculator';

const NUM_FIELDS = [
  'sf', 'base', 'tax', 'ins', 'cam', 'other',
  'bldg', 'taxT', 'insT', 'camT', 'otherT',
  'admin', 'esc', 'nnng', 'term',
] as const satisfies readonly (keyof NnnInput)[];

type Prefix = '' | 'b_';

// Flat URL state: scenario A (no prefix) + compare flag + scenario B (b_ prefix).
type NnnUrlState = NnnInput & { cmp: string } & { [K in keyof NnnInput as `b_${string & K}`]: NnnInput[K] };

function scenarioParams(prefix: Prefix): Record<string, ParamCodec<number> | ParamCodec<NnnMode>> {
  const out: Record<string, ParamCodec<number> | ParamCodec<NnnMode>> = {
    [`${prefix}mode`]: enumParam<NnnMode>(['psf', 'totals'], DEFAULTS.mode),
  };
  for (const f of NUM_FIELDS) out[`${prefix}${f}`] = numberParam(DEFAULTS[f]);
  return out;
}

const SCHEMA = {
  ...scenarioParams(''),
  cmp: enumParam(['0', '1'], '0'),
  ...scenarioParams('b_'),
} as ParamSchema<NnnUrlState>;

const DEFAULT_STATE: NnnUrlState = (() => {
  const base = { ...DEFAULTS, cmp: '0' } as Record<string, unknown>;
  base.b_mode = DEFAULTS.mode;
  for (const f of NUM_FIELDS) base[`b_${f}`] = DEFAULTS[f];
  return base as NnnUrlState;
})();

const MODE_OPTIONS = [
  { value: 'psf' as const, label: 'Per-SF rates' },
  { value: 'totals' as const, label: 'Building totals' },
];

function detectEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/$/, '').endsWith('/embed') ||
    new URLSearchParams(window.location.search).get('embed') === '1';
}

function extractScenario(state: NnnUrlState, prefix: Prefix): NnnInput {
  const s = state as Record<string, unknown>;
  const out = { mode: s[`${prefix}mode`] as NnnMode } as Record<string, unknown>;
  for (const f of NUM_FIELDS) out[f] = s[`${prefix}${f}`] as number;
  return out as NnnInput;
}

export type NnnCalculatorProps = { embed?: boolean };

export default function NnnCalculator({ embed: embedProp }: NnnCalculatorProps) {
  const [state, setState] = useUrlState<NnnUrlState>(SCHEMA);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embed] = useState(() => embedProp ?? detectEmbed());

  const compareOn = state.cmp === '1';
  const scenarioA = extractScenario(state, '');
  const scenarioB = extractScenario(state, 'b_');
  const resultA = useMemo(() => computeNnn(scenarioA), [JSON.stringify(scenarioA)]);
  const resultB = useMemo(() => computeNnn(scenarioB), [JSON.stringify(scenarioB)]);

  const setField = (prefix: Prefix, field: keyof NnnInput, value: number | NnnMode) => {
    const key = `${prefix}${field}` as keyof NnnUrlState;
    setState((prev) => ({ ...prev, [key]: value }) as NnnUrlState);
  };

  const enableCompare = () =>
    setState((prev) => {
      const next = { ...prev, cmp: '1' } as Record<string, unknown>;
      next.b_mode = prev.mode;
      for (const f of NUM_FIELDS) next[`b_${f}`] = (prev as Record<string, unknown>)[f];
      return next as NnnUrlState;
    });

  const renderInputs = (prefix: Prefix, scenario: NnnInput, result: NnnResult): ReactNode => {
    const bldgError =
      !result.ok && result.error === 'LEASED_EXCEEDS_BUILDING' ? NNN_MESSAGES.LEASED_EXCEEDS_BUILDING : undefined;

    return (
      <>
        <ModeTabs
          label="Input mode"
          options={MODE_OPTIONS}
          value={scenario.mode}
          onChange={(mode) => setField(prefix, 'mode', mode)}
        />

        <NumberInput
          id={`${prefix}sf`}
          label="Leased area"
          value={scenario.sf}
          onChange={(v) => setField(prefix, 'sf', v)}
          min={100}
          max={2_000_000}
          step={100}
          suffix="SF"
        />
        <NumberInput
          id={`${prefix}base`}
          label="Base rent"
          value={scenario.base}
          onChange={(v) => setField(prefix, 'base', v)}
          min={0}
          max={500}
          step={0.25}
          suffix="$/SF/yr"
        />

        {scenario.mode === 'psf' ? (
          <>
            <NumberInput id={`${prefix}tax`} label="Property taxes" value={scenario.tax} onChange={(v) => setField(prefix, 'tax', v)} min={0} max={50} step={0.25} suffix="$/SF/yr" />
            <NumberInput id={`${prefix}ins`} label="Insurance" value={scenario.ins} onChange={(v) => setField(prefix, 'ins', v)} min={0} max={20} step={0.25} suffix="$/SF/yr" />
            <NumberInput id={`${prefix}cam`} label="CAM" value={scenario.cam} onChange={(v) => setField(prefix, 'cam', v)} min={0} max={50} step={0.25} suffix="$/SF/yr" />
            <details>
              <summary className="cursor-pointer text-sm" style={{ color: 'var(--color-text-muted)' }}>Other recoverables</summary>
              <div className="mt-2">
                <NumberInput id={`${prefix}other`} label="Other recoverables" value={scenario.other} onChange={(v) => setField(prefix, 'other', v)} min={0} max={50} step={0.25} suffix="$/SF/yr" />
              </div>
            </details>
          </>
        ) : (
          <>
            <NumberInput id={`${prefix}bldg`} label="Building area (RSF)" value={scenario.bldg} onChange={(v) => setField(prefix, 'bldg', v)} min={100} max={2_000_000} step={100} suffix="SF" errorText={bldgError} />
            <NumberInput id={`${prefix}taxT`} label="Annual property taxes" value={scenario.taxT} onChange={(v) => setField(prefix, 'taxT', v)} min={0} step={1000} suffix="$/yr" />
            <NumberInput id={`${prefix}insT`} label="Annual insurance" value={scenario.insT} onChange={(v) => setField(prefix, 'insT', v)} min={0} step={1000} suffix="$/yr" />
            <NumberInput id={`${prefix}camT`} label="Annual CAM" value={scenario.camT} onChange={(v) => setField(prefix, 'camT', v)} min={0} step={1000} suffix="$/yr" />
            <details>
              <summary className="cursor-pointer text-sm" style={{ color: 'var(--color-text-muted)' }}>Other recoverables</summary>
              <div className="mt-2">
                <NumberInput id={`${prefix}otherT`} label="Annual other recoverables" value={scenario.otherT} onChange={(v) => setField(prefix, 'otherT', v)} min={0} step={1000} suffix="$/yr" />
              </div>
            </details>
          </>
        )}

        {/* TODO(SPEC.md §5): NumberInput shows the definition as help text below the
            field; the spec asks for a (?) tooltip icon. Refine with the design tokens. */}
        <NumberInput id={`${prefix}admin`} label="Admin fee on CAM" value={scenario.admin} onChange={(v) => setField(prefix, 'admin', v)} min={0} max={25} step={1} suffix="%" helpText="Management/admin fee landlords add to CAM, typically 10–15%." />
        <NumberInput id={`${prefix}esc`} label="Base rent escalation" value={scenario.esc} onChange={(v) => setField(prefix, 'esc', v)} min={0} max={15} step={0.25} suffix="%/yr" />
        <NumberInput id={`${prefix}nnng`} label="NNN growth assumption" value={scenario.nnng} onChange={(v) => setField(prefix, 'nnng', v)} min={0} max={15} step={0.25} suffix="%/yr" helpText="NNN charges float on actual expenses; this models expected growth." />
        <NumberInput id={`${prefix}term`} label="Lease term" value={scenario.term} onChange={(v) => setField(prefix, 'term', v)} min={1} max={30} step={1} suffix="years" />
      </>
    );
  };

  const resultRows = (result: NnnResult): ResultRow[] => {
    if (!result.ok) return [];
    const rows: ResultRow[] = [
      { label: 'NNN charges / SF / yr', value: formatCurrency(result.nnnPerSf) },
      { label: 'NNN / month', value: formatDollars(result.annualNnn / 12) },
      { label: 'NNN / year', value: formatDollars(result.annualNnn) },
      { label: 'All-in rent / SF / yr', value: formatCurrency(result.grossPerSf), emphasis: true },
      { label: 'All-in / month', value: formatDollars(result.monthlyTotal) },
      { label: 'All-in / year', value: formatDollars(result.annualTotal) },
    ];
    if (result.proRata !== null) {
      rows.push({ label: 'Pro-rata share', value: formatPercent(result.proRata) });
    }
    rows.push({
      label: `Total obligation (${result.schedule.length} yr)`,
      value: formatDollars(result.totalObligation),
      emphasis: true,
    });
    return rows;
  };

  const emptyStateFor = (result: NnnResult): string =>
    !result.ok && result.error === 'LEASED_EXCEEDS_BUILDING'
      ? NNN_MESSAGES.LEASED_EXCEEDS_BUILDING
      : NNN_MESSAGES.INCOMPLETE;

  const renderResults = (result: NnnResult): ReactNode => (
    <>
      <div aria-live="polite">
        <ResultCard rows={resultRows(result)} emptyState={emptyStateFor(result)} title="Occupancy cost (year 1)" />
      </div>
      {result.ok && result.warning && (
        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
          {NNN_MESSAGES[result.warning]}
        </p>
      )}
    </>
  );

  const compareMetrics: CompareMetric[] = [
    { label: 'All-in rent / SF / yr (yr 1)', a: resultA.ok ? resultA.grossPerSf : null, b: resultB.ok ? resultB.grossPerSf : null, format: formatCurrency },
    { label: 'All-in / month (yr 1)', a: resultA.ok ? resultA.monthlyTotal : null, b: resultB.ok ? resultB.monthlyTotal : null, format: formatDollars },
    { label: 'All-in / year (yr 1)', a: resultA.ok ? resultA.annualTotal : null, b: resultB.ok ? resultB.annualTotal : null, format: formatDollars },
    { label: 'Total obligation', a: resultA.ok ? resultA.totalObligation : null, b: resultB.ok ? resultB.totalObligation : null, format: formatDollars },
  ];

  const scheduleView = resultA.ok ? (
    <div className="mt-6 space-y-4">
      {compareOn && <p className="text-sm font-medium">Scenario A schedule</p>}
      <StackedBarChart
        ariaLabel={`Annual base rent vs NNN charges over ${resultA.schedule.length} years`}
        formatValue={formatDollars}
        bars={resultA.schedule.map((row) => ({
          label: `Yr ${row.year}`,
          segments: [
            { label: 'Base rent', value: row.basePerSf * scenarioA.sf, color: 'var(--color-accent)' },
            { label: 'NNN', value: row.nnnPerSf * scenarioA.sf, color: 'var(--color-text-muted)' },
          ],
        }))}
      />
      <YearTable
        rows={resultA.schedule}
        csvFileName="nnn-lease-schedule.csv"
        caption="Year-by-year NNN lease schedule"
        columns={[
          { header: 'Year', cell: (r) => String(r.year), csv: (r) => r.year },
          { header: 'Base $/SF', align: 'right', cell: (r) => formatCurrency(r.basePerSf), csv: (r) => r.basePerSf.toFixed(2) },
          { header: 'NNN $/SF', align: 'right', cell: (r) => formatCurrency(r.nnnPerSf), csv: (r) => r.nnnPerSf.toFixed(2) },
          { header: 'Gross $/SF', align: 'right', cell: (r) => formatCurrency(r.grossPerSf), csv: (r) => r.grossPerSf.toFixed(2) },
          { header: 'Monthly $', align: 'right', cell: (r) => formatDollars(r.monthly), csv: (r) => Math.round(r.monthly) },
          { header: 'Annual $', align: 'right', cell: (r) => formatDollars(r.annual), csv: (r) => Math.round(r.annual) },
        ]}
      />
    </div>
  ) : null;

  const toolbar = embed ? null : (
    <div className="mt-4 flex flex-wrap items-center gap-2" data-print-hide>
      {!compareOn && (
        <button
          type="button"
          onClick={enableCompare}
          className="rounded-md border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--color-border)' }}
        >
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
      {scheduleView}

      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} slug={SLUG} title={TITLE} height={760} />
    </>
  );
}
