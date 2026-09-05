import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, ArrowLeft, Download, HelpCircle, Info } from "lucide-react";

interface Book {
  id: number;
  title: string;
  author: string;
  ageGroup: string;
  coverUrl: string | null;
  description: string;
  pointsValue: number;
  readUrl: string | null;
}

export default function ReadBook() {
  const { id } = useParams();
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchBook = async () => {
      if (!token || !id) return;
      try {
        const res = await fetch(`${API_BASE}/api/books/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Failed to load book");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setBook(data);
      } catch (err) {
        setError("Failed to load book");
      } finally {
        setLoading(false);
      }
    };
    fetchBook();
  }, [token, id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading book...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => navigate("/library")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-3 h-16">
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")} data-testid="button-back-library">
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-sm truncate">{book?.title}</h1>
            <p className="text-xs text-muted-foreground">{book?.author}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Book info card */}
        <Card className="shadow-lg overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              {/* Book cover */}
              <div className="w-32 sm:w-40 flex-shrink-0">
                {book?.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt={`Cover of ${book.title}`}
                    className="w-full rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] rounded-lg shadow-lg bg-primary text-white flex items-center justify-center p-4 text-center">
                    <span className="font-bold text-sm">{book?.title}</span>
                  </div>
                )}
              </div>

              {/* Book details */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold mb-1">{book?.title}</h2>
                <p className="text-sm text-muted-foreground mb-3">by {book?.author}</p>
                {book?.description && (
                  <p className="text-sm text-muted-foreground mb-4">{book.description}</p>
                )}

                {/* Points badge */}
                <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-white text-sm font-bold shadow-sm mb-4">
                  <BookOpen className="w-4 h-4" />
                  {book?.pointsValue || 10} pts
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="mt-6 space-y-4">
          {book?.readUrl ? (
            <div>
              <Button
                onClick={() => window.open(book.readUrl!, "_blank", "noopener,noreferrer")}
                className="w-full"
                size="lg"
                data-testid="button-download-epub"
              >
                <Download className="w-5 h-5 mr-2" />
                Download EPUB
              </Button>
              <div className="mt-2 p-3 rounded-xl bg-muted border border-primary/20 text-center">
                <p className="text-xs text-primary flex items-center justify-center gap-1">
                  <Info className="w-3 h-3" />
                  Click to download the book file. Open it in Apple Books, Google Play Books, or any e-reader app.
                </p>
              </div>
            </div>
          ) : null}

          {/* Encouragement message */}
          <div className="p-4 rounded-xl bg-muted border border-primary/20 text-center">
            <p className="text-sm text-foreground font-medium">
              After reading, come back and take the quiz!
            </p>
          </div>

          {/* Take Quiz button */}
          <Button
            onClick={() => navigate(`/quiz/${id}`)}
            variant="outline"
            className="w-full"
            size="lg"
            data-testid="button-take-quiz"
          >
            <HelpCircle className="w-5 h-5 mr-2" />
            Take Quiz
          </Button>

          {/* Back to Library */}
          <Button
            onClick={() => navigate("/library")}
            variant="ghost"
            className="w-full"
            size="lg"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Library
          </Button>
        </div>
      </main>
    </div>
  );
}
