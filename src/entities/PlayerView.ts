import Phaser from 'phaser';
import physics from '../config/physics.json';

/**
 * Thin render adapter: maps the headless sim's body state onto an animated
 * sprite. Rotation follows the velocity vector with a damped lerp (§4.1);
 * the swim cycle (A6) speeds up momentarily on each stroke.
 */
export class PlayerView {
  readonly sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, texture = 'seal') {
    this.sprite = scene.add.sprite(x, y, texture).setDepth(10);
    if (scene.anims.exists(`swim-${texture}`)) {
      this.sprite.play(`swim-${texture}`);
    }
  }

  update(x: number, y: number, vy: number, scrollSpeed: number): void {
    this.sprite.setPosition(x, y);
    const targetAngle = Phaser.Math.RadToDeg(Math.atan2(vy, scrollSpeed * 2));
    const clamped = Phaser.Math.Clamp(targetAngle, -physics.maxTiltDeg, physics.maxTiltDeg);
    this.sprite.angle += (clamped - this.sprite.angle) * physics.rotationLerp;
  }

  /** Tap juice: quick squash & stretch + a burst of swim-cycle speed. */
  pulse(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.12,
      scaleY: 0.88,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    if (this.sprite.anims.isPlaying) {
      this.sprite.anims.timeScale = 2.4;
      scene.time.delayedCall(380, () => {
        if (this.sprite.active && this.sprite.anims) this.sprite.anims.timeScale = 1;
      });
    }
  }
}
