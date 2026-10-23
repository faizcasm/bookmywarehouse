import { ArrowUpRight, Check, ShieldCheck, Star } from 'lucide-react';

/**
 * The hero's right-hand visual: a static showcase card instead of the 3D
 * scene it replaced. It is a mock of a real listing — art panel on top,
 * listing summary underneath, with a "booking confirmed" card peeking over
 * the seam — so it sells the product without shipping a WebGL bundle, a
 * capability probe, or a fallback path for it.
 *
 * Decorative: the copy beside it already says everything it shows, so the
 * whole block is hidden from assistive tech rather than read out as a fake
 * listing.
 */
export function HeroShowcase() {
  return (
    <div className="hero-showcase" aria-hidden="true">
      <div className="hero-showcase-art">
        <svg className="hero-showcase-svg" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid meet" role="presentation">
          <defs>
            <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b1220" />
              <stop offset="55%" stopColor="#0a1f2c" />
              <stop offset="100%" stopColor="#062a22" />
            </linearGradient>
            <radialGradient id="hs-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="hs-roof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#223049" />
              <stop offset="100%" stopColor="#111a2b" />
            </linearGradient>
            <linearGradient id="hs-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#182338" />
              <stop offset="100%" stopColor="#0d1524" />
            </linearGradient>
            <linearGradient id="hs-door" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a1220" />
              <stop offset="100%" stopColor="#111d31" />
            </linearGradient>
            <linearGradient id="hs-open" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="hs-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a1220" />
              <stop offset="100%" stopColor="#050b14" />
            </linearGradient>
            <linearGradient id="hs-truck" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>

          {/* Night sky: glow, moon, stars */}
          <rect width="640" height="400" fill="url(#hs-sky)" />
          <ellipse cx="500" cy="128" rx="250" ry="190" fill="url(#hs-glow)" />
          <circle cx="508" cy="96" r="54" fill="#a7f3d0" opacity="0.07" />
          <circle cx="508" cy="96" r="27" fill="#ecfdf5" opacity="0.9" />
          <g fill="#ffffff">
            <circle cx="52" cy="56" r="1.5" opacity="0.6" />
            <circle cx="118" cy="92" r="1.2" opacity="0.45" />
            <circle cx="196" cy="44" r="1.6" opacity="0.7" />
            <circle cx="286" cy="76" r="1.2" opacity="0.4" />
            <circle cx="372" cy="40" r="1.5" opacity="0.6" />
            <circle cx="436" cy="104" r="1.2" opacity="0.35" />
            <circle cx="596" cy="52" r="1.6" opacity="0.65" />
            <circle cx="556" cy="150" r="1.3" opacity="0.4" />
            <circle cx="86" cy="152" r="1.3" opacity="0.4" />
          </g>

          {/* Distant skyline, left and right of the hub */}
          <g fill="#0c1526">
            <rect x="0" y="250" width="48" height="72" />
            <rect x="54" y="268" width="30" height="54" />
            <rect x="562" y="238" width="42" height="84" />
            <rect x="608" y="258" width="32" height="64" />
          </g>
          <g fill="#34d399" opacity="0.35">
            <rect x="12" y="262" width="4" height="4" />
            <rect x="26" y="278" width="4" height="4" />
            <rect x="64" y="280" width="3" height="3" />
            <rect x="574" y="252" width="4" height="4" />
            <rect x="590" y="272" width="4" height="4" />
            <rect x="618" y="272" width="3" height="3" />
          </g>

          {/* The hub */}
          <ellipse cx="320" cy="324" rx="238" ry="14" fill="#000000" opacity="0.45" />
          <rect x="110" y="208" width="420" height="114" rx="4" fill="url(#hs-wall)" />
          <path d="M84 210 L320 148 L556 210 Z" fill="url(#hs-roof)" />
          <path d="M84 210 L320 148 L556 210" fill="none" stroke="#2dd4bf" strokeOpacity="0.5" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="96" y="203" width="448" height="10" rx="5" fill="#0b1220" />
          <rect x="96" y="212" width="448" height="2" fill="#10b981" opacity="0.35" />
          <rect x="232" y="166" width="176" height="26" rx="7" fill="#0b1220" stroke="#10b981" strokeOpacity="0.4" />
          <text x="320" y="184" textAnchor="middle" fontSize="11.5" letterSpacing="2.6" fontWeight="700" fill="#6ee7b7">
            COLD STORAGE HUB
          </text>

          {/* Dock lights */}
          <g fill="#fbbf24" opacity="0.85">
            <circle cx="184" cy="222" r="3" />
            <circle cx="308" cy="222" r="3" />
            <circle cx="432" cy="222" r="3" />
          </g>

          {/* Shutter 1 (closed) */}
          <rect x="138" y="232" width="92" height="90" rx="3" fill="url(#hs-door)" />
          <g stroke="#1e293b" strokeWidth="3">
            <path d="M138 248 H230" />
            <path d="M138 262 H230" />
            <path d="M138 276 H230" />
            <path d="M138 290 H230" />
            <path d="M138 304 H230" />
          </g>

          {/* Shutter 2 (open, lit) */}
          <rect x="262" y="232" width="92" height="90" rx="3" fill="url(#hs-open)" />
          <rect x="272" y="286" width="30" height="30" rx="2" fill="#0b1220" opacity="0.5" />
          <rect x="308" y="292" width="34" height="24" rx="2" fill="#0b1220" opacity="0.4" />
          <rect x="262" y="232" width="92" height="10" rx="4" fill="#334155" />

          {/* Shutter 3 (closed) */}
          <rect x="386" y="232" width="92" height="90" rx="3" fill="url(#hs-door)" />
          <g stroke="#1e293b" strokeWidth="3">
            <path d="M386 248 H478" />
            <path d="M386 262 H478" />
            <path d="M386 276 H478" />
            <path d="M386 290 H478" />
            <path d="M386 304 H478" />
          </g>

          {/* Dock bumpers and levelers */}
          <g fill="#334155">
            <rect x="132" y="314" width="12" height="10" rx="2" />
            <rect x="224" y="314" width="12" height="10" rx="2" />
            <rect x="256" y="314" width="12" height="10" rx="2" />
            <rect x="348" y="314" width="12" height="10" rx="2" />
            <rect x="380" y="314" width="12" height="10" rx="2" />
            <rect x="472" y="314" width="12" height="10" rx="2" />
          </g>
          <g fill="#475569">
            <rect x="150" y="318" width="68" height="6" rx="2" />
            <rect x="274" y="318" width="68" height="6" rx="2" />
            <rect x="398" y="318" width="68" height="6" rx="2" />
          </g>

          {/* Yard */}
          <rect x="0" y="322" width="640" height="78" fill="url(#hs-ground)" />
          <path d="M0 322 H640" stroke="#1e293b" strokeWidth="2" />
          <g fill="#1e293b">
            <rect x="34" y="352" width="54" height="4" rx="2" />
            <rect x="112" y="352" width="54" height="4" rx="2" />
            <rect x="322" y="362" width="72" height="4" rx="2" />
            <rect x="418" y="362" width="72" height="4" rx="2" />
          </g>
          <ellipse cx="320" cy="394" rx="300" ry="56" fill="url(#hs-glow)" opacity="0.6" />

          {/* Pallets, left foreground */}
          <g>
            <rect x="30" y="292" width="54" height="30" rx="3" fill="#1e293b" />
            <rect x="30" y="303" width="54" height="4" fill="#10b981" opacity="0.5" />
            <rect x="38" y="268" width="38" height="24" rx="3" fill="#273449" />
            <rect x="38" y="277" width="38" height="3" fill="#10b981" opacity="0.4" />
          </g>

          {/* Outbound truck, right foreground */}
          <ellipse cx="520" cy="330" rx="98" ry="8" fill="#000000" opacity="0.4" />
          <g>
            <rect x="446" y="252" width="120" height="62" rx="5" fill="url(#hs-truck)" />
            <rect x="446" y="298" width="120" height="8" fill="#10b981" opacity="0.85" />
            <rect x="458" y="264" width="42" height="18" rx="3" fill="#0b1220" opacity="0.14" />
            <path d="M566 268 h26 l14 20 v26 h-40 z" fill="#dbe4ee" />
            <rect x="572" y="274" width="20" height="13" rx="2" fill="#0f172a" opacity="0.8" />
            <g fill="#0f172a" stroke="#475569" strokeWidth="2.5">
              <circle cx="478" cy="316" r="11" />
              <circle cx="506" cy="316" r="11" />
              <circle cx="588" cy="316" r="11" />
            </g>
          </g>
        </svg>

        <span className="hero-showcase-pill hero-showcase-pill--rating">
          <Star size={12} strokeWidth={2.4} />
          4.9 <em>· 128 reviews</em>
        </span>
        <span className="hero-showcase-pill hero-showcase-pill--verified">
          <ShieldCheck size={12} strokeWidth={2.4} />
          Verified partner
        </span>

        <div className="hero-showcase-float">
          <span className="hero-showcase-float-icon">
            <Check size={15} strokeWidth={3} />
          </span>
          <span>
            <strong>Booking confirmed</strong>
            <small>Bay 4 · 12–16 Nov · COI issued</small>
          </span>
        </div>
      </div>

      <div className="hero-showcase-body">
        <span className="hero-showcase-kicker">Warehouse · Hinjewadi, Pune</span>
        <span className="hero-showcase-title">Cold Storage Hub — Bay 4</span>
        <div className="hero-showcase-specs">
          <span className="hero-showcase-spec">2,400 m²</span>
          <span className="hero-showcase-spec">−4 °C chilled</span>
          <span className="hero-showcase-spec">6 dock levelers</span>
        </div>
        <div className="hero-showcase-foot">
          <span className="hero-showcase-price">
            <strong>₹42</strong> <span>/ m² · month</span>
          </span>
          <span className="hero-showcase-cta">
            View space
            <ArrowUpRight size={14} strokeWidth={2.6} />
          </span>
        </div>
      </div>
    </div>
  );
}
