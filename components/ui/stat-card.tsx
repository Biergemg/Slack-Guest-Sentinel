interface StatCardProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'danger' | 'success';
  prefix?: string;
  suffix?: string;
}

const VARIANT_CLASSES = {
  default: {
    container: 'bg-white dark:bg-gray-800',
    value: 'text-gray-800 dark:text-white',
  },
  danger: {
    container: 'bg-red-50 dark:bg-red-900/20',
    value: 'text-red-600 dark:text-red-400',
  },
  success: {
    container: 'bg-green-50 dark:bg-green-900/20',
    value: 'text-green-700 dark:text-green-400',
  },
} as const;

export function StatCard({
  label,
  value,
  variant = 'default',
  prefix,
  suffix,
}: StatCardProps) {
  const classes = VARIANT_CLASSES[variant];

  return (
    <div className={`${classes.container} p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700`}>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <p className={`text-4xl font-bold ${classes.value}`}>
        {prefix}
        {value}
        {suffix}
      </p>
    </div>
  );
}
