import { useMemo, useState, type ReactNode } from 'react';
import { formatCurrency, formatDollars, formatPercent } from '../../calc-core/money';
import {
  CAM_MESSAGES,
  computeEstimate,
  computeReconcile,
  ESTIMATE_DEFAULTS,
  RECONCILE_DEFAULTS,
  type CamCap,
  type CamEstimateResult,
  type CamReconcileResult,
} from '../../calc-core/cam';
import { enumParam, numberParam, type ParamSchema } from '../../lib/urlState';
import { useUrlState } from '../../hooks/useUrlState';
import CalcShell from './CalcShell';
import ModeTabs from './ModeTabs';
import NumberInput from './NumberInput';
import ResultCard from './ResultCard';
import YearTable from './YearTable';
import ShareBar from '../ShareBar';
import EmbedModal from '../EmbedModal';

const SLUG = 'cam-calculator';
const TITLE = 'CAM Charges Calculator';

type CamMode = 'estimate' | 'reconcile';

// TODO(SPEC.md §T2): the spec lists the seven itemize line items but gives no
// per-item defaults; they start at 0, so opening Itemize with no entries yields
// the spec's "sum of 0 → incomplete" state until values are typed.
const ITEMS = [
  { key: 'landscaping', label: 'Landscaping' },
  { key: 'snow', label: 'Snow removal' },
  { key: 'parking', label: 'Parking / lot repairs' },
  { key: 'utilities', label: 'Common utilities' },
  { key: 'security', label: 'Security' },
  { key: 'janitorial', label: 'Janitorial' },
  { key: 'otherItem', label: 'Other' },
] as const;

type ItemKey = (typeof ITEMS)[number]['key'];

type CamUrlState = {
  mode: CamMode;
  sf: number;
  gla: number;
  camT: number;
  admin: number;
  growth: number;
  years: number;
  cap: CamCap;
  capPct: number;
  paid: number;
  months: number;
  actual: number;
  itemize: string;
} & Record<ItemKey, number>;

const SCHEMA: ParamSchema<CamUrlState> = {
  mode: enumParam<CamMode>(['estimate', 'reconcile'], 'estimate'),
  sf: numberParam(ESTIMATE_DEFAULTS.sf),
  gla: numberParam(ESTIMATE_DEFAULTS.gla),
  camT: numberParam(ESTIMATE_DEFAULTS.camT),
  admin: numberParam(ESTIMATE_DEFAULTS.admin),
  growth: numberParam(ESTIMATE_DEFAULTS.growth),
  years: numberParam(ESTIMATE_DEFAULTS.years),
  cap: enumParam<CamCap>(['none', 'annual'], ESTIMATE_DEFAULTS.cap),
  capPct: numberParam(ESTIMATE_DEFAULTS.capPct),
  paid: numberParam(RECONCILE_DEFAULTS.paid),
  months: numberParam(RECONCILE_DEFAULTS.months),
  actual: numberParam(RECONCILE_DEFAULTS.actual),
  itemize: enumParam(['0', '1'], '0'),
  landscaping: numberParam(0),
  snow: numberParam(0),
  parking: numberParam(0),
  utilities: numberParam(0),
  security: numberParam(0),
  janitorial: numberParam(0),
  otherItem: numberParam(0),
};

const DEFAULT_STATE: CamUrlState = {
  mode: 'estimate',
  sf: ESTIMATE_DEFAULTS.sf,
  gla: ESTIMATE_DEFAULTS.gla,
  camT: ESTIMATE_DEFAULTS.camT,
  admin: ESTIMATE_DEFAULTS.admin,
  growth: ESTIMATE_DEFAULTS.growth,
  years: ESTIMATE_DEFAULTS.years,
  cap: ESTIMATE_DEFAULTS.cap,
  capPct: ESTIMATE_DEFAULTS.capPct,
  paid: RECONCILE_DEFAULTS.paid,
  months: RECONCILE_DEFAULTS.months,
  actual: RECONCILE_DEFAULTS.actual,
  itemize: '0',
  landscaping: 0,
  snow: 0,
  parking: 0,
  utilities: 0,
  security: 0,
  janitorial: 0,
  otherItem: 0,
};

const MODE_OPTIONS = [
  { value: 'estimate' as const, label: 'Estimate' },
  { value: 'reconcile' as const, label: 'Reconcile' },
];

function detectEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/$/, '').endsWith('/embed') ||
    new URLSearchParams(window.location.search).get('embed') === '1';
}

function reconcileVerdict(result: Extract<CamReconcileResult, { ok: true }>): string {
  if (result.direction === 'due') return `You owe ${formatDollars(result.balance)} at year-end reconciliation.`;
  if (result.direction === 'credit') return `You're owed a ${formatDollars(-result.balance)} credit.`;
  return 'Fully reconciled — no true-up.';
}

export type CamCalculatorProps = { embed?: boolean };

export default function CamCalculator({ embed: embedProp }: CamCalculatorProps) {
  const [state, setState] = useUrlState<CamUrlState>(SCHEMA);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embed] = useState(() => embedProp ?? detectEmbed());

  const { mode, sf, gla, camT, admin, growth, years, cap, capPct, paid, months, actual, itemize } = state;
  const itemizing = itemize === '1';

  const set = <K extends keyof CamUrlState>(key: K, value: CamUrlState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const itemsSum = ITEMS.reduce((sum, item) => sum + (state[item.key] || 0), 0);
  const effectiveCamT = itemizing ? itemsSum : camT;
  const itemizeIncomplete = itemizing && itemsSum === 0;

  const estimateRaw = useMemo(
    () => computeEstimate({ sf, gla, camT: effectiveCamT, admin, growth, years, cap, capPct }),
    [sf, gla, effectiveCamT, admin, growth, years, cap, capPct],
  );
  const estimate: CamEstimateResult = itemizeIncomplete ? { ok: false, error: 'INCOMPLETE' } : estimateRaw;
  const reconcile = useMemo(
    () => computeReconcile({ sf, gla, admin, actual, paid, months }),
    [sf, gla, admin, actual, paid, months],
  );

  const glaError = (result: CamEstimateResult | CamReconcileResult) =>
    !result.ok && result.error === 'TENANT_EXCEEDS_GLA' ? CAM_MESSAGES.TENANT_EXCEEDS_GLA : undefined;
  const emptyStateFor = (result: CamEstimateResult | CamReconcileResult) =>
    !result.ok && result.error === 'TENANT_EXCEEDS_GLA' ? CAM_MESSAGES.TENANT_EXCEEDS_GLA : CAM_MESSAGES.INCOMPLETE;

  const sharedAreaInputs = (result: CamEstimateResult | CamReconcileResult) => (
    <>
      <NumberInput id="cam-sf" label="Tenant area" value={sf} onChange={(v) => set('sf', v)} min={100} max={2_000_000} step={100} suffix="SF" />
      <NumberInput id="cam-gla" label="Building GLA" value={gla} onChange={(v) => set('gla', v)} min={100} max={2_000_000} step={100} suffix="SF" errorText={glaError(result)} tooltip="Gross leasable area of the whole property — the denominator of your pro-rata share." />
      <NumberInput id="cam-admin" label="Admin fee" value={admin} onChange={(v) => set('admin', v)} min={0} max={25} step={1} suffix="%" tooltip="Management/admin fee landlords add to CAM, typically 10–15%." />
    </>
  );

  const estimateInputs = (
    <>
      {sharedAreaInputs(estimate)}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={itemizing} onChange={(e) => set('itemize', e.target.checked ? '1' : '0')} />
        Itemize CAM budget
      </label>

      {itemizing ? (
        <div className="space-y-3 rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
          {ITEMS.map((item) => (
            <NumberInput
              key={item.key}
              id={`cam-${item.key}`}
              label={item.label}
              value={state[item.key]}
              onChange={(v) => set(item.key, v)}
              min={0}
              step={1000}
              suffix="$/yr"
            />
          ))}
          <p className="text-sm font-medium">Total CAM: {formatDollars(itemsSum)}/yr</p>
        </div>
      ) : (
        <NumberInput id="cam-camT" label="Total annual CAM" value={camT} onChange={(v) => set('camT', v)} min={0} step={1000} suffix="$/yr" />
      )}

      <NumberInput id="cam-growth" label="Annual CAM growth" value={growth} onChange={(v) => set('growth', v)} min={0} max={20} step={0.5} suffix="%/yr" />
      <NumberInput id="cam-years" label="Projection" value={years} onChange={(v) => set('years', v)} min={1} max={15} step={1} suffix="years" />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cap === 'annual'} onChange={(e) => set('cap', e.target.checked ? 'annual' : 'none')} />
        Cap annual CAM increases
      </label>
      {cap === 'annual' && (
        <NumberInput id="cam-capPct" label="Annual cap" value={capPct} onChange={(v) => set('capPct', v)} min={0} max={15} step={0.5} suffix="%/yr" tooltip={CAM_MESSAGES.CAP_SCOPE_DISCLOSURE} />
      )}
    </>
  );

  const reconcileInputs = (
    <>
      {sharedAreaInputs(reconcile)}
      <NumberInput id="cam-actual" label="Actual annual CAM" value={actual} onChange={(v) => set('actual', v)} min={0} step={1000} suffix="$/yr" tooltip="The landlord's audited year-end CAM total for the building." />
      <NumberInput id="cam-paid" label="Monthly estimate paid" value={paid} onChange={(v) => set('paid', v)} min={0} step={50} suffix="$/mo" />
      <NumberInput id="cam-months" label="Months paid" value={months} onChange={(v) => set('months', v)} min={1} max={12} step={1} suffix="months" />
    </>
  );

  const estimateResults = (
    <div aria-live="polite">
      <ResultCard
        title="Estimated CAM (year 1)"
        emptyState={emptyStateFor(estimate)}
        rows={
          estimate.ok
            ? [
                { label: 'Pro-rata share', value: formatPercent(estimate.proRata) },
                { label: 'Tenant CAM / year', value: formatDollars(estimate.annual), emphasis: true },
                { label: 'CAM / SF / yr', value: formatCurrency(estimate.perSf) },
                { label: 'CAM / month', value: formatCurrency(estimate.monthly) },
                ...(cap === 'annual' ? [{ label: 'Savings from cap', value: formatDollars(estimate.capSavings) }] : []),
              ]
            : []
        }
      />
    </div>
  );

  const reconcileResults = (
    <>
      <div aria-live="polite">
        <ResultCard
          title="Year-end reconciliation"
          emptyState={emptyStateFor(reconcile)}
          rows={
            reconcile.ok
              ? [
                  { label: 'Pro-rata share', value: formatPercent(reconcile.proRata) },
                  { label: 'Tenant share of actuals', value: formatDollars(reconcile.share) },
                  { label: 'Total paid', value: formatDollars(reconcile.totalPaid) },
                  {
                    label: reconcile.direction === 'credit' ? 'Credit due' : 'Balance due',
                    value: formatDollars(Math.abs(reconcile.balance)),
                    emphasis: true,
                  },
                ]
              : []
          }
        />
      </div>
      {reconcile.ok && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {reconcileVerdict(reconcile)}
        </p>
      )}
    </>
  );

  const projectionView: ReactNode =
    mode === 'estimate' && estimate.ok ? (
      <div className="mt-6">
        <YearTable
          rows={estimate.schedule}
          csvFileName="cam-projection.csv"
          caption="CAM projection, uncapped vs capped"
          columns={[
            { header: 'Year', cell: (r) => String(r.year), csv: (r) => r.year },
            { header: 'Uncapped $/yr', align: 'right', cell: (r) => formatDollars(r.uncapped), csv: (r) => Math.round(r.uncapped) },
            { header: 'Billed $/yr', align: 'right', cell: (r) => formatDollars(r.allowed), csv: (r) => Math.round(r.allowed) },
            { header: '$/SF', align: 'right', cell: (r) => formatCurrency(r.allowed / sf), csv: (r) => (r.allowed / sf).toFixed(2) },
          ]}
        />
      </div>
    ) : null;

  const toolbar = embed ? null : (
    <div className="mt-4" data-print-hide>
      <ShareBar
        onCopyLink={() => navigator.clipboard.writeText(window.location.href)}
        onEmbed={() => setEmbedOpen(true)}
        onReset={() => setState(DEFAULT_STATE)}
      />
    </div>
  );

  return (
    <>
      <ModeTabs label="CAM calculator mode" options={MODE_OPTIONS} value={mode} onChange={(v) => set('mode', v)} />
      <div className="mt-4">
        {mode === 'estimate' ? (
          <CalcShell inputs={estimateInputs} results={estimateResults} />
        ) : (
          <CalcShell inputs={reconcileInputs} results={reconcileResults} />
        )}
      </div>
      {projectionView}
      {toolbar}
      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} slug={SLUG} title={TITLE} height={720} />
    </>
  );
}
