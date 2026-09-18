import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export interface TileItem {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  text: string;
}

export interface PhysicsManagerOptions {
  scene: THREE.Scene;
  onTileCountChange?: (count: number, max: number) => void;
  onBufferOverflow?: () => void;
}

export class PhysicsManager {
  public world: CANNON.World;
  private scene: THREE.Scene;
  private tiles: TileItem[] = [];
  private binBodies: CANNON.Body[] = [];
  private binMeshGroup: THREE.Group;
  private isShattered: boolean = false;
  public readonly MAX_CAPACITY: number = 35;
  private onTileCountChange?: (count: number, max: number) => void;
  private onBufferOverflow?: () => void;

  // Center position of acrylic bin
  private binPos = new THREE.Vector3(6.5, 2.0, 0);
  private binDimensions = { width: 2.6, height: 3.2, depth: 2.2, wallThick: 0.08 };

  // Shared tile geometries and material caching
  private tileGeometry: THREE.BoxGeometry;
  private canvasTextureCache: Map<string, THREE.CanvasTexture> = new Map();

  constructor(options: PhysicsManagerOptions) {
    this.scene = options.scene;
    this.onTileCountChange = options.onTileCountChange;
    this.onBufferOverflow = options.onBufferOverflow;

    // Cannon-es Physics World (g = -9.82 m/s^2)
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    (this.world.solver as CANNON.GSSolver).iterations = 10;

    // Contact material for nice bouncing tiles
    const groundMaterial = new CANNON.Material('ground');
    const tileMaterial = new CANNON.Material('tile');
    const contactMaterial = new CANNON.ContactMaterial(groundMaterial, tileMaterial, {
      friction: 0.35,
      restitution: 0.25,
    });
    this.world.addContactMaterial(contactMaterial);

    // Floor physics plane
    const floorBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: groundMaterial,
    });
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    floorBody.position.set(0, -0.6, 0);
    this.world.addBody(floorBody);

    // Tile geometry ($0.65 x 0.2 x 0.32 units)
    this.tileGeometry = new THREE.BoxGeometry(0.65, 0.2, 0.32);

    // Build Acrylic Output Bin
    this.binMeshGroup = new THREE.Group();
    this.scene.add(this.binMeshGroup);
    this.buildAcrylicBin();
  }

  // Build 5-sided acrylic bin with Cannon-es static boundaries and transparent Three.js mesh
  public buildAcrylicBin() {
    this.cleanUpBin();
    this.isShattered = false;

    const { width, height, depth, wallThick } = this.binDimensions;
    const { x, y, z } = this.binPos;
    const halfW = width / 2;
    const halfH = height / 2;
    const halfD = depth / 2;

    // 1. Static Cannon-es Boundaries (Bottom, Left, Right, Back, Front)
    const boundaries = [
      // Bottom
      {
        pos: new CANNON.Vec3(x, y - halfH, z),
        size: new CANNON.Vec3(halfW, wallThick / 2, halfD),
      },
      // Left (-X)
      {
        pos: new CANNON.Vec3(x - halfW, y, z),
        size: new CANNON.Vec3(wallThick / 2, halfH, halfD),
      },
      // Right (+X)
      {
        pos: new CANNON.Vec3(x + halfW, y, z),
        size: new CANNON.Vec3(wallThick / 2, halfH, halfD),
      },
      // Back (-Z)
      {
        pos: new CANNON.Vec3(x, y, z - halfD),
        size: new CANNON.Vec3(halfW, halfH, wallThick / 2),
      },
      // Front (+Z)
      {
        pos: new CANNON.Vec3(x, y, z + halfD),
        size: new CANNON.Vec3(halfW, halfH, wallThick / 2),
      },
    ];

    boundaries.forEach((b) => {
      const body = new CANNON.Body({
        mass: 0, // Static body
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(b.size),
      });
      body.position.copy(b.pos);
      this.world.addBody(body);
      this.binBodies.push(body);
    });

    // 2. Three.js Acrylic Meshes
    // Acrylic material specifications: opacity 0.35, roughness 0.1, transmission 0.9
    const acrylicMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.05,
      transmission: 0.9,
      ior: 1.45,
      thickness: 0.2,
      specularColor: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
    });

    // Glass panel meshes
    const panels = [
      // Bottom
      { size: [width, wallThick, depth], pos: [0, -halfH, 0] },
      // Left
      { size: [wallThick, height, depth], pos: [-halfW, 0, 0] },
      // Right
      { size: [wallThick, height, depth], pos: [halfW, 0, 0] },
      // Back
      { size: [width, height, wallThick], pos: [0, 0, -halfD] },
      // Front
      { size: [width, height, wallThick], pos: [0, 0, halfD] },
    ];

    panels.forEach((p) => {
      const geo = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
      const mesh = new THREE.Mesh(geo, acrylicMaterial);
      mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      this.binMeshGroup.add(mesh);

      // Cyber edge lines for high-tech aesthetic
      const edges = new THREE.EdgesGeometry(geo);
      const edgeLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
      );
      mesh.add(edgeLine);
    });

    // Add glowing capacity warning lines on the bin
    const levels = [
      { yRatio: 0.35, label: '15 ITEMS', color: 0x38bdf8 },
      { yRatio: 0.7, label: '28 ITEMS', color: 0xf59e0b },
      { yRatio: 0.92, label: '35 CRITICAL', color: 0xef4444 },
    ];

    levels.forEach((lvl) => {
      const markGeo = new THREE.BoxGeometry(width * 0.95, 0.02, depth * 0.95);
      const markEdges = new THREE.EdgesGeometry(markGeo);
      const markLine = new THREE.LineSegments(
        markEdges,
        new THREE.LineBasicMaterial({ color: lvl.color, transparent: true, opacity: 0.7 })
      );
      markLine.position.set(0, -halfH + height * lvl.yRatio, 0);
      this.binMeshGroup.add(markLine);
    });

    this.binMeshGroup.position.copy(this.binPos);
    this.binMeshGroup.visible = true;
  }

  // Remove bin boundaries and mesh
  private cleanUpBin() {
    this.binBodies.forEach((b) => this.world.removeBody(b));
    this.binBodies = [];

    while (this.binMeshGroup.children.length > 0) {
      const child = this.binMeshGroup.children[0];
      this.binMeshGroup.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }
  }

  // Spawn dynamic output tile with canvas-rendered text
  public spawnOutputTile(text: string): TileItem {
    if (this.isShattered) {
      // Auto-rebuild if someone keeps spawning after shatter
      this.buildAcrylicBin();
    }

    const { x, y, z } = this.binPos;
    const spawnY = y + this.binDimensions.height / 2 + 0.8;
    const jitterX = (Math.random() - 0.5) * 0.6;
    const jitterZ = (Math.random() - 0.5) * 0.6;

    // 1. Cannon-es rigid body (mass: 0.5)
    const shape = new CANNON.Box(new CANNON.Vec3(0.65 / 2, 0.2 / 2, 0.32 / 2));
    const body = new CANNON.Body({
      mass: 0.5,
      shape: shape,
      position: new CANNON.Vec3(x + jitterX, spawnY, z + jitterZ),
    });

    // Random initial tumble rotation & angular velocity
    body.quaternion.setFromEuler(
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4
    );
    body.angularVelocity.set(
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 3
    );

    this.world.addBody(body);

    // 2. Three.js Mesh with dynamic text texture
    const texture = this.createTileTextTexture(text);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }), // right
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }), // left
      new THREE.MeshStandardMaterial({
        map: texture,
        emissive: 0x0f172a,
        emissiveIntensity: 0.3,
        roughness: 0.3,
      }), // top
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }), // bottom
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }), // front
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }), // back
    ];

    const mesh = new THREE.Mesh(this.tileGeometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Highlight wireframe border
    const edgeLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.tileGeometry),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 })
    );
    mesh.add(edgeLines);

    const tileItem: TileItem = { mesh, body, text };
    this.tiles.push(tileItem);

    const count = this.tiles.length;
    this.onTileCountChange?.(count, this.MAX_CAPACITY);

    // Check Capacity & Shatter Event Trigger
    if (count > this.MAX_CAPACITY && !this.isShattered) {
      this.triggerShatterEvent();
    }

    return tileItem;
  }

  // Shatter Event: Remove boundaries & bin mesh, apply radial outward explosive impulse
  public triggerShatterEvent() {
    this.isShattered = true;

    // 1. Remove bin physics boundaries from CANNON.World
    this.binBodies.forEach((b) => this.world.removeBody(b));
    this.binBodies = [];

    // 2. Remove bin container mesh from the Three.js scene
    this.binMeshGroup.visible = false;

    // Spawn glass particle debris flash
    this.spawnShatterDebris();

    // 3. Apply radial outward explosive impulse to all accumulated tile bodies
    const binCenter = new CANNON.Vec3(this.binPos.x, this.binPos.y, this.binPos.z);
    const explosionForce = 5.2;

    this.tiles.forEach((tile) => {
      const pos = tile.body.position;
      const dirX = pos.x - binCenter.x + (Math.random() - 0.5) * 0.6;
      const dirY = pos.y - binCenter.y + Math.random() * 1.5 + 0.5; // strong upward burst
      const dirZ = pos.z - binCenter.z + (Math.random() - 0.5) * 0.6;

      const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;
      const impulse = new CANNON.Vec3(
        (dirX / len) * explosionForce * (0.8 + Math.random() * 0.6),
        (dirY / len) * (explosionForce + 3.0) * (0.8 + Math.random() * 0.6),
        (dirZ / len) * explosionForce * (0.8 + Math.random() * 0.6)
      );

      // Apply impulse slightly offset from center to induce chaotic spinning
      const hitPoint = new CANNON.Vec3(
        pos.x + (Math.random() - 0.5) * 0.2,
        pos.y + (Math.random() - 0.5) * 0.2,
        pos.z + (Math.random() - 0.5) * 0.2
      );

      tile.body.applyImpulse(impulse, hitPoint);
      tile.body.angularVelocity.set(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );
    });

    // 4. Fire Buffer Overflow Event
    this.onBufferOverflow?.();
  }

  // Visual burst of acrylic glass debris
  private spawnShatterDebris() {
    const shardCount = 28;
    const debrisGroup = new THREE.Group();
    this.scene.add(debrisGroup);

    const glassMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.9,
    });

    const shards: { mesh: THREE.Mesh; vel: THREE.Vector3; rot: THREE.Vector3 }[] = [];

    for (let i = 0; i < shardCount; i++) {
      const shardGeo = new THREE.TetrahedronGeometry(0.12 + Math.random() * 0.16);
      const shardMesh = new THREE.Mesh(shardGeo, glassMat);
      shardMesh.position.set(
        this.binPos.x + (Math.random() - 0.5) * this.binDimensions.width,
        this.binPos.y + (Math.random() - 0.5) * this.binDimensions.height,
        this.binPos.z + (Math.random() - 0.5) * this.binDimensions.depth
      );
      debrisGroup.add(shardMesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 6 + 3,
        (Math.random() - 0.5) * 8
      );
      const rot = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      shards.push({ mesh: shardMesh, vel, rot });
    }

    let progress = 0;
    const animateDebris = () => {
      progress += 0.03;
      shards.forEach((s) => {
        s.vel.y -= 9.82 * 0.02; // gravity
        s.mesh.position.addScaledVector(s.vel, 0.02);
        s.mesh.rotation.x += s.rot.x * 0.02;
        s.mesh.rotation.y += s.rot.y * 0.02;
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progress);
      });

      if (progress < 1.0) {
        requestAnimationFrame(animateDebris);
      } else {
        this.scene.remove(debrisGroup);
        shards.forEach((s) => s.mesh.geometry.dispose());
        glassMat.dispose();
      }
    };
    requestAnimationFrame(animateDebris);
  }

  // Create crisp off-screen canvas texture for tile top surface
  private createTileTextTexture(text: string): THREE.CanvasTexture {
    const cached = this.canvasTextureCache.get(text);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    // Tag badge
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(16, 16, 100, 32);
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('OUTPUT', 24, 40);

    // Output text
    ctx.font = 'bold 32px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    const cleanText = text.length > 18 ? text.slice(0, 16) + '…' : text;
    ctx.fillText(cleanText, 20, 115);

    // Timestamp / index
    ctx.font = '18px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`SEQ #${this.tiles.length + 1}`, 20, 160);

    const texture = new THREE.CanvasTexture(canvas);
    this.canvasTextureCache.set(text, texture);
    return texture;
  }

  // Step physics simulation and sync Three.js meshes
  public step(deltaTime: number) {
    // Cap step at 0.1s max as specified in prompt
    const dt = Math.min(deltaTime, 0.1);
    this.world.step(1 / 60, dt, 3);

    // Synchronize Three.js meshes with Cannon rigid bodies
    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      tile.mesh.position.copy(tile.body.position as unknown as THREE.Vector3);
      tile.mesh.quaternion.copy(tile.body.quaternion as unknown as THREE.Quaternion);
    }
  }

  // Reset/Clear physics world and all tiles
  public reset() {
    // Remove all tiles
    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      this.world.removeBody(tile.body);
      this.scene.remove(tile.mesh);
      if (tile.mesh.geometry) tile.mesh.geometry.dispose();
      if (Array.isArray(tile.mesh.material)) {
        tile.mesh.material.forEach((m) => m.dispose());
      }
    }
    this.tiles = [];

    // Rebuild acrylic bin
    this.buildAcrylicBin();
    this.onTileCountChange?.(0, this.MAX_CAPACITY);
  }

  public getTileCount(): number {
    return this.tiles.length;
  }

  public getIsShattered(): boolean {
    return this.isShattered;
  }

  public dispose() {
    this.reset();
    this.cleanUpBin();
    this.scene.remove(this.binMeshGroup);
  }
}
