from __future__ import annotations

from dataclasses import asdict
from datetime import date
import os
from pathlib import Path

from .db import (
    apply_migrations,
    connect,
    export_policy_context,
    list_countries,
    list_sources,
    seed_database,
)
from .rules import detect_policy_conflicts, find_applicable_rules

DB_PATH = Path(os.environ.get("ONESTEP_ENGINE_DB", "work/onestep_engine.sqlite"))


def ensure_database() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(DB_PATH)
    apply_migrations(conn)
    seed_database(conn)
    conn.close()


try:
    from fastapi import FastAPI, Query
except ImportError:  # pragma: no cover
    FastAPI = None
    Query = None


if FastAPI:
    app = FastAPI(title="OneStep Education & Migration Intelligence Engine")

    @app.on_event("startup")
    def startup() -> None:
        ensure_database()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/v1/countries")
    def countries() -> dict[str, object]:
        conn = connect(DB_PATH)
        return {"countries": list_countries(conn)}

    @app.get("/v1/sources")
    def sources(jurisdiction: str | None = None) -> dict[str, object]:
        conn = connect(DB_PATH)
        return {"sources": list_sources(conn, jurisdiction=jurisdiction)}

    @app.get("/v1/policy/export")
    def policy_export(
        jurisdiction: str | None = None,
        module: str | None = Query(default=None),
    ) -> dict[str, object]:
        conn = connect(DB_PATH)
        return export_policy_context(conn, jurisdiction=jurisdiction, module=module)

    @app.get("/v1/rules/evaluate")
    def evaluate_rules(
        jurisdiction: str,
        applicant_scope: str,
        as_of: date,
        module: str | None = Query(default=None),
    ) -> dict[str, object]:
        conn = connect(DB_PATH)
        matches = find_applicable_rules(
            conn,
            jurisdiction=jurisdiction,
            applicant_scope=applicant_scope,
            as_of=as_of,
            module=module,
        )
        return {
            "rules": [
                {"rule": asdict(match.rule), "citation": asdict(match.citation)}
                for match in matches
            ],
            "conflicts": detect_policy_conflicts(matches),
        }

    @app.post("/v1/agents/context")
    def agent_context(request: dict[str, object]) -> dict[str, object]:
        conn = connect(DB_PATH)
        jurisdictions = request.get("jurisdictions") or []
        module = request.get("module")
        as_of_raw = request.get("as_of")
        applicant_scope = request.get("applicant_scope")

        if not isinstance(jurisdictions, list):
            jurisdictions = []
        if not isinstance(as_of_raw, str) or not isinstance(applicant_scope, str):
            return {
                "error": "as_of and applicant_scope are required",
                "required": ["jurisdictions", "applicant_scope", "as_of"],
            }

        as_of = date.fromisoformat(as_of_raw)
        results = []
        for jurisdiction in jurisdictions:
            if not isinstance(jurisdiction, str):
                continue
            matches = find_applicable_rules(
                conn,
                jurisdiction=jurisdiction,
                applicant_scope=applicant_scope,
                as_of=as_of,
                module=module if isinstance(module, str) else None,
            )
            results.append(
                {
                    "jurisdiction": jurisdiction,
                    "rules": [
                        {"rule": asdict(match.rule), "citation": asdict(match.citation)}
                        for match in matches
                    ],
                    "conflicts": detect_policy_conflicts(matches),
                }
            )

        return {
            "as_of": as_of_raw,
            "applicant_scope": applicant_scope,
            "module": module,
            "results": results,
        }


def main() -> None:
    if FastAPI is None:
        raise SystemExit("Install optional API dependencies: pip install -e '.[api]'")
    import uvicorn

    uvicorn.run("onestep_engine.api:app", host="127.0.0.1", port=8787, reload=False)


if __name__ == "__main__":
    main()
