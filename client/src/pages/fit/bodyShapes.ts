// The body map's drawing: a front and a back figure (viewBox 0 0 200 460), each muscle its own shape.
// Shapes are drawn for the figure's left half (x ≤ 100) and mirrored for the right; thin gaps between
// them (stroked in the page color) give the segmented, anatomical look. Fine lines add definition.
import type { BodyPart } from "@shared/fitRecovery";

export type Shape = { part: BodyPart; d: string };

/** The whole body (left half), under the muscles: head, neck, hands, knees and feet show as skin. */
export const SILHOUETTE = "M100 10 C88 10 82 20 82 33 C82 44 86 52 91 56 L91 63 C85 67 76 69 67 71 C57 74 50 82 48 94 C46 106 45 120 44 132 C42 146 40 158 38 168 C36 182 33 196 31 210 C30 220 29 228 29 236 C27 246 27 258 31 266 C35 271 40 267 41 259 C42 251 42 242 42 236 C44 224 47 210 50 196 C53 182 55 170 57 160 C59 150 61 138 63 129 C64 124 65 120 66 117 C67 132 68 148 70 162 C71 176 72 188 71 200 C70 212 68 222 68 234 C66 252 66 270 68 288 C70 304 72 318 74 330 C74 344 72 358 72 372 C72 388 74 402 75 413 C75 422 71 430 73 437 C77 444 92 444 94 437 C95 428 92 420 92 413 C92 400 93 386 93 372 C93 358 92 345 92 334 C94 320 96 302 96 286 C97 270 98 256 100 246 Z";

export const FRONT: Shape[] = [
  // Upper trapezius, between the neck and the shoulder.
  { part: "back", d: "M92 60 C88 64 81 68 70 71 C78 75 87 77 95 77 C95 70 94 65 92 60 Z" },
  // Front and side deltoid.
  { part: "shoulders", d: "M64 72 C55 74 49 82 47 94 C46 104 46 113 48 120 C53 114 57 106 61 99 C64 92 68 85 74 79 C71 75 68 73 64 72 Z" },
  // Pectoral: a fan from the collarbone and breastbone into the armpit.
  { part: "chest", d: "M98 80 C90 78 81 78 75 81 C70 85 66 92 64 100 C63 106 63 110 65 113 C70 118 78 123 88 124 C93 124 96 123 98 121 Z" },
  // Biceps.
  { part: "biceps", d: "M50 122 C46 132 44 145 44 156 C45 162 50 165 54 163 C58 160 60 150 61 140 C62 133 62 127 61 123 C58 120 53 120 50 122 Z" },
  // Forearm.
  { part: "forearms", d: "M43 168 C38 182 34 198 32 212 C31 220 33 227 37 228 C42 222 46 208 50 194 C53 184 56 175 56 168 C52 170 47 170 43 168 Z" },
  // Obliques and serratus.
  { part: "abs", d: "M68 122 C67 136 68 150 70 164 C71 176 72 188 72 200 C75 204 79 206 83 205 C83 190 83 172 83 154 C83 140 81 130 77 124 C74 122 71 121 68 122 Z" },
  // The six-pack, in rows, and the lower abs.
  { part: "abs", d: "M88 127 L97 127 Q98 127 98 129 L98 142 Q98 144 96 144 L88 144 Q86 144 86 142 L86 129 Q86 127 88 127 Z" },
  { part: "abs", d: "M88 147 L97 147 Q98 147 98 149 L98 162 Q98 164 96 164 L88 164 Q86 164 86 162 L86 149 Q86 147 88 147 Z" },
  { part: "abs", d: "M88 167 L97 167 Q98 167 98 169 L98 182 Q98 184 96 184 L88 184 Q86 184 86 182 L86 169 Q86 167 88 167 Z" },
  { part: "abs", d: "M86 187 L98 187 L98 215 C94 215 90 211 88 205 C87 198 86 192 86 187 Z" },
  // Quadriceps: the outer head, the long middle head and the teardrop above the knee.
  { part: "quads", d: "M72 236 C68 252 67 272 68 290 C69 304 72 316 77 324 C80 318 81 306 80 292 C79 272 79 254 80 238 C77 236 74 235 72 236 Z" },
  { part: "quads", d: "M82 236 C80 254 81 274 82 292 C83 304 84 314 86 320 C89 312 92 300 93 286 C94 270 94 254 93 244 C90 238 86 236 82 236 Z" },
  { part: "quads", d: "M94 292 C92 304 89 314 87 322 C90 326 94 324 96 318 C97 310 97 300 96 293 Z" },
  // Adductors, the inner thigh (trained with the quads here).
  { part: "quads", d: "M95 247 C97 259 98 273 97 287 C96 275 95 262 94 251 Z" },
  // Calves seen from the front, and the shin muscle.
  { part: "calves", d: "M76 342 C73 356 73 372 75 386 C77 395 80 401 83 401 C85 392 86 378 86 364 C86 352 85 344 82 338 C80 338 78 339 76 342 Z" },
  { part: "calves", d: "M88 340 C87 356 87 374 88 392 C90 384 91 368 91 352 C91 346 90 342 88 340 Z" },
];

export const BACK: Shape[] = [
  // Trapezius: the diamond from the neck to the middle of the back.
  { part: "back", d: "M100 56 C95 61 89 65 81 69 C73 72 66 74 61 77 C70 81 80 86 88 93 C93 101 97 112 100 124 Z" },
  // Rear and side deltoid.
  { part: "shoulders", d: "M63 75 C55 78 49 87 47 99 C46 108 47 114 49 119 C54 109 59 99 65 91 C69 86 72 82 72 79 C69 77 66 75 63 75 Z" },
  // Infraspinatus and teres, below the shoulder blade's ridge.
  { part: "back", d: "M72 84 C68 92 66 100 67 108 C74 112 84 112 92 108 C90 100 86 93 80 88 C77 86 74 85 72 84 Z" },
  // Lats, the wide sweep down to the waist.
  { part: "back", d: "M67 112 C68 128 70 146 74 161 C78 175 84 185 91 190 C95 182 97 170 98 156 L98 128 C94 118 86 114 76 113 C72 112 69 112 67 112 Z" },
  // Lower back (erector spinae).
  { part: "back", d: "M90 166 C88 178 88 192 90 204 C93 210 97 212 100 212 L100 162 C96 162 92 163 90 166 Z" },
  // Triceps.
  { part: "triceps", d: "M50 121 C46 133 44 146 44 157 C46 163 51 165 55 162 C59 155 61 145 62 136 C62 129 62 124 60 121 C57 119 53 119 50 121 Z" },
  // Forearm.
  { part: "forearms", d: "M43 168 C38 182 34 198 32 212 C31 220 33 227 37 228 C42 222 46 208 50 194 C53 184 56 175 56 168 C52 170 47 170 43 168 Z" },
  // Glutes.
  { part: "glutes", d: "M70 214 C66 226 66 240 70 250 C76 258 86 260 94 256 C98 252 100 246 100 238 L100 215 C92 211 80 211 70 214 Z" },
  // Hamstrings: the outer and inner heads.
  { part: "hamstrings", d: "M70 262 C68 280 69 298 72 312 C75 320 79 324 82 324 C82 306 81 286 81 266 C77 265 73 264 70 262 Z" },
  { part: "hamstrings", d: "M84 266 C84 286 85 306 86 324 C90 318 93 304 94 290 C95 280 95 270 94 263 C90 265 87 266 84 266 Z" },
  // Calves: the two heads of the gastrocnemius.
  { part: "calves", d: "M74 340 C70 352 70 368 73 380 C76 390 80 394 83 392 C84 380 84 362 83 346 C82 340 78 337 74 340 Z" },
  { part: "calves", d: "M86 338 C85 352 85 370 86 390 C89 386 91 372 91 358 C91 348 89 341 86 338 Z" },
];

/** Definition lines over the muscles (drawn in the gap color). */
export const FRONT_LINES = [
  "M70 106 C76 112 86 116 96 117", // the chest's lower fibres
];
export const BACK_LINES = [
  "M84 216 C86 230 88 244 92 254", // glute fold
  "M100 124 L100 160",             // the spine between the lats
];
