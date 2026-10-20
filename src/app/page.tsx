import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Brand } from "@/components/shell";
export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#experience">The experience</a>
          <a href="#how-it-works">How it works</a>
          <Link href="/login">Sign in</Link>
          <Link className="btn btn-primary" href="/register">
            Get started <ArrowRight size={16} />
          </Link>
        </nav>
      </header>
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span />
            PREPARE WITH PURPOSE. PERFORM WITH CONFIDENCE.
          </span>
          <h1>
            A little practice.
            <br />A <em>bigger future.</em>
          </h1>
          <p>
            Every great achievement starts with showing up. Your focused
            workspace to practice, test your knowledge, and move closer to being
            selected.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/login">
              Explore the demo <ArrowRight size={18} />
            </Link>
            <a className="btn btn-secondary" href="#experience">
              See what’s inside <ChevronRight size={16} />
            </a>
          </div>
          <div className="hero-proof">
            <span className="mini-avatars">
              <i>AS</i>
              <i>PP</i>
              <i>RV</i>
              <i>AN</i>
            </span>
            <div>
              <strong>Designed for ambitious minds.</strong>
              <small>Your preparation deserves a better experience.</small>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-dots" />
          <div className="hero-preview">
            <div className="preview-top">
              <span className="brand-symbol">
                <GraduationCap size={19} />
              </span>
              <strong>Your next chapter</strong>
              <span className="badge green">Ready when you are</span>
            </div>
            <div className="preview-greeting">
              <small>MAKE TODAY COUNT</small>
              <h2>
                One step closer,
                <br />
                every single day.
              </h2>
              <p>Your ambition. A plan. A place to make it happen.</p>
            </div>
            <div className="preview-metrics">
              <div>
                <BookOpen size={19} />
                <strong>06</strong>
                <span>Curated assessments</span>
              </div>
              <div>
                <Target size={19} />
                <strong>100%</strong>
                <span>Focused on your growth</span>
              </div>
            </div>
            <div className="preview-exam">
              <div className="exam-category-icon violet">
                <BookOpen size={24} />
              </div>
              <div>
                <small>GENERAL APTITUDE</small>
                <h3>SSC CGL Mock Test</h3>
                <span>
                  <Clock3 size={13} />
                  30 minutes · 10 questions
                </span>
              </div>
              <span className="round-arrow">
                <ArrowRight size={19} />
              </span>
            </div>
            <div className="preview-progress">
              <span>Your next milestone starts here</span>
              <div>
                <i />
              </div>
            </div>
          </div>
          <div className="floating-note">
            <span>
              <Trophy size={23} />
            </span>
            <div>
              <strong>You’ve got this.</strong>
              <small>Let your preparation do the talking.</small>
            </div>
            <Sparkles size={16} />
          </div>
        </div>
      </section>
      <div className="landing-ribbon">
        <span>THOUGHTFULLY BUILT FOR YOUR NEXT BIG STEP</span>
        <strong>SSC & Railways</strong>
        <i />
        <strong>Banking</strong>
        <i />
        <strong>Civil Services</strong>
        <i />
        <strong>Campus Placements</strong>
      </div>
      <section id="experience" className="landing-features">
        <div className="section-intro">
          <span className="eyebrow">LESS FRICTION. MORE FOCUS.</span>
          <h2>
            Everything you need.
            <br />
            Room to do your best.
          </h2>
          <p>
            A considered experience for learners and the people helping them
            succeed.
          </p>
        </div>
        <div className="grid three">
          {[
            [
              BookOpen,
              "Practice that feels purposeful",
              "Curated exams, clear instructions, and a distraction-free space to put your knowledge to work.",
            ],
            [
              TrendingUp,
              "Insights you can act on",
              "Understand your strengths with section-wise performance and thoughtful answer explanations.",
            ],
            [
              ShieldCheck,
              "A workspace that works together",
              "Connected assignments, approvals, schedules, and results keep every step in sync.",
            ],
          ].map(([Icon, title, description]) => (
            <article key={String(title)} className="feature-card">
              <span className="feature-icon">
                <Icon size={23} />
              </span>
              <h3>{String(title)}</h3>
              <p>{String(description)}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="how-it-works" className="landing-steps">
        <div>
          <span className="eyebrow">A CLEAR PATH FORWARD</span>
          <h2>
            Show up. Practice.
            <br />
            See what’s possible.
          </h2>
          <Link className="btn btn-primary" href="/login">
            Find your starting point <ArrowRight size={17} />
          </Link>
        </div>
        <ol>
          {[
            "Create your account and get approved",
            "Explore your assigned examinations",
            "Take a focused, timed assessment",
            "Review your results when published",
          ].map((s, i) => (
            <li key={s}>
              <span>0{i + 1}</span>
              {s}
              <Check size={18} />
            </li>
          ))}
        </ol>
      </section>
      <footer className="landing-footer">
        <Brand />
        <p>Phase 1 interactive demo. All data stays in your browser.</p>
        <Link href="/login">
          Open workspace <ArrowRight size={15} />
        </Link>
      </footer>
    </main>
  );
}
