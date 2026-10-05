"use client";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { ArHero } from "../ArHero";
import type { ArAction } from "../ar-motion";

function DebugView() {
  const state = useThree();
  useEffect(() => {
    Object.assign(window, { meshCheck: state });
  }, [state]);
  return null;
}

export default function MeshCheck() {
  const [action, setAction] = useState<ArAction>("sit");
  const [active, setActive] = useState(true);
  return (
    <main className="h-screen bg-night text-ivory">
      <div className="absolute z-10 flex gap-4">
        {(["stand", "walk", "sit", "toss", "bat"] as const).map((value) => (
          <button type="button" key={value} onClick={() => setAction(value)}>
            {value}
          </button>
        ))}
        <button type="button" onClick={() => setActive(!active)}>
          pause
        </button>
      </div>
      <Canvas camera={{ position: [2, 0.8, 2], fov: 30 }}>
        <ambientLight intensity={1.35} />
        <directionalLight position={[2.5, 3.5, 3]} intensity={1.7} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
        <ArHero action={action} active={active} />
        <OrbitControls makeDefault target={[0, 0.7, 0]} />
        <DebugView />
      </Canvas>
    </main>
  );
}
