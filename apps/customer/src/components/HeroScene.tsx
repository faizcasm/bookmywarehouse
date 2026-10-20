import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';

/**
 * Procedural warehouse hero scene — no external assets, ~15 meshes.
 * Decorative only (aria-hidden, pointer-events none via .hero-scene-canvas).
 * Parent (HomePage) only mounts this on capable devices; reduced-motion
 * renders a static pose.
 */

const WALL = '#d7e1f2';
const WALL_2 = '#c3cee2';
const ROOF = '#1e293b';
const DOOR = '#0f172a';
const SLAB = '#121b31';
const BRAND = '#2563eb';
const TEAL = '#0d9488';
const INDIGO = '#4f46e5';
const AMBER = '#f59e0b';

function Warehouse() {
  return (
    <group>
      {/* ground slab */}
      <mesh position={[0, -0.07, 0]}>
        <boxGeometry args={[7.2, 0.14, 4.6]} />
        <meshStandardMaterial color={SLAB} roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[7.5, 0.05, 4.9]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>

      {/* main warehouse body */}
      <mesh position={[-0.7, 0.78, -0.3]}>
        <boxGeometry args={[3.7, 1.56, 2.5]} />
        <meshStandardMaterial color={WALL} roughness={0.78} metalness={0.04} />
      </mesh>

      {/* roof cap */}
      <mesh position={[-0.7, 1.6, -0.3]}>
        <boxGeometry args={[3.86, 0.14, 2.66]} />
        <meshStandardMaterial color={ROOF} roughness={0.6} metalness={0.25} />
      </mesh>

      {/* skylight monitors */}
      {[-1.85, -0.7, 0.45].map((x) => (
        <mesh key={x} position={[x, 1.78, -0.3]}>
          <boxGeometry args={[0.72, 0.24, 1.7]} />
          <meshStandardMaterial
            color="#bfd7ff"
            roughness={0.25}
            metalness={0.15}
            emissive="#1d4ed8"
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}

      {/* brand sign strip on the front face */}
      <mesh position={[-0.7, 1.28, 0.97]}>
        <boxGeometry args={[1.7, 0.26, 0.06]} />
        <meshStandardMaterial
          color={BRAND}
          emissive={BRAND}
          emissiveIntensity={1.1}
          roughness={0.4}
        />
      </mesh>

      {/* loading dock doors */}
      {[-1.8, -0.7, 0.4].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.46, 0.97]}>
            <boxGeometry args={[0.86, 0.92, 0.06]} />
            <meshStandardMaterial color={DOOR} roughness={0.7} metalness={0.3} />
          </mesh>
          {/* dock awning */}
          <mesh position={[0, 1.0, 1.24]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[1.0, 0.06, 0.62]} />
            <meshStandardMaterial color={ROOF} roughness={0.6} metalness={0.2} />
          </mesh>
        </group>
      ))}

      {/* side office annex */}
      <mesh position={[1.7, 0.42, -0.1]}>
        <boxGeometry args={[1.3, 0.84, 1.7]} />
        <meshStandardMaterial color={WALL_2} roughness={0.8} />
      </mesh>
      <mesh position={[1.7, 0.55, 0.77]}>
        <boxGeometry args={[0.9, 0.26, 0.05]} />
        <meshStandardMaterial
          color="#7dd3fc"
          emissive="#0284c7"
          emissiveIntensity={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* stacked shipping containers */}
      <mesh position={[2.7, 0.47, 1.1]} rotation={[0, -0.12, 0]}>
        <boxGeometry args={[1.7, 0.9, 0.92]} />
        <meshStandardMaterial color={TEAL} roughness={0.65} metalness={0.15} />
      </mesh>
      <mesh position={[2.62, 1.37, 1.04]} rotation={[0, -0.05, 0]}>
        <boxGeometry args={[1.6, 0.86, 0.88]} />
        <meshStandardMaterial color={BRAND} roughness={0.65} metalness={0.15} />
      </mesh>
      <mesh position={[2.9, 0.45, 0.05]} rotation={[0, 0.1, 0]}>
        <boxGeometry args={[1.5, 0.86, 0.86]} />
        <meshStandardMaterial color={INDIGO} roughness={0.65} metalness={0.15} />
      </mesh>

      {/* crates on the apron */}
      <mesh position={[1.15, 0.2, 1.8]}>
        <boxGeometry args={[0.44, 0.4, 0.44]} />
        <meshStandardMaterial color={AMBER} roughness={0.85} />
      </mesh>
      <mesh position={[1.6, 0.17, 1.75]}>
        <boxGeometry args={[0.38, 0.34, 0.38]} />
        <meshStandardMaterial color="#8fa0bd" roughness={0.9} />
      </mesh>
      <mesh position={[1.6, 0.52, 1.75]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.34, 0.3, 0.34]} />
        <meshStandardMaterial color="#64748b" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Slow orbiting parcel cubes for a logistics touch. */
function OrbitingParcels({ animate }: { animate: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!animate || !ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.22;
    ref.current.children.forEach((child, i) => {
      child.rotation.x = state.clock.elapsedTime * (0.4 + i * 0.15);
      child.rotation.z = state.clock.elapsedTime * 0.3;
    });
  });
  const parcels = useMemo(
    () => [
      { pos: [3.1, 2.3, 0.4] as [number, number, number], color: BRAND },
      { pos: [-2.9, 2.6, 1.1] as [number, number, number], color: TEAL },
      { pos: [-1.2, 2.9, -2.6] as [number, number, number], color: AMBER },
    ],
    [],
  );
  return (
    <group ref={ref}>
      {parcels.map((parcel) => (
        <mesh key={parcel.color} position={parcel.pos}>
          <boxGeometry args={[0.26, 0.26, 0.26]} />
          <meshStandardMaterial color={parcel.color} roughness={0.5} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function FloatGroup({ animate }: { animate: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    if (!animate) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 0.8) * 0.11;
    ref.current.rotation.y = -0.32 + Math.sin(t * 0.3) * 0.15;
  });
  return (
    <group ref={ref}>
      <Warehouse />
      <OrbitingParcels animate={animate} />
    </group>
  );
}

export default function HeroScene() {
  const animate = useMemo(
    () =>
      typeof window === 'undefined' ||
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  return (
    <div className="hero-scene-canvas" aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [4.4, 3.1, 7.8], fov: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ camera }) => camera.lookAt(0.55, 0.8, 0)}
        frameloop={animate ? 'always' : 'demand'}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 4]} intensity={1.25} color="#ffffff" />
        <directionalLight position={[-6, 4, -3]} intensity={0.55} color="#60a5fa" />
        <pointLight position={[-3.4, 1.4, 3]} intensity={12} color="#2dd4bf" distance={12} />
        <FloatGroup animate={animate} />
      </Canvas>
    </div>
  );
}
