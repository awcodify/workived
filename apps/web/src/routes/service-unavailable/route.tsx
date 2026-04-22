import { createFileRoute, useRouter } from '@tanstack/react-router'
import { colors } from '@/design/tokens'
import { RefreshCw } from 'lucide-react'

export const Route = createFileRoute('/service-unavailable')({
  component: ServiceUnavailablePage,
})

function BeachServerIllustration() {
  return (
    <svg width="100%" height="auto" viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: '900px' }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5BB8F5" />
          <stop offset="60%" stopColor="#A8DCFA" />
          <stop offset="100%" stopColor="#E8F4FD" />
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4FC3F7" />
          <stop offset="100%" stopColor="#0277BD" />
        </linearGradient>
        <linearGradient id="waterShallow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#81D4FA" />
          <stop offset="100%" stopColor="#4FC3F7" />
        </linearGradient>
        <linearGradient id="umbrella1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.accent} />
          <stop offset="100%" stopColor="#4A3FBF" />
        </linearGradient>
        <linearGradient id="umbrella2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF7043" />
          <stop offset="100%" stopColor="#D84315" />
        </linearGradient>
        <linearGradient id="sunset" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFE0B2" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FFE0B2" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trunkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A0772B" />
          <stop offset="100%" stopColor="#6D4C12" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFF9C4" />
          <stop offset="60%" stopColor="#FFD54F" />
          <stop offset="100%" stopColor="#FFB300" />
        </radialGradient>
      </defs>

      {/* Sky */}
      <rect width="420" height="320" rx="20" fill="url(#sky)" />

      {/* Warm sun glow on horizon */}
      <ellipse cx="340" cy="200" rx="120" ry="80" fill="url(#sunset)" />

      {/* Sun */}
      <circle cx="345" cy="55" r="42" fill="url(#sunGlow)" />
      <circle cx="345" cy="55" r="34" fill="#FFEB3B" />
      {/* Sun rays */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
        <line
          key={angle}
          x1={345 + Math.cos((angle * Math.PI) / 180) * 46}
          y1={55 + Math.sin((angle * Math.PI) / 180) * 46}
          x2={345 + Math.cos((angle * Math.PI) / 180) * 56}
          y2={55 + Math.sin((angle * Math.PI) / 180) * 56}
          stroke="#FFD54F"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={angle % 60 === 0 ? 1 : 0.5}
        />
      ))}

      {/* Distant island */}
      <ellipse cx="380" cy="210" rx="35" ry="8" fill="#8BC34A" opacity="0.3" />
      <path d="M375 210 Q377 195, 385 198" stroke="#6D9B30" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.3" />

      {/* Clouds */}
      <g opacity="0.85">
        <ellipse cx="80" cy="45" rx="38" ry="16" fill="white" />
        <ellipse cx="110" cy="38" rx="30" ry="20" fill="white" />
        <ellipse cx="58" cy="38" rx="26" ry="14" fill="white" />
        <ellipse cx="95" cy="50" rx="22" ry="10" fill="white" />
      </g>
      <g opacity="0.6">
        <ellipse cx="240" cy="70" rx="28" ry="12" fill="white" />
        <ellipse cx="262" cy="64" rx="22" ry="15" fill="white" />
        <ellipse cx="225" cy="64" rx="18" ry="10" fill="white" />
      </g>
      <g opacity="0.4">
        <ellipse cx="170" cy="35" rx="16" ry="8" fill="white" />
        <ellipse cx="182" cy="31" rx="14" ry="10" fill="white" />
      </g>

      {/* Bird silhouettes */}
      <path d="M290 80 Q293 76, 296 80" stroke="#546E7A" strokeWidth="1.2" fill="none" opacity="0.4" />
      <path d="M300 75 Q303 71, 306 75" stroke="#546E7A" strokeWidth="1.2" fill="none" opacity="0.3" />
      <path d="M285 72 Q287 69, 289 72" stroke="#546E7A" strokeWidth="1" fill="none" opacity="0.25" />

      {/* Ocean layers */}
      <path d="M0 225 Q50 218, 105 222 Q160 228, 210 222 Q270 216, 330 224 Q380 230, 420 222 V320 H0 Z" fill="url(#waterShallow)" opacity="0.4" />
      <path d="M0 235 Q60 228, 120 234 Q180 240, 240 234 Q310 226, 380 235 Q400 238, 420 234 V320 H0 Z" fill="url(#water)" opacity="0.55" />
      <path d="M0 245 Q70 238, 140 244 Q220 252, 300 244 Q360 238, 420 245 V320 H0 Z" fill="url(#water)" opacity="0.75" />

      {/* Foam line at shore */}
      <path d="M0 258 Q30 255, 60 258 Q90 261, 120 258 Q150 255, 180 258 Q210 261, 240 258 Q270 255, 300 258 Q330 261, 360 258 Q390 255, 420 258" stroke="white" strokeWidth="2" fill="none" opacity="0.6" />

      {/* Sand */}
      <path d="M0 255 Q100 242, 210 252 Q320 262, 420 255 V320 H0 Z" fill="#F5DEB3" />
      <path d="M0 262 Q210 250, 420 262 V320 H0 Z" fill="#E8D5A3" />
      <path d="M0 275 Q210 265, 420 275 V320 H0 Z" fill="#DCCB96" />

      {/* Sand texture dots */}
      {[30, 75, 130, 200, 260, 310, 370, 55, 155, 235, 340, 100, 280, 385].map((x, i) => (
        <circle key={`sand${i}`} cx={x} cy={272 + (i % 3) * 8} r={0.8 + (i % 2) * 0.4} fill="#C4B484" opacity="0.4" />
      ))}

      {/* Left palm tree */}
      <path d="M62 120 Q64 170, 66 255" stroke="url(#trunkGrad)" strokeWidth="9" strokeLinecap="round" fill="none" />
      {/* Trunk segments */}
      {[140, 155, 170, 185, 200, 215, 230].map((y, i) => (
        <path key={`seg${i}`} d={`M${59 + i * 0.3} ${y} Q${63 + i * 0.3} ${y - 2}, ${67 + i * 0.3} ${y}`} stroke="#8B6914" strokeWidth="1" fill="none" opacity="0.4" />
      ))}
      {/* Coconuts */}
      <circle cx="60" cy="122" r="4" fill="#6D4C12" />
      <circle cx="67" cy="124" r="3.5" fill="#795719" />
      {/* Palm fronds */}
      <path d="M63 120 Q30 80, 5 95" stroke="#2E7D32" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M63 117 Q90 72, 128 82" stroke="#388E3C" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M63 122 Q22 100, 8 115" stroke="#43A047" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M63 119 Q95 88, 118 100" stroke="#4CAF50" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M63 115 Q68 68, 82 65" stroke="#2E7D32" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M63 118 Q40 90, 25 105" stroke="#66BB6A" strokeWidth="5" strokeLinecap="round" fill="none" />

      {/* Right small palm tree */}
      <path d="M358 170 Q359 210, 360 260" stroke="url(#trunkGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M359 172 Q340 155, 330 162" stroke="#388E3C" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M359 170 Q375 150, 390 156" stroke="#43A047" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M359 173 Q345 160, 338 168" stroke="#66BB6A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M359 168 Q365 148, 375 148" stroke="#2E7D32" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Beach umbrella (main) */}
      <rect x="227" y="160" width="5" height="100" rx="2.5" fill="#A1887F" />
      {/* Umbrella canopy */}
      <path d="M167 166 Q230 128, 293 166 Z" fill="url(#umbrella1)" />
      {/* Umbrella stripes */}
      <path d="M183 166 Q206 140, 230 166 Z" fill="#7B6FD4" opacity="0.45" />
      <path d="M230 166 Q253 140, 276 166 Z" fill="#7B6FD4" opacity="0.45" />
      {/* Umbrella tip */}
      <circle cx="230" cy="130" r="3" fill="#4A3FBF" />

      {/* Beach chair */}
      {/* Back legs */}
      <line x1="190" y1="260" x2="200" y2="220" stroke="#8D6E63" strokeWidth="4" strokeLinecap="round" />
      <line x1="272" y1="260" x2="260" y2="220" stroke="#8D6E63" strokeWidth="4" strokeLinecap="round" />
      {/* Cross support */}
      <line x1="195" y1="240" x2="266" y2="240" stroke="#8D6E63" strokeWidth="3" />
      {/* Seat fabric */}
      <rect x="198" y="215" width="64" height="28" rx="3" fill="#FF7043" opacity="0.85" />
      {/* Fabric stripes */}
      <rect x="198" y="222" width="64" height="4" rx="1" fill="#FF8A65" opacity="0.6" />
      <rect x="198" y="232" width="64" height="4" rx="1" fill="#FF8A65" opacity="0.6" />

      {/* === Workived logo character sitting on chair === */}
      {/* Shadow under character */}
      <ellipse cx="230" cy="248" rx="28" ry="5" fill="#00000015" />

      {/* Logo body — rounded purple square */}
      <rect x="204" y="172" width="52" height="52" rx="12" fill={colors.accent} />
      {/* Subtle inner shadow */}
      <rect x="204" y="172" width="52" height="52" rx="12" fill="black" opacity="0.06" />
      <rect x="206" y="174" width="48" height="48" rx="11" fill={colors.accent} />

      {/* "W" letter */}
      <text
        x="230" y="202"
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize="32" fontWeight="800" fill="white"
      >W</text>
      {/* Underline bar */}
      <rect x="216" y="212" width="28" height="4" rx="2" fill="white" opacity="0.7" />

      {/* Sunglasses */}
      <rect x="209" y="180" width="16" height="10" rx="4" fill="#1A1A2E" />
      <rect x="230" y="180" width="16" height="10" rx="4" fill="#1A1A2E" />
      <line x1="225" y1="185" x2="230" y2="185" stroke="#1A1A2E" strokeWidth="2" />
      {/* Glasses reflection */}
      <rect x="212" y="182" width="5" height="3" rx="1.5" fill="#3A3A5E" opacity="0.5" />
      <rect x="233" y="182" width="5" height="3" rx="1.5" fill="#3A3A5E" opacity="0.5" />
      {/* Glasses temples */}
      <line x1="209" y1="184" x2="205" y2="182" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="246" y1="184" x2="250" y2="182" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" />

      {/* Left arm waving */}
      <path d="M204 198 Q190 188, 185 178" stroke={colors.accent} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      {/* Open hand/wave lines */}
      <line x1="185" y1="178" x2="182" y2="172" stroke={colors.accent} strokeWidth="3" strokeLinecap="round" />
      <line x1="185" y1="178" x2="180" y2="175" stroke={colors.accent} strokeWidth="3" strokeLinecap="round" />

      {/* Right arm holding drink */}
      <path d="M256 198 Q268 202, 275 210" stroke={colors.accent} strokeWidth="4.5" strokeLinecap="round" fill="none" />

      {/* Tropical drink */}
      <path d="M270 206 L266 236 L282 236 L278 206 Z" fill="#FF8A65" />
      <rect x="266" y="206" width="16" height="7" rx="2" fill="#FFAB91" />
      {/* Ice cubes */}
      <rect x="270" y="218" width="5" height="4" rx="1" fill="white" opacity="0.35" />
      <rect x="276" y="222" width="4" height="4" rx="1" fill="white" opacity="0.25" />
      {/* Straw */}
      <line x1="280" y1="206" x2="286" y2="188" stroke="#E64A19" strokeWidth="2" strokeLinecap="round" />
      {/* Drink umbrella */}
      <path d="M283 190 Q287 183, 291 190 Z" fill="#E91E63" />
      <line x1="287" y1="190" x2="287" y2="196" stroke="#880E4F" strokeWidth="1" />
      {/* Lime slice */}
      <circle cx="272" cy="208" r="4" fill="#C5E1A5" stroke="#7CB342" strokeWidth="0.8" />
      <path d="M270 208 L274 208" stroke="#7CB342" strokeWidth="0.5" />
      <path d="M272 206 L272 210" stroke="#7CB342" strokeWidth="0.5" />

      {/* Legs dangling */}
      <path d="M218 224 Q216 238, 214 252" stroke={colors.accent} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M240 224 Q242 238, 244 252" stroke={colors.accent} strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Feet */}
      <ellipse cx="212" cy="254" rx="6" ry="3" fill={colors.accent} />
      <ellipse cx="246" cy="254" rx="6" ry="3" fill={colors.accent} />

      {/* Flip flops on sand */}
      <g transform="translate(155, 268)">
        <ellipse cx="0" cy="0" rx="10" ry="5.5" fill="#FF5252" />
        <ellipse cx="0" cy="-1" rx="8" ry="4" fill="#EF5350" />
        <path d="M0 -4 L-2.5 0" stroke="#D32F2F" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M0 -4 L2.5 0" stroke="#D32F2F" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g transform="translate(178, 270) rotate(15)">
        <ellipse cx="0" cy="0" rx="10" ry="5.5" fill="#FF5252" />
        <ellipse cx="0" cy="-1" rx="8" ry="4" fill="#EF5350" />
        <path d="M0 -4 L-2.5 0" stroke="#D32F2F" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M0 -4 L2.5 0" stroke="#D32F2F" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Zzz floating */}
      <g fontFamily="system-ui, sans-serif" fontWeight="bold" fill={colors.accent}>
        <text x="260" y="168" fontSize="18" opacity="0.8">z</text>
        <text x="272" y="155" fontSize="15" opacity="0.6">z</text>
        <text x="282" y="144" fontSize="12" opacity="0.4">z</text>
        <text x="290" y="135" fontSize="9" opacity="0.25">z</text>
      </g>

      {/* Beach towel */}
      <g transform="translate(100, 258) rotate(-5)">
        <rect x="0" y="0" width="50" height="22" rx="2" fill="#E1BEE7" />
        <rect x="0" y="5" width="50" height="3" rx="1" fill="#CE93D8" opacity="0.5" />
        <rect x="0" y="12" width="50" height="3" rx="1" fill="#CE93D8" opacity="0.5" />
        {/* Sunscreen bottle on towel */}
        <rect x="35" y="-10" width="10" height="14" rx="3" fill="#FFF9C4" />
        <rect x="37" y="-14" width="6" height="5" rx="2" fill="#FFD54F" />
        <circle cx="40" cy="-2" r="3" fill="#FF9800" opacity="0.5" />
      </g>

      {/* Starfish on sand */}
      <g transform="translate(320, 272)">
        {[0, 72, 144, 216, 288].map((angle) => (
          <line
            key={angle}
            x1="0" y1="0"
            x2={Math.cos((angle - 90) * Math.PI / 180) * 9}
            y2={Math.sin((angle - 90) * Math.PI / 180) * 9}
            stroke="#E8A44A" strokeWidth="4" strokeLinecap="round"
          />
        ))}
        <circle cx="0" cy="0" r="3" fill="#D4923A" />
        {/* Starfish dots */}
        {[0, 72, 144, 216, 288].map((angle) => (
          <circle
            key={`dot${angle}`}
            cx={Math.cos((angle - 90) * Math.PI / 180) * 5}
            cy={Math.sin((angle - 90) * Math.PI / 180) * 5}
            r="1" fill="#C99A30" opacity="0.5"
          />
        ))}
      </g>

      {/* Seashell */}
      <g transform="translate(298, 276)">
        <path d="M0 0 Q-6 -9, 0 -15 Q6 -9, 0 0" fill="#FFCCBC" stroke="#FFAB91" strokeWidth="1" />
        <path d="M0 0 Q-8 -6, -4 -15" fill="none" stroke="#FFAB91" strokeWidth="0.7" />
        <path d="M0 0 Q8 -6, 4 -15" fill="none" stroke="#FFAB91" strokeWidth="0.7" />
        <path d="M0 0 Q0 -7, 0 -15" fill="none" stroke="#FFAB91" strokeWidth="0.7" />
        <path d="M0 0 Q-4 -7, -2 -15" fill="none" stroke="#FFAB91" strokeWidth="0.5" />
        <path d="M0 0 Q4 -7, 2 -15" fill="none" stroke="#FFAB91" strokeWidth="0.5" />
      </g>

      {/* Sandcastle in the background */}
      <g transform="translate(380, 260)" opacity="0.7">
        <rect x="-12" y="-20" width="24" height="20" rx="2" fill="#D4B870" />
        <rect x="-8" y="-28" width="6" height="10" rx="1" fill="#D4B870" />
        <rect x="2" y="-28" width="6" height="10" rx="1" fill="#D4B870" />
        {/* Battlements */}
        <rect x="-9" y="-31" width="3" height="4" fill="#D4B870" />
        <rect x="-4" y="-31" width="3" height="4" fill="#D4B870" />
        <rect x="1" y="-31" width="3" height="4" fill="#D4B870" />
        <rect x="6" y="-31" width="3" height="4" fill="#D4B870" />
        {/* Door */}
        <path d="M-3 0 L-3 -8 Q0 -12, 3 -8 L3 0" fill="#B8993E" />
        {/* Flag */}
        <line x1="0" y1="-31" x2="0" y2="-40" stroke="#8D6E63" strokeWidth="1" />
        <path d="M0 -40 L8 -37 L0 -34" fill="#FF7043" />
      </g>

      {/* Small crab */}
      <g transform="translate(48, 275)">
        <ellipse cx="0" cy="0" rx="5" ry="3.5" fill="#E57373" />
        <circle cx="-3" cy="-3" r="1.2" fill="#1A1A2E" />
        <circle cx="3" cy="-3" r="1.2" fill="#1A1A2E" />
        {/* Eye stalks */}
        <line x1="-3" y1="-3" x2="-3" y2="-5" stroke="#EF5350" strokeWidth="1" strokeLinecap="round" />
        <line x1="3" y1="-3" x2="3" y2="-5" stroke="#EF5350" strokeWidth="1" strokeLinecap="round" />
        <circle cx="-3" cy="-5.5" r="1" fill="#1A1A2E" />
        <circle cx="3" cy="-5.5" r="1" fill="#1A1A2E" />
        {/* Claws */}
        <path d="M-5 0 Q-10 -3, -8 -6" stroke="#EF5350" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M-8 -6 Q-6 -7, -7 -4" stroke="#EF5350" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <path d="M5 0 Q10 -3, 8 -6" stroke="#EF5350" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M8 -6 Q6 -7, 7 -4" stroke="#EF5350" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        {/* Legs */}
        <line x1="-4" y1="2" x2="-8" y2="4" stroke="#EF5350" strokeWidth="1" strokeLinecap="round" />
        <line x1="-3" y1="3" x2="-6" y2="6" stroke="#EF5350" strokeWidth="1" strokeLinecap="round" />
        <line x1="4" y1="2" x2="8" y2="4" stroke="#EF5350" strokeWidth="1" strokeLinecap="round" />
        <line x1="3" y1="3" x2="6" y2="6" stroke="#EF5350" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function ServiceUnavailablePage() {
  const router = useRouter()

  const handleRetry = () => {
    router.history.back()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: colors.ink0 }}
    >
      <div className="max-w-3xl w-full text-center">
        <div className="mb-6 flex justify-center">
          <BeachServerIllustration />
        </div>

        <h1
          className="text-2xl font-semibold mb-2"
          style={{ color: colors.ink900 }}
        >
          Our Server is On Leave
        </h1>

        <p
          className="text-lg mb-1"
          style={{ color: colors.ink500 }}
        >
          Even servers need a vacation sometimes.
        </p>

        <p className="text-sm mb-8" style={{ color: colors.ink300 }}>
          Don't worry — it filed the request properly and will be back shortly.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full h-12 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
            style={{
              background: colors.accent,
              color: colors.ink0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
          >
            <RefreshCw size={18} />
            Wake Up, Server!
          </button>
        </div>

        <p className="text-xs mt-8" style={{ color: colors.ink300 }}>
          Leave type: Unplanned · Status: Pending Approval · ETA: A few minutes
        </p>
      </div>
    </div>
  )
}
