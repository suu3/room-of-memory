"""Blender worker for round-player-clothing.mjs; world coordinates remain Y-up."""
import json
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

source_path, output_path = sys.argv[sys.argv.index("--") + 1:]
with open(source_path) as source_file:
    sources = json.load(source_file)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
outputs = []
pants_source = next((source for source in sources if source["name"] == "tripo_part_1_material"), None)
hem_back = min(point[2] for point in pants_source["positions"]) - 0.006 if pants_source else None
for source in sources:
    is_knit = source["name"] == "tripo_part_3_material"
    is_collar = source["name"] == "tripo_part_6_material"
    is_shirt = is_collar
    refine_neckline = source.get("refineNeckline", False)
    points = [Vector(p) for p in source["positions"]]
    faces = [source["indices"][i:i + 3] for i in range(0, len(source["indices"]), 3)]
    tree = BVHTree.FromPolygons(points, faces, all_triangles=True)
    mesh = bpy.data.meshes.new(source["name"])
    mesh.from_pydata(points, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(source["name"], mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00002)
    if not is_collar and not refine_neckline:
        bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    elif is_collar:
        # Relax only the scan's boundary noise; retain the collar's pointed folds.
        rim = [v for v in bm.verts if v.is_boundary]
        original = {v: v.co.copy() for v in rim}
        for _ in range(12):
            updates = {}
            for v in rim:
                adjacent = [e.other_vert(v).co for e in v.link_edges if e.is_boundary]
                if len(adjacent) != 2:
                    continue
                delta = v.co.lerp((adjacent[0] + adjacent[1]) / 2, 0.5) - original[v]
                limit = 0.012 if original[v].y < 0.89 and original[v].z > 0.025 else 0.003
                if delta.length > limit:
                    delta *= limit / delta.length
                updates[v] = original[v] + delta
            for v, co in updates.items():
                v.co = co
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()

    if not refine_neckline:
        # Thin, open source cloth has no reliable voxel volume. Give it inward
        # thickness first; remove inner surfaces and artificial caps after remeshing.
        thickness = obj.modifiers.new("Cloth thickness", "SOLIDIFY")
        thickness.thickness = 0.006 if is_shirt else 0.009
        thickness.offset = 0 if is_collar else -1
        bpy.ops.object.modifier_apply(modifier=thickness.name)
        remesh = obj.modifiers.new("Continuous cloth", "REMESH")
        remesh.mode = "VOXEL"
        remesh.voxel_size = 0.0025 if is_collar else 0.007
        remesh.use_smooth_shade = True
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        smooth = obj.modifiers.new("Round cloth", "SMOOTH")
        smooth.factor = 0.3 if is_collar else 0.65
        smooth.iterations = 3 if is_collar else 8
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        decimate = obj.modifiers.new("Mobile mesh", "DECIMATE")
        if is_shirt:
            triangles = sum(len(face.vertices) - 2 for face in obj.data.polygons)
            decimate.ratio = min(1, 1700 / triangles)
        else:
            decimate.ratio = 0.14 if is_knit else 0.20
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if refine_neckline:
        # Smooth both sides of the thick neckline together; leave the hem and
        # arm openings intact. Bounded motion retains the original V-neck depth.
        selected = [v for v in bm.verts if v.co.y > 0.77 and v.co.z > 0.055 and abs(v.co.x) < 0.105]
        original = {v: v.co.copy() for v in selected}
        for _ in range(32):
            updates = {}
            for v in selected:
                if not v.link_edges:
                    continue
                mean = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
                blend = min(1, (v.co.y - 0.77) / 0.025) * min(1, (v.co.z - 0.055) / 0.015)
                delta = v.co.lerp(mean, 0.5 * blend) - original[v]
                if delta.length > 0.020:
                    delta *= 0.020 / delta.length
                updates[v] = original[v] + delta
            for v, point in updates.items():
                v.co = point
    if is_collar:
        # Tuck the lower rear rim under the knit neckline to cover the scan gap.
        for vertex in bm.verts:
            lower = max(0, min(1, (0.94 - vertex.co.y) / 0.04))
            rear = max(0, min(1, (0.015 - vertex.co.z) / 0.045))
            vertex.co.y -= 0.012 * lower * rear
            # The shirt bib continues underneath the vest, rather than ending
            # at the scanned jagged V-neck boundary.
            front = max(0, min(1, (vertex.co.z - 0.025) / 0.035))
            bib = max(0, min(1, (0.90 - vertex.co.y) / 0.035)) * front
            vertex.co.x *= 1 + 0.35 * bib
            vertex.co.y -= 0.028 * bib
            vertex.co.z += 0.004 * bib
    if is_knit and not refine_neckline:
        # Level the scanned shirt hem before cutting the color boundary.
        for vertex in bm.verts:
            y = vertex.co.y
            if y < 0.625:
                t = max(0, min(1, (y - 0.575) / 0.05))
                blend = t * t * (3 - 2 * t)
                vertex.co.y = (0.528 + (y - 0.528) * 0.15) * (1-blend) + y * blend
                # The lowered hem follows the waistband with 6 mm clearance,
                # rather than keeping the wider upper torso's back profile.
                t_back = max(0, min(1, (vertex.co.y - 0.56) / 0.065))
                fit = 1 - t_back * t_back * (3 - 2 * t_back)
                vertex.co.z += max(0, hem_back - vertex.co.z) * fit
        bmesh.ops.bisect_plane(
            bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
            plane_co=(0, 0.55, 0), plane_no=(0, 1, 0), dist=0.000001,
        )
    remove = []
    for face in bm.faces:
        near, normal, index, distance = tree.find_nearest(face.calc_center_median())
        if (
            distance is not None and (
                (is_knit and not refine_neckline and face.calc_center_median().y > 0.84 and distance > 0.014)
                or (not is_knit and not is_shirt and distance > 0.001 and face.normal.dot(normal) < -0.2)
            )
        ):
            remove.append(face)
    bmesh.ops.delete(bm, geom=remove, context="FACES")
    for _ in range(4):
        long_edges = [edge for edge in bm.edges if edge.calc_length() > 0.037]
        if not long_edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=1, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    result = dict(name=source["name"], positions=[], colors=[], joints=[], weights=[], indices=[])
    is_knit = source["name"] == "tripo_part_3_material"
    def palette(lower, upper, bright):
        samples = [color for point, color in zip(source["positions"], source["colors"])
                   if lower < point[1] < upper and (sum(color) / 3 > 0.25) == bright]
        if not samples:
            raise ValueError("Missing original cloth palette")
        return [sorted(c[k] for c in samples)[len(samples) // 2] for k in range(3)]
    if is_knit:
        knit_color = palette(0.63, 0.78, False)
        shirt_color = palette(0.53, 0.59, True)
    if is_shirt:
        whites = [c for c in source["colors"] if sum(c) / 3 > 0.25]
        white = [sorted(c[k] for c in whites)[len(whites)//2] for k in range(3)]
    for vertex in obj.data.vertices:
        near, normal, face, distance = tree.find_nearest(vertex.co)
        triangle = faces[face]
        bary = barycentric_transform(
            near, *[points[i] for i in triangle],
            Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)),
        )
        bary = [max(0, float(w)) for w in bary]
        total = sum(bary)
        bary = [w / total for w in bary]
        weights, color = {}, [0, 0, 0]
        for index, blend in zip(triangle, bary):
            for channel in range(3):
                color[channel] += source["colors"][index][channel] * blend
            for bone, weight in zip(source["joints"][index], source["weights"][index]):
                weights[bone] = weights.get(bone, 0) + weight * blend
        top = sorted(weights.items(), key=lambda pair: -pair[1])[:4]
        total = sum(weight for bone, weight in top)
        position = list(vertex.co)
        if is_shirt:
            color = white.copy()
        result["positions"].append(position)
        result["colors"].append(color)
        result["joints"].append([bone for bone, weight in top] + [0] * (4 - len(top)))
        result["weights"].append([weight / total for bone, weight in top] + [0] * (4 - len(top)))
    for face in obj.data.polygons:
        result["indices"].extend(face.vertices)
    if is_knit:
        # Duplicate only the shirt/knit color seam. Its positions and skin weights
        # remain shared so a sharp color boundary cannot tear under animation.
        colored = dict(name=result["name"], positions=[], colors=[], joints=[], weights=[], indices=[])
        mapped = {}
        for offset in range(0, len(result["indices"]), 3):
            triangle = result["indices"][offset:offset+3]
            shirt = sum(result["positions"][i][1] for i in triangle) / 3 < 0.55
            for index in triangle:
                key = (index, shirt)
                if key not in mapped:
                    mapped[key] = len(colored["positions"])
                    for attribute in ["positions", "joints", "weights"]:
                        colored[attribute].append(result[attribute][index])
                    y = result["positions"][index][1]
                    fade = max(0, min(1, (y - 0.60) / 0.025))
                    base = shirt_color if shirt else knit_color
                    colored["colors"].append([base[k]*(1-fade) + result["colors"][index][k]*fade for k in range(3)])
                colored["indices"].append(mapped[key])
        result = colored
    print(source["name"], len(result["positions"]), len(result["indices"]) // 3, flush=True)
    outputs.append(result)
    obj.select_set(False)
with open(output_path, "w") as output_file:
    json.dump(outputs, output_file)
