// Back steps the app takes by itself: a screen that added a step to the browser's history (the Plugin
// Gallery, the Start button's app-on-top step) takes it back off when it closes. Those go through here,
// so code that treats Back as "leave" (the sample accounts sign out on Back, AuthContext) can tell them
// apart from the person pressing Back.

let own = 0;

/** Goes back one step on the app's own account (not the person pressing Back). */
export function inAppBack(): void {
  own = Date.now();
  window.history.back();
}

/** True, once, for the history step inAppBack() just took. */
export function wasInAppBack(): boolean {
  const yes = own > 0 && Date.now() - own < 1500;
  own = 0;
  return yes;
}
