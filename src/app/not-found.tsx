import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-lg mb-6">The page you're looking for doesn't exist.</p>
      <Link href="/" className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80">
        Return Home
      </Link>
    </div>
  );
}