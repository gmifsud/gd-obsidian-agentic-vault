import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import { Brain, FileText, Folder, Menu, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getVaultFiles, VaultFile } from './lib/vault';
import { MarkdownViewer } from './components/MarkdownViewer';

type TreeNode = {
  name: string;
  type: 'file' | 'folder';
  path: string;
  file?: VaultFile;
  children: Record<string, TreeNode>;
};

function buildFileTree(files: VaultFile[]): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  files.forEach(file => {
    // Some basic normalisation for windows-style paths just in case, and filter out empty segments
    const parts = file.path.split(/[/\\]/).filter(Boolean);
    let currentLevel = root;
    
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const currentPath = parts.slice(0, index + 1).join('/');
      
      if (!currentLevel[part]) {
        currentLevel[part] = {
          name: part,
          type: isLast ? 'file' : 'folder',
          path: currentPath,
          children: {}
        };
      }
      
      if (isLast) {
        currentLevel[part].file = file;
      }
      
      currentLevel = currentLevel[part].children;
    });
  });

  return root;
}

function FileTreeNode({ node, level = 0 }: { node: TreeNode, level?: number }) {
  const [isOpen, setIsOpen] = useState(false);

  if (node.type === 'folder') {
    return (
      <div className="select-none">
        <div 
          className="flex items-center gap-1 py-1 px-2 rounded hover:bg-neutral-800/50 cursor-pointer text-sm font-medium text-neutral-300 group"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-neutral-500 group-hover:text-neutral-300">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
          <Folder className="w-4 h-4 text-blue-400 flex-shrink-0 opacity-80" />
          <span className="truncate">{node.name}</span>
        </div>
        {isOpen && (
          <div className="flex flex-col">
            {Object.values(node.children)
              .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(childNode => (
                <FileTreeNode key={childNode.path} node={childNode} level={level + 1} />
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link 
      to={`/note/${encodeURIComponent(node.file!.basename)}`}
      className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-neutral-800/50 text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
      style={{ paddingLeft: `${level * 12 + 28}px` }}
    >
      <FileText className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
      <span className="truncate">{node.name.replace(/\.md$/, '')}</span>
    </Link>
  );
}

function VaultLayout({ files, children }: { files: VaultFile[], children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fileTree = buildFileTree(files);

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 border-r border-neutral-800 bg-neutral-900 overflow-y-auto flex-shrink-0 flex flex-col`}>
        <div className="p-4 border-b border-neutral-800 flex items-center gap-2 sticky top-0 bg-neutral-900 z-10 shadow-sm">
          <Brain className="w-6 h-6 text-purple-400 flex-shrink-0" />
          <h1 className="font-bold text-neutral-100 truncate">Agentic Vault</h1>
        </div>
        <div className="py-2 flex-grow">
          {Object.values(fileTree)
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map(node => (
              <FileTreeNode key={node.path} node={node} level={0} />
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
