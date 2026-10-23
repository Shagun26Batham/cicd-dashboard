"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricsPayload } from "@/lib/api";
import { formatDuration, formatPct } from "@/lib/format";

export function MetricsCharts({ metrics }: { metrics: MetricsPayload }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Pipeline Success Rate" value={formatPct(metrics.successRate)} sub="Overall passing runs" />
        <MetricCard
          label="Average Duration"
          value={formatDuration(metrics.avgBuildDurationMs)}
          sub="Mean build runtime"
        />
        <MetricCard
          label="Deployment Success"
          value={formatPct(metrics.deploymentSuccessRate)}
          sub={`${metrics.totalDeployments} total deployments`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Builds Over Time (14 Days)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={metrics.series}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="success" stackId="a" fill="#10b981" name="Success" radius={[0, 0, 0, 0]} />
              <Bar dataKey="failure" stackId="a" fill="#f43f5e" name="Failure" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Build Duration Trend">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={metrics.series}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [formatDuration(Number(value)), "Avg Duration"]}
              />
              <Line
                type="monotone"
                dataKey="avgDurationMs"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ fill: "#0284c7", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Deployment Frequency">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={metrics.series}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="deployments" fill="#818cf8" name="Deployments" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl shadow-black/20">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-white">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl shadow-black/20">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

const tooltipStyle = {
  background: "rgba(15, 23, 42, 0.95)",
  border: "1px solid #334155",
  borderRadius: 12,
  fontSize: 12,
  color: "#f8fafc",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
};
