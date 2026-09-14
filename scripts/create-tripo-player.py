"""Turn the Tripo-rigged chibi FBX into the game's player rig in a Blender background process.

blender -b --factory-startup --python scripts/create-tripo-player.py -- INPUT.fbx OUTPUT_DIR

What it does, in order:

1. Decimates the 1.9M-triangle Tripo parts to ~37K triangles (per-part budgets, UVs kept).
2. Fits the source to 1.55 units, relaxes surface noise and removes raised crown wisps
   (finished height ~1.512), then joins the parts. Feet remain on z=0.
3. Rebuilds the skeleton with the game's bone names at the Tripo joint positions (twist
   bones merged into their parents, left/right symmetrised) and cleans the auto weights:
   each part may only follow the bones that make sense for it (hands never follow thighs).
4. Fits blink eyelids and subtle retracting catchlights over the painted eyes.
5. Authors Idle/Walk/Sit/SitDown/StandUp exactly like scripts/create-chibi-player.py.
6. Exports player-chibi.glb (uncompressed; run `pnpm model:prep` on it) and saves the .blend.

The curtain-pull clips are carried over separately: scripts/retarget-curtain-clips.mjs.
"""

import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

parser = argparse.ArgumentParser()
parser.add_argument("input", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
args.output.mkdir(parents=True, exist_ok=True)

TARGET_HEIGHT = 1.55
# Triangle budget per Tripo part (~37K in total). Hair and face carry the silhouette; hands and
# cuffs need enough left to stay round, or the fist reads as one blob with the sleeve.
TARGET_FACES = {0: 12000, 1: 4000, 2: 8000, 3: 5000, 4: 1500, 5: 1500, 6: 1000, 7: 700, 8: 700, 9: 1200, 10: 1200, 11: 200}
# Vertices closer than this (game units, ~0.2mm) are the same point split along a UV seam.
WELD_DISTANCE = 0.0002
# Base-color resolution per part (the source ships 4096 for hair, 2048 for trousers).
TEXTURE_SIZE = {0: 1024, 1: 512, 2: 1024, 3: 512}
DEFAULT_TEXTURE_SIZE = 256
# Tripo bone → game bone. Twist and helper bones fold into the bone they belong to.
MERGE = {
    "Root": "hips", "Hip": "hips", "Pelvis": "hips", "Waist": "hips",
    "Spine01": "spine", "Spine02": "chest",
    "NeckTwist01": "neck", "NeckTwist02": "neck", "Head": "head",
}
for side in "LR":
    MERGE.update({
        f"{side}_Clavicle": f"shoulder.{side}",
        f"{side}_Upperarm": f"upper_arm.{side}", f"{side}_UpperarmTwist01": f"upper_arm.{side}", f"{side}_UpperarmTwist02": f"upper_arm.{side}",
        f"{side}_Forearm": f"forearm.{side}", f"{side}_ForearmTwist01": f"forearm.{side}", f"{side}_ForearmTwist02": f"forearm.{side}",
        f"{side}_Hand": f"hand.{side}",
        f"{side}_Thigh": f"thigh.{side}", f"{side}_ThighTwist01": f"thigh.{side}", f"{side}_ThighTwist02": f"thigh.{side}",
        f"{side}_Calf": f"shin.{side}", f"{side}_CalfTwist01": f"shin.{side}", f"{side}_CalfTwist02": f"shin.{side}",
        f"{side}_Foot": f"foot.{side}", f"{side}_ToeBase": f"toe.{side}",
    })
# Which bones each part may follow. Tripo weights by proximity, so hands pick up thigh weights
# and trousers pick up hand weights; those are dropped and the rest renormalised.
ARM = lambda s: {"chest", f"shoulder.{s}", f"upper_arm.{s}", f"forearm.{s}", f"hand.{s}"}
LEG = lambda s: {f"thigh.{s}", f"shin.{s}", f"foot.{s}", f"toe.{s}"}
ALLOWED = {
    0: {"head", "neck"},  # hair
    1: {"hips", "spine"} | LEG("L") | LEG("R"),  # trousers
    2: {"head", "neck", "chest"},  # face and neck
    3: {"hips", "spine", "chest", "neck", "thigh.L", "thigh.R"} | ARM("L") | ARM("R"),  # shirt + vest
    4: ARM("L"), 5: ARM("R"),  # sleeves
    6: {"neck", "chest", "head", "shoulder.L", "shoulder.R"},  # collar
    7: {"shin.R", "foot.R", "toe.R"}, 8: {"shin.L", "foot.L", "toe.L"},  # shoes
    9: {"hand.L"}, 10: {"hand.R"},  # hands
    11: {"head"},  # cheek bandage
}
FALLBACK = {0: "head", 1: "hips", 2: "head", 3: "spine", 4: "upper_arm.L", 5: "upper_arm.R", 6: "neck", 7: "foot.R", 8: "foot.L", 9: "hand.L", 10: "hand.R", 11: "head"}


def part_index(name):
    return int(name.split("_")[2])


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
bpy.ops.import_scene.fbx(filepath=str(args.input.resolve()))
parts = sorted([o for o in bpy.data.objects if o.type == "MESH"], key=lambda o: part_index(o.name))
source_rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")

# Joint positions in world space, read before the source skeleton is thrown away.
joints = {b.name: (source_rig.matrix_world @ b.head_local, source_rig.matrix_world @ b.tail_local) for b in source_rig.data.bones}

# Whole-figure bounds drive the scale: feet on z=0, TARGET_HEIGHT tall, centred on x.
lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
for o in parts:
    for corner in o.bound_box:
        w = o.matrix_world @ Vector(corner)
        lo = Vector(map(min, lo, w))
        hi = Vector(map(max, hi, w))
scale = TARGET_HEIGHT / (hi.z - lo.z)
origin = Vector(((lo.x + hi.x) / 2, 0, lo.z))


def fit(point):
    return (Vector(point) - origin) * scale


# Tripo sculpted three bumps on the bandaged cheek (only the middle one is under the bandage
# part). The user wants that cheek as smooth as the other, so the region is pressed flat with a
# weighted Smooth before decimation. Weights fade out toward the mouth and the lower eyelid.
CHEEK = {"x": 0.13, "z": 1.0, "radius": 0.11}


def flatten_cheek(face):
    def smoothstep(t):
        t = max(0.0, min(1.0, t))
        return t * t * (3 - 2 * t)

    group = face.vertex_groups.new(name="cheek")
    for v in face.data.vertices:
        if v.co.y > -0.02:
            continue
        distance = math.hypot(v.co.x - CHEEK["x"], v.co.z - CHEEK["z"])
        weight = smoothstep(1 - distance / CHEEK["radius"])
        weight *= smoothstep((v.co.x - 0.035) / 0.03) * smoothstep((1.06 - v.co.z) / 0.02)
        if weight > 0:
            group.add([v.index], weight, "REPLACE")
    bandage_anchor = Vector((CHEEK["x"], -0.8, CHEEK["z"]))
    face.data.calc_loop_triangles()

    def surface_under_bandage():
        tree = BVHTree.FromPolygons([v.co for v in face.data.vertices], [tuple(t.vertices) for t in face.data.loop_triangles], all_triangles=True)
        hit, _, _, _ = tree.ray_cast(bandage_anchor, Vector((0, 1, 0)))
        return hit

    before = surface_under_bandage()
    smooth = face.modifiers.new("Cheek", "SMOOTH")
    smooth.factor = 1.0
    smooth.iterations = 60
    smooth.vertex_group = "cheek"
    bpy.context.view_layer.objects.active = face
    bpy.ops.object.modifier_apply(modifier="Cheek")
    face.vertex_groups.remove(face.vertex_groups["cheek"])
    face.data.calc_loop_triangles()
    after = surface_under_bandage()
    shift = after - before
    print(f"cheek flattened: bandage skin moved by ({shift.x:.4f}, {shift.y:.4f}, {shift.z:.4f})")
    return shift


def refine_surface(obj, index):
    """Remove the isolated crown wisps and relax scan noise without remeshing the UVs."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if index == 0:
        # Locks touch at their roots after welding. Their UV islands still identify the
        # complete outer/inner surfaces; a height cut would leave open, flat-topped stubs.
        uv = bm.loops.layers.uv.active
        old_boundary = {e for e in bm.edges if e.is_boundary}
        unseen = set(bm.faces)
        removed = []
        strands = 0
        while unseen:
            first = unseen.pop()
            component, stack = [first], [first]
            while stack:
                face = stack.pop()
                coords = {loop.vert: loop[uv].uv.copy() for loop in face.loops}
                for edge in face.edges:
                    for other in edge.link_faces:
                        if other not in unseen:
                            continue
                        other_coords = {loop.vert: loop[uv].uv for loop in other.loops}
                        if any((coords[v] - other_coords[v]).length > 0.00001 for v in edge.verts):
                            continue
                        unseen.remove(other)
                        component.append(other)
                        stack.append(other)
            if min(v.co.z for face in component for v in face.verts) > 1.475:
                removed.extend(component)
                strands += 1
        bmesh.ops.delete(bm, geom=removed, context="FACES")
        cut_edges = [e for e in bm.edges if e.is_boundary and e not in old_boundary]
        nearby = min(bm.faces, key=lambda f: (f.calc_center_median() - Vector((0.06, -0.08, 1.48))).length)
        cap_uv = sum((loop[uv].uv for loop in nearby.loops), Vector((0, 0))) / len(nearby.loops)
        if cut_edges:
            caps = bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)["faces"]
            for face in caps:
                for loop in face.loops:
                    loop[uv].uv = cap_uv
            bmesh.ops.triangulate(bm, faces=caps)
        # The roots of the removed wisps remain shared with the main locks. Settle their
        # little upright peaks into the crown and keep the newly closed surface rounded.
        crown = [v for v in bm.verts if v.co.z > 1.48 and abs(v.co.x) < 0.065 and -0.14 < v.co.y < 0.035]
        for v in crown:
            if v.co.z > 1.495:
                v.co.z = 1.495 + (v.co.z - 1.495) * 0.1
        for _ in range(4):
            bmesh.ops.smooth_vert(bm, verts=crown, factor=0.3, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        # The source locks have open undersides. A small closed inner crown fills the
        # exposed meeting point beneath them; its outer edge stays buried in the locks.
        old_faces = set(bm.faces)
        cap = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1)
        for v in cap["verts"]:
            v.co = Vector((v.co.x * 0.09, v.co.y * 0.105 - 0.035, v.co.z * 0.039 + 1.438))
        for face in set(bm.faces) - old_faces:
            for loop in face.loops:
                loop[uv].uv = cap_uv
        print(f"Crown cleanup: removed {strands} wisp surfaces ({len(removed)} faces)")
    # Work on the final triangle spacing. Boundaries stay fixed to keep cuffs and neck joins.
    iterations, factor, limit = {
        0: (3, 0.28, 0.0025),
        1: (10, 0.48, 0.012),
        2: (2, 0.20, 0.001),
        3: (5, 0.35, 0.005),
        4: (5, 0.35, 0.005),
        5: (5, 0.35, 0.005),
    }.get(index, (0, 0, 0))
    original = {v: v.co.copy() for v in bm.verts}
    for _ in range(iterations):
        updates = {}
        for v in bm.verts:
            if v.is_boundary or not v.link_edges:
                continue
            neighbors = [e.other_vert(v).co for e in v.link_edges]
            average = sum(neighbors, Vector()) / len(neighbors)
            strength = factor
            if index == 1:
                # Preserve the seat contact and the waistband; soften the noisy lower legs.
                strength *= max(0, min(1, (0.48 - original[v].z) / 0.13))
            delta = v.co.lerp(average, strength) - original[v]
            if delta.length > limit:
                delta *= limit / delta.length
            updates[v] = original[v] + delta
        for v, point in updates.items():
            v.co = point
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()


def repair_openings(obj, index):
    """Reconstruct surfaces absent in Tripo's arms-down scan, plus the bandage socket."""
    if index not in (2, 3, 4, 5):
        return
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv = bm.loops.layers.uv.active
    boundary = {e for e in bm.edges if e.is_boundary}
    loops = []
    while boundary:
        first = boundary.pop()
        edges, stack = [first], [first]
        while stack:
            for v in stack.pop().verts:
                for edge in v.link_edges:
                    if edge in boundary:
                        boundary.remove(edge)
                        edges.append(edge)
                        stack.append(edge)
        loops.append(edges)
    for edges in loops:
        verts = {v for e in edges for v in e.verts}
        low = Vector(tuple(min(v.co[k] for v in verts) for k in range(3)))
        high = Vector(tuple(max(v.co[k] for v in verts) for k in range(3)))
        cheek_socket = index == 2 and low.x > 0.08 and high.x < 0.15 and low.z > 0.97 and high.z < 1.04
        arm_seam = index in (3, 4, 5) and high.z - low.z > 0.2 and min(abs(v.co.x) for v in verts) > 0.1
        if not (cheek_socket or arm_seam):
            continue
        sample = min(bm.faces, key=lambda f: (f.calc_center_median() - Vector(((low.x + high.x) / 2, low.y - 0.005, (low.z + high.z) / 2))).length)
        color_uv = sum((loop[uv].uv for loop in sample.loops), Vector((0, 0))) / len(sample.loops)
        caps = bmesh.ops.holes_fill(bm, edges=edges, sides=0)["faces"]
        for face in caps:
            for loop in face.loops:
                loop[uv].uv = color_uv
        triangles = bmesh.ops.triangulate(bm, faces=caps)["faces"]
        long_edges = {e for f in triangles for e in f.edges if e.calc_length() > 0.03}
        if long_edges:
            bmesh.ops.subdivide_edges(bm, edges=list(long_edges), cuts=2, use_grid_fill=True)
        print(f"Surface repair part {index}: {len(edges)} boundary edges, {len(caps)} caps")
    if index == 2:
        # Extend the face beneath the hairline. Independently decimated hair/skin borders
        # otherwise expose small slits around the eyebrow from oblique views.
        rim = [e for e in bm.edges if e.is_boundary and all(v.co.z > 1.10 and v.co.y < 0.035 for v in e.verts)]
        extended = {}
        for v in {v for e in rim for v in e.verts}:
            centre = sum((f.calc_center_median() for f in v.link_faces), Vector()) / len(v.link_faces)
            direction = v.co - centre
            direction.normalize()
            new = bm.verts.new(v.co + direction * 0.007 + Vector((0, 0.001, 0)))
            new.copy_from(v)
            extended[v] = new
        for edge in rim:
            face = edge.link_faces[0]
            loop = next(loop for loop in face.loops if loop.edge == edge)
            a, b = loop.vert, loop.link_loop_next.vert
            skirt = bm.faces.new((b, a, extended[a], extended[b]))
            coords = {l.vert: l[uv].uv.copy() for l in face.loops}
            for l in skirt.loops:
                original = a if l.vert in (a, extended[a]) else b
                l[uv].uv = coords[original]
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()


for o in parts:
    index = part_index(o.name)
    o.modifiers.clear()
    world = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
    o.data.transform(world)
    for v in o.data.vertices:
        v.co = fit(v.co)
    # The FBX splits every vertex along UV seams and carries custom split normals. Decimating
    # that tears the skin open along the seams and leaves blotchy shading; weld first and let the
    # smooth faces compute their own normals. Per-corner UVs survive the weld.
    welded = bmesh.new()
    welded.from_mesh(o.data)
    bmesh.ops.remove_doubles(welded, verts=welded.verts, dist=WELD_DISTANCE)
    welded.to_mesh(o.data)
    welded.free()
    # Welding can leave faces that reuse a vertex; drop them or the exporter flags the mesh.
    o.data.validate(verbose=False)
    if index == 2:
        cheek_shift = flatten_cheek(o)
    elif index == 11:
        # The bandage covered one of those bumps. Follow the flattened skin down.
        for v in o.data.vertices:
            v.co += cheek_shift
    for attribute in [a for a in o.data.attributes if a.name in ("sharp_edge", "sharp_face", "custom_normal")]:
        o.data.attributes.remove(attribute)
    decimate = o.modifiers.new("Decimate", "DECIMATE")
    decimate.ratio = min(1.0, TARGET_FACES[index] / len(o.data.polygons))
    decimate.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="Decimate")
    refine_surface(o, index)
    repair_openings(o, index)
    if o.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for polygon in o.data.polygons:
        polygon.use_smooth = True
    print(f"part {index}: {len(o.data.polygons)} tris")

# Rebuild the adhesive bandage on the repaired cheek instead of preserving the floating
# raised blob produced by Tripo. Its replacement is constructed after face_point is ready.
old_bandage = next(o for o in parts if part_index(o.name) == 11)
parts.remove(old_bandage)
bpy.data.objects.remove(old_bandage, do_unlink=True)

# ---------------------------------------------------------------------------
# Eyes: render the face part alone (flat, textured) and take the two largest dark blobs.
# The irises and their outlines are painted on; nothing in the mesh marks them.
face_part = next(o for o in parts if part_index(o.name) == 2)
for o in bpy.data.objects:
    o.hide_render = o is not face_part
eye_cam = bpy.data.objects.new("EyeCam", bpy.data.cameras.new("EyeCam"))
scene.collection.objects.link(eye_cam)
scene.camera = eye_cam
eye_cam.data.type = "ORTHO"
EYE_VIEW = 0.6
EYE_CENTER_Z = 1.2
eye_cam.data.ortho_scale = EYE_VIEW
eye_cam.location = (0, -3, EYE_CENTER_Z)
eye_cam.rotation_euler = (math.pi / 2, 0, 0)
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "FLAT"
scene.display.shading.color_type = "TEXTURE"
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x = scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = str(args.output / "eye-detect.png")
bpy.ops.render.render(write_still=True)
bpy.data.objects.remove(eye_cam)
shot = bpy.data.images.load(str(args.output / "eye-detect.png"))
width, height = shot.size
pixels = np.empty(width * height * 4, dtype=np.float32)
shot.pixels.foreach_get(pixels)
pixels = pixels.reshape(height, width, 4)
luminance = pixels[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
# Skin is light; lashes, outline and the grey iris are all below this. Eyebrows sit above a
# clear skin gap, so each eye comes out as one blob (lash line plus iris) per side.
dark = (pixels[..., 3] > 0.5) & (luminance < 0.62)
BLOCK = 4
grid = dark.reshape(height // BLOCK, BLOCK, width // BLOCK, BLOCK).mean(axis=(1, 3)) > 0.3
rows, cols = grid.shape
seen = np.zeros_like(grid)
blobs = []
for r0 in range(rows):
    for c0 in range(cols):
        if not grid[r0, c0] or seen[r0, c0]:
            continue
        stack = [(r0, c0)]
        seen[r0, c0] = True
        cells = []
        while stack:
            r, c = stack.pop()
            cells.append((r, c))
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                rr, cc = r + dr, c + dc
                if 0 <= rr < rows and 0 <= cc < cols and grid[rr, cc] and not seen[rr, cc]:
                    seen[rr, cc] = True
                    stack.append((rr, cc))
        # Blender stores rows bottom-up, so row 0 is the lowest z.
        xs = [(c + 0.5) / cols * EYE_VIEW - EYE_VIEW / 2 for _, c in cells]
        zs = [EYE_CENTER_Z + (r + 0.5) / rows * EYE_VIEW - EYE_VIEW / 2 for r, _ in cells]
        blobs.append({"area": len(cells), "x": (min(xs), max(xs)), "z": (min(zs), max(zs))})
eyes = {}
for blob in sorted(blobs, key=lambda b: -b["area"]):
    cx = (blob["x"][0] + blob["x"][1]) / 2
    if not 0.02 < abs(cx) < 0.15:
        continue
    side = "L" if cx > 0 else "R"
    if side not in eyes:
        eyes[side] = blob
        print(f"eye.{side}: x {blob['x'][0]:.3f}..{blob['x'][1]:.3f} z {blob['z'][0]:.3f}..{blob['z'][1]:.3f} ({blob['area']} cells)")
assert len(eyes) == 2, f"Could not find both eyes on the face texture: {blobs}"
for o in bpy.data.objects:
    o.hide_render = False

# ---------------------------------------------------------------------------
# Join the parts. Material slot i keeps the part's index in its name, so each vertex still
# knows which part it came from (parts never share vertices).
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
mesh = parts[0]
mesh.name = "ChibiCharacter"
mesh.data.validate(verbose=False)
bpy.data.objects.remove(source_rig)
for o in [o for o in bpy.data.objects if o.type == "EMPTY"]:
    bpy.data.objects.remove(o)
slot_part = [part_index(m.name) for m in mesh.data.materials]
vertex_part = [0] * len(mesh.data.vertices)
for polygon in mesh.data.polygons:
    for vi in polygon.vertices:
        vertex_part[vi] = slot_part[polygon.material_index]

for material in mesh.data.materials:
    tree = material.node_tree
    principled = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
    principled.inputs["Roughness"].default_value = 0.8
    principled.inputs["Metallic"].default_value = 0
    # Tripo links an empty normal map; drop it so the exporter does not chase a missing image.
    for link in [l for l in tree.links if l.to_socket == principled.inputs["Normal"]]:
        tree.links.remove(link)
    for node in [n for n in tree.nodes if n.type == "NORMAL_MAP"]:
        tree.nodes.remove(node)
    for node in tree.nodes:
        if node.type == "TEX_IMAGE" and node.image:
            if node.image.size[0] == 0:
                raise RuntimeError("Missing base-color image: " + node.image.filepath)
            size = TEXTURE_SIZE.get(part_index(material.name), DEFAULT_TEXTURE_SIZE)
            size = min(size, node.image.size[0])
            node.image.scale(size, size)
            node.image.pack()

# ---------------------------------------------------------------------------
# Skeleton: the game's 23 bones at Tripo's joints, symmetrised, hips vertical.
J = {name: (fit(head), fit(tail)) for name, (head, tail) in joints.items()}


def centre(name, at="head"):
    point = J[name][0 if at == "head" else 1]
    return Vector((0, point.y, point.z))


def mirrored(name, at="head"):
    left = J["L_" + name][0 if at == "head" else 1]
    right = J["R_" + name][0 if at == "head" else 1]
    x = (left.x - right.x) / 2
    return {"L": Vector((x, (left.y + right.y) / 2, (left.z + right.z) / 2)), "R": Vector((-x, (left.y + right.y) / 2, (left.z + right.z) / 2))}


armature = bpy.data.armatures.new("ChibiSkeleton")
rig = bpy.data.objects.new("PlayerRig", armature)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")


def bone(name, head, tail, parent=None):
    b = armature.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = armature.edit_bones[parent]


bone("hips", centre("Hip"), centre("Spine01"))
bone("spine", centre("Spine01"), centre("Spine02"), "hips")
bone("chest", centre("Spine02"), centre("NeckTwist01"), "spine")
bone("neck", centre("NeckTwist01"), centre("Head"), "chest")
bone("head", centre("Head"), Vector((0, centre("Head").y, TARGET_HEIGHT * 0.9)), "neck")
for side in "LR":
    bone("shoulder." + side, mirrored("Clavicle")[side], mirrored("Upperarm")[side], "chest")
    bone("upper_arm." + side, mirrored("Upperarm")[side], mirrored("Forearm")[side], "shoulder." + side)
    bone("forearm." + side, mirrored("Forearm")[side], mirrored("Hand")[side], "upper_arm." + side)
    bone("hand." + side, mirrored("Hand")[side], mirrored("Hand", "tail")[side], "forearm." + side)
    bone("thigh." + side, mirrored("Thigh")[side], mirrored("Calf")[side], "hips")
    bone("shin." + side, mirrored("Calf")[side], mirrored("Foot")[side], "thigh." + side)
    bone("foot." + side, mirrored("Foot")[side], mirrored("ToeBase")[side], "shin." + side)
    bone("toe." + side, mirrored("ToeBase")[side], mirrored("ToeBase", "tail")[side], "foot." + side)
    eye = eyes[side]
    eye_center = Vector(((eye["x"][0] + eye["x"][1]) / 2, -0.1, (eye["z"][0] + eye["z"][1]) / 2))
    bone("eye." + side, eye_center, eye_center + Vector((0, 0, 0.035)), "head")
bpy.ops.object.mode_set(mode="OBJECT")
rig.show_in_front = True
armature.display_type = "STICK"
for name, (head, tail) in [(b.name, (b.head_local, b.tail_local)) for b in armature.bones]:
    print(f"bone {name}: ({head.x:.3f}, {head.y:.3f}, {head.z:.3f}) → ({tail.x:.3f}, {tail.y:.3f}, {tail.z:.3f})")

# Weights: fold Tripo groups into game bones, then restrict each part to its allowed bones.
old_groups = {g.index: g.name for g in mesh.vertex_groups}
folded = []
for v in mesh.data.vertices:
    weights = {}
    for g in v.groups:
        target = MERGE.get(old_groups[g.group])
        if target and g.weight > 0:
            weights[target] = weights.get(target, 0) + g.weight
    allowed = ALLOWED[vertex_part[v.index]]
    weights = {name: w for name, w in weights.items() if name in allowed}
    part = vertex_part[v.index]
    if part == 3:
        # The generated vest shared skinning with the lowered arms. Keep the torso cloth
        # on the torso; otherwise raising an arm pulls a long web of vest up with it.
        t = max(0, min(1, (v.co.z - 0.59) / 0.17))
        t = t * t * (3 - 2 * t)
        weights = {"spine": 1 - t, "chest": t}
        if v.co.z < 0.59:
            hips = max(0, min(1, (0.59 - v.co.z) / 0.065))
            weights = {"spine": 1 - hips, "hips": hips}
    elif part in (4, 5):
        side = "L" if part == 4 else "R"
        elbow = mirrored("Forearm")[side].z
        t = max(0, min(1, (v.co.z - elbow + 0.04) / 0.08))
        t = t * t * (3 - 2 * t)
        weights = {f"upper_arm.{side}": t, f"forearm.{side}": 1 - t}
    if not weights:
        weights = {FALLBACK[vertex_part[v.index]]: 1.0}
    top = sorted(weights.items(), key=lambda pair: -pair[1])[:4]
    total = sum(w for _, w in top)
    folded.append([(name, w / total) for name, w in top])
mesh.vertex_groups.clear()
groups = {b.name: mesh.vertex_groups.new(name=b.name) for b in armature.bones}
for v, weights in zip(mesh.data.vertices, folded):
    for name, weight in weights:
        groups[name].add([v.index], weight, "REPLACE")
mesh.modifiers.new("Skin", "ARMATURE").object = rig
mesh.parent = rig

# ---------------------------------------------------------------------------
# Eyelids: a fitted surface that closes over the painted eye (create-chibi-player.py).
mesh.data.calc_loop_triangles()
face_slot = slot_part.index(2)
face_triangles = [t for t in mesh.data.loop_triangles if mesh.data.polygons[t.polygon_index].material_index == face_slot]
face_surface = BVHTree.FromPolygons([v.co for v in mesh.data.vertices], [tuple(t.vertices) for t in face_triangles], all_triangles=True)
uv_layer = mesh.data.uv_layers.active


def face_point(x, z):
    hit, _, index, _ = face_surface.ray_cast(Vector((x, -0.8, z)), Vector((0, 1, 0)))
    if hit is None:
        # The long lash line sweeps past the temple where hair covers the skin. Hug the
        # nearest face surface there instead of failing.
        hit, _, index, _ = face_surface.find_nearest(Vector((x, -0.12, z)))
        if hit is None:
            raise RuntimeError(f"Eyelid lies outside the face at ({x:.3f}, {z:.3f})")
    triangle = face_triangles[index]
    points = [mesh.data.vertices[i].co for i in triangle.vertices]
    coords = [Vector((*uv_layer.data[i].uv, 0)) for i in triangle.loops]
    uv = barycentric_transform(hit, *points, *coords)
    return hit, (uv.x, uv.y)


def fitted_bandage():
    """A thin rounded adhesive strip with a centre pad and printed perforations."""
    vertices, polygons, materials = [], [], []
    angle = math.radians(22)

    def point(u, v, lift):
        x = 0.115 + u * math.cos(angle) - v * math.sin(angle)
        z = 1.004 + u * math.sin(angle) + v * math.cos(angle)
        surface, _ = face_point(x, z)
        return (surface.x, surface.y - lift, surface.z)

    def patch(width, height, radius, lift, material):
        outline = []
        for cx, cy, start in [(width / 2 - radius, height / 2 - radius, 0),
                               (-width / 2 + radius, height / 2 - radius, 90),
                               (-width / 2 + radius, -height / 2 + radius, 180),
                               (width / 2 - radius, -height / 2 + radius, 270)]:
            for step in range(8):
                t = math.radians(start + step * 90 / 7)
                outline.append((cx + radius * math.cos(t), cy + radius * math.sin(t)))
        base = len(vertices)
        vertices.append(point(0, 0, lift))
        for fraction in (0.35, 0.7, 1):
            vertices.extend(point(u * fraction, v * fraction, lift) for u, v in outline)
        n = len(outline)
        for i in range(n):
            polygons.append((base, base + 1 + i, base + 1 + (i + 1) % n))
            materials.append(material)
        for ring in range(2):
            for i in range(n):
                a = base + 1 + ring * n
                b = a + n
                polygons.append((a + i, b + i, b + (i + 1) % n, a + (i + 1) % n))
                materials.append(material)

    patch(0.043, 0.021, 0.0035, 0.0007, 0)
    patch(0.014, 0.015, 0.002, 0.0011, 1)
    for side in (-1, 1):
        for u in (0.012, 0.0165):
            for v in (-0.0045, 0, 0.0045):
                base = len(vertices)
                for step in range(8):
                    t = step * math.tau / 8
                    vertices.append(point(side * u + 0.00055 * math.cos(t), v + 0.00055 * math.sin(t), 0.00085))
                polygons.append(tuple(base + i for i in range(8)))
                materials.append(2)
    data = bpy.data.meshes.new("CheekBandage")
    data.from_pydata(vertices, [], polygons)
    for name, color in [("BandageAdhesive", (0.60, 0.45, 0.32, 1)),
                        ("BandagePad", (0.70, 0.56, 0.41, 1)),
                        ("BandagePerforation", (0.27, 0.18, 0.11, 1))]:
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        shader = material.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = 0.9
        data.materials.append(material)
    for polygon, material in zip(data.polygons, materials):
        polygon.material_index = material
        polygon.use_smooth = True
    obj = bpy.data.objects.new("CheekBandage", data)
    scene.collection.objects.link(obj)
    obj.vertex_groups.new(name="head").add(list(range(len(vertices))), 1, "REPLACE")
    obj.modifiers.new("Skin", "ARMATURE").object = rig
    obj.parent = rig
    return obj


facial_details = [fitted_bandage()]
eyelids = []
glints = []
glint_material = bpy.data.materials.new("EyeCatchlight")
glint_material.use_nodes = True
glint_shader = glint_material.node_tree.nodes.get("Principled BSDF")
glint_shader.inputs["Base Color"].default_value = (0.95, 0.97, 1, 1)
glint_shader.inputs["Roughness"].default_value = 0.4
glint_shader.inputs["Emission Color"].default_value = (0.95, 0.97, 1, 1)
glint_shader.inputs["Emission Strength"].default_value = 0.2
for side, label in [("L", "Left"), ("R", "Right")]:
    eye = eyes[side]
    center_x = (eye["x"][0] + eye["x"][1]) / 2
    center_z = (eye["z"][0] + eye["z"][1]) / 2
    half_w = (eye["x"][1] - eye["x"][0]) / 2 * 1.18 + 0.005
    half_h = (eye["z"][1] - eye["z"][0]) / 2 * 1.35 + 0.007
    opened, closed, faces, coordinates = [], [], [], []
    columns = 32
    _, skin_uv = face_point(center_x, center_z - half_h - 0.02)
    _, lash_uv = face_point(center_x, center_z + half_h * 0.35)
    # Reuse the face's exact tessellation. A separately sampled grid can cross the
    # irregular Tripo triangles between samples and expose little pieces of painted iris.
    cover_vertices = {}
    for triangle in face_triangles:
        points = [mesh.data.vertices[i].co for i in triangle.vertices]
        if (max(p.x for p in points) < center_x - half_w or min(p.x for p in points) > center_x + half_w
                or max(p.z for p in points) < center_z - half_h or min(p.z for p in points) > center_z + half_h
                or min(p.y for p in points) > -0.05):
            continue
        indices = []
        for vi, surface in zip(triangle.vertices, points):
            if vi not in cover_vertices:
                cover_vertices[vi] = len(opened)
                upper = center_z + half_h + 0.012
                top, _ = face_point(surface.x, upper)
                opened.append((surface.x, top.y + 0.005, upper))
                closed.append((surface.x, surface.y - 0.001, surface.z))
                coordinates.append(skin_uv)
            indices.append(cover_vertices[vi])
        faces.append(tuple(indices))
    # A closed eyelash belongs near the centre of the eye. Painting the lower perimeter
    # of the covering patch made a deep U-shape, like an empty eyeglass frame.
    crease_start = len(opened)
    for col in range(columns + 1):
        u = col / columns * 2 - 1
        x = center_x + u * half_w * 0.84
        z = center_z - 0.003 - 0.006 * (1 - u * u)
        thickness = 0.0012 * math.sqrt(max(0.04, 1 - u * u))
        for offset in (-thickness, thickness):
            point, _ = face_point(x, z + offset)
            opened.append((point.x, point.y + 0.005, point.z))
            closed.append((point.x, point.y - 0.005, point.z))
            coordinates.append(lash_uv)
    for col in range(columns):
        a = crease_start + col * 2
        faces.append((a, a + 2, a + 3, a + 1))
    lid_data = bpy.data.meshes.new("Eyelid" + label)
    lid_data.from_pydata(opened, [], faces)
    lid_data.materials.append(mesh.data.materials[face_slot])
    lid_uv = lid_data.uv_layers.new(name="UVMap")
    for loop in lid_data.loops:
        lid_uv.data[loop.index].uv = coordinates[loop.vertex_index]
    for polygon in lid_data.polygons:
        polygon.use_smooth = True
    lid = bpy.data.objects.new("Eyelid" + label, lid_data)
    scene.collection.objects.link(lid)
    lid.shape_key_add(name="Basis")
    blink = lid.shape_key_add(name="eyeBlink" + label, from_mix=False)
    blink.value = 0
    for v, point in zip(blink.data, closed):
        v.co = point
    lid.vertex_groups.new(name="head").add(list(range(len(opened))), 1, "REPLACE")
    lid.modifiers.new("Skin", "ARMATURE").object = rig
    lid.parent = rig
    lid.visible_shadow = False
    eyelids.append(lid)

    # Tiny surface patches keep the existing painted iris intact. The same blink morph
    # retracts them behind the skin so a closed eye never retains a floating white dot.
    shine_open, shine_closed, shine_faces = [], [], []
    for dx, dz, radius in [(-0.009, 0.005, 0.004), (0.007, -0.009, 0.0017)]:
        start = len(shine_open)
        for step in range(12):
            angle = step * math.tau / 12
            point, _ = face_point(center_x + dx + radius * math.cos(angle), center_z + dz + radius * math.sin(angle))
            shine_open.append((point.x, point.y - 0.0012, point.z))
            shine_closed.append((point.x, point.y + 0.004, point.z))
        shine_faces.append(tuple(start + i for i in range(12)))
    shine_data = bpy.data.meshes.new("EyeHighlight" + label)
    shine_data.from_pydata(shine_open, [], shine_faces)
    shine_data.materials.append(glint_material)
    shine = bpy.data.objects.new(shine_data.name, shine_data)
    scene.collection.objects.link(shine)
    shine.shape_key_add(name="Basis")
    shine_blink = shine.shape_key_add(name="eyeBlink" + label, from_mix=False)
    shine_blink.value = 0
    for v, point in zip(shine_blink.data, shine_closed):
        v.co = point
    shine.vertex_groups.new(name="head").add(list(range(len(shine_open))), 1, "REPLACE")
    shine.modifiers.new("Skin", "ARMATURE").object = rig
    shine.parent = rig
    shine.visible_shadow = False
    glints.append(shine)

# ---------------------------------------------------------------------------
# Locomotion clips: the same procedural poses as create-chibi-player.py. `turn` rotates about
# world axes through each bone's rest, so the different rest roll of this skeleton does not matter.
rig.animation_data_create()
rest = {b.name: b.matrix_local.to_quaternion() for b in rig.data.bones}
axes = {axis: Vector(v) for axis, v in {"X": (1, 0, 0), "Y": (0, 1, 0), "Z": (0, 0, 1)}.items()}


def reset_pose():
    for b in rig.pose.bones:
        b.rotation_mode = "QUATERNION"
        b.location = (0, 0, 0)
        b.rotation_quaternion = (1, 0, 0, 0)
        b.scale = (1, 1, 1)


def turn(name, axis, angle):
    b = rig.pose.bones[name]
    b.rotation_quaternion @= Quaternion(rest[name].inverted() @ axes[axis], angle)


def pose(walk_phase=0, walking=0, sitting=0, breathing=0):
    reset_pose()
    turn("spine", "X", 0.008 * breathing)
    turn("head", "Z", 0.008 * breathing)
    for side, sign in [("L", 1), ("R", -1)]:
        swing = math.sin(walk_phase) * sign * walking
        turn("thigh." + side, "X", -0.43 * swing - math.pi / 2 * sitting)
        turn("shin." + side, "X", 0.58 * max(0, swing) + 0.04 * abs(swing) + math.pi / 2 * sitting)
        turn("upper_arm." + side, "X", 0.34 * swing - 0.22 * sitting)
        turn("upper_arm." + side, "Y", -sign * 0.035)
        turn("forearm." + side, "X", -0.055 - 0.15 * max(0, -swing) - 0.55 * sitting)
        turn("hand." + side, "X", -0.03 * swing)
    # The hips bone is vertical, so its local Y is world Z.
    rig.pose.bones["hips"].location.y = -0.18 * sitting


def key_pose(frame):
    for b in rig.pose.bones:
        b.keyframe_insert("location", frame=frame)
        b.keyframe_insert("rotation_quaternion", frame=frame)
        b.keyframe_insert("scale", frame=frame)


sole_indices = [v.index for v in mesh.data.vertices if v.co.z < 0.065]


def ground_feet():
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    data = evaluated.to_mesh()
    floor = min(data.vertices[i].co.z for i in sole_indices)
    evaluated.to_mesh_clear()
    rig.pose.bones["hips"].location.y -= floor


def linear(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = "LINEAR"


for name, duration in [("Idle", 120), ("Walk", 32), ("Sit", 30), ("SitDown", 24), ("StandUp", 24)]:
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data.action = action
    for frame in range(duration + 1):
        t = frame / duration
        ease = t * t * (3 - 2 * t)
        sit = 1 if name == "Sit" else ease if name == "SitDown" else 1 - ease if name == "StandUp" else 0
        pose(t * math.tau, int(name == "Walk"), sit, math.sin(t * math.tau) if name == "Idle" else 0)
        # Sitting is authored with hanging legs. Only locomotion is floor locked.
        if name in ("Idle", "Walk"):
            ground_feet()
        key_pose(frame + 1)
    linear(action)


def activate(action):
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]


activate(bpy.data.actions["Idle"])
scene.frame_start, scene.frame_end = 1, 121
scene.frame_set(1)
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
for lid in eyelids + glints + facial_details:
    lid.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.wm.save_as_mainfile(filepath=str(args.output / "player-chibi.blend"))
bpy.ops.export_scene.gltf(
    filepath=str(args.output / "player-chibi.glb"), export_format="GLB",
    use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
    export_image_format="WEBP", export_image_quality=90, export_force_sampling=True,
    export_skins=True, export_def_bones=True,
)
print("CHIBI_READY", len(mesh.data.vertices), "vertices", len(mesh.data.polygons), "tris", len(rig.data.bones), "bones")

# Curtain clips (curtain-pull-*.glb) are moved onto this rest pose afterwards by
# scripts/retarget-curtain-clips.mjs; they have no skin, so Blender would not read them as a rig.
