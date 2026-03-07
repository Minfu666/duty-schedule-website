#!/usr/bin/env python3
"""
Upload monthly duty schedules to backend while preserving history.

Usage:
  python tools/push_month_folder.py --folder "E:\\duty-data\\2026-03" --api "https://your-backend.zeabur.app" --year 2026
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

import pandas as pd


FLOOR_COLS = [
    ("\u4e8c\u5c42", 1, 2),  # 二层
    ("\u4e09\u5c42", 3, 4),  # 三层
    ("\u56db\u5c42", 5, 6),  # 四层
]

FLOOR_ORDER = {"\u4e8c\u5c42": 1, "\u4e09\u5c42": 2, "\u56db\u5c42": 3}


def normalize_api_base(api_base: str) -> str:
    return api_base.rstrip("/")


def http_json(url: str, method: str = "GET", data: dict | None = None) -> dict:
    payload = None
    headers = {"Content-Type": "application/json; charset=utf-8"}

    if data is not None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(url=url, method=method, data=payload, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode("utf-8")
            if not text.strip():
                return {}
            return json.loads(text)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error: {exc}") from exc


def parse_date_text(date_text: str, year: int) -> str | None:
    match = re.search(r"(\d{1,2})[./-](\d{1,2})", date_text)
    if not match:
        return None
    month = int(match.group(1))
    day = int(match.group(2))
    return f"{year:04d}-{month:02d}-{day:02d}"


def parse_single_excel(excel_path: pathlib.Path, year: int) -> dict[str, list[dict]]:
    df = pd.read_excel(excel_path, header=None)
    out: dict[str, list[dict]] = {}

    # Row pattern:
    # row 0: headers
    # row 1: times for first date
    # row 2: names for first date
    # ...
    for row_idx in range(1, len(df), 2):
        if row_idx + 1 >= len(df):
            break

        time_row = df.iloc[row_idx]
        name_row = df.iloc[row_idx + 1]

        date_cell = time_row[0]
        if pd.isna(date_cell):
            continue

        date_key = parse_date_text(str(date_cell).strip(), year)
        if not date_key:
            continue

        entries: list[dict] = []
        for floor, col1, col2 in FLOOR_COLS:
            for col, slot in ((col1, 1), (col2, 2)):
                if col >= len(time_row) or col >= len(name_row):
                    continue

                time_val = time_row[col]
                name_val = name_row[col]
                if pd.isna(time_val):
                    continue

                time_text = str(time_val).strip()
                if not time_text or time_text.lower() == "nan":
                    continue

                if pd.isna(name_val):
                    name_text = "\u7a7a"  # 空
                else:
                    name_text = str(name_val).strip()
                    if not name_text or name_text.lower() == "nan":
                        name_text = "\u7a7a"

                entries.append(
                    {
                        "floor": floor,
                        "time": time_text,
                        "name": name_text,
                        "slot": slot,
                    }
                )

        entries.sort(
            key=lambda item: (
                FLOOR_ORDER.get(item["floor"], 99),
                item.get("slot", 1),
                item.get("time", ""),
            )
        )
        out[date_key] = entries

    return out


def parse_folder(folder: pathlib.Path, year: int) -> tuple[dict[str, list[dict]], list[pathlib.Path]]:
    excel_files = sorted(folder.rglob("*.xlsx"))
    if not excel_files:
        raise RuntimeError(f"No .xlsx files found in: {folder}")

    merged: dict[str, list[dict]] = {}
    for excel_file in excel_files:
        month_data = parse_single_excel(excel_file, year)
        for date_key, entries in month_data.items():
            merged[date_key] = entries
    return merged, excel_files


def sort_schedule(schedule: dict[str, list[dict]]) -> dict[str, list[dict]]:
    return dict(sorted(schedule.items(), key=lambda pair: pair[0]))


def main() -> int:
    parser = argparse.ArgumentParser(description="Import monthly folder and push to backend API")
    parser.add_argument("--folder", required=True, help="Folder containing monthly .xlsx files")
    parser.add_argument("--api", required=True, help="Backend base URL, e.g. https://your-backend.zeabur.app")
    parser.add_argument("--year", required=True, type=int, help="Year used for MM.DD date parsing, e.g. 2026")
    parser.add_argument("--dry-run", action="store_true", help="Parse only; do not push to backend")
    args = parser.parse_args()

    folder = pathlib.Path(args.folder).expanduser().resolve()
    if not folder.exists() or not folder.is_dir():
        raise RuntimeError(f"Invalid folder: {folder}")

    api_base = normalize_api_base(args.api)
    month_data, excel_files = parse_folder(folder, args.year)
    if not month_data:
        raise RuntimeError("No valid schedule entries parsed from folder")

    month_data = sort_schedule(month_data)
    month_dates = list(month_data.keys())
    print(f"Parsed files: {len(excel_files)}")
    print(f"Parsed dates: {len(month_dates)} ({month_dates[0]} -> {month_dates[-1]})")

    if args.dry_run:
        print("Dry run enabled. Skip backend upload.")
        return 0

    existing_payload = http_json(f"{api_base}/api/schedule", method="GET")
    existing_schedule = existing_payload.get("schedule", {})
    if not isinstance(existing_schedule, dict):
        existing_schedule = {}

    before_count = len(existing_schedule)
    merged_schedule = dict(existing_schedule)
    for date_key, entries in month_data.items():
        merged_schedule[date_key] = entries
    merged_schedule = sort_schedule(merged_schedule)

    http_json(
        f"{api_base}/api/schedule",
        method="POST",
        data={"schedule": merged_schedule},
    )

    after_count = len(merged_schedule)
    print("Upload complete.")
    print(f"Total dates before: {before_count}")
    print(f"Total dates after : {after_count}")
    print(f"Updated dates      : {len(month_data)}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # pylint: disable=broad-except
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
