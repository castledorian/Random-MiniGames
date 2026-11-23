import { useState, type ReactNode, type RefObject } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw, RotateCw, Zap } from 'lucide-react';
import type { Action, Game } from '../game/game';
import { t, useLang } from '../game/i18n';

interface PadProps {
  action: Action;
  getGame: () => Game | null;
  size: string;
  label: string;
  children: ReactNode;
}

function Pad({ action, getGame, size, label, children }: PadProps) {
  const [down, setDown] = useState(false);
  const up = () => {
    setDown(false);
    getGame()?.release(action);
  };
  return (
    <button
      type="button"
      aria-label={label}
      data-down={down}
      className="pad flex items-center justify-center rounded-[22%] text-white"
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        setDown(true);
        getGame()?.press(action);
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

interface ClusterProps {
  getGame: () => Game | null;
  size: string;
  skillRef: RefObject<HTMLDivElement | null>;
  heroColor: string;
}

export function LeftPad({ getGame, size, stacked }: Pick<ClusterProps, 'getGame' | 'size'> & { stacked?: boolean }) {
  useLang();
  const sz = '55%';
  const left = (
    <Pad action="left" getGame={getGame} size={size} label={t('cLeft')}>
      <ChevronLeft size={sz} strokeWidth={3} />
    </Pad>
  );
  const down = (
    <Pad action="down" getGame={getGame} size={size} label={t('cDown')}>
      <ChevronDown size={sz} strokeWidth={3} />
    </Pad>
  );
  const right = (
    <Pad action="right" getGame={getGame} size={size} label={t('cRight')}>
      <ChevronRight size={sz} strokeWidth={3} />
    </Pad>
  );
  if (stacked) {
    // compact two-row cluster for landscape phones: ◀ ▶ on top, ▼ below
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-2">
          {left}
          {right}
        </div>
        {down}
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      {left}
      {down}
      {right}
    </div>
  );
}

export function RightPad({ getGame, size, skillRef, heroColor }: ClusterProps) {
  useLang();
  const [down, setDown] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      <div
        ref={skillRef}
        className="skill-pad rounded-full p-[5px]"
        data-ready="false"
        style={{ width: `calc(${size} * 1.12)`, height: `calc(${size} * 1.12)`, ['--hc' as string]: heroColor }}
      >
        <button
          type="button"
          aria-label={t('cSkill')}
          data-down={down}
          className="pad flex h-full w-full items-center justify-center rounded-full bg-[#2a1670] text-white"
          style={{ background: '#2a1670' }}
          onPointerDown={(e) => {
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            setDown(true);
            getGame()?.press('skill');
          }}
          onPointerUp={() => setDown(false)}
          onPointerCancel={() => setDown(false)}
          onLostPointerCapture={() => setDown(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Zap size="52%" strokeWidth={2.5} fill={heroColor} color={heroColor} />
        </button>
      </div>
      <div className="flex gap-2">
        <Pad action="rotCCW" getGame={getGame} size={size} label={t('cRotL')}>
          <RotateCcw size="52%" strokeWidth={3} />
        </Pad>
        <Pad action="rotCW" getGame={getGame} size={size} label={t('cRotR')}>
          <RotateCw size="52%" strokeWidth={3} />
        </Pad>
      </div>
    </div>
  );
}
