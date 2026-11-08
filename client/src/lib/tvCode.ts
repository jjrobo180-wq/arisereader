/** The Apple TV's sign-in code in the address, after the "#" (#/tv?code=K7QX2M, where arisetodo.com/tv?code=
 *  and signing in first both land) or before it. Upper case, letters and digits only, 6 at most. */
export function tvCodeFromAddress(loc: { search: string; hash: string }): string {
  const fromHash = new URLSearchParams(loc.hash.split("?")[1] ?? "").get("code");
  const raw = fromHash ?? new URLSearchParams(loc.search).get("code") ?? "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
