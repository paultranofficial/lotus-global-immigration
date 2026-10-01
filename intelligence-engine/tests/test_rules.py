import tempfile
import unittest
from datetime import date
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from onestep_engine.db import (
    apply_migrations,
    connect,
    export_policy_context,
    list_countries,
    list_sources,
    seed_database,
)
from onestep_engine.rules import detect_policy_conflicts, find_applicable_rules


class RuleEngineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".sqlite")
        self.conn = connect(self.tmp.name)
        apply_migrations(self.conn)
        seed_database(self.conn)

    def tearDown(self):
        self.conn.close()
        self.tmp.close()

    def test_finds_effective_rule_with_citation(self):
        matches = find_applicable_rules(
            self.conn,
            jurisdiction="AU",
            applicant_scope="student_visa_primary",
            as_of=date(2026, 10, 1),
            module="visa",
        )

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].rule.id, "AU-VISA-GS-2024-03-23")
        self.assertEqual(matches[0].citation.authority, "Australian Department of Home Affairs")

    def test_filters_rules_before_effective_date(self):
        matches = find_applicable_rules(
            self.conn,
            jurisdiction="FR",
            applicant_scope="student_visa_primary",
            as_of=date(2026, 7, 31),
        )

        self.assertEqual(matches, [])

    def test_module_filter(self):
        matches = find_applicable_rules(
            self.conn,
            jurisdiction="UK",
            applicant_scope="student_visa_primary",
            as_of=date(2026, 10, 1),
            module="finance",
        )

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].rule.payload["inside_london_per_month"], 1529)

    def test_finds_new_work_rights_rules(self):
        matches = find_applicable_rules(
            self.conn,
            jurisdiction="CA",
            applicant_scope="study_permit_primary",
            as_of=date(2026, 10, 1),
            module="work_rights",
        )

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].rule.id, "CA-WORK-OFF-CAMPUS-24H-WEEK")
        self.assertIn("24 hours", matches[0].rule.payload["limit"])

    def test_no_conflict_for_seed_rules(self):
        matches = find_applicable_rules(
            self.conn,
            jurisdiction="UK",
            applicant_scope="student_visa_primary",
            as_of=date(2026, 10, 1),
        )

        self.assertEqual(detect_policy_conflicts(matches), [])

    def test_exports_agent_policy_context(self):
        context = export_policy_context(self.conn, jurisdiction="UK", module="finance")

        self.assertEqual(len(context["rules"]), 1)
        self.assertEqual(context["rules"][0]["provenance"]["source_authority"], "UK Visas and Immigration")

    def test_lists_taxonomy_and_sources(self):
        countries = list_countries(self.conn)
        sources = list_sources(self.conn, jurisdiction="AU")

        self.assertTrue(any(country["code"] == "AU" for country in countries))
        self.assertEqual(sources[0]["authority"], "Australian Department of Home Affairs")


if __name__ == "__main__":
    unittest.main()
