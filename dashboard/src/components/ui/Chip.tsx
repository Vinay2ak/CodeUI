import React from 'react';

export interface ChipProps {
  icon?: React.ReactNode;
  dot?: boolean;
  label: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'money' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({
  icon,
  dot = false,
  label,
  tone = 'neutral',
  size = 'md',
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2.5 py-0.5 gap-1.5',
    md: 'text-xs px-3 py-1 gap-1.5',
  }[size];

  const toneStyles = {
    neutral: 'bg-secondary/70 text-muted-foreground border border-border',
    primary: 'bg-secondary text-foreground border border-border',
    money: 'bg-money/15 text-money font-semibold border border-money/35',
    success: 'bg-success/10 text-success border border-success/30',
    warning: 'bg-warning/15 text-warning border border-warning/30',
    danger: 'bg-danger/10 text-danger border border-danger/30',
  }[tone];

  const dotColor = {
    neutral: 'bg-muted-foreground',
    primary: 'bg-accent',
    money: 'bg-money',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }[tone];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeStyles} ${toneStyles} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`}
          aria-hidden="true"
        />
      )}
      {!dot && icon && (
        <span className="flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
      )}
      <span>{label}</span>
    </span>
  );
};
