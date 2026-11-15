import { useState, useEffect, useRef } from 'react';
import {
  History, Search, RefreshCcw, MessageSquare, User, Bot, Wrench,
  ChevronRight, Clock, HardDrive, Filter, X, ExternalLink,
  ZoomIn, ZoomOut, Archive
} from 'lucide-react';
import {
  fetchSessions, fetchSessionDetail, backupSessions,
  SessionSummary, SessionDetail, SessionMessage, SessionProvider
} from '../lib/vault';

// ============================================
// Provider Metadata & Branding
// ============================================

const PROVIDER_META: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  claude: {
    label: 'Claude',
    color: 'text-orange-400',
    bgColor: 'bg-orange-950/30',
    borderColor: 'border-orange-800/50',
    icon: '🟠',
  },
  codex: {
    label: 'Codex',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/30',
    borderColor: 'border-emerald-800/50',
    icon: '🟢',
  },
  cursor: {
    label: 'Cursor',
    color: 'text-violet-400',
    bgColor: 'bg-violet-950/30',
    borderColor: 'border-violet-800/50',
    icon: '🟣',
  },
  gemini: {
    label: 'Gemini',
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/30',
    borderColor: 'border-blue-800/50',
    icon: '🔵',
  },
  kilocode: {
    label: 'Kilo Code',
    color: 'text-rose-400',
    bgColor: 'bg-rose-950/30',
    borderColor: 'border-rose-800/50',
    icon: '🔴',
  },
  copilot: {
    label: 'Copilot',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-950/30',
    borderColor: 'border-cyan-800/50',
    icon: '💬',
  },
};

const ALL_PROVIDERS: SessionProvider[] = ['claude', 'codex', 'cursor', 'gemini', 'kilocode', 'copilot'];

// ============================================
// Helpers
// ============================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncateId(id: string, maxLen = 12): string {
  if (id.length <= maxLen) return id;
  return `${id.slice(0, maxLen)}…`;
}

// Font sizing maps for the chat zoom option
const CHAT_SIZE_MAP = {
  xs: { text: 'text-xs', tool: 'text-[10px]', meta: 'text-[9px]' },
  sm: { text: 'text-sm', tool: 'text-xs', meta: 'text-[10px]' }, // default
  base: { text: 'text-base', tool: 'text-sm', meta: 'text-xs' },
  lg: { text: 'text-lg', tool: 'text-base', meta: 'text-sm' },
  xl: { text: 'text-xl', tool: 'text-lg', meta: 'text-base' },
};

function ChatBubble({ message, size = 'sm' }: { message: SessionMessage; size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.content.length > 800;
  const displayContent = isLong && !expanded ? message.content.slice(0, 800) + '…' : message.content;
  const font = CHAT_SIZE_MAP[size];

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[75%]">
          <div className="flex items-center gap-1.5 justify-end mb-1">
            <span className={`${font.meta} text-[var(--color-text-muted)]`}>{message.timestamp ? formatRelativeTime(message.timestamp) : ''}</span>
            <User className="w-3 h-3 text-cyan-400" />
          </div>
          <div className={`rounded-2xl rounded-tr-md px-4 py-3 bg-gradient-to-br from-cyan-900/40 to-cyan-800/20 border border-cyan-700/30 ${font.text} text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap break-words`}>
            {displayContent}
            {isLong && (
              <button onClick={() => setExpanded(!expanded)} className="block mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                {expanded ? 'Show less' : 'Show more…'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="flex justify-center mb-3 animate-fade-in">
        <div className="max-w-[85%]">
          <div className="flex items-center gap-1.5 mb-1">
            <Wrench className="w-3 h-3 text-amber-400/70" />
            <span className={`${font.meta} text-[var(--color-text-muted)] font-mono`}>tool call</span>
          </div>
          <div className={`rounded-xl px-3 py-2 bg-amber-950/20 border border-amber-800/20 ${font.tool} font-mono text-amber-300/70 leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto`}>
            {displayContent.slice(0, 500)}
            {message.content.length > 500 && !expanded && (
              <button onClick={() => setExpanded(!expanded)} className="block mt-1 text-amber-400 hover:text-amber-300">
                …expand
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div className="flex justify-start mb-4 animate-fade-in">
      <div className="max-w-[75%]">
        <div className="flex items-center gap-1.5 mb-1">
          <Bot className="w-3 h-3 text-violet-400" />
          <span className={`${font.meta} text-[var(--color-text-muted)]`}>{message.timestamp ? formatRelativeTime(message.timestamp) : ''}</span>
        </div>
        <div className={`rounded-2xl rounded-tl-md px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] ${font.text} text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap break-words`}>
          {displayContent}
          {isLong && (
            <button onClick={() => setExpanded(!expanded)} className="block mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors">
              {expanded ? 'Show less' : 'Show more…'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Session Detail Viewer
// ============================================

function SessionDetailView({ session, onClose }: { session: SessionSummary; onClose: () => void }) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const meta = PROVIDER_META[session.provider];

  // Font Zoom state
  const [textSize, setTextSize] = useState<'xs' | 'sm' | 'base' | 'lg' | 'xl'>('sm');
  const textSizes: ('xs' | 'sm' | 'base' | 'lg' | 'xl')[] = ['xs', 'sm', 'base', 'lg', 'xl'];
  const adjustTextSize = (direction: number) => {
    const idx = textSizes.indexOf(textSize);
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < textSizes.length) {
      setTextSize(textSizes[nextIdx]);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSessionDetail(session.provider, session.id).then(data => {
      setDetail(data);
      setLoading(false);
    });
  }, [session.provider, session.id]);

  useEffect(() => {
    if (detail && chatEndRef.current) {
      // Don't auto-scroll for very long chats
      if ((detail.messages?.length || 0) < 50) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [detail]);

  return (
    <div className="flex flex-col h-full">
      {/* Detail Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-lg`}>{meta.icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">{session.project}</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono">{truncateId(session.id, 24)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Font Zoom Controller */}
          <div className="flex items-center gap-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg p-1">
            <button 
              onClick={() => adjustTextSize(-1)}
              disabled={textSize === 'xs'}
              className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Zoom out text"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[9px] font-mono font-semibold text-[var(--color-text-secondary)] px-1 select-none">
              {textSize === 'xs' ? 'xs' : textSize === 'sm' ? 'sm' : textSize === 'base' ? 'md' : textSize === 'lg' ? 'lg' : 'xl'}
            </span>
            <button 
              onClick={() => adjustTextSize(1)}
              disabled={textSize === 'xl'}
              className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Zoom in text"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.bgColor} ${meta.borderColor} border ${meta.color}`}>
            {meta.label}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
              <p className="text-xs text-[var(--color-text-muted)]">Loading transcript…</p>
            </div>
          </div>
        ) : detail && detail.messages.length > 0 ? (
          <>
            <div className="text-center mb-6">
              <span className="text-[10px] text-[var(--color-text-muted)] px-3 py-1 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
                {detail.messages.length} messages • {formatRelativeTime(session.startedAt)}
              </span>
            </div>
            {detail.messages.map((msg, i) => (
              <ChatBubble key={i} message={msg} size={textSize} />
            ))}
            <div ref={chatEndRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="w-10 h-10 text-[var(--color-text-muted)]/30 mx-auto mb-3" />
              <p className="text-sm text-[var(--color-text-muted)]">No readable messages found</p>
              <p className="text-xs text-[var(--color-text-muted)]/50 mt-1">The session format may not be supported yet</p>
            </div>
          </div>
        )}
      </div>

      {/* Detail Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] flex-shrink-0 bg-[var(--color-bg-secondary)]">
        <span className="text-[10px] text-[var(--color-text-muted)] font-mono truncate max-w-[70%]">
          {session.sourcePath}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {formatBytes(session.sizeBytes)}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Sessions Page
// ============================================

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProviders, setActiveProviders] = useState<Set<SessionProvider>>(new Set(ALL_PROVIDERS));
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);
  const [sortField, setSortField] = useState<'lastModified' | 'messageCount' | 'sizeBytes'>('lastModified');
  const [sortAsc, setSortAsc] = useState(false);
  const [cursorAvailable, setCursorAvailable] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Backup state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupPath, setBackupPath] = useState('');
  const [backupProviders, setBackupProviders] = useState<SessionProvider[]>(ALL_PROVIDERS);
  const [backupStatus, setBackupStatus] = useState<{ loading: boolean; success?: boolean; message?: string } | null>(null);

  const handleBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupPath.trim()) return;
    setBackupStatus({ loading: true });
    
    const result = await backupSessions(backupProviders, backupPath);
    if (result && result.success) {
      setBackupStatus({ 
        loading: false, 
        success: true, 
        message: `Successfully backed up ${result.backedUpCount} sessions to ${backupPath}.` 
      });
    } else {
      setBackupStatus({ 
        loading: false, 
        success: false, 
        message: result?.error || 'Backup failed. Check logs.' 
      });
    }
  };

  // Split resizer logic
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(25); // default 25%
  const [isDragging, setIsDragging] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      if (newWidth >= 15 && newWidth <= 60) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const loadSessions = () => {
    setLoading(true);
    fetchSessions().then(data => {
      if (data) {
        setSessions(data.sessions);
        setCursorAvailable(data.cursor_available);
        setTotalCount(data.total);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // Filter & sort
  const filteredSessions = sessions
    .filter(s => activeProviders.has(s.provider))
    .filter(s => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return s.project.toLowerCase().includes(q) ||
             s.id.toLowerCase().includes(q) ||
             s.provider.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'lastModified') {
        cmp = new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime();
      } else if (sortField === 'messageCount') {
        cmp = a.messageCount - b.messageCount;
      } else {
        cmp = a.sizeBytes - b.sizeBytes;
      }
      return sortAsc ? cmp : -cmp;
    });

  const toggleProvider = (p: SessionProvider) => {
    setActiveProviders(prev => {
      const next = new Set(prev);
      if (next.has(p)) {
        next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Provider stats
  const providerCounts: Record<string, number> = {};
  for (const s of sessions) {
    providerCounts[s.provider] = (providerCounts[s.provider] || 0) + 1;
  }

  return (
    <div className="h-[calc(100vh-7.5rem)] flex flex-col min-h-0 animate-fade-in">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
          <History className="w-8 h-8 text-cyan-400 animate-pulse-subtle" />
          AI Session Explorer
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Browse and search sessions from Claude, Codex, Cursor, Gemini, Kilo Code, and Obsidian Copilot
        </p>
      </div>

      {/* Provider Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
        {ALL_PROVIDERS.map(p => {
          const meta = PROVIDER_META[p];
          const isActive = activeProviders.has(p);
          const count = providerCounts[p] || 0;
          const isDisabled = p === 'cursor' && !cursorAvailable;

          return (
            <button
              key={p}
              onClick={() => !isDisabled && toggleProvider(p)}
              disabled={isDisabled}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                ${isActive
                  ? `${meta.bgColor} ${meta.borderColor} ${meta.color}`
                  : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50'
                }
                ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}
              `}
              title={isDisabled ? 'better-sqlite3 not installed — Cursor sessions unavailable' : ''}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/10' : 'bg-white/5'}`}>
                {count}
              </span>
            </button>
          );
        })}

        {/* Search */}
        <div className="flex-1 min-w-[200px] relative ml-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search projects, session IDs…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-cyan-500/50 transition-all"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={loadSessions}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-white/5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all disabled:opacity-50"
          title="Refresh sessions"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Backup Trigger */}
        <button
          onClick={() => setShowBackupModal(true)}
          className="p-2 rounded-lg hover:bg-white/5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-cyan-500/50 hover:text-cyan-400 transition-all flex items-center gap-1.5 text-xs font-semibold"
          title="Backup all sessions to a custom path"
        >
          <Archive className="w-4 h-4" />
          <span>Backup</span>
        </button>
      </div>

      {/* Main Content: Split panel */}
      <div 
        ref={containerRef} 
        className={`flex gap-1 flex-1 min-h-0 relative ${isDragging ? 'select-none' : ''}`}
      >
        {/* Session List */}
        <div 
          className="card flex flex-col overflow-hidden flex-shrink-0"
          style={{ width: `${leftWidth}%` }}
        >
          <div className="card-header border-b border-[var(--color-border)] pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Sessions</h2>
              <span className="text-[10px] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)]">
                {filteredSessions.length} / {totalCount}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              {(['lastModified', 'messageCount', 'sizeBytes'] as const).map(field => (
                <button
                  key={field}
                  onClick={() => handleSort(field)}
                  className={`px-2 py-1 rounded transition-colors ${sortField === field ? 'text-cyan-400 bg-cyan-950/30' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                >
                  {field === 'lastModified' ? '🕐 Date' : field === 'messageCount' ? '💬 Msgs' : '📦 Size'}
                  {sortField === field && (sortAsc ? ' ↑' : ' ↓')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                  <p className="text-xs text-[var(--color-text-muted)]">Scanning session directories…</p>
                </div>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <History className="w-10 h-10 text-[var(--color-text-muted)]/30 mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-text-muted)]">No sessions found</p>
                  <p className="text-xs text-[var(--color-text-muted)]/50 mt-1">
                    {sessions.length > 0 ? 'Try adjusting filters' : 'Ensure AI tools have been used on this machine'}
                  </p>
                </div>
              </div>
            ) : (
              filteredSessions.map(session => {
                const meta = PROVIDER_META[session.provider];
                const isSelected = selectedSession?.id === session.id && selectedSession?.provider === session.provider;

                return (
                  <button
                    key={`${session.provider}-${session.id}`}
                    onClick={() => setSelectedSession(session)}
                    className={`
                      w-full text-left px-4 py-3 flex items-center gap-3 transition-all hover:bg-white/[0.03]
                      ${isSelected ? 'bg-cyan-950/20 border-l-2 border-l-cyan-400' : 'border-l-2 border-l-transparent'}
                    `}
                  >
                    <span className="text-base flex-shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{session.project}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(session.lastModified)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-2.5 h-2.5" />
                          {session.messageCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-2.5 h-2.5" />
                          {formatBytes(session.sizeBytes)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-cyan-400' : 'text-[var(--color-text-muted)]/30'}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Divider / Resizer */}
        <div
          onMouseDown={startResizing}
          className={`w-2.5 cursor-col-resize flex-shrink-0 flex items-center justify-center transition-colors group ${isDragging ? 'bg-cyan-500/30' : 'hover:bg-cyan-500/10'}`}
          title="Drag to resize panel"
        >
          <div className="w-0.5 h-12 rounded-full bg-[var(--color-border)] group-hover:bg-cyan-400/50" />
        </div>

        {/* Session Detail Viewer */}
        <div 
          className="card flex flex-col overflow-hidden flex-shrink-0"
          style={{ width: `${100 - leftWidth}%` }}
        >
          {selectedSession ? (
            <SessionDetailView
              session={selectedSession}
              onClose={() => setSelectedSession(null)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-[var(--color-text-muted)]/30" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-muted)] mb-1">Select a Session</h3>
                <p className="text-xs text-[var(--color-text-muted)]/50 max-w-[240px]">
                  Click on a session from the list to view its full conversation transcript
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="card w-full max-w-md p-6 relative border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl">
            <button 
              onClick={() => { setShowBackupModal(false); setBackupStatus(null); }}
              className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors animate-pulse-subtle"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Archive className="w-5 h-5 text-cyan-400" />
              Backup Sessions
            </h2>
            <form onSubmit={handleBackup} className="space-y-4">
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Export all session conversations for the selected providers to a local directory as clean Markdown files with YAML frontmatter.
              </p>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                  Target Backup Path
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. C:\Backup\MySessions"
                  value={backupPath}
                  onChange={(e) => setBackupPath(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-cyan-500 transition-all placeholder:text-[var(--color-text-muted)]/45"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                  Select Providers
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PROVIDERS.map(p => {
                    const isChecked = backupProviders.includes(p);
                    return (
                      <label key={p} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-white/5 text-xs text-[var(--color-text-secondary)] select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setBackupProviders(backupProviders.filter(bp => bp !== p));
                            } else {
                              setBackupProviders([...backupProviders, p]);
                            }
                          }}
                          className="rounded border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-cyan-600 focus:ring-0"
                        />
                        {PROVIDER_META[p].label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {backupStatus && (
                <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                  backupStatus.loading 
                    ? 'bg-cyan-950/20 border border-cyan-800 text-cyan-400' 
                    : backupStatus.success 
                      ? 'bg-emerald-950/20 border border-emerald-800 text-emerald-400' 
                      : 'bg-rose-950/20 border border-rose-800 text-rose-400'
                }`}>
                  {backupStatus.loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                      Backing up transcripts...
                    </div>
                  ) : (
                    backupStatus.message
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowBackupModal(false); setBackupStatus(null); }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={backupStatus?.loading || !backupPath.trim()}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Run Backup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
