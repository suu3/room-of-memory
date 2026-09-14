"""Build the user-supplied chibi in a dedicated Blender background process.

blender --background --factory-startup --python scripts/create-chibi-player.py -- INPUT.fbx OUTPUT_DIR
Keeps the source mesh/UVs, fits a game skeleton, and authors five locomotion clips.
The output is editable Blender + uncompressed GLB; run model:prep afterwards.
"""

import argparse
import math
import sys
from collections import defaultdict
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree


parser = argparse.ArgumentParser()
parser.add_argument("input", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
args.output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(args.input.resolve()))
mesh = next(o for o in bpy.context.selected_objects if o.type == "MESH")
mesh.name = "ChibiCharacter"
mesh.data.transform(mesh.matrix_world)
mesh.matrix_world = Matrix.Identity(4)
points = [v.co for v in mesh.data.vertices]
height = max(v.z for v in points) - min(v.z for v in points)
origin = Vector((0, 0, min(v.z for v in points)))
for v in mesh.data.vertices:
    v.co = (v.co - origin) * (1.55 / height)
    # The pelvis is slightly offset in the supplied AI mesh. Center the body.
    v.co.x -= 0.022
for polygon in mesh.data.polygons:
    polygon.use_smooth = True
for material in mesh.data.materials:
    for node in material.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image:
            if node.image.size[0] == 0:
                raise RuntimeError("Missing base-color image: " + node.image.filepath)
            node.image.scale(2048, 2048)
            node.image.pack()
        if node.type == "BSDF_PRINCIPLED":
            node.inputs["Roughness"].default_value = 0.8
            node.inputs["Metallic"].default_value = 0

# Identify islands on a welded copy; preserve the source's UVs, custom normals
# and polygons. Its face surface is also used to fit the new eyelids.
bm = bmesh.new()
bm.from_mesh(mesh.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00003)


def connected_islands():
    seen = set()
    result = []
    for v in bm.verts:
        if v in seen:
            continue
        stack = [v]
        seen.add(v)
        island = []
        while stack:
            current = stack.pop()
            island.append(current)
            for edge in current.link_edges:
                other = edge.other_vert(current)
                if other not in seen:
                    seen.add(other)
                    stack.append(other)
        result.append(island)
    return sorted(result, key=len, reverse=True)


parts = connected_islands()
part_tree = KDTree(sum(map(len, parts)))
for index, part in enumerate(parts):
    for v in part:
        part_tree.insert(v.co, index)
part_tree.balance()
original = mesh.data
original.calc_loop_triangles()
face_triangles = [t for t in original.loop_triangles if all(part_tree.find(original.vertices[i].co)[1] == 2 for i in t.vertices)]
face_surface = BVHTree.FromPolygons([v.co for v in original.vertices], [tuple(t.vertices) for t in face_triangles], all_triangles=True)

islands = [[v.co.copy() for v in part] for part in connected_islands()]
body_id = next(i for i, part in enumerate(islands) if min(v.z for v in part) < .01)
face_id = next(i for i, part in enumerate(islands) if .78 < min(v.z for v in part) < .81 and max(v.z for v in part) < 1.4)

tree = KDTree(sum(map(len, islands)))
for index, island in enumerate(islands):
    for point in island:
        tree.insert(point, index)
tree.balance()
island_ids = [tree.find(v.co)[1] for v in mesh.data.vertices]
bm.verts.ensure_lookup_table()
bm.verts.index_update()
weld_tree = KDTree(len(bm.verts))
neighbors = []
for v in bm.verts:
    weld_tree.insert(v.co, v.index)
    neighbors.append([e.other_vert(v).index for e in v.link_edges])
weld_tree.balance()
weld_ids = [weld_tree.find(v.co)[1] for v in mesh.data.vertices]
bm.free()
eye_islands = {}
hand_islands = {}
for index, island in enumerate(islands):
    lo = Vector([min(v[a] for v in island) for a in range(3)])
    hi = Vector([max(v[a] for v in island) for a in range(3)])
    if lo.z > 1.06 and hi.z < 1.13 and hi.y < -0.12:
        eye_islands["L" if (lo.x + hi.x) > 0 else "R"] = index
    if lo.z > 0.39 and hi.z < 0.50:
        hand_islands["L" if (lo.x + hi.x) > 0 else "R"] = index
assert len(eye_islands) == 2 and len(hand_islands) == 2, "Unexpected source topology"

armature = bpy.data.armatures.new("ChibiSkeleton")
rig = bpy.data.objects.new("PlayerRig", armature)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
definitions = []


def bone(name, head, tail, parent=None):
    b = armature.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = armature.edit_bones[parent]
    definitions.append((name, Vector(head), Vector(tail)))


bone("hips", (0, 0, 0.49), (0, 0, 0.61))
bone("spine", (0, 0, 0.61), (0, 0, 0.74), "hips")
bone("chest", (0, 0, 0.74), (0, 0, 0.85), "spine")
bone("neck", (0, 0, 0.85), (0, 0, 0.95), "chest")
bone("head", (0, 0, 0.95), (0, 0, 1.4), "neck")
for side, sign in [("L", 1), ("R", -1)]:
    bone("shoulder." + side, (0, 0, 0.82), (sign * .145, 0, .805), "chest")
    bone("upper_arm." + side, (sign * .145, 0, .805), (sign * .19, .015, .625), "shoulder." + side)
    bone("forearm." + side, (sign * .19, .015, .625), (sign * .19, .02, .475), "upper_arm." + side)
    bone("hand." + side, (sign * .19, .02, .475), (sign * .19, .02, .415), "forearm." + side)
    bone("thigh." + side, (sign * .11, 0, .48), (sign * .11, -.012, .265), "hips")
    bone("shin." + side, (sign * .11, -.012, .265), (sign * .11, .002, .075), "thigh." + side)
    bone("foot." + side, (sign * .11, .002, .075), (sign * .11, -.10, .03), "shin." + side)
    bone("toe." + side, (sign * .11, -.10, .03), (sign * .11, -.16, .03), "foot." + side)
    eye_points = islands[eye_islands[side]]
    eye_center = sum(eye_points, Vector()) / len(eye_points)
    bone("eye." + side, eye_center, eye_center + Vector((0, 0, .035)), "head")
bpy.ops.object.mode_set(mode="OBJECT")
rig.show_in_front = True
armature.display_type = "STICK"
groups = {name: mesh.vertex_groups.new(name=name) for name, _, _ in definitions}
segments = {name: (a, b) for name, a, b in definitions}


def distance(point, name):
    a, b = segments[name]
    along = max(0, min(1, (point-a).dot(b-a) / (b-a).length_squared))
    return (point - a - (b-a)*along).length


def weights(point, names):
    values = sorted(((n, 1 / (distance(point, n) + .018)**5) for n in names), key=lambda p: -p[1])[:4]
    total = sum(w for _, w in values)
    return [(n, w / total) for n, w in values]


vertex_weights = []
for v, island_id in zip(mesh.data.vertices, island_ids):
    p = v.co
    side = "L" if p.x > 0 else "R"
    if island_id in eye_islands.values():
        # These islands are brows; the irises are baked into the face texture.
        skin = [("head", 1)]
    elif island_id in hand_islands.values():
        skin = [("hand." + next(s for s, i in hand_islands.items() if i == island_id), 1)]
    elif island_id != body_id:
        # Hair/face/accessories remain rigid with the head. Only the neck fades.
        head = max(0, min(1, (p.z - .84) / .075))
        skin = [("head", head), ("neck", 1-head)]
    elif p.z < .45:
        skin = weights(p, [n + "." + side for n in ["thigh", "shin", "foot", "toe"]] + ["hips"])
    elif p.z < .79 and abs(p.x) > (.135 if p.z > .53 else .155):
        skin = weights(p, [n + "." + side for n in ["upper_arm", "forearm", "hand"]])
    elif p.z > .84:
        skin = weights(p, ["chest", "neck", "head"])
    else:
        names = ["hips", "spine", "chest", "neck"]
        if p.z > .71 and abs(p.x) > .09:
            names += ["shoulder." + side, "upper_arm." + side]
        if p.z < .53:
            names += ["thigh." + side]
        skin = weights(p, names)
    vertex_weights.append(dict(skin))

# Smooth through welded adjacency so the shoulder and pelvis bend continuously,
# including across UV seams. Separate hands, eyes and hair retain their weights.
weld_weights = [{} for _ in neighbors]
for weights_at_vertex, weld in zip(vertex_weights, weld_ids):
    weld_weights[weld] = weights_at_vertex
for _ in range(5):
    smoothed = []
    for index, adjacent in enumerate(neighbors):
        values = defaultdict(float)
        for name, weight in weld_weights[index].items():
            values[name] += weight * .4
        for other in adjacent:
            for name, weight in weld_weights[other].items():
                values[name] += weight * .6 / len(adjacent)
        smoothed.append(dict(values) if adjacent else weld_weights[index])
    weld_weights = smoothed
for v, weld in zip(mesh.data.vertices, weld_ids):
    skin = sorted(weld_weights[weld].items(), key=lambda pair: -pair[1])[:4]
    total = sum(weight for _, weight in skin)
    for name, weight in skin:
        if weight > 0:
            groups[name].add([v.index], weight / total, "REPLACE")
modifier = mesh.modifiers.new("Skin", "ARMATURE")
modifier.object = rig
mesh.parent = rig

# The irises are painted onto the face. A fitted eyelid surface closes over
# them without stretching the user's face texture or changing its geometry.
from mathutils.geometry import barycentric_transform


def face_point(x, z):
    hit, _, index, _ = face_surface.ray_cast(Vector((x, -.8, z)), Vector((0, 1, 0)))
    if hit is None:
        raise RuntimeError('Eyelid lies outside the face')
    triangle = face_triangles[index]
    points = [original.vertices[i].co for i in triangle.vertices]
    coords = [Vector((*original.uv_layers.active.data[i].uv, 0)) for i in triangle.loops]
    uv = barycentric_transform(hit, *points, *coords)
    return hit, (uv.x, uv.y)


eyelids = []
for side, center_x in [('Left', .10), ('Right', -.125)]:
    opened, closed, faces, coordinates = [], [], [], []
    columns = 20
    rows = [0, .2, .4, .6, .8, .97, 1]
    for col in range(columns + 1):
        u = col / columns * 2 - 1
        x = center_x + u * .085
        arc = math.sqrt(max(.001, 1-u*u))
        upper, lower = 1.068 + .046*arc, 1.068 - .046*arc
        top, _ = face_point(x, upper)
        _, skin_uv = face_point(center_x*.65, .995)
        _, lash_uv = face_point(center_x, 1.083)
        for row, fraction in enumerate(rows):
            surface, _ = face_point(x, upper + (lower-upper)*fraction)
            opened.append((x, top.y + .004, upper))
            closed.append((x, surface.y - .0035, surface.z))
            coordinates.append(lash_uv if row == len(rows)-1 else skin_uv)
    for col in range(columns):
        for row in range(len(rows)-1):
            a = col*len(rows)+row
            b = a+len(rows)
            faces.append((a, a+1, b+1, b))
    lid_data = bpy.data.meshes.new('Eyelid'+side)
    lid_data.from_pydata(opened, [], faces)
    lid_data.materials.append(mesh.data.materials[0])
    uv_layer = lid_data.uv_layers.new(name='UVMap')
    for loop in lid_data.loops:
        uv_layer.data[loop.index].uv = coordinates[loop.vertex_index]
    for polygon in lid_data.polygons:
        polygon.use_smooth = True
    lid = bpy.data.objects.new('Eyelid'+side, lid_data)
    bpy.context.collection.objects.link(lid)
    lid.shape_key_add(name='Basis')
    blink = lid.shape_key_add(name='eyeBlink'+side, from_mix=False)
    blink.value = 0
    for v, point in zip(blink.data, closed):
        v.co = point
    lid.vertex_groups.new(name='head').add(list(range(len(opened))), 1, 'REPLACE')
    lid.modifiers.new('Skin','ARMATURE').object = rig
    lid.parent = rig
    eyelids.append(lid)

scene = bpy.context.scene
scene.render.fps = 30
rig.animation_data_create()
rest = {b.name: b.matrix_local.to_quaternion() for b in rig.data.bones}
axes = {axis: Vector(v) for axis, v in {"X": (1,0,0), "Y": (0,1,0), "Z": (0,0,1)}.items()}


def reset_pose():
    for b in rig.pose.bones:
        b.rotation_mode = "QUATERNION"
        b.location = (0,0,0)
        b.rotation_quaternion = (1,0,0,0)
        b.scale = (1,1,1)


def turn(name, axis, angle):
    b = rig.pose.bones[name]
    b.rotation_quaternion @= Quaternion(rest[name].inverted() @ axes[axis], angle)


def pose(walk_phase=0, walking=0, sitting=0, breathing=0):
    reset_pose()
    turn("spine", "X", .008 * breathing)
    turn("head", "Z", .008 * breathing)
    for side, sign in [("L",1), ("R",-1)]:
        swing = math.sin(walk_phase) * sign * walking
        turn("thigh." + side, "X", -.43*swing - math.pi/2*sitting)
        turn("shin." + side, "X", .58*max(0,swing) + .04*abs(swing) + math.pi/2*sitting)
        turn("upper_arm." + side, "X", .34*swing - .22*sitting)
        turn("upper_arm." + side, "Y", -sign*.035)
        turn("forearm." + side, "X", -.055 - .15*max(0,-swing) - .55*sitting)
        turn("hand." + side, "X", -.03*swing)
    # Bone local Y is Blender world Z for the vertical hips bone.
    rig.pose.bones["hips"].location.y = -.18*sitting


def key_pose(frame):
    for b in rig.pose.bones:
        b.keyframe_insert("location", frame=frame)
        b.keyframe_insert("rotation_quaternion", frame=frame)
        b.keyframe_insert("scale", frame=frame)


sole_indices = [v.index for v in mesh.data.vertices if v.co.z < .065]


def ground_feet():
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    data = evaluated.to_mesh()
    floor = min(data.vertices[i].co.z for i in sole_indices)
    evaluated.to_mesh_clear()
    rig.pose.bones["hips"].location.y -= floor


for name, duration in [("Idle",120), ("Walk",32), ("Sit",30), ("SitDown",24), ("StandUp",24)]:
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data.action = action
    for frame in range(duration+1):
        t = frame / duration
        ease = t*t*(3-2*t)
        sit = 1 if name == "Sit" else ease if name == "SitDown" else 1-ease if name == "StandUp" else 0
        pose(t*math.tau, int(name == "Walk"), sit, math.sin(t*math.tau) if name == "Idle" else 0)
        # Sitting is authored with hanging legs. Only locomotion is floor locked.
        if name in ("Idle", "Walk"):
            ground_feet()
        key_pose(frame+1)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = "LINEAR"
rig.animation_data.action = bpy.data.actions["Idle"]
rig.animation_data.action_slot = rig.animation_data.action.slots[0]
scene.frame_start, scene.frame_end = 1, 121
scene.frame_set(1)
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
for lid in eyelids:
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
print("CHIBI_READY", len(mesh.data.vertices), "vertices", len(rig.data.bones), "bones")


