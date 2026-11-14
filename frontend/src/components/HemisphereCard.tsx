import { Brain, Bot, Archive, Zap } from 'lucide-react';

interface HemisphereCardProps {
  type: 'left' | 'right' | 'assets' | 'system';
  folders: string[];
  fileCount: number;
  description?: string;
  permission?: string;
}

const HEMISPHERE_CONFIG = {
  left: {
    icon: Brain,
    label: '🧠 Left Hemisphere',
    subtitle: 'Human Domain',
    permission: 'READ-ONLY',
    cardClass: 'hemisphere-left',
    badgeClass: 'badge-left',
    accentColor: 'var(--color-left-hemisphere)',
    bgGlow: 'from-amber-500/5 to-transparent',
  },
  right: {
    icon: Bot,
    label: '🤖 Right Hemisphere',
    subtitle: 'AI Domain',
    permission: 'READ / WRITE',
    cardClass: 'hemisphere-right',
    badgeClass: 'badge-right',
    accentColor: 'var(--color-right-hemisphere)',
    bgGlow: 'from-cyan-500/5 to-transparent',
  },
  assets: {
    icon: Archive,
    label: '🗄️ Assets',
    subtitle: 'Static Files',
    permission: 'READ / WRITE',
    cardClass: 'hemisphere-archive',
    badgeClass: 'badge-archive',
    accentColor: 'var(--color-archive)',
    bgGlow: 'from-gray-500/5 to-transparent',
  },
  system: {
    icon: Zap,
    label: '⚡ System',
    subtitle: 'AI Identity Triad',
    permission: 'READ / WRITE',
    cardClass: 'hemisphere-system',
    badgeClass: 'badge-system',
    accentColor: 'var(--color-system)',
    bgGlow: 'from-violet-500/5 to-transparent',
  },
};

export function HemisphereCard({ type, folders, fileCount, description, permission }: HemisphereCardProps) {
  const config = HEMISPHERE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className={`card ${config.cardClass} relative overflow-hidden`}>
      {/* Subtle gradient glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.bgGlow} pointer-events-none`} />
      
      <div className="relative card-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${config.accentColor} 15%, transparent)` }}
          >
            <Icon className="w-5 h-5" style={{ color: config.accentColor }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{config.label}</h3>
            <p className="text-xs text-[var(--color-text-muted)]">{description || config.subtitle}</p>
          </div>
        </div>
        <span className={`badge ${config.badgeClass}`}>
          {permission || config.permission}
        </span>
      </div>
      
      <div className="relative card-body">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold hemisphere-accent" style={{ color: config.accentColor }}>
            {fileCount}
          </span>
          <span className="text-sm text-[var(--color-text-muted)]">files</span>
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          {folders.map(folder => (
            <span 
              key={folder} 
              className="text-xs px-2 py-1 rounded-md bg-white/5 text-[var(--color-text-secondary)] font-mono"
            >
              {folder}/
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
