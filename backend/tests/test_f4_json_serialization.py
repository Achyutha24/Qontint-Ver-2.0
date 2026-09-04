import sys
import os
import asyncio
import json
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db.postgres import AsyncSessionLocal
from services.serp_intel_service import run_serp_intelligence
from services.unified_analysis import run_unified_analysis
from services.serp_intel.utils import make_json_serializable

class TestF4JsonSerialization(unittest.TestCase):

    def _assert_no_sets_recursive(self, obj, path="root"):
        self.assertNotIsInstance(
            obj, set, f"Found non-serializable set object at path: '{path}'"
        )
        if isinstance(obj, dict):
            for k, v in obj.items():
                self._assert_no_sets_recursive(v, path=f"{path}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                self._assert_no_sets_recursive(v, path=f"{path}[{i}]")

    def test_run_serp_intelligence_serialization(self):
        async def _run():
            async with AsyncSessionLocal() as db:
                for kw in ["Cloud Security", "CRM Software", "SAP AI"]:
                    res = await run_serp_intelligence(keyword=kw, db=db, force_refresh=False)
                    self._assert_no_sets_recursive(res)
                    # Verify json.dumps works without throwing TypeError
                    serialized = json.dumps(res)
                    self.assertTrue(len(serialized) > 100)

        asyncio.run(_run())

    def test_run_unified_analysis_serialization(self):
        async def _run():
            async with AsyncSessionLocal() as db:
                for kw in ["Cloud Security", "CRM Software", "SAP AI"]:
                    res = await run_unified_analysis(keyword=kw, db=db)
                    self._assert_no_sets_recursive(res)
                    serialized = json.dumps(res)
                    self.assertTrue(len(serialized) > 100)

        asyncio.run(_run())

if __name__ == "__main__":
    unittest.main()
