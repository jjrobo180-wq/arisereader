// Runs before anything else in the app (first import in main.tsx): inside the sample Duo viewer the
// app must never see the visitor's own sign-in or storage, so sample mode is set up before any other
// module can read them. Outside the viewer this does nothing.
import { installSampleMode } from "./sampleMode";

installSampleMode();
