import * as THREE from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';

const scene = new THREE.Scene();
let npcMixer; // 用于npc动画的mixer
let platform1, platform2;

// 将透视相机改为正交相机
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 10;
const camera = new THREE.OrthographicCamera(
  frustumSize * aspect / -2,
  frustumSize * aspect / 2,
  frustumSize / 2,
  frustumSize / -2,
  0.1,
  1000
);
// 设置相机的初始位置和朝向
const cameraOffset = new THREE.Vector3(10, 10, 10);
camera.position.copy(cameraOffset);
camera.lookAt(0, 0, 0);

console.log('Initial camera position:', camera.position);
console.log('Initial camera rotation:', camera.rotation);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xCCCC66, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xCCCC66, 8);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// 加载场景模型
const loader = new GLTFLoader();
loader.load('scene.glb', function (gltf) {
  const model = gltf.scene;
  // 遍历场景,找到平台mesh并赋值
  model.traverse((child) => {
    if (child.name === 'SM_MERGED_Floor_Platform_01') {
      platform1 = child;
    }
    if (child.name === 'SM_MERGED_Floor_Platform_01001') {
      platform2 = child;
    }
  });
  // 缩放模型,仅在X轴方向增加宽度
  model.scale.set(3, 1.5, 3);
  scene.add(gltf.scene);
}, undefined, function (error) {
  console.error('Error loading scene:', error);
});

const clock = new THREE.Clock();
let mixer;
let model;
let idleAction, walkAction, runAction;
let modelDirection = new THREE.Vector3(); // 模型朝向

// NPC管理
const npcs = [];

function loadNPC(glbPath, position, scale, animationIndex) {
  loader.load(glbPath, function (gltf) {
    const npc = gltf.scene;
    npc.position.set(...position);
    npc.scale.set(...scale);
    scene.add(npc);

    console.log(`NPC loaded from ${glbPath}:`, npc);
    console.log(`Animations available in ${glbPath}:`, gltf.animations.map(anim => anim.name));

    const npcMixer = new THREE.AnimationMixer(npc);

    // 检查是否有动画,并且索引是否有效
    if (gltf.animations.length > animationIndex) {
      const npcAction = npcMixer.clipAction(gltf.animations[animationIndex]);
      npcAction.play();
      console.log(`Playing animation index ${animationIndex} for ${glbPath}`);
      console.log(`Animation name: ${gltf.animations[animationIndex].name}`);

      // 为当前播放的动画添加位置日志
      console.log(`NPC position from ${glbPath} at:`, npc.position);
    } else {
      console.error(`Animation index ${animationIndex} out of bounds for NPC: ${glbPath}`);
    }

    npcs.push({ mixer: npcMixer, npc: npc });
  }, undefined, function (error) {
    console.error(`An error happened while loading the NPC: ${glbPath}`, error);
  });
}

// 加载NPC并指定不同的动画序列
loadNPC('npc1.glb', [-2.3, 0.5, 6], [1.35, 1.35, 1.35], 2);
loadNPC('npc2.glb', [-2.3, 0.5, 4.7], [1.35, 1.35, 1.35], 0);
loadNPC('npc3.glb', [-8.8, 0.5, 1], [1.35, 1.35, 1.35], 1);
loadNPC('npc4.glb', [0, 0, -2], [1.35, 1.35, 1.35], 4);
loadNPC('npc5.glb', [0, 0, -1], [1.35, 1.35, 1.35], 4);
loadNPC('npc6.glb', [-1, 0, 8], [1.35, 1.35, 1.35], 7);
loadNPC('npc7.glb', [-0.3, 0, 3], [1.35, 1.35, 1.35], 8);
loadNPC('npc8.glb', [-2.5, 0, 0], [1.35, 1.35, 1.35], 5);
loadNPC('npc9.glb', [-2.1, 0.5, -3], [1.35, 1.35, 1.35], 6);

loader.load('player.glb', function (gltf) {
  console.log('Model loaded:', gltf);
  model = gltf.scene;
  // 缩放模型,统一在所有轴向上增加大小
  model.scale.set(1.35, 1.35, 1.35);
  scene.add(model);

  console.log('Model:', model);
  mixer = new THREE.AnimationMixer(model);

  console.log('Animations:', gltf.animations);
  idleAction = mixer.clipAction(gltf.animations[0]);
  walkAction = mixer.clipAction(gltf.animations[1]);
  runAction = mixer.clipAction(gltf.animations[2]);

  console.log('Idle action:', idleAction);
  console.log('Walk action:', walkAction);
  console.log('Run action:', runAction);

  idleAction.play();
}, undefined, function (error) {
  console.error('Error loading model:', error);
});

const keysPressed = {};

document.addEventListener('keydown', (event) => {
  keysPressed[event.code] = true;
});

document.addEventListener('keyup', (event) => {
  keysPressed[event.code] = false;
});

let lastGlitchTime = 0;
let glitchInterval = 0;
let glitchDuration = 0;
let isGlitchActive = false;

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const currentTime = Date.now();
  if (mixer) {
    mixer.update(delta);
  }

  // 更新NPC动画
  npcs.forEach((npcObject) => {
    if (npcObject.mixer) npcObject.mixer.update(delta);
  });

  if (model) {
    modelDirection.set(0, 0, 0);

    if (keysPressed['KeyW']) {
      modelDirection.z = -0.1;
    } else if (keysPressed['KeyS']) {
      modelDirection.z = 0.1;
    }

    if (keysPressed['KeyA']) {
      modelDirection.x = -0.1;
    } else if (keysPressed['KeyD']) {
      modelDirection.x = 0.1;
    }

    if (modelDirection.length() > 0) {
      if (keysPressed['ShiftLeft'] || keysPressed['ShiftRight']) {
        console.log('Running');
        runAction.play();
        idleAction.stop();
        walkAction.stop();
        // 增加 modelDirection 的值
        modelDirection.multiplyScalar(2);
        // 在奔跑时增加移动距离
        model.translateZ(0.02);
      } else {
        console.log('Walking');
        walkAction.play();
        idleAction.stop();
        runAction.stop();
      }
      model.lookAt(model.position.clone().add(modelDirection));
      model.translateZ(0.01);
    } else {
      console.log('Idle');
      idleAction.play();
      walkAction.stop();
      runAction.stop();
    }

    // 更新相机位置  
    const cameraPosition = model.position.clone().add(cameraOffset);
    camera.position.copy(cameraPosition);
  }

  // 更新平台位置以模拟地铁移动
  if (platform1 && platform2) {
    const speed = 30;
    platform1.position.z -= speed * delta;
    platform2.position.z -= speed * delta;

    // 检查平台是否移动到了一定的位置,然后重置位置
    if (platform1.position.z < -10) platform1.position.z = 10;
    if (platform2.position.z < -10) platform2.position.z = 10;
  }

  // 模拟地铁晃动
  const time = Date.now() * 0.001;
  scene.children.forEach(child => {
    if (child === model) {
      child.position.y = Math.sin(time * 4) * 0.02;
      child.position.x = Math.sin(time * 3) * 0.02;
    }
  });

  // Post-processing 初始化
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 添加GlitchPass  
  const glitchPass = new GlitchPass();
  
  if (!isGlitchActive && currentTime - lastGlitchTime > glitchInterval) {
    // 随机生成下一次故障效果的时间间隔和持续时间
    glitchInterval = 60000; // 30秒到300秒之间
    glitchDuration = 3000; // 500毫秒到1000毫秒之间
    
    lastGlitchTime = currentTime;
    isGlitchActive = true;
    
    glitchPass.goWild = true;
  }

  if (isGlitchActive) {
    composer.addPass(glitchPass);

    if (currentTime - lastGlitchTime > glitchDuration) {
      isGlitchActive = false;
    }
  }
  // 使用composer渲染来应用后处理效果
  composer.render();
}

animate();