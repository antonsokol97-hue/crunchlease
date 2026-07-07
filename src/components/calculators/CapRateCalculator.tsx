import { useMemo, useState } from 'react';
import { formatDollars, formatPercent } from '../../calc-core/money';
import {
  buildSensitivity,
  CAP_MESSAGES,
  computeCapRate,
  computeNoiBuilder,
  DEFAULTS,
  type CapInput,
  type CapSolve,
} from '../../calc-core/capRate';
import { enumParam, numberParam, type ParamSchema } from '../../lib/urlState';
import { useUrlState } from '../../hooks/useUrlState';
import CalcShell from './CalcShell';
import ModeTabs from './ModeTabs';
import NumberInput from './NumberInput';
import ResultCard from './ResultCard';
import SensitivityGrid from './SensitivityGrid';
import ShareBar from '../ShareBar';
import EmbedModal from '../EmbedModal';

const SLUG = 'cap-rate-calculator';
const TITLE = 'Cap Rate Calculator';

type CapUrlState = Omit<CapInput, 'useBuilder'> & { useBuilder: string };

const SCHEMA: ParamSchema<CapUrlState> = {
  solve: enumParam<CapSolve>(['cap', 'value', 'noi'], DEFAULTS.solve),
  noi: numberParam(DEFAULTS.noi),
  value: numberParam(DEFAULTS.value),
  cap: numberParam(DEFAULTS.cap),
  useBuilder: enumParam(['0', '1'], '0'),
  gpr: numberParam(DEFAULTS.gpr),
  oi: numberParam(DEFAULTS.oi),
  vac: numberParam(DEFAULTS.vac),
  tx: numberParam(DEFAULTS.tx),
  insx: numberParam(DEFAULTS.insx),
  ut: numberParam(DEFAULTS.ut),
  rep: numberParam(DEFAULTS.rep),
  res: numberParam(DEFAULTS.res),
  mgmt: numberParam(DEFAULTS.mgmt),
};

const DEFAULT_STATE: CapUrlState = { ...DEFAULTS, useBuilder: '0' };

const SOLVE_OPTIONS = [
  { value: 'cap' as const, label: 'Cap rate' },
  { value: 'value' as const, label: 'Value' },
  { value: 'noi' as const, label: 'NOI' },
];

function detectEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/$/, '').endsWith('/embed') ||
    new URLSearchParams(window.location.search).get('embed') === '1';
}

export type CapRateCalculatorProps = { embed?: boolean };

export default function CapRateCalculator({ embed: embedProp }: CapRateCalculatorProps) {
  const [state, setState] = useUrlState<CapUrlState>(SCHEMA);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embed] = useState(() => embedProp ?? detectEmbed());

  const { solve, noi, value, cap, useBuilder: useBuilderStr } = state;
  const useBuilder = useBuilderStr === '1';

  const set = <K extends keyof CapUrlState>(key: K, val: CapUrlState[K]) =>
    setState((prev) => ({ ...prev, [key]: val }));

  const input: CapInput = { ...state, useBuilder };
  const result = useMemo(() => computeCapRate(input), [JSON.stringify(input)]);
  const builder = useMemo(() => computeNoiBuilder(state), [JSON.stringify(state)]);
  const sensitivity = useMemo(() => (result.ok ? buildSensitivity(result.noi) : null), [result]);

  const valueError = !result.ok && result.error === 'VALUE_NONPOSITIVE' ? CAP_MESSAGES.VALUE_NONPOSITIVE : undefined;

  const inputs = (
    <>
      <ModeTabs label="Solve for" options={SOLVE_OPTIONS} value={solve} onChange={(v) => set('solve', v)} />

      {solve !== 'noi' && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useBuilder} onChange={(e) => set('useBuilder', e.target.checked ? '1' : '0')} />
            Build NOI from income &amp; expenses
          </label>
          {useBuilder ? (
            <div className="space-y-3 rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
              <NumberInput id="cap-gpr" label="Gross potential rent" value={state.gpr} onChange={(v) => set('gpr', v)} min={0} step={1000} suffix="$/yr" />
              <NumberInput id="cap-oi" label="Other income" value={state.oi} onChange={(v) => set('oi', v)} min={0} step={1000} suffix="$/yr" />
              <NumberInput id="cap-vac" label="Vacancy" value={state.vac} onChange={(v) => set('vac', v)} min={0} max={100} step={0.5} suffix="%" tooltip="Vacancy applies to gross potential rent only, not other income." />
              <NumberInput id="cap-tx" label="Property taxes" value={state.tx} onChange={(v) => set('tx', v)} min={0} step={1000} suffix="$/yr" />
              <NumberInput id="cap-insx" label="Insurance" value={state.insx} onChange={(v) => set('insx', v)} min={0} step={1000} suffix="$/yr" />
              <NumberInput id="cap-ut" label="Utilities" value={state.ut} onChange={(v) => set('ut', v)} min={0} step={1000} suffix="$/yr" />
              <NumberInput id="cap-rep" label="Repairs & maintenance" value={state.rep} onChange={(v) => set('rep', v)} min={0} step={1000} suffix="$/yr" />
              <NumberInput id="cap-res" label="Reserves" value={state.res} onChange={(v) => set('res', v)} min={0} step={1000} suffix="$/yr" />
              <NumberInput id="cap-mgmt" label="Management" value={state.mgmt} onChange={(v) => set('mgmt', v)} min={0} max={20} step={0.5} suffix="% of EGI" />
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                EGI {formatDollars(builder.egi)} · management {formatDollars(builder.mgmtDollars)} · NOI {formatDollars(builder.noi)}
              </p>
            </div>
          ) : (
            <NumberInput id="cap-noi" label="Net operating income" value={noi} onChange={(v) => set('noi', v)} min={-10_000_000} max={100_000_000} step={1000} suffix="$/yr" />
          )}
        </>
      )}

      {solve !== 'value' && (
        <NumberInput id="cap-value" label="Property value" value={value} onChange={(v) => set('value', v)} min={1} max={1_000_000_000} step={10_000} suffix="$" errorText={valueError} />
      )}

      {solve !== 'cap' && (
        <NumberInput id="cap-cap" label="Cap rate" value={cap} onChange={(v) => set('cap', v)} min={0.5} max={20} step={0.1} suffix="%" />
      )}
    </>
  );

  const results = (
    <>
      <div aria-live="polite">
        <ResultCard
          title="Cap rate"
          emptyState={valueError ?? CAP_MESSAGES.INCOMPLETE}
          rows={
            result.ok
              ? [
                  { label: 'Cap rate', value: formatPercent(result.cap / 100), emphasis: solve === 'cap' },
                  { label: 'Property value', value: formatDollars(result.value), emphasis: solve === 'value' },
                  { label: 'Net operating income', value: formatDollars(result.noi), emphasis: solve === 'noi' },
                ]
              : []
          }
        />
      </div>
      {result.ok && result.negativeNoi && (
        <p className="text-xs" style={{ color: 'var(--color-error)' }}>
          {CAP_MESSAGES.NEGATIVE_NOI}
        </p>
      )}
      {result.ok && result.capUnusual && !result.negativeNoi && (
        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
          {CAP_MESSAGES.CAP_UNUSUAL}
        </p>
      )}
    </>
  );

  const matrixView =
    result.ok && sensitivity && result.noi > 0 ? (
      <div className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold">Value sensitivity — cap rate × NOI</h3>
        <SensitivityGrid matrix={sensitivity} highlightCap={result.cap} formatValue={formatDollars} />
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
      <CalcShell inputs={inputs} results={results} />
      {matrixView}
      {toolbar}
      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} slug={SLUG} title={TITLE} height={760} />
    </>
  );
}
