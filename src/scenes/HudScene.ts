import Phaser from 'phaser';
import difficulty from '../config/difficulty.json';

const FONT = '"Trebuchet MS", sans-serif';

export class HudScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.scoreText = this.add
      .text(difficulty.worldWidth / 2, 64, '0', {
        fontFamily: FONT,
        fontSize: '56px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0a2e3d',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.bestText = this.add
      .text(difficulty.worldWidth - 14, 14, `best ${this.registry.get('best') ?? 0}`, {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#bfdde8',
        stroke: '#0a2e3d',
        strokeThickness: 4,
      })
      .setOrigin(1, 0)
      .setDepth(100);

    this.registry.events.on('changedata-score', this.onScore, this);
    this.registry.events.on('changedata-best', this.onBest, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-score', this.onScore, this);
      this.registry.events.off('changedata-best', this.onBest, this);
    });
  }

  private onScore(_parent: unknown, value: number): void {
    this.scoreText.setText(String(value));
    // Score pop juice.
    this.tweens.add({
      targets: this.scoreText,
      scale: { from: 1.35, to: 1 },
      duration: 160,
      ease: 'Back.easeOut',
    });
  }

  private onBest(_parent: unknown, value: number): void {
    this.bestText.setText(`best ${value}`);
  }
}
