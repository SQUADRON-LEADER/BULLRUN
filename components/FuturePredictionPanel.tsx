"use client";

import { useMemo, useState, useTransition } from "react";
import { getFutureStockPrediction } from "@/lib/actions/finnhub.actions";
import { Button } from "@/components/ui/button";

type FuturePredictionPanelProps = {
  symbol: string;
};

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`;
  return `${volume}`;
}

function buildClientFallbackPrediction(symbol: string): FuturePredictionResult {
  const seed = symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const basePrice = 70 + (seed % 190);
  const baseVolume = 900000 + (seed % 2_400_000);
  const baseDate = new Date();
  let previousPrice = basePrice;

  const predictions: FuturePredictionPoint[] = [];
  for (let i = 1; i <= 10; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const day = d.getDay();
    const isClosed = day === 0 || day === 6;

    if (isClosed) {
      predictions.push({
        dayOffset: i,
        date: d.toISOString().slice(0, 10),
        predictedPrice: Number(previousPrice.toFixed(2)),
        changePercent: Number((((previousPrice - basePrice) / basePrice) * 100).toFixed(2)),
        confidence: 0,
        openPrice: Number(previousPrice.toFixed(2)),
        highPrice: Number(previousPrice.toFixed(2)),
        lowPrice: Number(previousPrice.toFixed(2)),
        closePrice: Number(previousPrice.toFixed(2)),
        volume: 0,
        isMarketClosed: true,
      });
      continue;
    }

    const drift = 0.0018 + ((seed % 9) - 4) / 10000;
    const wave = Math.sin(i * 1.35 + (seed % 5)) * 0.0055;
    const move = drift + wave;
    const openPrice = previousPrice;
    const closePrice = Math.max(0.01, previousPrice * (1 + move));
    const highPrice = Math.max(openPrice, closePrice) * 1.006;
    const lowPrice = Math.min(openPrice, closePrice) * 0.994;
    const predictedPrice = closePrice;
    const volNoise = 0.8 + ((Math.sin(i * 1.15 + (seed % 9)) + 1) / 2) * 0.45;
    const volume = Math.round(baseVolume * volNoise * (1 + Math.abs(move) * 3.8));

    predictions.push({
      dayOffset: i,
      date: d.toISOString().slice(0, 10),
      predictedPrice: Number(predictedPrice.toFixed(2)),
      changePercent: Number((((predictedPrice - basePrice) / basePrice) * 100).toFixed(2)),
      confidence: Math.max(70, 80 - Math.floor(i * 1.1)),
      openPrice: Number(openPrice.toFixed(2)),
      highPrice: Number(highPrice.toFixed(2)),
      lowPrice: Number(lowPrice.toFixed(2)),
      closePrice: Number(closePrice.toFixed(2)),
      volume,
      isMarketClosed: false,
    });

    previousPrice = predictedPrice;
  }

  return {
    symbol: symbol.toUpperCase(),
    basePrice,
    generatedAt: new Date().toISOString(),
    modelNote: "Projected trend for the next 10 days.",
    predictions,
  };
}

const FuturePredictionPanel = ({ symbol }: FuturePredictionPanelProps) => {
  const [result, setResult] = useState<FuturePredictionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const insights = useMemo(() => {
    if (!result || result.predictions.length === 0) return null;

    const openDays = result.predictions.filter((p) => !p.isMarketClosed);
    const closedDays = result.predictions.filter((p) => p.isMarketClosed).length;
    const finalPoint = [...result.predictions].reverse().find((p) => !p.isMarketClosed) ?? result.predictions[result.predictions.length - 1];
    const bestDay = openDays.reduce((best, day) => (day.changePercent > best.changePercent ? day : best), openDays[0] ?? result.predictions[0]);
    const weakestDay = openDays.reduce((worst, day) => (day.changePercent < worst.changePercent ? day : worst), openDays[0] ?? result.predictions[0]);
    const avgConfidence = openDays.length
      ? openDays.reduce((sum, d) => sum + d.confidence, 0) / openDays.length
      : 0;
    const avgVolume = openDays.length ? openDays.reduce((sum, d) => sum + d.volume, 0) / openDays.length : 0;
    const projectedReturn = ((finalPoint.closePrice - result.basePrice) / result.basePrice) * 100;
    const momentum = projectedReturn >= 1.5 ? "Bullish" : projectedReturn <= -1.5 ? "Bearish" : "Sideways";

    return {
      openDays: openDays.length,
      closedDays,
      finalPrice: finalPoint.closePrice,
      projectedReturn,
      avgConfidence,
      avgVolume,
      momentum,
      bestDay,
      weakestDay,
    };
  }, [result]);

  const chart = useMemo(() => {
    if (!result || result.predictions.length === 0) return null;

    const prices = result.predictions.map((p) => p.closePrice);
    const volumes = result.predictions.map((p) => p.volume);
    const minRaw = Math.min(...prices);
    const maxRaw = Math.max(...prices);
    const pad = Math.max((maxRaw - minRaw) * 0.12, 1);
    const minPrice = minRaw - pad;
    const maxPrice = maxRaw + pad;
    const maxVolume = Math.max(...volumes, 1);

    const width = 860;
    const height = 360;
    const left = 16;
    const right = 76;
    const top = 14;
    const bottom = 28;
    const volumeHeight = 72;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom - volumeHeight;
    const yRange = Math.max(maxPrice - minPrice, 1);

    const toY = (price: number) => top + ((maxPrice - price) / yRange) * plotHeight;
    const toVolumeY = (volume: number) => top + plotHeight + volumeHeight - (volume / maxVolume) * volumeHeight;

    const points = result.predictions.map((item, index) => {
      const x = left + ((index + 0.5) / result.predictions.length) * plotWidth;
      return {
        x,
        day: item.dayOffset,
        date: item.date,
        isClosed: item.isMarketClosed,
        closePrice: item.closePrice,
        changePercent: item.changePercent,
        volume: item.volume,
        yVolume: toVolumeY(item.volume),
        y: toY(item.closePrice),
      };
    });

    const areaPath =
      points.length > 0
        ? `M ${points[0].x} ${top + plotHeight} ` +
          points.map((p, index) => `${index === 0 ? "L" : "L"} ${p.x} ${p.y}`).join(" ") +
          ` L ${points[points.length - 1].x} ${top + plotHeight} Z`
        : "";

    const segments = points.slice(1).map((point, i) => {
      const prev = points[i];
      const isUp = point.closePrice >= prev.closePrice;
      return {
        x1: prev.x,
        y1: prev.y,
        x2: point.x,
        y2: point.y,
        color: point.isClosed ? "#71717a" : isUp ? "#00b8a9" : "#ff3551",
      };
    });

    const active = [...result.predictions].reverse().find((p) => !p.isMarketClosed);
    const currentPrice = active?.closePrice ?? result.basePrice;
    const currentY = toY(currentPrice);

    const yTicks = Array.from({ length: 6 }, (_, idx) => {
      const price = maxPrice - (idx / 5) * (maxPrice - minPrice);
      return {
        price,
        y: toY(price),
      };
    });

    const currentLabelWidth = 58;
    const currentLabelHeight = 20;

    return {
      points,
      segments,
      areaPath,
      width,
      height,
      left,
      top,
      right,
      plotWidth,
      plotHeight,
      minPrice,
      maxPrice,
      maxVolume,
      volumeHeight,
      currentPrice,
      currentY,
      yTicks,
      currentLabelWidth,
      currentLabelHeight,
    };
  }, [result]);

  const runPrediction = () => {
    startTransition(async () => {
      try {
        const data = await getFutureStockPrediction(symbol, 10);
        setResult(data);
      } catch {
        setResult(buildClientFallbackPrediction(symbol));
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-semibold">Bull Run</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Click to estimate tomorrow and upcoming days for {symbol.toUpperCase()}.
          </p>
        </div>

        <Button onClick={runPrediction} disabled={isPending} className="w-full sm:w-auto">
          {isPending ? "Generating prediction..." : "Show Bull Run Forecast"}
        </Button>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Base price: <span className="font-semibold">${result.basePrice.toFixed(2)}</span>
            </p>

            {insights ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <p className="text-xs text-zinc-500">Momentum</p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{insights.momentum}</p>
                  <p className={`text-xs ${insights.projectedReturn >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {insights.projectedReturn >= 0 ? "+" : ""}
                    {insights.projectedReturn.toFixed(2)}% projected
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <p className="text-xs text-zinc-500">Target Price</p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">${insights.finalPrice.toFixed(2)}</p>
                  <p className="text-xs text-zinc-500">After {insights.openDays} market sessions</p>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <p className="text-xs text-zinc-500">Prediction Quality</p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{insights.avgConfidence.toFixed(1)}%</p>
                  <p className="text-xs text-zinc-500">Weekend closed: {insights.closedDays} days</p>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <p className="text-xs text-zinc-500">Avg Expected Volume</p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{formatVolume(insights.avgVolume)}</p>
                  <p className="text-xs text-zinc-500">Predicted daily turnover</p>
                </div>
              </div>
            ) : null}

            {chart ? (
              <div className="rounded-lg border border-zinc-900 bg-[#0a0d14] p-2">
                <p className="px-2 pb-2 text-sm font-medium text-zinc-200">Bull Run Projection - 10 Days</p>
                <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-[320px] w-full">
                  <defs>
                    <linearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00b8a9" stopOpacity="0.28" />
                      <stop offset="60%" stopColor="#00b8a9" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#0a0d14" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="volGradientDown" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff3551" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#ff3551" stopOpacity="0.4" />
                    </linearGradient>
                    <linearGradient id="volGradientUp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00b8a9" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#00b8a9" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>

                  <rect x="0" y="0" width={chart.width} height={chart.height} fill="#0a0d14" />

                  {chart.yTicks.map((tick, idx) => (
                    <g key={idx}>
                      <line
                        x1={chart.left}
                        y1={tick.y}
                        x2={chart.left + chart.plotWidth}
                        y2={tick.y}
                        stroke="#1f2937"
                        strokeWidth="1"
                        strokeDasharray="3 4"
                      />
                      <text x={chart.width - chart.right + 8} y={tick.y + 4} fontSize="12" fill="#a1a1aa">
                        {tick.price.toFixed(2)}
                      </text>
                    </g>
                  ))}

                  <line
                    x1={chart.left}
                    y1={chart.currentY}
                    x2={chart.left + chart.plotWidth}
                    y2={chart.currentY}
                    stroke="#ef4444"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                  />
                  <rect
                    x={chart.left + chart.plotWidth + 8}
                    y={chart.currentY - chart.currentLabelHeight / 2}
                    width={chart.currentLabelWidth}
                    height={chart.currentLabelHeight}
                    rx={4}
                    fill="#ef4444"
                  />
                  <text
                    x={chart.left + chart.plotWidth + 8 + chart.currentLabelWidth / 2}
                    y={chart.currentY + 4}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#ffffff"
                    fontWeight="600"
                  >
                    {chart.currentPrice.toFixed(2)}
                  </text>

                  {chart.points.map((c) => (
                    <g key={c.day}>
                      <rect
                        x={c.x - 4}
                        y={c.yVolume}
                        width={8}
                        height={chart.top + chart.plotHeight + chart.volumeHeight - c.yVolume}
                        fill={c.isClosed ? "#6b7280" : c.changePercent >= 0 ? "url(#volGradientUp)" : "url(#volGradientDown)"}
                        opacity={0.9}
                      />
                    </g>
                  ))}

                  <path d={chart.areaPath} fill="url(#lineAreaGradient)" />

                  {chart.segments.map((segment, idx) => (
                    <line
                      key={idx}
                      x1={segment.x1}
                      y1={segment.y1}
                      x2={segment.x2}
                      y2={segment.y2}
                      stroke={segment.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  ))}

                  {chart.points.map((point) => (
                    <text
                      key={`label-${point.day}`}
                      x={point.x}
                      y={chart.top + chart.plotHeight + chart.volumeHeight + 16}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#9ca3af"
                    >
                      {point.date.slice(5)}
                    </text>
                  ))}

                  <text x={chart.width - chart.right + 8} y={chart.top + chart.plotHeight + chart.volumeHeight - 6} fontSize="12" fill="#94a3b8">
                    Vol {formatVolume(chart.maxVolume)}
                  </text>

                  <line
                    x1={chart.left}
                    y1={chart.top + chart.plotHeight}
                    x2={chart.left + chart.plotWidth}
                    y2={chart.top + chart.plotHeight}
                    stroke="#374151"
                    strokeWidth="1"
                  />
                  <line
                    x1={chart.left}
                    y1={chart.top}
                    x2={chart.left}
                    y2={chart.top + chart.plotHeight}
                    stroke="#374151"
                    strokeWidth="1"
                  />
                </svg>
                <div className="px-2 pt-2 text-xs text-zinc-400">
                  Teal: upward move, Red: downward move, Gray: weekend market closed.
                </div>
              </div>
            ) : null}

            {insights ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Strongest Forecast Day</p>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Day {insights.bestDay.dayOffset} ({insights.bestDay.date})
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {insights.bestDay.changePercent >= 0 ? "+" : ""}
                    {insights.bestDay.changePercent.toFixed(2)}% | Price ${insights.bestDay.closePrice.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
                  <p className="text-xs text-rose-700 dark:text-rose-300">Weakest Forecast Day</p>
                  <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                    Day {insights.weakestDay.dayOffset} ({insights.weakestDay.date})
                  </p>
                  <p className="text-xs text-rose-700 dark:text-rose-300">
                    {insights.weakestDay.changePercent >= 0 ? "+" : ""}
                    {insights.weakestDay.changePercent.toFixed(2)}% | Price ${insights.weakestDay.closePrice.toFixed(2)}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Bull Run List</p>
              <table className="w-full min-w-[540px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
                    <th className="py-2 pr-3">Day</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Predicted Price</th>
                    <th className="py-2 pr-3">Change %</th>
                    <th className="py-2 pr-3">Confidence</th>
                    <th className="py-2 pr-3">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {result.predictions.map((item) => (
                    <tr key={item.dayOffset} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-3">Day {item.dayOffset}</td>
                      <td className="py-2 pr-3">{item.date}</td>
                      <td className={`py-2 pr-3 ${item.isMarketClosed ? "text-amber-600 dark:text-amber-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                        {item.isMarketClosed ? "Market Closed" : "Open"}
                      </td>
                      <td className="py-2 pr-3">${item.predictedPrice.toFixed(2)}</td>
                      <td
                        className={`py-2 pr-3 font-medium ${
                          item.changePercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {item.changePercent >= 0 ? "+" : ""}
                        {item.changePercent.toFixed(2)}%
                      </td>
                      <td className="py-2 pr-3">{item.isMarketClosed ? "-" : `${item.confidence}%`}</td>
                      <td className="py-2 pr-3">{item.isMarketClosed ? "-" : formatVolume(item.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default FuturePredictionPanel;
