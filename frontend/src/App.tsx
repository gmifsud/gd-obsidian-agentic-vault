import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import { getVaultFiles, loadVaultLayout, VaultFile, getHemisphereForPath } from './lib/vault';
import { MarkdownViewer } from './components/MarkdownViewer';
import { Sidebar, MobileMenuButton } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { HemispherePage } from './pages/HemispherePage';
import { TemplatesPage } from './pages/TemplatesPage';
import { SkillsPage } from './pages/SkillsPage';
import { SystemPage } from './pages/SystemPage';
import { OrchestratorPage } from './pages/OrchestratorPage';
import { SessionsPage } from './pages/SessionsPage';
import { VauMIcon } from './components/VauMIcon';

// ============================================
// Note Page — Individual note viewer
// ============================================

function NotePage({ files }: { files: VaultFile[] }) {
  const { basename } = useParams();
  const decodedBasename = decodeURIComponent(basename || '');
  const file = files.find(f => f.basename === decodedBasename);

  if (!file) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📄</span>
        </div>
        <h2 className="text-xl font-bold text-[var(--color-text-muted)] mb-2">Note not found</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          The note "{decodedBasename}" does not exist in the vault.
        </p>
        <Link to="/" className="inline-block mt-4 text-sm text-[var(--color-right-hemisphere)] hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const hemisphere = getHemisphereForPath(file.path);
  const hemisphereLabels: Record<string, { badge: string; label: string }> = {
    left: { badge: 'badge-left', label: 'Left Hemisphere' },
    right: { badge: 'badge-right', label: 'Right Hemisphere' },
    assets: { badge: 'badge-archive', label: 'Assets' },
    system: { badge: 'badge-system', label: 'System' },
  };
  const hemi = hemisphereLabels[hemisphere];

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-6">
        <Link to="/" className="hover:text-[var(--color-text-secondary)] transition-colors">Dashboard</Link>
        <span>/</span>
        <Link to="/hemispheres" className="hover:text-[var(--color-text-secondary)] transition-colors">Hemispheres</Link>
        <span>/</span>
        <span className="text-[var(--color-text-secondary)]">{file.path}</span>
      </div>

      <header className="mb-8 pb-6 border-b border-[var(--color-border)]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{file.basename}</h1>
          <span className={`badge ${hemi.badge} flex-shrink-0`}>{hemi.label}</span>
        </div>
        
        {/* Frontmatter badges */}
        {Object.keys(file.frontmatter).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(file.frontmatter).map(([key, value]) => (
              <span 
                key={key} 
                className="text-xs px-2.5 py-1 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
              >
                <strong className="text-[var(--color-text-primary)] font-medium">{key}:</strong>{' '}
                {Array.isArray(value) ? value.join(', ') : String(value)}
              </span>
            ))}
          </div>
        )}
      </header>
      
      <MarkdownViewer content={file.content} />
    </div>
  );
}

// ============================================
// Main Layout
// ============================================

function AppLayout({ files, children }: { files: VaultFile[]; children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        files={files} 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-12 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] flex items-center px-4 flex-shrink-0">
          <MobileMenuButton onClick={() => setSidebarCollapsed(false)} />
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="hidden lg:flex p-1.5 rounded-md hover:bg-white/5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          )}
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================
// Loading Screen
// ============================================

function LoadingScreen() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/20 animate-pulse-subtle">
        <VauMIcon className="w-8 h-8 text-white" />
      </div>
      <p className="text-sm text-[var(--color-text-muted)] font-medium">Loading Vau-M...</p>
    </div>
  );
}

// ============================================
// App Root
// ============================================

export default function App() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  useEffect(() => {
    // The layout must be loaded before files are classified into Zones.
    loadVaultLayout()
      .catch(err => {
        setLayoutError(err.message);
      })
      .then(() => getVaultFiles())
      .then(loadedFiles => {
        setFiles(loadedFiles);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load vault files:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (layoutError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)] px-8 text-center">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-3">This Vault has no usable layout</h1>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-2xl whitespace-pre-wrap font-mono">{layoutError}</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppLayout files={files}>
        <Routes>
          <Route path="/" element={<DashboardPage files={files} />} />
          <Route path="/hemispheres" element={<HemispherePage files={files} />} />
          <Route path="/templates" element={<TemplatesPage files={files} />} />
          <Route path="/skills" element={<SkillsPage files={files} />} />
          <Route path="/system" element={<SystemPage files={files} />} />
          <Route path="/orchestrator" element={<OrchestratorPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/note/:basename" element={<NotePage files={files} />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
