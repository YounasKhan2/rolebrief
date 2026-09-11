import { Link } from "react-router";
import { Compass, ArrowRight } from "lucide-react";
import { BriefMark } from "../shared/rolebrief/Wordmark";

export function Component() {
  return (
    <div className="min-h-screen bg-paper text-ink flex items-center justify-center px-6 paper-grain">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center mb-6">
          <BriefMark size={44} />
        </div>
        <p className="kicker mb-3">Error 404</p>
        <h1 className="font-display text-5xl text-navy leading-tight">This page has moved on.</h1>
        <p className="mt-4 text-slate reading-measure mx-auto">
          The opportunity you were looking for may have expired or the link is off. Let's get you back to something fresh.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-control)] bg-indigo text-white font-medium hover:bg-indigo/90 transition-colors">
            <Compass size={16} /> Return home
          </Link>
          <Link to="/jobs" className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-control)] border border-line text-ink font-medium hover:border-ink/30 transition-colors">
            Explore jobs <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
