import { useEffect, useState } from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import { VaultFile, SystemFiles, getSystemFiles } from '../lib/vault';
import { MarkdownViewer } from '../components/MarkdownViewer';

interface SystemPageProps {
  files: VaultFile[];
}

const SYSTEM_FILE_ORDER = ['CLAUDE', 'SOUL', 'MEMORY', 'USER', 'HEARTBEAT'];

const SYSTEM_FILE_META: Record<string, { emoji: string; subtitle: string; role: string }> = {
  CLAUDE: { emoji: '🔌', subtitle: 'Bootloader', role: 'Entry point — instructs agents to load SOUL.md and MEMORY.md before acting' },
  SOUL: { emoji: '👤', subtitle: 'Identity & Rules', role: 'Defines persona, hemisphere permissions, and the memory directive' },
  MEMORY: { emoji: '📋', subtitle: 'Rolling Context', role: 'Active state ledger — agents update this to persist context between sessions' },
  USER: { emoji: '🧑', subtitle: 'User Profile', role: 'Personal config — role, timezone, working hours, integration statuses' },
  HEARTBEAT: { emoji: '💓', subtitle: 'Cron Checklist', role: 'Background daemon tasks — checked by the heartbeat cron job' },
};

export function SystemPage({ files }: SystemPageProps) {
  const [activeTab, setActiveTab] = useState('CLAUDE');
  const [apiSystemFiles, setApiSystemFiles] = useState<SystemFiles | null>(null);

  useEffect(() => {
    getSystemFiles().then(setApiSystemFiles);
  }, []);

  // Get content from API or fallback to loaded files
  function getContent(basename: string): string {
    if (apiSystemFiles && apiSystemFiles[`${basename}.md`]?.exists) {
      return apiSystemFiles[`${basename}.md`].content;
    }
    const file = files.find(f => f.basename === basename);
    return file?.content || '*File not found*';
  }

  const meta = SYSTEM_FILE_META[activeTab];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">System Files</h1>
        <p className="text-[var(--color-text-secondary)]">
          The AI Identity Triad — bootloader chain that configures agent behavior
        </p>
      </div>

      {/* Bootloader Chain Visualization */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
          Agent Boot Sequence
        </h3>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {['CLAUDE', 'SOUL', 'MEMORY'].map((name, i) => (
            <div key={name} className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab(name)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  activeTab === name
                    ? 'bg-[var(--color-system-bg)] border border-[var(--color-system-border)] text-[var(--color-system)]'
                    : 'bg-[var(--color-bg-tertiary)] border border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <span className="text-lg">{SYSTEM_FILE_META[name].emoji}</span>
                <div className="text-left">
                  <p className="text-sm font-bold">{name}.md</p>
                  <p className="text-[10px] opacity-70">{SYSTEM_FILE_META[name].subtitle}</p>
                </div>
              </button>
              {i < 2 && (
                <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar for all system files */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SYSTEM_FILE_ORDER.map(name => (
          <button
            key={name}
            onClick={() => setActiveTab(name)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              activeTab === name
                ? 'bg-[var(--color-system-bg)] text-[var(--color-system)] border border-[var(--color-system-border)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-white/5'
            }`}
          >
            <span>{SYSTEM_FILE_META[name].emoji}</span>
            {name}.md
          </button>
        ))}
      </div>

      {/* Active File Content */}
      <div className="card hemisphere-system animate-fade-in" key={activeTab}>
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-system-bg)] flex items-center justify-center">
                <Zap className="w-5 h-5 text-[var(--color-system)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  {meta.emoji} {activeTab}.md — {meta.subtitle}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{meta.role}</p>
              </div>
            </div>
            <span className="badge badge-system">System</span>
          </div>
        </div>
        <div className="card-body">
          <MarkdownViewer content={getContent(activeTab)} />
        </div>
      </div>
    </div>
  );
}
