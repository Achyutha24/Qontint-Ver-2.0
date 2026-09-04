"""
Centralized Constants & Domain Vocabularies for SERP Intelligence Pipeline.
"""
from __future__ import annotations
import re
from typing import Dict, List

class Stage:
    QUEUED            = "QUEUED"
    CACHE_LOOKUP      = "CACHE_LOOKUP"
    CACHE_HIT         = "CACHE_HIT"
    CACHE_MISS        = "CACHE_MISS"
    SERP_FETCHING     = "FETCHING_SERP"
    SERP_COMPLETE     = "SERP_FETCHED"
    CONTENT_EXTRACT   = "EXTRACTING_CONTENT"
    ENTITY_EXTRACT    = "ENTITY_EXTRACTION"
    AI_RUNNING        = "AI_RUNNING"
    AI_COMPLETE       = "AI_COMPLETE"
    REPORT_BUILDING   = "REPORT_BUILDING"
    REPORT_COMPLETE   = "REPORT_COMPLETE"
    FAILED            = "FAILED"

NOISE_TERMS = {
    "home", "login", "signup", "sign up", "video", "profile", "privacy", "privacy policy",
    "cookie", "cookies", "search", "menu", "footer", "header", "javascript", "css", "html",
    "click here", "read more", "view all", "all rights reserved", "copyright", "contact",
    "about us", "terms", "terms of service", "navigation", "toggle", "button", "link",
    "page", "pages", "site", "website", "blog", "article", "post", "comment", "comments",
    "share", "facebook", "twitter", "linkedin", "youtube", "instagram", "email", "phone",
    "january", "february", "march", "april", "may", "june", "july", "august", "september",
    "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug",
    "sep", "oct", "nov", "dec", "2023", "2024", "2025", "2026", "2027", "today", "yesterday",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
}

SYNONYM_MAP = {
    "ai": "Artificial Intelligence",
    "genai": "Generative Artificial Intelligence",
    "llm": "Large Language Model",
    "llms": "Large Language Model",
    "crm": "CRM",
    "crm software": "CRM",
    "crm platform": "CRM",
    "erp": "ERP",
    "erp system": "ERP",
    "pm": "Project Management",
    "pm tools": "Project Management",
    "sla": "Service Level Agreement",
    "slas": "Service Level Agreement",
    "api": "REST API Architecture",
    "apis": "REST API Architecture",
    "roi": "Return on Investment",
    "tco": "Total Cost of Ownership",
    "gdpr": "Security & Regulatory Compliance",
    "soc 2": "Security & Regulatory Compliance",
    "iso 27001": "Security & Regulatory Compliance",
    "rbac": "Role-Based Access Control",
    "bi": "Business Intelligence & Analytics",
    "ml": "Machine Learning",
    "seo tools": "SEO Tools",
    "good free seo tool": "SEO Tools",
    "24 good seo tool": "SEO Tools",
    "five tool": "SEO Tools",
    "technical implementation details": "Technical Implementation",
    "our cut-edge platform": "Platform Architecture",
    "our platform": "Platform Architecture",
    "pricing model": "Pricing",
    "pricing": "Pricing",
    "cost": "Pricing",
}

MARKETING_SLOGAN_PATTERNS = [
    (r"\b(our|my|their|top|best|world's|award[- ]winning|leading|cutting[- ]edge)\b.*?\b(platform|solution|tool|suite|software|engine|app)\b", r"Enterprise Solution Architecture"),
    (r"\b(try|start|get|buy|claim)\b.*?\b(free|today|now|trial|demo)\b", r"Platform Trial & Licensing"),
    (r"\b(sign up|login|log in|subscribe|contact us|click here)\b", r"Account Provisioning & Access"),
]

_DOMAIN_VOCABULARY: Dict[str, Dict[str, List[str]]] = {
    "crm": {
        "core": ["Lead Management", "Sales Pipeline", "Contact Management", "Deal Tracking", "Customer Lifecycle", "Account Management"],
        "supporting": ["Email Campaigns", "Workflow Automation", "CRM Reporting", "Sales Forecasting", "Customer Segmentation", "Pipeline Analytics"],
        "technologies": ["Salesforce", "HubSpot", "Zoho CRM", "Pipedrive", "REST API", "Webhooks"],
        "commercial": ["CRM Pricing", "Per-User Licensing", "Enterprise Tier", "Free Tier Limitations", "CRM ROI Calculator"],
        "questions": ["What CRM is best for small business?", "How to migrate CRM data?", "CRM vs spreadsheet?", "How to calculate CRM ROI?"],
        "trust": ["SOC 2 Compliance", "Data Encryption at Rest", "GDPR Data Handling", "Role-Based Access Control"],
        "integrations": ["Email Integration", "Calendar Sync", "Marketing Automation", "ERP Connectivity", "Social Media Integration"],
    },
    "cybersecurity": {
        "core": ["Zero Trust Architecture", "Threat Detection", "Incident Response", "Vulnerability Management", "Security Operations Center (SOC)"],
        "supporting": ["SIEM", "IAM", "Endpoint Detection Response (EDR)", "Penetration Testing", "Security Awareness Training", "Threat Intelligence"],
        "technologies": ["CrowdStrike", "Palo Alto Networks", "Splunk", "Fortinet", "SentinelOne"],
        "commercial": ["Security Budget Planning", "Managed Security Services Pricing", "Cyber Insurance", "TCO for Security Stack"],
        "questions": ["How to implement Zero Trust?", "What is a SOC?", "SIEM vs SOAR?", "How to respond to a data breach?"],
        "trust": ["ISO 27001", "SOC 2 Type II", "NIST Framework", "PCI DSS", "HIPAA Compliance"],
        "integrations": ["SIEM Integration", "Ticketing System Integration", "Cloud Security Posture Management", "API Security Gateway"],
    },
    "cloud_security": {
        "core": ["Cloud Security Posture Management (CSPM)", "Cloud Access Security Broker (CASB)", "Identity & Access Management", "Data Loss Prevention (DLP)", "Cloud Workload Protection"],
        "supporting": ["Container Security", "Serverless Security", "DevSecOps", "Cloud Compliance Automation", "Shared Responsibility Model", "Multi-Cloud Security"],
        "technologies": ["AWS Security Hub", "Azure Defender", "Google Chronicle", "Prisma Cloud", "Wiz", "Lacework"],
        "commercial": ["Cloud Security Budget", "CSPM Licensing", "Managed Cloud Security Cost", "Cloud Security ROI"],
        "questions": ["How to secure cloud infrastructure?", "What is CSPM?", "Cloud security vs on-premise?", "How to implement zero trust in cloud?"],
        "trust": ["ISO 27017", "SOC 2 Type II", "FedRAMP", "CIS Cloud Benchmark", "GDPR Cloud Compliance"],
        "integrations": ["SIEM Integration", "DevOps Pipeline Security", "Cloud-Native Security Tools", "Threat Intelligence Feeds"],
    },
    "erp": {
        "core": ["Financial Accounting (FI/CO)", "Supply Chain Management", "Materials Management", "Human Capital Management", "Production Planning"],
        "supporting": ["Procurement", "Warehouse Management", "Quality Management", "Plant Maintenance", "Business Intelligence"],
        "technologies": ["SAP S/4HANA", "Oracle ERP Cloud", "Microsoft Dynamics 365", "Infor CloudSuite", "NetSuite"],
        "commercial": ["ERP Implementation Cost", "Total Cost of Ownership", "ERP Licensing Models", "Cloud vs On-Premise Pricing"],
        "questions": ["How long does ERP implementation take?", "What is the ROI of ERP?", "Cloud ERP vs on-premise?", "How to choose an ERP vendor?"],
        "trust": ["SOX Compliance", "GDPR Data Residency", "Audit Trail Requirements", "Multi-Entity Accounting Standards"],
        "integrations": ["CRM Integration", "E-Commerce Integration", "EDI Connectivity", "Banking Interface", "Third-Party Logistics (3PL)"],
    },
    "project_management": {
        "core": ["Task Management", "Gantt Charts", "Resource Allocation", "Sprint Planning", "Project Portfolio Management"],
        "supporting": ["Kanban Boards", "Time Tracking", "Budget Tracking", "Risk Management", "Milestone Tracking", "Capacity Planning"],
        "technologies": ["Jira", "Asana", "Monday.com", "Trello", "Microsoft Project", "Smartsheet"],
        "commercial": ["Per-Seat Pricing", "Enterprise Plan Features", "Free Tier Limitations", "PM Tool ROI"],
        "questions": ["Agile vs Waterfall?", "How to manage remote teams?", "Best PM tool for startups?", "How to create a project timeline?"],
        "trust": ["Data Residency", "SSO & SAML", "Audit Logging", "SOC 2 Compliance"],
        "integrations": ["Slack Integration", "Git Integration", "CI/CD Pipeline", "Calendar Sync", "Document Management"],
    },
    "ai": {
        "core": ["Neural Networks", "Natural Language Processing", "Computer Vision", "Machine Learning", "Deep Learning", "Generative AI"],
        "supporting": ["Transfer Learning", "Reinforcement Learning", "LLM Fine-Tuning", "Prompt Engineering", "AI Ethics", "Model Evaluation"],
        "technologies": ["TensorFlow", "PyTorch", "OpenAI GPT", "Hugging Face", "LangChain", "Scikit-Learn"],
        "commercial": ["AI Implementation Cost", "AI ROI Measurement", "AI as a Service Pricing", "Compute Cost Optimization"],
        "questions": ["How does AI differ from ML?", "What is a large language model?", "How to implement AI in business?", "AI bias mitigation?"],
        "trust": ["AI Governance Framework", "Model Explainability", "Data Privacy in AI", "EU AI Act Compliance"],
        "integrations": ["API Integration", "Data Pipeline Integration", "MLOps Pipeline", "Cloud AI Services", "Edge AI Deployment"],
    },
    "content_marketing": {
        "core": ["Content Strategy", "SEO Content", "Topic Clustering", "Content Distribution", "Content Calendar", "Editorial Workflow"],
        "supporting": ["Keyword Research", "Content Optimization", "Link Building", "Content Repurposing", "Content Analytics", "Audience Segmentation"],
        "technologies": ["Semrush", "Ahrefs", "Surfer SEO", "Clearscope", "MarketMuse", "Google Search Console"],
        "commercial": ["Content Marketing Budget", "Agency vs In-House", "Content Marketing ROI", "Cost Per Content Piece"],
        "questions": ["How to build a content strategy?", "Blog post vs pillar page?", "How to measure content ROI?", "Content frequency?"],
        "trust": ["E-E-A-T Signals", "Author Authority", "Editorial Standards", "Fact-Checking Process"],
        "integrations": ["CMS Integration", "Social Media Scheduling", "Email Marketing", "Analytics Platform", "CRM Integration"],
    },
    "payroll": {
        "core": ["Payroll Processing", "Tax Compliance", "Employee Compensation", "Payroll Automation", "Direct Deposit", "Payslip Generation"],
        "supporting": ["Time & Attendance Tracking", "Leave Management", "Expense Reimbursement", "Payroll Reporting", "Statutory Deductions", "Benefits Administration"],
        "technologies": ["ADP Workforce", "Gusto", "Paychex", "Workday Payroll", "Rippling", "Zenefits"],
        "commercial": ["Payroll Software Pricing", "Per-Employee Cost", "Payroll Outsourcing vs In-House", "Payroll ROI Calculator"],
        "questions": ["How to automate payroll?", "What is payroll compliance?", "Payroll software vs manual?", "How to handle international payroll?"],
        "trust": ["Tax Filing Accuracy", "GDPR Employee Data", "SOC 2 Payroll Security", "Audit Trail for Payroll"],
        "integrations": ["HR System Integration", "Accounting Software Sync", "Time Tracking Integration", "Bank Integration", "Tax Authority API"],
    },
    "banking": {
        "core": ["Core Banking System", "Digital Banking", "Payment Processing", "Loan Origination", "Account Management", "Risk Management"],
        "supporting": ["KYC & AML Compliance", "Fraud Detection", "Credit Scoring", "Trade Finance", "Treasury Management", "Regulatory Reporting"],
        "technologies": ["Temenos", "Finastra", "FIS Global", "Finacle", "Mambu", "nCino"],
        "commercial": ["Banking Software Cost", "Digital Transformation Budget", "Banking Platform Licensing", "TCO for Core Banking"],
        "questions": ["How does banking automation work?", "What is open banking?", "Core banking vs digital banking?", "How to implement KYC automation?"],
        "trust": ["PCI DSS Compliance", "Basel III", "GDPR Banking", "SOX Banking Audit", "RBI Compliance"],
        "integrations": ["Payment Gateway Integration", "Credit Bureau API", "Swift Network", "Open Banking API", "Regulatory API"],
    },
    "hr_tech": {
        "core": ["Human Resource Management", "Talent Acquisition", "Employee Onboarding", "Performance Management", "Learning & Development"],
        "supporting": ["Succession Planning", "Workforce Analytics", "Employee Engagement", "Compensation Planning", "HR Compliance"],
        "technologies": ["Workday HCM", "SAP SuccessFactors", "Oracle HCM", "BambooHR", "Greenhouse", "Lattice"],
        "commercial": ["HRIS Pricing", "HR Software ROI", "Per-Employee Cost", "HR Automation Savings"],
        "questions": ["How to automate HR processes?", "HRIS vs HRMS?", "How to measure HR ROI?", "Best HR software for mid-size companies?"],
        "trust": ["Employee Data Privacy", "GDPR HR Compliance", "Equal Employment Opportunity", "SOC 2 HR Security"],
        "integrations": ["Payroll System Integration", "ATS Integration", "Learning Management System", "Benefits Provider", "Slack HR Bot"],
    },
    "sports": {
        "core": ["Team Performance Analysis", "Player Statistics", "Match Results", "League Standings", "Tournament Format", "Season Schedule"],
        "supporting": ["Fantasy Sports", "Sports Betting Odds", "Player Rankings", "Historical Records", "Stadium Attendance", "Broadcasting Rights"],
        "technologies": ["ESPN Analytics", "StatsBomb", "Hawkeye", "DRS Technology", "Sports Performance Tracking"],
        "commercial": ["Sponsorship Deals", "Broadcasting Revenue", "Ticket Pricing", "Merchandise Sales", "Media Rights Value"],
        "questions": ["Who won the match?", "What is the team standings?", "Who is the top scorer?", "When is the next game?"],
        "trust": ["Anti-Doping Regulations", "Fair Play Standards", "Match Integrity", "Broadcasting Standards"],
        "integrations": ["Live Score API", "Fantasy Platform Integration", "Betting Exchange API", "Social Media Sports"],
    },
    "ecommerce": {
        "core": ["Product Catalog Management", "Shopping Cart", "Payment Gateway", "Order Management", "Inventory Management", "Customer Experience"],
        "supporting": ["Search & Merchandising", "Product Recommendations", "Returns Management", "Loyalty Programs", "Multi-Channel Selling"],
        "technologies": ["Shopify", "Magento", "WooCommerce", "Salesforce Commerce", "BigCommerce", "Stripe"],
        "commercial": ["E-Commerce Platform Cost", "Transaction Fees", "E-Commerce ROI", "Conversion Rate Optimization"],
        "questions": ["How to start an online store?", "Best e-commerce platform?", "How to reduce cart abandonment?", "How to improve product discovery?"],
        "trust": ["PCI DSS", "SSL Certificate", "GDPR Customer Data", "Fraud Prevention"],
        "integrations": ["ERP Integration", "CRM Integration", "Shipping Carrier API", "Tax Calculation API", "Analytics Platform"],
    },
    "saas": {
        "core": ["Software as a Service", "Multi-Tenancy Architecture", "Subscription Management", "SaaS Metrics", "Customer Success", "Product-Led Growth"],
        "supporting": ["Churn Reduction", "Net Revenue Retention", "Customer Onboarding", "Usage Analytics", "Feature Adoption", "Self-Serve Portal"],
        "technologies": ["AWS", "Azure", "Google Cloud", "Stripe Billing", "Chargebee", "Intercom"],
        "commercial": ["SaaS Pricing Models", "Annual Recurring Revenue (ARR)", "Customer Acquisition Cost", "Lifetime Value (LTV)"],
        "questions": ["What is SaaS?", "SaaS vs on-premise?", "How to price a SaaS product?", "How to reduce SaaS churn?"],
        "trust": ["SOC 2 Type II", "GDPR SaaS", "ISO 27001", "Uptime SLA", "Data Portability"],
        "integrations": ["Single Sign-On", "Zapier Automation", "REST API Access", "Webhook Events", "Analytics Integration"],
    },
    "general": {
        "core": ["Overview & Introduction", "Key Concepts", "Core Principles", "Practical Applications", "Best Practices", "Industry Standards"],
        "supporting": ["Implementation Guidelines", "Case Studies", "Expert Insights", "Common Challenges", "Success Metrics", "Future Trends"],
        "technologies": ["Cloud Platforms", "Analytics Tools", "Automation Software", "API Connectivity", "Data Management"],
        "commercial": ["Cost Analysis", "ROI Calculation", "Vendor Comparison", "Budget Planning", "Licensing Options"],
        "questions": ["How to get started?", "What are the key benefits?", "How to measure success?", "What are common mistakes?"],
        "trust": ["Industry Certifications", "Compliance Standards", "Security Practices", "Expert Endorsements"],
        "integrations": ["Third-Party Tools", "API Integration", "Data Export Options", "Platform Compatibility"],
    },
}
