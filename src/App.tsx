import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import { Brain, FileText, Folder, Menu, X } from 'lucide-react';
import { getVaultFiles, VaultFile } from './lib/vault';
import { MarkdownViewer } from './components/MarkdownViewer';

function VaultLayout({ files, children }: { files: VaultFile[], children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Group files by top-level directory
  const groupedFiles = files.reduce((acc, file) => {
    const parts = file.path.split('/').filter(Boolean);
    const folder = parts.length > 1 ? parts[0] : 'Root';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, VaultFile[]>);

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 border-r border-neutral-800 bg-neutral-900 overflow-y-auto flex-shrink-0 flex flex-col`}>
        <div className="p-4 border-b border-neutral-800 flex items-center gap-2 sticky top-0 bg-neutral-900 z-10">
          <Brain className="w-6 h-6 text-purple-400" />
          <h1 className="font-bold text-neutral-100 truncate">Agentic Vault</h1>
        </div>
        <div className="p-4 space-y-6 flex-grow">
          {Object.entries(groupedFiles).sort().map(([folder, folderFiles]) => (
            <div key={folder}>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Folder className="w-3 h-3" />
                {folder}
              </h2>
              <ul className="space-y-1">
                {folderFiles.map(file => (
                  <li key={file.path}>
                    <Link 
                      to={`/note/${encodeURIComponent(file.basename)}`}
                      className="flex items-center gap-2 text-sm text-neutral-400 hover:text-blue-400 hover:bg-neutral-800/50 px-2 py-1.5 rounded transition-colors truncate"
                    >
                      <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{file.basename}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-neutral-800 bg-neutral-950 flex items-center px-4 flex-shrink-0">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function NotePage({ files }: { files: VaultFile[] }) {
  const { basename } = useParams();
  const file = files.find(f => f.basename === basename);

  if (!file) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-neutral-500">Note not found</h2>
        <p className="text-neutral-600 mt-2">The note "{basename}" does not exist in the vault.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8 pb-4 border-b border-neutral-800">
        <h1 className="text-4xl font-bold text-neutral-100 mb-4">{file.basename}</h1>
        {Object.keys(file.frontmatter).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(file.frontmatter).map(([key, value]) => (
              <span key={key} className="text-xs px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-neutral-400">
                <strong className="text-neutral-300">{key}:</strong> {Array.isArray(value) ? value.join(', ') : String(value)}
              </span>
            ))}
          </div>
        )}
      </header>
      <MarkdownViewer content={file.content} />
    </div>
  );
}

function HomePage() {
  return (
    <div className="py-10">
      <h1 className="text-4xl font-bold text-neutral-100 mb-4">Welcome to the Vault</h1>
      <p className="text-neutral-400 text-lg">
        Select a note from the sidebar to begin exploring your Split-Brain knowledge graph.
      </p>
    </div>
  );
}

export default function App() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVaultFiles().then(loadedFiles => {
      setFiles(loadedFiles);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">Loading Vault...</div>;
  }

  return (
    <BrowserRouter>
      <VaultLayout files={files}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/note/:basename" element={<NotePage files={files} />} />
        </Routes>
      </VaultLayout>
    </BrowserRouter>
  );
}
