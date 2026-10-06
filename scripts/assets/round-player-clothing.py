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
pants_source = next(source for source in sources if source["name"] == "tripo_part_1_material")
hem_back = min(point[2] for point in pants_source["positions"]) - 0.006
for source in sources:
    is_knit = source["name"] == "tripo_part_3_material"
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
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()

    # Thin, open source cloth has no reliable voxel volume. Give it inward
    # thickness first; remove inner surfaces and artificial caps after remeshing.
    thickness = obj.modifiers.new("Cloth thickness", "SOLIDIFY")
    thickness.thickness = 0.009
    thickness.offset = -1
    bpy.ops.object.modifier_apply(modifier=thickness.name)
    remesh = obj.modifiers.new("Continuous cloth", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = 0.007
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = obj.modifiers.new("Round cloth", "SMOOTH")
    smooth.factor = 0.65
    smooth.iterations = 8
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate = obj.modifiers.new("Mobile mesh", "DECIMATE")
    decimate.ratio = 0.14 if is_knit else 0.20
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if is_knit:
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
                (is_knit and face.calc_center_median().y > 0.84 and distance > 0.014)
                or (not is_knit and distance > 0.001 and face.normal.dot(normal) < -0.2)
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
