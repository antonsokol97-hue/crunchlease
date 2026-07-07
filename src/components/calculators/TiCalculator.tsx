import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatCurrency, formatDollars } from '../../calc-core/money';
import {
  computeAllowance,
  computeAmortization,
  DEFAULTS,
  TI_MESSAGES,
  type TiInput,
  type TiSpaceType,
} from '../../calc-core/ti';
import { enumParam, numberParam, type ParamSchema } from '../../lib/urlState';
import { useUrlState } from '../../hooks/useUrlState';
import { useCalcTelemetry } from '../../hooks/useCalcTelemetry';
import CalcShell from './CalcShell';
import ModeTabs from './ModeTabs';
import NumberInput from './NumberInput';
import ResultCard from './ResultCard';
import YearTable from './YearTable';
import ShareBar from '../ShareBar';
import EmbedModal from '../EmbedModal';

const SLUG = 'tenant-improvement-calculator';
const TITLE = 'TI Allowance Calculator';

type TiTab = 'a' | 'b';
type TiUrlState = TiInput & { tab: TiTab };

const SPACE_TYPES: TiSpaceType[] = ['office-2g', 'office-wb', 'medical', 'retail', 'restaurant', 'industrial'];

const SCHEMA: ParamSchema<TiUrlState> = {
  sf: numberParam(DEFAULTS.sf),
  tia: numberParam(DEFAULTS.tia),
  cost: numberParam(DEFAULTS.cost),
  type: enumParam<TiSpaceType>(SPACE_TYPES, DEFAULTS.type),
  p: numberParam(DEFAULTS.p),
  rate: numberParam(DEFAULTS.rate),
  n: numberParam(DEFAULTS.n),
  lease: numberParam(DEFAULTS.lease),
  tab: enumParam<TiTab>(['a', 'b'], 'a'),
};

const DEFAULT_STATE: TiUrlState = { ...DEFAULTS, tab: 'a' };

const TAB_OPTIONS = [
  { value: 'a' as const, label: 'Allowance vs cost' },
  { value: 'b' as const, label: 'Amortization' },
];

// DRAFT: Anton to edit benchmark labels/ranges (SPEC.md Appendix A.3, directional).
const TI_BANDS: Record<TiSpaceType, { label: string; lo: number; hi: number; openTop?: boolean }> = {
  'office-2g': { label: 'second-generation office', lo: 10, hi: 30 },
  'office-wb': { label: 'new office / white box', lo: 30, hi: 60 },
  medical: { label: 'medical office', lo: 60, hi: 100, openTop: true },
  retail: { label: 'retail vanilla shell', lo: 20, hi: 50 },
  restaurant: { label: 'restaurant', lo: 100, hi: 250, openTop: true },
  industrial: { label: 'industrial / flex office portion', lo: 5, hi: 20 },
};

const SPACE_TYPE_LABELS: Record<TiSpaceType, string> = {
  'office-2g': 'Second-generation office',
  'office-wb': 'New office / white box',
  medical: 'Medical office',
  retail: 'Retail',
  restaurant: 'Restaurant',
  industrial: 'Industrial / flex',
};

function benchmarkVerdict(tia: number, type: TiSpaceType): string {
  const band = TI_BANDS[type];
  const range = `$${band.lo}–$${band.hi}${band.openTop ? '+' : ''}/SF`;
  if (tia < band.lo) return `Your ${formatCurrency(tia)}/SF allowance is below the typical ${range} range for ${band.label}.`;
  if (!band.openTop && tia > band.hi)
    return `Your ${formatCurrency(tia)}/SF allowance is above the typical ${range} range for ${band.label}.`;
  return `Your ${formatCurrency(tia)}/SF allowance sits within the typical ${range} range for ${band.label}.`;
}

function detectEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/$/, '').endsWith('/embed') ||
    new URLSearchParams(window.location.search).get('embed') === '1';
}

export type TiCalculatorProps = { embed?: boolean };

export default function TiCalculator({ embed: embedProp }: TiCalculatorProps) {
  const [state, setState] = useUrlState<TiUrlState>(SCHEMA);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embed] = useState(() => embedProp ?? detectEmbed());

  const { sf, tia, cost, type, p, rate, n, lease, tab } = state;

  const allowance = useMemo(() => computeAllowance({ sf, tia, cost }), [sf, tia, cost]);
  const amort = useMemo(() => computeAmortization({ p, rate, n, sf, lease }), [p, rate, n, sf, lease]);
  useCalcTelemetry(SLUG, JSON.stringify(state), tab === 'a' ? allowance.ok : amort.ok);

  // "p auto = gap from Tab A, editable" (§T3): p follows the gap until the user
  // edits it. Initialise the touched flag by comparing the URL's p to the gap.
  const [pEdited, setPEdited] = useState(() => (allowance.ok ? p !== allowance.gap : true));

  useEffect(() => {
    if (pEdited || !allowance.ok) return;
    if (p !== allowance.gap) setState((prev) => ({ ...prev, p: allowance.gap }));
  }, [allowance, p, pEdited, setState]);

  const set = <K extends keyof TiUrlState>(key: K, value: TiUrlState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const allowanceInputs = (
    <>
      <NumberInput id="ti-sf" label="Space" value={sf} onChange={(v) => set('sf', v)} min={100} max={500_000} step={100} suffix="SF" tooltip="Rentable area being built out. Shared with the amortization tab." />
      <NumberInput id="ti-tia" label="TI allowance" value={tia} onChange={(v) => set('tia', v)} min={0} max={500} step={1} suffix="$/SF" tooltip="Dollars per SF the landlord contributes toward improvements." />
      <NumberInput id="ti-cost" label="Estimated buildout cost" value={cost} onChange={(v) => set('cost', v)} min={0} max={800} step={1} suffix="$/SF" tooltip="Your contractor's estimated cost to build the space, per SF." />
      <div className="flex flex-col gap-1">
        <label htmlFor="ti-type" className="text-sm font-medium">Space type</label>
        <select
          id="ti-type"
          value={type}
          onChange={(e) => set('type', e.target.value as TiSpaceType)}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {SPACE_TYPES.map((t) => (
            <option key={t} value={t}>
              {SPACE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  const allowanceResults = (
    <>
      <div aria-live="polite">
        <ResultCard
          title="Allowance vs cost"
          emptyState={TI_MESSAGES.INCOMPLETE}
          rows={
            allowance.ok
              ? [
                  { label: 'Total allowance', value: formatDollars(allowance.totalTIA) },
                  { label: 'Total buildout cost', value: formatDollars(allowance.totalCost) },
                  { label: 'Gap to finance', value: formatDollars(allowance.gap), emphasis: true },
                  { label: 'Gap per SF', value: formatCurrency(allowance.gapPerSf) },
                ]
              : []
          }
        />
      </div>
      {allowance.ok && allowance.coversBuildout && (
        <p className="text-sm" style={{ color: 'var(--color-accent)' }}>
          {TI_MESSAGES.GAP_COVERED}
        </p>
      )}
      {allowance.ok && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {benchmarkVerdict(tia, type)}
        </p>
      )}
    </>
  );

  const amortInputs = (
    <>
      <NumberInput id="ti-p" label="Amount to amortize" value={p} onChange={(v) => { set('p', v); setPEdited(true); }} min={0} max={10_000_000} step={1000} suffix="$" tooltip="The shortfall financed into rent. Auto-filled from the Tab A gap until you edit it." helpText={pEdited ? 'Manual override — reset to sync with the gap again.' : 'Auto-filled from the allowance gap.'} />
      <NumberInput id="ti-rate" label="Interest rate" value={rate} onChange={(v) => set('rate', v)} min={0} max={20} step={0.25} suffix="%/yr" tooltip="Rate the landlord charges to finance the buildout, often 6–10%." />
      <NumberInput id="ti-n" label="Amortization term" value={n} onChange={(v) => set('n', v)} min={6} max={240} step={1} suffix="months" />
      <NumberInput id="ti-lease" label="Lease term (optional)" value={lease} onChange={(v) => set('lease', v)} min={6} max={240} step={1} suffix="months" tooltip="Used only to warn when amortization runs past the lease." />
    </>
  );

  const amortResults = (
    <>
      <div aria-live="polite">
        <ResultCard
          title="Amortized into rent"
          emptyState={TI_MESSAGES.INCOMPLETE}
          rows={
            amort.ok
              ? [
                  { label: 'Monthly payment', value: formatCurrency(amort.monthlyPayment), emphasis: true },
                  { label: 'Rent impact / SF / yr', value: formatCurrency(amort.rentAddPerSfYr), emphasis: true },
                  { label: 'Total repaid', value: formatDollars(amort.totalRepaid) },
                  { label: 'Total interest', value: formatDollars(amort.totalInterest) },
                ]
              : []
          }
        />
      </div>
      {amort.ok && amort.warning && (
        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
          {TI_MESSAGES[amort.warning]}
        </p>
      )}
    </>
  );

  const scheduleView: ReactNode =
    tab === 'b' && amort.ok ? (
      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium">Show amortization schedule</summary>
        <div className="mt-3">
          <YearTable
            tool={SLUG}
            rows={amort.schedule}
            csvFileName="ti-amortization-schedule.csv"
            caption="Month-by-month TI amortization schedule"
            columns={[
              { header: 'Month', cell: (r) => String(r.month), csv: (r) => r.month },
              { header: 'Payment', align: 'right', cell: (r) => formatCurrency(r.payment), csv: (r) => r.payment.toFixed(2) },
              { header: 'Interest', align: 'right', cell: (r) => formatCurrency(r.interest), csv: (r) => r.interest.toFixed(2) },
              { header: 'Principal', align: 'right', cell: (r) => formatCurrency(r.principal), csv: (r) => r.principal.toFixed(2) },
              { header: 'Balance', align: 'right', cell: (r) => formatCurrency(Math.max(0, r.balance)), csv: (r) => Math.max(0, r.balance).toFixed(2) },
            ]}
          />
        </div>
      </details>
    ) : null;

  const toolbar = embed ? null : (
    <div className="mt-4" data-print-hide>
      <ShareBar
        tool={SLUG}
        onCopyLink={() => navigator.clipboard.writeText(window.location.href)}
        onEmbed={() => setEmbedOpen(true)}
        onReset={() => {
          setState(DEFAULT_STATE);
          setPEdited(false);
        }}
      />
    </div>
  );

  return (
    <>
      <ModeTabs label="TI calculator mode" options={TAB_OPTIONS} value={tab} onChange={(v) => set('tab', v)} />
      <div className="mt-4">
        {tab === 'a' ? (
          <CalcShell inputs={allowanceInputs} results={allowanceResults} />
        ) : (
          <CalcShell inputs={amortInputs} results={amortResults} />
        )}
      </div>
      {scheduleView}
      {toolbar}
      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} slug={SLUG} title={TITLE} height={720} />
    </>
  );
}
