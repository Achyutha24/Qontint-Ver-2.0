import type { ReactNode } from 'react'
import { BarChart3, Bot, BrainCircuit, CheckCircle2, Cpu, Database, FileSearch, Network, Search, ShieldCheck, Sparkles, Target, Workflow } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import ContentContainer from '../components/layout/ContentContainer'

const modules = [
  { icon: Search, title: 'SERP Intelligence', text: 'Collects the live search-result landscape for a target query and identifies the pages competing for visibility. Extraction status is kept explicit so blocked or incomplete pages are not treated as complete evidence.' },
  { icon: FileSearch, title: 'Competitor Analysis', text: 'Benchmarks top competitors across content depth, structure, entities, links, questions, media and other quality signals so you can see what the current search landscape is actually doing.' },
  { icon: BrainCircuit, title: 'Semantic & Topic Intelligence', text: 'Builds a semantic baseline from competitor content, groups related topics and surfaces missing concepts that may matter for topical coverage.' },
  { icon: Network, title: 'ERP Graph', text: 'Connects ERP platforms, modules, business processes, and technologies into meaningful semantic relationships that make complex enterprise architectures intuitive to explore and analyze.' },
  { icon: Target, title: 'Recommendations', text: 'Turns observed gaps and competitor evidence into practical content and SEO recommendations instead of generic advice.' },

  { icon: Bot, title: 'Grounded AI Assistant', text: 'Provides page-aware explanations using the current Qontint analysis context. When a metric is unavailable, the assistant reports that limitation instead of inventing a number.' },
]

const flow = [
  ['01', 'Choose a workspace', 'Select the B2B/domain context in which you want to work.'],
  ['02', 'Run an analysis', 'Enter the target keyword and content when required, then run the relevant intelligence pipeline.'],
  ['03', 'Inspect the evidence', 'Review SERP competitors, extraction quality, semantic coverage, entities and structural metrics.'],
  ['04', 'Find the gaps', 'Use topic clusters, competitor comparisons and recommendation evidence to identify opportunities.'],
  ['05', 'Act and iterate', 'Improve the content, regenerate or rerun the analysis and compare the new results with the previous state.'],
]

export default function AboutQontintPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Platform" badge="QONTINT V2.4" title="About Qontint" subtitle="Qontint is an enterprise content intelligence workspace for understanding B2B search, competitors, semantic coverage and content opportunities from one place." icon={Sparkles} />
      <ContentContainer>
        <section className="card p-7 md:p-9 overflow-hidden">
          <div className="grid lg:grid-cols-[1.4fr_.8fr] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 tag text-[var(--aurora)] border-[var(--aurora)]/30 bg-[var(--solar)] mb-4"><Sparkles size={12} /> Content intelligence, grounded in evidence</div>
              <h2 className="text-2xl md:text-3xl mb-4">What is Qontint?</h2>
              <p className="text-[var(--text-secondary)] leading-7 mb-4">Qontint brings together search-result intelligence, NLP, semantic analysis, competitor benchmarking and recommendation workflows for teams creating and optimising B2B content.</p>
              <p className="text-[var(--text-secondary)] leading-7">Instead of looking at a keyword in isolation, Qontint examines the pages already visible in search, the entities and topics they cover, their structural signals and the gaps between them. The result is a workspace that helps users understand <strong>why the current landscape looks the way it does</strong> and what to improve next.</p>
            </div>
            <div className="rounded-2xl border border-[var(--aurora)]/15 bg-gradient-to-br from-[var(--solar)] via-white to-slate-50 p-6">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat icon={Database} value="SERP" label="Search evidence" />
                <MiniStat icon={BrainCircuit} value="NLP" label="Semantic analysis" />
                <MiniStat icon={BarChart3} value="Scores" label="Quality signals" />
                <MiniStat icon={Workflow} value="Gaps" label="Actionable insights" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <SectionHeading title="What Qontint helps you do" text="The platform is organised around a simple idea: collect evidence, understand the landscape, identify gaps and turn them into action." />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 mt-5">
            {modules.map(({ icon: Icon, title, text }) => (
              <section key={title} className="card p-6">
                <div className="w-10 h-10 rounded-xl bg-[var(--solar)] text-[var(--aurora)] flex items-center justify-center border border-[var(--aurora)]/20 mb-4"><Icon size={18} /></div>
                <h3 className="text-lg mb-2">{title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-6">{text}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="card p-6 md:p-7 mt-6">
          <SectionHeading title="How the Qontint workflow fits together" text="Each stage provides evidence for the next stage, so recommendations remain connected to the search landscape." />
          <div className="grid gap-3 md:grid-cols-5 mt-6">
            {flow.map(([number, title, text]) => (
              <div key={number} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] p-4">
                <span className="font-mono text-xs font-bold text-[var(--aurora)]">{number}</span>
                <h3 className="text-sm mt-3 mb-2">{title}</h3>
                <p className="text-xs text-[var(--text-muted)] leading-5">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2 mt-6">
          <InfoPanel icon={ShieldCheck} title="Designed for trustworthy analysis">
            <p>Qontint distinguishes between a real measurement and a missing measurement. If a page is blocked, too short, or cannot be extracted reliably, the UI should show that state rather than silently turning it into a zero.</p>
            <p>That same principle applies to the assistant: it should answer from the current analysis snapshot and clearly say when a value has not been computed.</p>
          </InfoPanel>
          <InfoPanel icon={Cpu} title="Built as an extensible intelligence platform">
            <p>The application combines a web workspace with backend analysis services, persistent report context and modular intelligence stages. This makes it possible to improve extraction, semantic analysis, scoring and recommendation logic independently.</p>
            <p>Qontint is intended to support an iterative workflow where each new analysis becomes useful context for the next decision.</p>
          </InfoPanel>
        </section>

        <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 flex gap-3 items-start text-emerald-950">
          <CheckCircle2 className="flex-shrink-0 mt-0.5 text-emerald-600" size={19} />
          <div><strong>In short:</strong> Qontint helps B2B teams move from “What ranks?” to “What does the winning search landscape cover, where are the gaps, and what should we do next?”</div>
        </section>
      </ContentContainer>
    </PageContainer>
  )
}

function SectionHeading({ title, text }: { title: string; text: string }) {
  return <div><h2 className="text-xl md:text-2xl">{title}</h2><p className="text-sm text-[var(--text-muted)] mt-2 max-w-3xl leading-6">{text}</p></div>
}

function MiniStat({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  return <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4"><Icon size={16} className="text-[var(--aurora)]" /><strong className="block text-lg mt-2">{value}</strong><span className="text-[11px] text-[var(--text-muted)]">{label}</span></div>
}

function InfoPanel({ icon: Icon, title, children }: { icon: any; title: string; children: ReactNode }) {
  return <section className="card p-6"><div className="flex items-center gap-3 mb-4"><div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center"><Icon size={17} /></div><h2 className="text-lg">{title}</h2></div><div className="space-y-3 text-sm text-[var(--text-secondary)] leading-6">{children}</div></section>
}
