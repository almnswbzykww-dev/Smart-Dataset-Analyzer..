from __future__ import annotations

import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import matplotlib
matplotlib.use("TkAgg")
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
from matplotlib.figure import Figure
import pandas as pd


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SAMPLE_PATH = os.path.join(BASE_DIR, "data", "sample_data.csv")

CHART_TYPES = [
    "Bar",
    "Line",
    "Pie",
    "Scatter",
    "Histogram",
    "Box Plot",
]


def ensure_sample_csv_exists() -> str:
    """Ensure data/sample_data.csv exists; create a clean sample if missing."""
    if os.path.exists(DEFAULT_SAMPLE_PATH):
        return DEFAULT_SAMPLE_PATH

    os.makedirs(os.path.dirname(DEFAULT_SAMPLE_PATH), exist_ok=True)
    sample_df = pd.DataFrame(
        [
            {"Month": "Jan", "Branch": "Sanaa", "Category": "Electronics", "Sales": 125000, "Profit": 35000, "Cost": 90000, "Orders": 320, "Rating": 4.7},
            {"Month": "Feb", "Branch": "Sanaa", "Category": "Software", "Sales": 142000, "Profit": 48000, "Cost": 94000, "Orders": 410, "Rating": 4.8},
            {"Month": "Mar", "Branch": "Aden", "Category": "Electronics", "Sales": 98000, "Profit": 24000, "Cost": 74000, "Orders": 260, "Rating": 4.5},
            {"Month": "Apr", "Branch": "Aden", "Category": "Services", "Sales": 112000, "Profit": 36000, "Cost": 76000, "Orders": 295, "Rating": 4.6},
            {"Month": "May", "Branch": "Taiz", "Category": "Software", "Sales": 89000, "Profit": 31000, "Cost": 58000, "Orders": 230, "Rating": 4.4},
            {"Month": "Jun", "Branch": "Taiz", "Category": "Electronics", "Sales": 134000, "Profit": 41000, "Cost": 93000, "Orders": 350, "Rating": 4.7},
            {"Month": "Jul", "Branch": "Hadramout", "Category": "Services", "Sales": 118000, "Profit": 39000, "Cost": 79000, "Orders": 310, "Rating": 4.6},
            {"Month": "Aug", "Branch": "Hadramout", "Category": "Software", "Sales": 156000, "Profit": 54000, "Cost": 102000, "Orders": 440, "Rating": 4.9},
            {"Month": "Sep", "Branch": "Ibb", "Category": "Electronics", "Sales": 76000, "Profit": 19000, "Cost": 57000, "Orders": 190, "Rating": 4.2},
            {"Month": "Oct", "Branch": "Ibb", "Category": "Services", "Sales": 94000, "Profit": 28000, "Cost": 66000, "Orders": 245, "Rating": 4.5},
            {"Month": "Nov", "Branch": "Sanaa", "Category": "Software", "Sales": 168000, "Profit": 61000, "Cost": 107000, "Orders": 475, "Rating": 4.9},
            {"Month": "Dec", "Branch": "Aden", "Category": "Electronics", "Sales": 149000, "Profit": 45000, "Cost": 104000, "Orders": 390, "Rating": 4.8},
        ]
    )
    sample_df.to_csv(DEFAULT_SAMPLE_PATH, index=False, encoding="utf-8-sig")
    return DEFAULT_SAMPLE_PATH


class CSVChartApp:
    """Academic Desktop App for CSV analysis and embedded chart visualization."""

    # Calm Academic Palette
    BG_APP = "#F1F5F9"
    BG_CARD = "#FFFFFF"
    NAVY = "#1B365D"
    TEAL = "#0F766E"
    ROYAL = "#1D4ED8"
    ROYAL_HOVER = "#1E40AF"
    BORDER = "#CBD5E1"
    TEXT_PRIMARY = "#0F172A"
    TEXT_MUTED = "#475569"

    CHART_COLORS = [
        "#1B365D",
        "#0F766E",
        "#2563EB",
        "#D97706",
        "#0891B2",
        "#4F46E5",
        "#059669",
        "#DC2626",
    ]

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("محلل ملفات CSV وإنشاء المخططات البيانية")
        self.root.geometry("1100x740")
        self.root.minsize(900, 620)
        self.root.configure(bg=self.BG_APP)

        self.df: pd.DataFrame | None = None
        self.current_file_path: str | None = None
        self.canvas: FigureCanvasTkAgg | None = None
        self.toolbar: NavigationToolbar2Tk | None = None

        self.x_var = tk.StringVar()
        self.y_var = tk.StringVar()
        self.chart_type_var = tk.StringVar(value=CHART_TYPES[0])
        self.file_info_var = tk.StringVar(value="لم يتم تحميل أي ملف CSV بعد")

        self._configure_styles()
        self._build_ui()

        sample_path = ensure_sample_csv_exists()
        self.load_csv_file(sample_path, auto_plot=True)

    def _configure_styles(self) -> None:
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        style.configure(
            "Academic.TCombobox",
            fieldbackground="#FFFFFF",
            background="#E2E8F0",
            foreground=self.TEXT_PRIMARY,
            padding=6,
            font=("TkDefaultFont", 10),
        )

    def _build_ui(self) -> None:
        # 1. Header Bar
        header = tk.Frame(self.root, bg=self.NAVY, height=64)
        header.pack(fill="x", side="top")
        header.pack_propagate(False)

        title_lbl = tk.Label(
            header,
            text="محلل ملفات CSV وإنشاء المخططات البيانية",
            bg=self.NAVY,
            fg="#FFFFFF",
            font=("TkDefaultFont", 14, "bold"),
            anchor="e",
            justify="right",
        )
        title_lbl.pack(side="right", padx=20, pady=14)

        load_btn = tk.Button(
            header,
            text="📂 تحميل ملف CSV",
            command=self.choose_csv_file,
            bg=self.TEAL,
            fg="#FFFFFF",
            activebackground="#115E59",
            activeforeground="#FFFFFF",
            relief="flat",
            bd=0,
            padx=16,
            pady=8,
            font=("TkDefaultFont", 10, "bold"),
            cursor="hand2",
        )
        load_btn.pack(side="left", padx=20, pady=12)

        # File Info Strip
        info_bar = tk.Frame(self.root, bg="#E2E8F0", height=34)
        info_bar.pack(fill="x", side="top")
        info_bar.pack_propagate(False)

        info_lbl = tk.Label(
            info_bar,
            textvariable=self.file_info_var,
            bg="#E2E8F0",
            fg=self.TEXT_PRIMARY,
            font=("TkDefaultFont", 10, "bold"),
            anchor="e",
            justify="right",
        )
        info_lbl.pack(side="right", padx=20, pady=6)

        # 2. Main Container
        main_container = tk.Frame(self.root, bg=self.BG_APP)
        main_container.pack(fill="both", expand=True, padx=16, pady=12)

        # 3. Essential 3-Field Control Card + Action Button
        controls_card = tk.Frame(
            main_container,
            bg=self.BG_CARD,
            highlightbackground=self.BORDER,
            highlightthickness=1,
            padx=16,
            pady=14,
        )
        controls_card.pack(fill="x", side="top", pady=(0, 12))

        # Grid layout arranged RTL (Action button on left, X on right)
        controls_card.columnconfigure(0, weight=0)
        controls_card.columnconfigure(1, weight=1)
        controls_card.columnconfigure(2, weight=1)
        controls_card.columnconfigure(3, weight=1)

        # Field 1: X Axis (Rightmost in RTL)
        x_frame = tk.Frame(controls_card, bg=self.BG_CARD)
        x_frame.grid(row=0, column=3, sticky="ew", padx=(10, 0))
        tk.Label(
            x_frame,
            text="1. محور X",
            bg=self.BG_CARD,
            fg=self.NAVY,
            font=("TkDefaultFont", 10, "bold"),
            anchor="e",
            justify="right",
        ).pack(fill="x", pady=(0, 4))
        self.x_combo = ttk.Combobox(
            x_frame,
            textvariable=self.x_var,
            state="readonly",
            style="Academic.TCombobox",
            justify="right",
        )
        self.x_combo.pack(fill="x")

        # Field 2: Y Axis (Middle-Right in RTL)
        y_frame = tk.Frame(controls_card, bg=self.BG_CARD)
        y_frame.grid(row=0, column=2, sticky="ew", padx=10)
        tk.Label(
            y_frame,
            text="2. محور Y",
            bg=self.BG_CARD,
            fg=self.NAVY,
            font=("TkDefaultFont", 10, "bold"),
            anchor="e",
            justify="right",
        ).pack(fill="x", pady=(0, 4))
        self.y_combo = ttk.Combobox(
            y_frame,
            textvariable=self.y_var,
            state="readonly",
            style="Academic.TCombobox",
            justify="right",
        )
        self.y_combo.pack(fill="x")

        # Field 3: Chart Type (Middle-Left in RTL)
        type_frame = tk.Frame(controls_card, bg=self.BG_CARD)
        type_frame.grid(row=0, column=1, sticky="ew", padx=10)
        tk.Label(
            type_frame,
            text="3. نوع المخطط",
            bg=self.BG_CARD,
            fg=self.NAVY,
            font=("TkDefaultFont", 10, "bold"),
            anchor="e",
            justify="right",
        ).pack(fill="x", pady=(0, 4))
        self.chart_type_combo = ttk.Combobox(
            type_frame,
            textvariable=self.chart_type_var,
            values=CHART_TYPES,
            state="readonly",
            style="Academic.TCombobox",
            justify="right",
        )
        self.chart_type_combo.pack(fill="x")

        # Prominent Generate Chart Button (Leftmost in RTL)
        btn_frame = tk.Frame(controls_card, bg=self.BG_CARD)
        btn_frame.grid(row=0, column=0, sticky="sew", padx=(0, 12))
        tk.Label(btn_frame, text=" ", bg=self.BG_CARD).pack(pady=(0, 4))
        self.create_btn = tk.Button(
            btn_frame,
            text="📊 إنشاء المخطط",
            command=self.generate_chart,
            bg=self.ROYAL,
            fg="#FFFFFF",
            activebackground=self.ROYAL_HOVER,
            activeforeground="#FFFFFF",
            relief="flat",
            bd=0,
            padx=22,
            pady=8,
            font=("TkDefaultFont", 11, "bold"),
            cursor="hand2",
        )
        self.create_btn.pack(fill="x")

        # 4. Embedded Chart Container
        self.chart_card = tk.Frame(
            main_container,
            bg=self.BG_CARD,
            highlightbackground=self.BORDER,
            highlightthickness=1,
            padx=10,
            pady=10,
        )
        self.chart_card.pack(fill="both", expand=True, side="top")

        self.figure = Figure(figsize=(8.8, 4.8), dpi=100, facecolor="#FFFFFF")
        self.ax = self.figure.add_subplot(111)

        self.canvas = FigureCanvasTkAgg(self.figure, master=self.chart_card)
        self.canvas_widget = self.canvas.get_tk_widget()
        self.canvas_widget.pack(fill="both", expand=True)

        self.toolbar = NavigationToolbar2Tk(self.canvas, self.chart_card)
        self.toolbar.update()

    def choose_csv_file(self) -> None:
        file_path = filedialog.askopenfilename(
            title="اختر ملف CSV",
            filetypes=[("CSV Files", "*.csv"), ("All Files", "*.*")],
        )
        if file_path:
            self.load_csv_file(file_path, auto_plot=True)

    def load_csv_file(self, file_path: str, auto_plot: bool = False) -> bool:
        try:
            df = pd.read_csv(file_path)
            if len(df.columns) == 1:
                try:
                    df_auto = pd.read_csv(file_path, sep=None, engine="python")
                    if len(df_auto.columns) > 1:
                        df = df_auto
                except Exception:
                    pass
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(file_path, encoding="latin1")
                if len(df.columns) == 1:
                    try:
                        df_auto = pd.read_csv(file_path, encoding="latin1", sep=None, engine="python")
                        if len(df_auto.columns) > 1:
                            df = df_auto
                    except Exception:
                        pass
            except Exception as exc:
                messagebox.showerror("خطأ في قراءة الملف", f"تعذر قراءة ملف CSV:\n{exc}")
                return False
        except Exception as exc:
            messagebox.showerror("خطأ في قراءة الملف", f"تعذر قراءة ملف CSV:\n{exc}")
            return False

        if df.empty or len(df.columns) == 0:
            messagebox.showerror("ملف فارغ", "ملف CSV المختار لا يحتوي على بيانات صالحة.")
            return False

        self.df = df
        self.current_file_path = file_path

        columns = [str(c) for c in df.columns.tolist()]
        self.df.columns = columns

        self.x_combo["values"] = columns
        self.y_combo["values"] = columns

        numeric_cols = [c for c in columns if self._is_numeric_column(c)]
        text_cols = [c for c in columns if c not in numeric_cols]

        default_x = text_cols[0] if text_cols else columns[0]
        if numeric_cols:
            default_y = next((c for c in numeric_cols if c != default_x), numeric_cols[0])
        else:
            default_y = columns[1] if len(columns) > 1 else columns[0]

        self.x_var.set(default_x)
        self.y_var.set(default_y)

        file_name = os.path.basename(file_path)
        rows, cols = df.shape
        self.file_info_var.set(
            f"الملف الحالي: {file_name}   |   عدد الصفوف: {rows:,}   |   عدد الأعمدة: {cols}"
        )

        if auto_plot and numeric_cols:
            self.generate_chart(silent_on_error=True)

        return True

    def _is_numeric_column(self, col_name: str) -> bool:
        if self.df is None or col_name not in self.df.columns:
            return False
        converted = pd.to_numeric(self.df[col_name], errors="coerce")
        valid_count = int(converted.notna().sum())
        total_non_null = int(self.df[col_name].notna().sum())
        return total_non_null > 0 and valid_count == total_non_null

    def _to_numeric_series(self, col_name: str) -> pd.Series:
        assert self.df is not None
        return pd.to_numeric(self.df[col_name], errors="coerce")

    def generate_chart(self, silent_on_error: bool = False) -> bool:
        if self.df is None or self.df.empty:
            if not silent_on_error:
                messagebox.showerror("لا توجد بيانات", "يرجى تحميل ملف CSV صالح أولاً.")
            return False

        x_col = self.x_var.get().strip()
        y_col = self.y_var.get().strip()
        chart_type = self.chart_type_var.get().strip()

        if not x_col or x_col not in self.df.columns:
            if not silent_on_error:
                messagebox.showerror("اختيار غير مكتمل", "يرجى اختيار عمود صحيح لمحور X.")
            return False

        if not y_col or y_col not in self.df.columns:
            if not silent_on_error:
                messagebox.showerror("اختيار غير مكتمل", "يرجى اختيار عمود صحيح لمحور Y.")
            return False

        if chart_type not in CHART_TYPES:
            if not silent_on_error:
                messagebox.showerror("اختيار غير مكتمل", "يرجى اختيار نوع مخطط صحيح.")
            return False

        try:
            self.figure.clear()
            ax = self.figure.add_subplot(111)
            self.ax = ax

            y_is_num = self._is_numeric_column(y_col)
            x_is_num = self._is_numeric_column(x_col)

            if chart_type == "Bar":
                if not y_is_num:
                    raise ValueError("مخطط الأعمدة (Bar) يتطلب أن يكون محور Y عموداً رقمياً.")
                plot_df = self.df[[x_col]].copy()
                plot_df[y_col] = self._to_numeric_series(y_col)
                plot_df = plot_df.dropna(subset=[y_col])
                if plot_df.empty:
                    raise ValueError("لا توجد قيم رقمية صالحة في محور Y.")

                grouped = plot_df.groupby(x_col, sort=False, dropna=False)[y_col].sum()
                labels = [str(idx) for idx in grouped.index]
                values = grouped.values.tolist()

                bars = ax.bar(
                    labels,
                    values,
                    color=self.CHART_COLORS[0],
                    edgecolor="#FFFFFF",
                    linewidth=0.8,
                    label=y_col,
                )
                ax.set_title(f"Bar Chart: {y_col} by {x_col}", fontsize=12, fontweight="bold", color=self.NAVY, pad=12)
                ax.set_xlabel(x_col, fontsize=10, fontweight="bold")
                ax.set_ylabel(y_col, fontsize=10, fontweight="bold")
                ax.grid(True, axis="y", linestyle="--", alpha=0.4)
                ax.legend(loc="best")
                if len(labels) <= 15:
                    ax.bar_label(bars, fmt="{:,.0f}", padding=3, fontsize=8)
                if len(labels) > 6:
                    ax.tick_params(axis="x", rotation=25)

            elif chart_type == "Line":
                if not y_is_num:
                    raise ValueError("المخطط الخطي (Line) يتطلب أن يكون محور Y عموداً رقمياً.")
                plot_df = self.df[[x_col]].copy()
                plot_df[y_col] = self._to_numeric_series(y_col)
                plot_df = plot_df.dropna(subset=[y_col])
                if plot_df.empty:
                    raise ValueError("لا توجد قيم رقمية صالحة في محور Y.")

                if x_is_num:
                    plot_df[x_col] = self._to_numeric_series(x_col)
                    plot_df = plot_df.dropna(subset=[x_col]).sort_values(by=x_col)
                    x_vals = plot_df[x_col].tolist()
                    y_vals = plot_df[y_col].tolist()
                else:
                    grouped = plot_df.groupby(x_col, sort=False, dropna=False)[y_col].mean()
                    x_vals = [str(idx) for idx in grouped.index]
                    y_vals = grouped.values.tolist()

                ax.plot(
                    x_vals,
                    y_vals,
                    marker="o",
                    linewidth=2.2,
                    markersize=6,
                    color=self.TEAL,
                    label=y_col,
                )
                if len(x_vals) <= 15:
                    for xv, yv in zip(x_vals, y_vals):
                        ax.annotate(
                            f"{yv:,.1f}" if isinstance(yv, float) and not yv.is_integer() else f"{yv:,.0f}",
                            (xv, yv),
                            textcoords="offset points",
                            xytext=(0, 7),
                            ha="center",
                            fontsize=8,
                        )
                ax.set_title(f"Line Chart: {y_col} over {x_col}", fontsize=12, fontweight="bold", color=self.NAVY, pad=12)
                ax.set_xlabel(x_col, fontsize=10, fontweight="bold")
                ax.set_ylabel(y_col, fontsize=10, fontweight="bold")
                ax.grid(True, linestyle="--", alpha=0.45)
                ax.legend(loc="best")
                if not x_is_num and len(x_vals) > 6:
                    ax.tick_params(axis="x", rotation=25)

            elif chart_type == "Pie":
                if not y_is_num:
                    raise ValueError("المخطط الدائري (Pie) يتطلب أن يكون محور Y عموداً رقمياً.")
                plot_df = self.df[[x_col]].copy()
                plot_df[y_col] = self._to_numeric_series(y_col)
                plot_df = plot_df.dropna(subset=[y_col])

                grouped = plot_df.groupby(x_col, sort=False, dropna=False)[y_col].sum()
                if (grouped < 0).any():
                    raise ValueError("المخطط الدائري (Pie) لا يدعم القيم السالبة في محور Y.")
                if grouped.sum() <= 0:
                    raise ValueError("مجموع القيم في محور Y يجب أن يكون أكبر من الصفر لعرض المخطط الدائري.")

                labels = [str(idx) for idx in grouped.index]
                values = grouped.values.tolist()
                colors = [self.CHART_COLORS[i % len(self.CHART_COLORS)] for i in range(len(values))]

                wedges, _, _ = ax.pie(
                    values,
                    labels=labels if len(labels) <= 8 else None,
                    autopct="%1.1f%%",
                    startangle=140,
                    colors=colors,
                    wedgeprops={"edgecolor": "#FFFFFF", "linewidth": 1.2},
                    textprops={"fontsize": 9},
                )
                ax.set_title(f"Pie Chart: {y_col} Distribution by {x_col}", fontsize=12, fontweight="bold", color=self.NAVY, pad=12)
                ax.legend(wedges, labels, title=x_col, loc="center left", bbox_to_anchor=(1.02, 0.5), fontsize=8)
                ax.axis("equal")

            elif chart_type == "Scatter":
                if not (x_is_num and y_is_num):
                    raise ValueError("مخطط التشتت (Scatter) يتطلب عموداً رقمياً لكلٍ من محور X ومحور Y.")
                plot_df = pd.DataFrame({
                    x_col: self._to_numeric_series(x_col),
                    y_col: self._to_numeric_series(y_col),
                }).dropna()
                if plot_df.empty:
                    raise ValueError("لا توجد أزواج قيم رقمية صالحة لعرض مخطط التشتت.")

                ax.scatter(
                    plot_df[x_col],
                    plot_df[y_col],
                    color=self.ROYAL,
                    alpha=0.8,
                    s=65,
                    edgecolors="#FFFFFF",
                    linewidth=0.7,
                    label=f"{y_col} vs {x_col}",
                )
                ax.set_title(f"Scatter Plot: {y_col} vs {x_col}", fontsize=12, fontweight="bold", color=self.NAVY, pad=12)
                ax.set_xlabel(x_col, fontsize=10, fontweight="bold")
                ax.set_ylabel(y_col, fontsize=10, fontweight="bold")
                ax.grid(True, linestyle="--", alpha=0.45)
                ax.legend(loc="best")

            elif chart_type == "Histogram":
                target_col = y_col if y_is_num else (x_col if x_is_num else None)
                if target_col is None:
                    raise ValueError("المدرج التكراري (Histogram) يتطلب عموداً رقمياً في محور Y (أو محور X).")
                values = self._to_numeric_series(target_col).dropna()
                if values.empty:
                    raise ValueError(f"لا توجد قيم رقمية صالحة في العمود '{target_col}'.")

                bins = min(15, max(5, int(len(values) ** 0.5) + 2))
                ax.hist(
                    values,
                    bins=bins,
                    color=self.CHART_COLORS[4],
                    edgecolor="#FFFFFF",
                    alpha=0.88,
                    label=target_col,
                )
                mean_val = float(values.mean())
                ax.axvline(mean_val, color="#DC2626", linestyle="--", linewidth=1.6, label=f"Mean: {mean_val:,.2f}")
                ax.set_title(f"Histogram: Distribution of {target_col}", fontsize=12, fontweight="bold", color=self.NAVY, pad=12)
                ax.set_xlabel(target_col, fontsize=10, fontweight="bold")
                ax.set_ylabel("Frequency", fontsize=10, fontweight="bold")
                ax.grid(True, axis="y", linestyle="--", alpha=0.45)
                ax.legend(loc="best")

            elif chart_type == "Box Plot":
                if not y_is_num:
                    raise ValueError("مخطط الصندوق (Box Plot) يتطلب أن يكون محور Y عموداً رقمياً.")
                plot_df = self.df[[x_col]].copy()
                plot_df[y_col] = self._to_numeric_series(y_col)
                plot_df = plot_df.dropna(subset=[y_col])
                if plot_df.empty:
                    raise ValueError("لا توجد قيم رقمية صالحة في محور Y.")

                unique_groups = plot_df[x_col].astype(str).unique().tolist()
                if x_col == y_col or (x_is_num and len(unique_groups) > 10):
                    bp = ax.boxplot(
                        plot_df[y_col].tolist(),
                        patch_artist=True,
                        labels=[y_col],
                    )
                    for patch in bp["boxes"]:
                        patch.set_facecolor("#BFDBFE")
                        patch.set_edgecolor(self.NAVY)
                    ax.set_title(f"Box Plot: {y_col}", fontsize=12, fontweight="bold", color=self.NAVY, pad=12)
                    ax.set_ylabel(y_col, fontsize=10, fontweight="bold")
                else:
                    groups_data = []
                    group_labels = []
                    for grp in unique_groups[:12]:
                        vals = plot_df.loc[plot_df[x_col].astype(str) == grp, y_col].tolist()
                        if vals:
                            groups_data.append(vals)
                            group_labels.append(grp)
                    if not groups_data:
                        raise ValueError("لا توجد مجموعات صالحة لعرض Box Plot.")
                    bp = ax.boxplot(groups_data, patch_artist=True, labels=group_labels)
                    for idx, patch in enumerate(bp["boxes"]):
                        patch.set_facecolor(self.CHART_COLORS[idx % len(self.CHART_COLORS)])
                        patch.set_alpha(0.65)
                        patch.set_edgecolor(self.NAVY)
                    ax.set_title(f"Box Plot: {y_col} by {x_col}", fontsize=12, fontweight="bold", color=self.NAVY, pad=12)
                    ax.set_xlabel(x_col, fontsize=10, fontweight="bold")
                    ax.set_ylabel(y_col, fontsize=10, fontweight="bold")
                    if len(group_labels) > 6:
                        ax.tick_params(axis="x", rotation=25)

                ax.grid(True, axis="y", linestyle="--", alpha=0.45)

            self.figure.tight_layout()
            if self.canvas is not None:
                self.canvas.draw()
            return True

        except ValueError as err:
            if not silent_on_error:
                messagebox.showerror("اختيار غير مناسب للمخطط", str(err))
            return False
        except Exception as exc:
            if not silent_on_error:
                messagebox.showerror("خطأ غير متوقع", f"تعذر إنشاء المخطط:\n{exc}")
            return False


def main() -> None:
    root = tk.Tk()
    CSVChartApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
