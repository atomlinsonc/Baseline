export function formatDate(dateStr) {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatPercent(value, decimals = 0) {
  if (value == null) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

export const VERDICT_META = {
  supported: {
    label: 'Supported',
    color: '#2d7a3a',
    bg: '#e8f5e9',
    description: 'Strong evidence confirms this claim',
  },
  mostly_supported: {
    label: 'Mostly Supported',
    color: '#4a7c59',
    bg: '#f0f7f1',
    description: 'Broadly true with some caveats',
  },
  contested: {
    label: 'Contested',
    color: '#8a6a00',
    bg: '#fff8e1',
    description: 'Credible evidence exists on both sides',
  },
  mostly_unsupported: {
    label: 'Mostly Unsupported',
    color: '#b85c00',
    bg: '#fff3e0',
    description: 'Broadly false with minor elements of truth',
  },
  unsupported: {
    label: 'Unsupported',
    color: '#c0392b',
    bg: '#fdecea',
    description: 'Evidence clearly contradicts this claim',
  },
  unverifiable: {
    label: 'Unverifiable',
    color: '#555',
    bg: '#f5f5f5',
    description: 'Philosophical or values-based — not empirically testable',
  },
};

export const CATEGORY_LABELS = {
  'social-issues':      'Social Issues',
  'economic-policy':    'Economic Policy',
  'foreign-policy':     'Foreign Policy',
  'civil-rights':       'Civil Rights',
  'science-technology': 'Science & Technology',
  'religion':           'Religion & Values',
  'healthcare':         'Healthcare',
  'immigration':        'Immigration',
  'education':          'Education',
  'environment':        'Environment',
};
