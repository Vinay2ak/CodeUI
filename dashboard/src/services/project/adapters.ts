import {
  Project,
  ProjectDetail,
  ProjectsResponse,
  CreateProjectPayload,
  ProjectStatus,
} from './types';

export function adaptProjectStatus(rawStatus?: string): ProjectStatus {
  const s = (rawStatus || '').toUpperCase();
  if (s === 'OPEN') return 'open';
  if (s === 'DRAFT') return 'draft';
  if (s === 'ASSIGNED' || s === 'IN_PROGRESS') return 'in_progress';
  if (s === 'CHANGES_REQUESTED' || s === 'IN_REVIEW' || s === 'SUBMITTED') return 'in_review';
  if (s === 'COMPLETED' || s === 'CLOSED' || s === 'CANCELLED') return 'completed';
  return 'in_progress';
}

export function adaptProject(raw: any): Project {
  if (!raw) {
    return {
      id: '',
      title: 'Untitled Project',
      repo: 'Not linked yet',
      freelancerName: null,
      status: 'open',
      budget: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  const embeddedRepoMatch = String(raw.expected_result || raw.expectedResult || '').match(
    /(?:^|\n)Repository:\s*(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?)/i
  );
  const embeddedRepoUrl = embeddedRepoMatch ? embeddedRepoMatch[1].replace(/\.git$/, '').replace(/\/$/, '') : null;

  let repo = raw.repo;
  const rawRepoUrl = raw.repo_url || raw.repoUrl || embeddedRepoUrl;
  if (rawRepoUrl) {
    repo = rawRepoUrl.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  } else if (!repo) {
    repo = 'Not linked yet';
  }

  const budget = typeof raw.budget === 'number' ? raw.budget : Number(raw.budget) || 0;
  const status = adaptProjectStatus(raw.status);
  const updatedAt = raw.updated_at || raw.updatedAt || raw.created_at || raw.createdAt || new Date().toISOString();
  const tags = raw.required_skills || raw.skills || raw.tags || [];

  return {
    id: raw.id,
    title: raw.title || 'Untitled Project',
    repo,
    freelancerName: raw.freelancer_name ?? raw.freelancerName ?? null,
    status,
    budget,
    updatedAt,
    description: raw.description,
    tags: Array.isArray(tags) ? tags : [],
  };
}

export function adaptProjectDetail(raw: any): ProjectDetail {
  const base = adaptProject(raw);
  const skills = Array.isArray(raw?.required_skills)
    ? raw.required_skills
    : Array.isArray(raw?.skills)
    ? raw.skills
    : [];

  const stacks = Array.isArray(raw?.stacks)
    ? raw.stacks
    : skills;

  const size =
    raw?.size ||
    (base.budget < 3000
      ? 'MICRO_BUG'
      : base.budget <= 7500
      ? 'FEATURE_INTEGRATION'
      : 'COMPLEX_MODULE');

  return {
    ...base,
    description: raw?.description || '',
    blockerType: raw?.blocker_type || raw?.blockerType || 'HARD_BUG',
    stacks,
    specialties: Array.isArray(raw?.specialties) ? raw.specialties : [],
    skills,
    urgency: raw?.urgency || 'ASAP',
    size,
    repoUrl: raw?.repo_url ?? raw?.repoUrl ?? (base.repo && !base.repo.startsWith('codebridge/') && base.repo !== 'Not linked yet' ? `https://github.com/${base.repo}` : null),
    verificationMode:
      raw?.verification_mode || raw?.verificationMode || 'AUTO_TESTS_AND_REVIEW',
    createdAt: raw?.created_at || raw?.createdAt || base.updatedAt,
    matchingStatus: raw?.matching_status || raw?.matchingStatus || 'ready',
  };
}

export function adaptProjectsResponse(raw: any): ProjectsResponse {
  if (!raw) return { items: [] };
  const list = Array.isArray(raw) ? raw : raw.items || [];
  return {
    items: list.map(adaptProject),
  };
}

export function adaptCreateProjectRequest(payload: CreateProjectPayload): any {
  const skills =
    payload.stacks && payload.stacks.length > 0
      ? payload.stacks
      : payload.skills && payload.skills.length > 0
      ? payload.skills
      : payload.tags || [];

  let deadline: string;
  if (payload.deadline) {
    deadline = payload.deadline.includes('T')
      ? payload.deadline.split('T')[0]
      : payload.deadline;
  } else {
    const days =
      payload.urgency === 'ASAP'
        ? 2
        : payload.urgency === 'THIS_WEEK'
        ? 7
        : 30;
    const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    deadline = targetDate.toISOString().split('T')[0];
  }

  return {
    title: payload.title,
    description: payload.description,
    budget: payload.budget,
    currency: 'INR',
    deadline,
    required_skills: skills,
    expected_result: payload.expectedResult || payload.description,
    status: payload.status || 'open',
    blockerType: payload.blockerType || 'HARD_BUG',
    blocker_type: payload.blockerType || 'HARD_BUG',
    stacks: payload.stacks || skills,
    specialties: payload.specialties || [],
    skills: payload.skills || skills,
    urgency: payload.urgency || 'THIS_WEEK',
    repoUrl: payload.repoUrl,
    repo_url: payload.repoUrl,
    verificationMode: payload.verificationMode || 'AUTO_TESTS_AND_REVIEW',
    verification_mode: payload.verificationMode || 'AUTO_TESTS_AND_REVIEW',
  };
}

export function adaptUpdateProjectRequest(payload: Partial<CreateProjectPayload>): any {
  const result: Record<string, any> = {};
  if (payload.title !== undefined) result.title = payload.title;
  if (payload.description !== undefined) result.description = payload.description;
  if (payload.budget !== undefined) result.budget = payload.budget;
  if (payload.blockerType !== undefined) result.blocker_type = payload.blockerType;
  if (payload.stacks !== undefined) {
    result.stacks = payload.stacks;
    result.required_skills = payload.stacks;
  }
  if (payload.specialties !== undefined) result.specialties = payload.specialties;
  if (payload.skills !== undefined) result.skills = payload.skills;
  if (payload.urgency !== undefined) result.urgency = payload.urgency;
  if (payload.repoUrl !== undefined) result.repo_url = payload.repoUrl;
  if (payload.verificationMode !== undefined) result.verification_mode = payload.verificationMode;
  if (payload.status !== undefined) result.status = payload.status;
  return result;
}
