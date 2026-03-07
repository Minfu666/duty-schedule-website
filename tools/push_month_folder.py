#!/usr/bin/env python3
"""
Import monthly .xlsx folder and upsert into Supabase while preserving history.

Usage:
  python tools/push_month_folder.py \
    --folder "E:\\monthly-data\\2026-03" \
    --year 2026 \
    --supabase-url "https://xxxx.supabase.co" \
    --supabase-service-key "YOUR_SERVICE_ROLE_KEY"
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

import pandas as pd


FLOOR_COLS = [
    ("\u4e8c\u5c42", 1, 2),
    ("\u4e09\u5c42", 3, 4),
    ("\u56db\u5c42", 5, 6),
]

FLOOR_ORDER = {"\u4e8c\u5c42": 1, "\u4e09\u5c42": 2, "\u56db\u5c42": 3}


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
                    name_text = "\u7a7a"
                else:
                    name_text = str(name_val).strip()
                    if not name_text or name_text.lower() == "nan":
                        name_text = "\u7a7a"

                entries.append(
                    {
                        "date": date_key,
                        "floor": floor,
                        "slot": slot,
                        "time": time_text,
                        "name": name_text,
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


def parse_folder(folder: pathlib.Path, year: int) -> tuple[list[dict], list[pathlib.Path], list[str]]:
    excel_files = sorted(folder.rglob("*.xlsx"))
    if not excel_files:
        raise RuntimeError(f"No .xlsx files found in: {folder}")

    per_date: dict[str, list[dict]] = {}
    for excel_file in excel_files:
        data = parse_single_excel(excel_file, year)
        for date_key, entries in data.items():
            per_date[date_key] = entries

    ordered_dates = sorted(per_date.keys())
    rows: list[dict] = []
    for date_key in ordered_dates:
        rows.extend(per_date[date_key])
    return rows, excel_files, ordered_dates


def normalize_supabase_url(url: str) -> str:
    return url.rstrip("/")


def supabase_headers(service_key: str, extra: dict | None = None) -> dict:
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def rest_url(base_url: str, resource: str, params: dict | None = None) -> str:
    base = f"{base_url}/rest/v1/{resource}"
    if not params:
        return base
    query = urllib.parse.urlencode(params, safe="(),.*")
    return f"{base}?{query}"


def http_json(url: str, method: str, headers: dict, data=None):
    payload = None
    if data is not None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url=url, method=method, data=payload, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            text = resp.read().decode("utf-8")
            if not text.strip():
                return None
            return json.loads(text)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error: {exc}") from exc


def chunked(values: list[str], size: int) -> list[list[str]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def main() -> int:
    parser = argparse.ArgumentParser(description="Import monthly folder and push to Supabase")
    parser.add_argument("--folder", required=True, help="Folder containing monthly .xlsx files")
    parser.add_argument("--year", required=True, type=int, help="Year used for MM.DD parsing, e.g. 2026")
    parser.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL", ""), help="Supabase project URL")
    parser.add_argument(
        "--supabase-service-key",
        default=os.getenv("SUPABASE_SERVICE_KEY", ""),
        help="Supabase service role key (used by import script only)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Parse only; skip upload")
    args = parser.parse_args()

    folder = pathlib.Path(args.folder).expanduser().resolve()
    if not folder.exists() or not folder.is_dir():
        raise RuntimeError(f"Invalid folder: {folder}")

    supabase_url = normalize_supabase_url(args.supabase_url)
    service_key = args.supabase_service_key.strip()
    if not args.dry_run and (not supabase_url or not service_key):
        raise RuntimeError("--supabase-url and --supabase-service-key are required unless --dry-run")

    rows, excel_files, month_dates = parse_folder(folder, args.year)
    if not rows:
        raise RuntimeError("No valid entries parsed")

    print(f"Parsed files: {len(excel_files)}")
    print(f"Parsed dates: {len(month_dates)} ({month_dates[0]} -> {month_dates[-1]})")
    print(f"Parsed rows : {len(rows)}")

    if args.dry_run:
        print("Dry run enabled. Skip Supabase upload.")
        return 0

    headers = supabase_headers(service_key)

    existing_rows = http_json(
        rest_url(supabase_url, "schedule_entries", {"select": "date"}),
        method="GET",
        headers=headers,
    )
    before_dates = len({item["date"] for item in (existing_rows or []) if "date" in item})

    # Delete only uploaded month dates, preserve all other history.
    for date_chunk in chunked(month_dates, 20):
        date_filter = f"in.({','.join(date_chunk)})"
        http_json(
            rest_url(supabase_url, "schedule_entries", {"date": date_filter}),
            method="DELETE",
            headers=supabase_headers(service_key, {"Prefer": "return=minimal"}),
        )

    http_json(
        rest_url(supabase_url, "schedule_entries"),
        method="POST",
        headers=supabase_headers(service_key, {"Prefer": "return=minimal"}),
        data=rows,
    )

    final_rows = http_json(
        rest_url(supabase_url, "schedule_entries", {"select": "date"}),
        method="GET",
        headers=headers,
    )
    after_dates = len({item["date"] for item in (final_rows or []) if "date" in item})

    print("Upload complete.")
    print(f"Total dates before: {before_dates}")
    print(f"Total dates after : {after_dates}")
    print(f"Updated dates      : {len(month_dates)}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # pylint: disable=broad-except
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
