import React from 'react';
import { Chip, ChipProps } from '../ui/Chip';

export type StatusCategory = 'project' | 'payment' | 'task' | 'health';

interface StatusChipProps {
  category: StatusCategory;
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  category,
  status,
  size = 'md',
  className = '',
}) => {
  let label = status;
  let tone: ChipProps['tone'] = 'neutral';

  if (category === 'project') {
    switch (status) {
      case 'open':
        label = 'Open';
        tone = 'primary';
        break;
      case 'draft':
        label = 'Draft';
        tone = 'neutral';
        break;
      case 'in_progress':
        label = 'In progress';
        tone = 'primary';
        break;
      case 'in_review':
        label = 'In review';
        tone = 'warning';
        break;
      case 'completed':
        label = 'Completed';
        tone = 'success';
        break;
    }
  } else if (category === 'payment') {
    switch (status) {
      case 'authorized':
        label = 'Authorized';
        tone = 'neutral';
        break;
      case 'held':
        label = 'Held in escrow';
        tone = 'money';
        break;
      case 'release_pending':
        label = 'Release pending';
        tone = 'money';
        break;
      case 'released':
        label = 'Released';
        tone = 'success';
        break;
    }
  } else if (category === 'task') {
    switch (status) {
      case 'open':
        label = 'Open';
        tone = 'neutral';
        break;
      case 'in_progress':
        label = 'In progress';
        tone = 'primary';
        break;
      case 'in_review':
        label = 'In review';
        tone = 'warning';
        break;
      case 'verified':
        label = 'Verified';
        tone = 'success';
        break;
    }
  } else if (category === 'health') {
    switch (status) {
      case 'up':
        label = 'Operational';
        tone = 'success';
        break;
      case 'degraded':
        label = 'Degraded';
        tone = 'warning';
        break;
      case 'down':
        label = 'Down';
        tone = 'danger';
        break;
    }
  }

  return (
    <Chip
      dot
      label={label}
      tone={tone}
      size={size}
      className={className}
    />
  );
};
