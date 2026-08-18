import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg p-10 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted">This posting may have expired or been removed by the employer.</p>
      <Link href="/" className="btn btn-primary mt-5">
        Back to job search
      </Link>
    </div>
  );
}
