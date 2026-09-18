import * as THREE from 'three';
import gsap from 'gsap';

export type BlockType = 'FOR' | 'PRINT' | 'VAR' | 'IF';

export interface BlockSocket {
  id: string;
  localPosition: THREE.Vector3;
  targetType: BlockType;
  mesh: THREE.Mesh;
  connectedBlockId: string | null;
}

export interface SpatialBlock {
  id: string;
  type: BlockType;
  group: THREE.Group;
  mesh: THREE.Mesh;
  label: string;
  color: number;
  initialPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  isDragging: boolean;
  isHovered: boolean;
  snappedToSocketId: string | null;
  sockets: BlockSocket[];
  edgeLines: THREE.LineSegments;
}

export interface SpatialBlockManagerOptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  onSnapChange?: (isNested: boolean, parentBlock?: SpatialBlock, childBlock?: SpatialBlock) => void;
  onBlockPicked?: (block: SpatialBlock) => void;
}

export class SpatialBlockManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private blocks: Map<string, SpatialBlock> = new Map();
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private dragPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private dragIntersection: THREE.Vector3 = new THREE.Vector3();
  private draggedBlock: SpatialBlock | null = null;
  private hoveredBlock: SpatialBlock | null = null;
  private onSnapChange?: (isNested: boolean, parentBlock?: SpatialBlock, childBlock?: SpatialBlock) => void;
  private onBlockPicked?: (block: SpatialBlock) => void;

  public forBlock: SpatialBlock | null = null;
  public printBlock: SpatialBlock | null = null;

  constructor(options: SpatialBlockManagerOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.onSnapChange = options.onSnapChange;
    this.onBlockPicked = options.onBlockPicked;

    this.initDefaultBlocks();
  }

  // Create default interactive blocks: FOR loop block, PRINT statement block, VAR block, IF block
  public initDefaultBlocks() {
    this.clear();

    // 1. FOR Loop Block (Header & Container Socket)
    this.forBlock = this.createBlock({
      id: 'block-for-1',
      type: 'FOR',
      label: 'for i in range(∞):',
      color: 0x0284c7, // Sky Blue
      size: [3.8, 1.4, 0.4],
      position: new THREE.Vector3(-3.5, 3.2, 0),
      hasSocket: true,
      socketOffset: new THREE.Vector3(0.5, -1.2, 0),
    });

    // 2. PRINT Block (Statement)
    this.printBlock = this.createBlock({
      id: 'block-print-1',
      type: 'PRINT',
      label: 'print("🔥 OVERFLOW!")',
      color: 0x059669, // Emerald Green
      size: [3.4, 1.0, 0.38],
      position: new THREE.Vector3(-3.5, 0.5, 0),
      hasSocket: false,
    });

    // 3. VARIABLE Block
    this.createBlock({
      id: 'block-var-1',
      type: 'VAR',
      label: 'heap_size += 1',
      color: 0xd97706, // Amber
      size: [3.0, 0.9, 0.35],
      position: new THREE.Vector3(-8.2, 3.2, 0),
      hasSocket: false,
    });

    // 4. IF Condition Block
    this.createBlock({
      id: 'block-if-1',
      type: 'IF',
      label: 'if heap_size > 35:',
      color: 0x7c3aed, // Purple
      size: [3.2, 0.9, 0.35],
      position: new THREE.Vector3(-8.2, 0.8, 0),
      hasSocket: false,
    });
  }

  private createBlock(config: {
    id: string;
    type: BlockType;
    label: string;
    color: number;
    size: [number, number, number];
    position: THREE.Vector3;
    hasSocket: boolean;
    socketOffset?: THREE.Vector3;
  }): SpatialBlock {
    const group = new THREE.Group();
    group.position.copy(config.position);

    const [w, h, d] = config.size;
    const geometry = new THREE.BoxGeometry(w, h, d);

    // Dynamic canvas texture with syntax and block styling
    const texture = this.createBlockTexture(config.type, config.label, config.color);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }), // right
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }), // left
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }), // top
      new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 0.5 }), // bottom
      new THREE.MeshStandardMaterial({
        map: texture,
        emissive: config.color,
        emissiveIntensity: 0.15,
        roughness: 0.3,
        metalness: 0.2,
      }), // front face
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }), // back
    ];

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (mesh as any).blockId = config.id;
    group.add(mesh);

    // Edge glowing line
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.7,
        linewidth: 2,
      })
    );
    mesh.add(edgeLines);

    // Sockets if applicable
    const sockets: BlockSocket[] = [];
    if (config.hasSocket && config.socketOffset) {
      const socketGeo = new THREE.BoxGeometry(w * 0.9, 0.4, d * 1.1);
      const socketMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      });
      const socketMesh = new THREE.Mesh(socketGeo, socketMat);
      socketMesh.position.copy(config.socketOffset);
      group.add(socketMesh);

      // Glowing socket connector label
      const socketId = `${config.id}-socket-child`;
      sockets.push({
        id: socketId,
        localPosition: config.socketOffset.clone(),
        targetType: 'PRINT',
        mesh: socketMesh,
        connectedBlockId: null,
      });
    }

    this.scene.add(group);

    const block: SpatialBlock = {
      id: config.id,
      type: config.type,
      group,
      mesh,
      label: config.label,
      color: config.color,
      initialPos: config.position.clone(),
      targetPos: config.position.clone(),
      isDragging: false,
      isHovered: false,
      snappedToSocketId: null,
      sockets,
      edgeLines,
    };

    this.blocks.set(config.id, block);
    return block;
  }

  private createBlockTexture(type: BlockType, label: string, colorHex: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Gradient background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer border
    const hexStr = `#${colorHex.toString(16).padStart(6, '0')}`;
    ctx.strokeStyle = hexStr;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // Type Badge
    ctx.fillStyle = hexStr;
    ctx.fillRect(16, 16, 90, 36);
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(type, 26, 42);

    // Magnetic connector icon
    ctx.fillStyle = '#64748b';
    ctx.font = '16px "JetBrains Mono", monospace';
    ctx.fillText('SNAP-SOCKET ⎘', canvas.width - 160, 40);

    // Code Label Text
    ctx.font = 'bold 32px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, 20, 115);

    // Decorative syntax dots
    ctx.fillStyle = hexStr;
    ctx.beginPath();
    ctx.arc(36, 155, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('AST::EXEC_NODE', 52, 160);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  // Update hover state and raycasting from NDC coordinate
  public updatePointer(ndc: { x: number; y: number }) {
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);

    if (this.draggedBlock) {
      // Raycast against the dragging plane
      this.dragPlane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 0, 1),
        this.draggedBlock.group.position
      );

      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragIntersection)) {
        // Smoothly follow hand / mouse
        this.draggedBlock.targetPos.copy(this.dragIntersection);
      }

      // Check proximity to available sockets
      this.checkSocketProximity(this.draggedBlock);
    } else {
      // Find hovered block
      const meshes: THREE.Mesh[] = [];
      this.blocks.forEach((b) => meshes.push(b.mesh));

      const intersects = this.raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const blockId = (hitMesh as any).blockId;
        const block = this.blocks.get(blockId);

        if (block && this.hoveredBlock !== block) {
          if (this.hoveredBlock) this.setBlockHover(this.hoveredBlock, false);
          this.hoveredBlock = block;
          this.setBlockHover(block, true);
        }
      } else if (this.hoveredBlock) {
        this.setBlockHover(this.hoveredBlock, false);
        this.hoveredBlock = null;
      }
    }
  }

  private setBlockHover(block: SpatialBlock, hover: boolean) {
    block.isHovered = hover;
    const lineMat = block.edgeLines.material as THREE.LineBasicMaterial;
    gsap.to(lineMat, {
      opacity: hover ? 1.0 : 0.6,
      duration: 0.2,
    });
    gsap.to(block.group.scale, {
      x: hover ? 1.05 : 1.0,
      y: hover ? 1.05 : 1.0,
      z: hover ? 1.05 : 1.0,
      duration: 0.2,
    });
  }

  // Check proximity of dragged block to target sockets (< 1.0 unit threshold)
  private checkSocketProximity(block: SpatialBlock) {
    if (block.type !== 'PRINT' || !this.forBlock) return;

    for (const socket of this.forBlock.sockets) {
      const socketWorldPos = socket.localPosition.clone().add(this.forBlock.group.position);
      const dist = block.group.position.distanceTo(socketWorldPos);

      const mat = socket.mesh.material as THREE.MeshBasicMaterial;
      if (dist < 1.0) {
        // Within snap threshold: pulse glowing socket
        mat.color.setHex(0x3ecf8e); // Green ready to snap
        mat.opacity = 0.9;
      } else {
        mat.color.setHex(0x38bdf8); // Sky blue idle
        mat.opacity = 0.4;
      }
    }
  }

  // Handle pinch / grab start
  public handlePinchStart(ndc: { x: number; y: number }): SpatialBlock | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);
    const meshes: THREE.Mesh[] = [];
    this.blocks.forEach((b) => meshes.push(b.mesh));

    const intersects = this.raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const blockId = (hitMesh as any).blockId;
      const block = this.blocks.get(blockId);

      if (block) {
        this.draggedBlock = block;
        block.isDragging = true;

        // If previously snapped, detach
        if (block.snappedToSocketId) {
          this.detachBlockFromSocket(block);
        }

        // Lift effect
        gsap.to(block.group.position, {
          z: block.initialPos.z + 0.4,
          duration: 0.15,
        });

        this.onBlockPicked?.(block);
        return block;
      }
    }
    return null;
  }

  // Handle pinch / grab release
  public handlePinchEnd(ndc: { x: number; y: number }): boolean {
    if (!this.draggedBlock) return false;

    const block = this.draggedBlock;
    block.isDragging = false;
    this.draggedBlock = null;

    let didSnap = false;

    // Check proximity to FOR block socket (< 1.0 threshold)
    if (block.type === 'PRINT' && this.forBlock) {
      for (const socket of this.forBlock.sockets) {
        const socketWorldPos = socket.localPosition.clone().add(this.forBlock.group.position);
        const dist = block.group.position.distanceTo(socketWorldPos);

        if (dist < 1.0) {
          // MAGNETIC SNAPPING EVENT!
          this.snapBlockToSocket(block, socket, this.forBlock);
          didSnap = true;
          break;
        }
      }
    }

    if (!didSnap) {
      // Smooth return or settle
      gsap.to(block.group.position, {
        z: block.initialPos.z,
        duration: 0.25,
      });
    }

    return didSnap;
  }

  // Programmatically snap PRINT into FOR (e.g. from UI button)
  public snapPrintToFor() {
    if (!this.printBlock || !this.forBlock) return;
    const socket = this.forBlock.sockets[0];
    if (!socket) return;

    this.snapBlockToSocket(this.printBlock, socket, this.forBlock);
  }

  // Magnetic Snapping Implementation with GSAP feedback
  private snapBlockToSocket(childBlock: SpatialBlock, socket: BlockSocket, parentBlock: SpatialBlock) {
    childBlock.snappedToSocketId = socket.id;
    socket.connectedBlockId = childBlock.id;

    const snapTarget = socket.localPosition.clone().add(parentBlock.group.position);

    // GSAP Magnetic Snapping Animation
    gsap.to(childBlock.group.position, {
      x: snapTarget.x,
      y: snapTarget.y,
      z: snapTarget.z,
      duration: 0.35,
      ease: 'back.out(1.7)',
    });

    // Visual connection feedback: glow pulse
    const lineMat = childBlock.edgeLines.material as THREE.LineBasicMaterial;
    gsap.fromTo(
      lineMat.color,
      { r: 0.2, g: 0.9, b: 0.5 },
      { r: 0.05, g: 0.6, b: 0.4, duration: 0.8 }
    );

    // Socket green highlight
    const socketMat = socket.mesh.material as THREE.MeshBasicMaterial;
    socketMat.color.setHex(0x3ecf8e);
    socketMat.opacity = 0.8;

    this.onSnapChange?.(true, parentBlock, childBlock);
  }

  // Detach block from socket
  public detachBlockFromSocket(childBlock: SpatialBlock) {
    if (!childBlock.snappedToSocketId) return;

    if (this.forBlock) {
      for (const s of this.forBlock.sockets) {
        if (s.connectedBlockId === childBlock.id) {
          s.connectedBlockId = null;
          const socketMat = s.mesh.material as THREE.MeshBasicMaterial;
          socketMat.color.setHex(0x38bdf8);
          socketMat.opacity = 0.4;
        }
      }
    }

    childBlock.snappedToSocketId = null;
    this.onSnapChange?.(false, this.forBlock ?? undefined, childBlock);
  }

  // Frame tick to interpolate dragged blocks
  public update(delta: number) {
    if (this.draggedBlock) {
      this.draggedBlock.group.position.lerp(this.draggedBlock.targetPos, 0.2);
    }
  }

  public getIsPrintNestedInFor(): boolean {
    if (!this.printBlock || !this.forBlock) return false;
    return !!this.printBlock.snappedToSocketId;
  }

  public clear() {
    this.blocks.forEach((b) => {
      this.scene.remove(b.group);
      if (b.mesh.geometry) b.mesh.geometry.dispose();
    });
    this.blocks.clear();
    this.draggedBlock = null;
    this.hoveredBlock = null;
    this.forBlock = null;
    this.printBlock = null;
  }
}
