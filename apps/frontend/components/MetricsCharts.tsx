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
        <MetricCard label="Success rate" value={formatPct(metrics.successRate)} />
        <MetricCard label="Avg build duration" value={formatDuration(metrics.avgBuildDurationMs)} />
        <MetricCard
          label="Deploy success"
          value={formatPct(metrics.deploymentSuccessRate)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Builds over time">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.series}>
              <CartesianGrid stroke="#243049" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#93a0bb", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#93a0bb", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="success" stackId="a" fill="#34d399" name="success" />
              <Bar dataKey="failure" stackId="a" fill="#fb7185" name="failure" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Build duration trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={metrics.series}>
              <CartesianGrid stroke="#243049" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#93a0bb", fontSize: 11 }} />
              <YAxis tick={{ fill: "#93a0bb", fontSize: 11 }} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => formatDuration(Number(value))}
              />
              <Line type="monotone" dataKey="avgDurationMs" stroke="#38bdf8" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Deployment frequency">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.series}>
              <CartesianGrid stroke="#243049" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#93a0bb", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#93a0bb", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="deployments" fill="#a78bfa" name="deployments" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#243049] bg-[#121b2d] p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#243049] bg-[#121b2d] p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

const tooltipStyle = {
  background: "#121b2d",
  border: "1px solid #243049",
  borderRadius: 8,
};
