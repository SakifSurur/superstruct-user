import { Card, CardContent } from '@/components/ui/card';

interface Props {
  label: string;
  value: string;
  tone?: 'bad';
}

export default function StatTile({ label, value, tone }: Props) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-3xl font-semibold ${tone === 'bad' ? 'text-red-700' : ''}`}>
          {tone === 'bad' && <span aria-hidden="true">⚠ </span>}
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
