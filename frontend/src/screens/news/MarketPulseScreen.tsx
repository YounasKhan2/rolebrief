import { useState } from "react";
import { PageContainer, PageHeader } from "../../components/shell/AppShell";
import { FilterChip, Kicker } from "../../components/ui/primitives";
import { NewsCard } from "../../components/rolebrief/NewsCard";
import { news } from "../../lib/fixtures";

const categories = ["All", "Hiring", "Funding", "Layoffs", "New office", "Remote policy", "Visa & policy", "Graduate programs", "Labor trends"];
const regions = ["All regions", "Pakistan", "UAE", "Worldwide remote"];

export function Component() {
  const [cat, setCat] = useState("All");
  const [region, setRegion] = useState("All regions");

  const filtered = news.filter((n) => {
    if (cat !== "All" && n.category !== cat) return false;
    if (region !== "All regions") {
      const hay = n.locations.join(" ").toLowerCase();
      if (region === "Pakistan" && !hay.includes("pakistan")) return false;
      if (region === "UAE" && !hay.includes("uae")) return false;
      if (region === "Worldwide remote" && !hay.includes("worldwide")) return false;
    }
    return true;
  });

  const [lead, ...rest] = filtered;

  return (
    <PageContainer>
      <PageHeader
        kicker="Market Pulse"
        title="Career news, read for signal."
        description="Company hiring, funding, offices, layoffs and policy — summarized, labelled and linked to the roles they affect. We never reproduce full articles."
      />

      {/* Signal taxonomy */}
      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map((c) => (
          <FilterChip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</FilterChip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        {regions.map((r) => (
          <FilterChip key={r} active={region === r} onClick={() => setRegion(r)}>{r}</FilterChip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-slate py-16 text-center">No stories match this filter right now.</p>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
          <div className="space-y-6">
            {lead && <NewsCard item={lead} variant="feature" />}
            <div className="grid sm:grid-cols-2 gap-5">
              {rest.map((n) => <NewsCard key={n.slug} item={n} variant="standard" />)}
            </div>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-20">
            <div className="rounded-[var(--radius-card)] border border-line p-5">
              <Kicker className="mb-3">Latest across sources</Kicker>
              <div className="-my-3">
                {news.map((n) => <NewsCard key={n.slug} item={n} variant="compact" />)}
              </div>
            </div>
            <div className="rounded-[var(--radius-card)] border border-cyan/30 bg-cyan-tint p-5">
              <Kicker className="mb-2">How to read Pulse</Kicker>
              <p className="text-[13px] text-ink/80">
                Every card separates sourced facts from RoleBrief's hiring-impact interpretation. Labels are guidance,
                not forecasts.
              </p>
            </div>
          </aside>
        </div>
      )}
    </PageContainer>
  );
}
