import { useMemo, useState, type ReactNode } from 'react';
import { formatCurrency, formatDollars, formatPercent } from '../../calc-core/money';
import {
  computeEscalation,
  DEFAULTS,
  ESC_MESSAGES,
  type EscCapMode,
  type EscInput,
  type EscType,
} from '../../calc-core/rentEscalation';
import { enumParam, numberParam, type ParamCodec, type ParamSchema } from '../../lib/urlState';
import { useUrlState } from '../../hooks/useUrlState';
import CalcShell from './CalcShell';
import ModeTabs from './ModeTabs';
import NumberInput from './NumberInput';
import ResultCard from './ResultCard';
import YearTable from './YearTable';
import LineChart from './LineChart';
import ShareBar from '../ShareBar';
import EmbedModal from '../EmbedModal';

const SLUG = 'rent-escalation-calculator';
const TITLE = 'Rent Escalation Calculator';

/** Comma-joined per-year rate list, preserving position (blank → NaN → incomplete). */
const schedParam: ParamCodec<number[]> = {
  default: [],
  parse: (raw) => (raw ? raw.split(',').map((s) => Number(s)) : []),
  serialize: (value) => (value.length ? value.join(',') : null),
};

const SCHEMA: ParamSchema<EscInput> = {
  type: enumParam<EscType>(['pct', 'step', 'cpi', 'custom'], DEFAULTS.type),
  start: numberParam(DEFAULTS.start),
  sf: numberParam(DEFAULTS.sf),
  term: numberParam(DEFAULTS.term),
  pct: numberParam(DEFAULTS.pct),
  step: numberParam(DEFAULTS.step),
  cpi: numberParam(DEFAULTS.cpi),
  cap: numberParam(DEFAULTS.cap),
  floor: numberParam(DEFAULTS.floor),
  freq: numberParam(DEFAULTS.freq),
  sched: schedParam,
  capMode: enumParam<EscCapMode>(['none', 'cumulative', 'non-cumulative'], DEFAULTS.capMode),
  capMax: numberParam(DEFAULTS.capMax),
};

const TYPE_OPTIONS = [
  { value: 'pct' as const, label: 'Fixed %' },
  { value: 'step' as const, label: 'Fixed step' },
  { value: 'cpi' as const, label: 'CPI' },
  { value: 'custom' as const, label: 'Custom' },
];

function detectEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/$/, '').endsWith('/embed') ||
    new URLSearchParams(window.location.search).get('embed') === '1';
}

export type RentEscalationCalculatorProps = { embed?: boolean };

export default function RentEscalationCalculator({ embed: embedProp }: RentEscalationCalculatorProps) {
  const [state, setState] = useUrlState<EscInput>(SCHEMA);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embed] = useState(() => embedProp ?? detectEmbed());

  const { type, start, sf, term, pct, step, cpi, cap, floor, freq, sched, capMode, capMax } = state;
  const years = Math.max(1, Math.floor(Number.isFinite(term) ? term : 1));

  const set = <K extends keyof EscInput>(key: K, value: EscInput[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // Custom schedule prefilled from `start` (SPEC.md §T6), materialised to `years` rows.
  const effectiveSched = useMemo(
    () => Array.from({ length: years }, (_, i) => (Number.isFinite(sched[i]) ? sched[i] : start)),
    [sched, years, start],
  );
  const computeInput: EscInput = type === 'custom' ? { ...state, sched: effectiveSched } : state;
  const result = useMemo(() => computeEscalation(computeInput), [JSON.stringify(computeInput)]);

  const setSchedRow = (i: number, value: number) => {
    const next = [...effectiveSched];
    next[i] = value;
    set('sched', next);
  };

  const capError = !result.ok && result.error === 'CAP_BELOW_FLOOR' ? ESC_MESSAGES.CAP_BELOW_FLOOR : undefined;

  const inputs = (
    <>
      <ModeTabs label="Escalation type" options={TYPE_OPTIONS} value={type} onChange={(v) => set('type', v)} />

      <NumberInput id="esc-start" label="Starting rent" value={start} onChange={(v) => set('start', v)} min={0} max={500} step={0.25} suffix="$/SF/yr" />
      <NumberInput id="esc-sf" label="Area" value={sf} onChange={(v) => set('sf', v)} min={100} max={2_000_000} step={100} suffix="SF" />
      <NumberInput id="esc-term" label="Term" value={term} onChange={(v) => set('term', v)} min={1} max={30} step={1} suffix="years" />
      <NumberInput id="esc-freq" label="Frequency" value={freq} onChange={(v) => set('freq', v)} min={1} max={5} step={1} suffix="every N yrs" tooltip="Escalations apply every N years; the rate holds flat in between." />

      {type === 'pct' && (
        <NumberInput id="esc-pct" label="Escalation" value={pct} onChange={(v) => set('pct', v)} min={0} max={15} step={0.25} suffix="%/yr" />
      )}
      {type === 'step' && (
        <NumberInput id="esc-step" label="Fixed step" value={step} onChange={(v) => set('step', v)} min={0} max={20} step={0.25} suffix="$/SF" />
      )}
      {type === 'cpi' && (
        <>
          <NumberInput id="esc-cpi" label="Assumed CPI" value={cpi} onChange={(v) => set('cpi', v)} min={0} max={15} step={0.25} suffix="%/yr" tooltip="v1 assumes a constant CPI. Real leases true up against actual CPI each year." />
          <NumberInput id="esc-floor" label="CPI floor" value={floor} onChange={(v) => set('floor', v)} min={0} max={15} step={0.25} suffix="%" />
          <NumberInput id="esc-cap" label="CPI cap" value={cap} onChange={(v) => set('cap', v)} min={0} max={15} step={0.25} suffix="%" errorText={capError} />
        </>
      )}
      {type === 'custom' && (
        <div className="space-y-2 rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm font-medium">Per-year rent ($/SF/yr)</p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {effectiveSched.map((rate, i) => (
              <NumberInput
                key={i}
                id={`esc-sched-${i}`}
                label={`Year ${i + 1}`}
                value={rate}
                onChange={(v) => setSchedRow(i, v)}
                min={0}
                max={500}
                step={0.25}
                suffix="$/SF"
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="esc-capMode" className="text-sm font-medium">Rent increase cap</label>
        <select
          id="esc-capMode"
          value={capMode}
          onChange={(e) => set('capMode', e.target.value as EscCapMode)}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <option value="none">No cap</option>
          <option value="cumulative">Cumulative</option>
          <option value="non-cumulative">Non-cumulative</option>
        </select>
      </div>
      {capMode !== 'none' && (
        <NumberInput id="esc-capMax" label="Rent cap" value={capMax} onChange={(v) => set('capMax', v)} min={0} max={15} step={0.25} suffix="%/yr" tooltip="Cumulative caps the ceiling off year 1; non-cumulative off the prior year's capped rate. They differ only on variable (custom) schedules." />
      )}
    </>
  );

  const results = (
    <>
      <div aria-live="polite">
        <ResultCard
          title="Escalation summary"
          emptyState={capError ?? ESC_MESSAGES.INCOMPLETE}
          rows={
            result.ok
              ? [
                  { label: `Final-year rate (yr ${result.schedule.length})`, value: formatCurrency(result.finalRate), emphasis: true },
                  { label: 'Total obligation', value: formatDollars(result.totalObligation), emphasis: true },
                  { label: 'Average rate / SF / yr', value: formatCurrency(result.avgRate) },
                  { label: 'Cumulative increase', value: formatPercent(result.cumIncrease) },
                  ...(capMode !== 'none' ? [{ label: 'Savings from cap', value: formatDollars(result.capSavings) }] : []),
                ]
              : []
          }
        />
      </div>
      {result.ok && result.warning && (
        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
          {ESC_MESSAGES[result.warning]}
        </p>
      )}
    </>
  );

  const scheduleView: ReactNode = result.ok ? (
    <div className="mt-6 space-y-4">
      <LineChart
        ariaLabel={`Rent per SF over ${result.schedule.length} years`}
        formatValue={formatCurrency}
        points={result.schedule.map((r) => ({ label: `Yr ${r.year}`, value: r.rate }))}
      />
      <YearTable
        rows={result.schedule}
        csvFileName="rent-escalation-schedule.csv"
        caption="Year-by-year rent escalation schedule"
        columns={[
          { header: 'Year', cell: (r) => String(r.year), csv: (r) => r.year },
          { header: '$/SF', align: 'right', cell: (r) => formatCurrency(r.rate), csv: (r) => r.rate.toFixed(2) },
          { header: 'Δ%', align: 'right', cell: (r) => (r.year === 1 ? '—' : formatPercent(r.deltaPct)), csv: (r) => (r.deltaPct * 100).toFixed(2) },
          { header: 'Monthly $', align: 'right', cell: (r) => formatDollars(r.monthly), csv: (r) => Math.round(r.monthly) },
          { header: 'Annual $', align: 'right', cell: (r) => formatDollars(r.annual), csv: (r) => Math.round(r.annual) },
        ]}
      />
    </div>
  ) : null;

  const toolbar = embed ? null : (
    <div className="mt-4" data-print-hide>
      <ShareBar
        onCopyLink={() => navigator.clipboard.writeText(window.location.href)}
        onEmbed={() => setEmbedOpen(true)}
        onReset={() => setState({ ...DEFAULTS })}
      />
    </div>
  );

  return (
    <>
      <CalcShell inputs={inputs} results={results} />
      {scheduleView}
      {toolbar}
      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} slug={SLUG} title={TITLE} height={780} />
    </>
  );
}
