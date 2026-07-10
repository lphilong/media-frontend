export type SemanticTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'critical'
  | 'muted'
  | 'disabled';

export type SemanticInteractionState = {
  active?: boolean;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
};

type SemanticToneClassSet = {
  badge: string;
  border: string;
  panel: string;
  text: string;
  marker: string;
};

export const SEMANTIC_TONES: readonly SemanticTone[] = [
  'neutral',
  'info',
  'success',
  'warning',
  'danger',
  'critical',
  'muted',
  'disabled',
];

const SEMANTIC_TONE_CLASSES: Record<SemanticTone, SemanticToneClassSet> = {
  neutral: {
    badge: 'bg-slate-100 text-slate-700',
    border: 'border-border',
    panel: 'bg-panel',
    text: 'text-text',
    marker: 'bg-slate-400',
  },
  info: {
    badge: 'bg-sky-100 text-sky-700',
    border: 'border-sky-300',
    panel: 'bg-sky-50',
    text: 'text-sky-800',
    marker: 'bg-sky-500',
  },
  success: {
    badge: 'bg-emerald-100 text-emerald-700',
    border: 'border-emerald-300',
    panel: 'bg-emerald-50',
    text: 'text-emerald-800',
    marker: 'bg-emerald-500',
  },
  warning: {
    badge: 'bg-amber-100 text-amber-800',
    border: 'border-amber-300',
    panel: 'bg-amber-50',
    text: 'text-amber-900',
    marker: 'bg-amber-500',
  },
  danger: {
    badge: 'bg-rose-100 text-rose-700',
    border: 'border-rose-300',
    panel: 'bg-rose-50',
    text: 'text-rose-800',
    marker: 'bg-rose-500',
  },
  critical: {
    badge: 'bg-red-100 text-red-800',
    border: 'border-red-400',
    panel: 'bg-red-50',
    text: 'text-red-900',
    marker: 'bg-red-600',
  },
  muted: {
    badge: 'bg-gray-100 text-gray-600',
    border: 'border-gray-200',
    panel: 'bg-gray-50',
    text: 'text-muted',
    marker: 'bg-gray-400',
  },
  disabled: {
    badge: 'bg-gray-200 text-gray-500',
    border: 'border-gray-200',
    panel: 'bg-gray-50',
    text: 'text-gray-500',
    marker: 'bg-gray-300',
  },
};

export const isSemanticTone = (value: string): value is SemanticTone => {
  return SEMANTIC_TONES.includes(value as SemanticTone);
};

export const getSemanticToneClasses = (tone: SemanticTone): SemanticToneClassSet => {
  return SEMANTIC_TONE_CLASSES[tone];
};

export const getSemanticInteractionClasses = ({
  active,
  selected,
  disabled,
  loading,
}: SemanticInteractionState): string => {
  return [
    active ? 'ring-2 ring-accent ring-offset-2' : null,
    selected ? 'outline outline-2 outline-accent/60' : null,
    disabled ? 'cursor-not-allowed opacity-60' : null,
    loading ? 'cursor-wait' : null,
  ]
    .filter(Boolean)
    .join(' ');
};
