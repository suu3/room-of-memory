# Web player model

`<workspace>` below is the creator's local working folder, outside this repository.

`public/assets/models/player-blocky.glb` contains the user's latest Tripo chibi. The runtime URL is
`?v=tripo-20260916-surface`; bump it with every replacement because the service worker caches assets.
Earlier revisions are recorded below. The editable source for this revision is
`<workspace>/2026-09-15/tripo-refine/player-chibi.blend`.

- Height: 1.512 world units after removing crown wisps; feet at Y=0; front faces +Z.
- Skin: 23 exported bones, including two independent eye bones; at most four normalized influences per vertex.
- Mesh: about 59K triangles including the reconstructed forehead and facial details; Meshopt compressed, under 1MB.
- Textures: the supplied Tripo base colors are embedded as WebP at 256–1024px. No external texture paths.
- Clips: `Idle`, `Walk`, `Sit`, `SitDown`, `StandUp`.

## Tripo chibi (2026-09-15)

Current revision: `?v=tripo-20260916-surface`. The user generated a new chibi with Tripo and dropped the FBX
(`tripo_convert_86212750-….fbx`, 59MB, 1.9M triangles, 41 auto-generated bones, no clips) into
`public/assets/models/`. That source is far over the 25MB commit limit and stays out of git; only the
baked GLB ships. `scripts/assets/create-tripo-player.py` (Blender 5.2, background) does the whole conversion:

- Decimates each of the 12 Tripo parts to a per-part budget (UVs kept, split vertices welded and custom normals cleared), then relaxes small bumps on the hair and clothes. Base colors are embedded as WebP: 1024px for hair and
  face, 512px for trousers and shirt, 256px for the rest.
- Keeps Tripo's joint positions but rebuilds the game's 23-bone skeleton (`hips` … `toe.R`, `eye.L/R`),
  symmetrised left/right with a vertical hips bone. Twist and helper bones fold into their parents,
  and each part is restricted to the bones it should follow. The vest uses hips/spine/chest weights;
  sleeves use a smooth upper-arm/forearm transition. The source fused the lowered arms to the torso,
  so missing inner sleeves and vest sides are reconstructed before applying those weights.
- Removes the raised crown wisps by their UV islands and closes the actual crown rim with an inset
  surface. There is no sphere or raised round plug over the hair. The scan's fragmented forehead
  and the old jagged boundary extensions are replaced by a continuous surface joined to the face
  at z=1.141, widening beneath the temples. Native vertex colours remove hair-shaped stains;
  the eyebrow profiles are recovered from the source. Geometry is denser around the eyebrows.
- Renders the face to locate the painted eyes and smooths the socket surfaces once in the neutral
  mesh. The old animated socket correction displaced the painted face by 12.5mm at half blink,
  making the irises ripple. The face now stays fixed; `eyeBlinkLeft/Right` drives only the separate
  lids and catchlights. Vertex alpha blends the lid edge into the skin. These overlays cast no shadows.
- Adds two small catchlights per eye; their blink morph retracts them beneath the closed lid.
- Reconstructs the bandaged cheek from a smooth fit to the intact opposite cheek. Native vertex
  colours blend the repaired skin into the supplied texture without crossing its UV islands.
  Projection fades on the chin underside before local XYZ relaxation, avoiding folded triangles.
  A dense adhesive strip follows the finished skin above the chin turn, with a centre pad and printed perforations.
- Follows the connected forehead rim rather than sorting vertices by X, avoiding a bridge to the ear.
  Smooths garment boundary chains within 1mm and softens lower-trouser bumps while preserving the waist.
  The surface revision was inspected from eight horizontal angles, above, and in raised-arm and closed-eye poses.
- Authors Idle/Walk/Sit/SitDown/StandUp with the same procedural poses as `create-chibi-player.py`.

`pnpm model:prep` compresses the export with Meshopt. The prep script strips images
before its Node-side loader check, so textured models pass. The curtain clips were carried over with
`scripts/assets/retarget-curtain-clips.mjs`, which re-expresses each bone's pose as a rest-space rotation and
rewrites the clip GLB's rest transforms; the curtain motion did not have to be re-authored.

Measured constants in `player-rig.ts` changed with the repaired mesh: `SIT_CONTACT_Y` 0.227,
`SIT_CONTACT_Z` −0.066…0.308, `SIT_LEG_Z` 0.197…0.395, `LIE_BACK_Z` −0.092, `LIE_HEAD.backZ` −0.312,
`LIE_HEAD.centerY` 1.24, and `LIE_TILT` 0.35 (this head sits less far behind the torso, so the body
lies a little flatter to keep the back on the mattress). Editable source: `player-chibi.blend` in the
conversion's output folder.

## Round the rear of the large fringe toward the face (2026-09-08)

Current revision: `?v=rounded-back80-20260908`. Start from the user's restored root50 runtime, verified byte-for-byte against the saved source export. All 21 original mesh objects retain their coordinates, polygons and weights. The original front contour, tip, 20:80 split and approved upper connection remain in place.

`Hair_Center_80pct_RoundedBack` adds a closed, curved rear volume. Oval sections follow the original strand width; their rear depth is guided by ray intersections with the actual face surface, rolling into the face with a small buried overlap. The ends taper, and the added right/front region is constrained behind the original front surface. This adds depth toward the face without the earlier sideways expansion or whole-lock replacement.

The head-weighted volume is editable separately. Source: `work/round_hair_back.py`, based on `work/before-shell-fix.blend`. The earlier `rebuild_closed80.py` and `line_original80.py` are rejected versions, not the current source.

Runtime: 96,324 triangles, two primitives, 860 KiB. Validation: all original mesh hashes unchanged, new volume manifold, all five clips retained, 16 model/animation/cache/seat checks pass. Browser comparisons through the game Three.js/Meshopt loader cover the photographed angle and both side views. Latest images: `hair-rounded-back-preview.png`, `hair-rounded-back-inner-side.png` and `hair-rounded-back-side.png` in `<workspace>/2026-09-06/0/outputs/`.

## Extend the connected root another 10% (2026-09-07)

Earlier revision: `?v=root50-20260907`. The approved root bridge extends another 0.04 Blender units downward, from z=1.34 to z=1.30, closing approximately the upper 50% of the visible 20:80 part in total. The lower split and tips retain their approved shape. The connection retreats under the small lock at its lower end and overlaps only a narrow strip of the large lock.

The bridge is an editable island inside `Hair_Center_80pct`. Existing large-lock coordinates and custom normals are retained, as are all other 20 meshes (hash comparison), clothes, rig and five clips. Source: `work/join_hair_root.py`, starting from `work/approved-restored80.blend`. The preceding approved connection is backed up in `work/approved-root40.blend`.

Runtime: 83,912 triangles, two primitives, 795 KiB. The compressed GLB was decoded and rendered for visual review; all 15 model/animation/cache/seat checks passed. Latest output images: `hair-root50.png` and `root50-before-after.png`. Editable sources remain in the outputs directory described below.

## Restore only the large 80% center lock (earlier revision, 2026-09-07)

Earlier revision: `?v=restore-large80-20260907`. Only `Hair_Center_80pct` was restored to its original pre-loft profile, retaining the physical 20:80 split and trimming the pinched tip. The small 20% curved lock, M-shaped flanking locks, and all other 20 meshes remain unchanged from the approved smooth revision, verified by coordinate/weight hashes.

The rounded rear vest and hem, beige bandage, white cuffs, original rig, blink bones and five animation clips are retained. Body and shirt remain unchanged. The seated garment rear bound is -0.269; seat anchors are unchanged.

Editable sources: `<workspace>/2026-09-06/0/outputs/player-editable.blend` and uncompressed `player-editable.glb`. The separate game export has 83,654 triangles, two primitives and is 794 KiB. Restoration script: `work/restore_large80.py`, based on `work/smooth-approved.blend`.

Validation: game loader, animation, cache and chair-placement checks pass (14 tests). Updated front and close-up previews are `preview-restored80.png` and `hair-restored80.png` in the outputs directory.

## Character-sheet colors (earlier revision, 2026-09-06)

The color-only revision was `?v=sheet-20260906`, replacing the earlier `vest-20260906` revision. The supplied `character-hero-sheet.webp` is the color reference: hair/eyebrows `#303744`, vest `#817989`, shirt `#cad2dd`, trousers `#414e63`, and cuffs `#30303e` (sRGB). These colors were stored as linear `COLOR_0` vertex attributes on the existing clothing/hair primitive, with a white material base factor; the older warm palette texture was no longer sampled. The face texture and its blush/shading were unchanged. Material roughness was 0.78 to soften the previously shiny hair. Room lighting was unchanged.

This is a color-only update: original geometry, UVs, weights, skin and animation accessors are preserved. Meshopt compression remains enabled, with two draw calls and a total GLB size of approximately 590 KB (previously 585 KB). A before-model backup and the recoloring script are in `<workspace>/sd/sheet-palette-20260906/`; existing Blender sources are untouched. Subsequent Blender exports must retain these vertex colors or reapply this palette and bump the runtime URL revision.

The game blends Idle/Walk according to actual movement, preserving the supplied materials. Skeletons are cloned with Three.js `SkeletonUtils.clone`; cached geometry and materials are shared and must not be disposed by individual player instances. See the [Three.js cloning documentation](https://threejs.org/docs/pages/module-SkeletonUtils.html).

`updatePlayerRig(rig, phase, walking, delta, sitting)` supports a sitting blend from 0 to 1. Chair selection, positioning and interaction are not wired into the game. The GLB also includes SitDown/StandUp transition clips for that future interaction. Three.js sanitizes punctuation in loaded node names: for direct bone access use `head`, `hips`, `thighL`, `shinL`, `footL` and corresponding R names. Apply manual offsets after the mixer update, otherwise the animation overwrites them.

The authored walk is in place. Travel and turning remain controlled by the game; the preserved movement speed and cadence are stylized, not physically foot-locked during world travel.

Clicking the floor walks the player to the point where the pointer ray meets the y=0 plane (`walkTarget` in the store, stepped in `Player.tsx` through the same `moveThroughZones` path as keyboard movement). There is no pathfinding: the body walks straight, slides along furniture like keyboard movement, and stops where it is blocked head-on or within the arrive radius (`walk-to.ts`). Keyboard or joystick input cancels the target. The on-screen joystick is shown only on touch devices; mouse users click, keyboard users keep WASD.

Clicking a chair, a sofa cushion or the piano bench seats the player there (`seats.ts`). The body walks to the seat before it sits, and stands up before it walks back. The two phases never overlap (`advanceSitPhases`), because a body that slides into a chair with its legs still reads as broken no matter how good the sitting pose is. The furniture in this house is oversized relative to the character, so the sitting pose is anchored to the front edge of each seat: the hips rest on the seat and the lower legs hang past it, because sitting any deeper drives the shins through the seat slab. Chairs tucked under the desk or the dining table slide back first, because the body would otherwise pass through the top. Sitting and standing crossfade Idle and Sit over 0.55 s rather than playing SitDown/StandUp: both of those clips end on a duplicate of their first keyframe, so they snap back to standing when played straight.

Grabbing a curtain first walks the body to the spot in front of the window (`CURTAIN_STAND` in `layout.ts`, centred on the window in front of the cabinet), turns it to face the wall, and only then raises both arms; the curtain waits for that arrival before it follows the pointer or flips from a tap, so the curtain never opens while the character is still crossing the room. Grabbing from outside the curtain's reach is refused like a distant chair. Like blinking, the arms are rotated after the animation mixer, around the body's own sideways axis rather than the world's, so the reach follows whichever way the character faces. That keeps the gesture usable over any clip without baking a new one. After release the arms linger for 0.9 s and the body stays at the window.

Clicking the bed lies the player on it (`seats.ts`, the only `lie` seat). There is no lying clip: the body walks to a standing spot beside the mattress, then over 0.9 s slides to the middle of the bed while the whole Idle pose is tilted back around the feet (`LIE_TILT` in `player-rig.ts`). It is not laid fully flat because this character's head sits about 0.2 further back than its shoulders, so a flat pose would sink the back of the head through the pillow; the tilt keeps the head resting on the pillow with the torso just above the mattress. Getting up reverses the motion and walks back.

Blinking runs independently of locomotion, including idle and sitting. Each character waits a randomized 2.8-6 seconds, closes its eyes over 70 ms, holds for 30 ms and reopens over 110 ms. Only `eyeL`/`eyeR` are scaled after the animation mixer; the face and eyebrows remain unchanged. The walk includes shoulder swing, a bent elbow that follows the swing, and a small delayed wrist movement.

The earlier blink-rig source, generation scripts and textured previews remain in `<workspace>/sd/web-rig-blink-20260906/`. The previous rig backup remains in `<workspace>/sd/web-rig-20260906/`. `player-web-rig.blend` packs the skin image and retains the animation actions. Use the editable source in the hair revision section above for the latest changes.

Validation includes the actual Meshopt decoder, skeleton and animation data, embedded texture references, skinned bounds, both knee rotations, all five poses, repeated blink timing, clone isolation and Strict Mode cleanup/restart. Browser checks cover model/texture loading and movement-to-idle transitions. glTF-Transform's validator does not validate Meshopt payloads; the real-loader test covers decoding.
