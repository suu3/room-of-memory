"""Blender: build original tissue box and ceiling AC.
Run with Blender --background --factory-startup --python <this script>.
No external meshes/textures. Materials resolve DESIGN.md scene tokens from globals.css.
Exports raw GLBs and editable blend to Documents/Codex/room-detail-props.
Then: pnpm model:prep <raw.glb> <room-tissue-box|room-ceiling-ac>.
"""
import bpy
import math
import re
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = Path.home() / "Documents/Codex/room-detail-props"
OUT.mkdir(parents=True, exist_ok=True)
css = (ROOT / "src/app/globals.css").read_text(encoding="utf-8")
scene = bpy.data.scenes.new("Room detail props")
bpy.context.window.scene = scene

def material(key, roughness=0.85):
    value = re.search(r"--color-scene-" + key + r":\s*(#[0-9a-fA-F]{6})", css).group(1)
    rgb = [int(value[i:i+2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055)**2.4 for c in rgb]
    mat = bpy.data.materials.new(key)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*linear, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

sage, paper, trim, dark = [material(k) for k in ("sage", "linen", "trim", "coal")]
objects = []

def box(name, size, pos, mat, bevel=0.01, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Soft manufactured edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        normal = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=normal.name)
    objects.append(obj)
    return obj

def mesh(name, verts, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    data.materials.append(mat)
    objects.append(obj)
    return obj

def export(name):
    # Bake into one mesh per material for a handful of draw calls per prop.
    joined = []
    batches = [(mat, [o for o in objects if o.data.materials[0] == mat]) for mat in (sage, paper, trim, dark)]
    for mat, batch in batches:
        if not batch:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in batch:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = batch[0]
        bpy.ops.object.join()
        bpy.context.object.name = name + "-" + mat.name
        joined.append(bpy.context.object)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in joined:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / (name + ".glb")), export_format="GLB", use_selection=True, use_active_scene=True, export_animations=False)
    return joined

# Tissue carton: folded paperboard lid, actual oval hole, seams and print bands.
box("carton", (.72, .45, .318), (0, 0, .159), sage, .018)
box("folded bottom seam", (.704, .434, .018), (0, 0, .012), trim, .007)
# Lid built as an annulus between rounded rectangular perimeter and an oval opening.
verts, faces = [], []
for ring in range(2):
    for i in range(64):
        angle = math.tau * i / 64
        c, s = math.cos(angle), math.sin(angle)
        if ring == 0:
            x = .361 * math.copysign(abs(c)**.16, c)
            y = .226 * math.copysign(abs(s)**.16, s)
        else:
            x, y = .205 * c, .06 * s
        verts.append((x, y, .335))
for i in range(64):
    n = (i + 1) % 64
    faces.append((i, n, n+64, i+64))
lid = mesh("carton oval opening", verts, faces, sage)
solid = lid.modifiers.new("Paperboard thickness", "SOLIDIFY")
solid.thickness = .007
bpy.context.view_layer.objects.active = lid
bpy.ops.object.modifier_apply(modifier=solid.name)
box("dark recessed opening", (.42, .13, .009), (0, 0, .32), dark, .018)
for x in (-.27, -.23, -.19):
    box("quiet carton stripe", (.014, .004, .17), (x, -.226, .168), paper, .002)
box("carton label", (.18, .004, .07), (.11, -.228, .13), trim, .005)
# Thin sheet gathered at its base, opening into an uneven folded fan.
verts, faces = [], []
cols, rows = 22, 16
for j in range(rows+1):
    t = j / rows
    for i in range(cols+1):
        u = i / cols * 2 - 1
        width = .10 + .09 * math.sin(t * math.pi / 2)
        x = u * width + .032 * t*t
        y = .022 * math.sin(u * math.pi * 3 + .7*t) * (.3+.7*t) + .065*t*t
        z = .325 + t * (.245 + .018*math.cos(u*4) - .04*u*u)
        verts.append((x, y, z))
for j in range(rows):
    for i in range(cols):
        a = j*(cols+1)+i
        faces.append((a, a+1, a+cols+2, a+cols+1))
sheet = mesh("soft folded tissue", verts, faces, paper)
for polygon in sheet.data.polygons:
    polygon.use_smooth = True
bpy.context.view_layer.objects.active = sheet
thickness = sheet.modifiers.new("Two paper faces", "SOLIDIFY")
thickness.thickness = .0018
bpy.ops.object.modifier_apply(modifier=thickness.name)
tissue = export("room-tissue-box")
for obj in tissue:
    obj.hide_set(True)
objects.clear()

# Low-profile ceiling suspended indoor unit; forward vent visible in the cutaway room.
box("ceiling mounting plate", (1.73, .70, .065), (0, .01, .37), trim, .024)
box("rounded enamel housing", (1.82, .79, .30), (0, 0, .195), paper, .075)
box("lower shell seam", (1.76, .735, .025), (0, -.007, .066), trim, .015)
box("front outlet recess", (1.56, .025, .13), (0, -.385, .13), dark, .015)
for z in (.087, .126, .164):
    box("angled air direction vane", (1.49, .066, .013), (0, -.401, z), trim, .006, (math.radians(-22), 0, 0))
for x in (-.61, -.31, 0, .31, .61):
    box("outlet divider", (.014, .045, .108), (x, -.392, .127), paper, .004)
box("underside filter recess", (1.38, .43, .02), (0, .035, .038), dark, .018)
for i in range(21):
    box("return air grille", (.035, .39, .016), (-.65+i*.065, .035, .022), trim, .006)
box("sensor window", (.075, .008, .028), (.704, -.386, .249), dark, .009)
box("status indicator", (.017, .009, .009), (.633, -.39, .249), sage, .003)
for x in (-.82, .82):
    box("service cap", (.035, .15, .08), (x, .23, .05), trim, .012)
aircon = export("room-ceiling-ac")

# Keep the two finished props side by side in the editable source, outside the game exports.
for obj in tissue:
    obj.hide_set(False)
    obj.location.x -= 1.25
for obj in aircon:
    obj.location.x += .9
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "room-detail-props.blend"))
print("Exported original props to", OUT)
