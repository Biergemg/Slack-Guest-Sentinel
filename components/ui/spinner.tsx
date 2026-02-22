interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'yellow' | 'white' | 'gray';
}

const SIZE_CLASSES = {
  sm: 'h-6 w-6 border-2',
  md: 'h-10 w-10 border-4',
  lg: 'h-16 w-16 border-4',
} as const;

const COLOR_CLASSES = {
  blue: 'border-blue-500 border-t-transparent',
  yellow: 'border-yellow-500 border-t-transparent',
  white: 'border-white border-t-transparent',
  gray: 'border-gray-400 border-t-transparent',
} as const;

export function Spinner({ size = 'md', color = 'blue' }: SpinnerProps) {
  return (
    <div
      className={`${SIZE_CLASSES[size]} ${COLOR_CLASSES[color]} animate-spin rounded-full`}
      role="status"
      aria-label="Loading"
    />
  );
}
