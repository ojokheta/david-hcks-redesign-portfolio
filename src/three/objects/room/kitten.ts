import {
  Box3,
  Color,
  ConeGeometry,
  Group,
  LinearSRGBColorSpace,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { raycast } from "../../utils/raycast";
import { planeGeometry } from "../../common/geometries";
import { resources } from "../../../utils/resources";
import gsap from "gsap";
import vertexShader from "../../shaders/heart/vertex.glsl";
import fragmentShader from "../../shaders/heart/fragment.glsl";
import { room } from ".";
import { playSound } from "../../../features/sounds/utils/sounds";

import type { ClickableBox3 } from "../../types";

let mesh: Group | null = null;
let tail: Group | null = null;
let box3: ClickableBox3 | null = null;
let isJumping = false;
let heart: Mesh | null = null;
let heartMaterial: ShaderMaterial | null = null;
let initialized = false;

const GINGER = new Color("#e07a32");
const GINGER_DEEP = new Color("#c45a1c");
const CREAM = new Color("#f4e2c4");
const PINK = new Color("#e8a090");
const NOSE = new Color("#c45c58");
const EYE = new Color("#2a1810");

const sphere = new SphereGeometry(1, 14, 12);
const cone = new ConeGeometry(1, 1, 8);

const material = (color: Color) =>
  new MeshBasicMaterial({
    color,
  });

const makePart = (geometry: SphereGeometry | ConeGeometry, color: Color, scale: Vector3, position: Vector3) => {
  const part = new Mesh(geometry, material(color));
  part.scale.copy(scale);
  part.position.copy(position);
  return part;
};

const createKitten = () => {
  const group = new Group();

  const body = makePart(sphere, GINGER, new Vector3(0.18, 0.22, 0.2), new Vector3(0, 0.24, -0.02));
  const haunch = makePart(sphere, GINGER_DEEP, new Vector3(0.16, 0.16, 0.16), new Vector3(0, 0.16, -0.1));
  const chest = makePart(sphere, CREAM, new Vector3(0.12, 0.12, 0.1), new Vector3(0, 0.22, 0.08));
  const head = makePart(sphere, GINGER, new Vector3(0.17, 0.16, 0.16), new Vector3(0, 0.5, 0.08));
  const muzzle = makePart(sphere, CREAM, new Vector3(0.08, 0.06, 0.07), new Vector3(0, 0.45, 0.2));
  const nose = makePart(sphere, NOSE, new Vector3(0.025, 0.02, 0.022), new Vector3(0, 0.46, 0.26));
  const eyeLeft = makePart(sphere, EYE, new Vector3(0.024, 0.03, 0.016), new Vector3(-0.055, 0.54, 0.2));
  const eyeRight = makePart(sphere, EYE, new Vector3(0.024, 0.03, 0.016), new Vector3(0.055, 0.54, 0.2));
  const earLeft = makePart(cone, GINGER_DEEP, new Vector3(0.08, 0.13, 0.055), new Vector3(-0.1, 0.68, 0.04));
  const earRight = makePart(cone, GINGER_DEEP, new Vector3(0.08, 0.13, 0.055), new Vector3(0.1, 0.68, 0.04));
  const innerEarLeft = makePart(cone, PINK, new Vector3(0.04, 0.07, 0.028), new Vector3(-0.1, 0.66, 0.06));
  const innerEarRight = makePart(cone, PINK, new Vector3(0.04, 0.07, 0.028), new Vector3(0.1, 0.66, 0.06));
  const pawFrontLeft = makePart(sphere, CREAM, new Vector3(0.05, 0.05, 0.06), new Vector3(-0.07, 0.06, 0.1));
  const pawFrontRight = makePart(sphere, CREAM, new Vector3(0.05, 0.05, 0.06), new Vector3(0.07, 0.06, 0.1));
  const pawBackLeft = makePart(sphere, GINGER_DEEP, new Vector3(0.06, 0.05, 0.07), new Vector3(-0.09, 0.05, -0.08));
  const pawBackRight = makePart(sphere, GINGER_DEEP, new Vector3(0.06, 0.05, 0.07), new Vector3(0.09, 0.05, -0.08));
  const stripe = makePart(sphere, GINGER_DEEP, new Vector3(0.05, 0.12, 0.12), new Vector3(0, 0.3, -0.04));

  earLeft.rotation.z = 0.35;
  earRight.rotation.z = -0.35;
  innerEarLeft.rotation.z = 0.35;
  innerEarRight.rotation.z = -0.35;

  tail = new Group();
  tail.position.set(0.02, 0.22, -0.2);
  const tailBase = makePart(sphere, GINGER_DEEP, new Vector3(0.05, 0.05, 0.09), new Vector3(0.02, 0.04, -0.04));
  const tailMid = makePart(sphere, GINGER, new Vector3(0.045, 0.045, 0.08), new Vector3(0.08, 0.14, -0.08));
  const tailTip = makePart(sphere, CREAM, new Vector3(0.035, 0.035, 0.055), new Vector3(0.12, 0.24, -0.06));
  tail.add(tailBase, tailMid, tailTip);

  group.add(
    body,
    haunch,
    chest,
    head,
    muzzle,
    nose,
    eyeLeft,
    eyeRight,
    earLeft,
    earRight,
    innerEarLeft,
    innerEarRight,
    pawFrontLeft,
    pawFrontRight,
    pawBackLeft,
    pawBackRight,
    stripe,
    tail,
  );

  return group;
};

const init = (position: Vector3, quaternion: Quaternion) => {
  if (initialized) return;
  initialized = true;

  mesh = createKitten();
  mesh.position.copy(position);
  mesh.quaternion.copy(quaternion);
  mesh.rotateY(Math.PI * 0.85);
  mesh.scale.setScalar(1.45);
  mesh.position.y -= 0.08;

  initHeart();

  box3 = new Box3().setFromObject(mesh);
  box3.onClick = handleClick;
  box3.hoverSound = "hover";

  raycast.boxesToCheck.push(box3);
  room.group.add(mesh);
};

const initHeart = () => {
  if (!mesh) return;

  const texture = resources.items["icon-spritesheet"];
  texture.colorSpace = LinearSRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;

  heartMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    uniforms: {
      uTexture: { value: texture },
      uProgress: { value: 0 },
    },
  });

  heart = new Mesh(planeGeometry, heartMaterial);
  heart.position.copy(mesh.position);
  heart.position.x += 0.1;
  heart.position.y += 0.55;
  heart.position.z += 0.1;
  heart.visible = false;

  room.group.add(heart);
};

const handleClick = () => {
  if (isJumping || !mesh || !tail) return;
  isJumping = true;
  const tl = gsap.timeline();

  playSound("bird");

  tl.add(() => {
    isJumping = false;
  }, 0.8);

  tl.to(
    mesh.position,
    {
      y: mesh.position.y + 0.32,
      duration: 0.4,
      ease: "power2.out",
      yoyo: true,
      repeat: 1,
    },
    0,
  );

  tl.to(
    tail.rotation,
    {
      z: 0.7,
      duration: 0.12,
      repeat: 6,
      ease: "power2.out",
      yoyo: true,
    },
    0,
  );

  if (heart && heartMaterial && heartMaterial.uniforms.uProgress) {
    tl.set(heartMaterial.uniforms.uProgress, { value: 0 }, 0);
    tl.set(heart, { visible: true }, 0);
    tl.to(
      heartMaterial.uniforms.uProgress,
      {
        value: 1,
        duration: 0.8,
        ease: "power2.out",
      },
      0,
    );
    tl.set(heartMaterial.uniforms.uProgress, { value: 1 });
  }
};

const tick = () => {
  if (!mesh || !box3) return;

  box3.setFromObject(mesh);
  box3.expandByScalar(0.15);

  if (heart && heartMaterial && heartMaterial.uniforms.uProgress) {
    const progress = heartMaterial.uniforms.uProgress.value;
    if (progress <= 0.001 || progress >= 0.999) {
      heart.visible = false;
    } else {
      heart.visible = true;
    }
  }
};

const destroy = () => {
  if (box3) {
    raycast.boxesToCheck.splice(raycast.boxesToCheck.indexOf(box3), 1);
  }
  box3 = null;
};

export const kitten = { init, tick, destroy };
