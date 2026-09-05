# Web player model

`public/assets/models/player-blocky.glb` now contains the user-supplied chibi character, replacing the six-part placeholder. The file path is unchanged; the runtime URL uses `?v=blink-20260906` to bypass cached older rigs. Bump this version whenever replacing the model. It requires the updated `Player.tsx` and `player-animation.ts`; it is not compatible with the old mesh-pivot animator.

- Height: 1.55 world units; feet at Y=0; front faces +Z.
- Skin: 23 exported bones, including two independent eye bones; at most four normalized influences per vertex.
- Mesh: approximately 55,000 triangles, nine primitives; Meshopt compressed.
- Textures: the original 1024×1024 `CH1.FACE.png` is embedded as WebP, along with a small clothing/hair palette. No external image URL or local image path is required.
- Clips: `Idle`, `Walk`, `Sit`, `SitDown`, `StandUp`.

The game blends Idle/Walk according to actual movement, preserving the supplied materials. Skeletons are cloned with Three.js `SkeletonUtils.clone`; cached geometry and materials are shared and must not be disposed by individual player instances. See the [Three.js cloning documentation](https://threejs.org/docs/pages/module-SkeletonUtils.html).

`updatePlayerRig(rig, phase, walking, delta, sitting)` supports a sitting blend from 0 to 1. Chair selection, positioning and interaction are not wired into the game. The GLB also includes SitDown/StandUp transition clips for that future interaction. Three.js sanitizes punctuation in loaded node names: for direct bone access use `head`, `hips`, `thighL`, `shinL`, `footL` and corresponding R names. Apply manual offsets after the mixer update, otherwise the animation overwrites them.

The authored walk is in place. Travel and turning remain controlled by the game; the preserved movement speed and cadence are stylized, not physically foot-locked during world travel.

Blinking runs independently of locomotion, including idle and sitting. Each character waits a randomized 2.8–6 seconds, closes its eyes over 70 ms, holds for 30 ms and reopens over 110 ms. Only `eyeL`/`eyeR` are scaled after the animation mixer; the face and eyebrows remain unchanged. The walk includes shoulder swing, a bent elbow that follows the swing, and a small delayed wrist movement.

Latest editable source, generation scripts and textured previews are in `<workspace>/sd/web-rig-blink-20260906/`. The previous rig and original placeholder backup remain in `<workspace>/sd/web-rig-20260906/`. `player-web-rig.blend` packs the skin image and retains the animation actions.

Validation includes the actual Meshopt decoder, skeleton and animation data, embedded texture references, skinned bounds, both knee rotations, all five poses, repeated blink timing, clone isolation and Strict Mode cleanup/restart. Browser checks cover model/texture loading and movement-to-idle transitions. glTF-Transform's validator does not validate Meshopt payloads; the real-loader test covers decoding.
