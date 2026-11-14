"""CLI admission regressions using isolated copies of the planning tree."""
from __future__ import annotations

import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest


REPO = pathlib.Path(__file__).resolve().parents[1]
PYTHON = sys.executable
GENERATED = (
    "README.md", "planning/README.md", "planning/project-backlog.json",
    "planning/metric-backlog-coverage.json", "planning/concept.json",
    "planning/ui/ui-backlog-coverage.json", "docs/ARCHITECTURE.md", "docs/DELIVERY_PLAN.md",
    "docs/GOVERNANCE.md", "docs/INGESTION.md", "docs/METRICS.md", "docs/OPERATIONS_PLAN.md",
    "docs/PRODUCT.md", "docs/SOURCE_AUDIT.md", "docs/UI.md",
)


def snapshot(root: pathlib.Path) -> dict[str, str]:
    paths = [*root.joinpath("planning").rglob("*"), *root.joinpath("docs").rglob("*"), root / "README.md"]
    return {
        str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in paths if path.is_file()
    }


class PlanningCliJsonTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name) / "repo"
        shutil.copytree(REPO, self.root, ignore=shutil.ignore_patterns(".git", "__pycache__", "node_modules"))

    def tearDown(self):
        self.temp.cleanup()

    def run_cli(self, script: str, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [PYTHON, f"scripts/{script}.py", *args], cwd=self.root, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
        )

    def invalid_input_preserves_tree(self, script: str, path: str, payload: str, *args: str):
        target = self.root / "planning" / path
        target.write_text(payload, encoding="utf-8")
        before = snapshot(self.root)
        result = self.run_cli(script, *args)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("Invalid planning JSON", result.stderr)
        self.assertEqual(snapshot(self.root), before)

    def test_sync_rejects_duplicate_members_before_any_write_and_recovers(self):
        path = "project-backlog.json"
        original = (self.root / "planning" / path).read_text(encoding="utf-8")
        self.invalid_input_preserves_tree("sync_baseline", path, original.replace("{", '{"synthetic": 1, "synt\\u0068etic": 2, ', 1))
        (self.root / "planning" / path).write_text(original, encoding="utf-8")
        self.assertEqual(self.run_cli("sync_baseline").returncode, 0)

    def test_sync_rejects_late_nonfinite_number_before_any_write(self):
        path = "ui/ui-backlog-coverage.json"
        original = (self.root / "planning" / path).read_text(encoding="utf-8")
        for token in ("NaN", "Infinity", "-Infinity", "1e999"):
            with self.subTest(token=token):
                self.invalid_input_preserves_tree("sync_baseline", path, original.replace("{", f'{{"synthetic": {token}, ', 1))

    def test_render_rejects_duplicate_and_nonfinite_inputs_before_generated_write(self):
        path = "source-audit.json"
        target = self.root / "planning" / path
        original = target.read_text(encoding="utf-8")
        self.invalid_input_preserves_tree("render_docs", path, original.replace("{", '{"synthetic": 1, "synthetic": 2, ', 1))
        for token in ("NaN", "Infinity", "-Infinity", "1e999"):
            with self.subTest(token=token):
                self.invalid_input_preserves_tree("render_docs", path, original.replace("{", f'{{"synthetic": {token}, ', 1))
        target.write_text(original, encoding="utf-8")
        self.assertEqual(self.run_cli("render_docs", "--check").returncode, 0)

    def test_render_rejects_late_publication_json_before_any_write(self):
        path = self.root / "docs" / "PUBLICATION.json"
        original = path.read_text(encoding="utf-8")
        path.write_text(original.replace("{", '{"synthetic": "x", "synthetic": "y", ', 1), encoding="utf-8")
        before = snapshot(self.root)
        result = self.run_cli("render_docs")
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("Invalid planning JSON", result.stderr)
        self.assertEqual(snapshot(self.root), before)
        path.write_text(original, encoding="utf-8")
        self.assertEqual(self.run_cli("render_docs", "--check").returncode, 0)

    def test_valid_generation_keeps_all_checked_in_output_bytes(self):
        expected = {name: (self.root / name).read_bytes() for name in GENERATED}
        sync = self.run_cli("sync_baseline")
        self.assertEqual(sync.returncode, 0, sync.stderr)
        render = self.run_cli("render_docs")
        self.assertEqual(render.returncode, 0, render.stderr)
        self.assertEqual({name: (self.root / name).read_bytes() for name in GENERATED}, expected)
        validate = self.run_cli("validate_plan")
        self.assertEqual(validate.returncode, 0, validate.stderr)
        self.assertIn("474 tasks", validate.stdout)
        self.assertIn("98 metrics", validate.stdout)

    def test_sync_preserves_finite_and_string_json_values(self):
        path = self.root / "planning" / "ui/ui-backlog-coverage.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        expected = {
            "finite": 1.25, "large_integer": 9007199254740993,
            "numeric_string": "00123", "unicode": "Café ☃",
        }
        payload["cli_compatibility_fixture"] = expected
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result = self.run_cli("sync_baseline")
        self.assertEqual(result.returncode, 0, result.stderr)
        written = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(written["cli_compatibility_fixture"], expected)


if __name__ == "__main__":
    unittest.main()
