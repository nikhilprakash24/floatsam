import Phaser from 'phaser';

const FONT = '"Trebuchet MS", sans-serif';

export interface ButtonOpts {
  width?: number;
  height?: number;
  fontSize?: number;
  variant?: 'primary' | 'ghost';
  accent?: number;
}

/**
 * A consistent, clearly-tappable button: rounded panel + centered label, with
 * hover and press feedback. `primary` is filled (calls to action); `ghost` is
 * an outlined panel (back / secondary). Returns the container so callers can
 * position or depth-sort it.
 */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 230;
  const h = opts.height ?? 56;
  const fs = opts.fontSize ?? 22;
  const accent = opts.accent ?? 0x1d8a77;
  const ghost = opts.variant === 'ghost';

  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (hover: boolean): void => {
    g.clear();
    if (ghost) {
      g.fillStyle(0x0a3142, hover ? 0.96 : 0.72);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      g.lineStyle(2.5, accent, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    } else {
      g.fillStyle(accent, hover ? 1 : 0.92);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      g.lineStyle(2, 0xffffff, hover ? 0.35 : 0.15);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    }
  };
  draw(false);

  const t = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${fs}px`,
      fontStyle: 'bold',
      color: ghost ? '#e8f6fb' : '#062028',
    })
    .setOrigin(0.5);

  c.add([g, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => draw(true));
  c.on('pointerout', () => draw(false));
  c.on(
    'pointerdown',
    (_p: Phaser.Input.Pointer, _x: number, _y: number, e?: Phaser.Types.Input.EventData) => {
      e?.stopPropagation();
      scene.tweens.add({ targets: c, scale: 0.95, duration: 70, yoyo: true });
      onClick();
    },
  );
  return c;
}

/** Standard back button, top-left, ghost style. */
export function makeBackButton(
  scene: Phaser.Scene,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Container {
  return makeButton(scene, 70, 32, label, onClick, {
    variant: 'ghost',
    width: 116,
    height: 40,
    fontSize: 17,
  });
}
