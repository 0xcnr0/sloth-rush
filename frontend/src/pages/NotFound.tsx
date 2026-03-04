import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="text-8xl mb-4">&#x1F40C;</div>
      <h1 className="text-4xl font-bold text-gray-200 mb-2">404</h1>
      <p className="text-gray-400 mb-6">Bu salyangoz yolunu kaybetti...</p>
      <Link to="/" className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium">
        Ana Sayfaya Don
      </Link>
    </div>
  );
}
