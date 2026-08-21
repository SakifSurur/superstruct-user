import QueryProvider from '@/components/QueryProvider';
import MetricsDashboard from './MetricsDashboard';

export default function MetricsPanel() {
  return (
    <QueryProvider>
      <MetricsDashboard />
    </QueryProvider>
  );
}
