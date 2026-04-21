from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mp_api.client import MPRester
from pymatgen.io.cif import CifWriter


@dataclass
class CrystalTarget:
    folder: Path
    document: dict[str, Any]
    materials_project: dict[str, Any]


def load_targets(repo_root: Path) -> list[CrystalTarget]:
    crystals_root = repo_root / "data" / "crystals"
    targets: list[CrystalTarget] = []
    for folder in sorted(p for p in crystals_root.iterdir() if p.is_dir()):
        document_path = folder / "document.json"
        mp_path = folder / "materials-project.json"
        if not document_path.exists() or not mp_path.exists():
            continue
        targets.append(
            CrystalTarget(
                folder=folder,
                document=json.loads(document_path.read_text(encoding="utf-8")),
                materials_project=json.loads(mp_path.read_text(encoding="utf-8")),
            )
        )
    return targets


def infer_search_kwargs(document: dict[str, Any]) -> dict[str, Any]:
    viewer = document["viewerStructure"]
    return {
        "formula": viewer["formula"],
        "fields": [
            "material_id",
            "formula_pretty",
            "symmetry",
            "energy_above_hull",
            "theoretical",
            "deprecated",
            "is_stable",
        ],
        "num_chunks": 1,
        "chunk_size": 200,
    }


def score_candidate(doc: Any, target_sg: int | None) -> tuple[int, float, int]:
    score = 0
    sg_number = getattr(getattr(doc, "symmetry", None), "number", None)
    if target_sg is not None and sg_number == target_sg:
        score += 100
    if not getattr(doc, "deprecated", False):
        score += 10
    if getattr(doc, "is_stable", False):
        score += 5
    if not getattr(doc, "theoretical", False):
        score += 3
    eah = float(getattr(doc, "energy_above_hull", 999) or 999)
    return (score, -eah, -(sg_number or 0))


def choose_candidate(docs: list[Any], target_sg: int | None) -> Any | None:
    if not docs:
        return None
    ranked = sorted(docs, key=lambda doc: score_candidate(doc, target_sg), reverse=True)
    return ranked[0]


def dump_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_report(report_path: Path, rows: list[dict[str, Any]]) -> None:
    lines = [
        "# Materials Project 下载报告",
        "",
        f"生成时间：{datetime.now(timezone.utc).isoformat()}",
        "",
        "| 晶体 | 公式 | 状态 | Materials Project | 目标空间群 | 结果空间群 | 说明 |",
        "|---|---|---|---|---:|---:|---|",
    ]
    for row in rows:
        lines.append(
            f"| {row['id']} {row['name']} | {row['formula']} | {row['status']} | "
            f"{row.get('material_id') or '-'} | {row.get('target_sg') or '-'} | "
            f"{row.get('result_sg') or '-'} | {row.get('note') or '-'} |"
        )
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_gap_report(report_path: Path, rows: list[dict[str, Any]]) -> None:
    lines = [
        "# Materials Project 缺失与偏差清单",
        "",
        "以下条目表示 Materials Project 中没有直接找到与需求完全一致的目标结构，",
        "或者虽然下载到了 CIF，但空间群与需求文档不一致，需要在页面里明确区分“文档模式”和“CIF 模式”。",
        "",
        "| 晶体 | 需求空间群 | 下载状态 | Materials Project | 实际空间群 | 说明 |",
        "|---|---:|---|---|---:|---|",
    ]

    gap_rows = [row for row in rows if row["status"] != "downloaded"]
    if not gap_rows:
        lines.append("| 无 | - | - | - | - | 当前批次全部精确匹配。 |")
    else:
        for row in gap_rows:
            lines.append(
                f"| {row['id']} {row['name']} | {row.get('target_sg') or '-'} | {row['status']} | "
                f"{row.get('material_id') or '-'} | {row.get('result_sg') or '-'} | {row.get('note') or '-'} |"
            )

    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=os.getcwd())
    parser.add_argument("--api-key", default=os.environ.get("MP_API_KEY"))
    args = parser.parse_args()

    if not args.api_key:
        raise SystemExit("MP_API_KEY is required.")

    repo_root = Path(args.repo_root).resolve()
    targets = load_targets(repo_root)
    report_rows: list[dict[str, Any]] = []

    with MPRester(args.api_key) as mpr:
        for target in targets:
            viewer = target.document["viewerStructure"]
            target_sg = viewer.get("spaceGroupNumber")
            summary_docs = list(mpr.materials.summary.search(**infer_search_kwargs(target.document)))
            chosen = choose_candidate(summary_docs, target_sg)

            mp_meta = target.materials_project
            mp_meta["candidateCount"] = len(summary_docs)
            mp_meta["checkedAt"] = datetime.now(timezone.utc).isoformat()

            if chosen is None:
                mp_meta["status"] = "missing"
                mp_meta["materialId"] = None
                mp_meta["downloadedAt"] = None
                mp_meta["notes"] = ["No Materials Project summary document matched this formula."]
                dump_json(target.folder / "materials-project.json", mp_meta)
                report_rows.append(
                    {
                        "id": viewer["id"],
                        "name": viewer["name"],
                        "formula": viewer["formula"],
                        "status": "missing",
                        "material_id": None,
                        "target_sg": target_sg,
                        "result_sg": None,
                        "note": "No candidate returned by Materials Project.",
                    }
                )
                continue

            material_id = str(chosen.material_id)
            structure = mpr.get_structure_by_material_id(material_id, conventional_unit_cell=True)
            cif_path = target.folder / "materials-project.cif"
            CifWriter(structure).write_file(str(cif_path))

            result_sg = structure.get_space_group_info()[1]
            chosen_symmetry = getattr(chosen, "symmetry", None)
            exact_match = target_sg is None or result_sg == target_sg
            status = "downloaded" if exact_match else "partial_match"
            note = (
                "Matched by formula and ranked by space group / stability."
                if exact_match
                else "No exact target space group in Materials Project; saved the closest available candidate."
            )

            mp_meta.update(
                {
                    "status": status,
                    "materialId": material_id,
                    "downloadedAt": datetime.now(timezone.utc).isoformat(),
                    "formulaPretty": getattr(chosen, "formula_pretty", viewer["formula"]),
                    "spaceGroupNumber": getattr(chosen_symmetry, "number", None),
                    "spaceGroupSymbol": getattr(chosen_symmetry, "symbol", None),
                    "energyAboveHull": getattr(chosen, "energy_above_hull", None),
                    "isStable": getattr(chosen, "is_stable", None),
                    "theoretical": getattr(chosen, "theoretical", None),
                    "deprecated": getattr(chosen, "deprecated", None),
                    "sourceUrl": f"https://next-gen.materialsproject.org/materials/{material_id}",
                    "notes": [
                        "Structure downloaded via Materials Project mp-api and written to CIF with pymatgen.",
                        "The saved CIF uses the conventional unit cell returned by mp-api.",
                        note,
                    ],
                }
            )
            dump_json(target.folder / "materials-project.json", mp_meta)

            report_rows.append(
                {
                    "id": viewer["id"],
                    "name": viewer["name"],
                    "formula": viewer["formula"],
                    "status": status,
                    "material_id": material_id,
                    "target_sg": target_sg,
                    "result_sg": result_sg,
                    "note": note,
                }
            )

    write_report(repo_root / "data" / "materials-project-download-report.md", report_rows)
    write_gap_report(repo_root / "data" / "materials-project-missing.md", report_rows)


if __name__ == "__main__":
    main()
