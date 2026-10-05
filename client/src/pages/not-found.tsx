import { BookOpen, Home } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md bg-card">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
            <BookOpen className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-foreground">We can't find that page</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The link may be old or mistyped. Head back to the start and pick up where you left off.
            </p>
          </div>
          <Button asChild className="gap-2 rounded-full px-6">
            <a href="#/" data-testid="not-found-home">
              <Home className="h-4 w-4" /> Go to A.R.I.S.E. Reader
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
