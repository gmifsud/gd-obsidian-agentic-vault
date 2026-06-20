import { useEffect, useState } from 'react';
import { FileCode2, Tag, Type } from 'lucide-react';
import { VaultFile, TemplateFile, getTemplates } from '../lib/vault';
import { MarkdownViewer } from '../components/MarkdownViewer';

interface TemplatesPageProps {
  files: VaultFile[];
}

export function TemplatesPage({ files }: TemplatesPageProps) {
  const [apiTemplates, setApiTemplates] = useState<TemplateFile[] | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    getTemplates().then(setApiTemplates);
  }, []);

  // Build templates from files as fallback
  const templateFiles = apiTemplates || files
    .filter(f => f.path.startsWith('80_Templates/') && f.basename !== 'README')
    .map(f => ({
      name: f.name,
      basename: f.basename,
      fields: f.frontmatter,
      raw_content: f.content,
    }));

  const namingConv = files.find(f => f.basename === 'Naming_Conventions');
  const activeTemplate = templateFiles.find(t => t.basename === selectedTemplate);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Templates</h1>
        <p className="text-[var(--color-text-secondary)]">
          YAML frontmatter templates for structuring knowledge documents
        </p>
      </div>

      {/* Template Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        {templateFiles.map(template => {
          const isActive = selectedTemplate === template.basename;
          const fieldCount = Object.keys(template.fields || {}).length;
          
          return (
            <button
              key={template.basename}
              onClick={() => setSelectedTemplate(isActive ? null : template.basename)}
              className={`card text-left transition-all duration-200 ${
                isActive ? 'ring-2 ring-[var(--color-system)] border-[var(--color-system)]' : ''
              }`}
            >
              <div className="card-header">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-system-bg)] flex items-center justify-center">
                    <FileCode2 className="w-4 h-4 text-[var(--color-system)]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                      {template.basename.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {fieldCount} fields defined
                    </p>
                  </div>
                </div>
              </div>
              
              {/* YAML Fields Preview */}
              <div className="card-body">
                <div className="space-y-1.5">
                  {Object.entries(template.fields || {}).slice(0, 5).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Tag className="w-3 h-3 text-[var(--color-text-muted)] flex-shrink-0" />
                      <span className="text-xs font-mono text-[var(--color-text-secondary)]">{key}</span>
                      <span className="text-xs text-[var(--color-text-muted)] truncate ml-auto">
                        {renderFieldValue(value)}
                      </span>
                    </div>
                  ))}
                  {fieldCount > 5 && (
                    <p className="text-xs text-[var(--color-text-muted)] pl-5">
                      +{fieldCount - 5} more fields...
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Template Detail */}
      {activeTemplate && (
        <div className="card animate-fade-in">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Template Preview: {activeTemplate.basename.replace(/_/g, ' ')}
            </h3>
            <span className="badge badge-system">YAML Schema</span>
          </div>
          <div className="card-body">
            {/* Full YAML Fields Table */}
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                Frontmatter Fields
              </h4>
              <div className="bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Field</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Type</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Default</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {Object.entries(activeTemplate.fields || {}).map(([key, value]) => (
                      <tr key={key} className="hover:bg-white/3">
                        <td className="px-4 py-2 font-mono text-[var(--color-right-hemisphere)]">{key}</td>
                        <td className="px-4 py-2 text-[var(--color-text-muted)]">
                          <span className="flex items-center gap-1.5">
                            <Type className="w-3 h-3" />
                            {getFieldType(value)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[var(--color-text-secondary)] font-mono text-xs">
                          {renderFieldValue(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Raw Template Content */}
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                Raw Content
              </h4>
              <pre className="bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)] p-4 text-xs text-[var(--color-text-secondary)] font-mono overflow-x-auto whitespace-pre-wrap">
                {activeTemplate.raw_content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Naming Conventions */}
      {namingConv && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">📝 Naming Conventions</h3>
          </div>
          <div className="card-body">
            <MarkdownViewer content={namingConv.content} />
          </div>
        </div>
      )}
    </div>
  );
}

function getFieldType(value: any): string {
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (value === '' || value === '""') return 'string';
  return typeof value;
}

function renderFieldValue(value: any): string {
  if (Array.isArray(value)) return value.length > 0 ? `[${value.join(', ')}]` : '[]';
  if (value === '' || value === '""') return '(empty)';
  return String(value);
}
