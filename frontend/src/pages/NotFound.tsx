import { Link } from 'react-router-dom';
import { THEME } from '../config/theme'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="text-8xl mb-4">{THEME.brand.mark}</div>
      <h1 className="text-4xl font-bold text-brand-ink mb-2">404</h1>
      <p className="text-brand-dust mb-6">This racer fell asleep...</p>
      <Link to="/" className="bg-green-600 hover:bg-green-700 text-brand-ink px-6 py-3 rounded-lg font-medium">
        Back to Home
      </Link>
    </div>
  );
}
