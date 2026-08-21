import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { SERIES_REQUESTS, type ChartRow } from './chart-data';

const config = {
  requests: { label: 'Requests', color: SERIES_REQUESTS },
} satisfies ChartConfig;

export default function RequestsChart({ rows }: { rows: ChartRow[] }) {
  return (
    <ChartContainer config={config} className="h-48 w-full">
      <BarChart data={rows} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.35} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={48} />
        <YAxis width={36} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="requests" fill="var(--color-requests)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
