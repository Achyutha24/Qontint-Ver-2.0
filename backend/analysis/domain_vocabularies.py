"""
M2 — Enterprise Domain Knowledge Modules
Provides modular, domain-specific vocabularies, patterns, and acronym maps across 13 enterprise verticals.
"""
from __future__ import annotations

from typing import Dict, List, Any

DOMAIN_VOCABULARIES: Dict[str, Dict[str, Any]] = {
    "sap": {
        "name": "SAP Ecosystem",
        "patterns": [
            {"label": "PRODUCT", "pattern": "S/4HANA"},
            {"label": "PRODUCT", "pattern": "SAP S/4HANA"},
            {"label": "PRODUCT", "pattern": "SAP BTP"},
            {"label": "PRODUCT", "pattern": "SAP Ariba"},
            {"label": "PRODUCT", "pattern": "SAP SuccessFactors"},
            {"label": "PRODUCT", "pattern": "SAP Signavio"},
            {"label": "PRODUCT", "pattern": "SAP Fiori"},
            {"label": "PRODUCT", "pattern": "RISE with SAP"},
            {"label": "PRODUCT", "pattern": "GROW with SAP"},
            {"label": "PRODUCT", "pattern": "SAP HANA"},
            {"label": "TECHNOLOGY", "pattern": "ABAP"},
            {"label": "CONCEPT", "pattern": "SAP Integration Suite"},
        ],
        "acronyms": {
            "BTP": "SAP Business Technology Platform",
            "HANA": "High-Performance Analytic Appliance",
        }
    },
    "erp": {
        "name": "Enterprise Resource Planning",
        "patterns": [
            {"label": "CONCEPT", "pattern": "Enterprise Resource Planning"},
            {"label": "PRODUCT", "pattern": "NetSuite"},
            {"label": "PRODUCT", "pattern": "Workday"},
            {"label": "PRODUCT", "pattern": "Microsoft Dynamics 365"},
            {"label": "PRODUCT", "pattern": "Oracle Fusion"},
            {"label": "TECHNOLOGY", "pattern": "financial close"},
            {"label": "TECHNOLOGY", "pattern": "procure-to-pay"},
            {"label": "TECHNOLOGY", "pattern": "order-to-cash"},
            {"label": "CONCEPT", "pattern": "general ledger"},
            {"label": "CONCEPT", "pattern": "chart of accounts"},
        ],
        "acronyms": {
            "ERP": "Enterprise Resource Planning",
            "P2P": "Procure to Pay",
            "O2C": "Order to Cash",
        }
    },
    "crm": {
        "name": "Customer Relationship Management",
        "patterns": [
            {"label": "CONCEPT", "pattern": "Customer Relationship Management"},
            {"label": "PRODUCT", "pattern": "Salesforce"},
            {"label": "PRODUCT", "pattern": "HubSpot"},
            {"label": "PRODUCT", "pattern": "Zoho CRM"},
            {"label": "PRODUCT", "pattern": "Pipedrive"},
            {"label": "TECHNOLOGY", "pattern": "lead scoring"},
            {"label": "TECHNOLOGY", "pattern": "pipeline management"},
            {"label": "TECHNOLOGY", "pattern": "sales automation"},
            {"label": "CONCEPT", "pattern": "contact management"},
            {"label": "CONCEPT", "pattern": "customer lifecycle"},
        ],
        "acronyms": {
            "CRM": "Customer Relationship Management",
            "SFA": "Sales Force Automation",
            "CLV": "Customer Lifetime Value",
        }
    },
    "banking": {
        "name": "Banking & Lending",
        "patterns": [
            {"label": "TECHNOLOGY", "pattern": "core banking"},
            {"label": "TECHNOLOGY", "pattern": "digital lending"},
            {"label": "TECHNOLOGY", "pattern": "BaaS"},
            {"label": "TECHNOLOGY", "pattern": "embedded finance"},
            {"label": "TECHNOLOGY", "pattern": "RegTech"},
            {"label": "CONCEPT", "pattern": "KYC"},
            {"label": "CONCEPT", "pattern": "AML"},
            {"label": "CONCEPT", "pattern": "credit scoring"},
            {"label": "CONCEPT", "pattern": "loan origination"},
            {"label": "REGULATION", "pattern": "CFPB"},
            {"label": "REGULATION", "pattern": "Basel III"},
            {"label": "REGULATION", "pattern": "RESPA"},
            {"label": "REGULATION", "pattern": "HMDA"},
        ],
        "acronyms": {
            "BaaS": "Banking as a Service",
            "KYC": "Know Your Customer",
            "AML": "Anti-Money Laundering",
            "LTV": "Loan to Value",
            "DTI": "Debt to Income",
        }
    },
    "payroll": {
        "name": "Payroll & HR",
        "patterns": [
            {"label": "TECHNOLOGY", "pattern": "HRIS"},
            {"label": "TECHNOLOGY", "pattern": "HCM"},
            {"label": "CONCEPT", "pattern": "direct deposit"},
            {"label": "CONCEPT", "pattern": "tax withholding"},
            {"label": "CONCEPT", "pattern": "garnishment"},
            {"label": "CONCEPT", "pattern": "time and attendance"},
            {"label": "ORG", "pattern": "ADP"},
            {"label": "ORG", "pattern": "Gusto"},
            {"label": "ORG", "pattern": "Paychex"},
        ],
        "acronyms": {
            "HRIS": "Human Resource Information System",
            "HCM": "Human Capital Management",
            "PTO": "Paid Time Off",
            "FLSA": "Fair Labor Standards Act",
        }
    },
    "ai": {
        "name": "Artificial Intelligence & ML",
        "patterns": [
            {"label": "CONCEPT", "pattern": "Artificial Intelligence"},
            {"label": "TECHNOLOGY", "pattern": "generative AI"},
            {"label": "TECHNOLOGY", "pattern": "LLM"},
            {"label": "TECHNOLOGY", "pattern": "RAG"},
            {"label": "TECHNOLOGY", "pattern": "prompt engineering"},
            {"label": "TECHNOLOGY", "pattern": "neural networks"},
            {"label": "TECHNOLOGY", "pattern": "natural language processing"},
            {"label": "TECHNOLOGY", "pattern": "machine learning"},
            {"label": "TECHNOLOGY", "pattern": "vector database"},
        ],
        "acronyms": {
            "AI": "Artificial Intelligence",
            "ML": "Machine Learning",
            "LLM": "Large Language Model",
            "RAG": "Retrieval-Augmented Generation",
            "NLP": "Natural Language Processing",
        }
    },
    "cybersecurity": {
        "name": "Cybersecurity & Identity",
        "patterns": [
            {"label": "TECHNOLOGY", "pattern": "Zero Trust"},
            {"label": "TECHNOLOGY", "pattern": "SIEM"},
            {"label": "TECHNOLOGY", "pattern": "EDR"},
            {"label": "TECHNOLOGY", "pattern": "XDR"},
            {"label": "TECHNOLOGY", "pattern": "IAM"},
            {"label": "REGULATION", "pattern": "SOC 2"},
            {"label": "REGULATION", "pattern": "HIPAA"},
            {"label": "REGULATION", "pattern": "ISO 27001"},
            {"label": "TECHNOLOGY", "pattern": "Identity and Access Management"},
            {"label": "TECHNOLOGY", "pattern": "Security Information and Event Management"},
        ],
        "acronyms": {
            "IAM": "Identity and Access Management",
            "SIEM": "Security Information and Event Management",
            "EDR": "Endpoint Detection and Response",
            "XDR": "Extended Detection and Response",
            "SOC 2": "Service Organization Control 2",
        }
    },
    "cloud": {
        "name": "Cloud Computing & DevOps",
        "patterns": [
            {"label": "TECHNOLOGY", "pattern": "Kubernetes"},
            {"label": "TECHNOLOGY", "pattern": "Docker"},
            {"label": "TECHNOLOGY", "pattern": "Serverless"},
            {"label": "TECHNOLOGY", "pattern": "Microservices"},
            {"label": "ORG", "pattern": "AWS"},
            {"label": "ORG", "pattern": "Azure"},
            {"label": "ORG", "pattern": "GCP"},
            {"label": "TECHNOLOGY", "pattern": "Infrastructure as Code"},
        ],
        "acronyms": {
            "AWS": "Amazon Web Services",
            "GCP": "Google Cloud Platform",
            "K8s": "Kubernetes",
            "IaC": "Infrastructure as Code",
            "SaaS": "Software as a Service",
            "PaaS": "Platform as a Service",
            "IaaS": "Infrastructure as a Service",
        }
    },
    "fintech": {
        "name": "FinTech & Payments",
        "patterns": [
            {"label": "TECHNOLOGY", "pattern": "embedded finance"},
            {"label": "TECHNOLOGY", "pattern": "payment gateway"},
            {"label": "PRODUCT", "pattern": "Stripe"},
            {"label": "PRODUCT", "pattern": "Plaid"},
            {"label": "CONCEPT", "pattern": "neobank"},
            {"label": "CONCEPT", "pattern": "decentralized finance"},
            {"label": "CONCEPT", "pattern": "card issuing"},
        ],
        "acronyms": {
            "DeFi": "Decentralized Finance",
            "ACH": "Automated Clearing House",
            "PCI DSS": "Payment Card Industry Data Security Standard",
        }
    },
    "supply_chain": {
        "name": "Supply Chain & Logistics",
        "patterns": [
            {"label": "TECHNOLOGY", "pattern": "WMS"},
            {"label": "TECHNOLOGY", "pattern": "TMS"},
            {"label": "CONCEPT", "pattern": "demand forecasting"},
            {"label": "CONCEPT", "pattern": "inventory management"},
            {"label": "CONCEPT", "pattern": "warehouse optimization"},
            {"label": "CONCEPT", "pattern": "supply chain visibility"},
            {"label": "CONCEPT", "pattern": "3PL"},
        ],
        "acronyms": {
            "WMS": "Warehouse Management System",
            "TMS": "Transportation Management System",
            "3PL": "Third-Party Logistics",
            "SKU": "Stock Keeping Unit",
        }
    },
    "healthcare": {
        "name": "Healthcare & Life Sciences",
        "patterns": [
            {"label": "TECHNOLOGY", "pattern": "EHR"},
            {"label": "TECHNOLOGY", "pattern": "EMR"},
            {"label": "TECHNOLOGY", "pattern": "telehealth"},
            {"label": "CONCEPT", "pattern": "medical billing"},
            {"label": "REGULATION", "pattern": "HIPAA Compliance"},
            {"label": "TECHNOLOGY", "pattern": "FHIR"},
            {"label": "TECHNOLOGY", "pattern": "HL7"},
        ],
        "acronyms": {
            "EHR": "Electronic Health Record",
            "EMR": "Electronic Medical Record",
            "FHIR": "Fast Healthcare Interoperability Resources",
        }
    },
    "manufacturing": {
        "name": "Smart Manufacturing",
        "patterns": [
            {"label": "TECHNOLOGY", "pattern": "MES"},
            {"label": "TECHNOLOGY", "pattern": "IIoT"},
            {"label": "CONCEPT", "pattern": "smart factory"},
            {"label": "CONCEPT", "pattern": "lean manufacturing"},
            {"label": "CONCEPT", "pattern": "predictive maintenance"},
            {"label": "CONCEPT", "pattern": "OEE"},
        ],
        "acronyms": {
            "MES": "Manufacturing Execution System",
            "IIoT": "Industrial Internet of Things",
            "OEE": "Overall Equipment Effectiveness",
            "PLM": "Product Lifecycle Management",
        }
    },
    "content_marketing": {
        "name": "Content Marketing & SEO",
        "patterns": [
            {"label": "CONCEPT", "pattern": "search engine optimization"},
            {"label": "TECHNOLOGY", "pattern": "content strategy"},
            {"label": "CONCEPT", "pattern": "topical authority"},
            {"label": "TECHNOLOGY", "pattern": "keyword research"},
            {"label": "CONCEPT", "pattern": "SERP optimization"},
            {"label": "CONCEPT", "pattern": "information gain"},
            {"label": "CONCEPT", "pattern": "search intent"},
        ],
        "acronyms": {
            "SEO": "Search Engine Optimization",
            "SERP": "Search Engine Results Page",
            "CTR": "Click-Through Rate",
            "E-E-A-T": "Experience Expertise Authoritativeness Trustworthiness",
        }
    }
}

# Centralized Acronym & Synonym Normalization Dictionary
CANONICAL_ENTITY_MAP: Dict[str, Dict[str, str]] = {
    # AI & ML
    "ai": {"canonical": "Artificial Intelligence", "acronym": "AI", "category": "Technology"},
    "artificial intelligence": {"canonical": "Artificial Intelligence", "acronym": "AI", "category": "Technology"},
    "machine learning": {"canonical": "Machine Learning", "acronym": "ML", "category": "Technology"},
    "ml": {"canonical": "Machine Learning", "acronym": "ML", "category": "Technology"},
    "large language model": {"canonical": "Large Language Model", "acronym": "LLM", "category": "Technology"},
    "llm": {"canonical": "Large Language Model", "acronym": "LLM", "category": "Technology"},
    "rag": {"canonical": "Retrieval-Augmented Generation", "acronym": "RAG", "category": "Technology"},
    "retrieval-augmented generation": {"canonical": "Retrieval-Augmented Generation", "acronym": "RAG", "category": "Technology"},
    "nlp": {"canonical": "Natural Language Processing", "acronym": "NLP", "category": "Technology"},
    "natural language processing": {"canonical": "Natural Language Processing", "acronym": "NLP", "category": "Technology"},

    # CRM
    "crm": {"canonical": "Customer Relationship Management", "acronym": "CRM", "category": "Technology"},
    "crm software": {"canonical": "Customer Relationship Management", "acronym": "CRM", "category": "Technology"},
    "customer relationship management": {"canonical": "Customer Relationship Management", "acronym": "CRM", "category": "Technology"},

    # ERP & Finance
    "erp": {"canonical": "Enterprise Resource Planning", "acronym": "ERP", "category": "Technology"},
    "enterprise resource planning": {"canonical": "Enterprise Resource Planning", "acronym": "ERP", "category": "Technology"},
    "ap automation": {"canonical": "Accounts Payable Automation", "acronym": "AP Automation", "category": "Technology"},
    "ar automation": {"canonical": "Accounts Receivable Automation", "acronym": "AR Automation", "category": "Technology"},

    # Cybersecurity
    "iam": {"canonical": "Identity and Access Management", "acronym": "IAM", "category": "Cybersecurity"},
    "identity and access management": {"canonical": "Identity and Access Management", "acronym": "IAM", "category": "Cybersecurity"},
    "siem": {"canonical": "Security Information and Event Management", "acronym": "SIEM", "category": "Cybersecurity"},
    "security information and event management": {"canonical": "Security Information and Event Management", "acronym": "SIEM", "category": "Cybersecurity"},
    "edr": {"canonical": "Endpoint Detection and Response", "acronym": "EDR", "category": "Cybersecurity"},
    "xdr": {"canonical": "Extended Detection and Response", "acronym": "XDR", "category": "Cybersecurity"},
    "soc 2": {"canonical": "SOC 2 Compliance", "acronym": "SOC 2", "category": "Regulation"},
    "soc2": {"canonical": "SOC 2 Compliance", "acronym": "SOC 2", "category": "Regulation"},
    "zero trust": {"canonical": "Zero Trust Security", "acronym": "Zero Trust", "category": "Cybersecurity"},

    # HR & Payroll
    "hris": {"canonical": "Human Resource Information System", "acronym": "HRIS", "category": "Payroll & HR"},
    "hcm": {"canonical": "Human Capital Management", "acronym": "HCM", "category": "Payroll & HR"},
    "payroll software": {"canonical": "Payroll System", "acronym": "Payroll", "category": "Payroll & HR"},

    # Supply Chain
    "wms": {"canonical": "Warehouse Management System", "acronym": "WMS", "category": "Supply Chain"},
    "tms": {"canonical": "Transportation Management System", "acronym": "TMS", "category": "Supply Chain"},
    "mes": {"canonical": "Manufacturing Execution System", "acronym": "MES", "category": "Manufacturing"},

    # SAP & Platforms
    "sap s/4hana": {"canonical": "SAP S/4HANA", "acronym": "S/4HANA", "category": "SAP"},
    "s/4hana": {"canonical": "SAP S/4HANA", "acronym": "S/4HANA", "category": "SAP"},
    "sap btp": {"canonical": "SAP Business Technology Platform", "acronym": "SAP BTP", "category": "SAP"},
    "btp": {"canonical": "SAP Business Technology Platform", "acronym": "SAP BTP", "category": "SAP"},

    # Cloud & Infrastructure
    "aws": {"canonical": "Amazon Web Services", "acronym": "AWS", "category": "Cloud"},
    "azure": {"canonical": "Microsoft Azure", "acronym": "Azure", "category": "Cloud"},
    "gcp": {"canonical": "Google Cloud Platform", "acronym": "GCP", "category": "Cloud"},
    "k8s": {"canonical": "Kubernetes", "acronym": "K8s", "category": "Cloud"},
    "kubernetes": {"canonical": "Kubernetes", "acronym": "K8s", "category": "Cloud"},

    # SEO
    "seo": {"canonical": "Search Engine Optimization", "acronym": "SEO", "category": "Content Marketing"},
    "serp": {"canonical": "Search Engine Results Page", "acronym": "SERP", "category": "Content Marketing"},
}


def get_all_vertical_patterns() -> List[Dict[str, str]]:
    """Flatten all vertical patterns into a single list for EntityRuler."""
    patterns = []
    for domain, info in DOMAIN_VOCABULARIES.items():
        patterns.extend(info.get("patterns", []))
    return patterns
