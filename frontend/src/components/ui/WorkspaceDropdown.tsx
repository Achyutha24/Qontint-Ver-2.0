import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, ChevronDown } from 'lucide-react';
import { useDomain, GLOBAL_DOMAINS } from '../../context/DomainContext';

export default function WorkspaceDropdown() {
  const { domain, setDomain, activeDomainName } = useDomain();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeItem = GLOBAL_DOMAINS.find(d => d.key === domain) || GLOBAL_DOMAINS[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-depth)] border border-[var(--border-subtle)] hover:border-[var(--aurora)] transition-colors text-sm font-semibold text-[var(--text-primary)]"
      >
        <Briefcase className="w-4 h-4 text-[var(--aurora)]" />
        <span className="hidden sm:inline">Workspace</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 bg-[var(--bg-void)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-[100]"
          >
            <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-depth)]">
              <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1">Current Workspace</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--aurora)]/10 border border-[var(--aurora)]/20 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-[var(--aurora)]" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">{activeDomainName}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{activeItem.desc}</p>
                </div>
              </div>
            </div>
            
            <div className="p-2 max-h-64 overflow-y-auto">
              <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2 px-2 pt-1">Change Workspace</p>
              <div className="space-y-1">
                {GLOBAL_DOMAINS.map(d => (
                  <button
                    key={d.key}
                    onClick={() => { setDomain(d.key); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      domain === d.key 
                        ? 'bg-[var(--aurora)]/10 text-[var(--aurora)] font-medium' 
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-depth)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{d.label}</span>
                    {domain === d.key && <span className="w-1.5 h-1.5 rounded-full bg-[var(--aurora)] shadow-[0_0_5px_var(--aurora)]" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
