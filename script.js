
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const viewport = $("#viewport");
  const loadingMessage = $("#loadingMessage");
  const fallback = $("#sceneFallback");

  const tabs = [...document.querySelectorAll(".mode-tab")];

  const modeContent = {
    objects: {
      title: "Object Detection",
      kicker: "MODE 01 / ENVIRONMENT PERCEPTION",
      description:
        "Explore obstacles and environmental structures in a simulated navigation scene. The markers are illustrative; a real detection model is not connected yet.",
      view: "Obstacles",
      count: "OBSTACLES: 06"
    },
    humans: {
      title: "Human Detection",
      kicker: "MODE 02 / HUMAN AWARENESS",
      description:
        "Explore a simulated environment containing human-shaped targets. This is a visual demonstration only, not a real person-detection system.",
      view: "Human targets",
      count: "TARGETS: 03"
    }
  };

  let activeMode = "objects";
  let scene = null;
  let camera = null;
  let renderer = null;
  let animationFrame = null;
  let drone = null;
  let objectMarkers = null;
  let humanTargets = null;
  let resizeObserver = null;

  let dragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let cameraAzimuth = 0.65;
  let cameraElevation = 0.75;
  let cameraDistance = 15;

  let pointerDownX = 0;
  let pointerDownY = 0;
  let hasMoved = false;

  function setMode(mode) {
    if (!modeContent[mode]) return;

    activeMode = mode;

    tabs.forEach((tab) => {
      const selected = tab.dataset.mode === mode;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    const content = modeContent[mode];

    $("#modeKicker").textContent = content.kicker;
    $("#modeTitle").textContent = content.title;
    $("#modeDescription").textContent = content.description;
    $("#viewStat").textContent = content.view;
    $("#sceneModeLabel").textContent =
      `MODE: ${mode === "objects" ? "OBJECT DETECTION" : "HUMAN DETECTION"}`;
    $("#sceneObjectCount").textContent = content.count;

    $("#modeInfo").setAttribute(
      "aria-labelledby",
      mode === "objects" ? "objectsTab" : "humansTab"
    );

    if (objectMarkers) objectMarkers.visible = mode === "objects";
    if (humanTargets) humanTargets.visible = mode === "humans";
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));

    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      event.preventDefault();

      const nextIndex =
        event.key === "ArrowRight"
          ? (index + 1) % tabs.length
          : (index - 1 + tabs.length) % tabs.length;

      tabs[nextIndex].focus();
      setMode(tabs[nextIndex].dataset.mode);
    });
  });

  function addLights(targetScene) {
    targetScene.add(new THREE.HemisphereLight(0xbad8ff, 0x172334, 2.1));

    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(-5, 12, 7);
    targetScene.add(sun);

    const fill = new THREE.DirectionalLight(0x438dff, 1.0);
    fill.position.set(8, 5, -8);
    targetScene.add(fill);
  }

  function makeMaterial(color, extra = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: 0.12,
      ...extra
    });
  }

  function addBuilding(targetScene, x, z, width, height, depth, color) {
    const material = makeMaterial(color);
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material
    );

    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    targetScene.add(building);

    // Subtle window strips help distinguish the buildings.
    const windowMaterial = new THREE.MeshBasicMaterial({
      color: 0x477092,
      transparent: true,
      opacity: 0.68
    });

    const floors = Math.floor(height / 0.75);

    for (let floor = 0; floor < floors; floor++) {
      const windowY = 0.35 + floor * 0.75;
      if (windowY > height - 0.2) continue;

      for (let side = -1; side <= 1; side += 2) {
        const windowMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.28, 0.025),
          windowMaterial
        );

        windowMesh.position.set(
          x + side * Math.min(width * 0.24, 0.4),
          windowY,
          z + depth / 2 + 0.014
        );

        targetScene.add(windowMesh);
      }
    }

    return building;
  }

  function createDrone() {
    const group = new THREE.Group();

    const bodyMaterial = makeMaterial(0xd9e7f8, {
      metalness: 0.55,
      roughness: 0.35
    });

    const darkMaterial = makeMaterial(0x263c56, {
      metalness: 0.65,
      roughness: 0.3
    });

    const blueMaterial = makeMaterial(0x4285ff, {
      emissive: 0x102e75,
      metalness: 0.45
    });

    // Main fuselage.
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.18, 0.65),
      bodyMaterial
    );
    group.add(body);

    // Nose camera.
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 12),
      blueMaterial
    );
    nose.position.set(0, -0.01, -0.35);
    group.add(nose);

    // Four arms and motor/rotor assemblies.
    const armPositions = [
      [-0.52, 0, -0.47],
      [0.52, 0, -0.47],
      [-0.52, 0, 0.47],
      [0.52, 0, 0.47]
    ];

    const rotorGroups = [];

    armPositions.forEach(([x, y, z]) => {
      const armLength = Math.sqrt(x * x + z * z);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(armLength * 1.75, 0.075, 0.075),
        darkMaterial
      );

      arm.position.set(x * 0.48, y, z * 0.48);
      arm.rotation.y = Math.atan2(-z, x);
      group.add(arm);

      const motor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.105, 0.09, 16),
        darkMaterial
      );

      motor.position.set(x, 0.04, z);
      group.add(motor);

      const rotorGroup = new THREE.Group();
      rotorGroup.position.set(x, 0.105, z);

      const bladeMaterial = makeMaterial(0x7f9bb9, {
        transparent: true,
        opacity: 0.82
      });

      for (let bladeIndex = 0; bladeIndex < 2; bladeIndex++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.44, 0.018, 0.055),
          bladeMaterial
        );

        blade.rotation.y = bladeIndex * Math.PI / 2;
        rotorGroup.add(blade);
      }

      group.add(rotorGroup);
      rotorGroups.push(rotorGroup);
    });

    // Navigation light.
    const navLight = new THREE.PointLight(0x4285ff, 0.8, 2.5);
    navLight.position.set(0, 0.18, -0.1);
    group.add(navLight);

    group.userData.rotors = rotorGroups;
    group.position.set(0, 2.5, 0);

    return group;
  }

  function createObjectMarkers() {
    const group = new THREE.Group();

    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0x62a5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.95
    });

    const positions = [
      [-3.2, 1.0, -2.0],
      [3.0, 1.1, -3.0],
      [-4.0, 0.9, 2.0],
      [3.8, 1.0, 2.0],
      [0.0, 1.0, -5.0],
      [5.0, 1.0, -0.5]
    ];

    positions.forEach(([x, y, z], index) => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(
          index % 2 === 0 ? 1.2 : 0.9,
          index % 3 === 0 ? 1.7 : 1.3,
          index % 2 === 0 ? 1.0 : 0.9
        ),
        markerMaterial
      );

      box.position.set(x, y, z);
      group.add(box);
    });

    return group;
  }

  function createHumanTargets() {
    const group = new THREE.Group();

    const targetMaterial = new THREE.MeshBasicMaterial({
      color: 0x45d6a0,
      transparent: true,
      opacity: 0.92
    });

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x45d6a0,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide
    });

    const positions = [
      [-3.0, 0, -1.2],
      [3.2, 0, 1.0],
      [0.7, 0, -4.2]
    ];

    positions.forEach(([x, y, z]) => {
      const person = new THREE.Group();

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 14, 12),
        targetMaterial
      );
      head.position.y = 1.48;
      person.add(head);

      const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.23, 0.65, 12),
        targetMaterial
      );
      torso.position.y = 1.0;
      person.add(torso);

      const legs = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.45, 0.17),
        targetMaterial
      );
      legs.position.y = 0.47;
      person.add(legs);

      // A flat ring marks the target location.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.38, 0.43, 32),
        ringMaterial
      );

      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.035;
      person.add(ring);

      person.position.set(x, y, z);
      group.add(person);
    });

    return group;
  }

  function updateCamera() {
    if (!camera) return;

    cameraElevation = Math.max(
      0.18,
      Math.min(1.38, cameraElevation)
    );

    cameraDistance = Math.max(
      7,
      Math.min(25, cameraDistance)
    );

    const horizontalDistance =
      cameraDistance * Math.cos(cameraElevation);

    camera.position.set(
      horizontalDistance * Math.sin(cameraAzimuth),
      cameraDistance * Math.sin(cameraElevation),
      horizontalDistance * Math.cos(cameraAzimuth)
    );

    camera.lookAt(0, 0.9, 0);
  }

  function createScene() {
    if (!window.THREE) {
      loadingMessage.textContent =
        "3D library unavailable. Check your internet connection.";
      return;
    }

    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1522);
      scene.fog = new THREE.Fog(0x0b1522, 17, 34);

      camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
      updateCamera();

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
      });

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute(
        "aria-label",
        "Interactive 3D drone navigation environment"
      );

      viewport.insertBefore(renderer.domElement, viewport.querySelector(".viewport-bottom"));
      fallback.style.display = "none";

      addLights(scene);

      // Ground plane.
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        makeMaterial(0x101e2d, { roughness: 0.95 })
      );

      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.04;
      ground.receiveShadow = true;
      scene.add(ground);

      // Grid.
      const grid = new THREE.GridHelper(60, 60, 0x3a6b91, 0x24425d);
      grid.position.y = 0.005;
      grid.material.transparent = true;
      grid.material.opacity = 0.58;
      scene.add(grid);

      // City-like obstacle layout.
      addBuilding(scene, -5.0, -3.4, 1.8, 3.0, 1.8, 0x243a50);
      addBuilding(scene, -2.8, -5.1, 1.7, 2.1, 1.8, 0x1c3147);
      addBuilding(scene, 3.6, -4.0, 2.0, 4.0, 2.0, 0x294057);
      addBuilding(scene, 5.0, -0.2, 1.7, 2.7, 1.7, 0x1b3046);
      addBuilding(scene, -5.0, 2.0, 1.7, 2.4, 2.0, 0x21384e);
      addBuilding(scene, 4.0, 3.8, 2.0, 3.3, 1.8, 0x294057);
      addBuilding(scene, -2.9, 4.5, 1.6, 1.9, 1.7, 0x1b3046);

      // Extra physical obstacle blocks.
      const obstacleMaterial = makeMaterial(0x7a91aa);
      [
        [-1.7, 0.35, -1.6],
        [2.0, 0.45, 2.7],
        [-4.0, 0.4, 0.2],
        [1.8, 0.35, -5.0]
      ].forEach(([x, y, z]) => {
        const obstacle = new THREE.Mesh(
          new THREE.BoxGeometry(0.75, y * 2, 0.75),
          obstacleMaterial
        );
        obstacle.position.set(x, y, z);
        obstacle.castShadow = true;
        scene.add(obstacle);
      });

      // Decorative route line.
      const routePoints = [
        new THREE.Vector3(-1.5, 0.04, 5.2),
        new THREE.Vector3(-0.5, 0.04, 3.2),
        new THREE.Vector3(1.2, 0.04, 1.8),
        new THREE.Vector3(0.0, 0.04, 0.0),
        new THREE.Vector3(1.4, 0.04, -2.5),
        new THREE.Vector3(0.2, 0.04, -5.5)
      ];

      const route = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(routePoints),
        new THREE.LineBasicMaterial({
          color: 0x4285ff,
          transparent: true,
          opacity: 0.85
        })
      );

      scene.add(route);

      // Drone and mode-specific overlays.
      drone = createDrone();
      scene.add(drone);

      objectMarkers = createObjectMarkers();
      scene.add(objectMarkers);

      humanTargets = createHumanTargets();
      scene.add(humanTargets);

      setMode(activeMode);

      resizeRenderer();

      loadingMessage.style.display = "none";

      if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(resizeRenderer);
        resizeObserver.observe(viewport);
      } else {
        window.addEventListener("resize", resizeRenderer);
      }

      animate();
    } catch (error) {
      console.error("SkyRL scene initialization failed:", error);
      loadingMessage.textContent =
        "Unable to initialize the 3D scene. Refresh to try again.";
    }
  }

  function resizeRenderer() {
    if (!renderer || !camera) return;

    const width = Math.max(1, viewport.clientWidth);
    const height = Math.max(1, viewport.clientHeight);

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    animationFrame = requestAnimationFrame(animate);

    const time = performance.now() * 0.001;

    if (drone) {
      drone.position.y = 2.5 + Math.sin(time * 1.3) * 0.12;
      drone.rotation.z = Math.sin(time * 0.7) * 0.025;

      drone.userData.rotors.forEach((rotor, index) => {
        rotor.rotation.y += index % 2 === 0 ? 0.65 : -0.65;
      });
    }

    if (humanTargets) {
      humanTargets.children.forEach((person, index) => {
        const ring = person.children[3];
        if (ring) {
          const pulse = 1 + Math.sin(time * 2.5 + index) * 0.08;
          ring.scale.set(pulse, pulse, pulse);
        }
      });
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function onPointerDown(event) {
    if (!renderer || event.button !== 0) return;

    dragging = true;
    hasMoved = false;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;

    renderer.domElement.style.cursor = "grabbing";

    try {
      renderer.domElement.setPointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture may be unavailable in some browsers.
    }
  }

  function onPointerMove(event) {
    if (!dragging) return;

    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;

    if (
      Math.abs(event.clientX - pointerDownX) > 3 ||
      Math.abs(event.clientY - pointerDownY) > 3
    ) {
      hasMoved = true;
    }

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    cameraAzimuth -= dx * 0.008;
    cameraElevation += dy * 0.006;

    updateCamera();
  }

  function onPointerUp(event) {
    dragging = false;

    if (renderer) {
      renderer.domElement.style.cursor = "grab";

      try {
        renderer.domElement.releasePointerCapture(event.pointerId);
      } catch (_) {
        // No action needed if capture was already released.
      }
    }
  }

  viewport.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  viewport.addEventListener("wheel", (event) => {
    if (!renderer) return;

    event.preventDefault();
    cameraDistance += event.deltaY * 0.012;
    updateCamera();
  }, { passive: false });

  $("#resetView").addEventListener("click", () => {
    cameraAzimuth = 0.65;
    cameraElevation = 0.75;
    cameraDistance = 15;
    updateCamera();
  });

  $("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("light-theme");

    const isLight = document.body.classList.contains("light-theme");
    $("#themeToggle").textContent = isLight ? "☾" : "☼";
    $("#themeToggle").setAttribute(
      "aria-label",
      isLight ? "Switch to dark mode" : "Switch to light mode"
    );

    if (scene) {
      scene.background.set(isLight ? 0xdce8f5 : 0x0b1522);
      scene.fog.color.set(isLight ? 0xdce8f5 : 0x0b1522);
    }
  });

  /*
   * UNITY WEBGL INTEGRATION POINT
   *
   * When your Unity build is ready:
   * 1. Export your project using Unity's WebGL build target.
   * 2. Host the complete exported build on a web server.
   * 3. Replace the Three.js viewport with Unity's generated loader/canvas.
   * 4. Connect the mode tabs to your Unity bridge using a documented
   *    Unity SendMessage interface or a JavaScript plugin.
   *
   * Do not set a Unity build path until the build files actually exist.
   * The current markers and scene are a visual demo, not AI detections.
   */

  window.SkyRL = {
    setMode,
    getMode: () => activeMode
  };

  window.addEventListener("beforeunload", () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (resizeObserver) resizeObserver.disconnect();
    if (renderer) {
      renderer.dispose();
    }
  });

  setMode("objects");
  createScene();
})();
