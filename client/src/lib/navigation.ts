type Navigate = (to: string, options?: { replace?: boolean }) => void;

/**
 * Go back in browser history, but recover from hash-router redirect loops.
 * If history cannot move somewhere meaningful, use a stable in-app fallback.
 */
export function safeBack(navigate: Navigate, fallback = "/library") {
  const startingHref = window.location.href;

  if (window.history.length <= 1) {
    navigate(fallback, { replace: true });
    return;
  }

  window.history.back();

  window.setTimeout(() => {
    if (window.location.href === startingHref) {
      navigate(fallback, { replace: true });
    }
  }, 250);
}
