import { Link, useLocation } from 'react-router-dom';
import {
  Brain, LayoutDashboard, Layers, FileCode2, Cpu,
  Settings2, FileText, ChevronDown, ChevronRight,
  Folder, Menu, X, Sliders, History
} from 'lucide-react';
import { useState } from 'react';
import { VaultFile, getHemisphereForPath } from '../lib/vault';
import { VauMIcon } from './VauMIcon';

type FileTreeNode = {
  name: string;
  type: 'file' | 'folder';
  path: string;
  file?: VaultFile;
  children: Record<string, FileTreeNode>;
};

function buildFileTree(files: VaultFile[]): Record<string, FileTreeNode> {
  const root: Record<string, FileTreeNode> = {};

  files.forEach(file => {
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

const HEMISPHERE_FOLDER_COLORS: Record<string, string> = {
  '00_MOCs': 'text-cyan-400',
  '01_Journal': 'text-amber-400',
  '02_Human_Thoughts': 'text-amber-400',
  '10_Repositories': 'text-cyan-400',
  '15_Prototype_Designs': 'text-cyan-400',
  '20_DevOps': 'text-cyan-400',
  '25_Knowledge_Base': 'text-cyan-400',
  '30_Git': 'text-cyan-400',
  '40_Agent_Skills': 'text-cyan-400',
  '50_Databases': 'text-cyan-400',
  '60_Canvas_Maps': 'text-cyan-400',
  '80_Templates': 'text-cyan-400',
  '90_Assets': 'text-gray-500',
};

function TreeNodeComponent({ node, level = 0 }: { node: FileTreeNode; level?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const folderColor = level === 0 ? HEMISPHERE_FOLDER_COLORS[node.name] || 'text-blue-400' : 'text-blue-400/70';

  if (node.type === 'folder') {
    return (
      <div className="select-none">
        <div 
          className="flex items-center gap-1 py-1 px-2 rounded-md hover:bg-white/5 cursor-pointer text-sm text-[var(--color-text-secondary)] group transition-colors duration-150"
          style={{ paddingLeft: `${level * 14 + 8}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
          <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${folderColor}`} />
          <span className="truncate font-medium">{node.name}</span>
        </div>
        {isOpen && (
          <div className="flex flex-col">
            {Object.values(node.children)
              .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(childNode => (
                <TreeNodeComponent key={childNode.path} node={childNode} level={level + 1} />
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link 
      to={`/note/${encodeURIComponent(node.file!.basename)}`}
      className="flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-white/5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors duration-150"
      style={{ paddingLeft: `${level * 14 + 28}px` }}
    >
      <FileText className="w-3 h-3 flex-shrink-0 opacity-50" />
      <span className="truncate">{node.name.replace(/\.md$/, '')}</span>
    </Link>
  );
}

interface SidebarProps {
  files: VaultFile[];
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/hemispheres', icon: Layers, label: 'Hemispheres' },
  { to: '/templates', icon: FileCode2, label: 'Templates' },
  { to: '/skills', icon: Cpu, label: 'Agent Skills' },
  { to: '/sessions', icon: History, label: 'Sessions' },
  { to: '/system', icon: Settings2, label: 'System Files' },
  { to: '/orchestrator', icon: Sliders, label: 'Orchestrator' },
];

export function Sidebar({ files, collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const fileTree = buildFileTree(files);
  const [treeExpanded, setTreeExpanded] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      <aside className={`
        fixed lg:relative z-50 top-0 left-0 h-full
        w-[var(--sidebar-width)] flex-shrink-0 flex flex-col
        bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]
        transition-transform duration-300 ease-in-out
        ${collapsed ? '-translate-x-full lg:-translate-x-full' : 'translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <VauMIcon className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">Vau-M</h1>
              <p className="text-[10px] text-[var(--color-text-muted)] font-medium tracking-wider uppercase">Agentic Vault OS</p>
            </div>
          </Link>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-white/5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 pt-4 pb-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-3 my-2 border-t border-[var(--color-border)]" />

        {/* File Tree Toggle */}
        <div className="px-3 mb-1">
          <button
            onClick={() => setTreeExpanded(!treeExpanded)}
            className="flex items-center gap-2 w-full py-1.5 px-2 rounded-md text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hover:text-[var(--color-text-secondary)] hover:bg-white/5 transition-colors"
          >
            {treeExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Vault Explorer
            <span className="ml-auto text-[10px] font-normal text-[var(--color-text-muted)]">{files.length}</span>
          </button>
        </div>

        {/* File Tree */}
        {treeExpanded && (
          <div className="flex-1 overflow-y-auto px-1 pb-4">
            {Object.values(fileTree)
              .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(node => (
                <TreeNodeComponent key={node.path} node={node} level={0} />
              ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto p-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-subtle" />
            <span className="text-xs text-[var(--color-text-muted)]">Vault Online</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg hover:bg-white/5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors lg:hidden"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
