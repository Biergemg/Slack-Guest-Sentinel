interface BadgeProps {
  label: string;
  variant: 'success' | 'danger' | 'warning' | 'neutral';
}

const VARIANT_CLASSES = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
} as const;

export function Badge({ label, variant }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {label}
    </span>
  );
}
