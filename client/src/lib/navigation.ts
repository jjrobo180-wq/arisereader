type Navigate = (to: string, options?: { replace?: boolean }) => void;

/**
 * Go back in browser history, but recover from hash-router redirect loops.
 * Example: an admin on /admin goes back to /, then / immediately redirects
 * to /admin. In that case the button appears to do nothing, so we send the
 * user to a stable in-app fallback instead.
 */
export function safeBack(navigate: Navigate, fallback = "/library") {
  const startingHref = window.location.href;

  if (window.history.length <= 1) {
    navigate(fallback);
    return;
  }

  window.history.back();

  window.setTimeout(() => {
    if (window.location.href === startingHref) {
      navigate(fallback);
    }
  }, 350);
}
