import { useLocation } from "react-router";
import { Kicker } from "../../ui/primitives";
import { Construction } from "lucide-react";

const pageMeta: Record<string, { kicker: string; title: string; description: string }> = {
  "/how-it-works": {
    kicker: "Product",
    title: "How RoleBrief works",
    description: "A deep-dive into the five intelligence signals, evidence methodology, and how your daily brief is assembled.",
  },
  "/coverage": {
    kicker: "Geography",
    title: "Coverage regions",
    description: "RoleBrief currently covers Pakistan, UAE, and worldwide-remote roles, with more regions on the roadmap.",
  },
  "/about": {
    kicker: "Company",
    title: "About RoleBrief",
    description: "Our mission is to make the job search evidence-led, transparent, and respectful of your time.",
  },
  "/privacy": {
    kicker: "Legal",
    title: "Privacy policy",
    description: "How we collect, store, and protect your data.",
  },
  "/terms": {
    kicker: "Legal",
    title: "Terms of service",
    description: "The terms that govern your use of RoleBrief.",
  },
};

const fallback = {
  kicker: "Page",
  title: "Coming soon",
  description: "This page is under construction.",
};

export function Component() {
  const { pathname } = useLocation();
  const meta = pageMeta[pathname] ?? fallback;

  return (
    <div className="mx-auto max-w-2xl px-5 sm:px-8 py-20 lg:py-28 text-center">
      <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-indigo-tint text-indigo mb-6">
        <Construction size={28} />
      </div>
      <Kicker className="mb-3">{meta.kicker}</Kicker>
      <h1 className="font-display text-4xl sm:text-5xl text-navy leading-tight">{meta.title}</h1>
      <p className="mt-5 text-slate text-lg leading-relaxed reading-measure mx-auto">
        {meta.description}
      </p>
      <p className="mt-8 text-[13px] text-slate/70">
        This page is being built. Check back soon.
      </p>
    </div>
  );
}
