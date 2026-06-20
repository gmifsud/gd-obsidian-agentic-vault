import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Layers, Cpu, FileCode2, ArrowRight, Clock } from 'lucide-react';
import { HemisphereCard } from '../components/HemisphereCard';
import { SystemHealthPanel } from '../components/SystemHealthPanel';
import { 
  VaultFile, VaultStatus, getVaultStatus, getHemisphereForPath 
} from '../lib/vault';

interface DashboardPageProps {
  files: VaultFile[];
}

export function DashboardPage({ files }: DashboardPageProps) {
  const [status, setStatus] = useState<VaultStatus | null>(null);

  useEffect(() => {
    getVaultStatus().then(setStatus);
  }, []);

  // Compute hemisphere counts from files
  const hemisphereCount = { left: 0, right: 0, archive: 0, system: 0 };
  files.forEach(f => {
    const h = getHemisphereForPath(f.path);
    hemisphereCount[h]++;
  });

  // Parse memory focus and blockers from status or files
  const memoryFile = files.find(f => f.basename === 'MEMORY');
  let memoryFocus = status?.memory_focus || '';
  let memoryBlockers = '';
  let lastLogEntry = '';
  
  if (memoryFile) {
    const focusMatch = memoryFile.content.match(/## 🎯 Current Focus\s*\n([\s\S]*?)(?=\n##|$)/);
    if (focusMatch) {
      memoryFocus = focusMatch[1].replace(/^-\s*/gm, '').trim();
    }
    const blockerMatch = memoryFile.content.match(/## 🚧 Active Blockers[^\n]*\n([\s\S]*?)(?=\n##|$)/);
    if (blockerMatch) {
      memoryBlockers = blockerMatch[1].replace(/^-\s*/gm, '').trim();
    }
    const logMatch = memoryFile.content.match(/## 📜 Rolling Log[^\n]*\n([\s\S]*?)$/);
    if (logMatch) {
      const bullets = logMatch[1].trim().split('\n').filter(l => l.trim().startsWith('-'));
      if (bullets.length > 0) {
        lastLogEntry = bullets[bullets.length - 1].replace(/^-\s*/, '').trim();
      }
    }
  }

  // Heartbeat parsing
  const heartbeatFile = files.find(f => f.basename === 'HEARTBEAT');
  let heartbeatChecked = status?.heartbeat_checked || 0;
  let heartbeatTotal = status?.heartbeat_total || 0;
  
  if (heartbeatFile && !status) {
    const lines = heartbeatFile.content.split('\n');
    lines.forEach(line => {
      if (line.match(/- \[x\]/i)) { heartbeatChecked++; heartbeatTotal++; }
      else if (line.match(/- \[ \]/)) { heartbeatTotal++; }
    });
  }

  // Count templates and skills
  const templateCount = files.filter(f => f.path.startsWith('80_Templates/') && f.basename !== 'Naming_Conventions').length;
  const skillFolders = new Set(
    files.filter(f => f.path.startsWith('40_Agent_Skills/')).map(f => f.path.split('/')[1])
  );
  const mocCount = files.filter(f => f.path.startsWith('00_MOCs/') && f.basename !== 'README').length;

  // Quick links
  const quickLinks = [
    { to: '/hemispheres', icon: Layers, label: 'Hemispheres', desc: 'Explore the Split-Brain architecture' },
    { to: '/templates', icon: FileCode2, label: 'Templates', desc: `${templateCount} YAML templates available` },
    { to: '/skills', icon: Cpu, label: 'Agent Skills', desc: `${skillFolders.size} skills configured` },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          Vault Dashboard
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Overview of your Split-Brain knowledge graph — <span className="text-[var(--color-text-muted)]">{files.length} notes indexed</span>
        </p>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        <StatCard label="Total Notes" value={files.length} icon={FileText} color="var(--color-right-hemisphere)" />
        <StatCard label="Templates" value={templateCount} icon={FileCode2} color="var(--color-system)" />
        <StatCard label="Agent Skills" value={skillFolders.size} icon={Cpu} color="var(--color-success)" />
        <StatCard label="MOC Indexes" value={mocCount} icon={Layers} color="var(--color-left-hemisphere)" />
      </div>

      {/* Hemisphere Overview */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Hemisphere Overview</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          <HemisphereCard
            type="left"
            folders={['01_Journal', '02_Human_Thoughts']}
            fileCount={hemisphereCount.left}
          />
          <HemisphereCard
            type="right"
            folders={['10_Repositories', '20_DevOps', '30_Git', '40_Agent_Skills', '80_Templates']}
            fileCount={hemisphereCount.right}
          />
          <HemisphereCard
            type="system"
            folders={['CLAUDE.md', 'SOUL.md', 'MEMORY.md']}
            fileCount={hemisphereCount.system}
            description="AI Identity Triad + Config"
          />
        </div>
      </div>

      {/* System Health + Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SystemHealthPanel
          memoryFocus={memoryFocus}
          memoryBlockers={memoryBlockers}
          heartbeatChecked={heartbeatChecked}
          heartbeatTotal={heartbeatTotal}
          lastLogEntry={lastLogEntry}
        />

        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Quick Navigation</h3>
          </div>
          <div className="card-body space-y-2">
            {quickLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <link.icon className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-right-hemisphere)] transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{link.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{link.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-right-hemisphere)] group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</p>
    </div>
  );
}
