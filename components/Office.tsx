'use client';

import { useOffice } from '@/lib/store';
import DialogBox from './DialogBox';
import GameCanvas from './GameCanvas';
import Hud from './Hud';
import ModalHost from './ModalHost';
import StartScreen from './StartScreen';
import TeamPanel from './TeamPanel';
import ZoneBanner from './ZoneBanner';

export default function Office() {
  const started = useOffice(s => s.started);
  const talking = useOffice(s => s.dialog !== null);

  return (
    <>
      <GameCanvas />
      {started && <Hud />}
      <ZoneBanner />
      <TeamPanel />
      {started && !talking && (
        <p id="hint">
          <kbd>WASD</kbd> walk · <kbd>Shift</kbd> run · <kbd>E</kbd> talk · click to walk
        </p>
      )}
      <DialogBox />
      <ModalHost />
      {!started && <StartScreen />}
    </>
  );
}
