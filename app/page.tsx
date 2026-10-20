export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-xl space-y-4">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Local-first · Private by default
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">SlothSort</h1>
        <p className="text-lg text-muted-foreground">
          Drop the clutter. Let the sloth handle it.
        </p>
        <p className="text-sm text-muted-foreground">
          Project foundation is in place. The scanner, local Gemma suggestions,
          duplicate detection, and review workflow come next.
        </p>
      </div>
    </main>
  );
}
