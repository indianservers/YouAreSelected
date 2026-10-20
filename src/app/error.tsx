"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Let’s try that again.</h1>
      <p>
        The workspace couldn’t load this view. Retry the request or contact your
        administrator if the problem continues.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
