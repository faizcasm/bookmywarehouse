/** Shared UI primitives. Barrel export. */

export { Button } from './Button';
export type { ButtonProps } from './Button';
export { Card } from './Card';
export { Badge } from './Badge';
export type { BadgeTone } from './Badge';
export { TextField } from './TextField';
export type { TextFieldProps } from './TextField';
export { EmptyState } from './EmptyState';
export { ErrorState } from './ErrorState';
export { Skeleton } from './Skeleton';
export { Screen } from './Screen';
export { LoadingOverlay } from './LoadingOverlay';
export { SectionHeader } from './SectionHeader';

/* Added for the production feature pass. */
export { Chip } from './Chip';
export type { ChipProps } from './Chip';
export { Segmented } from './Segmented';
export type { SegmentedOption, SegmentedProps } from './Segmented';
export { LinkRow } from './LinkRow';
export type { LinkRowProps } from './LinkRow';
export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';
export { KeyValue } from './KeyValue';
export type { KeyValueItem, KeyValueProps } from './KeyValue';
export { Banner } from './Banner';
export type { BannerProps, BannerTone } from './Banner';
export { Stat, StatGrid } from './Stat';
export type { StatProps, StatGridProps } from './Stat';
export { StarRating } from './StarRating';
export type { StarRatingProps } from './StarRating';
export { Sheet } from './Sheet';
export type { SheetProps } from './Sheet';
export {
  DateField,
  DateRangeField,
  formatDisplayDate,
  parseDateOnly,
  toDateOnly,
  todayOnly,
} from './DateField';
export type { DateFieldProps, DateRangeFieldProps } from './DateField';
export { ColumnChart, Sparkline, RatioBar, ChartCard } from './MiniChart';
export type { ColumnChartProps, SparklineProps, SeriesPoint } from './MiniChart';
export { SignInPrompt } from './SignInPrompt';
export type { SignInPromptProps } from './SignInPrompt';
