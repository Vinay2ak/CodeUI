import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  User as UserIcon,
  Mail,
  Github,
  Calendar,
  Copy,
  Check,
  Briefcase,
  Settings,
  Bell,
  Cpu,
  Shield,
  Save,
  Plus,
  X,
  Code2,
  ExternalLink,
  Layers,
} from "lucide-react";
import { profileApi } from "../../services/profile/api";
import type { FreelancerProfileData } from "../../services/profile/types";
import type { User } from "../../session/session";
import { sessionStore } from "../../session/session";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "../../components/ui/Select";

const AVAILABILITY_OPTIONS: SelectOption[] = [
  { value: "AVAILABLE", label: "Available for tasks", tone: "success" },
  { value: "OPEN_TO_OFFERS", label: "Open to offers", tone: "primary" },
  { value: "BUSY", label: "Busy / not taking tasks", tone: "muted" },
];

const RUNNER_IMAGE_OPTIONS: SelectOption[] = [
  { value: "codebridge/runner:python3.11", label: "codebridge/runner:python3.11" },
  { value: "codebridge/runner:node20", label: "codebridge/runner:node20" },
  { value: "codebridge/runner:latest", label: "codebridge/runner:latest (Polyglot)" },
];

interface VerifiedPortfolioViewProps {
  user?: User;
  onNavigateToRadar?: () => void;
  initialTab?: "profile" | "settings";
}

export const VerifiedPortfolioView: React.FC<VerifiedPortfolioViewProps> = ({
  user,
  initialTab = "profile",
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"profile" | "settings">(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [copiedId, setCopiedId] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState("");

  const { data: profile } = useQuery<FreelancerProfileData>({
    queryKey: ["freelancer", "full-profile"],
    queryFn: () => profileApi.getFreelancerProfile(user),
    staleTime: 60_000,
  });

  const [formData, setFormData] = useState<FreelancerProfileData | null>(null);

  React.useEffect(() => {
    if (profile && !formData) {
      setFormData(profile);
    }
  }, [profile, formData]);

  const updateMutation = useMutation({
    mutationFn: (updated: Partial<FreelancerProfileData>) =>
      profileApi.updateFreelancerProfile(updated),
    onSuccess: (saved) => {
      setFormData(saved);
      queryClient.setQueryData(["freelancer", "full-profile"], saved);
      queryClient.invalidateQueries({ queryKey: ["freelancer", "skills"] });
      toast.success("Profile and settings saved.");
    },
  });

  const handleCopyId = () => {
    const idToCopy = user?.id || "usr_freelancer_cb";
    navigator.clipboard?.writeText(idToCopy);
    setCopiedId(true);
    toast.success(`Copied ${idToCopy}`);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (!trimmed || !formData) return;
    if (formData.skills.includes(trimmed)) {
      setNewSkillInput("");
      return;
    }
    const updatedSkills = [...formData.skills, trimmed];
    setFormData({ ...formData, skills: updatedSkills });
    setNewSkillInput("");
    updateMutation.mutate({ skills: updatedSkills });
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (!formData) return;
    const updatedSkills = formData.skills.filter((s) => s !== skillToRemove);
    setFormData({ ...formData, skills: updatedSkills });
    updateMutation.mutate({ skills: updatedSkills });
  };

  const handleSaveAll = () => {
    if (!formData) return;
    updateMutation.mutate(formData);
  };

  const currentData = formData || profile;

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 text-foreground">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header Card */}
        <Card className="p-6 sm:p-8 rounded-2xl border-border bg-card shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-2xl shrink-0">
                {(currentData?.displayName || user?.displayName || "D")[0]?.toUpperCase()}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {currentData?.displayName || user?.displayName || "Developer"}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success border border-success-border">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                    <span>Verified developer</span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-primary dark:text-accent font-medium">
                  {currentData?.headline || "Software engineer & systems specialist"}
                </p>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted pt-1">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{user?.email || currentData?.email || "developer@codebridge.dev"}</span>
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Member since 2026</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="flex items-center gap-1 font-mono tabular-nums hover:text-foreground transition-colors"
                    title="Click to copy developer ID"
                  >
                    <span>{(user?.id || "cb-usr-9102").slice(0, 14)}</span>
                    {copiedId ? (
                      <Check className="h-3 w-3 text-success" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Animated Sliding Pill Tab Switcher */}
          <div className="mt-6 pt-5 border-t border-border">
            <div className="inline-flex items-center rounded-full border border-border bg-background p-1">
              {[
                { id: "profile" as const, label: "Developer details", icon: UserIcon },
                { id: "settings" as const, label: "Settings and preferences", icon: Settings },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      isActive ? "text-primary-foreground font-semibold" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="profile-tab-pill"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-primary shadow-sm"
                      />
                    )}
                    <Icon className="relative z-10 h-3.5 w-3.5" aria-hidden="true" />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Tab 1: Developer Details */}
        {activeTab === "profile" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <Card className="rounded-2xl border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary dark:text-accent" aria-hidden="true" />
                  <span>About and experience</span>
                </CardTitle>
                <span className="text-xs text-muted font-medium">
                  {currentData?.experienceYears || 5}+ years experience
                </span>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <p className="text-sm text-foreground leading-relaxed">
                  {currentData?.bio ||
                    "Software engineer specialized in building deterministic backend architectures, containerized microservices, and end-to-end web applications."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
                    <span className="text-xs font-medium text-muted block">Primary role</span>
                    <span className="text-xs font-semibold text-foreground block">Full-stack engineer</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
                    <span className="text-xs font-medium text-muted block">Contract type</span>
                    <span className="text-xs font-semibold text-foreground block">Escrow milestone driven</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-background border border-border space-y-1">
                    <span className="text-xs font-medium text-muted block">GitHub profile</span>
                    <a
                      href={`https://github.com/${currentData?.githubUsername || "codebridge-dev"}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-primary dark:text-accent hover:underline flex items-center gap-1"
                    >
                      <Github className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>@{currentData?.githubUsername || "codebridge-dev"}</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-warning" aria-hidden="true" />
                  <span>Technical skills and stacks</span>
                </CardTitle>
                <span className="text-xs text-muted font-mono tabular-nums">
                  {currentData?.skills.length || 0} skills configured
                </span>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(currentData?.skills || []).map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-background border border-border text-foreground hover:border-ring transition-colors"
                    >
                      <Code2 className="h-3 w-3 text-primary dark:text-accent" aria-hidden="true" />
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        aria-label={`Remove ${skill}`}
                        className="ml-0.5 p-0.5 rounded text-muted hover:text-danger hover:bg-danger-bg transition-colors"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>

                <form onSubmit={handleAddSkill} className="flex items-center gap-2 pt-2">
                  <Input
                    type="text"
                    placeholder="Add a new skill (e.g. FastAPI, Redis, Go)..."
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    className="flex-1 rounded-xl bg-background border-border text-xs h-9"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    className="text-xs h-9 rounded-xl"
                    disabled={!newSkillInput.trim()}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    <span>Add skill</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tab 2: Settings & Preferences */}
        {activeTab === "settings" && currentData && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <Card className="rounded-2xl border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-primary dark:text-accent" aria-hidden="true" />
                  <span>Profile details</span>
                </CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  Update your public developer identity and professional bio.
                </p>
              </CardHeader>
              <CardContent className="pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-display-name" className="text-xs font-medium text-foreground">
                    Display name
                  </Label>
                  <Input
                    id="profile-display-name"
                    type="text"
                    value={currentData.displayName}
                    onChange={(e) =>
                      setFormData({ ...currentData, displayName: e.target.value })
                    }
                    className="rounded-xl bg-background border-border text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-headline" className="text-xs font-medium text-foreground">
                    Professional headline
                  </Label>
                  <Input
                    id="profile-headline"
                    type="text"
                    value={currentData.headline}
                    onChange={(e) =>
                      setFormData({ ...currentData, headline: e.target.value })
                    }
                    className="rounded-xl bg-background border-border text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-github" className="text-xs font-medium text-foreground">
                    GitHub handle
                  </Label>
                  <div className="flex items-center">
                    <span className="px-3 h-9 flex items-center text-xs bg-raised border border-r-0 border-border text-muted rounded-l-xl">
                      github.com/
                    </span>
                    <Input
                      id="profile-github"
                      type="text"
                      value={currentData.githubUsername}
                      onChange={(e) =>
                        setFormData({ ...currentData, githubUsername: e.target.value })
                      }
                      className="flex-1 rounded-l-none rounded-r-xl bg-background border-border text-xs h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="availability-status" className="text-xs font-medium text-foreground block">
                    Availability status
                  </Label>
                  <Select
                    id="availability-status"
                    value={currentData.availability}
                    onChange={(val) =>
                      setFormData({
                        ...currentData,
                        availability: val as any,
                      })
                    }
                    options={AVAILABILITY_OPTIONS}
                    aria-label="Availability status"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="profile-bio" className="text-xs font-medium text-foreground">
                    Bio and summary
                  </Label>
                  <textarea
                    id="profile-bio"
                    rows={3}
                    value={currentData.bio}
                    onChange={(e) =>
                      setFormData({ ...currentData, bio: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary dark:text-accent" aria-hidden="true" />
                  <span>Notification preferences</span>
                </CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  Control the alerts sent to your email and workspace.
                </p>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      New matching tasks in radar
                    </span>
                    <span className="text-xs text-muted block">
                      Receive notifications when new scopes match your proven tech stack.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentData.notifications.newMatchingTasks}
                    onChange={(e) =>
                      setFormData({
                        ...currentData,
                        notifications: {
                          ...currentData.notifications,
                          newMatchingTasks: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Escrow deposit and payout alerts
                    </span>
                    <span className="text-xs text-muted block">
                      Instant alerts when client funds lock or clear to your account.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentData.notifications.escrowUpdates}
                    onChange={(e) =>
                      setFormData({
                        ...currentData,
                        notifications: {
                          ...currentData.notifications,
                          escrowUpdates: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Automated test-gate results
                    </span>
                    <span className="text-xs text-muted block">
                      Receive pass/fail logs when your container submission checks run.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentData.notifications.testGateResults}
                    onChange={(e) =>
                      setFormData({
                        ...currentData,
                        notifications: {
                          ...currentData.notifications,
                          testGateResults: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary dark:text-accent" aria-hidden="true" />
                  <span>Workspace and container settings</span>
                </CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  Configure default runtime container settings for your workspace.
                </p>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="default-runner-image" className="text-xs font-medium text-foreground block">
                    Default runner image
                  </Label>
                  <Select
                    id="default-runner-image"
                    value={currentData.workspaceSettings.defaultImage}
                    onChange={(val) =>
                      setFormData({
                        ...currentData,
                        workspaceSettings: {
                          ...currentData.workspaceSettings,
                          defaultImage: val,
                        },
                      })
                    }
                    options={RUNNER_IMAGE_OPTIONS}
                    aria-label="Default runner image"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Auto-run test gate on save
                    </span>
                    <span className="text-xs text-muted block">
                      Automatically execute test suite runner when solution changes are saved.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentData.workspaceSettings.autoRunTests}
                    onChange={(e) =>
                      setFormData({
                        ...currentData,
                        workspaceSettings: {
                          ...currentData.workspaceSettings,
                          autoRunTests: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary dark:text-accent" aria-hidden="true" />
                  <span>Security and account session</span>
                </CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  Session credentials and authentication state.
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-background border border-border">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground block">Active session</span>
                    <span className="text-xs text-muted block">
                      Signed in as {user?.email || "developer@codebridge.dev"}.
                    </span>
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => sessionStore.logout()}
                    className="text-xs rounded-xl shrink-0"
                  >
                    Sign out
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                onClick={handleSaveAll}
                disabled={updateMutation.isPending}
                className="text-xs px-6 py-2.5 rounded-xl font-semibold shadow-sm"
              >
                <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                <span>{updateMutation.isPending ? "Saving..." : "Save settings"}</span>
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
