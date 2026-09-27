export function celebrateEyeGaze(calm = false) {
  window.dispatchEvent(new CustomEvent('eye-gaze-celebrate', {detail:{calm}}));
}
