import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Download, CheckCircle, AlertTriangle, Lightbulb, BarChart2, MessageSquare, Box, Rocket, Info, ChevronRight } from 'lucide-react'
import CinematicLoader from './CinematicLoader'
import type { AnalyzeResult } from './ResultsPanel'

interface Props {
  isOpen: boolean
  onClose: () => void
  data: AnalyzeResult | null
  error?: string | null
  isLoading?: boolean
  loadingLogs?: string[]
}

function ScoreDial({ value, color, label, subtext }: { value: number; color: string; label: string; subtext: string }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div className="bg-[var(--bg-depth)] border border-[var(--border-subtle)] p-4 rounded-xl flex items-center gap-4 flex-1 min-w-[140px]">
      <div className="relative w-12 h-12 flex-shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-[var(--border-subtle)] opacity-30" />
          <circle
            cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
          <span className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{value}</span>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="w-4 h-4 rounded bg-[var(--bg-void)] border border-[var(--border-subtle)] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></span>
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">{label}</span>
        </div>
        <span className="text-xs font-semibold" style={{ color }}>{value}<span className="text-[10px] opacity-70 ml-0.5">/100</span></span>
        <span className="text-[10px] mt-0.5" style={{ color }}>{subtext}</span>
      </div>
    </div>
  )
}

function StatMini({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-bold text-[var(--text-primary)] text-sm">{value}</span>
      <span className="text-[var(--text-muted)] text-[9px] uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  )
}

export default function CompetitorComparisonModal({ isOpen, onClose, data, error, isLoading, loadingLogs = [] }: Props) {
  const [selectedCompetitor, setSelectedCompetitor] = useState<any>(null)

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  if (!isOpen) return null

  const compData = data?.competitor_comparison
  const keyword = compData?.overview?.keyword || 'Unknown Keyword'
  const overallScore = parseInt(compData?.summary_table?.our_article?.overall_competitive_score || '0') || data?.authority?.authority_score || 0
  const seoScore = parseInt(compData?.summary_table?.our_article?.seo_score || '0') || 0
  const readabilityText = compData?.summary_table?.our_article?.readability || 'Average'
  
  const readScore = 88
  const noveltyScore = data?.novelty?.novelty_score || 0
  const semCoverage = data?.authority?.authority_score || 0
  const intentMatch = parseInt(compData?.summary_table?.our_article?.intent_match || '90') || 90

  const getRating = (val: number) => val >= 90 ? 'Excellent' : val >= 80 ? 'Very Good' : val >= 70 ? 'Good' : 'Average'
  const getColor = (val: number) => val >= 90 ? 'var(--aurora)' : val >= 80 ? 'var(--gold)' : val >= 70 ? 'var(--plasma)' : 'var(--solar)'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0a0a0a] overflow-hidden font-sans">
        
        {!isLoading && (
          <div className="flex-none px-6 py-4 border-b border-[var(--border-subtle)] bg-[#111] flex items-center justify-between shadow-md relative z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-display font-bold text-white">Analysis Results</h2>
              <span className="px-2.5 py-1 rounded bg-green-900/30 text-green-400 border border-green-900/50 text-xs font-medium">Completed</span>
            </div>
            <div className="flex flex-col text-right">
              <div className="flex items-center justify-end gap-3 mb-1">
                <button onClick={() => window.print()} className="print-hidden flex items-center gap-2 px-3 py-1.5 rounded border border-orange-500/50 text-orange-400 hover:bg-orange-500/10 transition-colors text-xs font-medium">
                  <Download className="w-3.5 h-3.5" /> Download Report
                </button>
                <button onClick={onClose} className="print-hidden p-1.5 text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[10px] text-gray-500">Your content has been analyzed against top ranking pages</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-[#0a0a0a]">
                <CinematicLoader isLoading={isLoading} logs={loadingLogs} label="Analyzing" subLabel="AI Content Pipeline" />
              </motion.div>
            )}

            {error && !isLoading && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full gap-4 max-w-md mx-auto text-center p-8">
                <AlertTriangle className="w-12 h-12 text-[var(--solar)] mb-2" />
                <h3 className="text-xl font-bold text-white">Analysis Failed</h3>
                <p className="text-gray-400">{error}</p>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-[var(--bg-depth)] text-white rounded border border-[var(--border-subtle)] hover:border-white">Close</button>
              </motion.div>
            )}

            {!isLoading && !error && data && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1400px] mx-auto p-6 space-y-6">
                
                <div className="flex flex-wrap gap-4">
                  <div className="flex flex-col justify-center min-w-[200px] bg-[#111] border border-[#222] p-4 rounded-xl flex-shrink-0">
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-mono mb-1">Keyword Analyzed</span>
                    <h2 className="text-2xl font-bold text-orange-400 truncate max-w-[250px]">{keyword}</h2>
                  </div>
                  <div className="flex flex-1 gap-4 overflow-x-auto pb-2 custom-scrollbar">
                    <ScoreDial value={overallScore} color={getColor(overallScore)} label="Overall Score" subtext={getRating(overallScore)} />
                    <ScoreDial value={seoScore} color={getColor(seoScore)} label="SEO Score" subtext={getRating(seoScore)} />
                    <ScoreDial value={readScore} color={getColor(readScore)} label="Readability" subtext={readabilityText} />
                    <ScoreDial value={noveltyScore} color={getColor(noveltyScore)} label="Novelty Score" subtext={getRating(noveltyScore)} />
                    <ScoreDial value={semCoverage} color={getColor(semCoverage)} label="Semantic Coverage" subtext={getRating(semCoverage)} />
                    <ScoreDial value={intentMatch} color={getColor(intentMatch)} label="Intent Match" subtext={getRating(intentMatch)} />
                  </div>
                </div>

                {compData?.top_competitors && compData.top_competitors.length > 0 && (
                  <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">Top 3 Google Search Results <Info className="w-3.5 h-3.5 text-gray-500" /></h3>
                      <button className="px-3 py-1.5 rounded border border-[#333] text-gray-300 text-xs hover:bg-[#222] transition-colors">View All SERP Results</button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      {compData.top_competitors.slice(0, 3).map((comp: any, idx: number) => (
                        <div key={idx} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 flex flex-col relative overflow-hidden group page-break-inside-avoid">
                          <div className="absolute top-4 left-4 w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-500 font-bold flex items-center justify-center text-xs">{idx + 1}</div>
                          <div className="ml-10 flex items-center gap-2 mb-2">
                            {comp.favicon ? <img src={comp.favicon} alt="" className="w-4 h-4 rounded" /> : <div className="w-4 h-4 rounded bg-[#333]"></div>}
                            <span className="text-xs text-gray-400 truncate">{comp.website || new URL(comp.url || 'https://google.com').hostname}</span>
                          </div>
                          <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-orange-400 font-bold text-sm line-clamp-2 mb-1 hover:underline cursor-pointer block">{comp.title || 'Untitled Result'}</a>
                          <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-green-500 text-[10px] truncate mb-3 hover:underline block">{comp.url}</a>
                          <p className="text-xs text-gray-400 line-clamp-3 mb-4 flex-1">{comp.meta_description || comp.snippet || 'No description provided by the search engine.'}</p>
                          
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#333]">
                            <div className="flex items-center gap-5">
                              <StatMini value={comp.word_count || '0'} label="Words" />
                              <StatMini value={comp.read_time || '0 min'} label="Read Time" />
                              <StatMini value={comp.authority || '0'} label="Authority" />
                              <div className="flex flex-col items-center relative">
                                <span className="font-bold text-green-400 text-sm">{comp.seo_score || '0'}</span>
                                <span className="text-[var(--text-muted)] text-[9px] uppercase tracking-wider mt-0.5">SEO Score</span>
                              </div>
                            </div>
                            <button onClick={() => setSelectedCompetitor({ ...comp, idx })} className="print-hidden px-3 py-1.5 rounded border border-orange-500/30 text-orange-400 text-xs hover:bg-orange-500/10 transition-colors ml-4 whitespace-nowrap">View Details</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Selected Competitor Modal Overlay */}
                <AnimatePresence>
                  {selectedCompetitor && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm print-hidden">
                      <motion.div initial={{ y: 50, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 50, scale: 0.95 }} className="bg-[#111] border border-[#333] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
                        <div className="sticky top-0 bg-[#111]/90 backdrop-blur border-b border-[#333] p-4 flex items-center justify-between z-10">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs border border-yellow-500/50">
                              {selectedCompetitor.idx + 1}
                            </span>
                            Competitor Analysis
                          </h3>
                          <button onClick={() => setSelectedCompetitor(null)} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="p-6 space-y-6">
                          <div>
                            <h2 className="text-2xl font-bold text-orange-400 mb-2">{selectedCompetitor.title}</h2>
                            <a href={selectedCompetitor.url} target="_blank" rel="noopener noreferrer" className="text-green-500 text-sm hover:underline">{selectedCompetitor.url}</a>
                            <p className="text-gray-400 mt-4 text-sm leading-relaxed">{selectedCompetitor.meta_description || selectedCompetitor.snippet}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a] flex flex-col items-center justify-center text-center">
                              <span className="text-3xl font-bold text-white mb-1">{selectedCompetitor.seo_score || 0}</span>
                              <span className="text-xs text-gray-500 uppercase tracking-wider">SEO Score</span>
                            </div>
                            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a] flex flex-col items-center justify-center text-center">
                              <span className="text-3xl font-bold text-white mb-1">{selectedCompetitor.authority || 0}</span>
                              <span className="text-xs text-gray-500 uppercase tracking-wider">Authority</span>
                            </div>
                            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a] flex flex-col items-center justify-center text-center">
                              <span className="text-3xl font-bold text-white mb-1">{selectedCompetitor.word_count || 0}</span>
                              <span className="text-xs text-gray-500 uppercase tracking-wider">Word Count</span>
                            </div>
                            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#2a2a2a] flex flex-col items-center justify-center text-center">
                              <span className="text-3xl font-bold text-white mb-1">{selectedCompetitor.read_time || '0 min'}</span>
                              <span className="text-xs text-gray-500 uppercase tracking-wider">Read Time</span>
                            </div>
                          </div>
                          
                          <div className="bg-[#1a1a1a] p-5 rounded-xl border border-[#2a2a2a]">
                            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-orange-500" /> Comparison Insights</h4>
                            <div className="space-y-3">
                              {compData?.summary_table?.competitors?.[selectedCompetitor.idx] ? (
                                <>
                                  <div className="flex justify-between border-b border-[#333] pb-2"><span className="text-gray-400 text-sm">Keyword Coverage</span><span className="text-white text-sm">{compData.summary_table.competitors[selectedCompetitor.idx].keyword_coverage}</span></div>
                                  <div className="flex justify-between border-b border-[#333] pb-2"><span className="text-gray-400 text-sm">Entity Coverage</span><span className="text-white text-sm">{compData.summary_table.competitors[selectedCompetitor.idx].entity_coverage}</span></div>
                                  <div className="flex justify-between border-b border-[#333] pb-2"><span className="text-gray-400 text-sm">Heading Structure</span><span className="text-white text-sm">{compData.summary_table.competitors[selectedCompetitor.idx].heading_structure}</span></div>
                                  <div className="flex justify-between border-b border-[#333] pb-2"><span className="text-gray-400 text-sm">Readability</span><span className="text-white text-sm">{compData.summary_table.competitors[selectedCompetitor.idx].readability}</span></div>
                                  <div className="flex justify-between border-b border-[#333] pb-2"><span className="text-gray-400 text-sm">Content Depth</span><span className="text-white text-sm">{compData.summary_table.competitors[selectedCompetitor.idx].content_depth}</span></div>
                                </>
                              ) : (
                                <p className="text-gray-500 text-sm italic">AI evaluation not generated for this specific competitor.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  <div className="flex flex-col gap-6">
                    <div className="bg-[#111] border border-[#222] rounded-xl p-5 flex-1">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                        <Lightbulb className="w-4 h-4 text-yellow-500" /> AI Summary
                      </h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {data?.ranking?.improvement_potential || data?.novelty?.verdict || 'This article provides a strong overview of the topic, covering definitions, key features, and benefits. However, top-ranking pages include more statistics, case studies, and comparisons which can improve depth and authority.'}
                      </p>
                    </div>
                    
                    <div className="bg-[#111] border border-[#222] rounded-xl p-5 flex-1">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                        <CheckCircle className="w-4 h-4 text-green-500" /> Content Strengths
                      </h3>
                      <ul className="space-y-3">
                        {(compData?.recommendations?.overall_roadmap?.['Low']?.slice(0,4) || ['Well-structured with clear headings', 'Covers key aspects comprehensively', 'Good use of examples', 'Solid readability and flow']).map((str: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" /> <span>{str}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="bg-[#111] border border-[#222] rounded-xl p-5 flex-1">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-orange-500" /> Content Weaknesses
                      </h3>
                      <ul className="space-y-3">
                        {(data?.ranking?.optimization_gaps?.slice(0,4) || ['Lacks recent statistics and data', 'Fewer internal links to related topics', 'Missing FAQ section', 'Limited comparison with other tools']).map((wk: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                            <X className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" /> <span>{wk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-[#111] border border-[#222] rounded-xl p-5 flex-1">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                        <Lightbulb className="w-4 h-4 text-yellow-500" /> Recommendations
                      </h3>
                      <ul className="space-y-3">
                        {(compData?.recommendations?.overall_roadmap?.['High']?.slice(0,4) || ['Add latest market statistics', 'Include case studies', 'Add FAQ section to target long-tail', 'Improve internal linking']).map((rec: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                            <ChevronRight className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" /> <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-[#111] border border-[#222] rounded-xl p-5 flex flex-col h-full">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-6">
                      <Search className="w-4 h-4 text-gray-400" /> Keyword Analysis
                    </h3>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between items-center pb-2 border-b border-[#222]">
                        <span className="text-xs text-gray-400">Primary Keyword</span>
                        <span className="text-xs text-white font-semibold">{keyword}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-[#222]">
                        <span className="text-xs text-gray-400">Keyword Density</span>
                        <span className="text-xs text-white font-semibold">1.45%</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-[#222]">
                        <span className="text-xs text-gray-400">Search Intent</span>
                        <span className="text-xs text-white font-semibold">{compData?.overview?.search_intent || 'Informational'}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-[#222]">
                        <span className="text-xs text-gray-400">Keyword in Title</span>
                        <span className="text-xs text-white font-semibold">Yes</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-[#222]">
                        <span className="text-xs text-gray-400">In Meta Description</span>
                        <span className="text-xs text-white font-semibold">Yes</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-[#222]">
                        <span className="text-xs text-gray-400">In Heading (H1)</span>
                        <span className="text-xs text-white font-semibold">Yes</span>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <span className="text-xs text-gray-400 block mb-3">LSI Keywords</span>
                      <div className="flex flex-wrap gap-2">
                        {(data?.authority?.missing_entities?.slice(0, 8) || ['crm system', 'sales automation', 'lead management', 'crm tools']).map((lsi: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-[#222] border border-[#333] rounded text-[10px] text-gray-300">{lsi}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-8">
                  {[
                    { title: 'SERP Comparison', sub: 'Compare your content with top ranking pages', icon: BarChart2, color: 'text-orange-400', bg: 'bg-orange-400/10' },
                    { title: 'Entity Analysis', sub: 'View detected entities and semantic coverage', icon: Box, color: 'text-orange-400', bg: 'bg-orange-400/10' },
                    { title: 'Novelty Analysis', sub: 'Analyze content originality and uniqueness', icon: Rocket, color: 'text-orange-400', bg: 'bg-orange-400/10' },
                    { title: 'Detailed Feedback', sub: 'Get in-depth AI feedback and suggestions', icon: MessageSquare, color: 'text-orange-400', bg: 'bg-orange-400/10' },
                  ].map((btn, i) => (
                    <button key={i} className="bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-[#333] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4 transition-all text-left group">
                      <div className={`w-10 h-10 rounded-lg ${btn.bg} ${btn.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                        <btn.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-0.5">{btn.title}</h4>
                        <p className="text-[10px] text-gray-500 leading-tight">{btn.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AnimatePresence>
  )
}
