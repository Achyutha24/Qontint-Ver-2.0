import sys
import os
import asyncio
import json
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.serp_intel.semantic_baseline import _build_semantic_baseline, SemanticBaseline
from services.serp_intel.knowledge_gap_engine import KnowledgeGapEngine

class TestSemanticBaselineF3(unittest.TestCase):
    def test_baseline_structure(self):
        keyword = "Cloud Security"
        pages = [
            {"domain": "leader-hub.com", "body_content": "Cloud Security CSPM architecture and zero trust framework.", "google_position": 1},
            {"domain": "comparison-hub.org", "body_content": "Cloud Security SaaS access and CASB compliance policies.", "google_position": 2}
        ]
        profiles = [
            {"domain": "leader-hub.com", "primary_entities": ["Cloud Security", "CSPM"], "supporting_entities": ["Zero Trust"], "_raw_entities": [{"text": "CSPM", "entity_type": "TECHNOLOGY"}], "_headings": ["Cloud Security Architecture"]},
            {"domain": "comparison-hub.org", "primary_entities": ["Cloud Security", "CASB"], "supporting_entities": ["Compliance"], "_raw_entities": [{"text": "CASB", "entity_type": "TECHNOLOGY"}], "_headings": ["SaaS Access Controls"]}
        ]

        sb = SemanticBaseline(keyword, pages, profiles)
        sb_dict = sb.to_dict()

        # 1. Verify entities exist
        self.assertIn("entities", sb_dict)
        self.assertTrue(len(sb_dict["entities"]) > 0)

        # 2. Verify competitor_mapping exists
        self.assertIn("competitor_mapping", sb_dict)
        self.assertIn("leader-hub.com", sb_dict["competitor_mapping"])

        # 3. Verify top-level dict returned by _build_semantic_baseline
        baseline_res = _build_semantic_baseline(keyword, pages, profiles)
        self.assertIn("entities", baseline_res)
        self.assertIn("topic_clusters", baseline_res)
        self.assertIn("competitor_mapping", baseline_res)

        # 4. Verify KnowledgeGapEngine competitor inventories are populated
        engine = KnowledgeGapEngine(keyword, sb_dict, pages)
        self.assertEqual(len(engine.comp_inventories), 2)
        self.assertTrue(len(engine.comp_inventories[0]["concepts"]) > 0)

        # 5. Verify Information Gain output
        res = engine.analyze()
        info_gain = res["information_gain"]
        self.assertTrue(len(info_gain["unique_topics"]) > 0 or len(info_gain["differentiation_opportunities"]) > 0)
        self.assertTrue(len(info_gain["consensus_topics"]) > 0 or len(info_gain["matrix"]) > 0)

if __name__ == "__main__":
    unittest.main()
