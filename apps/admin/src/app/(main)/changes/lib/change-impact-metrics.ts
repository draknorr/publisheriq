import type {
  ChangeActivitySignalFamily,
  ChangeBurstImpact,
  ChangeBurstImpactWindow,
} from './change-feed-types';

export type ChangeImpactDeltaTone = 'positive' | 'negative' | 'neutral';

export interface ChangeImpactDeltaCell {
  label: string;
  tone: ChangeImpactDeltaTone;
}

export interface ChangeImpactMetricRow {
  id: string;
  label: string;
  pre7d: string;
  post1d: string;
  delta1d: ChangeImpactDeltaCell;
  post7d: string;
  delta7d: ChangeImpactDeltaCell;
}

interface MetricSpec {
  id: string;
  label: string;
  kind: 'integer' | 'decimal' | 'price' | 'percent' | 'reviewPercent';
  getValue: (window: ChangeBurstImpactWindow) => number | null;
  isValid: (value: number) => boolean;
  requireNonZero?: boolean;
  hideWhenUnchanged?: boolean;
  commercialOnly?: boolean;
}

interface BuildRowsOptions {
  changeTypes?: readonly string[];
  signalFamilies?: readonly ChangeActivitySignalFamily[];
}

const EMPTY_CELL = '-';
type ImpactWindowSlot = ChangeBurstImpactWindow | null;

const METRIC_SPECS: MetricSpec[] = [
  {
    id: 'ccuPeak',
    label: 'Peak CCU',
    kind: 'integer',
    getValue: (window) => window.ccuPeak,
    isValid: isNonNegative,
  },
  {
    id: 'totalReviews',
    label: 'Reviews',
    kind: 'integer',
    getValue: (window) => window.totalReviews,
    isValid: isNonNegative,
  },
  {
    id: 'reviewsAdded',
    label: 'Reviews Added',
    kind: 'integer',
    getValue: (window) => window.reviewsAdded,
    isValid: isNonNegative,
    requireNonZero: true,
  },
  {
    id: 'avgDailyReviews',
    label: 'Avg Daily Reviews',
    kind: 'decimal',
    getValue: (window) => window.avgDailyReviews,
    isValid: isNonNegative,
    requireNonZero: true,
  },
  {
    id: 'reviewScore',
    label: 'Review %',
    kind: 'reviewPercent',
    getValue: (window) => window.reviewScore,
    isValid: isReviewScore,
    hideWhenUnchanged: true,
  },
  {
    id: 'priceCents',
    label: 'Price',
    kind: 'price',
    getValue: (window) => window.priceCents,
    isValid: isNonNegative,
    commercialOnly: true,
  },
  {
    id: 'discountPercent',
    label: 'Discount',
    kind: 'percent',
    getValue: (window) => window.discountPercent,
    isValid: isPercent,
    commercialOnly: true,
  },
  {
    id: 'positiveAdded',
    label: 'Positive Added',
    kind: 'integer',
    getValue: (window) => window.positiveAdded,
    isValid: isNonNegative,
    requireNonZero: true,
  },
  {
    id: 'negativeAdded',
    label: 'Negative Added',
    kind: 'integer',
    getValue: (window) => window.negativeAdded,
    isValid: isNonNegative,
    requireNonZero: true,
  },
];

export function buildChangeImpactMetricRows(
  impact: ChangeBurstImpact | null,
  options: BuildRowsOptions = {}
): ChangeImpactMetricRow[] {
  if (!impact) {
    return [];
  }

  const windows = getImpactWindows(impact);
  const pricingSignal = hasPricingSignal(options);
  const reviewPolarityValid = hasValidReviewPolarity(windows);

  const metricRows = METRIC_SPECS.flatMap((spec) => {
    if ((spec.id === 'positiveAdded' || spec.id === 'negativeAdded') && !reviewPolarityValid) {
      return [];
    }

    if (spec.commercialOnly && !isCommercialMetricRelevant(spec.id, windows, pricingSignal)) {
      return [];
    }

    const row = buildMetricRow(spec, windows);
    return row ? [row] : [];
  });

  return metricRows;
}

function getImpactWindows(impact: ChangeBurstImpact): ImpactWindowSlot[] {
  return [impact.baseline7d, impact.response1d, impact.response7d];
}

function buildMetricRow(
  spec: MetricSpec,
  windows: ImpactWindowSlot[]
): ChangeImpactMetricRow | null {
  if (hasInvalidValue(spec, windows)) {
    return null;
  }

  const values = windows
    .map((window) => (window ? spec.getValue(window) : null))
    .filter(isFiniteNumber);

  if (values.length === 0) {
    return null;
  }

  if (spec.requireNonZero && values.every((value) => value === 0)) {
    return null;
  }

  if (spec.hideWhenUnchanged) {
    const comparableValues = values.map((value) => valueForComparison(spec, value));
    if (new Set(comparableValues).size <= 1) {
      return null;
    }
  }

  return {
    id: spec.id,
    label: spec.label,
    pre7d: formatMetricCell(spec, windows[0] ?? null),
    post1d: formatMetricCell(spec, windows[1] ?? null),
    delta1d: buildDeltaCell(spec, windows[0] ?? null, windows[1] ?? null),
    post7d: formatMetricCell(spec, windows[2] ?? null),
    delta7d: buildDeltaCell(spec, windows[0] ?? null, windows[2] ?? null),
  };
}

function formatMetricCell(spec: MetricSpec, window: ChangeBurstImpactWindow | null): string {
  if (!window) {
    return EMPTY_CELL;
  }

  const value = spec.getValue(window);
  if (!isFiniteNumber(value)) {
    return EMPTY_CELL;
  }

  return formatValue(value, spec.kind);
}

function buildDeltaCell(
  spec: MetricSpec,
  baseline: ChangeBurstImpactWindow | null,
  response: ChangeBurstImpactWindow | null
): ChangeImpactDeltaCell {
  if (!baseline || !response) {
    return emptyDelta();
  }

  const baselineValue = getComparableMetricValue(spec, baseline);
  const responseValue = getComparableMetricValue(spec, response);

  if (!isFiniteNumber(baselineValue) || !isFiniteNumber(responseValue)) {
    return emptyDelta();
  }

  const delta = responseValue - baselineValue;
  const tone: ChangeImpactDeltaTone = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';

  if (delta === 0) {
    return { label: zeroDeltaLabel(spec.kind), tone };
  }

  if (spec.kind === 'percent' || spec.kind === 'reviewPercent') {
    return { label: `${formatSignedNumber(delta)}pp`, tone };
  }

  if (spec.kind === 'price') {
    return { label: formatSignedPrice(delta), tone };
  }

  const absolute = formatSignedNumber(delta);
  const relative = baselineValue === 0 ? null : formatSignedPercent((delta / baselineValue) * 100);

  return {
    label: relative ? `${absolute} / ${relative}` : absolute,
    tone,
  };
}

function hasInvalidValue(spec: MetricSpec, windows: ImpactWindowSlot[]): boolean {
  return windows.some((window) => {
    if (!window) {
      return false;
    }

    const value = spec.getValue(window);
    return value !== null && (!isFiniteNumber(value) || !spec.isValid(value));
  });
}

function hasPricingSignal(options: BuildRowsOptions): boolean {
  if (options.signalFamilies?.includes('pricing')) {
    return true;
  }

  return Boolean(
    options.changeTypes?.some((changeType) =>
      changeType === 'price_change' ||
      changeType === 'discount_start' ||
      changeType === 'discount_end'
    )
  );
}

function isCommercialMetricRelevant(
  metricId: string,
  windows: ImpactWindowSlot[],
  hasSignal: boolean
): boolean {
  if (hasSignal) {
    return true;
  }

  if (metricId === 'priceCents') {
    return hasAnyChanged(windows.map((window) => window?.priceCents ?? null));
  }

  if (metricId === 'discountPercent') {
    const values = windows.map((window) => window?.discountPercent ?? null);
    return hasAnyChanged(values) || hasAnyNonZero(values);
  }

  return false;
}

function hasAnyChanged(values: Array<number | null>): boolean {
  const validValues = values.filter(isFiniteNumber);
  return new Set(validValues).size > 1;
}

function hasAnyNonZero(values: Array<number | null>): boolean {
  const validValues = values.filter(isFiniteNumber);
  if (validValues.some((value) => value !== 0)) {
    return true;
  }

  return false;
}

function hasValidReviewPolarity(windows: ImpactWindowSlot[]): boolean {
  let hasPolarityValue = false;

  for (const window of windows) {
    if (!window) {
      continue;
    }

    const values = [window.reviewsAdded, window.positiveAdded, window.negativeAdded];
    const presentCount = values.filter((value) => value !== null).length;

    if (presentCount === 0) {
      continue;
    }

    if (presentCount !== values.length) {
      return false;
    }

    const [reviewsAdded, positiveAdded, negativeAdded] = values;
    if (
      !isFiniteNumber(reviewsAdded) ||
      !isFiniteNumber(positiveAdded) ||
      !isFiniteNumber(negativeAdded) ||
      !isNonNegative(reviewsAdded) ||
      !isNonNegative(positiveAdded) ||
      !isNonNegative(negativeAdded) ||
      positiveAdded + negativeAdded !== reviewsAdded
    ) {
      return false;
    }

    hasPolarityValue = true;
  }

  return hasPolarityValue;
}

function formatValue(value: number, kind: MetricSpec['kind']): string {
  if (kind === 'price') {
    return `$${(value / 100).toFixed(2)}`;
  }

  if (kind === 'reviewPercent') {
    return `${formatCompactNumber(normalizeReviewPercent(value))}%`;
  }

  if (kind === 'percent') {
    return `${formatCompactNumber(value)}%`;
  }

  if (kind === 'decimal') {
    return formatCompactNumber(value, 1);
  }

  return formatCompactNumber(value);
}

function formatCompactNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits,
  });
}

function formatSignedNumber(value: number): string {
  const sign = value > 0 ? '+' : '-';
  return `${sign}${formatCompactNumber(Math.abs(value), Math.abs(value) < 10 ? 1 : 0)}`;
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : '-';
  return `${sign}${formatCompactNumber(Math.abs(value), 1)}%`;
}

function formatSignedPrice(value: number): string {
  const sign = value > 0 ? '+' : '-';
  return `${sign}$${(Math.abs(value) / 100).toFixed(2)}`;
}

function zeroDeltaLabel(kind: MetricSpec['kind']): string {
  if (kind === 'price') {
    return '$0.00';
  }

  if (kind === 'percent' || kind === 'reviewPercent') {
    return '0pp';
  }

  return '0';
}

function emptyDelta(): ChangeImpactDeltaCell {
  return { label: EMPTY_CELL, tone: 'neutral' };
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegative(value: number): boolean {
  return value >= 0;
}

function isPercent(value: number): boolean {
  return value >= 0 && value <= 100;
}

function isReviewScore(value: number): boolean {
  return value >= 0 && value <= 100;
}

function getComparableMetricValue(
  spec: MetricSpec,
  window: ChangeBurstImpactWindow
): number | null {
  const value = spec.getValue(window);
  return isFiniteNumber(value) ? valueForComparison(spec, value) : null;
}

function valueForComparison(spec: MetricSpec, value: number): number {
  return spec.kind === 'reviewPercent' ? normalizeReviewPercent(value) : value;
}

function normalizeReviewPercent(value: number): number {
  return value <= 10 ? value * 10 : value;
}
