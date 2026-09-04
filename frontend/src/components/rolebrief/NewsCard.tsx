import { Link } from "react-router";
import { Newspaper, TrendingUp, TrendingDown, HelpCircle, Minus, Plus } from "lucide-react";
import type { NewsItem } from "../../lib/fixtures";
import { relativeTime, classNames } from "../../lib/format";
import { Kicker, Badge } from "../ui/primitives";

// News is visually distinct from jobs: cyan editorial accent, eyebrow rhythm, optional image.

const impactMeta = {
  "Likely more hiring": { icon: TrendingUp, klass: "text-emerald" },
  "Likely fewer roles": { icon: TrendingDown, klass: "text-red" },
  "Mixed signal": { icon: Minus, klass: "text-amber" },
  Unclear: { icon: HelpCircle, klass: "text-slate" },
} as const;

type Variant = "feature" | "standard" | "compact";

export function NewsCard({ item, variant = "standard" }: { item: NewsItem; variant?: Variant }) {
  const impact = impactMeta[item.hiringImpact.label];
  const ImpactIcon = impact.icon;

  if (variant === "compact") {
    return (
      <article className="relative py-3 border-b border-line last:border-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="kicker text-cyan">{item.category}</span>
          <span className="font-data text-[11px] text-slate">{relativeTime(item.publishedAt)}</span>
        </div>
        <h3 className="font-medium text-ink leading-snug">
          <Link to={`/news/${item.slug}`} className="hover:text-cyan before:absolute before:inset-0">
            {item.headline}
          </Link>
        </h3>
        <p className="text-[12px] text-slate mt-1 font-data">{item.publisher}</p>
      </article>
    );
  }

  const feature = variant === "feature";

  return (
    <article
      className={classNames(
        "relative group rounded-[var(--radius-card)] border border-line bg-white overflow-hidden",
        "hover:border-cyan/40 hover:shadow-[var(--shadow-raised)] transition-[border-color,box-shadow]",
      )}
    >
      {item.image && (
        <div className={classNames("bg-soft overflow-hidden", feature ? "h-56" : "h-40")}>
          <img
            src={item.image}
            alt=""
            className="size-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        </div>
      )}
      <div className={classNames(feature ? "p-6" : "p-5")}>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 kicker text-cyan">
            <Newspaper size={12} /> {item.category}
          </span>
          <span className="font-data text-[11px] text-slate">· {item.publisher} · {relativeTime(item.publishedAt)}</span>
        </div>
        <h3 className={classNames("font-display text-ink leading-tight", feature ? "text-2xl" : "text-lg")}>
          <Link to={`/news/${item.slug}`} className="hover:text-cyan transition-colors before:absolute before:inset-0">
            {item.headline}
          </Link>
        </h3>

        <div className="mt-3 flex items-start gap-2">
          <Badge tone="cyan">AI summary</Badge>
          <p className={classNames("text-slate", feature ? "text-[15px]" : "text-[13px]")}>{item.summary}</p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[13px]">
          <ImpactIcon size={15} className={impact.klass} />
          <span className={classNames("font-medium", impact.klass)}>{item.hiringImpact.label}</span>
          <span className="text-slate">— {item.hiringImpact.rationale}</span>
        </div>

        {item.relatedJobs.length > 0 && (
          <div className="relative z-10 mt-4 pt-3 border-t border-line flex items-center gap-1.5 text-[13px] text-indigo">
            <Plus size={14} />
            {item.relatedJobs.length} related open role{item.relatedJobs.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </article>
  );
}
