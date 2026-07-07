import { useMemo, useState } from 'react';
import { formatCurrency, formatDollars, formatPerSf, formatPercent, formatSf } from '../../calc-core/money';
import {
  computeLoadFactor,
  DEFAULTS,
  LOAD_FACTOR_MESSAGES,
  type LoadFactorInput,
  type LoadFactorSolve,
} from '../../calc-core/loadFactor';
import { enumParam, numberParam, type ParamSchema } from '../../lib/urlState';
import { useUrlState } from '../../hooks/useUrlState';
import CalcShell from './CalcShell';
import NumberInput from './NumberInput';
import UnitToggle from './UnitToggle';
import ResultCard, { type ResultRow } from './ResultCard';
import RentInput from './RentInput';
import ShareBar from '../ShareBar';
import EmbedModal from '../EmbedModal';

const SLUG = 'load-factor-calculator';
const TITLE = 'Load Factor Calculator';

type LoadFactorUrlState = LoadFactorInput & {
  /** Compare mode toggle ('1' = on). */
  cmp: string;
  /** Building B load factor (%) — shared USF, own load factor + rent. */
  lfB: number;
  /** Building B quoted rent ($/RSF/yr). */
  rentB: number;
};

// TODO(SPEC.md §T5): the spec doesn't give Building B defaults for compare mode.
// Defaulting B to a heavier 20% load factor so switching compare on immediately
// shows a meaningful $/USF delta against A's 15%.
const SCHEMA: ParamSchema<LoadFactorUrlState> = {
  solve: enumParam<LoadFactorSolve>(['lf', 'rsf', 'usf'], DEFAULTS.solve),
  usf: numberParam(DEFAULTS.usf),
  rsf: numberParam(DEFAULTS.rsf),
  lf: numberParam(DEFAULTS.lf),
  rent: numberParam(DEFAULTS.rent),
  cmp: enumParam(['0', '1'], '0'),
  lfB: numberParam(20),
  rentB: numberParam(30),
};

const SOLVE_OPTIONS = [
  { value: 'rsf' as const, label: 'Rentable SF' },
  { value: 'usf' as const, label: 'Usable SF' },
  { value: 'lf' as const, label: 'Load factor' },
];

function detectEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  // Works for both the prerendered /…/embed/ route and a dev-time ?embed=1.
  return window.location.pathname.replace(/\/$/, '').endsWith('/embed') ||
    new URLSearchParams(window.location.search).get('embed') === '1';
}

export type LoadFactorCalculatorProps = {
  /** Render in embed mode (hides the share action row). Auto-detected from the URL when omitted. */
  embed?: boolean;
};

export default function LoadFactorCalculator({ embed: embedProp }: LoadFactorCalculatorProps) {
  const [state, setState] = useUrlState<LoadFactorUrlState>(SCHEMA);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embed] = useState(() => embedProp ?? detectEmbed());

  const { solve, usf, rsf, lf, rent, cmp, lfB, rentB } = state;
  const compareOn = cmp === '1';

  const resultA = useMemo(() => computeLoadFactor({ solve, usf, rsf, lf, rent }), [solve, usf, rsf, lf, rent]);

  const set = <K extends keyof LoadFactorUrlState>(key: K, value: LoadFactorUrlState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // Shared usable SF for compare mode — the resolved value from Building A.
  const sharedUsf = resultA.ok ? resultA.usf : usf;
  const resultB = useMemo(
    () => computeLoadFactor({ solve: 'rsf', usf: sharedUsf, rsf: 0, lf: lfB, rent: rentB }),
    [sharedUsf, lfB, rentB],
  );

  const rsfError = !resultA.ok && resultA.error === 'RSF_LESS_THAN_USF' ? LOAD_FACTOR_MESSAGES.RSF_LESS_THAN_USF : undefined;

  const rows: ResultRow[] = resultA.ok
    ? [
        { label: 'Rentable SF (RSF)', value: formatSf(resultA.rsf), emphasis: solve === 'rsf' },
        { label: 'Usable SF (USF)', value: formatSf(resultA.usf), emphasis: solve === 'usf' },
        { label: 'Load factor', value: formatPercent(resultA.loadFactor), emphasis: solve === 'lf' },
        { label: 'Loss factor', value: formatPercent(resultA.lossFactor) },
        ...(resultA.effectivePerUSF !== null
          ? [{ label: 'Effective rent', value: formatPerSf(resultA.effectivePerUSF, 'USF'), emphasis: true }]
          : []),
      ]
    : [];

  const resultsEmptyState =
    !resultA.ok && resultA.error === 'RSF_LESS_THAN_USF'
      ? LOAD_FACTOR_MESSAGES.RSF_LESS_THAN_USF
      : LOAD_FACTOR_MESSAGES.INCOMPLETE;

  const inputs = (
    <>
      <UnitToggle
        label="Solve for"
        options={SOLVE_OPTIONS}
        value={solve}
        onChange={(value) => set('solve', value)}
      />

      {solve !== 'usf' && (
        <NumberInput
          id="lf-usf"
          label="Usable SF (USF)"
          value={usf}
          onChange={(value) => set('usf', value)}
          min={100}
          max={2_000_000}
          suffix="SF"
        />
      )}

      {solve !== 'rsf' && (
        <NumberInput
          id="lf-rsf"
          label="Rentable SF (RSF)"
          value={rsf}
          onChange={(value) => set('rsf', value)}
          min={100}
          max={2_000_000}
          suffix="SF"
          errorText={rsfError}
        />
      )}

      {solve !== 'lf' && (
        <NumberInput
          id="lf-lf"
          label="Load factor"
          value={lf}
          onChange={(value) => set('lf', value)}
          min={0}
          max={60}
          step={0.5}
          suffix="%"
        />
      )}

      <RentInput
        id="lf-rent"
        label="Quoted rent"
        valuePerYr={rent}
        onChangePerYr={(value) => set('rent', value)}
        minPerYr={0}
        maxPerYr={500}
        unitLabel="RSF"
        helpText="Optional — leave at 0 to hide the cost-impact output."
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={compareOn}
          onChange={(event) => set('cmp', event.target.checked ? '1' : '0')}
        />
        Compare two buildings
      </label>

      {compareOn && (
        <div className="space-y-4 rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm font-medium">Building B (same usable SF)</p>
          <NumberInput
            id="lf-lfB"
            label="Load factor"
            value={lfB}
            onChange={(value) => set('lfB', value)}
            min={0}
            max={60}
            step={0.5}
            suffix="%"
          />
          <RentInput
            id="lf-rentB"
            label="Quoted rent"
            valuePerYr={rentB}
            onChangePerYr={(value) => set('rentB', value)}
            minPerYr={0}
            maxPerYr={500}
            unitLabel="RSF"
          />
        </div>
      )}
    </>
  );

  const results = (
    <>
      <div aria-live="polite">
        <ResultCard rows={rows} emptyState={resultsEmptyState} title="Results" />
      </div>

      {resultA.ok && resultA.warning && (
        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
          {LOAD_FACTOR_MESSAGES[resultA.warning]}
        </p>
      )}

      {compareOn && (
        <CompareTable
          aEffective={resultA.ok ? resultA.effectivePerUSF : null}
          bEffective={resultB.ok ? resultB.effectivePerUSF : null}
          sharedUsf={sharedUsf}
        />
      )}
    </>
  );

  const shareBar = embed ? undefined : (
    <ShareBar
      onCopyLink={() => navigator.clipboard.writeText(window.location.href)}
      onEmbed={() => setEmbedOpen(true)}
      onReset={() => setState({ ...DEFAULTS, cmp: '0', lfB: 20, rentB: 30 })}
    />
  );

  return (
    <>
      <CalcShell inputs={inputs} results={results} shareBar={shareBar} />
      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} slug={SLUG} title={TITLE} />
    </>
  );
}

function CompareTable({
  aEffective,
  bEffective,
  sharedUsf,
}: {
  aEffective: number | null;
  bEffective: number | null;
  sharedUsf: number;
}) {
  if (aEffective === null || bEffective === null) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Enter a quoted rent for both buildings to compare cost per usable foot.
      </p>
    );
  }

  const aWins = aEffective <= bEffective;
  const deltaPerYear = Math.abs(aEffective - bEffective) * sharedUsf;
  const winnerStyle = { color: 'var(--color-accent)', fontWeight: 600 };

  return (
    <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: 'var(--color-surface)' }}>
      <h3 className="mb-3 font-semibold">Cost per usable foot</h3>
      <div className="flex justify-between">
        <span>Building A</span>
        <span style={aWins ? winnerStyle : undefined}>{formatCurrency(aEffective)} /USF/yr</span>
      </div>
      <div className="mt-1 flex justify-between">
        <span>Building B</span>
        <span style={!aWins ? winnerStyle : undefined}>{formatCurrency(bEffective)} /USF/yr</span>
      </div>
      <div className="mt-2 flex justify-between border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
        <span>{aWins ? 'Building A' : 'Building B'} is cheaper by</span>
        <span className="font-medium">{formatDollars(deltaPerYear)} /yr</span>
      </div>
    </div>
  );
}
