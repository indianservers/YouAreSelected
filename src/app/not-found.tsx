import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <span className="eyebrow">404 · PAGE NOT FOUND</span>
      <h1>A little off course.</h1>
      <p>The page you’re looking for doesn’t exist.</p>
      <Link className="btn btn-primary" href="/">
        Back to home
      </Link>
    </main>
  );
}
