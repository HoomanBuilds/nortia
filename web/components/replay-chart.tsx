"use client";

import { Check, Pause, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { replayEvents } from "@/lib/markets";

const series = [48, 49, 47, 51, 54, 61, 59, 64, 69, 73, 76, 82, 80, 88, 100, 100];
const eventPointIndexes = [0, 5, 10, 14, 15];
const width = 820;
const height = 350;
const pad = { top: 24, right: 54, bottom: 42, left: 18 };

function buildChart() {
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const points = series.map((value, index) => ({
    x: pad.left + (index / (series.length - 1)) * innerWidth,
    y: pad.top + (1 - value / 100) * innerHeight,
    value,
  }));
  let line = `M${points[0]!.x},${points[0]!.y}`;
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return { points, line, area: `${line} L${points.at(-1)!.x},${height - pad.bottom} L${points[0]!.x},${height - pad.bottom} Z` };
}

export function ReplayChart() {
  const [activeIndex, setActiveIndex] = useState(4);
  const [playing, setPlaying] = useState(false);
  const chart = useMemo(buildChart, []);
  const event = replayEvents[activeIndex]!;
  const marker = chart.points[eventPointIndexes[activeIndex]!]!;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        if (current >= replayEvents.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1100);
    return () => window.clearInterval(timer);
  }, [playing]);

  const restart = () => {
    setActiveIndex(0);
    setPlaying(true);
  };

  return (
    <div className="replay-chart-shell">
      <div className="chart-toolbar">
        <div className="chart-tabs"><button className="active" type="button">Probability</button><button type="button">Score</button></div>
        <div className="chart-legend"><span className="legend-over"><i />Over 2.5</span><span><i />50% midpoint</span></div>
        <div className="chart-range"><button type="button">1H</button><button type="button">MATCH</button><button className="active" type="button">ALL</button></div>
      </div>
      <div className="chart-summary">
        <div><span>YES probability</span><strong>{event.probability}<small>%</small></strong></div>
        <div className="chart-delta"><span>At {event.minute === 90 ? "full time" : `${event.minute}'`}</span><b>{event.label}</b></div>
        <div className="chart-score"><span>{event.score[0]}</span><small>:</small><span>{event.score[1]}</span></div>
      </div>
      <div className="chart-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Probability of over 2.5 goals through the match replay">
          <defs>
            <linearGradient id="probability-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </linearGradient>
            <filter id="marker-glow"><feGaussianBlur stdDeviation="5" result="blur" /></filter>
          </defs>
          {[0, 25, 50, 75, 100].map((value) => {
            const y = pad.top + (1 - value / 100) * (height - pad.top - pad.bottom);
            return <g key={value}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className={value === 50 ? "mid-grid" : "chart-grid"} /><text x={width - 7} y={y + 4} textAnchor="end" className="axis-label">{value}%</text></g>;
          })}
          <path d={chart.area} fill="url(#probability-area)" />
          <path d={chart.line} className="probability-line" />
          {eventPointIndexes.map((pointIndex, index) => {
            const point = chart.points[pointIndex]!;
            return <button key={index} aria-label={`Show ${replayEvents[index]!.label}`} onClick={() => { setActiveIndex(index); setPlaying(false); }}>
              <circle cx={point.x} cy={point.y} r={index === activeIndex ? 7 : 4} className={index <= activeIndex ? "event-dot active" : "event-dot"} />
            </button>;
          })}
          <line x1={marker.x} x2={marker.x} y1={pad.top} y2={height - pad.bottom} className="active-marker-line" />
          <circle cx={marker.x} cy={marker.y} r="14" className="marker-glow" filter="url(#marker-glow)" />
          <circle cx={marker.x} cy={marker.y} r="6" className="active-marker" />
          {[0, 19, 44, 68, 90].map((minute, index) => <text key={minute} x={pad.left + (eventPointIndexes[index]! / (series.length - 1)) * (width - pad.left - pad.right)} y={height - 12} textAnchor={index === 0 ? "start" : index === 4 ? "end" : "middle"} className="time-label">{minute === 0 ? "KICKOFF" : minute === 90 ? "FT" : `${minute}'`}</text>)}
        </svg>
        <div className="verified-event" style={{ left: `${Math.min(84, (marker.x / width) * 100)}%`, top: `${Math.max(6, (marker.y / height) * 100 - 17)}%` }}>
          <ShieldCheck size={12} /> Replay #{event.sequence}
        </div>
      </div>
      <div className="replay-controls">
        <button className="play-button" type="button" onClick={() => activeIndex === 4 ? restart() : setPlaying((value) => !value)}>
          {activeIndex === 4 && !playing ? <RotateCcw size={15} /> : playing ? <Pause size={15} /> : <Play size={15} />}
          {activeIndex === 4 && !playing ? "Replay match" : playing ? "Pause replay" : "Continue replay"}
        </button>
        <div className="event-scrubber">
          {replayEvents.map((item, index) => <button type="button" key={item.sequence} className={index <= activeIndex ? "scrubber-step active" : "scrubber-step"} onClick={() => { setActiveIndex(index); setPlaying(false); }} aria-label={`Jump to ${item.label}`}><span>{index < activeIndex ? <Check size={10} /> : index + 1}</span><small>{item.minute === 90 ? "FT" : `${item.minute}'`}</small></button>)}
        </div>
        <div className="source-verified"><ShieldCheck size={15} /><span>5 of 5 deterministic events</span></div>
      </div>
    </div>
  );
}
