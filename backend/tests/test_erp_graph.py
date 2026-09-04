import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.relationships import get_full_graph_snapshot, get_canonical_erp_graph, ERP_CANONICAL_NODES, ERP_CANONICAL_EDGES

async def test_erp_graph():
    print("Testing ERP Graph Snapshot and Ontology...")
    
    # 1. Test canonical ERP dataset
    assert len(ERP_CANONICAL_NODES) >= 50, f"Expected >= 50 nodes, got {len(ERP_CANONICAL_NODES)}"
    assert len(ERP_CANONICAL_EDGES) >= 120, f"Expected >= 120 edges, got {len(ERP_CANONICAL_EDGES)}"
    
    # 2. Check categories
    types = set(n["type"] for n in ERP_CANONICAL_NODES)
    expected_types = {"PLATFORM", "MODULE", "PROCESS", "TECHNOLOGY", "SECURITY", "INTEGRATION", "IMPLEMENTATION", "VENDOR"}
    assert expected_types.issubset(types), f"Missing categories: {expected_types - types}"
    
    # 3. Check for specific ERP concepts
    labels = [n["label"] for n in ERP_CANONICAL_NODES]
    assert "SAP S/4HANA" in labels
    assert "Oracle Cloud ERP" in labels
    assert "Microsoft Dynamics 365 Finance" in labels
    assert "NetSuite ERP" in labels
    assert "Procurement & Sourcing" in labels
    assert "Procure-to-Pay (P2P)" in labels
    assert "Order-to-Cash (O2C)" in labels
    assert "Cloud ERP Architecture" in labels
    assert "Role-Based Access Control (RBAC)" in labels
    assert "Segregation of Duties (SoD) Engine" in labels
    
    # 4. Check that NO old generic fintech concepts exist in canonical ERP nodes
    for forbidden in ["OAuth 2.0 Security", "PCI DSS 4.0 Standard", "Stripe Payments", "Adyen Enterprise", "Sub-Second Latency"]:
        assert forbidden not in labels, f"Found forbidden old entity: {forbidden}"
        
    # 5. Test snapshot calculation
    snapshot = await get_full_graph_snapshot(vertical="erp", limit=200)
    assert "nodes" in snapshot
    assert "edges" in snapshot
    assert len(snapshot["nodes"]) >= 50
    assert len(snapshot["edges"]) >= 120
    
    # Verify NetworkX enrichment
    first_node = snapshot["nodes"][0]
    assert "degree" in first_node
    assert "cluster_id" in first_node
    assert "authority_score" in first_node
    
    print(f"SUCCESS: ERP Graph contains {len(snapshot['nodes'])} nodes and {len(snapshot['edges'])} edges across {len(types)} categories.")
    print("ALL ERP GRAPH ASSERTIONS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_erp_graph())
