import Phaser from 'phaser';
import physics from '../config/physics.json';

/**
 * Thin render adapter: maps the headless sim's body state onto a sprite.
 * Rotation follows the velocity vector with a damped lerp (§4.1).
 */
export class PlayerView {
  readonly sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.image(x, y, 'seal').setDepth(10);
  }

  update(x: number, y: number, vy: number, scrollSpeed: number): void {
    this.sprite.setPosition(x, y);
    const targetAngle = Phaser.Math.RadToDeg(Math.atan2(vy, scrollSpeed * 2));
    const clamped = Phaser.Math.Clamp(targetAngle, -physics.maxTiltDeg, physics.maxTiltDeg);
    this.sprite.angle += (clamped - this.sprite.angle) * physics.rotationLerp;
  }

  /** Tap juice: quick squash & stretch. */
  pulse(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.12,
      scaleY: 0.88,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }
}
