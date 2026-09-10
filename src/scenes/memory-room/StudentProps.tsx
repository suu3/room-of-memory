import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { ASSETS } from "@/lib/assets";
import { FurnitureModel } from "./FurnitureModel";
import { STUDENT_BOOKSHELF } from "./layout";

for (const path of [
  ASSETS.models.snackBag,
  ASSETS.models.studyPapers,
  ASSETS.models.cupNoodleTrash,
  ASSETS.models.studentBookshelf,
]) {
  useGLTF.preload(path, true, true);
}

/** 책상 로컬 좌표. 램프 아래 공부 자리. */
export function StudentDeskProps() {
  return (
    <group name="student-desk-props">
      <FurnitureModel path={ASSETS.models.studyPapers} position={[1.25, 1.11, 0.32]} scale={1} />
    </group>
  );
}

export function StudentRoomProps() {
  return (
    <group name="student-room-props">
      <FurnitureModel
        path={ASSETS.models.studentBookshelf}
        position={STUDENT_BOOKSHELF.position}
        scale={1}
      />
      <FurnitureModel
        path={ASSETS.models.cupNoodleTrash}
        position={[-3.85, 0.008, 1.55]}
        rotation={[0, -0.45, 0]}
        scale={1.2}
      />
      <FurnitureModel
        path={ASSETS.models.cupNoodleTrash}
        position={[-3.8, 0.008, 1.12]}
        rotation={[0, 2.1, 0]}
        scale={0.95}
      />
      <FurnitureModel
        path={ASSETS.models.snackBag}
        position={[-2.95, 0.008, 1.35]}
        rotation={[0, 0.5, 0]}
        scale={0.85}
      />
      <FurnitureModel
        path={ASSETS.models.snackBag}
        position={[2.95, 0.008, 2.2]}
        rotation={[0, -0.3, 0]}
        scale={0.75}
      />
    </group>
  );
}
