import { useState } from "react"
import {
  ArrowRight,
  Bookmark,
  Check,
  CheckCheck,
  CircleHelp,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Bell,
} from "lucide-react"

export type DemoKind = "Radar" | "Jobs" | "Match Brief" | "Eligibility Shield" | "Saved Jobs" | "Tracker" | "Alerts" | "Market Pulse" | "Profile" | "Resume" | "Cover letters" | "Assistant" | "Tailoring" | "Interview" | "Search"
// Marketing examples are isolated from discoverable listings and authenticated state.
const examples = [
  {
    title: "Learning experience designer",
    company: "Example education team",
    location: "Remote",
    initials: "Ed",
    tone: "mint",
  },
  {
    title: "Clinical operations manager",
    company: "Example healthcare team",
    location: "London, UK",
    initials: "He",
    tone: "blue",
  },
  {
    title: "Sustainability consultant",
    company: "Example climate team",
    location: "Hybrid",
    initials: "Cl",
    tone: "peach",
  },
]
export default function ProductDemo({ kind }: { kind: DemoKind }) {
  const [saved, setSaved] = useState<string[]>([])
  const [tab, setTab] = useState(0)
  const [enabled, setEnabled] = useState(true)
  const [stage, setStage] = useState(0)
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [edited, setEdited] = useState(false)
  const toggle = (title: string) =>
    setSaved((s) =>
      s.includes(title) ? s.filter((x) => x !== title) : [...s, title],
    )
  return (
    <div className="rb-demo-content">
      <div className="rb-demo-heading">
        <div>
          <span className="rb-mono">YOUR WORKSPACE</span>
          <h3>{kind === "Radar" ? "A little more direction." : kind}</h3>
        </div>
        <span className="rb-avatar">You</span>
      </div>
      {kind === "Jobs" && (
        <>
          <div className="rb-demo-tabs">
            {["Role details", "Compare"].map((t, i) => (
              <button
                key={t}
                aria-pressed={tab === i}
                onClick={() => setTab(i)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="rb-role-detail">
            <span className="rb-company mint">Ed</span>
            <h4>Learning experience designer</h4>
            <p>Example education team</p>
          </div>
          <dl className="rb-compare">
            {[
              ["Working arrangement", "Remote", "Hybrid"],
              ["Employment", "Full-time", "Full-time"],
              ["Salary", "Not disclosed", "Not disclosed"],
              ["Location", "United Kingdom", "London, UK"],
            ].map(([label, value, other]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
                {tab === 1 && <dd>{other}</dd>}
              </div>
            ))}
          </dl>
          <p className="rb-demo-foot">
            {tab === 1
              ? "Comparing with an illustrative clinical operations role."
              : "Employer-provided details, with missing information made clear."}
          </p>
        </>
      )}
      {(kind === "Radar" || kind === "Saved Jobs" || kind === "Search") && (
        <>
          <div className="rb-demo-search">
            <Search size={15} />
            <input
              aria-label="Search example roles"
              placeholder={
                kind === "Search"
                  ? "Education roles with flexible working..."
                  : "Find your next possibility"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <SlidersHorizontal size={15} />
          </div>
          <div className="rb-demo-tabs">
            {["For you", "Freshest", "Remote"].map((t, i) => (
              <button
                key={t}
                aria-pressed={tab === i}
                onClick={() => setTab(i)}
              >
                {t}
              </button>
            ))}
          </div>
          {examples
            .filter(
              (j) =>
                (!query ||
                  `${j.title} ${j.location}`
                    .toLowerCase()
                    .includes(query.toLowerCase())) &&
                (tab !== 2 || j.location === "Remote"),
            )
            .slice()
            .sort((a, b) => (tab === 1 ? b.title.localeCompare(a.title) : 0))
            .map((j) => (
              <article className="rb-job-row" key={j.title}>
                <span className={`rb-company ${j.tone}`}>{j.initials}</span>
                <div>
                  <small>{j.company}</small>
                  <h4>{j.title}</h4>
                  <span className="rb-job-meta">
                    <MapPin size={11} />
                    {j.location}
                    <span>Full-time</span>
                  </span>
                  <span className="rb-evidence">
                    <Check size={12} /> Preferences considered{" "}
                    <span>Source-linked</span>
                  </span>
                </div>
                <button
                  className="rb-icon"
                  title={
                    saved.includes(j.title)
                      ? "Unsave example role"
                      : "Save example role"
                  }
                  aria-label={
                    saved.includes(j.title)
                      ? "Unsave example role"
                      : "Save example role"
                  }
                  aria-pressed={saved.includes(j.title)}
                  onClick={() => toggle(j.title)}
                >
                  <Bookmark
                    size={17}
                    fill={saved.includes(j.title) ? "currentColor" : "none"}
                  />
                </button>
              </article>
            ))}
          {query &&
            !examples.some((j) =>
              `${j.title} ${j.location}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) && (
              <p className="rb-demo-empty">
                No example roles match. Try “learning” or “remote”.
              </p>
            )}
          {kind === "Saved Jobs" && (
            <p className="rb-demo-foot" aria-live="polite">
              {saved.length} selected in this demonstration
            </p>
          )}
        </>
      )}
      {kind === "Match Brief" && (
        <>
          <p className="rb-demo-sub">Learning experience designer</p>
          <div className="rb-alignment">
            <Sparkles size={21} />
            <div>
              <strong>Alignment, explained.</strong>
              <p>Evidence to help you decide what to explore.</p>
            </div>
          </div>
          {[
            [
              "A clear connection",
              "Your preferred role title aligns with this opportunity.",
              true,
            ],
            [
              "Working your way",
              "Remote working matches your stated preference.",
              true,
            ],
            [
              "A detail to investigate",
              "The source does not specify seniority.",
              false,
            ],
          ].map(([title, copy, pass]) => (
            <div className="rb-check-row" key={String(title)}>
              {pass ? <Check size={17} /> : <CircleHelp size={17} />}
              <div>
                <strong>{title}</strong>
                <p>{copy}</p>
              </div>
            </div>
          ))}
          <p className="rb-demo-foot">
            Evidence-based alignment. Never a hiring probability.
          </p>
        </>
      )}
      {kind === "Eligibility Shield" && (
        <>
          <p className="rb-demo-sub">
            The requirements, without the guesswork.
          </p>
          {[
            ["Location", "Remote within the United Kingdom", true],
            ["Work authorization", "Confirm your right to work", false],
            [
              "Professional registration",
              "Not specified by the employer",
              false,
            ],
          ].map(([label, copy, pass]) => (
            <div className="rb-check-row" key={String(label)}>
              {pass ? <ShieldCheck size={18} /> : <CircleHelp size={18} />}
              <div>
                <strong>{label}</strong>
                <p>{copy}</p>
              </div>
              <span className={pass ? "rb-pass" : "rb-flag"}>
                {pass ? "Aligned" : "Check"}
              </span>
            </div>
          ))}
          <div className="rb-note">
            Missing information stays visible. You make the final decision.
          </div>
        </>
      )}
      {kind === "Tracker" && (
        <>
          <p className="rb-demo-sub">Every application. A clear next step.</p>
          <div className="rb-kanban">
            {["Preparing", "Applied", "Interview"].map((s, i) => (
              <div key={s}>
                <h4>
                  <span className={`rb-dot dot-${i}`} />
                  {s}
                  <small>{stage === i ? 1 : 0}</small>
                </h4>
                {stage === i && (
                  <article>
                    <span className="rb-company mint">Ed</span>
                    <strong>Learning experience designer</strong>
                    <small>Example education team</small>
                    <hr />
                    <p>Next: prepare your questions</p>
                    <button onClick={() => setStage((stage + 1) % 3)}>
                      Move to{" "}
                      {stage === 2
                        ? "Preparing"
                        : stage === 0
                          ? "Applied"
                          : "Interview"}
                      <ArrowRight size={13} />
                    </button>
                  </article>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {kind === "Alerts" && (
        <>
          <div className="rb-check-row">
            <Bell size={20} />
            <div>
              <strong>Your next opportunity, on your terms.</strong>
              <p>Education · Remote · Full-time</p>
            </div>
            <button
              className="rb-toggle"
              role="switch"
              aria-checked={enabled}
              aria-label="Example opportunity alert"
              onClick={() => setEnabled(!enabled)}
            >
              <span />
            </button>
          </div>
          <div className="rb-demo-tabs">
            {["Daily", "Weekly"].map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                aria-pressed={tab === i}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="rb-letter">
            <Bell size={22} />
            <h4>
              {enabled
                ? "A thoughtful update. Not another interruption."
                : "A quieter inbox."}
            </h4>
            <p>
              {enabled
                ? `Your ${
                    tab === 0 ? "daily" : "weekly"
                  } digest brings relevant roles together in one place.`
                : "This example alert is paused. Your preferences stay right here."}
            </p>
          </div>
        </>
      )}
      {kind === "Market Pulse" && (
        <>
          <div
            className="rb-editorial-image"
            role="img"
            aria-label="Sunlit architecture"
          />
          <span className="rb-mono">SIGNAL → CONTEXT → OPPORTUNITY</span>
          <h4 className="rb-editorial-title">
            Look beyond the job description.
          </h4>
          <p>
            Read the source. Understand the company context. Separate reported
            facts from interpretation.
          </p>
          <div className="rb-check-row">
            <CheckCheck size={18} />
            <div>
              <strong>Evidence first</strong>
              <p>A hiring signal is context, not a promise of a role.</p>
            </div>
          </div>
        </>
      )}
      {kind === "Profile" && (
        <>
          <div className="rb-profile-banner">
            <span className="rb-avatar">You</span>
            <div>
              <strong>A career, not a checklist.</strong>
              <p>Your preferences keep you in control.</p>
            </div>
          </div>
          <label className="rb-field">
            Preferred role
            <input defaultValue="Learning experience designer" />
          </label>
          <label className="rb-field">
            Working preference
            <select defaultValue="Remote">
              <option>Remote</option>
              <option>Hybrid</option>
              <option>On-site</option>
            </select>
          </label>
          <button className="rb-demo-action" onClick={() => setEdited(true)}>
            Update example preferences <Check size={14} />
          </button>
          {edited && (
            <p aria-live="polite" className="rb-demo-foot">
              Example updated. Your account has not been changed.
            </p>
          )}
        </>
      )}
      {[
        "Resume",
        "Cover letters",
        "Tailoring",
        "Interview",
        "Assistant",
      ].includes(kind) && (
        <>
          {kind === "Assistant" || kind === "Interview" ? (
            <>
              <div className="rb-chat-question">
                {kind === "Interview"
                  ? "Help me prepare for a learning design interview."
                  : "How do I evaluate a move into education?"}
              </div>
              <div className="rb-chat-answer">
                <Sparkles size={20} />
                <div>
                  <strong>
                    {kind === "Interview"
                      ? "Start with your experience."
                      : "Let's make the decision clearer."}
                  </strong>
                  <p>
                    {kind === "Interview"
                      ? "Describe a time you adapted complex material for a new audience. What changed because of your approach?"
                      : "Consider the responsibilities you enjoy, the qualifications required, and the working conditions you need. Which matters most to you?"}
                  </p>
                  {submitted && (
                    <p aria-live="polite">
                      Use a specific example from your own experience. Explain
                      the situation, your action, and what you learned.
                    </p>
                  )}
                </div>
              </div>
              <form
                className="rb-demo-search"
                onSubmit={(e) => {
                  e.preventDefault()
                  setSubmitted(true)
                }}
              >
                <input
                  aria-label="Example assistant message"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Explore a question..."
                  required
                />
                <button className="rb-icon" aria-label="Send example message">
                  <ArrowRight size={18} />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="rb-document-tools">
                <span>
                  <FileText size={15} />{" "}
                  {kind === "Cover letters" ? "Cover letter" : "Your resume"}
                </span>
                <button onClick={() => setEdited(!edited)}>
                  {edited ? "Original" : "Preview refinement"}
                  <Sparkles size={13} />
                </button>
              </div>
              <div className="rb-document">
                <h4>Your name</h4>
                <span className="rb-mono">LEARNING & DEVELOPMENT</span>
                <hr />
                <strong>
                  {kind === "Cover letters"
                    ? "A thoughtful introduction"
                    : "Professional summary"}
                </strong>
                <p>
                  {edited
                    ? "Learning professional who turns complex ideas into accessible experiences. Add your own verified outcomes and examples before using this draft."
                    : "A summary built around your experience, your strengths, and the work you want to do next."}
                </p>
                <strong>
                  {kind === "Tailoring"
                    ? "Relevant experience"
                    : "Your experience, clearly expressed"}
                </strong>
                <p>
                  Highlight the work you actually did. Keep the details you can
                  stand behind.
                </p>
                <div className="rb-document-line" />
                <div className="rb-document-line short" />
              </div>
            </>
          )}
          <p className="rb-demo-foot">
            Illustrative AI output. Review every claim before using it.
          </p>
        </>
      )}
    </div>
  )
}
