import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export const GLOBAL_DOMAINS = [
  { key: 'b2b', label: 'B2B', desc: 'Enterprise Solutions', icon: 'Building2', examples: 'CRM • ERP • SaaS • Enterprise AI' },
  { key: 'fintech', label: 'FinTech', desc: 'Banking & Payments', icon: 'CreditCard', examples: 'Banking • Payments • Investments' },
  { key: 'healthcare', label: 'Healthcare', desc: 'Medical & Pharma', icon: 'HeartPulse', examples: 'Medical • Hospitals • Pharma' },
  { key: 'saas', label: 'SaaS', desc: 'Software Platforms', icon: 'Cloud', examples: 'Cloud • Productivity • B2B Software' },
  { key: 'ecommerce', label: 'E-Commerce', desc: 'Online Retail', icon: 'ShoppingCart', examples: 'Retail • D2C • Marketplaces' },
  { key: 'education', label: 'Education', desc: 'EdTech', icon: 'GraduationCap', examples: 'LMS • E-Learning • Universities' },
  { key: 'manufacturing', label: 'Manufacturing', desc: 'Industrial Solutions', icon: 'Factory', examples: 'Industrial • Supply Chain • Logistics' },
  { key: 'marketing', label: 'Marketing', desc: 'Digital Marketing', icon: 'Megaphone', examples: 'Agencies • AdTech • MarTech' },
  { key: 'cybersecurity', label: 'Cybersecurity', desc: 'Security Solutions', icon: 'ShieldCheck', examples: 'InfoSec • Network Security • Identity' },
  { key: 'real_estate', label: 'Real Estate', desc: 'Property Technology', icon: 'Home', examples: 'PropTech • Commercial • Residential' },
  { key: 'technology', label: 'Technology', desc: 'General Technology', icon: 'Laptop', examples: 'Hardware • IT Services • AI' },
  { key: 'other', label: 'Custom Domain', desc: 'Create your own workspace', icon: 'Sparkles', examples: 'Any specialized industry' }
];

interface DomainContextType {
  domain: string;
  setDomain: (domain: string) => void;
  customDomain: string;
  setCustomDomain: (domain: string) => void;
  activeDomainName: string;
  hasSelectedWorkspace: boolean;
  /** Clears the workspace selection so the user can choose again. */
  resetWorkspace: () => void;
}

const DomainContext = createContext<DomainContextType | undefined>(undefined);

export function DomainProvider({ children }: { children: ReactNode }) {
  const [domain, setDomain] = useState<string>('b2b');
  const [customDomain, setCustomDomain] = useState<string>('');
  const [hasSelectedWorkspace, setHasSelectedWorkspace] = useState<boolean>(false);

  useEffect(() => {
    const savedDomain = localStorage.getItem('qontint_global_domain');
    if (savedDomain) {
      setDomain(savedDomain);
      setHasSelectedWorkspace(true);
    }
    const savedCustom = localStorage.getItem('qontint_custom_domain');
    if (savedCustom) {
      setCustomDomain(savedCustom);
    }
  }, []);

  const handleSetDomain = (d: string) => {
    setDomain(d);
    setHasSelectedWorkspace(true);
    localStorage.setItem('qontint_global_domain', d);
  };

  const handleSetCustomDomain = (c: string) => {
    setCustomDomain(c);
    localStorage.setItem('qontint_custom_domain', c);
  };

  const resetWorkspace = () => {
    setHasSelectedWorkspace(false);
    setDomain('b2b');
    setCustomDomain('');
    localStorage.removeItem('qontint_global_domain');
    localStorage.removeItem('qontint_custom_domain');
  };

  const activeDomainName = domain === 'other' && customDomain.trim() !== ''
    ? customDomain
    : GLOBAL_DOMAINS.find(d => d.key === domain)?.label || 'B2B';

  return (
    <DomainContext.Provider value={{
      domain,
      setDomain: handleSetDomain,
      customDomain,
      setCustomDomain: handleSetCustomDomain,
      activeDomainName,
      hasSelectedWorkspace,
      resetWorkspace,
    }}>
      {children}
    </DomainContext.Provider>
  );
}

export function useDomain() {
  const context = useContext(DomainContext);
  if (context === undefined) {
    throw new Error('useDomain must be used within a DomainProvider');
  }
  return context;
}
