import * as THREE from 'three';
import gsap from 'gsap';

export type PersonalityMode = 'quirky' | 'serious';

const QUIRKY_ROASTS = [
  "Congrats! You just melted the heap with that loop, absolute prodigy. 🔥",
  "Buffer overflowed harder than my weekend sleep schedule. 💀",
  "Bro cooked so hard the garbage collector resigned with immediate effect. 🧑‍🍳",
  "Have you considered turning the computer off and touching some grass? 🌱",
  "10/10 chaos. The CPU is currently applying for hazard pay. 📉",
  "Stack trace? More like stack trainwreck. Elite engineering. 🚂💥",
  "Infinite loop detected! Enjoy your complimentary heating device. ♨️",
  "O(n!) complexity speedrun completed. Your RAM is crying. 😭",
];

const SERIOUS_RESPONSES = [
  "Error 0xDEADBEEF: Unqualified user detected. Skill issue.",
  "Have you tried reading documentation? Section 42.1 clearly prohibits whatever that was.",
  "Ticket #84912 closed as NOT A BUG: Working as intended by design committee.",
  "Architecture degraded to amateur tier. Escalating incident to Senior Management.",
  "Heap exhausted: Compliance violation under Enterprise Guideline ISO-9001-FAIL.",
  "Consult internal wiki regarding 'How to write loops that actually terminate'.",
  "Action rejected: Enterprise policy prohibits chaotic block manipulation in production.",
];

export class BillboardOverlay {
  public mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private mode: PersonalityMode = 'quirky';
  private visible: boolean = false;
  private currentTitle: string = '';
  private currentMessage: string = '';
  private isLoadingSpinner: boolean = false;
  private spinnerAngle: number = 0;
  private spinnerStartTime: number = 0;
  private dismissTimeout: any = null;
  private pendingSeriousMsg: string = '';

  constructor() {
    // High-resolution off-screen canvas for crisp rendering
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 576;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create 2D canvas context for billboard');
    this.ctx = ctx;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // Plane geometry positioned in camera local space
    // Scale: approx 1.6 x 0.9 units (16:9 aspect ratio)
    const geometry = new THREE.PlaneGeometry(1.6, 0.9);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    // Position directly in front of camera at z = -1.5
    this.mesh.position.set(0, 0, -1.5);
    this.mesh.scale.set(0.001, 0.001, 0.001);
    this.mesh.renderOrder = 999; // Always render on top

    this.renderCanvas();
  }

  public setMode(mode: PersonalityMode) {
    this.mode = mode;
    if (this.visible) {
      this.renderCanvas();
    }
  }

  public getMode(): PersonalityMode {
    return this.mode;
  }

  public show(customMessage?: string, customTitle?: string) {
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
      this.dismissTimeout = null;
    }

    if (this.mode === 'quirky') {
      this.isLoadingSpinner = false;
      this.currentTitle = customTitle || '💥 BUFFER OVERFLOW ROAST';
      this.currentMessage =
        customMessage ||
        QUIRKY_ROASTS[Math.floor(Math.random() * QUIRKY_ROASTS.length)];
      this.animateIn(4500);
    } else {
      // Serious Study Mode: 3-second fake loading spinner then unhelpful rage-bait
      this.isLoadingSpinner = true;
      this.spinnerAngle = 0;
      this.spinnerStartTime = performance.now();
      this.currentTitle = 'ENTERPRISE AUDIT KNOWLEDGE BASE';
      this.currentMessage = 'Consulting Enterprise Knowledge Base [v9.4.2]...';
      this.pendingSeriousMsg =
        customMessage ||
        SERIOUS_RESPONSES[Math.floor(Math.random() * SERIOUS_RESPONSES.length)];

      this.animateIn(7500);

      // After 3 seconds, reveal rage-bait response
      setTimeout(() => {
        if (this.visible && this.isLoadingSpinner) {
          this.isLoadingSpinner = false;
          this.currentTitle = 'ENTERPRISE RUNTIME AUDIT REPORT';
          this.currentMessage = this.pendingSeriousMsg;
          this.renderCanvas();
        }
      }, 3000);
    }
  }

  private animateIn(durationMs: number) {
    this.visible = true;
    const material = this.mesh.material as THREE.MeshBasicMaterial;
    material.opacity = 1;
    this.renderCanvas();

    // GSAP scale and bounce in (scale: 0 -> 1 with elastic.out(1, 0.4))
    gsap.killTweensOf(this.mesh.scale);
    gsap.fromTo(
      this.mesh.scale,
      { x: 0.01, y: 0.01, z: 0.01 },
      {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.8,
        ease: 'elastic.out(1, 0.4)',
      }
    );

    // Auto-dismiss after duration
    this.dismissTimeout = setTimeout(() => {
      this.dismiss();
    }, durationMs);
  }

  public dismiss() {
    if (!this.visible) return;

    gsap.to(this.mesh.scale, {
      x: 0.01,
      y: 0.01,
      z: 0.01,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        this.visible = false;
        this.isLoadingSpinner = false;
        const material = this.mesh.material as THREE.MeshBasicMaterial;
        material.opacity = 0;
      },
    });
  }

  public update(delta: number) {
    if (this.visible && this.isLoadingSpinner) {
      this.spinnerAngle += delta * 6.0;
      this.renderCanvas();
    }
  }

  private renderCanvas() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (this.mode === 'quirky') {
      this.renderQuirkyStyle(ctx, w, h);
    } else {
      this.renderSeriousStyle(ctx, w, h);
    }

    this.texture.needsUpdate = true;
  }

  private renderQuirkyStyle(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Vibrant comic / pop-art card styling
    const pad = 24;

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    this.drawRoundedRect(ctx, pad + 16, pad + 16, w - pad * 2, h - pad * 2, 28);
    ctx.fill();

    // Comic border & background
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#ffe57f');
    gradient.addColorStop(0.5, '#ff80ab');
    gradient.addColorStop(1, '#8c9eff');

    ctx.fillStyle = gradient;
    this.drawRoundedRect(ctx, pad, pad, w - pad * 2, h - pad * 2, 28);
    ctx.fill();

    // Inner card
    ctx.fillStyle = '#18122B';
    this.drawRoundedRect(ctx, pad + 8, pad + 8, w - pad * 2 - 16, h - pad * 2 - 16, 22);
    ctx.fill();

    // Comic header badge
    ctx.fillStyle = '#ff4081';
    this.drawRoundedRect(ctx, pad + 32, pad + 28, 420, 52, 14);
    ctx.fill();

    ctx.font = '900 24px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.currentTitle, pad + 50, pad + 64);

    // Quirky Mode pill
    ctx.fillStyle = '#00e676';
    this.drawRoundedRect(ctx, w - pad - 230, pad + 28, 190, 48, 24);
    ctx.fill();

    ctx.font = '800 18px "Inter", sans-serif';
    ctx.fillStyle = '#0a2e12';
    ctx.fillText('⚡ QUIRKY ROAST', w - pad - 215, pad + 60);

    // Message text bubble
    ctx.fillStyle = '#251b3e';
    this.drawRoundedRect(ctx, pad + 32, pad + 104, w - pad * 2 - 64, h - pad * 2 - 140, 18);
    ctx.fill();

    // Large comic roast message
    ctx.font = '700 36px "Inter", "Comic Sans MS", cursive, sans-serif';
    ctx.fillStyle = '#ffffff';
    this.wrapText(
      ctx,
      `"${this.currentMessage}"`,
      pad + 64,
      pad + 175,
      w - pad * 2 - 128,
      48
    );

    // Footer punchline
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ff80ab';
    ctx.fillText('💥 GestureBlocks AR • Chaos Visualizer Engine v2.0', pad + 64, h - pad - 54);
  }

  private renderSeriousStyle(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const pad = 24;

    // Dark slate enterprise terminal background (#111827)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.drawRoundedRect(ctx, pad + 12, pad + 12, w - pad * 2, h - pad * 2, 16);
    ctx.fill();

    ctx.fillStyle = '#111827';
    this.drawRoundedRect(ctx, pad, pad, w - pad * 2, h - pad * 2, 16);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Terminal top bar
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(pad, pad, w - pad * 2, 60);

    // Terminal window dots
    const dots = ['#ef4444', '#f59e0b', '#10b981'];
    dots.forEach((color, i) => {
      ctx.beginPath();
      ctx.arc(pad + 30 + i * 26, pad + 30, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // Terminal title
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('root@enterprise-ar-core: /var/log/audit.log', pad + 120, pad + 38);

    // Serious Study mode badge
    ctx.fillStyle = '#374151';
    this.drawRoundedRect(ctx, w - pad - 260, pad + 14, 230, 34, 6);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText('MODE: SERIOUS AUDIT', w - pad - 245, pad + 37);

    // Terminal content body
    ctx.fillStyle = '#030712';
    this.drawRoundedRect(ctx, pad + 24, pad + 84, w - pad * 2 - 48, h - pad * 2 - 110, 10);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (this.isLoadingSpinner) {
      // 3-second fake loading spinner
      const centerX = w / 2;
      const centerY = h / 2 + 10;
      const radius = 38;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(this.spinnerAngle);

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 1.5);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      ctx.font = 'bold 24px "JetBrains Mono", monospace';
      ctx.fillStyle = '#22c55e';
      ctx.textAlign = 'center';
      ctx.fillText('CONSULTING ENTERPRISE KNOWLEDGE BASE...', centerX, centerY + 85);
      ctx.font = '16px "JetBrains Mono", monospace';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('[IEEE-754 / ISO-9001 Protocol Verification in Progress]', centerX, centerY + 115);
      ctx.textAlign = 'left';
    } else {
      // Terminal prompt and rage-bait error
      ctx.font = 'bold 22px "JetBrains Mono", monospace';
      ctx.fillStyle = '#22c55e';
      ctx.fillText('$ ar-trace --inspect --pedantic', pad + 48, pad + 130);

      // Warning box
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      this.drawRoundedRect(ctx, pad + 48, pad + 155, w - pad * 2 - 96, 170, 8);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 28px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('FATAL EXCEPTION:', pad + 72, pad + 205);

      ctx.font = 'bold 24px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fca5a5';
      this.wrapText(ctx, this.currentMessage, pad + 72, pad + 250, w - pad * 2 - 150, 36);

      // Diagnostic footer
      ctx.font = '15px "JetBrains Mono", monospace';
      ctx.fillStyle = '#4b5563';
      ctx.fillText('STATUS: WONTFIX • SEVERITY: USER_COMPETENCY • REF: 0xDEADBEEF', pad + 48, h - pad - 42);
    }
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const words = text.split(' ');
    let line = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  public dispose() {
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
    }
    this.texture.dispose();
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
