"""Turn the Tripo-rigged chibi FBX into the game's player rig in a Blender background process.

blender -b --factory-startup --python scripts/assets/create-tripo-player.py -- INPUT.fbx OUTPUT_DIR

What it does, in order:

1. Decimates the 1.9M-triangle Tripo parts to ~37K triangles (per-part budgets, UVs kept).
2. Fits the source to 1.55 units, relaxes surface noise and removes raised crown wisps
   (finished height ~1.512), then joins the parts. Feet remain on z=0.
3. Rebuilds the skeleton with the game's bone names at the Tripo joint positions (twist
   bones merged into their parents, left/right symmetrised) and cleans the auto weights:
   each part may only follow the bones that make sense for it (hands never follow thighs).
4. Fits blink eyelids and subtle retracting catchlights over the painted eyes.
5. Authors Idle/Walk/Sit/SitDown/StandUp exactly like scripts/assets/create-chibi-player.py.
6. Exports player-chibi.glb and saves the .blend. After `pnpm model:prep`, decode with
   `gltf-transform copy`, run `repair-player-clothing.mjs`, then
   `round-player-clothing.mjs` (Blender worker), then run it with `--collar`
   on the rounded output, then `--sleeves`, and Meshopt-compress again.
   This closes the vest's side seams and smooths clothing without changing the rig.

The curtain-pull clips are carried over separately: scripts/assets/retarget-curtain-clips.mjs.
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
        nearby = min(bm.faces, key=lambda f: (f.calc_center_median() - Vector((0.06, -0.08, 1.48))).length)
        cap_uv = sum((loop[uv].uv for loop in nearby.loops), Vector((0, 0))) / len(nearby.loops)
        # The roots of the removed wisps remain shared with the main locks. Settle their
        # little upright peaks into the crown and keep the newly closed surface rounded.
        crown = [v for v in bm.verts if v.co.z > 1.48 and abs(v.co.x) < 0.065 and -0.14 < v.co.y < 0.035]
        for v in crown:
            if v.co.z > 1.495:
                v.co.z = 1.495 + (v.co.z - 1.495) * 0.1
        for _ in range(4):
            bmesh.ops.smooth_vert(bm, verts=crown, factor=0.3, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        # Close the actual irregular rim with an inset surface. A sphere on top reads
        # as a round plug; this joins the roots and stays lower than every rim vertex.
        top_edges = [e for e in bm.edges if e.is_boundary and all(v.co.z > 1.46 for v in e.verts)]
        if top_edges:
            rim = {v for e in top_edges for v in e.verts}
            centre = sum((v.co for v in rim), Vector()) / len(rim)
            centre.z = min(v.co.z for v in rim) - 0.008
            centre_vertex = bm.verts.new(centre)
            for edge in top_edges:
                loop = next(l for l in edge.link_faces[0].loops if l.edge == edge)
                face = bm.faces.new((loop.link_loop_next.vert, loop.vert, centre_vertex))
                for l in face.loops:
                    l[uv].uv = cap_uv
        print(f"Crown cleanup: removed {strands} wisp surfaces ({len(removed)} faces)")
    # Work on the final triangle spacing. Boundaries stay fixed to keep cuffs and neck joins.
    iterations, factor, limit = {
        0: (3, 0.28, 0.0025),
        1: (16, 0.48, 0.014),
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
    if index in (3, 4, 5, 6):
        # Small boundary zigzags show as frayed vest armholes/collar edges in profile.
        # Relax along the boundary only; a 1mm cap preserves garment openings.
        rim = {v for e in bm.edges if e.is_boundary for v in e.verts}
        original_rim = {v: v.co.copy() for v in rim}
        for _ in range(3):
            updates = {}
            for v in rim:
                neighbors = [e.other_vert(v).co for e in v.link_edges if e.is_boundary]
                if len(neighbors) != 2:
                    continue
                delta = v.co.lerp((neighbors[0]+neighbors[1])/2, 0.35)-original_rim[v]
                if delta.length > 0.001:
                    delta *= 0.001/delta.length
                updates[v] = original_rim[v]+delta
            for v, point in updates.items():
                v.co = point
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()


def repair_openings(obj, index):
    """Reconstruct surfaces absent in Tripo's arms-down scan, plus the bandage socket."""
    global cheek_curve
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
        if cheek_socket:
            sample = min(bm.faces, key=lambda f: (f.calc_center_median() - Vector((0.145, -0.15, 1.045))).length)
        color_uv = sum((loop[uv].uv for loop in sample.loops), Vector((0, 0))) / len(sample.loops)
        if arm_seam:
            # Tripo's cut has T-junctions, so it is not a fillable manifold edge loop.
            # Reconstruct the missing side from its front/back cross-sections instead.
            grid, rows, columns = [], 32, 10
            sign = 1 if (low.x + high.x) > 0 else -1
            for row in range(rows + 1):
                z = low.z + (high.z - low.z) * (0.0001 + 0.9998 * row / rows)
                crossings = []
                for edge in edges:
                    a, b = (v.co for v in edge.verts)
                    if abs(b.z - a.z) > 1e-7 and min(a.z, b.z) <= z <= max(a.z, b.z):
                        crossings.append(a.lerp(b, (z - a.z) / (b.z - a.z)))
                if len(crossings) < 2:
                    crossings = [v.co for v in sorted(verts, key=lambda v: abs(v.co.z - z))[:8]]
                front, back = min(crossings, key=lambda p: p.y), max(crossings, key=lambda p: p.y)
                line = []
                for col in range(columns + 1):
                    t = col / columns
                    co = front.lerp(back, t)
                    co.z = z
                    co.y += (t * 2 - 1) * 0.002
                    co.x += sign * (0.002 if index == 3 else -0.018) * math.sin(math.pi * t) * math.sin(math.pi * row / rows) ** 0.35
                    line.append(bm.verts.new(co))
                grid.append(line)
            for row in range(rows):
                for col in range(columns):
                    corners = [grid[row][col], grid[row][col + 1], grid[row + 1][col + 1], grid[row + 1][col]]
                    if (sign < 0) != (index != 3):
                        corners.reverse()
                    face = bm.faces.new(corners)
                    for loop in face.loops:
                        loop[uv].uv = color_uv
            print(f"Surface repair part {index}: rebuilt side with {rows * columns} quads")
            continue
        caps = bmesh.ops.holes_fill(bm, edges=edges, sides=0)["faces"]
        for face in caps:
            for loop in face.loops:
                loop[uv].uv = color_uv
        triangles = bmesh.ops.triangulate(bm, faces=caps)["faces"]
        long_edges = {e for f in triangles for e in f.edges if e.calc_length() > 0.006}
        if long_edges:
            bmesh.ops.subdivide_edges(bm, edges=list(long_edges), cuts=3, use_grid_fill=True)
        print(f"Surface repair part {index}: {len(edges)} boundary edges, {len(caps)} caps")
    if index == 2:
        # The old bandage leaves both a puckered socket and a baked outline. Restore
        # that small cheek region from a smooth fit to the intact opposite cheek.
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bm.faces.ensure_lookup_table()
        source_faces = list(bm.faces)
        mirror_surface = BVHTree.FromBMesh(bm)
        samples, depths = [], []
        for u in np.linspace(-1.3, 1.3, 17):
            for v in np.linspace(-1.3, 1.3, 17):
                hit, _, _, _ = mirror_surface.ray_cast(Vector((-(0.111 + u * 0.028), -0.8, 1.004 + v * 0.04)), Vector((0, 1, 0)))
                if hit is not None and hit.y < -0.06:
                    samples.append([1, u, v, u*u, u*v, v*v])
                    depths.append(hit.y)
        cheek_curve = np.linalg.lstsq(np.array(samples), np.array(depths), rcond=None)[0]
        skin_image = next(n.image for n in obj.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
        image_width, image_height = skin_image.size
        skin_pixels = np.empty(image_width * image_height * 4, dtype=np.float32)
        skin_image.pixels.foreach_get(skin_pixels)
        skin_pixels = skin_pixels.reshape(image_height, image_width, 4)

        def skin_color(coord):
            x = min(image_width - 1, max(0, coord.x * image_width - 0.5))
            y = min(image_height - 1, max(0, coord.y * image_height - 0.5))
            ix, iy = int(x), int(y)
            nx, ny = min(ix + 1, image_width - 1), min(iy + 1, image_height - 1)
            rgb = (skin_pixels[iy, ix, :3] * (1 - x + ix) + skin_pixels[iy, nx, :3] * (x - ix)) * (1 - y + iy)
            rgb += (skin_pixels[ny, ix, :3] * (1 - x + ix) + skin_pixels[ny, nx, :3] * (x - ix)) * (y - iy)
            return np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)

        # Native vertex colours blend the small repair into the original skin.
        # Interpolating UV coordinates across separate islands cannot do that.
        repair_color = bm.loops.layers.float_color.new('CheekRepairColor')
        for face in bm.faces:
            for loop in face.loops:
                loop[repair_color] = (1, 1, 1, 1)
        repair_material = bpy.data.materials.new('tripo_part_2_material_CheekRepair')
        repair_material.use_nodes = True
        shader = repair_material.node_tree.nodes.get('Principled BSDF')
        color_node = repair_material.node_tree.nodes.new('ShaderNodeVertexColor')
        color_node.layer_name = 'CheekRepairColor'
        repair_material.node_tree.links.new(color_node.outputs['Color'], shader.inputs['Base Color'])
        repair_slot = len(obj.data.materials)
        obj.data.materials.append(repair_material)

        for v in bm.verts:
            if v.co.y >= -0.06:
                continue
            radius = math.hypot((v.co.x - 0.111) / 0.028, (v.co.z - 1.004) / 0.04)
            fade = max(0, min(1, (1.6 - radius) / 0.6))
            if fade:
                u, w = (v.co.x - 0.111) / 0.028, (v.co.z - 1.004) / 0.04
                depth = float(np.dot(cheek_curve, [1, u, w, u*u, u*w, w*w]))
                # The underside turns away from the front-facing cheek. Fade from
                # its original depth instead of projecting two layers onto one plane.
                front = max(0, min(1, (-v.co.y - 0.06) / 0.04))
                front = front * front * (3 - 2 * front)
                v.co.y += (depth - v.co.y) * fade * fade * (3 - 2 * fade) * front
        # The chin underside is not a single-valued depth field. Relax in XYZ here
        # so projecting the cheek does not leave a folded crease below the bandage.
        jaw_original, jaw_weights = {}, {}
        for vertex in bm.verts:
            p = vertex.co
            radius = math.sqrt(((p.x-0.105)/0.05)**2 + ((p.y+0.09)/0.055)**2 + ((p.z-0.974)/0.028)**2)
            weight = max(0, min(1, (1.3-radius)/0.6))
            weight *= max(0, min(1, (0.996-p.z)/0.014))
            if weight and not vertex.is_boundary:
                jaw_original[vertex] = p.copy();jaw_weights[vertex] = weight
        for _ in range(24):
            updates = {}
            for vertex, weight in jaw_weights.items():
                neighbors = [edge.other_vert(vertex).co for edge in vertex.link_edges]
                average = sum(neighbors, Vector())/len(neighbors)
                delta = vertex.co.lerp(average, 0.45*weight)-jaw_original[vertex]
                if delta.length > 0.009:
                    delta *= 0.009/delta.length
                updates[vertex] = jaw_original[vertex]+delta
            for vertex, point in updates.items():
                vertex.co = point
        for face in bm.faces:
            center = face.calc_center_median()
            radius = min(math.hypot((v.co.x - 0.111) / 0.028, (v.co.z - 1.004) / 0.04) for v in face.verts)
            if center.y >= -0.06 or radius >= 1.6:
                continue
            hit, _, source_index, _ = mirror_surface.ray_cast(Vector((-center.x, -0.8, center.z)), Vector((0, 1, 0)))
            if hit is None:
                continue
            source = source_faces[source_index]
            points = [v.co.copy() for v in source.verts]
            coords = [Vector((*loop[uv].uv, 0)) for loop in source.loops]
            face.material_index = repair_slot
            # Use one source triangle for every corner: welded vertices can belong
            # to different UV islands, and interpolating between islands paints seams.
            for loop in face.loops:
                co = loop.vert.co
                mapped = barycentric_transform(Vector((-co.x, hit.y, co.z)), *points, *coords)
                radius = math.hypot((co.x - 0.111) / 0.028, (co.z - 1.004) / 0.04)
                blend = max(0, min(1, (1.6 - radius) / 0.5))
                blend = blend * blend * (3 - 2 * blend)
                color = skin_color(loop[uv].uv) * (1 - blend) + skin_color(mapped.xy) * blend
                loop[repair_color] = (*color, 1)
        rebuild_forehead(bm, obj, uv, repair_color, repair_material, skin_color)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()


def rebuild_forehead(bm, obj, uv, color_layer, skin_material, skin_color):
    """Replace the scan's hair-shaped facial cutouts with a connected forehead."""
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.faces.ensure_lookup_table()
    source = [([v.co.copy() for v in face.verts], [Vector((*loop[uv].uv, 0)) for loop in face.loops]) for face in bm.faces]
    surface = BVHTree.FromBMesh(bm)

    def sample(x, z):
        hit, _, index, _ = surface.ray_cast(Vector((x, -0.8, z)), Vector((0, 1, 0)))
        if hit is None or hit.y > 0.035:
            return None, None
        points, coords = source[index]
        mapped = barycentric_transform(hit, *points, *coords)
        return hit, skin_color(mapped.xy)

    samples, depths = [], []
    for x in np.linspace(-0.21, 0.21, 43):
        for z in np.linspace(1.15, 1.27, 25):
            hit, _ = sample(x, z)
            if hit is not None:
                u, v = x / 0.22, (z - 1.15) / 0.15
                samples.append([1, u, v, u*u, u*v, v*v]);depths.append(hit.y)
    curve = np.linalg.lstsq(np.array(samples), np.array(depths), rcond=None)[0]
    clean = np.mean([sample(x, 1.16)[1] for x in (-0.025, 0, 0.025)], axis=0)
    brows = {}
    for sign in (-1, 1):
        positions, levels, widths, inks = [], [], [], []
        for x in np.linspace(0.045, 0.18, 48):
            dark = []
            for z in np.linspace(1.158, 1.18, 65):
                _, rgb = sample(sign*x, z)
                if rgb is not None and float(np.mean(rgb)) < 0.08:
                    dark.append(z);inks.append(rgb)
            if len(dark) >= 3:
                positions.append([1, x, x*x]);levels.append(float(np.median(dark)));widths.append((max(dark)-min(dark))/2)
        matrix, values = np.array(positions), np.array(levels)
        keep = np.ones(len(values), dtype=bool)
        for _ in range(3):
            profile = np.linalg.lstsq(matrix[keep], values[keep], rcond=None)[0]
            keep = np.abs(matrix@profile-values) < 0.003
        brows[sign] = (profile, max(0.002, min(0.004, float(np.median(widths)))), np.mean(inks, axis=0))
    cut_z = 1.141
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=1e-6,
                          plane_co=Vector((0, 0, cut_z)), plane_no=Vector((0, 0, 1)))
    removed = [face for face in bm.faces if min(v.co.z for v in face.verts) >= cut_z - 1e-6
               and abs(face.calc_center_median().x) < 0.218 and face.calc_center_median().y < 0.035]
    bmesh.ops.delete(bm, geom=removed, context='FACES')
    rim = [e for e in bm.edges if e.is_boundary and all(abs(v.co.z-cut_z) < 2e-6 and abs(v.co.x) < 0.222 and v.co.y < 0.035 for v in e.verts)]
    if not rim:
        raise RuntimeError('No connected lower forehead edge after trimming')
    # Keep the actual lower edge vertices so the new forehead shares the face mesh.
    bmesh.ops.subdivide_edges(bm, edges=[e for e in rim if e.calc_length() > 0.004], cuts=2, use_grid_fill=True)
    rim = [e for e in bm.edges if e.is_boundary and all(abs(v.co.z-cut_z) < 2e-6 and abs(v.co.x) < 0.222 and v.co.y < 0.035 for v in e.verts)]
    # The cut also intersects disconnected ear/temple returns. Sorting every vertex
    # by X bridges those islands with a long unsupported face. Follow the actual
    # connected front rim instead, preserving each original lower edge.
    remaining, components = set(rim), []
    while remaining:
        edge = remaining.pop();component = {edge};stack = [edge]
        while stack:
            for vertex in stack.pop().verts:
                for linked in vertex.link_edges:
                    if linked in remaining:
                        remaining.remove(linked);component.add(linked);stack.append(linked)
        components.append(component)
    front_rim = max(components, key=lambda edges: max(v.co.x for e in edges for v in e.verts)-min(v.co.x for e in edges for v in e.verts))
    adjacency = {}
    for edge in front_rim:
        for vertex in edge.verts:
            adjacency.setdefault(vertex, []).append(edge)
    ends = [v for v, edges in adjacency.items() if len(edges) == 1]
    if len(ends) != 2 or any(len(edges) > 2 for edges in adjacency.values()):
        raise RuntimeError('Forehead rim must be a single unbranched open chain')
    bottom, unused = [min(ends, key=lambda v: v.co.x)], set(front_rim)
    while unused:
        edge = next(e for e in adjacency[bottom[-1]] if e in unused)
        unused.remove(edge);bottom.append(edge.other_vert(bottom[-1]))
    # Closely spaced rows retain the thin eyebrow; the hidden upper forehead can be coarser.
    levels = list(np.linspace(cut_z, 1.185, 34)) + list(np.linspace(1.195, 1.38, 8))
    rows, grid = len(levels)-1, []
    deform = bm.verts.layers.deform.active
    head_group = obj.vertex_groups['Head'].index
    for base in bottom:
        column = [base]
        for row in range(1, rows + 1):
            z = levels[row]
            spread = max(0, min(1, (z-cut_z)/0.05));spread=spread*spread*(3-2*spread)
            extent = abs(bottom[0].co.x) if base.co.x < 0 else bottom[-1].co.x
            x = base.co.x * (1 + (0.222/extent-1)*spread)
            u, v = x/0.22, (min(z, 1.27)-1.15)/0.15
            depth = float(np.dot(curve, [1, u, v, u*u, u*v, v*v]))
            depth += 0.10 * (max(0, z-1.27)/0.11)**2
            blend = min(1, (z-cut_z)/0.018)
            blend = blend*blend*(3-2*blend)
            depth = base.co.y*(1-blend) + depth*blend
            vertex = bm.verts.new((x, depth, z))
            vertex[deform][head_group] = 1
            column.append(vertex)
        grid.append(column)
    material = skin_material.copy();material.name='tripo_part_2_material_ForeheadRepair'
    slot = len(obj.data.materials);obj.data.materials.append(material)
    for col in range(len(grid)-1):
        for row in range(rows):
            face = bm.faces.new((grid[col][row], grid[col+1][row], grid[col+1][row+1], grid[col][row+1]))
            face.material_index=slot
            for loop in face.loops:
                p=loop.vert.co
                _, original=sample(p.x, p.z)
                blend=max(0,min(1,(p.z-cut_z)/0.006));blend=blend*blend*(3-2*blend)
                rgb=clean.copy() if original is None else original*(1-blend)+clean*blend
                if 0.04 < abs(p.x) < 0.185:
                    profile, thickness, ink = brows[-1 if p.x < 0 else 1]
                    x=abs(p.x);center=float(np.dot(profile,[1,x,x*x]))
                    taper=min(1,(x-0.04)/0.012,(0.185-x)/0.015)
                    mask=max(0,min(1,(thickness*taper-abs(p.z-center))/0.0008+0.5))
                    rgb=rgb*(1-mask)+ink*mask
                loop[color_layer]=(*rgb,1)
    print(f'Forehead reconstruction: {len(bottom)} columns, {rows} rows; joined at z={cut_z}')


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
if 'CheekRepairColor' in mesh.data.color_attributes:
    cheek_colors = mesh.data.color_attributes['CheekRepairColor']
    mesh.data.color_attributes.active_color = cheek_colors
    mesh.data.color_attributes.render_color_index = mesh.data.color_attributes.find('CheekRepairColor')
    for polygon in mesh.data.polygons:
        if not mesh.data.materials[polygon.material_index].name.endswith(('_CheekRepair', '_ForeheadRepair')):
            for loop_index in polygon.loop_indices:
                cheek_colors.data[loop_index].color = (1, 1, 1, 1)
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
    if part == 1 and weights:
        # Keep the waistband on the pelvis when thighs rotate 90 degrees for Sit.
        # Match reweight-player-hips.mjs: blend over upper thigh, preserve knees/feet.
        t = max(0, min(1, (v.co.z - 0.42) / 0.11))
        pelvis = t * t * (3 - 2 * t)
        total = sum(weights.values())
        weights = {name: w * (1 - pelvis) for name, w in weights.items()}
        weights["hips"] = weights.get("hips", 0) + pelvis * total
    elif part == 3:
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
        # The sleeve root stays in the armhole: toward the shoulder the upper-arm share passes to
        # the shoulder bone and then to the chest, so a raised arm bends out over the vest
        # instead of swinging in under its rim. The game turns the shoulder bone half as far as
        # the upper arm (src/scenes/memory-room/player/sleeve-root.ts), which keeps the sleeve
        # from collapsing. scripts/assets/reweight-player-sleeves.mjs bakes the same weights
        # into an exported GLB.
        shoulder = mirrored("Upperarm")[side]
        along = mirrored("Forearm")[side] - shoulder
        down = (v.co - shoulder).dot(along) / along.length_squared
        ramp = lambda x: (lambda c: c * c * (3 - 2 * c))(max(0, min(1, x)))
        if down < 0.35:
            half = ramp(down / 0.35)
            weights[f"shoulder.{side}"] = t * half
            weights["chest"] = t * (1 - half)
            weights[f"upper_arm.{side}"] = 0
        elif down < 0.9:
            arm = ramp((down - 0.35) / (0.9 - 0.35))
            weights[f"upper_arm.{side}"] = t * arm
            weights[f"shoulder.{side}"] = t * (1 - arm)
    elif part == 6:
        # The shoulder bones now turn with the arms; the collar must not ride along.
        for side in ("L", "R"):
            moved = weights.pop(f"shoulder.{side}", 0)
            if moved:
                weights["chest"] = weights.get("chest", 0) + moved
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
face_triangles = [t for t in mesh.data.loop_triangles if slot_part[mesh.data.polygons[t.polygon_index].material_index] == 2]
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


def fit_eye_surface(eye):
    cx, cz = sum(eye["x"]) / 2, sum(eye["z"]) / 2
    hw = (eye["x"][1] - eye["x"][0]) / 2 * 1.4 + 0.006
    hh = (eye["z"][1] - eye["z"][0]) / 2 * 1.4 + 0.006
    samples, depths = [], []
    for edge in range(4):
        for step in range(21):
            t = step / 20 * 2 - 1
            u, v = [(t, -1), (t, 1), (-1, t), (1, t)][edge]
            x, z = cx + u * hw, cz + v * hh
            p, _ = face_point(x, z)
            if p.y > -0.08 or abs(p.x - x) > 0.002 or abs(p.z - z) > 0.002:
                continue
            samples.append([1, u, v, u * u, u * v, v * v])
            depths.append(p.y)
    matrix, values = np.array(samples), np.array(depths)
    keep = np.ones(len(values), dtype=bool)
    for _ in range(3):
        coefficients = np.linalg.lstsq(matrix[keep], values[keep], rcond=None)[0]
        residual = np.abs(matrix @ coefficients - values)
        keep = residual < max(0.006, float(np.median(residual)) * 2.5)
    return cx, cz, hw, hh, coefficients


def eye_surface(x, z, fitted_eye):
    cx, cz, hw, hh, coefficients = fitted_eye
    u, v = (x - cx) / hw, (z - cz) / hh
    fade = max(0, min(1, (1.35 - math.hypot(u, v)) / 0.55))
    fade = fade * fade * (3 - 2 * fade)
    cheek_limit = max(0, min(1, (z - 1.04) / 0.02))
    fade *= cheek_limit * cheek_limit * (3 - 2 * cheek_limit)
    return float(np.dot(coefficients, [1, u, v, u*u, u*v, v*v])), fade


# Settle the uneven eye sockets once, before fitting overlays. Animating this
# correction moved the painted irises by 12.5mm at half blink and made them ripple.
# Their UVs and positions now stay fixed throughout a blink.
eye_fits = {side: fit_eye_surface(eye) for side, eye in eyes.items()}
for vertex in mesh.data.vertices:
    if vertex_part[vertex.index] != 2 or vertex.co.y >= -0.05:
        continue
    depth, fade = max((eye_surface(vertex.co.x, vertex.co.z, fitted) for fitted in eye_fits.values()), key=lambda result: result[1])
    vertex.co.y += max(-0.025, min(0.025, depth - vertex.co.y)) * fade
mesh.data.update()
face_surface = BVHTree.FromPolygons([v.co for v in mesh.data.vertices], [tuple(t.vertices) for t in face_triangles], all_triangles=True)


def fitted_bandage():
    """A thin rounded adhesive strip with a centre pad and printed perforations."""
    vertices, polygons, materials = [], [], []
    angle = math.radians(65)

    def point(u, v, lift):
        x = 0.111 + u * math.cos(angle) - v * math.sin(angle)
        z = 1.017 + u * math.sin(angle) + v * math.cos(angle)
        # Fit the finished skin, including the relaxed jaw transition. Keeping the
        # strip above the chin turn prevents an adhesive tip hanging in open air.
        surface, _ = face_point(x, z)
        return (x, surface.y - lift, z)

    def patch(width, height, radius, lift, material):
        base = len(vertices)
        columns, rows = 40, 16
        for col in range(columns + 1):
            u = width * (col / columns - 0.5)
            corner = max(0, abs(u) - (width / 2 - radius))
            half_h = height / 2 - radius + math.sqrt(max(0, radius * radius - corner * corner))
            for row in range(rows + 1):
                vertices.append(point(u, half_h * (row / rows * 2 - 1), lift))
        for col in range(columns):
            for row in range(rows):
                a = base + col * (rows + 1) + row
                b = a + rows + 1
                polygons.append((a, b, b + 1, a + 1))
                materials.append(material)

    patch(0.055, 0.026, 0.004, 0.0007, 0)
    patch(0.014, 0.018, 0.002, 0.0011, 1)
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
    center_x, center_z, half_w, half_h, coefficients = eye_fits[side]
    opened, closed, faces, coordinates = [], [], [], []
    columns = 32
    _, skin_uv = face_point(center_x, center_z - half_h - 0.02)
    _, lash_uv = face_point(center_x, center_z + half_h * 0.35)
    def closed_y(point):
        front, _ = face_point(point.x, point.z)
        return front.y

    # Close a separate lid over the stable eye surface.
    rows = 24
    for col in range(columns + 1):
        x = center_x + half_w * (col / columns * 2 - 1)
        upper = center_z + half_h
        top, _ = face_point(x, upper + 0.012)
        for row in range(rows + 1):
            z = upper - half_h * 2 * row / rows
            p, _ = face_point(x, z)
            opened.append((x, top.y + 0.005, upper + 0.012))
            closed.append((x, closed_y(Vector((x, p.y, z))) - 0.0015, z))
            coordinates.append(skin_uv)
    for col in range(columns):
        for row in range(rows):
            a = col * (rows + 1) + row
            b = a + rows + 1
            faces.append((a, a + 1, b + 1, b))
    # A closed eyelash belongs near the centre of the eye. Painting the lower perimeter
    # of the covering patch made a deep U-shape, like an empty eyeglass frame.
    crease_start = len(opened)
    for col in range(columns + 1):
        u = col / columns * 2 - 1
        x = center_x + u * half_w * 0.7
        z = center_z - 0.003 - 0.006 * (1 - u * u)
        thickness = 0.0012 * math.sqrt(max(0.04, 1 - u * u))
        for offset in (-thickness, thickness):
            point, _ = face_point(x, z + offset)
            opened.append((point.x, point.y + 0.005, point.z))
            closed.append((point.x, closed_y(point) - 0.002, point.z))
            coordinates.append(lash_uv)
    for col in range(columns):
        a = crease_start + col * 2
        faces.append((a, a + 2, a + 3, a + 1))
    lid_data = bpy.data.meshes.new("Eyelid" + label)
    lid_data.from_pydata(opened, [], faces)
    lid_material = mesh.data.materials[face_slot].copy()
    lid_material.name = "EyelidSkin" + label
    lid_material.surface_render_method = "DITHERED"
    alpha_node = lid_material.node_tree.nodes.new("ShaderNodeVertexColor")
    alpha_node.layer_name = "LidOpacity"
    shader = next(n for n in lid_material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    # Blender 5.2's glTF exporter recognizes the current Mix node, not legacy MixRGB.
    tint = lid_material.node_tree.nodes.new("ShaderNodeMix")
    tint.data_type = 'RGBA'
    tint.blend_type = "MULTIPLY"
    tint.inputs[0].default_value = 1
    original_color = shader.inputs["Base Color"].links[0].from_socket
    lid_material.node_tree.links.new(original_color, tint.inputs[6])
    lid_material.node_tree.links.new(alpha_node.outputs["Color"], tint.inputs[7])
    lid_material.node_tree.links.new(tint.outputs[2], shader.inputs["Base Color"])
    lid_material.node_tree.links.new(alpha_node.outputs["Alpha"], shader.inputs["Alpha"])
    lid_data.materials.append(lid_material)
    opacity = lid_data.color_attributes.new(name="LidOpacity", type="FLOAT_COLOR", domain="CORNER")
    lid_data.color_attributes.active_color = opacity
    lid_data.color_attributes.render_color_index = lid_data.color_attributes.find('LidOpacity')
    for loop in lid_data.loops:
        alpha = 1
        if loop.vertex_index < crease_start:
            x, _, z = closed[loop.vertex_index]
            distance = math.hypot((x - center_x) / half_w, (z - center_z) / half_h)
            alpha = max(0, min(1, (1 - distance) / 0.2))
            alpha = alpha * alpha * (3 - 2 * alpha)
        opacity.data[loop.index].color = (1, 1, 1, alpha)
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
            shine_closed.append((point.x, closed_y(point) + 0.004, point.z))
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
    export_vertex_color="ACTIVE",
)
print("CHIBI_READY", len(mesh.data.vertices), "vertices", len(mesh.data.polygons), "tris", len(rig.data.bones), "bones")

# Curtain clips (curtain-pull-*.glb) are moved onto this rest pose afterwards by
# scripts/assets/retarget-curtain-clips.mjs; they have no skin, so Blender would not read them as a rig.
