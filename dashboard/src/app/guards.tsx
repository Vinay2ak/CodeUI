import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession, redirectToWorkspace } from '../features/session/session';
import { Skeleton } from '../components/ui/skeleton';
import { SuspendedScreen } from '../features/session/SuspendedScreen';
import { SessionExpiredModal } from '../features/session/SessionExpiredModal';
import { env } from '../lib/env';

export const FullScreenSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      className="min-h-screen bg-bg flex flex-col p-6 gap-6"
    >
      <div className="flex items-center justify-between">
        <Skeleton width={180} height={36} />
        <div className="flex items-center gap-3">
          <Skeleton width={80} height={32} rounded="rounded-full" />
          <Skeleton width={36} height={36} rounded="rounded-full" />
          <Skeleton width={36} height={36} rounded="rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <Skeleton height={110} />
        <Skeleton height={110} />
        <Skeleton height={110} />
        <Skeleton height={110} />
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        <div className="lg:col-span-2">
          <Skeleton height={380} />
        </div>
        <div>
          <Skeleton height={380} />
        </div>
      </div>
    </div>
  );
};

export const FreelancerRedirect: React.FC = () => {
  const { user } = useSession();

  useEffect(() => {
    redirectToWorkspace(null, null, user);
  }, [user]);

  return <FullScreenSkeleton />;
};

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, user } = useSession();

  useEffect(() => {
    if (
      user?.role === 'freelancer' ||
      (typeof window !== 'undefined' && window.location.pathname.startsWith('/freelancer'))
    ) {
      redirectToWorkspace(null, null, user);
      return;
    }
    if (status === 'anonymous' || (!user && status !== 'loading')) {
      window.location.assign(env.VITE_SIGNIN_URL || 'http://localhost:5173/login');
    }
  }, [status, user]);

  if (
    user?.role === 'freelancer' ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/freelancer'))
  ) {
    return <FullScreenSkeleton />;
  }

  if (status === 'loading') {
    return <FullScreenSkeleton />;
  }

  if (status === 'suspended') {
    return <SuspendedScreen />;
  }

  if (status === 'anonymous' || !user) {
    return <FullScreenSkeleton />;
  }

  return (
    <>
      {status === 'expired' && <SessionExpiredModal />}
      {children}
    </>
  );
};

export const RoleGuard: React.FC<{ requiredRole: 'owner' | 'freelancer' | 'admin'; children: React.ReactNode }> = ({
  requiredRole,
  children,
}) => {
  const { user } = useSession();

  if (!user) {
    return null;
  }

  if (user.role === 'freelancer') {
    redirectToWorkspace(null, null, user);
    return <FullScreenSkeleton />;
  }

  // If user role does not match, redirect to user's own role route
  if (user.role !== requiredRole) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return <>{children}</>;
};

export const RootRedirect: React.FC = () => {
  const { user } = useSession();

  if (!user) {
    return null;
  }

  if (user.role === 'freelancer') {
    redirectToWorkspace(null, null, user);
    return <FullScreenSkeleton />;
  }

  return <Navigate to="/owner" replace />;
};
