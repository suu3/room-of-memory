"""Original baseball student's room props, built in Blender without external assets.

Run Blender --background --factory-startup --python scripts/create-baseball-room-props.py.
Raw GLBs, a preview and editable source: Documents/Codex/baseball-room-props.
Run pnpm model:prep on each exported GLB before using it in the game.
Blender coordinates: Z up, -Y front. All materials use existing scene tokens.
"""
import math
import re
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = Path.home() / "Documents/Codex/baseball-room-props"
OUT.mkdir(parents=True, exist_ok=True)
if bpy.context.window:
    scene = bpy.data.scenes.new("Baseball student's room props")
    bpy.context.window.scene = scene
else:
    # Background runs (blender -b) have no window to switch scenes on; build in the default one.
    scene = bpy.context.scene
    scene.name = "Baseball student's room props"
css = (ROOT / "src/app/globals.css").read_text(encoding="utf-8")
objects = []
finished = []


def material(key):
    value = re.search(r"--color-scene-" + key + r":\s*(#[0-9a-fA-F]{6})", css).group(1)
    rgb = [int(value[i:i+2], 16) / 255 for i in (1, 3, 5)]
    rgb = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055)**2.4 for c in rgb]
    mat = bpy.data.materials.new(key)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = .83
    return mat


linen, navy, leather, seam, sage, dark = [
    material(k) for k in ("linen", "fabric", "clay", "wood", "sage", "coal")
]
materials = [linen, navy, leather, seam, sage, dark]


def register(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    objects.append(obj)
    return obj


def mesh(name, verts, faces, mat, thickness=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    register(obj, name, mat)
    for face in data.polygons:
        face.use_smooth = True
    if thickness:
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new("Fabric or leather thickness", "SOLIDIFY")
        mod.thickness = thickness
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def box(name, size, pos, mat, bevel=.008, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = register(bpy.context.object, name, mat)
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = rotation
    if bevel:
        mod = obj.modifiers.new("Soft edges", "BEVEL")
        mod.width, mod.segments = bevel, 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        normal = obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=normal.name)
    return obj


def ellipsoid(name, pos, scale, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=pos)
    obj = register(bpy.context.object, name, mat)
    obj.scale = scale
    obj.rotation_euler = rotation
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def tube(name, points, radius, mat, cyclic=False):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth, curve.bevel_resolution = radius, 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points)-1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return register(bpy.context.object, name, mat)


def lathe(name, profile, pos, mat):
    verts, faces = [], []
    n = 40
    for r, z in profile:
        for i in range(n):
            a = math.tau*i/n
            verts.append((pos[0]+r*math.cos(a), pos[1]+r*math.sin(a), pos[2]+z))
    for j in range(len(profile)-1):
        for i in range(n):
            a, b = j*n+i, j*n+(i+1)%n
            faces.append((a, b, b+n, a+n))
    return mesh(name, verts, faces, mat)


def export(name, preview_x):
    joined = []
    batches = [(mat, [o for o in objects if o.data.materials[0] == mat]) for mat in materials]
    for mat, batch in batches:
        if not batch:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in batch:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = batch[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = name + "-" + mat.name
        joined.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in joined:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / (name + ".glb")), export_format="GLB",
                              use_selection=True, use_active_scene=True, export_animations=False)
    for obj in joined:
        obj.location.x += preview_x
    finished.extend(joined)
    objects.clear()


# A hanging baseball jersey with curved hem, open neck, short sleeves and piping.
def shirt_y(x, z):
    return -.045 - .018*math.cos(x*21+z*2) * (.4+.6*(1-z/1.2))


rows, cols = 26, 30
verts, faces = [], []
for j in range(rows+1):
    t = j/rows
    for i in range(cols+1):
        u = 2*i/cols-1
        x = u*(.35+.055*t)
        top = 1.18 - .17*max(0, 1-abs(u)/.35)**.6
        z = .035+.025*u*u + t*(top-.06)
        verts.append((x, shirt_y(x, z), z))
for j in range(rows):
    for i in range(cols):
        a = j*(cols+1)+i
        faces.append((a, a+1, a+cols+2, a+cols+1))
mesh("jersey hanging body", verts, faces, linen, .014)
for side in (-1, 1):
    verts, faces = [], []
    for j in range(9):
        t = j/8
        for i in range(13):
            u = i/12
            x = side*(.365+.285*u)
            z = .82+.36*t-.16*u
            y = -.045-.04*math.sin(math.pi*t)-.008*math.sin(u*15)
            verts.append((x, y, z))
    for j in range(8):
        for i in range(12):
            a = j*13+i
            faces.append((a, a+1, a+14, a+13))
    mesh("jersey open short sleeve", verts, faces, linen, .012)
    tube("sleeve double piping", [(side*.624, -.052-.04*math.sin(math.pi*t), .82+.36*t-.145)
                                  for t in [i/20 for i in range(21)]], .012, navy)
    tube("shoulder piping", [(side*(.12+i*.024), -.06, 1.165-i*.009)
                              for i in range(22)], .011, navy)
    tube("side seam", [(side*(.35+.055*t), shirt_y(side*(.35+.055*t), t)+.002, .06+1.08*t)
                       for t in [i/30 for i in range(31)]], .005, seam)
tube("neck binding", [(x, -.061, 1.18-.17*max(0, 1-abs(x)/.142)**.6)
                       for x in [-.14+i*.007 for i in range(41)]], .016, navy)
tube("curved hem", [(x, shirt_y(x, .055)-.007, .046+.025*(x/.35)**2)
                    for x in [-.35+i*.014 for i in range(51)]], .009, seam)
# Front button placket and a fictional team mark, no real team logo or assigned number.
tube("button placket", [(0, shirt_y(0, z)-.014, z) for z in [.06+i*.031 for i in range(31)]], .009, navy)
for z in (.19, .36, .53, .70, .87):
    ellipsoid("sewn button", (0, shirt_y(0, z)-.027, z), (.016, .008, .016), seam)
box("chest team patch", (.16, .012, .12), (-.205, shirt_y(-.205, .81)-.015, .81), navy, .016)
tube("patch diamond", [(-.205, -.099, .849), (-.166, -.099, .81), (-.205, -.099, .771),
                       (-.244, -.099, .81)], .006, linen, True)
tube("wooden hanger", [(-.4, .016, 1.11), (0, .016, 1.3), (.4, .016, 1.11), (-.4, .016, 1.11)], .016, seam)
tube("hanger hook", [(0, .016, 1.3), (0, .016, 1.4), (.025, .016, 1.45),
                     (.075, .016, 1.45), (.1, .016, 1.42), (.075, .016, 1.39)], .008, dark)
box("wall peg", (.105, .1, .055), (.066, .056, 1.408), seam, .013)
export("room-baseball-jersey", -2.1)

# Baseball cap alone. A glove used to sit beside it (2026-09-14) but read as a lump at room
# scale, so it was dropped on 2026-09-15; the cap keeps its original spot in the pair.
# Six-panel cap, hollow crown and curved bill.
cx, cy = .30, .02
verts, faces = [], []
for j in range(13):
    theta = (math.pi/2)*j/12
    for i in range(48):
        a = math.tau*i/48
        verts.append((cx+.23*math.sin(theta)*math.cos(a), cy+.23*math.sin(theta)*math.sin(a),
                      .035+.22*math.cos(theta)))
for j in range(12):
    for i in range(48):
        a, b = j*48+i, j*48+(i+1)%48
        faces.append((a, a+48, b+48, b))
mesh("six panel cap crown", verts, faces, navy, .008)
for i in range(6):
    a = math.tau*i/6
    tube("cap panel seam", [(cx+.232*math.sin(t)*math.cos(a), cy+.232*math.sin(t)*math.sin(a),
                             .035+.222*math.cos(t)) for t in [math.pi/2*j/20 for j in range(21)]], .0035, dark)
ellipsoid("cap top button", (cx, cy, .259), (.027, .027, .012), navy)
verts, faces = [], []
for j in range(7):
    t = j/6
    for i in range(25):
        u = i/24*2-1
        verts.append((cx+.235*u, cy-.14-t*.20*math.sqrt(max(0, 1-u*u)), .041-.03*u*u-.01*t))
for j in range(6):
    for i in range(24):
        a = j*25+i
        faces.append((a, a+1, a+26, a+25))
mesh("curved cap bill", verts, faces, navy, .014)
tube("cap bill stitching", [(cx+.218*u, cy-.14-.185*math.sqrt(max(0, 1-u*u)), .044-.03*u*u)
                            for u in [-1+i/20 for i in range(41)]], .003, linen)
tube("cap embroidered diamond", [(cx, cy-.208, .179), (cx+.036, cy-.223, .135),
                                  (cx, cy-.234, .099), (cx-.036, cy-.223, .135)], .007, linen, True)
export("room-baseball-cap", -.45)

# After-practice kit. Folded towel with rippling edges, squeeze bottle and tape roll.
for layer in range(3):
    box("folded training towel", (.40, .31, .047), (-.11, .018, .026+layer*.044), linen, .018)
    for stripe in (-.21, -.17):
        box("woven towel stripe", (.014, .304, .003), (stripe, .018, .051+layer*.044), navy, .001)
    tube("towel folded edge", [(-.30+i*.016, -.141+.004*math.sin(i*1.7), .031+layer*.044)
                               for i in range(25)], .004, seam)
lathe("squeeze sports bottle", [(0, 0), (.089, 0), (.101, .035), (.103, .28),
                                (.084, .34), (.066, .36), (0, .36)], (.245, .045, 0), sage)
lathe("bottle ribbed screw lid", [(0, 0), (.074, 0), (.074, .048), (0, .048)], (.245, .045, .355), dark)
lathe("bottle push pull nozzle", [(0, 0), (.023, 0), (.023, .042), (0, .042)], (.245, .045, .403), linen)
for i in range(16):
    a = math.tau*i/16
    tube("lid grip rib", [(.245+.074*math.cos(a), .045+.074*math.sin(a), z) for z in (.36, .398)], .003, seam)
lathe("athletic tape paper core", [(.041, 0), (.047, 0), (.047, .053), (.041, .053), (.041, 0)], (-.19, -.225, 0), seam)
lathe("athletic tape wound band", [(.048, 0), (.075, 0), (.075, .05), (.048, .05), (.048, 0)], (-.19, -.225, .002), linen)
box("loose tape end", (.045, .11, .003), (-.19, -.33, .004), linen, .001, (0, 0, -.15))
export("room-training-kit", .7)

# Study tools: half-unzipped pencil pouch, pencils, eraser and protruding sticky tabs.
box("soft pencil pouch", (.51, .19, .105), (0, .03, .058), navy, .045)
box("pouch dark zipper opening", (.42, .044, .009), (0, .03, .11), dark, .016)
for y in (.001, .059):
    tube("pouch zipper tape", [(-.22+i*.011, y, .113+.002*math.sin(i*.3)) for i in range(41)], .004, seam)
for i in range(18):
    box("zipper teeth", (.006, .017, .004), (-.20+i*.012, .03, .12), linen, .001)
tube("zipper pull", [(.028, .03, .119), (.07, .025, .12), (.066, -.007, .12), (.027, -.005, .119)], .006, dark, True)
for i in range(2):
    start = Vector((-.20, -.12-i*.06, .013))
    end = start + Vector((.41, .034+i*.025, 0))
    tube("mechanical pencil", [start, end], .011, sage if i else linen)
    tube("pencil metal tip", [end, end+Vector((.034, .003, 0))], .004, dark)
    tube("pencil pocket clip", [start+Vector((.035, -.014, .01)), start+Vector((.115, -.014, .01))], .003, dark)
box("used eraser", (.092, .045, .028), (.22, -.13, .015), linen, .007, (0, 0, .13))
box("eraser paper sleeve", (.056, .046, .029), (.217, -.13, .017), sage, .002, (0, 0, .13))
box("sticky note stack", (.115, .115, .011), (-.255, -.155, .008), seam, .002, (0, 0, -.18))
export("room-study-tools", 1.8)

# A real triangular sewn pennant replaces the old rectangular wall banner.
mesh("team pennant cloth", [(-.9, 0, 0), (-.9, 0, .46), (.9, -.014, .23)], [(0, 1, 2)], linen, .008)
tube("pennant binding", [(-.9, -.008, 0), (-.9, -.008, .46), (.9, -.02, .23)], .013, navy, True)
tube("pennant diamond", [(-.62, -.016, .23), (-.45, -.016, .36), (-.28, -.016, .23),
                         (-.45, -.016, .10)], .019, navy, True)
for z in (.06, .4):
    tube("pennant hanging cord", [(-.9, 0, z), (-.97, 0, z+.035), (-1, 0, z)], .006, seam)
export("room-team-pennant", 0)
# Pennant is previewed behind the equipment, off the floor.
for obj in finished:
    if obj.name.startswith("room-team-pennant"):
        obj.location.y += .55
        obj.location.z += .85

bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "baseball-room-props.blend"))

# Render a reproducible contact sheet; preview-only floor/camera/lights are not exported.
box("preview floor", (200, 200, .02), (0, 0, -.05), dark, 0)
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.world = bpy.data.worlds.new("Preview world")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.3, .3, .3, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .5
for pos, power, size in [((-3, -4, 5), 650, 5), ((3, 1, 4), 500, 4)]:
    bpy.ops.object.light_add(type="AREA", location=pos)
    light = bpy.context.object
    light.data.energy, light.data.shape, light.data.size = power, "DISK", size
    light.rotation_euler = (Vector((0, 0, .4))-light.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add(location=(2.4, -6.5, 3.8))
camera = bpy.context.object
camera.rotation_euler = (Vector((-.3, 0, .65))-camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type, camera.data.ortho_scale = "ORTHO", 5.4
scene.camera = camera
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1500, 900, 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(OUT / "baseball-room-props-preview.png")
bpy.ops.render.render(write_still=True)
print("Exported original baseball room props:", OUT)
