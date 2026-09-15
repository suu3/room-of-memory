import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { ASSETS } from "@/lib/assets";
import { FurnitureModel } from "./FurnitureModel";
import { STUDENT_BOOKSHELF } from "./layout";
import { WorkbookClue } from "./RoomClues";

for (const path of [
  ASSETS.models.snackBag,
  ASSETS.models.studyPapers,
  ASSETS.models.cupNoodleTrash,
  ASSETS.models.studentBookshelf,
  ASSETS.models.baseballCap,
  ASSETS.models.trainingKit,
  ASSETS.models.studyTools,
]) {
  useGLTF.preload(path, true, true);
}

/**
 * 책상 로컬 좌표. 램프 아래 공부 자리.
 *
 * 문제집 더미는 집어 들 수 있는 단서다 (RoomClues의 WorkbookClue). 자리를 옮기면
 * layout의 CLUE_PROPS.workbook.near도 같이 옮긴다: 거기가 다가갔는지 재는 기준점이다.
 */
export function StudentDeskProps() {
  return (
    <group name="student-desk-props">
      <WorkbookClue>
        <FurnitureModel path={ASSETS.models.studyPapers} position={[1.25, 1.11, 0.32]} scale={1} />
      </WorkbookClue>
      <FurnitureModel
        path={ASSETS.models.studyTools}
        position={[0.65, 1.11, -0.44]}
        rotation={[0, -0.12, 0]}
        scale={1}
      />
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
      {/* 책장 위 모자와 협탁 위 훈련 소품은 기존 가구 안에 놓여 통로를 차지하지 않는다. */}
      {/* 모자는 글러브와 한 모델이던 때의 자리(짝의 중심에서 +0.3) 그대로다. */}
      <FurnitureModel
        path={ASSETS.models.baseballCap}
        position={[STUDENT_BOOKSHELF.position[0] + 0.3, STUDENT_BOOKSHELF.size[1], -3.4]}
        scale={1}
      />
      <FurnitureModel path={ASSETS.models.trainingKit} position={[6.8, 0.955, 0.7]} scale={1} />
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
