import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Environment, Edges } from '@react-three/drei';
import * as THREE from 'three';

const ObjectNode = ({ position, type, index }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [status, setStatus] = useState('pending'); // pending, compliant, violation
  const { mouse, viewport } = useThree();

  // Randomize initial upward speed
  const speed = useMemo(() => 0.2 + Math.random() * 0.5, []);

  // Set colors based on status
  const colorMap = {
    pending: '#ffffff',
    compliant: '#00ffaa', // neon green
    violation: '#ff3366'  // red
  };

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // Anti-gravity float
    meshRef.current.position.y += speed * delta;
    
    // Reset if it goes too high
    if (meshRef.current.position.y > 6) {
      meshRef.current.position.y = -6;
      setStatus('pending'); // reset status on loop
    }

    // Cursor Gravity effect
    if (hovered) {
      // Calculate normalized mouse position
      const targetX = (mouse.x * viewport.width) / 2;
      const targetY = (mouse.y * viewport.height) / 2;
      
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetX, 0.05);
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.05);
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    // Simulate scan logic: Randomly decide compliant or violation
    const isCompliant = Math.random() > 0.3; // 70% compliant
    setStatus(isCompliant ? 'compliant' : 'violation');
  };

  const isCube = type === 'rule';

  return (
    <Float speed={2} rotationIntensity={1.5} floatIntensity={isCube ? 1 : 2}>
      <mesh
        ref={meshRef}
        position={position}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={handleClick}
        castShadow
        receiveShadow
      >
        {isCube ? (
          <boxGeometry args={[0.5, 0.5, 0.5]} />
        ) : (
          <sphereGeometry args={[0.3, 32, 32]} />
        )}
        <meshStandardMaterial 
          color={colorMap[status]} 
          roughness={0.1}
          metalness={0.8}
          emissive={colorMap[status]}
          emissiveIntensity={status !== 'pending' ? 1.5 : 0.2}
          transparent
          opacity={0.9}
        />
        {isCube && <Edges scale={1.05} color={status !== 'pending' ? colorMap[status] : '#8B5CF6'} />}
      </mesh>
    </Float>
  );
};

const Scene = () => {
  // Generate 25 floating objects
  const objects = useMemo(() => {
    return Array.from({ length: 25 }).map((_, i) => ({
      position: [
        (Math.random() - 0.5) * 10,  // x
        (Math.random() - 0.5) * 12,  // y
        (Math.random() - 0.5) * 5    // z
      ],
      type: Math.random() > 0.5 ? 'rule' : 'txn',
      key: i
    }));
  }, []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#00F5FF" />
      <directionalLight position={[-10, -10, -5]} intensity={1} color="#8B5CF6" />
      
      {objects.map((obj, i) => (
        <ObjectNode key={obj.key} index={i} position={obj.position} type={obj.type} />
      ))}
      
      <Environment preset="city" />
    </>
  );
};

const Scene3D = () => {
  return (
    <div className="w-full h-full rounded-3xl overflow-hidden cursor-crosshair">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <Scene />
      </Canvas>
    </div>
  );
};

export default Scene3D;
