export function VauMIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      className={className} 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      {/* Outer Vault Ring */}
      <circle cx="12" cy="12" r="9.5" className="stroke-cyan-400" strokeWidth="1.75" />
      {/* Inner safe gear */}
      <circle cx="12" cy="12" r="6" className="stroke-violet-400" />
      {/* Safe spokes */}
      <line x1="12" y1="2.5" x2="12" y2="6" className="stroke-cyan-400" strokeWidth="1.5" />
      <line x1="12" y1="18" x2="12" y2="21.5" className="stroke-cyan-400" strokeWidth="1.5" />
      <line x1="2.5" y1="12" x2="6" y2="12" className="stroke-cyan-400" strokeWidth="1.5" />
      <line x1="18" y1="12" x2="21.5" y2="12" className="stroke-cyan-400" strokeWidth="1.5" />
      {/* Diagonal spokes */}
      <line x1="5.28" y1="5.28" x2="7.76" y2="7.76" className="stroke-cyan-400/70" strokeWidth="1.25" />
      <line x1="16.24" y1="16.24" x2="18.72" y2="18.72" className="stroke-cyan-400/70" strokeWidth="1.25" />
      <line x1="18.72" y1="5.28" x2="16.24" y2="7.76" className="stroke-cyan-400/70" strokeWidth="1.25" />
      <line x1="7.76" y1="16.24" x2="5.28" y2="18.72" className="stroke-cyan-400/70" strokeWidth="1.25" />
      {/* Central Dial and Hand */}
      <circle cx="12" cy="12" r="2.5" className="fill-cyan-950/80 stroke-amber-400" strokeWidth="1.5" />
      <path d="M12 9.75V12l1.25 1.25" className="stroke-amber-400" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
