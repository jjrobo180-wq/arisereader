import type { ThemeId } from "@shared/skybound/sim";

export type Theme = {
  skyTop: number; skyBottom: number; fog: number; fogNear: number; fogFar: number;
  sun: number; sunIntensity: number; hemiSky: number; hemiGround: number; hemiIntensity: number;
  top: string; topDark: string; side: string; sideDark: string; stone: string; accent: string;
  ambient: "pollen" | "wind" | "sparkle" | "none" | "snow" | "embers" | "rain";
  far: "islands" | "mesas" | "cave" | "sea" | "peaks" | "windmills" | "towers";
  sea: boolean; night: boolean; music: { root: number; tempo: number; mode: "major" | "minor" | "dorian" };
  decor: "flowers" | "grass" | "crystals" | "puffs" | "pines" | "wheat" | "torches";
};

export const THEMES: Record<ThemeId, Theme> = {
  meadow: {
    skyTop: 0x4ba3ff, skyBottom: 0xd8f2ff, fog: 0xcdeeff, fogNear: 60, fogFar: 170, sun: 0xfff1d0, sunIntensity: 2.6,
    hemiSky: 0xffffff, hemiGround: 0x6b8f4e, hemiIntensity: 1.6, top: "#63d35a", topDark: "#3fa83d", side: "#b9794a", sideDark: "#8a5434",
    stone: "#a7b4c2", accent: "#ffd23f", ambient: "pollen", far: "islands", sea: true, night: false,
    music: { root: 60, tempo: 128, mode: "major" }, decor: "flowers",
  },
  bluffs: {
    skyTop: 0x2f8fe0, skyBottom: 0xbfe9f5, fog: 0xbfe6f2, fogNear: 55, fogFar: 160, sun: 0xfff6e0, sunIntensity: 2.4,
    hemiSky: 0xeaf6ff, hemiGround: 0x8a7a55, hemiIntensity: 1.5, top: "#9bd96b", topDark: "#6fb04b", side: "#d9a066", sideDark: "#b0763f",
    stone: "#c9a77c", accent: "#7de0ff", ambient: "wind", far: "mesas", sea: true, night: false,
    music: { root: 62, tempo: 120, mode: "dorian" }, decor: "grass",
  },
  caverns: {
    skyTop: 0x0d0a26, skyBottom: 0x281a4a, fog: 0x1a1436, fogNear: 30, fogFar: 95, sun: 0xb8c8ff, sunIntensity: 1.6,
    hemiSky: 0x9a8cff, hemiGround: 0x3a2f5a, hemiIntensity: 2.2, top: "#7a80b0", topDark: "#5d6290", side: "#565a85", sideDark: "#3e4166",
    stone: "#7479a3", accent: "#b06bff", ambient: "sparkle", far: "cave", sea: false, night: true,
    music: { root: 57, tempo: 104, mode: "minor" }, decor: "crystals",
  },
  clouds: {
    skyTop: 0x7fb6ff, skyBottom: 0xffe2f0, fog: 0xf3e6ff, fogNear: 60, fogFar: 180, sun: 0xffffff, sunIntensity: 2.3,
    hemiSky: 0xffffff, hemiGround: 0xc9b6ff, hemiIntensity: 1.8, top: "#ffffff", topDark: "#e6ecff", side: "#eef2ff", sideDark: "#cdd6f5",
    stone: "#dfe6ff", accent: "#ff8fd0", ambient: "pollen", far: "sea", sea: true, night: false,
    music: { root: 65, tempo: 132, mode: "major" }, decor: "puffs",
  },
  frost: {
    skyTop: 0x5b8fd6, skyBottom: 0xe3f2ff, fog: 0xe0efff, fogNear: 50, fogFar: 150, sun: 0xf3f8ff, sunIntensity: 2.2,
    hemiSky: 0xf2f8ff, hemiGround: 0x8fa6c4, hemiIntensity: 1.7, top: "#f7fbff", topDark: "#d6e6f5", side: "#7d8fa8", sideDark: "#5c6d86",
    stone: "#9fb3cc", accent: "#8ff0ff", ambient: "snow", far: "peaks", sea: false, night: false,
    music: { root: 64, tempo: 116, mode: "minor" }, decor: "pines",
  },
  sunset: {
    skyTop: 0x4a2a7a, skyBottom: 0xffa25c, fog: 0xffb37a, fogNear: 55, fogFar: 160, sun: 0xffb26b, sunIntensity: 2.4,
    hemiSky: 0xffd2a1, hemiGround: 0x6a3d58, hemiIntensity: 1.5, top: "#e8c25a", topDark: "#c79a35", side: "#a35f3f", sideDark: "#7a4130",
    stone: "#b98a6a", accent: "#ff7a3d", ambient: "embers", far: "windmills", sea: true, night: false,
    music: { root: 62, tempo: 124, mode: "major" }, decor: "wheat",
  },
  fortress: {
    skyTop: 0x1b1630, skyBottom: 0x5a4a7a, fog: 0x3a3156, fogNear: 40, fogFar: 130, sun: 0xc9c2ff, sunIntensity: 1.5,
    hemiSky: 0xb8b0ff, hemiGround: 0x2a2238, hemiIntensity: 1.4, top: "#7d8197", topDark: "#5f6377", side: "#5d5f73", sideDark: "#45475a",
    stone: "#6f7287", accent: "#ffcf4a", ambient: "rain", far: "towers", sea: false, night: true,
    music: { root: 55, tempo: 136, mode: "minor" }, decor: "torches",
  },
  storm: {
    skyTop: 0x120f24, skyBottom: 0x3d3466, fog: 0x2a2446, fogNear: 40, fogFar: 120, sun: 0xd6d0ff, sunIntensity: 1.6,
    hemiSky: 0xc0b8ff, hemiGround: 0x241d36, hemiIntensity: 1.5, top: "#8a8ea6", topDark: "#6a6e85", side: "#5d5f73", sideDark: "#45475a",
    stone: "#6f7287", accent: "#ffe14a", ambient: "rain", far: "sea", sea: true, night: true,
    music: { root: 53, tempo: 148, mode: "minor" }, decor: "torches",
  },
};
