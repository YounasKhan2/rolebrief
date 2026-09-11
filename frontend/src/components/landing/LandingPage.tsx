import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router"
import {
  ArrowRight,
  ArrowUpRight,
  Menu,
  X,
  Pause,
  Play,
  Radar,
  ShieldCheck,
  Layers,
  BriefcaseBusiness,
  Sparkles,
  Check,
} from "lucide-react"
import { useAuth } from "../../lib/auth"
import ProductDemo, { type DemoKind } from "./ProductDemo"
import "./landing.css"

function Brand() {
  return (
    <Link to="/" className="rb-brand" aria-label="RoleBrief home">
      <span className="rb-brand-symbol">
        <Layers size={22} />
      </span>
      RoleBrief<span className="rb-brand-period">.</span>
    </Link>
  )
}
function Actions() {
  return (
    <div className="rb-actions">
      <Link to="/signup" className="rb-button">
        Find your direction <ArrowUpRight size={17} />
      </Link>
      <Link to="/jobs" className="rb-text-link">
        Explore jobs <ArrowRight size={16} />
      </Link>
    </div>
  )
}
function BrowserFrame({
  children,
  label = "RoleBrief / Product tour",
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <div className="rb-browser">
      <div className="rb-browser-bar">
        <span className="rb-traffic">
          <i />
          <i />
          <i />
        </span>
        <span>{label}</span>
        <span className="rb-browser-lock">
          <ShieldCheck size={12} />
        </span>
      </div>
      {children}
    </div>
  )
}
function Header() {
  const [open, setOpen] = useState(false)
  const { isAuthenticated, isAdmin } = useAuth()
  return (
    <header className="rb-header">
      <div className="rb-container rb-nav">
        <Brand />
        <nav
          aria-label="Landing navigation"
          className={open ? "rb-nav-links is-open" : "rb-nav-links"}
        >
          {[
            ["Product", "#product"],
            ["How it works", "#how-it-works"],
            ["Features", "#features"],
            ["AI studio", "#ai"],
            ["Market Pulse", "#market-pulse"],
          ].map(([label, href]) => (
            <a href={href} key={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="rb-nav-actions">
          <Link className="rb-login" to="/login">
            Log in
          </Link>
          <Link
            className="rb-button rb-button-small"
            to={
              isAuthenticated ? (isAdmin ? "/admin" : "/app/radar") : "/signup"
            }
          >
            {isAuthenticated ? "Your workspace" : "Get started"}
            <ArrowUpRight size={15} />
          </Link>
          <button
            className="rb-icon rb-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false)
            }}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  )
}
const tour: DemoKind[] = [
  "Radar",
  "Match Brief",
  "Eligibility Shield",
  "Tracker",
]
function DemoVideo({ src }: { src?: string }) {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)")
    setPlaying(!mq.matches)
    const change = () => setPlaying(!mq.matches)
    mq.addEventListener("change", change)
    return () => mq.removeEventListener("change", change)
  }, [])
  useEffect(() => {
    if (src) {
      if (playing) void video.current?.play().catch(() => setPlaying(false))
      else video.current?.pause()
      return
    }
    if (!playing) return
    const timer = setInterval(
      () => setActive((n) => (n + 1) % tour.length),
      5500,
    )
    return () => clearInterval(timer)
  }, [playing, src])
  return (
    <div id="demo" className="rb-demo-film">
      <BrowserFrame>
        {src ? (
          <video
            ref={video}
            src={src}
            autoPlay
            muted
            loop
            playsInline
            poster="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=85"
          />
        ) : (
          <div className="rb-workspace" onFocusCapture={() => setPlaying(false)}>
            <aside>
              <Brand />
              <span className="rb-mono">YOUR NEXT CHAPTER</span>
              {tour.map((t, i) => (
                <button
                  key={t}
                  className={active === i ? "selected" : ""}
                  onClick={() => {
                    setActive(i)
                    setPlaying(false)
                  }}
                >
                  {i === 0 ? (
                    <Radar size={16} />
                  ) : i === 1 ? (
                    <Sparkles size={16} />
                  ) : i === 2 ? (
                    <ShieldCheck size={16} />
                  ) : (
                    <BriefcaseBusiness size={16} />
                  )}
                  <span>{t}</span>
                </button>
              ))}
              <div className="rb-sidebar-bottom">
                <span className="rb-avatar">You</span>
                <span>
                  Your workspace<small>A clearer next step</small>
                </span>
              </div>
            </aside>
            <div className="rb-film-screen" key={active}>
              <ProductDemo kind={tour[active]} />
            </div>
          </div>
        )}
      </BrowserFrame>
      <div className="rb-film-controls">
        <span className="rb-mono">THE ROLEBRIEF PRODUCT TOUR</span>
        <div>
          {tour.map((t, i) => (
            <button
              key={t}
              aria-label={`Show ${t} demo`}
              aria-pressed={active === i}
              className="rb-film-step"
              onClick={() => {
                setActive(i)
                setPlaying(false)
              }}
            />
          ))}
          <button
            className="rb-icon"
            aria-label={playing ? "Pause product tour" : "Play product tour"}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
        </div>
      </div>
    </div>
  )
}
function Hero() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const mq = matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    const update = () => {
      frame = 0
      const progress = mq.matches
        ? 0
        : Math.max(0, Math.min(1, -element.getBoundingClientRect().top / 800))
      element.style.setProperty("--hero-progress", String(progress))
    }
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", scroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", scroll)
    }
  }, [])
  return (
    <section className="rb-hero" ref={ref}>
      <div className="rb-hero-photo" />
      <div className="rb-container">
        <div className="rb-hero-copy">
          <div className="rb-eyebrow">
            <span /> YOUR NEXT CHAPTER STARTS WITH CLARITY
          </div>
          <h1>
            RoleBrief.
            <br />A clearer view of
            <br />
            <em>what comes next.</em>
          </h1>
          <p>
            Find the opportunities worth your attention.
            <br className="rb-desktop" /> Understand the fit. Move forward with
            confidence.
          </p>
          <Actions />
          <a className="rb-watch" href="#demo">
            <Play size={12} fill="currentColor" /> Take a look inside{" "}
            <span>↓</span>
          </a>
        </div>
        <DemoVideo />
      </div>
      <div className="rb-hero-caption rb-container">
        <span>Built around your career. Whatever your profession.</span>
        <span>Evidence over guesswork. Always.</span>
      </div>
    </section>
  )
}
const features: {
  id: string
  kind: DemoKind
  eyebrow: string
  title: string
  copy: string
  tone: string
  note: string
}[] = [
  {
    id: "radar",
    kind: "Radar",
    eyebrow: "01 / DISCOVER",
    title: "Less searching.\nMore possibility.",
    copy: "A focused view of opportunities shaped around your preferences. Radar brings relevant roles into view, with the evidence to help you choose where to look closer.",
    tone: "blue",
    note: "Your preferences. A more intentional feed.",
  },
  {
    id: "jobs",
    kind: "Jobs",
    eyebrow: "02 / EXPLORE",
    title: "Read the role.\nSee the whole picture.",
    copy: "Bring the details together: responsibilities, working arrangements, salary disclosure, and the original source. Explore across professions, without losing the context.",
    tone: "mint",
    note: "Original sources stay one click away.",
  },
  {
    id: "match-brief",
    kind: "Match Brief",
    eyebrow: "03 / UNDERSTAND YOUR FIT",
    title: "Not a score.\nA reason to look closer.",
    copy: "Understand where a role aligns, where it differs, and where the evidence runs out. Match Brief makes the reasoning visible, so your next move is your own.",
    tone: "lavender",
    note: "Alignment is evidence. It is not a hiring prediction.",
  },
  {
    id: "eligibility",
    kind: "Eligibility Shield",
    eyebrow: "04 / CHECK THE DETAILS",
    title: "A good fit starts\nwith the facts.",
    copy: "Location, authorization, and employer requirements can change the picture. See clear checks, known conflicts, and the questions you still need to ask.",
    tone: "mint",
    note: "Unknown stays unknown. Nothing quietly assumed.",
  },
  {
    id: "saved",
    kind: "Saved Jobs",
    eyebrow: "05 / KEEP YOUR OPTIONS",
    title: "Worth a second look?\nKeep it close.",
    copy: "Build a thoughtful shortlist instead of another collection of browser tabs. Keep promising roles together and return when you have space to decide.",
    tone: "peach",
    note: "A little less scattered. A lot more considered.",
  },
  {
    id: "tracker",
    kind: "Tracker",
    eyebrow: "06 / KEEP MOVING",
    title: "Your next step.\nNever out of sight.",
    copy: "From first interest to the next conversation, keep applications, stages, and personal follow-ups in one place. Make progress without holding it all in your head.",
    tone: "blue",
    note: "Your actions and employer deadlines are distinct.",
  },
  {
    id: "alerts",
    kind: "Alerts",
    eyebrow: "07 / STAY IN THE LOOP",
    title: "The right nudge.\nAt the right time.",
    copy: "Shape your alerts around what matters to you. Choose a rhythm for opportunity updates and notifications that fits your day, rather than interrupting it.",
    tone: "peach",
    note: "Useful updates. Room to focus.",
  },
  {
    id: "market-pulse",
    kind: "Market Pulse",
    eyebrow: "08 / SEE THE CONTEXT",
    title: "Careers don't happen\nin a vacuum.",
    copy: "Look beyond a listing to the news and signals around work. Market Pulse brings a source-conscious perspective to hiring trends and company momentum.",
    tone: "blue",
    note: "Reported facts and interpretation stay separate.",
  },
  {
    id: "profile",
    kind: "Profile",
    eyebrow: "09 / MAKE IT YOURS",
    title: "Start with you.\nKeep evolving.",
    copy: "Your career isn't static. Neither are your preferences. Bring your experience, interests, and working needs together in a profile you can review and refine.",
    tone: "lavender",
    note: "Your direction belongs to you.",
  },
]
function Showcase({
  feature,
  index,
}: {
  feature: typeof features[number]
  index: number
}) {
  return (
    <section
      id={feature.id}
      className={`rb-showcase ${index % 2 ? "rb-reverse" : ""}`}
    >
      <div className="rb-container rb-showcase-grid">
        <div className="rb-showcase-copy">
          <span className="rb-mono">{feature.eyebrow}</span>
          <h2>
            {feature.title.split("\n").map((line, i) => (
              <span key={line}>
                {i === 1 ? <em>{line}</em> : line}
                <br />
              </span>
            ))}
          </h2>
          <p>{feature.copy}</p>
          <a className="rb-text-link" href="#demo">
            Explore the experience <ArrowUpRight size={16} />
          </a>
          <div className="rb-margin-note">
            <span /> {feature.note}
          </div>
        </div>
        <div className={`rb-showcase-stage ${feature.tone}`}>
          <span className="rb-stage-index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <BrowserFrame label={`RoleBrief / ${feature.kind}`}>
            <ProductDemo kind={feature.kind} />
          </BrowserFrame>
        </div>
      </div>
    </section>
  )
}
function ProductSystem() {
  return (
    <section className="rb-system" id="product">
      <div className="rb-container">
        <span className="rb-mono">A CONNECTED WAY FORWARD</span>
        <h2>
          Not more tabs.
          <br />
          <em>A better perspective.</em>
        </h2>
        <div className="rb-system-stack">
          {[
            {
              name: "Discover",
              sub: "Radar + Jobs",
              text: "Open the right doors.",
              icon: Radar,
              tone: "blue",
            },
            {
              name: "Understand",
              sub: "Match Brief + Eligibility Shield",
              text: "Know what you're looking at.",
              icon: ShieldCheck,
              tone: "mint",
            },
            {
              name: "Move forward",
              sub: "Saved + Tracker + Alerts",
              text: "Make your next step count.",
              icon: ArrowUpRight,
              tone: "peach",
            },
            {
              name: "Stay informed",
              sub: "Market Pulse + AI studio",
              text: "Bring context to your decisions.",
              icon: Sparkles,
              tone: "lavender",
            },
          ].map((s, i) => (
            <div
              className={`rb-system-sheet ${s.tone}`}
              style={{ top: 100 + i * 16 }}
              key={s.name}
            >
              <span className="rb-mono">0{i + 1}</span>
              <div>
                <small>{s.sub}</small>
                <h3>{s.name}</h3>
              </div>
              <p>{s.text}</p>
              <s.icon size={38} strokeWidth={1} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
const aiFeatures: { kind: DemoKind; title: string; copy: string }[] = [
  {
    kind: "Resume",
    title: "Your experience, well expressed.",
    copy: "Turn your career history into a structured resume draft. Keep the facts yours, and make the story easier to follow.",
  },
  {
    kind: "Tailoring",
    title: "Relevant. Without reinventing you.",
    copy: "Bring forward the experience that matters to a role. Tailor the emphasis, never the truth.",
  },
  {
    kind: "Cover letters",
    title: "An introduction that sounds like you.",
    copy: "Start a thoughtful cover letter with your real experience and motivation. Review, refine, and make it your own.",
  },
  {
    kind: "Assistant",
    title: "Space to think your next move through.",
    copy: "Explore career questions with an AI companion. Gather perspectives and practical next steps while keeping the decision yours.",
  },
  {
    kind: "Interview",
    title: "Walk in with something to say.",
    copy: "Practice role-relevant questions and organize examples from your own experience. Preparation, without a script to memorize.",
  },
  {
    kind: "Search",
    title: "Start with what you're looking for.",
    copy: "Describe the work and working life you want in plain language. Turn that intention into a clearer search.",
  },
]
function AIStudio() {
  return (
    <section id="ai" className="rb-ai">
      <div className="rb-container rb-ai-intro">
        <span className="rb-eyebrow">
          <Sparkles size={15} /> THE ROLEBRIEF AI STUDIO
        </span>
        <h2>
          A little assistance.
          <br />
          <em>A lot more you.</em>
        </h2>
        <p>
          For the blank page, the big question, and the next conversation.
          <br />
          AI supports your decisions. It doesn't make them for you.
        </p>
      </div>
      {aiFeatures.map((f, i) => (
        <section key={f.kind} className="rb-ai-row rb-container">
          <div>
            <span className="rb-mono">
              {String(i + 1).padStart(2, "0")} /{" "}
              {f.kind === "Resume"
                ? "RESUME GENERATION"
                : f.kind === "Tailoring"
                  ? "RESUME TAILORING"
                  : f.kind === "Search"
                    ? "NATURAL-LANGUAGE SEARCH"
                    : f.kind.toUpperCase()}
            </span>
            <h3>{f.title}</h3>
            <p>{f.copy}</p>
          </div>
          <BrowserFrame label={`RoleBrief AI / ${f.kind}`}>
            <ProductDemo kind={f.kind} />
          </BrowserFrame>
        </section>
      ))}
      <p className="rb-ai-disclosure rb-container">
        Product demonstrations illustrate the RoleBrief vision. AI drafts need
        your review. Match Brief and Eligibility Shield use deterministic
        evidence, independently of AI.
      </p>
    </section>
  )
}
function Footer() {
  return (
    <footer className="rb-footer">
      <div className="rb-container">
        <div className="rb-footer-top">
          <div>
            <Brand />
            <p>
              An evidence-led career platform.
              <br />
              For a working life that feels more like yours.
            </p>
          </div>
          {[
            {
              name: "Product",
              links: [
                ["Radar", "#radar"],
                ["Jobs", "/jobs"],
                ["Market Pulse", "#market-pulse"],
                ["Saved jobs", "#saved"],
                ["Application tracker", "#tracker"],
                ["Alerts", "#alerts"],
              ],
            },
            {
              name: "AI studio",
              links: [
                ["Resume generation", "#ai"],
                ["Resume tailoring", "#ai"],
                ["Cover letters", "#ai"],
                ["Career assistant", "#ai"],
                ["Interview preparation", "#ai"],
              ],
            },
            {
              name: "Explore",
              links: [
                ["How it works", "#how-it-works"],
                ["Match Brief", "#match-brief"],
                ["Eligibility Shield", "#eligibility"],
                ["Our methodology", "/sources-methodology"],
                ["Profile & preferences", "#profile"],
              ],
            },
            {
              name: "Your account",
              links: [
                ["Get started", "/signup"],
                ["Log in", "/login"],
                ["Your workspace", "/app/radar"],
              ],
            },
          ].map((col) => (
            <div key={col.name}>
              <h3>{col.name}</h3>
              {col.links.map(([label, href]) => (
                <Link key={label} to={href}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="rb-footer-word">
          RoleBrief<span>.</span>
        </div>
        <div className="rb-legal">
          <span>© {new Date().getFullYear()} RoleBrief</span>
          <span>A clearer view. A considered next step.</span>
          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href="#top" aria-label="Back to top">
              Back to top ↑
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
export default function LandingPage() {
  useEffect(() => {
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    )
      return
    const nodes = document.querySelectorAll(
      ".rb-showcase-copy,.rb-ai-row>div:first-child",
    )
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible")
            observer.unobserve(entry.target)
          }
        }),
      { threshold: 0.08 },
    )
    nodes.forEach((node) => {
      node.classList.add("rb-reveal")
      observer.observe(node)
    })
    return () => {
      observer.disconnect()
      nodes.forEach((node) => node.classList.remove("rb-reveal"))
    }
  }, [])
  return (
    <div className="rb-landing" id="top">
      <a className="rb-skip" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <section className="rb-professions">
          <div className="rb-container">
            <span className="rb-mono">
              MANY PROFESSIONS. ONE THOUGHTFUL APPROACH.
            </span>
            <div>
              {[
                "Healthcare",
                "Education",
                "Finance",
                "Design",
                "Operations",
                "Technology",
              ].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </div>
        </section>
        <section className="rb-problem rb-container" id="how-it-works">
          <div>
            <span className="rb-mono">A BETTER STARTING POINT</span>
            <h2>
              The search is busy.
              <br />
              <em>Your mind doesn't have to be.</em>
            </h2>
          </div>
          <div className="rb-problem-lines">
            {[
              [
                "Too much noise",
                "A focused Radar, shaped around your preferences.",
              ],
              [
                "Details that don't line up",
                "A clearer view of the role and the source.",
              ],
              [
                "Rules hidden in the fine print",
                "Eligibility evidence, with uncertainty in plain sight.",
              ],
              [
                "Applications everywhere",
                "One place for your options and next steps.",
              ],
            ].map(([a, b], i) => (
              <div key={a}>
                <span className="rb-mono">0{i + 1}</span>
                <div>
                  <h3>{a}</h3>
                  <p>{b}</p>
                </div>
                <ArrowUpRight size={18} />
              </div>
            ))}
          </div>
        </section>
        <ProductSystem />
        <div id="features" className="rb-feature-intro rb-container">
          <span className="rb-mono">THE DETAILS MAKE THE DIFFERENCE</span>
          <h2>
            From possibility
            <br />
            <em>to your next step.</em>
          </h2>
          <p>A connected workspace for the whole journey.</p>
        </div>
        {features.map((f, i) => (
          <Showcase key={f.id} feature={f} index={i} />
        ))}
        <AIStudio />
        <section className="rb-final">
          <div className="rb-container">
            <span className="rb-eyebrow">YOUR NEXT CHAPTER</span>
            <h2>
              Start with a clearer view
              <br />
              of <em>your next role.</em>
            </h2>
            <p>You bring the ambition. Bring a little more clarity along.</p>
            <Actions />
            <div className="rb-final-principles">
              <span>
                <Check size={14} />
                Evidence-led
              </span>
              <span>
                <Check size={14} />
                Your decisions
              </span>
              <span>
                <Check size={14} />
                Every profession
              </span>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
