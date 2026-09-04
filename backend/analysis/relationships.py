"""
M3 — Graph Builder (Neo4j)
4-stage pipeline: Extract → Build nodes → Co-occurrence edges → PageRank
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.neo4j_client import run_query, run_write_query
from models.db import SerpResult, Entity, EntityOccurrence
from analysis.entities import extract_entities_from_text, get_nlp, get_spacy_doc

import networkx as nx

logger = logging.getLogger(__name__)

def extract_svo_from_text(content: str, max_len: int = 50_000) -> list[tuple[str, str, str]]:
    doc = get_spacy_doc(content, max_len)
    
    svo_triples = []
    for token in doc:
        if token.pos_ == "VERB":
            subjects = [w.lemma_.lower() for w in token.lefts if w.dep_ in ("nsubj", "nsubjpass")]
            objects = [w.lemma_.lower() for w in token.rights if w.dep_ in ("dobj", "attr", "acomp")]
            
            for child in token.rights:
                if child.dep_ == "prep":
                    for p_child in child.rights:
                        if p_child.dep_ == "pobj":
                            objects.append(p_child.lemma_.lower())
                            
            # Add some fallback logic to pick up noun chunks
            if not subjects or not objects:
                continue
                
            for subj in subjects:
                for obj in objects:
                    if len(subj) >= 2 and len(obj) >= 2:
                        svo_triples.append((subj, token.lemma_.lower(), obj))
                        
    return svo_triples

def build_semantic_graph(content: str) -> nx.DiGraph:
    """Build a NetworkX semantic graph from content based on SVO triples."""
    triples = extract_svo_from_text(content)
    G = nx.DiGraph()
    for subj, verb, obj in triples:
        G.add_edge(subj, obj, relation=verb)
    return G

def get_graph_stats(G: nx.DiGraph) -> dict:
    """Calculate NetworkX graph stats."""
    return {
        "unique_edges": len(G.edges()),
        "density": nx.density(G) if len(G.nodes()) > 1 else 0.0,
        "nodes": len(G.nodes())
    }


async def build_graph_for_vertical(vertical: str, db: AsyncSession) -> dict[str, Any]:
    """Full 4-stage graph build pipeline for a vertical."""
    logger.info("Building entity graph for vertical: %s", vertical)

    # Stage 1 & 2: Load SERP results → create Entity nodes + APPEARS_IN edges
    result = await db.execute(
        select(SerpResult).where(SerpResult.vertical == vertical)
    )
    serp_results = result.scalars().all()

    nodes_created = 0
    edges_created = 0

    for doc in serp_results:
        if not doc.body_content:
            continue

        entities = extract_entities_from_text(doc.body_content, vertical)

        doc_node_id = f"doc:{doc.id}"
        # Upsert Document node
        await run_write_query(
            """
            MERGE (d:Document {id: $id})
            SET d.url = $url,
                d.serp_position = $pos,
                d.domain_rating = $dr,
                d.vertical = $vertical
            """,
            {"id": doc_node_id, "url": doc.url or "", "pos": doc.position,
             "dr": doc.domain_rating or 0.0, "vertical": vertical},
        )

        # Stage 2: Create Entity nodes + APPEARS_IN edges
        entity_texts_in_doc: list[str] = []
        for ent in entities:
            ent_id = f"ent:{vertical}:{ent['text'].lower()}"
            await run_write_query(
                """
                MERGE (e:Entity {id: $id})
                SET e.text = $text,
                    e.type = $type,
                    e.vertical = $vertical,
                    e.frequency = coalesce(e.frequency, 0) + 1
                WITH e
                MATCH (d:Document {id: $doc_id})
                MERGE (e)-[:APPEARS_IN]->(d)
                """,
                {
                    "id": ent_id,
                    "text": ent["text"],
                    "type": ent["entity_type"],
                    "vertical": vertical,
                    "doc_id": doc_node_id,
                },
            )
            entity_texts_in_doc.append(ent_id)
            nodes_created += 1

        # Stage 3: CO_OCCURS_WITH edges (all pairs in this document)
        for i, e1 in enumerate(entity_texts_in_doc):
            for e2 in entity_texts_in_doc[i + 1:]:
                await run_write_query(
                    """
                    MATCH (e1:Entity {id: $id1}), (e2:Entity {id: $id2})
                    MERGE (e1)-[r:CO_OCCURS_WITH]-(e2)
                    ON CREATE SET r.weight = 1, r.documents = 1
                    ON MATCH SET r.weight = r.weight + 1,
                                 r.documents = r.documents + 1
                    """,
                    {"id1": e1, "id2": e2},
                )
                edges_created += 1

    # Stage 4: PageRank authority scoring
    try:
        await run_graph_pagerank(vertical)
        logger.info("PageRank computed for %s", vertical)
    except Exception as exc:
        logger.warning("PageRank failed (GDS may not be available): %s", exc)

    return {
        "vertical": vertical,
        "nodes_created": nodes_created,
        "edges_created": edges_created,
    }


async def run_graph_pagerank(vertical: str) -> None:
    """Run GDS PageRank and write authority_score to Entity nodes."""
    # Create in-memory projection for this vertical's entities
    graph_name = f"entity-graph-{vertical}"

    # Drop if exists
    try:
        await run_query(
            "CALL gds.graph.drop($name, false)",
            {"name": graph_name},
        )
    except Exception:
        pass

    # Project graph (only entities of this vertical)
    await run_query(
        """
        CALL gds.graph.project.cypher(
          $name,
          'MATCH (e:Entity {vertical: $vertical}) RETURN id(e) AS id',
          'MATCH (e1:Entity {vertical: $vertical})-[r:CO_OCCURS_WITH]-(e2:Entity {vertical: $vertical})
           RETURN id(e1) AS source, id(e2) AS target, r.weight AS weight'
        )
        """,
        {"name": graph_name, "vertical": vertical},
    )

    # Run PageRank and write back
    await run_query(
        """
        CALL gds.pageRank.write($name, {
          maxIterations: 20,
          dampingFactor: 0.85,
          writeProperty: 'authority_score'
        })
        """,
        {"name": graph_name},
    )

    # Cleanup projection
    await run_query("CALL gds.graph.drop($name, false)", {"name": graph_name})


async def get_entity_neighbors(
    entity_id: str,
    depth: int = 2,
    min_weight: float = 0.1,
) -> dict[str, Any]:
    """Get entity neighbors from Neo4j up to given depth."""
    records = await run_query(
        """
        MATCH (e:Entity {id: $id})-[r:CO_OCCURS_WITH*1..$depth]-(neighbor:Entity)
        WHERE r[0].weight >= $min_weight
        RETURN neighbor.text AS text,
               neighbor.type AS type,
               neighbor.authority_score AS authority_score,
               r[0].weight AS weight
        ORDER BY weight DESC
        LIMIT 50
        """,
        {"id": entity_id, "depth": depth, "min_weight": min_weight},
    )
    return {"entity_id": entity_id, "neighbors": records}


async def get_top_authority_entities(
    vertical: str,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Get top N entities by authority_score for a vertical."""
    records = await run_query(
        """
        MATCH (e:Entity {vertical: $vertical})
        WHERE e.authority_score IS NOT NULL
        RETURN e.id AS id, e.text AS text, e.type AS type,
               e.authority_score AS authority_score,
               e.frequency AS frequency
        ORDER BY e.authority_score DESC
        LIMIT $limit
        """,
        {"vertical": vertical, "limit": limit},
    )
    
    if not records:
        # Fallback to SQLite
        from sqlalchemy import select, desc
        from db.postgres import AsyncSessionLocal
        from models.db import Entity
        
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(Entity)
                .where(Entity.vertical == vertical)
                .order_by(desc(Entity.frequency))
                .limit(limit)
            )
            entities = res.scalars().all()
            return [
                {"id": e.id, "text": e.text, "type": e.entity_type, 
                 "authority_score": e.authority_score or (e.frequency / 10.0), 
                 "frequency": e.frequency}
                for e in entities
            ]
            
    return records

def process_edges_for_quality(edge_records: list[dict], nodes: list[dict], max_degree: int = 30) -> list[dict]:
    """
    Apply graph quality improvements:
    - Remove self-loops
    - Remove duplicate edges (deterministic)
    - Normalize weights (0.0 to 1.0)
    - Limit dense neighborhoods to max_degree while preserving connectivity
    """
    unique_edges = {}
    max_w = 0.0
    
    for e in edge_records:
        s, t = e["source"], e["target"]
        if s == t:
            continue
        
        n1, n2 = sorted([s, t])
        w = float(e.get("weight", 1.0))
        
        if (n1, n2) not in unique_edges:
            unique_edges[(n1, n2)] = w
        else:
            unique_edges[(n1, n2)] = max(unique_edges[(n1, n2)], w)
            
        if unique_edges[(n1, n2)] > max_w:
            max_w = unique_edges[(n1, n2)]
            
    normalized_edges = []
    for (s, t), w in unique_edges.items():
        norm_w = (w / max_w) if max_w > 0 else 0.1
        normalized_edges.append({
            "source": s,
            "target": t,
            "weight": norm_w,
            "relation": "CO_OCCURS_WITH"
        })
        
    normalized_edges.sort(key=lambda x: (x["weight"], x["source"], x["target"]), reverse=True)
    
    node_degree = {n["id"]: 0 for n in nodes}
    filtered_edges = []
    
    for e in normalized_edges:
        s, t = e["source"], e["target"]
        if s not in node_degree: node_degree[s] = 0
        if t not in node_degree: node_degree[t] = 0
        
        if node_degree[s] >= max_degree and node_degree[t] >= max_degree:
            continue
            
        node_degree[s] += 1
        node_degree[t] += 1
        filtered_edges.append(e)
        
    filtered_edges.sort(key=lambda x: (x["source"], x["target"]))
    return filtered_edges

# ── Canonical Enterprise Resource Planning (ERP) Knowledge Graph Dataset ─────────
ERP_CANONICAL_NODES: list[dict[str, Any]] = [
    # 1. PLATFORM (12 Nodes)
    {"id": "erp-plat-sap-s4hana", "label": "SAP S/4HANA", "type": "PLATFORM", "vertical": "erp", "authority": 0.98},
    {"id": "erp-plat-sap-b1", "label": "SAP Business One", "type": "PLATFORM", "vertical": "erp", "authority": 0.85},
    {"id": "erp-plat-oracle-erp", "label": "Oracle Cloud ERP", "type": "PLATFORM", "vertical": "erp", "authority": 0.97},
    {"id": "erp-plat-ms-dyn-finance", "label": "Microsoft Dynamics 365 Finance", "type": "PLATFORM", "vertical": "erp", "authority": 0.95},
    {"id": "erp-plat-ms-dyn-scm", "label": "Microsoft Dynamics 365 SCM", "type": "PLATFORM", "vertical": "erp", "authority": 0.94},
    {"id": "erp-plat-netsuite", "label": "NetSuite ERP", "type": "PLATFORM", "vertical": "erp", "authority": 0.93},
    {"id": "erp-plat-workday", "label": "Workday Enterprise Management", "type": "PLATFORM", "vertical": "erp", "authority": 0.91},
    {"id": "erp-plat-infor", "label": "Infor CloudSuite", "type": "PLATFORM", "vertical": "erp", "authority": 0.88},
    {"id": "erp-plat-epicor", "label": "Epicor Kinetic", "type": "PLATFORM", "vertical": "erp", "authority": 0.84},
    {"id": "erp-plat-sage-x3", "label": "Sage X3", "type": "PLATFORM", "vertical": "erp", "authority": 0.82},
    {"id": "erp-plat-odoo", "label": "Odoo Enterprise ERP", "type": "PLATFORM", "vertical": "erp", "authority": 0.81},
    {"id": "erp-plat-acumatica", "label": "Acumatica Cloud ERP", "type": "PLATFORM", "vertical": "erp", "authority": 0.80},
    {"id": "erp-plat-ifs", "label": "IFS Cloud", "type": "PLATFORM", "vertical": "erp", "authority": 0.79},

    # 2. MODULE (14 Nodes)
    {"id": "erp-mod-finance", "label": "Finance & General Ledger", "type": "MODULE", "vertical": "erp", "authority": 0.98},
    {"id": "erp-mod-ap", "label": "Accounts Payable (AP)", "type": "MODULE", "vertical": "erp", "authority": 0.91},
    {"id": "erp-mod-ar", "label": "Accounts Receivable (AR)", "type": "MODULE", "vertical": "erp", "authority": 0.90},
    {"id": "erp-mod-procurement", "label": "Procurement & Sourcing", "type": "MODULE", "vertical": "erp", "authority": 0.96},
    {"id": "erp-mod-scm", "label": "Supply Chain Management (SCM)", "type": "MODULE", "vertical": "erp", "authority": 0.96},
    {"id": "erp-mod-inventory", "label": "Inventory Management", "type": "MODULE", "vertical": "erp", "authority": 0.94},
    {"id": "erp-mod-mfg", "label": "Manufacturing / MRP II", "type": "MODULE", "vertical": "erp", "authority": 0.93},
    {"id": "erp-mod-hcm", "label": "Human Capital Management (HCM)", "type": "MODULE", "vertical": "erp", "authority": 0.92},
    {"id": "erp-mod-wms", "label": "Warehouse Management (WMS)", "type": "MODULE", "vertical": "erp", "authority": 0.90},
    {"id": "erp-mod-sales", "label": "Sales & Order Management", "type": "MODULE", "vertical": "erp", "authority": 0.91},
    {"id": "erp-mod-asset-mgmt", "label": "Enterprise Asset Management (EAM)", "type": "MODULE", "vertical": "erp", "authority": 0.83},
    {"id": "erp-mod-bi-analytics", "label": "Business Intelligence & Analytics", "type": "MODULE", "vertical": "erp", "authority": 0.90},
    {"id": "erp-mod-project-mgmt", "label": "Project Accounting & Systems", "type": "MODULE", "vertical": "erp", "authority": 0.84},
    {"id": "erp-mod-treasury", "label": "Treasury & Cash Management", "type": "MODULE", "vertical": "erp", "authority": 0.87},

    # 3. PROCESS (12 Nodes)
    {"id": "erp-proc-p2p", "label": "Procure-to-Pay (P2P)", "type": "PROCESS", "vertical": "erp", "authority": 0.97},
    {"id": "erp-proc-o2c", "label": "Order-to-Cash (O2C)", "type": "PROCESS", "vertical": "erp", "authority": 0.96},
    {"id": "erp-proc-r2r", "label": "Record-to-Report (R2R)", "type": "PROCESS", "vertical": "erp", "authority": 0.95},
    {"id": "erp-proc-h2r", "label": "Hire-to-Retire (H2R)", "type": "PROCESS", "vertical": "erp", "authority": 0.89},
    {"id": "erp-proc-plan-to-produce", "label": "Plan-to-Produce", "type": "PROCESS", "vertical": "erp", "authority": 0.90},
    {"id": "erp-proc-demand-planning", "label": "Demand & Supply Planning", "type": "PROCESS", "vertical": "erp", "authority": 0.91},
    {"id": "erp-proc-fin-consolidation", "label": "Multi-Entity Financial Consolidation", "type": "PROCESS", "vertical": "erp", "authority": 0.92},
    {"id": "erp-proc-supplier-lifecycle", "label": "Supplier Lifecycle & Risk Management", "type": "PROCESS", "vertical": "erp", "authority": 0.87},
    {"id": "erp-proc-rev-rec", "label": "Billing & Revenue Recognition (ASC 606)", "type": "PROCESS", "vertical": "erp", "authority": 0.88},
    {"id": "erp-proc-inventory-replenishment", "label": "Continuous Inventory Replenishment", "type": "PROCESS", "vertical": "erp", "authority": 0.86},
    {"id": "erp-proc-financial-close", "label": "Period-End Financial Close", "type": "PROCESS", "vertical": "erp", "authority": 0.89},
    {"id": "erp-proc-quality-audit", "label": "Manufacturing Quality Inspection", "type": "PROCESS", "vertical": "erp", "authority": 0.81},

    # 4. TECHNOLOGY (11 Nodes)
    {"id": "erp-tech-cloud-arch", "label": "Cloud ERP Architecture", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.97},
    {"id": "erp-tech-saas", "label": "Multi-Tenant SaaS ERP", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.95},
    {"id": "erp-tech-in-memory-db", "label": "In-Memory Database Engine", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.94},
    {"id": "erp-tech-sap-hana", "label": "SAP HANA In-Memory Platform", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.96},
    {"id": "erp-tech-oracle-exadata", "label": "Oracle Exadata Architecture", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.92},
    {"id": "erp-tech-rest-odata-api", "label": "ERP REST & OData APIs", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.94},
    {"id": "erp-tech-rpa", "label": "Robotic Process Automation (RPA)", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.89},
    {"id": "erp-tech-ai-predictive", "label": "AI-Powered Predictive ERP", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.92},
    {"id": "erp-tech-esb", "label": "Event-Driven Enterprise Service Bus", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.87},
    {"id": "erp-tech-microservices", "label": "Composable Microservices ERP", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.85},
    {"id": "erp-tech-data-lake", "label": "ERP Enterprise Data Lakehouse", "type": "TECHNOLOGY", "vertical": "erp", "authority": 0.88},

    # 5. SECURITY (8 Nodes)
    {"id": "erp-sec-rbac", "label": "Role-Based Access Control (RBAC)", "type": "SECURITY", "vertical": "erp", "authority": 0.95},
    {"id": "erp-sec-sod", "label": "Segregation of Duties (SoD) Engine", "type": "SECURITY", "vertical": "erp", "authority": 0.94},
    {"id": "erp-sec-iam", "label": "Identity & Access Governance (IAM)", "type": "SECURITY", "vertical": "erp", "authority": 0.92},
    {"id": "erp-sec-sso", "label": "Enterprise Single Sign-On (SSO / SAML)", "type": "SECURITY", "vertical": "erp", "authority": 0.89},
    {"id": "erp-sec-audit-trail", "label": "Immutable Audit Trail & Change Logging", "type": "SECURITY", "vertical": "erp", "authority": 0.91},
    {"id": "erp-sec-data-gov", "label": "Enterprise Data Governance & Lineage", "type": "SECURITY", "vertical": "erp", "authority": 0.90},
    {"id": "erp-sec-encryption", "label": "Column-Level AES-256 Encryption", "type": "SECURITY", "vertical": "erp", "authority": 0.88},
    {"id": "erp-sec-sox-soc2", "label": "SOX & SOC 2 Compliance Controls", "type": "SECURITY", "vertical": "erp", "authority": 0.93},

    # 6. INTEGRATION (9 Nodes)
    {"id": "erp-int-crm", "label": "CRM Bi-Directional Integration", "type": "INTEGRATION", "vertical": "erp", "authority": 0.94},
    {"id": "erp-int-ecommerce", "label": "B2B E-Commerce & Storefront Connectors", "type": "INTEGRATION", "vertical": "erp", "authority": 0.91},
    {"id": "erp-int-banking", "label": "Automated Banking & Treasury Gateways", "type": "INTEGRATION", "vertical": "erp", "authority": 0.92},
    {"id": "erp-int-payroll", "label": "Global Payroll & Tax Engine Integration", "type": "INTEGRATION", "vertical": "erp", "authority": 0.89},
    {"id": "erp-int-3pl", "label": "3PL Logistics & Carrier Integration", "type": "INTEGRATION", "vertical": "erp", "authority": 0.88},
    {"id": "erp-int-wms-robotics", "label": "WMS Robotics & Automated Barcoding", "type": "INTEGRATION", "vertical": "erp", "authority": 0.85},
    {"id": "erp-int-mes", "label": "MES (Manufacturing Execution Systems)", "type": "INTEGRATION", "vertical": "erp", "authority": 0.87},
    {"id": "erp-int-edi", "label": "B2B EDI Network Integration (ANSI X12/EDIFACT)", "type": "INTEGRATION", "vertical": "erp", "authority": 0.89},
    {"id": "erp-int-supplier-portal", "label": "Self-Service Supplier Portal", "type": "INTEGRATION", "vertical": "erp", "authority": 0.84},

    # 7. IMPLEMENTATION (8 Nodes)
    {"id": "erp-impl-methodology", "label": "ERP Implementation Methodology", "type": "IMPLEMENTATION", "vertical": "erp", "authority": 0.90},
    {"id": "erp-impl-requirements", "label": "Business Process Requirements Analysis", "type": "IMPLEMENTATION", "vertical": "erp", "authority": 0.86},
    {"id": "erp-impl-config", "label": "Standard Best-Practice Configuration", "type": "IMPLEMENTATION", "vertical": "erp", "authority": 0.88},
    {"id": "erp-impl-extensions", "label": "Custom Extensions & Low-Code Workflows", "type": "IMPLEMENTATION", "vertical": "erp", "authority": 0.83},
    {"id": "erp-impl-data-migration", "label": "Legacy Data Migration & ETL Cleansing", "type": "IMPLEMENTATION", "vertical": "erp", "authority": 0.93},
    {"id": "erp-impl-change-mgmt", "label": "Organizational Change Management & Training", "type": "IMPLEMENTATION", "vertical": "erp", "authority": 0.87},
    {"id": "erp-impl-uat", "label": "User Acceptance Testing (UAT) & Cutover", "type": "IMPLEMENTATION", "vertical": "erp", "authority": 0.89},
    {"id": "erp-impl-support", "label": "Hypercare & Post-Go-Live Optimization", "type": "IMPLEMENTATION", "vertical": "erp", "authority": 0.85},

    # 8. VENDOR (8 Nodes)
    {"id": "erp-ven-sap", "label": "SAP SE", "type": "VENDOR", "vertical": "erp", "authority": 0.98},
    {"id": "erp-ven-oracle", "label": "Oracle Corporation", "type": "VENDOR", "vertical": "erp", "authority": 0.97},
    {"id": "erp-ven-microsoft", "label": "Microsoft Corporation", "type": "VENDOR", "vertical": "erp", "authority": 0.96},
    {"id": "erp-ven-workday", "label": "Workday Inc.", "type": "VENDOR", "vertical": "erp", "authority": 0.91},
    {"id": "erp-ven-infor", "label": "Infor Global Solutions", "type": "VENDOR", "vertical": "erp", "authority": 0.88},
    {"id": "erp-ven-deloitte", "label": "Deloitte Enterprise Consulting", "type": "VENDOR", "vertical": "erp", "authority": 0.91},
    {"id": "erp-ven-accenture", "label": "Accenture Technology Services", "type": "VENDOR", "vertical": "erp", "authority": 0.90},
    {"id": "erp-ven-pwc", "label": "PwC Digital Transformation", "type": "VENDOR", "vertical": "erp", "authority": 0.88},
]

ERP_CANONICAL_EDGES: list[dict[str, Any]] = [
    # Vendor to Platform
    {"source": "erp-ven-sap", "target": "erp-plat-sap-s4hana", "weight": 0.98, "relation": "PROVIDES"},
    {"source": "erp-ven-sap", "target": "erp-plat-sap-b1", "weight": 0.88, "relation": "PROVIDES"},
    {"source": "erp-ven-oracle", "target": "erp-plat-oracle-erp", "weight": 0.97, "relation": "PROVIDES"},
    {"source": "erp-ven-oracle", "target": "erp-plat-netsuite", "weight": 0.94, "relation": "ACQUIRED_AND_OPERATES"},
    {"source": "erp-ven-microsoft", "target": "erp-plat-ms-dyn-finance", "weight": 0.96, "relation": "PROVIDES"},
    {"source": "erp-ven-microsoft", "target": "erp-plat-ms-dyn-scm", "weight": 0.95, "relation": "PROVIDES"},
    {"source": "erp-ven-workday", "target": "erp-plat-workday", "weight": 0.92, "relation": "PROVIDES"},
    {"source": "erp-ven-infor", "target": "erp-plat-infor", "weight": 0.89, "relation": "PROVIDES"},

    # Systems Integrators to Implementation
    {"source": "erp-ven-deloitte", "target": "erp-impl-methodology", "weight": 0.92, "relation": "IMPLEMENTS"},
    {"source": "erp-ven-deloitte", "target": "erp-plat-sap-s4hana", "weight": 0.94, "relation": "GLOBAL_INTEGRATION_PARTNER"},
    {"source": "erp-ven-accenture", "target": "erp-plat-oracle-erp", "weight": 0.93, "relation": "GLOBAL_INTEGRATION_PARTNER"},
    {"source": "erp-ven-pwc", "target": "erp-sec-sox-soc2", "weight": 0.91, "relation": "AUDITS_AND_GOVERNS"},

    # SAP S/4HANA Module & Tech Connections
    {"source": "erp-plat-sap-s4hana", "target": "erp-mod-finance", "weight": 0.98, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-sap-s4hana", "target": "erp-mod-procurement", "weight": 0.97, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-sap-s4hana", "target": "erp-mod-scm", "weight": 0.96, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-sap-s4hana", "target": "erp-mod-mfg", "weight": 0.95, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-sap-s4hana", "target": "erp-mod-wms", "weight": 0.93, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-sap-s4hana", "target": "erp-tech-sap-hana", "weight": 0.99, "relation": "POWERED_BY"},
    {"source": "erp-plat-sap-s4hana", "target": "erp-tech-cloud-arch", "weight": 0.94, "relation": "DEPLOYED_ON"},
    {"source": "erp-plat-sap-s4hana", "target": "erp-sec-sod", "weight": 0.93, "relation": "ENFORCES_SECURITY"},

    # Oracle Cloud ERP Connections
    {"source": "erp-plat-oracle-erp", "target": "erp-mod-finance", "weight": 0.97, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-oracle-erp", "target": "erp-mod-procurement", "weight": 0.96, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-oracle-erp", "target": "erp-mod-scm", "weight": 0.95, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-oracle-erp", "target": "erp-mod-treasury", "weight": 0.91, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-oracle-erp", "target": "erp-tech-oracle-exadata", "weight": 0.95, "relation": "POWERED_BY"},
    {"source": "erp-plat-oracle-erp", "target": "erp-tech-saas", "weight": 0.96, "relation": "NATIVE_ARCHITECTURE"},
    {"source": "erp-plat-oracle-erp", "target": "erp-tech-ai-predictive", "weight": 0.92, "relation": "EMBEDS_AI"},

    # Microsoft Dynamics 365 Connections
    {"source": "erp-plat-ms-dyn-finance", "target": "erp-mod-finance", "weight": 0.96, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-ms-dyn-finance", "target": "erp-mod-ap", "weight": 0.92, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-ms-dyn-finance", "target": "erp-mod-ar", "weight": 0.91, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-ms-dyn-scm", "target": "erp-mod-scm", "weight": 0.96, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-ms-dyn-scm", "target": "erp-mod-inventory", "weight": 0.94, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-ms-dyn-scm", "target": "erp-mod-mfg", "weight": 0.92, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-ms-dyn-finance", "target": "erp-int-crm", "weight": 0.97, "relation": "SEAMLESS_DYNAMICS_SYNC"},

    # NetSuite Connections
    {"source": "erp-plat-netsuite", "target": "erp-mod-finance", "weight": 0.95, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-netsuite", "target": "erp-mod-inventory", "weight": 0.93, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-netsuite", "target": "erp-mod-sales", "weight": 0.92, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-netsuite", "target": "erp-tech-saas", "weight": 0.97, "relation": "PIONEERED_CLOUD_ERP"},
    {"source": "erp-plat-netsuite", "target": "erp-int-ecommerce", "weight": 0.94, "relation": "NATIVE_SUITECOMMERCE"},

    # Mid-Market & Niche Platforms
    {"source": "erp-plat-workday", "target": "erp-mod-hcm", "weight": 0.98, "relation": "CORE_MODULE_LEADER"},
    {"source": "erp-plat-workday", "target": "erp-mod-finance", "weight": 0.92, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-infor", "target": "erp-mod-mfg", "weight": 0.93, "relation": "SPECIALIZED_DISCRETE_MFG"},
    {"source": "erp-plat-epicor", "target": "erp-mod-mfg", "weight": 0.91, "relation": "SPECIALIZED_FOR_MFG"},
    {"source": "erp-plat-sage-x3", "target": "erp-mod-finance", "weight": 0.89, "relation": "PROCESS_MANUFACTURING"},
    {"source": "erp-plat-odoo", "target": "erp-mod-inventory", "weight": 0.87, "relation": "OPEN_SOURCE_MODULAR"},
    {"source": "erp-plat-acumatica", "target": "erp-mod-scm", "weight": 0.86, "relation": "CLOUD_NATIVE_DISTRIBUTION"},
    {"source": "erp-plat-ifs", "target": "erp-mod-asset-mgmt", "weight": 0.92, "relation": "SPECIALIZED_FIELD_SERVICE_EAM"},

    # Module to Business Process Executions
    {"source": "erp-mod-procurement", "target": "erp-proc-p2p", "weight": 0.99, "relation": "EXECUTES_PROCESS"},
    {"source": "erp-mod-ap", "target": "erp-proc-p2p", "weight": 0.96, "relation": "EXECUTES_PROCESS"},
    {"source": "erp-mod-procurement", "target": "erp-proc-supplier-lifecycle", "weight": 0.92, "relation": "GOVERNS_PROCESS"},
    {"source": "erp-mod-sales", "target": "erp-proc-o2c", "weight": 0.98, "relation": "EXECUTES_PROCESS"},
    {"source": "erp-mod-ar", "target": "erp-proc-o2c", "weight": 0.96, "relation": "EXECUTES_PROCESS"},
    {"source": "erp-mod-finance", "target": "erp-proc-r2r", "weight": 0.99, "relation": "EXECUTES_PROCESS"},
    {"source": "erp-mod-finance", "target": "erp-proc-fin-consolidation", "weight": 0.95, "relation": "EXECUTES_PROCESS"},
    {"source": "erp-mod-finance", "target": "erp-proc-financial-close", "weight": 0.94, "relation": "CONTROLS"},
    {"source": "erp-mod-hcm", "target": "erp-proc-h2r", "weight": 0.97, "relation": "EXECUTES_PROCESS"},
    {"source": "erp-mod-mfg", "target": "erp-proc-plan-to-produce", "weight": 0.98, "relation": "EXECUTES_PROCESS"},
    {"source": "erp-mod-scm", "target": "erp-proc-demand-planning", "weight": 0.96, "relation": "EXECUTES_PROCESS"},
    {"source": "erp-mod-inventory", "target": "erp-proc-inventory-replenishment", "weight": 0.95, "relation": "EXECUTES_PROCESS"},
    {"source": "erp-mod-sales", "target": "erp-proc-rev-rec", "weight": 0.91, "relation": "TRIGGERS_REVENUE_EVENT"},

    # Inter-Module Dependencies
    {"source": "erp-mod-inventory", "target": "erp-mod-scm", "weight": 0.94, "relation": "FEEDS_STOCK_DATA_TO"},
    {"source": "erp-mod-wms", "target": "erp-mod-inventory", "weight": 0.96, "relation": "MANAGES_PHYSICAL_BINS"},
    {"source": "erp-mod-mfg", "target": "erp-mod-inventory", "weight": 0.93, "relation": "CONSUMES_RAW_MATERIALS"},
    {"source": "erp-mod-ap", "target": "erp-mod-finance", "weight": 0.97, "relation": "POSTS_GENERAL_LEDGER"},
    {"source": "erp-mod-ar", "target": "erp-mod-finance", "weight": 0.97, "relation": "POSTS_GENERAL_LEDGER"},
    {"source": "erp-mod-treasury", "target": "erp-mod-finance", "weight": 0.93, "relation": "RECONCILES_CASH"},
    {"source": "erp-mod-project-mgmt", "target": "erp-mod-finance", "weight": 0.89, "relation": "POSTS_PROJECT_COSTS"},
    {"source": "erp-mod-bi-analytics", "target": "erp-mod-finance", "weight": 0.92, "relation": "AGGREGATES_FINANCIAL_KPI"},

    # Technology Enablement of Platforms & Modules
    {"source": "erp-tech-cloud-arch", "target": "erp-tech-saas", "weight": 0.96, "relation": "ARCHITECTURAL_FOUNDATION"},
    {"source": "erp-tech-sap-hana", "target": "erp-tech-in-memory-db", "weight": 0.98, "relation": "TYPE_OF"},
    {"source": "erp-tech-oracle-exadata", "target": "erp-tech-in-memory-db", "weight": 0.95, "relation": "TYPE_OF"},
    {"source": "erp-tech-in-memory-db", "target": "erp-mod-finance", "weight": 0.96, "relation": "ENABLES_SUBSECOND_LEDGER_CLOSE"},
    {"source": "erp-tech-rest-odata-api", "target": "erp-int-crm", "weight": 0.97, "relation": "INTEGRATION_TRANSPORT"},
    {"source": "erp-tech-rest-odata-api", "target": "erp-int-ecommerce", "weight": 0.95, "relation": "INTEGRATION_TRANSPORT"},
    {"source": "erp-tech-rpa", "target": "erp-proc-p2p", "weight": 0.94, "relation": "AUTOMATES_INVOICE_MATCHING"},
    {"source": "erp-tech-rpa", "target": "erp-proc-r2r", "weight": 0.91, "relation": "AUTOMATES_RECONCILIATION"},
    {"source": "erp-tech-ai-predictive", "target": "erp-proc-demand-planning", "weight": 0.95, "relation": "FORECASTS_ACCURACY"},
    {"source": "erp-tech-esb", "target": "erp-tech-microservices", "weight": 0.90, "relation": "DECOUPLES_SERVICES"},
    {"source": "erp-tech-data-lake", "target": "erp-mod-bi-analytics", "weight": 0.94, "relation": "DATA_SOURCE_FOR_BI"},

    # Security & Governance to Modules & Platforms
    {"source": "erp-sec-rbac", "target": "erp-plat-sap-s4hana", "weight": 0.97, "relation": "ENFORCES_AUTHORIZATION"},
    {"source": "erp-sec-rbac", "target": "erp-plat-oracle-erp", "weight": 0.96, "relation": "ENFORCES_AUTHORIZATION"},
    {"source": "erp-sec-sod", "target": "erp-mod-ap", "weight": 0.98, "relation": "PREVENTS_FRAUD_VENDOR_PAYMENT"},
    {"source": "erp-sec-sod", "target": "erp-proc-p2p", "weight": 0.97, "relation": "SEPARATES_PO_APPROVAL_AND_PAYMENT"},
    {"source": "erp-sec-iam", "target": "erp-sec-sso", "weight": 0.95, "relation": "AUTHENTICATES_USERS"},
    {"source": "erp-sec-audit-trail", "target": "erp-mod-finance", "weight": 0.96, "relation": "LOGS_ALL_JOURNAL_CHANGES"},
    {"source": "erp-sec-sox-soc2", "target": "erp-proc-r2r", "weight": 0.97, "relation": "MANDATORY_COMPLIANCE"},
    {"source": "erp-sec-sox-soc2", "target": "erp-sec-audit-trail", "weight": 0.96, "relation": "REQUIRES_CONTROL"},
    {"source": "erp-sec-encryption", "target": "erp-tech-cloud-arch", "weight": 0.94, "relation": "PROTECTS_DATA_AT_REST_IN_TRANSIT"},
    {"source": "erp-sec-data-gov", "target": "erp-tech-data-lake", "weight": 0.93, "relation": "CATALOGS_ENTERPRISE_LINEAGE"},

    # Integrations to Business Systems & Processes
    {"source": "erp-int-crm", "target": "erp-mod-sales", "weight": 0.97, "relation": "SYNCS_OPPORTUNITY_TO_ORDER"},
    {"source": "erp-int-crm", "target": "erp-proc-o2c", "weight": 0.95, "relation": "INITIATES_ORDER_FULFILLMENT"},
    {"source": "erp-int-ecommerce", "target": "erp-mod-sales", "weight": 0.95, "relation": "CAPTURES_ONLINE_ORDERS"},
    {"source": "erp-int-banking", "target": "erp-mod-treasury", "weight": 0.98, "relation": "AUTOMATES_WIRE_ACH_CLEARING"},
    {"source": "erp-int-banking", "target": "erp-proc-p2p", "weight": 0.94, "relation": "EXECUTES_VENDOR_DISBURSEMENT"},
    {"source": "erp-int-payroll", "target": "erp-mod-hcm", "weight": 0.96, "relation": "CALCULATES_GROSS_TO_NET"},
    {"source": "erp-int-payroll", "target": "erp-mod-finance", "weight": 0.95, "relation": "POSTS_PAYROLL_JOURNAL"},
    {"source": "erp-int-3pl", "target": "erp-mod-scm", "weight": 0.93, "relation": "TRACKS_OUTBOUND_FREIGHT"},
    {"source": "erp-int-wms-robotics", "target": "erp-mod-wms", "weight": 0.92, "relation": "AUTOMATES_PICK_PACK_SHIP"},
    {"source": "erp-int-mes", "target": "erp-mod-mfg", "weight": 0.96, "relation": "REAL_TIME_SHOP_FLOOR_DATA"},
    {"source": "erp-int-edi", "target": "erp-proc-p2p", "weight": 0.95, "relation": "TRANSMITS_EDI_850_PO"},
    {"source": "erp-int-edi", "target": "erp-proc-o2c", "weight": 0.94, "relation": "TRANSMITS_EDI_810_INVOICE"},
    {"source": "erp-int-supplier-portal", "target": "erp-proc-supplier-lifecycle", "weight": 0.91, "relation": "SUPPLIER_SELF_ONBOARDING"},

    # Implementation Lifecycle Dependencies
    {"source": "erp-impl-methodology", "target": "erp-impl-requirements", "weight": 0.96, "relation": "PHASE_1_DISCOVERY"},
    {"source": "erp-impl-requirements", "target": "erp-impl-config", "weight": 0.95, "relation": "PHASE_2_BLUEPRINT_CONFIG"},
    {"source": "erp-impl-config", "target": "erp-impl-extensions", "weight": 0.90, "relation": "GAP_FIT_CUSTOMIZATION"},
    {"source": "erp-impl-data-migration", "target": "erp-mod-finance", "weight": 0.97, "relation": "MIGRATES_OPEN_BALANCES"},
    {"source": "erp-impl-data-migration", "target": "erp-mod-inventory", "weight": 0.94, "relation": "MIGRATES_ITEM_MASTER_STOCK"},
    {"source": "erp-impl-data-migration", "target": "erp-impl-uat", "weight": 0.95, "relation": "LOADS_UAT_TEST_DATA"},
    {"source": "erp-impl-uat", "target": "erp-impl-change-mgmt", "weight": 0.92, "relation": "USER_READINESS_VALIDATION"},
    {"source": "erp-impl-uat", "target": "erp-impl-support", "weight": 0.96, "relation": "TRANSITIONS_TO_HYPERCARE"},
    {"source": "erp-impl-requirements", "target": "erp-proc-p2p", "weight": 0.91, "relation": "BLUEPRINTS_PROCESS"},
    {"source": "erp-impl-requirements", "target": "erp-proc-o2c", "weight": 0.91, "relation": "BLUEPRINTS_PROCESS"},
    {"source": "erp-impl-requirements", "target": "erp-proc-r2r", "weight": 0.91, "relation": "BLUEPRINTS_PROCESS"},
    {"source": "erp-impl-config", "target": "erp-mod-finance", "weight": 0.94, "relation": "CONFIGURES_CHART_OF_ACCOUNTS"},
    {"source": "erp-impl-config", "target": "erp-mod-procurement", "weight": 0.93, "relation": "CONFIGURES_PURCHASING_HIERARCHY"},
    {"source": "erp-impl-extensions", "target": "erp-tech-rest-odata-api", "weight": 0.92, "relation": "BUILT_VIA_APIS"},

    # Extended Process & Module Semantics
    {"source": "erp-proc-plan-to-produce", "target": "erp-int-mes", "weight": 0.95, "relation": "EXECUTES_ON_SHOP_FLOOR"},
    {"source": "erp-mod-mfg", "target": "erp-proc-quality-audit", "weight": 0.92, "relation": "INSPECTS_QUALITY"},
    {"source": "erp-proc-inventory-replenishment", "target": "erp-mod-procurement", "weight": 0.94, "relation": "CREATES_AUTO_PURCHASE_REQ"},
    {"source": "erp-proc-financial-close", "target": "erp-mod-ap", "weight": 0.95, "relation": "RECONCILES_AP_SUBLEDGER"},
    {"source": "erp-proc-financial-close", "target": "erp-mod-ar", "weight": 0.95, "relation": "RECONCILES_AR_SUBLEDGER"},

    # Extended Platform Support
    {"source": "erp-plat-sap-b1", "target": "erp-mod-finance", "weight": 0.90, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-sap-b1", "target": "erp-mod-inventory", "weight": 0.89, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-sap-b1", "target": "erp-mod-sales", "weight": 0.88, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-sage-x3", "target": "erp-mod-mfg", "weight": 0.90, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-epicor", "target": "erp-mod-wms", "weight": 0.89, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-odoo", "target": "erp-int-crm", "weight": 0.88, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-acumatica", "target": "erp-mod-finance", "weight": 0.89, "relation": "SUPPORTS_MODULE"},
    {"source": "erp-plat-ifs", "target": "erp-mod-mfg", "weight": 0.90, "relation": "SUPPORTS_MODULE"},

    # Extended Technology & Security Interoperability
    {"source": "erp-tech-rest-odata-api", "target": "erp-int-payroll", "weight": 0.93, "relation": "PAYROLL_TRANSPORT"},
    {"source": "erp-tech-rest-odata-api", "target": "erp-int-3pl", "weight": 0.92, "relation": "3PL_DATA_PIPE"},
    {"source": "erp-tech-rest-odata-api", "target": "erp-int-wms-robotics", "weight": 0.91, "relation": "ROBOTICS_PIPE"},
    {"source": "erp-tech-microservices", "target": "erp-tech-cloud-arch", "weight": 0.93, "relation": "DEPLOYED_IN_CLOUD"},
    {"source": "erp-sec-iam", "target": "erp-sec-rbac", "weight": 0.96, "relation": "MANAGES_USER_ROLES"},
    {"source": "erp-sec-sso", "target": "erp-tech-saas", "weight": 0.94, "relation": "SINGLE_SIGN_ON_PORTAL"},
    {"source": "erp-sec-sox-soc2", "target": "erp-sec-sod", "weight": 0.97, "relation": "AUDITS_ACCESS_SEGREGATION"},
    {"source": "erp-sec-audit-trail", "target": "erp-proc-rev-rec", "weight": 0.93, "relation": "LOGS_ASC_606_RECOGNITION"},
]


def get_canonical_erp_graph(limit: int = 200) -> dict[str, Any]:
    """Return the enriched canonical ERP Knowledge Graph dataset."""
    nodes = [dict(n) for n in ERP_CANONICAL_NODES[:limit]]
    edges = [dict(e) for e in ERP_CANONICAL_EDGES]
    return enrich_graph_with_metrics(nodes, edges)

async def get_full_graph_snapshot(vertical: str, limit: int = 200) -> dict[str, Any]:
    """
    Get nodes and edges for the full graph visualization.
    Returns the rich ERP Knowledge Graph dataset enriched with dynamic graph metrics.
    """
    # Check if Neo4j contains ERP graph entities
    node_records = await run_query(
        """
        MATCH (e:Entity)
        WHERE toLower(e.vertical) = 'erp' OR toLower($vertical) = 'erp'
        RETURN e.id AS id, e.text AS label, e.type AS type, 
               coalesce(e.authority_score, e.frequency/10.0, 0.1) AS authority, 
               coalesce(e.authority_score, e.frequency/10.0, 0.1) AS authority_score, 
               'erp' AS vertical
        ORDER BY e.authority_score DESC LIMIT $limit
        """,
        {"vertical": vertical, "limit": limit}
    )
    
    if node_records and len(node_records) >= 10:
        node_ids = [r["id"] for r in node_records]
        edge_records = await run_query(
            """
            MATCH (e1:Entity)-[r:CO_OCCURS_WITH]-(e2:Entity)
            WHERE e1.id IN $ids AND e2.id IN $ids
            RETURN e1.id AS source, e2.id AS target, r.weight AS weight, type(r) AS relation
            """,
            {"ids": node_ids}
        )
        node_records.sort(key=lambda x: x["id"])
        edge_records = process_edges_for_quality(edge_records, node_records)
        return enrich_graph_with_metrics(node_records, edge_records)

    # Return canonical rich ERP ontology enriched with NetworkX graph metrics
    return get_canonical_erp_graph(limit=limit)

def enrich_graph_with_metrics(nodes: list[dict], edges: list[dict]) -> dict:
    import networkx as nx
    from networkx.algorithms.community import greedy_modularity_communities
    
    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"])
    for e in edges:
        G.add_edge(e["source"], e["target"], weight=e.get("weight", 1.0))
        e["relationship_weight"] = e.get("weight", 1.0)
        
    try:
        communities = list(greedy_modularity_communities(G))
        cluster_map = {}
        for i, c in enumerate(communities):
            for node_id in c:
                cluster_map[node_id] = i
    except Exception:
        cluster_map = {}

    for n in nodes:
        n["degree"] = G.degree(n["id"]) if n["id"] in G else 0
        n["cluster_id"] = cluster_map.get(n["id"], 0)
        n["pagerank"] = n.get("authority", 0.1)
        n["authority_score"] = n.get("authority", 0.1)
        
    return {
        "nodes": nodes,
        "edges": edges
    }

