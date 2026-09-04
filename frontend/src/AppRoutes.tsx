/**
 * AppRoutes — Centralized routing configuration.
 *
 * Public routes (LandingLayout):
 *   /          → Landing (homepage with domain selector)
 *   /pricing   → PricingPage
 *   /login     → LoginPage
 *   /register  → RegisterPage
 *
 * Protected app routes (AppLayout + DomainGuard):
 *   /app              → redirect to /app/analyze
 *   /app/analyze      → AnalyzePage
 *   /app/generate     → GeneratePage
 *   /app/intelligence → QueryIntelPage
 *   /app/competitor   → AnalyzePage (competitor analysis mode)
 *   /app/graph        → GraphPage
 *   /app/youtube      → YouTubePage
 *   /app/keywords     → KeywordsPage
 *   /app/dashboard    → DashboardPage
 */
import { Routes, Route, Navigate } from 'react-router-dom'


// Layouts
import LandingLayout from './layouts/LandingLayout'
import AppLayout from './layouts/AppLayout'

// Guard
import DomainGuard from './components/DomainGuard'

// Landing pages
import Landing from './pages/Landing'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

// Existing pages — imported directly, NOT rewritten
import PricingPage from './pages/PricingPage'
import AnalyzePage from './pages/AnalyzePage'
import GeneratePage from './pages/GeneratePage'
import QueryIntelPage from './pages/QueryIntelPage'
import GraphPage from './pages/GraphPage'
import YouTubePage from './pages/YouTubePage'
import KeywordsPage from './pages/KeywordsPage'
import DashboardPage from './pages/DashboardPage'
import SerpIntelPage from './pages/SerpIntelPage'
import ReportsPage from './pages/ReportsPage'
import WorkspacePage from './pages/WorkspacePage'
import AnalyzeReportPage from './pages/AnalyzeReportPage'
import SettingsPage from './pages/SettingsPage'
import HelpDocsPage from './pages/HelpDocsPage'
import AboutQontintPage from './pages/AboutQontintPage'

export default function AppRoutes() {
  return (
    <Routes>
      {/* ── Public / Landing routes ── */}
      <Route element={<LandingLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* ── Standalone Dedicated Report Workspace Routes (Outside AppLayout — Unmounts Dashboard & Navbar completely) ── */}
      <Route element={<DomainGuard />}>
        <Route path="/app/analyze/report" element={<AnalyzeReportPage />} />
        <Route path="/app/report/:reportId" element={<AnalyzeReportPage />} />
      </Route>

      {/* ── Application workspace routes (protected by DomainGuard) ── */}
      <Route element={<AppLayout />}>
        {/* DomainGuard: redirects to "/" if no workspace selected */}
        <Route element={<DomainGuard />}>
          <Route path="/app" element={<Navigate to="/app/analyze" replace />} />
          <Route path="/app/analyze" element={<AnalyzePage />} />
          <Route path="/app/generate" element={<GeneratePage />} />
          <Route path="/app/intelligence" element={<QueryIntelPage />} />
          <Route path="/app/serp-intel" element={<SerpIntelPage />} />
          <Route path="/app/graph" element={<GraphPage />} />
          <Route path="/app/reports" element={<ReportsPage />} />
          <Route path="/app/workspace" element={<WorkspacePage />} />
          <Route path="/app/youtube" element={<YouTubePage />} />
          <Route path="/app/keywords" element={<KeywordsPage />} />
          <Route path="/app/dashboard" element={<DashboardPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
          <Route path="/app/help" element={<HelpDocsPage />} />
          <Route path="/app/about" element={<AboutQontintPage />} />
        </Route>
      </Route>

      {/* ── Catch-all: redirect unknown paths to landing ── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
