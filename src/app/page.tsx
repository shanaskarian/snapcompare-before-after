"use client";

import { useState } from "react";

export default function LandingPage() {
  return (
    <div className="landing-page">
      <Header />
      <Hero />
      <HeroComparison />
      <FeaturesSection />
      <PrivacySection />
      <PricingSection />
      <FAQSection />
      <LetterSection />
      <Footer />
    </div>
  );
}

/* ─── HEADER ─── */
function Header() {
  return (
    <header className="landing-header">
      <div className="header-inner">
        <div className="header-logo">
          <div className="logo-icon">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="10" fill="#1a1a2e" />
              <circle cx="15" cy="16" r="4" fill="#6C63FF" opacity="0.8" />
              <circle cx="25" cy="16" r="4" fill="#FF6B6B" opacity="0.8" />
              <path d="M12 28 Q20 32 28 28" stroke="#FFF" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <span className="logo-text">SnapCompare</span>
        </div>
        <nav className="header-nav">
          <a href="#features" className="nav-link">Features</a>
          <a href="#pricing" className="nav-link nav-link-outline">Pricing</a>
          <a href="/app" className="nav-link nav-link-cta">Try the App</a>
        </nav>
      </div>
    </header>
  );
}

/* ─── HERO ─── */
function Hero() {
  return (
    <section className="hero-section">
      <h1 className="hero-title">PERFECT BEFORE &amp; AFTERS</h1>
      <p className="hero-subtitle">
        Turn your <span className="hero-highlight">phone camera</span> into a{" "}
        <span className="hero-bracket">clinical photo studio</span>
        <br />
        that makes every patient comparison look professional.
      </p>
      <a href="/app" className="hero-cta">
        Try SnapCompare Free
      </a>
      <p className="hero-guarantee">No account needed &middot; Works in your browser</p>
    </section>
  );
}

/* ─── HERO COMPARISON ─── */
function HeroComparison() {
  return (
    <section className="hero-comparison">
      <div className="comparison-cards">
        <div className="comparison-card comparison-bad">
          <div className="comparison-mockup">
            <div className="mockup-phone">
              <div className="mockup-screen mockup-bad-photo">
                <div className="bad-overlay">
                  <svg viewBox="0 0 100 120" className="bad-icon">
                    <ellipse cx="50" cy="50" rx="30" ry="40" fill="none" stroke="#FF4444" strokeWidth="2" strokeDasharray="5 5" />
                    <text x="50" y="90" textAnchor="middle" fill="#FF4444" fontSize="8" fontFamily="monospace">OFF CENTER</text>
                    <line x1="20" y1="30" x2="80" y2="30" stroke="#FF4444" strokeWidth="1" opacity="0.5" />
                    <text x="85" y="33" fill="#FF4444" fontSize="6" fontFamily="monospace">uneven</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <p className="comparison-label">Without SnapCompare</p>
        </div>

        <div className="comparison-arrow">
          <svg viewBox="0 0 40 40" fill="none">
            <path d="M8 20H32M32 20L24 12M32 20L24 28" stroke="#FF6B6B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="comparison-card comparison-good">
          <div className="comparison-mockup">
            <div className="mockup-phone">
              <div className="mockup-screen mockup-good-photo">
                <div className="good-overlay">
                  <svg viewBox="0 0 100 120" className="good-icon">
                    <ellipse cx="50" cy="50" rx="30" ry="40" fill="none" stroke="#22C55E" strokeWidth="2" />
                    <line x1="50" y1="8" x2="50" y2="92" stroke="#22C55E" strokeWidth="1" opacity="0.4" />
                    <line x1="18" y1="50" x2="82" y2="50" stroke="#22C55E" strokeWidth="1" opacity="0.4" />
                    <text x="50" y="100" textAnchor="middle" fill="#22C55E" fontSize="7" fontFamily="monospace">CENTERED</text>
                    <text x="50" y="110" textAnchor="middle" fill="#22C55E" fontSize="6" fontFamily="monospace">Lighting: 92%</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <p className="comparison-label">With SnapCompare</p>
        </div>
      </div>
    </section>
  );
}

/* ─── FEATURES ─── */
function FeaturesSection() {
  const features = [
    {
      tag: "Face Detection",
      title: "SMART FACE GUIDE",
      description:
        "SnapCompare detects your patient's face in real-time and shows an alignment oval so every photo is perfectly centered and framed.",
      bullets: [
        "Real-time face detection via camera",
        "Centering guide with alignment oval",
        "Distance indicator for proper framing",
      ],
      mockup: "face-guide",
    },
    {
      tag: "Lighting",
      title: "ANALYZE YOUR LIGHTING",
      description:
        "Get instant feedback on lighting quality. See left vs right balance, overall brightness score, and tips to fix shadows before you shoot.",
      bullets: [
        "Left/Right brightness balance meter",
        "Overall lighting score 0-100",
        "Real-time correction suggestions",
      ],
      mockup: "lighting",
    },
    {
      tag: "Compare",
      title: "THREE COMPARISON MODES",
      description:
        "Show patients their transformation with a drag slider, side-by-side view, or opacity overlay. Perfect for consultations and social media.",
      bullets: [
        "Interactive drag slider comparison",
        "Side-by-side grid view",
        "Opacity blend overlay mode",
      ],
      mockup: "compare",
    },
    {
      tag: "AI Analysis",
      title: "AI-POWERED INSIGHTS",
      description:
        "Connect Gemini or OpenAI to get professional analysis — photo quality scores, positioning consistency checks, and visible change detection.",
      bullets: [
        "Photo quality scoring (1-10)",
        "Lighting & angle consistency check",
        "Objective change detection report",
      ],
      mockup: "ai",
    },
  ];

  return (
    <section id="features" className="features-section">
      <div className="section-header">
        <h2 className="section-title">STOP GUESSING YOUR PHOTOS</h2>
      </div>

      <div className="features-list">
        {features.map((f, i) => (
          <div key={i} className={`feature-row ${i % 2 !== 0 ? "feature-row-reversed" : ""}`}>
            <div className="feature-text-side">
              <span className="feature-tag">{f.tag}</span>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-description">{f.description}</p>
              <ul className="feature-bullets">
                {f.bullets.map((b, j) => (
                  <li key={j} className="feature-bullet">
                    <span className="bullet-check">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="check-icon">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="feature-mockup-side">
              <FeatureMockup type={f.mockup} />
            </div>
          </div>
        ))}
      </div>

      {/* Compatibility cards */}
      <div className="compat-cards">
        <div className="compat-card">
          <div className="compat-icons">
            <span>📱</span> <span>💻</span> <span>📷</span>
          </div>
          <h4 className="compat-title">WORKS ON ANY DEVICE</h4>
          <p className="compat-desc">Phone, tablet, or laptop. Any device with a camera and a browser.</p>
        </div>
        <div className="compat-card">
          <div className="compat-icons">
            <span>🏥</span> <span>💉</span> <span>🦷</span>
          </div>
          <h4 className="compat-title">BUILT FOR AESTHETICS</h4>
          <p className="compat-desc">Med spas, dermatology, plastic surgery, and dental practices.</p>
        </div>
      </div>
    </section>
  );
}

/* ─── FEATURE MOCKUPS ─── */
function FeatureMockup({ type }: { type: string }) {
  const content: Record<string, React.ReactNode> = {
    "face-guide": (
      <div className="mockup-app-screen">
        <div className="mockup-top-bar">
          <span className="mockup-badge-blue">BEFORE</span>
          <div className="mockup-dots">
            <span className="dot-flip">↻</span>
            <span className="dot-grid">⊞</span>
          </div>
        </div>
        <div className="mockup-camera-area">
          <svg viewBox="0 0 200 260" className="mockup-face-svg">
            <defs>
              <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8C4A0" />
                <stop offset="100%" stopColor="#D4A574" />
              </linearGradient>
            </defs>
            <ellipse cx="100" cy="110" rx="48" ry="62" fill="url(#skinGrad)" />
            <ellipse cx="80" cy="96" rx="6" ry="4" fill="#5D4037" />
            <ellipse cx="120" cy="96" rx="6" ry="4" fill="#5D4037" />
            <path d="M88 118 Q100 128 112 118" stroke="#8D6E63" strokeWidth="2" fill="none" />
            <ellipse cx="100" cy="110" rx="55" ry="72" fill="none" stroke="#6C63FF" strokeWidth="2" strokeDasharray="6 4" />
            <line x1="100" y1="35" x2="100" y2="185" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <line x1="42" y1="110" x2="158" y2="110" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <line x1="95" y1="105" x2="105" y2="105" stroke="white" strokeWidth="1" />
            <line x1="100" y1="100" x2="100" y2="110" stroke="white" strokeWidth="1" />
          </svg>
        </div>
        <div className="mockup-status-bar">
          <div className="status-item status-green"><span className="status-dot green" /> Face detected</div>
          <div className="status-item status-green"><span className="status-dot green" /> Centered</div>
        </div>
      </div>
    ),
    lighting: (
      <div className="mockup-app-screen">
        <div className="mockup-top-bar">
          <span className="mockup-badge-green">AFTER</span>
        </div>
        <div className="mockup-camera-area mockup-lighting-area">
          <div className="lighting-viz">
            <div className="lighting-face">
              <div className="lighting-left">L: 68</div>
              <div className="lighting-right">R: 72</div>
            </div>
            <div className="lighting-meter-mock">
              <div className="meter-track">
                <div className="meter-fill" style={{ width: "70%" }} />
                <div className="meter-indicator" style={{ left: "70%" }} />
              </div>
            </div>
            <div className="lighting-score">
              <span className="score-label">Lighting</span>
              <span className="score-value score-excellent">Excellent (70%)</span>
            </div>
            <div className="lighting-balance">
              <span className="balance-label">Balance: 94%</span>
            </div>
          </div>
        </div>
      </div>
    ),
    compare: (
      <div className="mockup-app-screen mockup-compare-screen">
        <div className="compare-tabs">
          <span className="tab-active">Slider</span>
          <span className="tab-inactive">Side by Side</span>
          <span className="tab-inactive">Overlay</span>
        </div>
        <div className="compare-visual">
          <div className="compare-before-half">
            <span className="compare-label-badge blue">Before</span>
          </div>
          <div className="compare-after-half">
            <span className="compare-label-badge green">After</span>
          </div>
          <div className="compare-slider-line">
            <div className="compare-slider-handle">
              <svg viewBox="0 0 24 24" fill="#6C63FF" width="14" height="14">
                <path d="M8 5l-5 7 5 7V5zm8 0v14l5-7-5-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    ),
    ai: (
      <div className="mockup-app-screen mockup-ai-screen">
        <div className="ai-header-mock">
          <span className="ai-icon">⚡</span>
          <span className="ai-title-text">AI Analysis</span>
          <span className="ai-badge">Gemini</span>
        </div>
        <div className="ai-results">
          <div className="ai-score-row">
            <span>Lighting consistency</span>
            <span className="ai-score ai-score-high">9/10</span>
          </div>
          <div className="ai-score-row">
            <span>Camera angle match</span>
            <span className="ai-score ai-score-high">8/10</span>
          </div>
          <div className="ai-score-row">
            <span>Face framing</span>
            <span className="ai-score ai-score-high">9/10</span>
          </div>
          <div className="ai-score-row">
            <span>Background consistency</span>
            <span className="ai-score ai-score-mid">7/10</span>
          </div>
          <div className="ai-divider" />
          <div className="ai-change-section">
            <span className="ai-change-title">Visible Changes</span>
            <p className="ai-change-text">Improved skin texture uniformity in the forehead and cheek area. Reduced redness around the nose...</p>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="feature-mockup-wrapper">
      <div className="mockup-device">
        <div className="mockup-device-frame">
          {content[type]}
        </div>
      </div>
    </div>
  );
}

/* ─── PRIVACY ─── */
function PrivacySection() {
  return (
    <section className="privacy-section">
      <div className="privacy-badge">PRIVACY FIRST</div>
      <div className="privacy-icon">
        <svg viewBox="0 0 48 48" fill="none" className="lock-icon">
          <rect x="10" y="20" width="28" height="22" rx="4" fill="#6C63FF" />
          <path d="M16 20V14a8 8 0 1116 0v6" stroke="#6C63FF" strokeWidth="3" fill="none" />
          <circle cx="24" cy="31" r="3" fill="white" />
          <line x1="24" y1="34" x2="24" y2="38" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="privacy-title">YOUR PHOTOS STAY YOURS</h2>
      <p className="privacy-desc">
        All processing runs locally in your browser. Photos are stored on your device only. No cloud uploads, no server storage.
      </p>
      <div className="privacy-stats">
        <div className="privacy-stat">
          <span className="stat-value">100%</span>
          <span className="stat-label">In-Browser</span>
        </div>
        <div className="privacy-stat">
          <span className="stat-value">0</span>
          <span className="stat-label">Photos uploaded</span>
        </div>
        <div className="privacy-stat">
          <span className="stat-value">Local</span>
          <span className="stat-label">AI processing</span>
        </div>
      </div>
    </section>
  );
}

/* ─── PRICING ─── */
function PricingSection() {
  return (
    <section id="pricing" className="pricing-section">
      <h2 className="section-title pricing-headline">CHEAPER THAN ONE RESHOOT</h2>
      <p className="pricing-subline">
        A bad before &amp; after costs you the patient&rsquo;s trust.
        <br />
        SnapCompare is free to start. Upgrade for AI.
      </p>

      <div className="pricing-cards">
        <div className="pricing-card pricing-card-free">
          <div className="pricing-card-header free-header">
            <span>FREE FOREVER</span>
          </div>
          <div className="pricing-card-body">
            <div className="pricing-price">
              <span className="price-amount">$0</span>
            </div>
            <p className="price-period">No credit card needed</p>
            <ul className="pricing-features">
              <li className="pricing-feature"><span className="pf-check">✓</span> Face detection &amp; guide</li>
              <li className="pricing-feature"><span className="pf-check">✓</span> Lighting analysis</li>
              <li className="pricing-feature"><span className="pf-check">✓</span> 3 comparison modes</li>
              <li className="pricing-feature"><span className="pf-check">✓</span> Unlimited sessions</li>
              <li className="pricing-feature"><span className="pf-check">✓</span> Local photo storage</li>
            </ul>
            <a href="/app" className="pricing-cta pricing-cta-free">Get Started Free</a>
          </div>
        </div>

        <div className="pricing-card pricing-card-pro">
          <div className="pricing-card-header pro-header">
            <span>PRO — AI POWERED</span>
            <span className="pro-dot" />
          </div>
          <div className="pricing-card-body">
            <div className="pricing-price">
              <span className="price-old">$29</span>
              <span className="price-amount">$9</span>
              <span className="price-unit">/mo</span>
            </div>
            <p className="price-period">Cancel anytime</p>
            <ul className="pricing-features">
              <li className="pricing-feature"><span className="pf-check">✓</span> Everything in Free</li>
              <li className="pricing-feature"><span className="pf-check pro-check">✓</span> AI photo analysis (Gemini)</li>
              <li className="pricing-feature"><span className="pf-check pro-check">✓</span> Change detection reports</li>
              <li className="pricing-feature"><span className="pf-check pro-check">✓</span> Export comparison images</li>
              <li className="pricing-feature"><span className="pf-check pro-check">✓</span> Priority support</li>
              <li className="pricing-feature"><span className="pf-check pro-check">✓</span> HIPAA-ready workflows</li>
            </ul>
            <a href="/app" className="pricing-cta pricing-cta-pro">Start Pro Trial — $9/mo</a>
          </div>
        </div>
      </div>
      <p className="pricing-note">Launch price — will increase to $29/mo soon.</p>
    </section>
  );
}

/* ─── FAQ ─── */
function FAQSection() {
  const faqs = [
    { q: "How does SnapCompare work?", a: "Open the app in your browser, point your camera at the patient, and SnapCompare instantly detects the face, analyzes lighting, and guides you to take a perfectly aligned photo. Take a 'before' shot, then later take an 'after' shot — and compare them instantly with three different view modes." },
    { q: "Is patient photo data private?", a: "Yes. All face detection and lighting analysis runs entirely in your browser — no images are ever sent to a server. Photos are stored in your browser's local storage on your device. The only time data leaves your device is if you opt into AI analysis, which sends the images to the AI provider you choose (Gemini or OpenAI)." },
    { q: "What devices are supported?", a: "SnapCompare works on any device with a camera and a modern browser — iPhone, iPad, Android phones, laptops, or desktops. Chrome, Safari, Firefox, and Edge are all supported." },
    { q: "How does the AI analysis work?", a: "When you enable AI analysis, SnapCompare sends your before and after photos to your chosen AI provider (Google Gemini or OpenAI GPT-4o) for professional-grade analysis. You get scores for lighting consistency, camera angle match, face framing, and an objective description of visible changes." },
    { q: "Do I need to create an account?", a: "No. The free version works immediately in your browser with no signup. You just open the URL and start capturing. Pro features require a subscription." },
    { q: "Is this HIPAA compliant?", a: "The free version stores everything locally in your browser, which means no PHI is transmitted. For the Pro tier with AI analysis, images are sent to the AI provider's API — we recommend reviewing their data processing agreements for your practice's compliance needs." },
  ];

  return (
    <section className="faq-section">
      <h2 className="section-title">FAQ</h2>
      <div className="faq-list">
        {faqs.map((faq, i) => (
          <FAQItem key={i} question={faq.q} answer={faq.a} />
        ))}
      </div>
      <p className="faq-support">
        Have another question?{" "}
        <a href="mailto:support@snapcompare.app" className="faq-support-link">
          Get support
        </a>
      </p>
    </section>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? "faq-item-open" : ""}`} onClick={() => setOpen(!open)}>
      <div className="faq-question">
        <span>{question}</span>
        <span className="faq-chevron">{open ? "−" : "+"}</span>
      </div>
      {open && <div className="faq-answer">{answer}</div>}
    </div>
  );
}

/* ─── LETTER ─── */
function LetterSection() {
  return (
    <section className="letter-section">
      <h3 className="letter-heading">A letter from your patient</h3>
      <div className="letter-card">
        <p>Hey Doc,</p>
        <p>
          I just wanted to say — the before and after photos you showed me at my last consultation changed everything.
          I could actually <em>see</em> the difference. Not just feel it, but see it side by side, same angle, same lighting.
        </p>
        <p>
          It made me trust the process. It made me excited to come back. And honestly? Those comparison photos
          are why I referred three friends to your practice.
        </p>
        <p>
          Patients talk. And what they talk about is the experience. The details. The professionalism.
          Good photos aren&rsquo;t vanity — they&rsquo;re proof that you care.
        </p>
        <p className="letter-sign">— Your next patient</p>
      </div>
    </section>
  );
}

/* ─── FOOTER ─── */
function Footer() {
  return (
    <footer className="landing-footer">
      <div className="footer-inner">
        <div className="footer-logo">
          <div className="logo-icon small">
            <svg viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#1a1a2e" />
              <circle cx="15" cy="16" r="4" fill="#6C63FF" opacity="0.8" />
              <circle cx="25" cy="16" r="4" fill="#FF6B6B" opacity="0.8" />
              <path d="M12 28 Q20 32 28 28" stroke="#FFF" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <span>SnapCompare</span>
        </div>
        <p className="footer-copy">&copy; 2026 SnapCompare. Built for aesthetic professionals.</p>
      </div>
    </footer>
  );
}
