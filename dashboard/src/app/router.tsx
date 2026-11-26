import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { AuthGuard, RoleGuard, FreelancerRedirect, FullScreenSkeleton } from './guards';
import { ErrorBoundary } from './ErrorBoundary';
import { NotFound } from './NotFound';

import OwnerDashboard from '../features/dashboard/OwnerDashboard';
const PostProjectPage = lazy(() => import('../features/post-project/PostProjectPage'));
const ProjectMatchesPage = lazy(() => import('../features/matching/ProjectMatchesPage'));
const ReviewPage = lazy(() => import('../features/review/ReviewPage'));

export const AppRoutes: React.FC = () => {
  return (
    <AuthGuard>
      <AppShell>
        <Suspense fallback={<FullScreenSkeleton />}>
          <Routes>
            <Route
              path="/"
              element={
                <ErrorBoundary fallbackTitle="Owner Dashboard Error">
                  <OwnerDashboard />
                </ErrorBoundary>
              }
            />
            <Route
              path="/owner"
              element={
                <ErrorBoundary fallbackTitle="Owner Dashboard Error">
                  <OwnerDashboard />
                </ErrorBoundary>
              }
            />
            <Route
              path="/owner/projects/new"
              element={
                <ErrorBoundary fallbackTitle="Post Project Error">
                  <PostProjectPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/owner/projects/:projectId"
              element={
                <ErrorBoundary fallbackTitle="Project Matches Error">
                  <ProjectMatchesPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/owner/projects/:projectId/review"
              element={
                <ErrorBoundary fallbackTitle="Review Submission Error">
                  <ReviewPage />
                </ErrorBoundary>
              }
            />
            {/* Admin Analytics: redirects to Admin Overview #analytics */}
            <Route
              path="/admin/analytics"
              element={<Navigate to="/admin#analytics" replace />}
            />
            {/* Admin Overview */}
            <Route
              path="/admin"
              element={
                <RoleGuard requiredRole="admin">
                  <ErrorBoundary fallbackTitle="Admin Overview Error">
                    <OwnerDashboard />
                  </ErrorBoundary>
                </RoleGuard>
              }
            />
            {/* Freelancer route redirects to Freelancer Workspace on port 5177 */}
            <Route path="/freelancer" element={<FreelancerRedirect />} />
            <Route
              path="*"
              element={
                <ErrorBoundary fallbackTitle="Page Error">
                  <NotFound />
                </ErrorBoundary>
              }
            />
          </Routes>
        </Suspense>
      </AppShell>
    </AuthGuard>
  );
};

export default AppRoutes;
