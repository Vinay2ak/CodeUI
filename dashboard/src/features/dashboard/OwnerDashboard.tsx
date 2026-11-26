import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast as sonnerToast } from 'sonner';
import {
  FolderGit2,
  Lock,
  Eye,
  BadgeCheck,
  Plus,
  Trash2,
  Search,
  Copy,
  ArrowUpRight,
} from 'lucide-react';
import {
  useProjectsQuery,
  usePaymentsSummaryQuery,
  useNotificationsQuery,
  queryKeys,
} from './hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ui/Toast';
import { deleteProject } from '../../services/project/api';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { Panel } from '../../components/dashboard/Panel';
import { DataTable, Column } from '../../components/dashboard/DataTable';
import { PipelineBar } from '../../components/dashboard/PipelineBar';
import { StatusChip } from '../../components/dashboard/StatusChip';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { Separator } from '../../components/ui/separator';
import { formatMoney, formatRelativeTime } from '../../lib/format';
import { Project, Payment } from '../../mocks/data';
import { PostProjectModal } from '../project/PostProjectModal';
import { SettingsPanel } from './components/SettingsPanel';
import { AnalyticsSection } from '../overview-analytics/AnalyticsSection';

type DashboardTab = 'overview' | 'projects' | 'payments' | 'settings';
type ProjectFilter = 'all' | 'open' | 'in_progress' | 'in_review' | 'completed' | 'draft';
type PaymentFilter = 'all' | 'authorized' | 'held' | 'release_pending' | 'released';

const PROJECT_FILTERS: { id: ProjectFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'in_review', label: 'In review' },
  { id: 'completed', label: 'Completed' },
  { id: 'draft', label: 'Draft' },
];

const PAYMENT_FILTERS: { id: PaymentFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'authorized', label: 'Authorized' },
  { id: 'held', label: 'Held in escrow' },
  { id: 'release_pending', label: 'Release pending' },
  { id: 'released', label: 'Released' },
];

function copyText(label: string, value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(value).catch(() => {});
  }
  sonnerToast.success(`Copied ${label}`, {
    description: value,
  });
}

export const OwnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  const getHashTab = (): DashboardTab => {
    const hash = (window.location.hash || location.hash).replace('#', '').toLowerCase();
    if (['projects', 'payments', 'settings'].includes(hash)) {
      return hash as DashboardTab;
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<DashboardTab>(getHashTab);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    const handleHash = () => {
      setActiveTab(getHashTab());
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    setActiveTab(getHashTab());
  }, [location.hash]);

  const projectsQuery = useProjectsQuery();
  const paymentsQuery = usePaymentsSummaryQuery();
  useNotificationsQuery();

  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      addToast({
        title: 'Project deleted',
        description: `"${projectToDelete.title}" has been deleted.`,
        type: 'success',
      });
      if (selectedProject?.id === projectToDelete.id) {
        setSelectedProject(null);
      }
      setProjectToDelete(null);
    } catch (err: any) {
      addToast({
        title: 'Failed to delete project',
        description: err?.detail || err?.message || 'Could not delete project. Please try again.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const projects = projectsQuery.data?.items || [];
  const paymentsSummary = paymentsQuery.data;

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return projects.filter((p: Project) => {
      if (projectFilter !== 'all' && p.status !== projectFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.repo.toLowerCase().includes(q) ||
        (p.freelancerName || '').toLowerCase().includes(q)
      );
    });
  }, [projects, projectFilter, projectSearch]);

  const filteredPayments = useMemo(() => {
    const items = paymentsSummary?.items || [];
    if (paymentFilter === 'all') return items;
    return items.filter((item: Payment) => item.state === paymentFilter);
  }, [paymentsSummary, paymentFilter]);

  // KPI Calculations
  const activeProjectsCount = projects.filter(
    (p: Project) => p.status === 'open' || p.status === 'in_progress' || p.status === 'in_review'
  ).length;

  const awaitingReviewCount = projects.filter(
    (p: Project) => p.status === 'in_review'
  ).length;

  const escrowHeldAmount = paymentsSummary?.held ?? 0;
  const releasedThisMonth = paymentsSummary?.releasedThisMonth ?? 0;

  // Project Table Columns
  const projectColumns: Column<Project>[] = [
    {
      header: 'Project',
      accessor: (p) => (
        <div className="flex flex-col gap-0.5">
          <Link
            to={`/owner/projects/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-foreground hover:text-accent transition-colors hover:underline"
          >
            {p.title}
          </Link>
          <span className="font-mono text-[11px] text-muted-foreground">{p.repo}</span>
        </div>
      ),
      isRowHeader: true,
    },
    {
      header: 'Freelancer',
      accessor: (p) => (
        <span
          className={
            p.freelancerName
              ? 'text-foreground font-medium flex items-center gap-2'
              : 'italic text-muted-foreground'
          }
        >
          {p.freelancerName ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
              {p.freelancerName}
            </>
          ) : (
            'Open bounty'
          )}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (p) => <StatusChip category="project" status={p.status} size="sm" />,
    },
    {
      header: 'Budget',
      accessor: (p) => (
        <span className="font-mono tabular-nums font-medium text-money">
          {formatMoney(p.budget)}
        </span>
      ),
    },
    {
      header: 'Updated',
      accessor: (p) => (
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {formatRelativeTime(p.updatedAt)}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (p) => (
        <div className="flex items-center gap-2">
          {p.status === 'in_review' && (
            <Link
              to={`/owner/projects/${p.id}/review`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 rounded-xl border border-accent/30 transition-colors"
            >
              Review
            </Link>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setProjectToDelete(p);
            }}
            className="h-7 px-2.5 text-xs text-danger hover:text-danger hover:bg-danger/10"
            title={`Delete project "${p.title}"`}
            aria-label={`Delete project ${p.title}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  // Payment Table Columns
  const paymentColumns: Column<Payment>[] = [
    {
      header: 'Project',
      accessor: (pay) => (
        <span className="font-medium text-foreground">{pay.projectTitle}</span>
      ),
      isRowHeader: true,
    },
    {
      header: 'Payment ID',
      accessor: (pay) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            copyText('payment ID', pay.id);
          }}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          title="Copy payment ID"
        >
          <span>{pay.id}</span>
          <Copy className="w-3 h-3 opacity-60" />
        </button>
      ),
    },
    {
      header: 'State',
      accessor: (pay) => <StatusChip category="payment" status={pay.state} size="sm" />,
    },
    {
      header: 'Amount',
      accessor: (pay) => (
        <span className="font-mono tabular-nums font-semibold text-money">
          {formatMoney(pay.amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Section Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {activeTab === 'overview' && 'Project Overview'}
            {activeTab === 'projects' && 'Projects'}
            {activeTab === 'payments' && 'Payments'}
            {activeTab === 'settings' && 'Settings & Preferences'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeTab === 'overview' &&
              'Monitor active work streams, escrow allocations, and milestone deliverables'}
            {activeTab === 'projects' &&
              'Track client repositories, deliverables, and assigned developers'}
            {activeTab === 'payments' &&
              'Monitor milestone escrow balances and transaction pipeline'}
            {activeTab === 'settings' &&
              'Escrow release policies and webhook delivery configuration'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/owner/projects/new')}
            className="font-semibold shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Post a Project
          </Button>
        </div>
      </div>

      {/* Transition Container */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-6"
      >
        {/* Overview View: 4 KPI Cards + Grafana Analytics */}
        {activeTab === 'overview' && (
          <>
            <section id="overview" aria-labelledby="overview-title" className="flex flex-col gap-4">
              <h3 id="overview-title" className="text-base font-bold text-foreground sr-only">
                Owner metrics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Active projects"
                  value={activeProjectsCount}
                  hint="Open, in progress or in review"
                  icon={<FolderGit2 className="w-4 h-4" />}
                  isLoading={projectsQuery.isLoading}
                  error={projectsQuery.error as Error}
                  onRetry={() => projectsQuery.refetch()}
                />
                <KpiCard
                  label="Escrow held"
                  value={formatMoney(escrowHeldAmount)}
                  hint="Funds secured in escrow"
                  icon={<Lock className="w-4 h-4" />}
                  tone="money"
                  isLoading={paymentsQuery.isLoading}
                  error={paymentsQuery.error as Error}
                  onRetry={() => paymentsQuery.refetch()}
                />
                <KpiCard
                  label="Awaiting review"
                  value={awaitingReviewCount}
                  hint="Requires code inspection"
                  icon={<Eye className="w-4 h-4" />}
                  isLoading={projectsQuery.isLoading}
                  error={projectsQuery.error as Error}
                  onRetry={() => projectsQuery.refetch()}
                />
                <KpiCard
                  label="Released this month"
                  value={formatMoney(releasedThisMonth)}
                  hint="Disbursed to talent"
                  icon={<BadgeCheck className="w-4 h-4" />}
                  tone="money"
                  isLoading={paymentsQuery.isLoading}
                  error={paymentsQuery.error as Error}
                  onRetry={() => paymentsQuery.refetch()}
                />
              </div>
            </section>

            <AnalyticsSection />
          </>
        )}

        {/* Projects Panel */}
        {activeTab === 'projects' && (
          <Panel
            id="projects"
            title="Projects"
            serviceName="project service"
            updatedAt={projectsQuery.dataUpdatedAt ? new Date(projectsQuery.dataUpdatedAt) : null}
            onRefresh={() => projectsQuery.refetch()}
            isRefreshing={projectsQuery.isFetching}
            isLoading={projectsQuery.isLoading}
            error={projectsQuery.error as Error}
            isEmpty={projects.length === 0}
            emptyMessage="No projects currently registered"
            actions={
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/owner/projects/new')}
                className="text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Post project
              </Button>
            }
          >
            <div className="flex flex-col gap-4">
              {/* Search & Status Filter Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative w-full lg:max-w-xs">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="search"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search projects, repos, talent…"
                    aria-label="Search projects"
                    className="pl-9"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-full bg-secondary/50 border border-border">
                  {PROJECT_FILTERS.map((f) => {
                    const active = projectFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setProjectFilter(f.id)}
                        className={`relative px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                          active
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="projects-filter-pill"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="absolute inset-0 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                        )}
                        <span className="relative z-10">{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
                  No projects match the current filter.
                </div>
              ) : (
                <DataTable
                  caption="List of CodeBridge projects"
                  columns={projectColumns}
                  data={filteredProjects}
                  keyExtractor={(p) => p.id}
                  onRowClick={(p) => setSelectedProject(p)}
                />
              )}
            </div>
          </Panel>
        )}

        {/* Payments Panel */}
        {activeTab === 'payments' && (
          <Panel
            id="payments"
            title="Payments"
            serviceName="payment service"
            updatedAt={paymentsQuery.dataUpdatedAt ? new Date(paymentsQuery.dataUpdatedAt) : null}
            onRefresh={() => paymentsQuery.refetch()}
            isRefreshing={paymentsQuery.isFetching}
            isLoading={paymentsQuery.isLoading}
            error={paymentsQuery.error as Error}
            isEmpty={!paymentsSummary || paymentsSummary.items.length === 0}
            emptyMessage="No payment transactions recorded"
          >
            <div className="flex flex-col gap-6">
              <PipelineBar
                authorized={paymentsSummary?.authorized ?? 0}
                held={paymentsSummary?.held ?? 0}
                pendingRelease={paymentsSummary?.pendingRelease ?? 0}
                released={paymentsSummary?.released ?? 0}
              />

              <div className="flex flex-col gap-3 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Escrow & Route ledger
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-full bg-secondary/50 border border-border">
                    {PAYMENT_FILTERS.map((f) => {
                      const active = paymentFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setPaymentFilter(f.id)}
                          className={`relative px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                            active
                              ? 'text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="payments-filter-pill"
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              className="absolute inset-0 rounded-full bg-primary"
                              aria-hidden="true"
                            />
                          )}
                          <span className="relative z-10">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {filteredPayments.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
                    No transactions in this state.
                  </div>
                ) : (
                  <DataTable
                    caption="Escrow transactions ledger"
                    columns={paymentColumns}
                    data={filteredPayments}
                    keyExtractor={(pay) => pay.id}
                    onRowClick={(pay) => setSelectedPayment(pay)}
                  />
                )}
              </div>
            </div>
          </Panel>
        )}

        {/* Settings Panel */}
        {activeTab === 'settings' && <SettingsPanel />}
      </motion.div>

      {/* Post Project Modal */}
      <PostProjectModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onProjectCreated={() => {
          projectsQuery.refetch();
        }}
      />

      {/* Project Detail Slide-Over Sheet */}
      <Sheet
        open={!!selectedProject}
        onOpenChange={(open) => {
          if (!open) setSelectedProject(null);
        }}
      >
        <SheetContent className="bg-card border-l border-border sm:max-w-md overflow-y-auto">
          {selectedProject && (
            <div className="flex flex-col gap-5 pt-2">
              <SheetHeader className="text-left">
                <div className="flex items-center gap-2">
                  <StatusChip category="project" status={selectedProject.status} size="sm" />
                </div>
                <SheetTitle className="text-lg font-bold text-foreground pt-1">
                  {selectedProject.title}
                </SheetTitle>
                <SheetDescription className="font-mono text-xs text-muted-foreground">
                  {selectedProject.repo}
                </SheetDescription>
              </SheetHeader>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block">Project ID</span>
                  <button
                    type="button"
                    onClick={() => copyText('project ID', selectedProject.id)}
                    className="mt-1 inline-flex items-center gap-1.5 font-mono text-foreground hover:text-accent cursor-pointer"
                  >
                    <span>{selectedProject.id}</span>
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block">Escrow budget</span>
                  <span className="mt-1 block font-mono tabular-nums font-semibold text-sm text-money">
                    {formatMoney(selectedProject.budget)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block">Developer</span>
                  <span className="mt-1 block font-medium text-foreground">
                    {selectedProject.freelancerName || 'Unassigned'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block">Updated</span>
                  <span className="mt-1 block font-mono tabular-nums text-foreground">
                    {formatRelativeTime(selectedProject.updatedAt)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    const id = selectedProject.id;
                    setSelectedProject(null);
                    navigate(`/owner/projects/${id}`);
                  }}
                  className="w-full justify-between"
                >
                  <span>Open project & matches</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Button>

                {selectedProject.status === 'in_review' && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const id = selectedProject.id;
                      setSelectedProject(null);
                      navigate(`/owner/projects/${id}/review`);
                    }}
                    className="w-full justify-between"
                  >
                    <span>Review submission & release escrow</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment Transaction Slide-Over Sheet */}
      <Sheet
        open={!!selectedPayment}
        onOpenChange={(open) => {
          if (!open) setSelectedPayment(null);
        }}
      >
        <SheetContent className="bg-card border-l border-border sm:max-w-md overflow-y-auto">
          {selectedPayment && (
            <div className="flex flex-col gap-5 pt-2">
              <SheetHeader className="text-left">
                <div>
                  <StatusChip category="payment" status={selectedPayment.state} size="sm" />
                </div>
                <SheetTitle className="text-lg font-bold text-foreground pt-1">
                  {selectedPayment.projectTitle}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Escrow transaction record
                </SheetDescription>
              </SheetHeader>

              <Separator />

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                  <span className="text-muted-foreground">Payment ID</span>
                  <button
                    type="button"
                    onClick={() => copyText('payment ID', selectedPayment.id)}
                    className="inline-flex items-center gap-1.5 font-mono text-foreground hover:text-accent cursor-pointer"
                  >
                    <span>{selectedPayment.id}</span>
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-mono tabular-nums font-bold text-sm text-money">
                    {formatMoney(selectedPayment.amount)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!projectToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setProjectToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle id="delete-project-title" className="text-base font-bold text-foreground">
                  Delete Project
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to delete this project?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <p className="text-sm text-foreground py-2">
            This will permanently delete{' '}
            <span className="font-semibold text-foreground">
              &ldquo;{projectToDelete?.title}&rdquo;
            </span>
            . This action cannot be undone.
          </p>

          <DialogFooter className="pt-2 border-t border-border gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProjectToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerDashboard;
