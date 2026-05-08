import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function createMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.64,
    metalness: options.metalness ?? 0.03,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
}

function addMesh(parent, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function softenMesh(mesh) {
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function addStagePlane(parent, width, height, color, opacity, position, rotation = [0, 0, 0]) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return addMesh(parent, new THREE.PlaneGeometry(width, height), material, position, [1, 1, 1], rotation);
}

function buildAvatar() {
  const root = new THREE.Group();
  const torso = new THREE.Group();
  const headPivot = new THREE.Group();
  const face = new THREE.Group();

  const skin = createMaterial(0xe9b9a8, { roughness: 0.7 });
  const skinWarm = createMaterial(0xd99c8f, { roughness: 0.74 });
  const skinShadow = createMaterial(0xc98e83, { roughness: 0.8 });
  const blush = createMaterial(0xe8a0a6, { roughness: 0.78, emissive: 0x381019, emissiveIntensity: 0.03 });
  const hair = createMaterial(0x17101a, { roughness: 0.46 });
  const hairSoft = createMaterial(0x2a1a23, { roughness: 0.52 });
  const blazer = createMaterial(0x101b33, { roughness: 0.62, metalness: 0.04 });
  const blazerLight = createMaterial(0x23395f, { roughness: 0.68 });
  const blouse = createMaterial(0xf4f0e8, { roughness: 0.75 });
  const eyeWhite = createMaterial(0xf4f7fb, { roughness: 0.38 });
  const iris = createMaterial(0x302018, { roughness: 0.34 });
  const pupil = createMaterial(0x09070a, { roughness: 0.28 });
  const brow = createMaterial(0x201316, { roughness: 0.5 });
  const lip = createMaterial(0xb85d6b, { roughness: 0.64 });
  const lipDark = createMaterial(0x3f111b, { roughness: 0.6 });
  const white = createMaterial(0xffffff, { roughness: 0.35, emissive: 0x9bd8ff, emissiveIntensity: 0.08 });

  root.add(torso);
  addMesh(torso, new THREE.CapsuleGeometry(0.64, 1.48, 16, 32), blazer, [0, -1.55, -0.05], [1.34, 1, 0.46]);
  addMesh(torso, new THREE.SphereGeometry(0.5, 32, 20), blazerLight, [-0.66, -1.05, -0.03], [1.12, 0.52, 0.34], [0, 0, 0.1]);
  addMesh(torso, new THREE.SphereGeometry(0.5, 32, 20), blazerLight, [0.66, -1.05, -0.03], [1.12, 0.52, 0.34], [0, 0, -0.1]);
  addMesh(torso, new THREE.CapsuleGeometry(0.36, 1.05, 12, 24), blouse, [0, -1.48, 0.17], [0.78, 1, 0.16]);
  addMesh(torso, new THREE.BoxGeometry(0.055, 1.02, 0.04), blazerLight, [-0.22, -1.44, 0.25], [1, 1, 1], [0, 0, -0.2]);
  addMesh(torso, new THREE.BoxGeometry(0.055, 1.02, 0.04), blazerLight, [0.22, -1.44, 0.25], [1, 1, 1], [0, 0, 0.2]);
  addMesh(torso, new THREE.CylinderGeometry(0.18, 0.24, 0.42, 32), skinWarm, [0, -0.52, 0.03], [1, 1, 0.82]);

  headPivot.position.set(0, -0.04, 0.03);
  root.add(headPivot);

  const head = addMesh(headPivot, new THREE.SphereGeometry(0.66, 72, 52), skin, [0, 0.42, 0], [0.7, 1.0, 0.58]);
  softenMesh(addMesh(headPivot, new THREE.SphereGeometry(0.27, 32, 18), skinWarm, [0, -0.08, 0.15], [0.82, 0.32, 0.48]));
  addMesh(headPivot, new THREE.SphereGeometry(0.69, 72, 42), hair, [0, 0.57, -0.17], [0.84, 1.02, 0.68]);
  addMesh(headPivot, new THREE.SphereGeometry(0.38, 44, 24), hairSoft, [-0.19, 0.84, 0.2], [1.14, 0.26, 0.24], [0.02, -0.12, -0.1]);
  addMesh(headPivot, new THREE.SphereGeometry(0.34, 44, 24), hairSoft, [0.25, 0.82, 0.18], [0.92, 0.22, 0.22], [0.02, 0.1, 0.08]);
  addMesh(headPivot, new THREE.CapsuleGeometry(0.1, 0.76, 12, 20), hairSoft, [-0.48, 0.24, -0.01], [0.9, 1, 0.54], [0.06, 0, -0.1]);
  addMesh(headPivot, new THREE.CapsuleGeometry(0.09, 0.68, 12, 20), hairSoft, [0.48, 0.23, -0.01], [0.9, 1, 0.54], [0.06, 0, 0.1]);
  softenMesh(addMesh(headPivot, new THREE.SphereGeometry(0.08, 24, 16), skinWarm, [-0.47, 0.35, -0.02], [0.32, 0.62, 0.24]));
  softenMesh(addMesh(headPivot, new THREE.SphereGeometry(0.08, 24, 16), skinWarm, [0.47, 0.35, -0.02], [0.32, 0.62, 0.24]));

  face.position.set(0, 0.43, 0.44);
  headPivot.add(face);

  const leftEye = softenMesh(addMesh(face, new THREE.SphereGeometry(0.074, 36, 18), eyeWhite, [-0.18, 0.12, 0.026], [1.25, 0.44, 0.12]));
  const rightEye = softenMesh(addMesh(face, new THREE.SphereGeometry(0.074, 36, 18), eyeWhite, [0.18, 0.12, 0.026], [1.25, 0.44, 0.12]));
  softenMesh(addMesh(face, new THREE.SphereGeometry(0.044, 24, 14), iris, [-0.18, 0.116, 0.062], [0.78, 0.72, 0.1]));
  softenMesh(addMesh(face, new THREE.SphereGeometry(0.044, 24, 14), iris, [0.18, 0.116, 0.062], [0.78, 0.72, 0.1]));
  softenMesh(addMesh(face, new THREE.SphereGeometry(0.024, 18, 10), pupil, [-0.18, 0.114, 0.088], [0.86, 0.86, 0.08]));
  softenMesh(addMesh(face, new THREE.SphereGeometry(0.024, 18, 10), pupil, [0.18, 0.114, 0.088], [0.86, 0.86, 0.08]));
  softenMesh(addMesh(face, new THREE.SphereGeometry(0.012, 12, 8), white, [-0.203, 0.138, 0.108], [1, 1, 0.5]));
  softenMesh(addMesh(face, new THREE.SphereGeometry(0.012, 12, 8), white, [0.157, 0.138, 0.108], [1, 1, 0.5]));
  const leftBrow = softenMesh(addMesh(face, new THREE.BoxGeometry(0.19, 0.022, 0.014), brow, [-0.18, 0.248, 0.032], [1, 1, 1], [0, 0, 0.08]));
  const rightBrow = softenMesh(addMesh(face, new THREE.BoxGeometry(0.19, 0.022, 0.014), brow, [0.18, 0.248, 0.032], [1, 1, 1], [0, 0, -0.08]));

  softenMesh(addMesh(face, new THREE.CapsuleGeometry(0.024, 0.14, 12, 18), skinShadow, [0, 0.02, 0.072], [0.68, 1, 0.42], [0.04, 0, 0]));
  softenMesh(addMesh(face, new THREE.SphereGeometry(0.043, 24, 14), skinWarm, [0, -0.062, 0.094], [0.76, 0.48, 0.36]));
  softenMesh(addMesh(face, new THREE.SphereGeometry(0.052, 24, 14), blush, [-0.29, -0.09, 0.025], [1.05, 0.26, 0.08]));
  softenMesh(addMesh(face, new THREE.SphereGeometry(0.052, 24, 14), blush, [0.29, -0.09, 0.025], [1.05, 0.26, 0.08]));

  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.28, 0.08);
  face.add(mouthGroup);
  const mouthInner = softenMesh(addMesh(mouthGroup, new THREE.SphereGeometry(0.052, 32, 16), lipDark, [0, 0, 0.002], [1.82, 0.13, 0.06]));
  const upperLip = softenMesh(addMesh(mouthGroup, new THREE.SphereGeometry(0.042, 32, 14), lip, [0, 0.014, 0.015], [2.15, 0.14, 0.06]));
  const lowerLip = softenMesh(addMesh(mouthGroup, new THREE.SphereGeometry(0.042, 32, 14), lip, [0, -0.021, 0.014], [1.9, 0.18, 0.06]));

  return {
    root,
    torso,
    head,
    headPivot,
    face,
    leftEye,
    rightEye,
    leftBrow,
    rightBrow,
    mouthInner,
    upperLip,
    lowerLip,
  };
}

const Live3DAvatar = ({ isSpeaking }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const speakingRef = useRef(isSpeaking);

  useEffect(() => {
    speakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.1, 6.25);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    renderer.setClearColor(0x000000, 0);

    const ambient = new THREE.HemisphereLight(0xd9e8ff, 0x182033, 1.9);
    const key = new THREE.DirectionalLight(0xffffff, 2.35);
    key.position.set(2.4, 3.2, 4.8);
    const fill = new THREE.DirectionalLight(0x9bc8ff, 1.55);
    fill.position.set(-2.8, 1.5, 3.2);
    const rim = new THREE.PointLight(0x22d3ee, 2.3, 7.5);
    rim.position.set(-1.8, 0.75, 1.9);
    const warm = new THREE.PointLight(0xffc4a3, 1.15, 6);
    warm.position.set(1.8, 0.75, 2.4);
    scene.add(ambient, key, fill, rim, warm);

    const stage = new THREE.Group();
    scene.add(stage);
    addStagePlane(stage, 7.2, 4.2, 0x081225, 0.62, [0, 0.1, -1.25]);
    addStagePlane(stage, 6.4, 1.8, 0x083344, 0.18, [0, -1.85, -0.15], [-1.18, 0, 0]);
    const grid = new THREE.GridHelper(7.2, 14, 0x155e75, 0x1e293b);
    grid.position.set(0, -1.42, -0.95);
    grid.rotation.x = Math.PI / 2;
    grid.material.transparent = true;
    grid.material.opacity = 0.24;
    stage.add(grid);

    const avatar = buildAvatar();
    avatar.root.position.set(0, 0.04, 0.36);
    avatar.root.scale.set(1.02, 1.02, 1.02);
    scene.add(avatar.root);

    const floorShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
    );
    floorShadow.position.set(0, -1.96, 0.14);
    floorShadow.rotation.x = -Math.PI / 2;
    scene.add(floorShadow);

    let frameId;
    const clock = new THREE.Clock();

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const speaking = speakingRef.current;
      const blink = Math.sin(elapsed * 1.5) > 0.986 ? 0.06 : 0.44;
      const mouthOpen = speaking
        ? 0.26 + Math.abs(Math.sin(elapsed * 9.5)) * 0.38 + Math.abs(Math.sin(elapsed * 17)) * 0.13
        : 0.1;
      const breath = Math.sin(elapsed * 1.15);

      avatar.root.position.y = 0.04 + breath * 0.016;
      avatar.root.rotation.y = Math.sin(elapsed * 0.42) * 0.045;
      avatar.torso.scale.y = 1 + breath * 0.012;
      avatar.headPivot.rotation.y = Math.sin(elapsed * 0.62) * 0.08;
      avatar.headPivot.rotation.x = Math.sin(elapsed * 0.86) * 0.025 + (speaking ? Math.sin(elapsed * 4.2) * 0.014 : 0);
      avatar.face.position.y = 0.43 + breath * 0.004;
      avatar.leftEye.scale.y = blink;
      avatar.rightEye.scale.y = blink;
      avatar.leftBrow.position.y = 0.26 + (speaking ? Math.sin(elapsed * 5.2) * 0.01 : 0);
      avatar.rightBrow.position.y = 0.26 + (speaking ? Math.sin(elapsed * 5.2 + 0.4) * 0.01 : 0);
      avatar.mouthInner.scale.y = mouthOpen;
      avatar.lowerLip.position.y = -0.024 - mouthOpen * 0.018;
      avatar.upperLip.position.y = 0.017 + mouthOpen * 0.004;
      rim.intensity = speaking ? 2.85 + Math.sin(elapsed * 8) * 0.28 : 2.1 + breath * 0.14;
      floorShadow.material.opacity = speaking ? 0.32 : 0.24;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-lg bg-[#050816]">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_52%,rgba(34,211,238,0.18),transparent_32%),linear-gradient(145deg,rgba(7,12,28,0.97),rgba(11,25,45,0.82),rgba(0,0,0,0.98))]" />
      <div className="absolute inset-0 z-0 opacity-28 bg-[linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(129,140,248,0.08)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <canvas ref={canvasRef} className="absolute inset-0 z-10 block h-full w-full" />
      <div className="pointer-events-none absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/18 bg-black/35 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md">
        <span className={`h-2 w-2 rounded-full ${isSpeaking ? 'bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)] animate-pulse' : 'bg-slate-300'}`} />
        {isSpeaking ? 'AI đang nói...' : 'Sẵn sàng nghe'}
      </div>
    </div>
  );
};

export default Live3DAvatar;
