"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export function PerformanceChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <div
      className="performance-chart"
      role="img"
      aria-label={data.map((d) => `${d.name}: ${d.value}`).join(", ")}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 12, right: 10, left: -25, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="#edf0f5"
          />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#8791a6" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#8791a6" }}
          />
          <Tooltip
            cursor={{ fill: "#f5f6ff" }}
            contentStyle={{
              border: "1px solid #e8ebf3",
              borderRadius: 10,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="value"
            name="Total"
            fill="#7060ea"
            radius={[5, 5, 0, 0]}
            maxBarSize={38}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div
      className="score-ring"
      style={{
        background: `conic-gradient(#6a5be7 ${clamped * 3.6}deg, #efedf9 0)`,
      }}
    >
      <div>
        <strong>
          {score.toFixed(1)}
          <small>%</small>
        </strong>
        <span>Your score</span>
      </div>
    </div>
  );
}
