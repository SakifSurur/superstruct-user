import QueryProvider from '@/components/QueryProvider';
import AuthSession from './AuthSession';

export default function AuthPanel() {
  return (
    <QueryProvider>
      <AuthSession />
    </QueryProvider>
  );
}
