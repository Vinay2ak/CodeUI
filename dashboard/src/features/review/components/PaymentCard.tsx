import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock, BadgeCheck, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { paymentApi } from '../../../services/payment/api';
import { ProjectPayment, PaymentState } from '../types';
import { Chip } from '../../../components/ui/Chip';
import { Button } from '../../../components/ui/button';
import { formatInr } from '../format';

interface PaymentCardProps {
  projectId: string;
  onPaymentChange?: (payment: ProjectPayment | null) => void;
}

function getPaymentToneAndIcon(state: PaymentState): {
  tone: 'neutral' | 'primary' | 'money' | 'success' | 'warning' | 'danger';
  icon: React.ReactNode;
  label: string;
} {
  switch (state) {
    case 'held':
      return { tone: 'primary', icon: <Lock className="w-3.5 h-3.5" />, label: 'Held in Escrow' };
    case 'release_pending':
      return { tone: 'warning', icon: <Clock className="w-3.5 h-3.5" />, label: 'Release Pending' };
    case 'released':
      return { tone: 'success', icon: <BadgeCheck className="w-3.5 h-3.5" />, label: 'Released' };
    case 'authorized':
      return { tone: 'neutral', icon: <Clock className="w-3.5 h-3.5" />, label: 'Authorized' };
    case 'refunded':
      return { tone: 'danger', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Refunded' };
    default:
      return { tone: 'neutral', icon: <Clock className="w-3.5 h-3.5" />, label: 'Unrequested' };
  }
}

function getPaymentSentence(payment: ProjectPayment): string {
  switch (payment.state) {
    case 'held':
      return 'Held in escrow. It is released only after you approve.';
    case 'release_pending':
      return 'Approved. Payment release is pending.';
    case 'released':
      return `Released to ${payment.developerName}.`;
    case 'authorized':
      return 'Payment authorized.';
    case 'refunded':
      return 'Payment refunded.';
    case 'unrequested':
      return 'Payment not yet funded.';
    default:
      return '';
  }
}

export const PaymentCard: React.FC<PaymentCardProps> = ({ projectId, onPaymentChange }) => {
  const { data: payment, isLoading, isError, refetch } = useQuery<ProjectPayment>({
    queryKey: ['project-payment', projectId],
    queryFn: async () => {
      const p = await paymentApi.getProjectPayment(projectId);
      if (onPaymentChange) {
        onPaymentChange(p);
      }
      return p;
    },
    staleTime: 10_000,
    retry: 1,
  });

  return (
    <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Escrow Payment
        </span>
        {payment && (
          <Chip
            size="sm"
            tone={getPaymentToneAndIcon(payment.state).tone}
            icon={getPaymentToneAndIcon(payment.state).icon}
            label={getPaymentToneAndIcon(payment.state).label}
          />
        )}
      </div>

      <div className="py-3">
        {isLoading ? (
          <div className="h-8 w-24 bg-surface-raised animate-pulse rounded" />
        ) : isError ? (
          <div className="space-y-2">
            <p className="text-xs text-danger font-medium">Unable to load escrow payment status.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Retry
            </Button>
          </div>
        ) : payment ? (
          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono tabular-nums text-money">
              {formatInr(payment.amount)}
            </div>
            <p className="text-xs text-text-muted">{getPaymentSentence(payment)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
