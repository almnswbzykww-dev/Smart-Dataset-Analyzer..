import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import {
  AGG_MODE_LABELS_AR,
  type AggMode,
  type ChartType,
  type Dataset,
} from '../types/app';
import { canvasToHighResPngDataUrl, formatNum } from '../utils/csvParser';
import { prepareSmartChartData } from '../utils/smartDataEngine';

Chart.register(ChartDataLabels);

export interface ChartRendererHandle {
  getPngDataUrl: () => string | null;
}

interface ChartRendererProps {
  dataset: Dataset;
  xCol: string;
  yCol: string;
  chartType: ChartType;
  aggMode: AggMode;
  heightClass?: string;
}

const PALETTE = ['#106e4f', '#148b64', '#c5a059', '#0ea5e9', '#059669', '#f59e0b', '#6366f1', '#0d9488', '#64748b'];

export const ChartRenderer = React.forwardRef<ChartRendererHandle, ChartRendererProps>(
  ({ dataset, xCol, yCol, chartType, aggMode, heightClass = 'h-72' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstanceRef = useRef<Chart | null>(null);

    useImperativeHandle(ref, () => ({
      getPngDataUrl: () => {
        if (!canvasRef.current) return null;
        return canvasToHighResPngDataUrl(canvasRef.current);
      },
    }));

    const prepared = useMemo(
      () => prepareSmartChartData(dataset, xCol, yCol, chartType, aggMode),
      [dataset, xCol, yCol, chartType, aggMode]
    );

    useEffect(() => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }

      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      if (prepared.kind === 'Bar' || prepared.kind === 'Line' || prepared.kind === 'Pie') {
        const { labels, values, effectiveY, effectiveAgg } = prepared;
        const typeMap: Record<'Bar' | 'Line' | 'Pie', 'bar' | 'line' | 'pie'> = {
          Bar: 'bar',
          Line: 'line',
          Pie: 'pie',
        };
        const jsType = typeMap[prepared.kind];
        const isLine = prepared.kind === 'Line';
        const isPie = prepared.kind === 'Pie';
        const showLabels = isPie ? values.length <= 10 : values.length <= 16;

        chartInstanceRef.current = new Chart(ctx, {
          type: jsType,
          data: {
            labels,
            datasets: [
              {
                label: `${effectiveY} (${AGG_MODE_LABELS_AR[effectiveAgg]})`,
                data: values,
                backgroundColor: isLine
                  ? 'rgba(16, 110, 79, 0.18)'
                  : values.map((_, i) => PALETTE[i % PALETTE.length]),
                borderColor: isLine ? '#106e4f' : '#ffffff',
                borderWidth: isPie ? 2 : isLine ? 3 : 0,
                borderRadius: prepared.kind === 'Bar' ? 6 : 0,
                pointBackgroundColor: '#c5a059',
                pointBorderColor: '#01120c',
                pointRadius: isLine ? (values.length > 30 ? 3 : 5) : 0,
                tension: isLine ? 0.28 : 0,
                fill: isLine,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: '#01120c', font: { family: 'Cairo', weight: 'bold', size: 11 } },
              },
              datalabels: {
                display: showLabels,
                color: isPie ? '#ffffff' : '#01120c',
                anchor: isPie ? 'center' : 'end',
                align: isPie ? 'center' : 'top',
                font: { family: 'Cairo', weight: 'bold', size: 10 },
                formatter: (v: number) => formatNum(v, 1),
              },
            },
          },
        });
      } else if (prepared.kind === 'Scatter') {
        const { points, xTitle, yTitle, useNumericX, xTickLabels, totalMatchedPoints } = prepared;
        const pointRadius = points.length > 350 ? 3.5 : points.length > 100 ? 5 : 7;

        chartInstanceRef.current = new Chart(ctx, {
          type: 'scatter',
          data: {
            datasets: [
              {
                label: `تشتت ${yTitle} مقابل ${xTitle} (${formatNum(points.length, 0)} من أصل ${formatNum(totalMatchedPoints, 0)} نقطة)`,
                data: points.map((p) => ({ x: p.x, y: p.y })),
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderColor: '#b45309',
                borderWidth: points.length > 300 ? 1 : 2,
                pointRadius,
                pointHoverRadius: pointRadius + 3,
                pointStyle: 'circle',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: 'linear',
                position: 'bottom',
                title: { display: true, text: xTitle, color: '#0f172a', font: { family: 'Cairo', weight: 'bold' } },
                ticks: {
                  color: '#334155',
                  font: { family: 'Cairo', size: 11 },
                  callback: (val) => {
                    if (useNumericX) return formatNum(Number(val), 1);
                    const idx = Math.round(Number(val)) - 1;
                    if (xTickLabels && Number.isInteger(Number(val)) && xTickLabels[idx]) {
                      return xTickLabels[idx];
                    }
                    return Number.isInteger(Number(val)) && points[idx] ? points[idx].rawLabel.slice(0, 14) : '';
                  },
                },
              },
              y: {
                type: 'linear',
                title: { display: true, text: yTitle, color: '#0f172a', font: { family: 'Cairo', weight: 'bold' } },
                ticks: { color: '#334155', font: { family: 'Cairo', size: 11 } },
              },
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: '#01120c', font: { family: 'Cairo', weight: 'bold', size: 11 } },
              },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const pt = points[context.dataIndex];
                    if (!pt) return '';
                    return `${pt.rawLabel} — ${yTitle}: ${formatNum(pt.y)}`;
                  },
                },
              },
              datalabels: { display: false },
            },
          },
        });
      } else if (prepared.kind === 'Histogram') {
        const { labels, counts, mean, targetCol, isCategoricalFrequency } = prepared;
        chartInstanceRef.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: isCategoricalFrequency
                  ? `التكرارات لقيم (${targetCol})`
                  : `التوزيع التكراري (${targetCol}) • المتوسط: ${formatNum(mean, 1)}`,
                data: counts,
                backgroundColor: '#0ea5e9',
                borderColor: '#0369a1',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.96,
                categoryPercentage: 0.96,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                title: {
                  display: true,
                  text: isCategoricalFrequency ? `قيم ${targetCol}` : `نطاق ${targetCol}`,
                  color: '#0f172a',
                  font: { family: 'Cairo', weight: 'bold' },
                },
              },
              y: {
                beginAtZero: true,
                title: { display: true, text: 'التكرار', color: '#0f172a', font: { family: 'Cairo', weight: 'bold' } },
              },
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: '#01120c', font: { family: 'Cairo', weight: 'bold', size: 11 } },
              },
              datalabels: {
                display: counts.length <= 16,
                color: '#0f172a',
                anchor: 'end',
                align: 'top',
                font: { family: 'Cairo', weight: 'bold', size: 10 },
                formatter: (v: number) => formatNum(v, 0),
              },
            },
          },
        });
      } else if (prepared.kind === 'Box Plot') {
        const { groups, targetYCol } = prepared;
        const floatingRanges = groups.map((g) => [g.q1, g.q3] as [number, number]);

        const whiskerPlugin = {
          id: 'boxPlotWhiskers',
          afterDatasetsDraw(chart: Chart) {
            const { ctx: c, scales } = chart;
            const xScale = scales.x;
            const yScale = scales.y;
            if (!xScale || !yScale) return;

            c.save();
            groups.forEach((g, idx) => {
              const xPx = xScale.getPixelForValue(idx);
              const yMin = yScale.getPixelForValue(g.min);
              const yMax = yScale.getPixelForValue(g.max);
              const yQ1 = yScale.getPixelForValue(g.q1);
              const yQ3 = yScale.getPixelForValue(g.q3);
              const yMed = yScale.getPixelForValue(g.median);

              c.strokeStyle = '#0f172a';
              c.lineWidth = 2;

              c.beginPath();
              c.moveTo(xPx, yQ3);
              c.lineTo(xPx, yMax);
              c.moveTo(xPx - 10, yMax);
              c.lineTo(xPx + 10, yMax);
              c.stroke();

              c.beginPath();
              c.moveTo(xPx, yQ1);
              c.lineTo(xPx, yMin);
              c.moveTo(xPx - 10, yMin);
              c.lineTo(xPx + 10, yMin);
              c.stroke();

              c.strokeStyle = '#dc2626';
              c.lineWidth = 3;
              c.beginPath();
              c.moveTo(xPx - 18, yMed);
              c.lineTo(xPx + 18, yMed);
              c.stroke();
            });
            c.restore();
          },
        };

        chartInstanceRef.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: groups.map((g) => g.label),
            datasets: [
              {
                label: `المدى الربعي (Q1–Q3) والوسيط — ${targetYCol}`,
                data: floatingRanges,
                backgroundColor: groups.map((_, i) => PALETTE[i % PALETTE.length] + '99'),
                borderColor: '#0f172a',
                borderWidth: 1.5,
                barThickness: 36,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { title: { display: true, text: targetYCol, color: '#0f172a', font: { family: 'Cairo', weight: 'bold' } } },
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: '#01120c', font: { family: 'Cairo', weight: 'bold', size: 11 } },
              },
              datalabels: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const g = groups[context.dataIndex];
                    if (!g) return '';
                    return [
                      `الحد الأقصى (Max): ${formatNum(g.max)}`,
                      `الربيع الثالث (Q3): ${formatNum(g.q3)}`,
                      `الوسيط (Median): ${formatNum(g.median)}`,
                      `الربيع الأول (Q1): ${formatNum(g.q1)}`,
                      `الحد الأدنى (Min): ${formatNum(g.min)}`,
                      `عدد السجلات: ${formatNum(g.count, 0)}`,
                    ];
                  },
                },
              },
            },
          },
          plugins: [whiskerPlugin],
        });
      }

      return () => {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
          chartInstanceRef.current = null;
        }
      };
    }, [prepared]);

    return (
      <div className="w-full flex flex-col gap-2">
        {prepared.adaptationNotice && (
          <div className="bg-sky-50 border border-sky-200 text-sky-900 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>{prepared.adaptationNotice}</span>
          </div>
        )}
        <div className={`relative ${heightClass} w-full`}>
          <canvas ref={canvasRef} />
        </div>
      </div>
    );
  }
);

ChartRenderer.displayName = 'ChartRenderer';
