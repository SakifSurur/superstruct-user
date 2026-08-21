import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { SERIES_LATENCY, type ChartRow } from './chart-data';

const config = {
  latency: { label: 'p99 latency (ms)', color: SERIES_LATENCY },
} satisfies ChartConfig;

export default function LatencyChart({ rows }: { rows: ChartRow[] }) {
  return (
    <ChartContainer config={config} className="h-48 w-full">
      <LineChart data={rows} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.35} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={48} />
        <YAxis width={44} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="latency"
          stroke="var(--color-latency)"
          strokeWidth={2}
          dot={false}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
}
