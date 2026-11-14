import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Bot, Archive, FileText, FolderOpen } from 'lucide-react';
import { 
  VaultFile, HemispheresResponse, getHemispheres, getHemisphereForPath 
} from '../lib/vault';

interface HemispherePageProps {
  files: VaultFile[];
}

type HemisphereTab = 'left' | 'right' | 'assets';

const TABS: { key: HemisphereTab; label: string; icon: any; badgeClass: string; description: string }[] = [
  { key: 'left', label: '🧠 Left Hemisphere', icon: Brain, badgeClass: 'badge-left', description: 'Human Domain — READ-ONLY for AI agents' },
  { key: 'right', label: '🤖 Right Hemisphere', icon: Bot, badgeClass: 'badge-right', description: 'AI Domain — Full READ/WRITE autonomy' },
  { key: 'assets', label: '🗄️ Assets', icon: Archive, badgeClass: 'badge-archive', description: 'Static files referenced by notes — READ/WRITE for AI agents' },
];

export function HemispherePage({ files }: HemispherePageProps) {
  const [activeTab, setActiveTab] = useState<HemisphereTab>('right');
  const [apiData, setApiData] = useState<HemispheresResponse | null>(null);

  useEffect(() => {
    getHemispheres().then(setApiData);
  }, []);

  // Group files by hemisphere and folder (client-side fallback)
  const grouped: Record<HemisphereTab, Record<string, VaultFile[]>> = { left: {}, right: {}, assets: {} };
  
  files.forEach(f => {
    const hemisphere = getHemisphereForPath(f.path);
    if (hemisphere === 'system') return; // System files shown on System page
    const topFolder = f.path.split('/')[0];
    const h = hemisphere as HemisphereTab;
    if (!grouped[h][topFolder]) grouped[h][topFolder] = [];
    grouped[h][topFolder].push(f);
  });

  // Use API data if available, otherwise use client-grouped data
  const currentFolders = apiData 
    ? apiData[activeTab]?.folders || {}
    : grouped[activeTab];

  const currentTab = TABS.find(t => t.key === activeTab)!;
  const totalFiles = Object.values(currentFolders).flat().length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Hemispheres</h1>
        <p className="text-[var(--color-text-secondary)]">
          Explore the Split-Brain architecture — files organized by access domain
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 p-1 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const count = Object.values(
            apiData ? (apiData[tab.key]?.folders || {}) : grouped[tab.key]
          ).flat().length;
          
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] shadow-sm' 
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/10' : 'bg-white/5'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Hemisphere Info */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{currentTab.description}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{totalFiles} files across {Object.keys(currentFolders).length} folders</p>
          </div>
          <span className={`badge ${currentTab.badgeClass}`}>
            {activeTab === 'left' ? 'READ-ONLY' : 'READ / WRITE'}
          </span>
        </div>
      </div>

      {/* Folder Groups */}
      <div className="space-y-4 stagger-children">
        {Object.entries(currentFolders)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([folder, folderFiles]) => (
            <div key={folder} className="card">
              <div className="card-header flex items-center gap-3">
                <FolderOpen className="w-4 h-4 text-[var(--color-text-muted)]" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] font-mono">{folder}/</h3>
                <span className="text-xs text-[var(--color-text-muted)] ml-auto">
                  {(folderFiles as VaultFile[]).length} files
                </span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {(folderFiles as VaultFile[]).map(file => (
                  <Link
                    key={file.path}
                    to={`/note/${encodeURIComponent(file.basename)}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-white/3 transition-colors group"
                  >
                    <FileText className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-right-hemisphere)] transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-text-primary)] truncate">{file.basename}</p>
                      {file.frontmatter && Object.keys(file.frontmatter).length > 0 && (
                        <div className="flex gap-1.5 mt-1">
                          {Object.entries(file.frontmatter).slice(0, 3).map(([key, value]) => (
                            <span key={key} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--color-text-muted)] font-mono">
                              {key}: {Array.isArray(value) ? value.join(', ') : String(value).slice(0, 20)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
                {(folderFiles as VaultFile[]).length === 0 && (
                  <div className="px-6 py-4 text-sm text-[var(--color-text-muted)] italic">
                    No files in this folder yet
                  </div>
                )}
              </div>
            </div>
          ))}
        {Object.keys(currentFolders).length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-[var(--color-text-muted)]">No files found in this hemisphere</p>
          </div>
        )}
      </div>
    </div>
  );
}
