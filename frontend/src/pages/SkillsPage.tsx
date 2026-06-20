import { useEffect, useState } from 'react';
import { Cpu, Terminal, BookOpen } from 'lucide-react';
import { VaultFile, SkillEntry, getSkills } from '../lib/vault';
import { MarkdownViewer } from '../components/MarkdownViewer';

interface SkillsPageProps {
  files: VaultFile[];
}

export function SkillsPage({ files }: SkillsPageProps) {
  const [apiSkills, setApiSkills] = useState<SkillEntry[] | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  useEffect(() => {
    getSkills().then(setApiSkills);
  }, []);

  // Build skills from files as fallback
  const skills: SkillEntry[] = apiSkills || (() => {
    const skillMap = new Map<string, VaultFile>();
    files.forEach(f => {
      if (f.path.startsWith('40_Agent_Skills/') && f.name === 'SKILL.md') {
        const skillName = f.path.split('/')[1];
        skillMap.set(skillName, f);
      }
    });
    return Array.from(skillMap.entries()).map(([name, file]) => {
      const firstLine = file.content.split('\n').find(l => l.trim() && !l.startsWith('#'));
      return {
        name,
        skill_file: file.path,
        description: firstLine?.trim() || 'No description available',
        content: file.content,
      };
    });
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Agent Skills</h1>
        <p className="text-[var(--color-text-secondary)]">
          Execution protocols and standard operating procedures for AI agents
        </p>
      </div>

      {/* Skills count */}
      <div className="card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Cpu className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{skills.length} Skills Configured</p>
          <p className="text-xs text-[var(--color-text-muted)]">Located in vault/40_Agent_Skills/</p>
        </div>
      </div>

      {/* Skills List */}
      <div className="space-y-3 stagger-children">
        {skills.map(skill => {
          const isExpanded = expandedSkill === skill.name;
          
          // Extract commands from content
          const commands = skill.content.match(/\/[a-z][\w-]*/g) || [];
          
          return (
            <div key={skill.name} className="card">
              <button
                onClick={() => setExpandedSkill(isExpanded ? null : skill.name)}
                className="w-full card-header flex items-center gap-4 text-left hover:bg-white/3 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--color-right-hemisphere-bg)] flex items-center justify-center flex-shrink-0">
                  <Terminal className="w-5 h-5 text-[var(--color-right-hemisphere)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    {skill.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{skill.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {commands.length > 0 && (
                    <div className="flex gap-1">
                      {commands.slice(0, 2).map(cmd => (
                        <span key={cmd} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-right-hemisphere-bg)] text-[var(--color-right-hemisphere)] font-mono">
                          {cmd}
                        </span>
                      ))}
                    </div>
                  )}
                  <BookOpen className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              {isExpanded && (
                <div className="card-body border-t border-[var(--color-border)] animate-fade-in">
                  <div className="mb-3">
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)] bg-white/5 px-2 py-0.5 rounded">
                      {skill.skill_file}
                    </span>
                  </div>
                  <MarkdownViewer content={skill.content} />
                </div>
              )}
            </div>
          );
        })}
        {skills.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-[var(--color-text-muted)]">No agent skills found in vault/40_Agent_Skills/</p>
          </div>
        )}
      </div>
    </div>
  );
}
