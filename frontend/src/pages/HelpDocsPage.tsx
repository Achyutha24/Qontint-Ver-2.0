import type { ReactNode } from 'react'
import { AlertTriangle, BarChart3, BookOpen, Bot, CheckCircle2, CircleHelp, ExternalLink, FileSearch, Gauge, Search, ShieldCheck, Workflow } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import PageHeader from '../components/layout/PageHeader'
import ContentContainer from '../components/layout/ContentContainer'

const gettingStarted = [
  ['1', 'Choose the workspace/domain', 'Use the workspace selector to work in the correct B2B context.'],
  ['2', 'Open Analyze', 'Enter the target keyword and, when the page asks for content, paste the draft you want to evaluate.'],
  ['3', 'Run the pipeline', 'Qontint collects SERP evidence, extracts competitor content where possible and computes the available intelligence signals.'],
  ['4', 'Read the report', 'Use SERP Overview, Topic Coverage, Competitor Analysis, Semantic Topic Clusters and Recommendations to move from evidence to action.'],
]

const metricRows = [
  ['Word count', 'How much usable text was extracted from the page. It is not a quality score by itself.'],
  ['Content depth', 'A compact indication of how substantial the extracted page content is relative to the analysis.'],
  ['Entity coverage', 'How extensively important entities are represented in the analysed content.'],
  ['Semantic richness', 'How broadly the content covers related concepts and topics.'],
  ['Topical authority', 'A composite signal describing topical strength based on the available evidence.'],
  ['Information gain', 'A signal intended to capture useful information beyond what competitors already cover.'],
]

const troubleshooting = [
  ['Competitor says “Extraction Failed”', 'The page may be blocked, too short, dynamically rendered, or otherwise unavailable to the extractor. Qontint should keep the competitor in the SERP view but avoid fabricating content metrics.'],
  ['A value says “Not available”', 'This means the underlying evidence or computation is missing. It is different from a score of zero.'],
  ['SERP looks stale', 'Use Refresh SERP to request a fresh search-result collection before relying on live ranking positions.'],
  ['Assistant is still thinking', 'The assistant should respond from the current snapshot quickly. If it does not, refresh the page and verify that the latest frontend build is deployed.'],
  ['A page does not open from Tools', 'Open the sidebar and use Settings, Help & Docs or About Qontint. These are application routes and should load inside the main workspace shell.'],
]

export default function HelpDocsPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Documentation" badge="GETTING STARTED" title="Help & Docs" subtitle="A practical guide to using Qontint, reading its metrics, understanding extraction states and getting useful results from the AI assistant." icon={BookOpen} />
      <ContentContainer>
        <section className="card p-6 md:p-7">
          <div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-xl bg-[var(--solar)] text-[var(--aurora)] flex items-center justify-center border border-[var(--aurora)]/20"><Workflow size={18} /></div><div><h2 className="text-xl">Getting started</h2><p className="text-sm text-[var(--text-muted)] mt-1">A normal Qontint session can be understood in four steps.</p></div></div>
          <div className="grid gap-4 md:grid-cols-4">
            {gettingStarted.map(([n, title, text]) => <div key={n} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-depth)] p-4"><span className="inline-flex w-7 h-7 rounded-full bg-[var(--aurora)] text-white items-center justify-center text-xs font-bold">{n}</span><h3 className="text-sm mt-3 mb-2">{title}</h3><p className="text-xs text-[var(--text-muted)] leading-5">{text}</p></div>)}
          </div>
        </section>

        <section className="mt-6">
          <DocSection icon={Search} title="Using Analyze">
            <p>Analyze is the main entry point for query-specific content intelligence. The keyword tells Qontint what search landscape to inspect; the content field is used when you want to evaluate a draft against that landscape.</p>
            <ul className="list-disc pl-5 space-y-2"><li>Use a specific, meaningful target keyword rather than a vague category.</li><li>After the analysis completes, start with the SERP Overview to understand the overall landscape.</li><li>Use Competitor Analysis to compare the pages that actually appeared in search.</li><li>Use Topic Coverage and Semantic Topic Clusters to understand missing or weak areas.</li><li>Use Recommendations after reviewing the evidence, not as a replacement for it.</li></ul>
          </DocSection>
        </section>

        <section className="mt-6">
          <DocSection icon={BarChart3} title="Understanding the metrics">
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]"><table><thead><tr><th>Metric</th><th>What it means</th></tr></thead><tbody>{metricRows.map(([name, text]) => <tr key={name}><td className="font-semibold text-[var(--text-primary)]">{name}</td><td>{text}</td></tr>)}</tbody></table></div>
          </DocSection>
        </section>

        <section className="grid gap-5 lg:grid-cols-2 mt-6">
          <DocSection icon={FileSearch} title="Competitor extraction states">
            <p><strong>Successful extraction</strong> means Qontint obtained enough usable content to compute the requested structural and semantic metrics.</p>
            <p><strong>Limited content</strong> means some content was obtained, but the page may not support every metric confidently.</p>
            <p><strong>Extraction failed</strong> means Qontint could not obtain enough reliable content. The competitor can still remain part of the SERP evidence.</p>
          </DocSection>
          <DocSection icon={Bot} title="Using the AI Assistant">
            <p>The assistant is designed to explain the current workspace rather than act as an unrestricted chatbot. Ask direct questions such as “What is the SEO score?”, “What should I improve?”, “How do competitors compare?” or “What is missing?”</p>
            <p>Numeric answers should come from the current analysis snapshot. If the required metric has not been computed, the assistant should say so.</p>
          </DocSection>
        </section>

        <section className="card p-6 mt-6">
          <div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200"><Gauge size={18} /></div><div><h2 className="text-xl">Troubleshooting</h2><p className="text-sm text-[var(--text-muted)] mt-1">Common situations and what they mean.</p></div></div>
          <div className="space-y-3">{troubleshooting.map(([title, text]) => <div key={title} className="rounded-xl border border-[var(--border-subtle)] p-4"><h3 className="text-sm font-semibold">{title}</h3><p className="text-sm text-[var(--text-secondary)] leading-6 mt-1">{text}</p></div>)}</div>
        </section>

        <section className="grid gap-5 md:grid-cols-3 mt-6">
          <Tip icon={ShieldCheck} title="Trust the state" text="Not available is a truthful data state, not a failed score." />
          <Tip icon={CheckCircle2} title="Refresh before decisions" text="Use fresh SERP data when ranking positions or competitors matter." />
          <Tip icon={AlertTriangle} title="Watch extraction quality" text="Blocked pages can distort competitor comparisons if their content cannot be read." />
        </section>

        <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-6 flex gap-3 items-start text-blue-950">
          <CircleHelp className="flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm leading-6"><strong>Need more detail?</strong> Use the page-specific AI assistant for grounded explanations, open the relevant report/intelligence page, or return to Analyze and rerun the pipeline with fresh data.</div>
          <ExternalLink size={15} className="flex-shrink-0 mt-1 opacity-60" />
        </section>
      </ContentContainer>
    </PageContainer>
  )
}

function DocSection({ icon: Icon, title, children }: { icon: any; title: string; children: ReactNode }) {
  return <section className="card p-6"><div className="flex items-center gap-3 mb-4"><div className="w-9 h-9 rounded-xl bg-[var(--solar)] text-[var(--aurora)] flex items-center justify-center border border-[var(--aurora)]/20"><Icon size={17} /></div><h2 className="text-lg">{title}</h2></div><div className="space-y-3 text-sm text-[var(--text-secondary)] leading-6">{children}</div></section>
}

function Tip({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5"><Icon size={18} className="text-[var(--aurora)]" /><h3 className="text-sm mt-3 mb-1">{title}</h3><p className="text-xs text-[var(--text-muted)] leading-5">{text}</p></section>
}
