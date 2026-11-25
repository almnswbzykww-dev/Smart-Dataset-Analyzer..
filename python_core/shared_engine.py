from __future__ import annotations

import csv
import html
import io
import json
import math
import os
import statistics
from datetime import datetime
from typing import Any

CHART_TYPES_AR: dict[str, str] = {
    "Bar": "مخطط الأعمدة",
    "Line": "المخطط الخطي",
    "Pie": "المخطط الدائري",
    "Scatter": "مخطط التشتت",
    "Histogram": "المدرج التكراري",
    "Box Plot": "مخطط الصندوق",
}

SUPPORTED_CHART_KEYS = list(CHART_TYPES_AR.keys())


def parse_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return None if (math.isnan(value) or math.isinf(value)) else float(value)
    text = str(value).strip()
    if not text:
        return None
    cleaned = text.replace(",", "").replace("$", "").replace("%", "").strip()
    try:
        num = float(cleaned)
        return None if (math.isnan(num) or math.isinf(num)) else num
    except ValueError:
        return None


def detect_columns_and_defaults(rows: list[dict[str, Any]], columns: list[str]) -> dict[str, Any]:
    numeric_cols: list[str] = []
    text_cols: list[str] = []
    for col in columns:
        non_empty = [r.get(col) for r in rows if r.get(col) not in (None, "")]
        if non_empty and all(parse_number(v) is not None for v in non_empty):
            numeric_cols.append(col)
        else:
            text_cols.append(col)

    default_x = text_cols[0] if text_cols else (columns[0] if columns else "X")
    if numeric_cols:
        default_y = next((c for c in numeric_cols if c != default_x), numeric_cols[0])
    else:
        default_y = columns[1] if len(columns) > 1 else default_x

    return {
        "numeric_columns": numeric_cols,
        "text_columns": text_cols,
        "default_x": default_x,
        "default_y": default_y,
    }


def load_csv_dataset(file_path: str, custom_name: str | None = None) -> dict[str, Any]:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"ملف البيانات غير موجود: {file_path}")

    raw_bytes = open(file_path, "rb").read()
    text = None
    for enc in ("utf-8-sig", "utf-8", "cp1256", "latin-1"):
        try:
            text = raw_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError("تعذر فك ترميز ملف CSV.")

    sample = text[:4096]
    delimiter = ","
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except csv.Error:
        if ";" in sample and "," not in sample:
            delimiter = ";"
        elif "\t" in sample:
            delimiter = "\t"

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise ValueError("ملف CSV لا يحتوي على ترويسة أعمدة صالحة.")

    columns = [str(c).strip() for c in reader.fieldnames if str(c).strip()]
    rows: list[dict[str, Any]] = []
    for raw_row in reader:
        cleaned_row: dict[str, Any] = {}
        has_any = False
        for col in columns:
            val = raw_row.get(col, "")
            val_str = str(val).strip() if val is not None else ""
            if val_str:
                has_any = True
            num = parse_number(val_str)
            cleaned_row[col] = num if num is not None else val_str
        if has_any:
            rows.append(cleaned_row)

    if not rows:
        raise ValueError("ملف CSV فارغ ولا يحتوي على صفوف بيانات.")

    meta = detect_columns_and_defaults(rows, columns)
    name = custom_name or os.path.basename(file_path)
    return {
        "name": name,
        "columns": columns,
        "rows": rows,
        "rows_count": len(rows),
        "cols_count": len(columns),
        **meta,
    }


def aggregate_series(
    rows: list[dict[str, Any]],
    x_col: str,
    y_col: str,
    agg_mode: str = "sum",
    chart_type: str = "Bar",
) -> dict[str, Any]:
    if chart_type not in SUPPORTED_CHART_KEYS:
        raise ValueError(f"نوع المخطط غير مدعوم: {chart_type}")

    if chart_type == "Scatter":
        points = []
        for r in rows:
            xv = parse_number(r.get(x_col))
            yv = parse_number(r.get(y_col))
            if xv is not None and yv is not None:
                points.append({"x": xv, "y": yv})
        if not points:
            raise ValueError("مخطط التشتت يتطلب عموداً رقمياً لكل من محور X ومحور Y.")
        return {"chart_type": chart_type, "points": points, "labels": [], "values": []}

    if chart_type == "Histogram":
        vals = [v for v in (parse_number(r.get(y_col)) for r in rows) if v is not None]
        if not vals:
            raise ValueError("المدرج التكراري يتطلب قيماً رقمية صالحة في محور Y.")
        return {
            "chart_type": chart_type,
            "labels": [str(i + 1) for i in range(len(vals))],
            "values": vals,
        }

    buckets: dict[str, list[float]] = {}
    for r in rows:
        key = str(r.get(x_col, "") or "غير محدد")
        yv = parse_number(r.get(y_col))
        if yv is None:
            continue
        buckets.setdefault(key, []).append(yv)

    if not buckets:
        raise ValueError("لا توجد قيم رقمية صالحة في عمود محور Y المحدد.")

    labels: list[str] = []
    values: list[float] = []
    for k, arr in buckets.items():
        labels.append(k)
        if agg_mode == "avg":
            values.append(sum(arr) / len(arr))
        elif agg_mode == "count":
            values.append(float(len(arr)))
        elif agg_mode == "max":
            values.append(max(arr))
        elif agg_mode == "min":
            values.append(min(arr))
        else:
            values.append(sum(arr))

    if chart_type == "Pie" and any(v < 0 for v in values):
        raise ValueError("المخطط الدائري لا يدعم القيم السالبة.")

    return {"chart_type": chart_type, "labels": labels, "values": values}


def compute_column_stats(rows: list[dict[str, Any]], col_name: str) -> dict[str, float]:
    vals = sorted(v for v in (parse_number(r.get(col_name)) for r in rows) if v is not None)
    if not vals:
        raise ValueError(f"العمود '{col_name}' لا يحتوي على قيم رقمية صالحة.")

    n = len(vals)
    mean_val = sum(vals) / n
    median_val = statistics.median(vals)
    std_val = statistics.pstdev(vals) if n > 1 else 0.0
    mid = n // 2
    lower = vals[:mid] if n > 1 else vals
    upper = vals[mid + (n % 2):] if n > 1 else vals
    q1 = statistics.median(lower) if lower else vals[0]
    q3 = statistics.median(upper) if upper else vals[-1]

    return {
        "count": float(n),
        "sum": float(sum(vals)),
        "mean": float(mean_val),
        "median": float(median_val),
        "std_dev": float(std_val),
        "min": float(vals[0]),
        "max": float(vals[-1]),
        "q1": float(q1),
        "q3": float(q3),
    }


def generate_voucher_number(prefix: str = "BF") -> str:
    now = datetime.now()
    return f"{prefix}-{now:%y%m%d}-{int(now.timestamp()) % 100000:05d}"


def build_print_voucher_html(
    *,
    title: str,
    subtitle: str = "",
    edition_label: str,
    voucher_no: str,
    company: dict[str, Any] | None = None,
    summary_pairs: list[tuple[str, Any]] | None = None,
    headers: list[str] | None = None,
    rows: list[list[Any]] | None = None,
    notes: str = "",
    auto_print: bool = True,
) -> str:
    company = company or {}
    c_name = str(company.get("companyName", "") or "").strip()
    c_loc = str(company.get("location", "") or "").strip()
    c_addr = str(company.get("address", "") or "").strip()
    c_logo = str(company.get("logoDataUrl", "") or "").strip()
    logo_ok = c_logo.startswith("data:image/") and ";base64," in c_logo

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    company_html = ""
    if c_name or c_loc or c_addr or logo_ok:
        company_html = f"""
        <div class="company-header">
          {f'<img src="{html.escape(c_logo)}" alt="شعار الشركة" class="company-logo" />' if logo_ok else ''}
          <div class="company-info">
            {f'<h1>{html.escape(c_name)}</h1>' if c_name else ''}
            {f'<p>📍 الموقع: {html.escape(c_loc)}</p>' if c_loc else ''}
            {f'<p>🏢 العنوان: {html.escape(c_addr)}</p>' if c_addr else ''}
          </div>
        </div>"""

    pairs_html = ""
    if summary_pairs:
        body = "".join(
            f"<tr><td class='lbl'>{html.escape(str(k))}</td><td class='val'>{html.escape(str(v))}</td></tr>"
            for k, v in summary_pairs
        )
        pairs_html = f"""
        <section class="sec">
          <h3>📋 ملخص مؤشرات السند</h3>
          <table class="summary"><thead><tr><th>البند</th><th>القيمة</th></tr></thead><tbody>{body}</tbody></table>
        </section>"""

    table_html = ""
    if headers and rows:
        th = "".join(f"<th>{html.escape(str(h))}</th>" for h in headers)
        tr = "".join(
            "<tr>" + "".join(f"<td>{html.escape(str(cell))}</td>" for cell in row) + "</tr>"
            for row in rows[:200]
        )
        table_html = f"""
        <section class="sec">
          <h3>📑 جدول البيانات التفصيلية</h3>
          <div style="width:100%;overflow-x:auto;">
            <table class="data"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>
          </div>
        </section>"""

    notes_html = f"<div class='notes'>📝 ملاحظات: {html.escape(notes)}</div>" if notes else ""
    auto_js = "<script>window.addEventListener('load',function(){setTimeout(function(){try{window.print();}catch(e){}},250);});</script>" if auto_print else ""

    return f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>سند طباعة {html.escape(voucher_no)} — {html.escape(title)}</title>
  <style>
    @page {{ size: A4; margin: 14mm; }}
    * {{ box-sizing: border-box; }}
    body {{ font-family: Tahoma, Arial, sans-serif; margin: 0; padding: 20px; background: #fff; color: #0f172a; direction: rtl; }}
    .toolbar {{ max-width: 900px; margin: 0 auto 12px; display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 8px; }}
    .btn {{ background: #0f766e; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; }}
    .frame {{ max-width: 900px; margin: 0 auto; border: 2px solid #0f766e; border-radius: 12px; padding: 20px; }}
    .top {{ display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: #042f2e; color: #fff; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }}
    .badge {{ font-size: 16px; font-weight: bold; color: #efdb8a; }}
    .company-header {{ display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 8px; border-bottom: 2px solid #0f766e; padding-bottom: 14px; margin-bottom: 16px; }}
    .company-info {{ text-align: center; }}
    .company-header h1 {{ margin: 0; font-size: 20px; color: #0f172a; }}
    .company-header p {{ margin: 4px 0 0; font-size: 12px; color: #334155; font-weight: bold; }}
    .company-logo {{ display: block; margin: 0 auto; max-height: 92px; max-width: 220px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px; background: #fff; }}
    .sec {{ margin-bottom: 16px; }}
    .sec h3 {{ margin: 0 0 8px; font-size: 14px; color: #064e3b; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
    th, td {{ border: 1px solid #cbd5e1; padding: 7px 9px; text-align: right; }}
    .summary th {{ background: #f1f5f9; width: 50%; }}
    .summary .lbl {{ font-weight: bold; }}
    .summary .val {{ font-weight: bold; color: #065f46; }}
    .data th {{ background: #0f766e; color: #fff; }}
    .data tbody tr:nth-child(even) {{ background: #f8fafc; }}
    .notes {{ background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; font-size: 12px; }}
    .footer {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; border-top: 2px dashed #94a3b8; padding-top: 12px; margin-top: 16px; text-align: center; font-size: 11px; color: #475569; }}
    .sig {{ border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; min-height: 52px; }}
    @media print {{ .toolbar {{ display: none !important; }} body {{ padding: 0; }} }}
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>🖨️ سند الطباعة الرسمي — جاهز للطباعة في المتصفح</strong>
    <button class="btn" onclick="window.print()">🖨️ طباعة السند الآن</button>
  </div>
  <div class="frame">
    <div class="top">
      <div>
        <div class="badge">💎 سند طباعة رسمي — تطبيق بن فيصل لتحليل البيانات الذكي</div>
        <div style="font-size:11px;color:#99f6e4;">{html.escape(edition_label)}</div>
      </div>
      <div style="text-align:left;font-size:11px;">
        <div>رقم السند: <span dir="ltr">{html.escape(voucher_no)}</span></div>
        <div>تاريخ الإصدار: {html.escape(now_str)}</div>
      </div>
    </div>
    {company_html}
    <h2 style="margin:0 0 6px;color:#064e3b;">{html.escape(title)}</h2>
    {f'<p style="margin:0 0 14px;color:#475569;font-size:12px;">{html.escape(subtitle)}</p>' if subtitle else ''}
    {pairs_html}
    {table_html}
    {notes_html}
    <div class="footer">
      <div class="sig"><strong>إعداد / المحلل</strong></div>
      <div class="sig"><strong>الاعتماد والمراجعة</strong></div>
      <div class="sig"><strong>الختم الرسمي</strong></div>
    </div>
  </div>
  {auto_js}
</body>
</html>"""


def json_response_bytes(data: Any) -> bytes:
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
