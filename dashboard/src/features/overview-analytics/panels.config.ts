export type PanelSpec = {
  id: number | null;
  title: string;
  kind: 'stat' | 'chart' | 'table';
  span: 4 | 6 | 8 | 12;
  height: number;
  hidden?: boolean;
};

/**
 * The Overview already has native KPI cards; set true to also show the four
 * Grafana stat panels as a compact strip above the charts.
 */
export const SHOW_STAT_PANELS = false;

export const ANALYTICS_PANELS: PanelSpec[] = [
  // Stat panels (Key Performance Indicators)
  { id: 1, title: 'Total Projects', kind: 'stat', span: 4, height: 120 },
  { id: 2, title: 'In-Flight Projects', kind: 'stat', span: 4, height: 120 },
  { id: 3, title: 'Total Budget', kind: 'stat', span: 4, height: 120 },
  { id: 4, title: 'Total Users', kind: 'stat', span: 4, height: 120 },

  // Primary Activity Velocity & Lifecycle Breakdown Row (8 + 4 = 12)
  { id: 5, title: 'Project Creation Timeline', kind: 'chart', span: 8, height: 280 },
  { id: 7, title: 'Projects by Status', kind: 'chart', span: 4, height: 280 },

  // Distribution, Community & Skills Row (4 + 4 + 4 = 12)
  { id: 8, title: 'Budget by Status', kind: 'chart', span: 4, height: 280 },
  { id: 9, title: 'Users by Role', kind: 'chart', span: 4, height: 280 },
  { id: 6, title: 'Required Skills', kind: 'chart', span: 4, height: 280 },

  // Milestones Ledger Table (12 = full width)
  { id: 10, title: 'Recent Projects', kind: 'table', span: 12, height: 360 },
];

export const ANALYTICS_VARIABLE: { name: string; allValue: '$__all' } | null = {
  name: 'owner_id',
  allValue: '$__all',
};
