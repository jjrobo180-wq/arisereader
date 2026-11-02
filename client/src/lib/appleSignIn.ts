// Sign in with Apple inside the iPhone apps (plugin: @capacitor-community/apple-sign-in). iOS shows
// Apple's own sheet (Face ID or the Apple ID password) and hands back an identity token, which the
// server checks with Apple (server/appleSignIn.ts). The website doesn't offer it.
import { hasNativePlugin, nativeCall } from "./nativeApp";

const PLUGIN = /signinwithapple|applesignin/i;

/** True in an app build that has Sign in with Apple. */
export const appleSignInAvailable = (): boolean => hasNativePlugin(PLUGIN);

export type AppleResult = { identityToken: string; authorizationCode?: string; givenName?: string; familyName?: string; email?: string };

/** Opens Apple's sign-in sheet. Resolves null when the person closes it. */
export async function askApple(clientId: string): Promise<AppleResult | null> {
  const state = Math.random().toString(36).slice(2), nonce = Math.random().toString(36).slice(2);
  try {
    const res = await nativeCall(PLUGIN, "SignInWithApple", "authorize", { clientId, redirectURI: "https://arisetodo.com/", scopes: "email name", state, nonce });
    const r = res?.response || {};
    if (typeof r.identityToken !== "string" || !r.identityToken) throw new Error("Apple didn't send a sign-in. Try again.");
    return { identityToken: r.identityToken, authorizationCode: r.authorizationCode || undefined, givenName: r.givenName || undefined, familyName: r.familyName || undefined, email: r.email || undefined };
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    // Closing Apple's sheet (error 1001) isn't a failure worth a message.
    if (/1001|cancel/i.test(msg)) return null;
    if (/1000|unknown/i.test(msg)) throw new Error("Sign in with Apple isn't switched on for this build yet. Update the app, then try again.");
    throw new Error(msg || "Sign in with Apple didn't work. Try again.");
  }
}

/** Apple's logo, for the button (Apple's guidelines: black button, white logo, "Sign in with Apple"). */
export const APPLE_LOGO_PATH = "M16.37 12.6c-.02-2.32 1.9-3.44 1.98-3.5-1.08-1.58-2.76-1.8-3.36-1.82-1.43-.14-2.79.84-3.52.84-.72 0-1.84-.82-3.03-.8-1.56.02-3 .91-3.8 2.3-1.62 2.81-.41 6.97 1.17 9.25.77 1.12 1.69 2.37 2.9 2.32 1.16-.05 1.6-.75 3.01-.75 1.4 0 1.8.75 3.03.73 1.25-.02 2.04-1.14 2.81-2.26.88-1.3 1.25-2.55 1.27-2.62-.03-.01-2.43-.93-2.46-3.69zM14.06 5.8c.64-.78 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.1 1.77-.97 2.82 1.03.08 2.07-.52 2.71-1.28z";
