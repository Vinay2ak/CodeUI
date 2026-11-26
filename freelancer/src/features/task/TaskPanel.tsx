import React, { useState } from "react";
import { FileText, Info, Clock } from "lucide-react";
import { Tabs, TabItem } from "../../components/ui/Tabs";
import { BriefTab } from "./BriefTab";
import { AiContextTab } from "./AiContextTab";
import { TimelineTab } from "./TimelineTab";
import { ErrorBoundary } from "../../app/ErrorBoundary";
import { aiFeature } from "../../lib/features";

interface TaskPanelProps {
  taskId: string;
  onOpenFile?: (path: string) => void;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({ taskId, onOpenFile }) => {
  const [activeTab, setActiveTab] = useState("brief");
  const isAiContextEnabled = aiFeature("context");

  const tabs: TabItem[] = [
    {
      id: "brief",
      label: "Brief",
      icon: <FileText className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />,
    },
    ...(isAiContextEnabled
      ? [
          {
            id: "ai",
            label: "AI Context",
            icon: <Info className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />,
          },
        ]
      : []),
    {
      id: "timeline",
      label: "Timeline",
      icon: <Clock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />,
    },
  ];

  return (
    <div className="h-full flex flex-col bg-surface border-r border-line">
      <div className="p-3 border-b border-line shrink-0">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          ariaLabel="Task specification and context tabs"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 focus-visible:outline-none">
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === "brief" && (
            <ErrorBoundary fallbackTitle="Task Brief Error">
              <BriefTab taskId={taskId} />
            </ErrorBoundary>
          )}

          {activeTab === "ai" && (
            <ErrorBoundary fallbackTitle="AI Context Error">
              <AiContextTab taskId={taskId} onOpenFile={onOpenFile} />
            </ErrorBoundary>
          )}

          {activeTab === "timeline" && (
            <ErrorBoundary fallbackTitle="Timeline Error">
              <TimelineTab taskId={taskId} />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
};
