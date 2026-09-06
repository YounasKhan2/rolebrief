import { useState } from "react";
import { Link } from "react-router";
import { Bookmark, Bell, Building2 } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { EmptyState } from "../../components/ui/primitives";
import { Tabs } from "../../components/ui/form";

type Tab = "jobs" | "searches" | "companies";

export function Component() {
  const [tab, setTab] = useState<Tab>("jobs");

  return (
    <PageContainer>
      <PageHeader
        kicker="Saved Briefs"
        title="Everything you kept for action."
        description="Saved jobs, searches and companies are not persisted yet. This screen is ready for the next backend phase."
      />

      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "jobs", label: "Jobs", count: 0 },
            { value: "searches", label: "Searches", count: 0 },
            { value: "companies", label: "Companies", count: 0 },
          ]}
        />
      </div>

      {tab === "jobs" && (
        <EmptyState
          icon={<Bookmark size={40} />}
          title="No saved jobs yet"
          body="Saved-job persistence is not implemented in this phase."
          action={<Link to="/app/jobs" className="text-indigo font-medium">Browse jobs</Link>}
        />
      )}
      {tab === "searches" && (
        <EmptyState
          icon={<Bell size={40} />}
          title="No saved searches yet"
          body="Saved searches and alerts remain unavailable until their backend phase."
        />
      )}
      {tab === "companies" && (
        <EmptyState
          icon={<Building2 size={40} />}
          title="No followed companies yet"
          body="Followed-company persistence is not implemented in this phase."
        />
      )}
    </PageContainer>
  );
}
