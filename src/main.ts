import Phaser from 'phaser';
import difficulty from './config/difficulty.json';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { GameOverScene } from './scenes/GameOverScene';
import { PauseScene } from './scenes/PauseScene';
import { SandboxScene } from './scenes/SandboxScene';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: difficulty.worldWidth,
  height: difficulty.worldHeight,
  backgroundColor: '#0b3d4f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  // Arcade stays registered for §2 stack parity, but all gameplay physics is
  // the custom fluid core — see src/core/fluid.
  physics: { default: 'arcade' },
  scene: [BootScene, MenuScene, GameScene, HudScene, GameOverScene, PauseScene, SandboxScene],
});
