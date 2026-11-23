import { useEffect, useState, type ReactNode } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { audio } from '../game/audio';
import { t, useLang } from '../game/i18n';

export function useTouch(): boolean {
  const [touch, setTouch] = useState(() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (touch) return;
    const on = () => setTouch(true);
    window.addEventListener('touchstart', on, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', on);
  }, [touch]);
  return touch;
}

export function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return vp;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useLang();
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onClick={onClose}>
      <div
        className={`panel animate-pop flex max-h-[92vh] w-full flex-col rounded-3xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="text-2xl font-bold tracking-wide text-[#ffe66b]">{title}</h2>
          <button
            aria-label={t('close')}
            onClick={() => {
              audio.play('click');
              onClose();
            }}
            className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function SoundToggles({ className = '' }: { className?: string }) {
  useLang();
  const [sfx, setSfx] = useState(audio.sfxOn);
  const [mus, setMus] = useState(audio.musicOn);
  const base = 'flex h-9 min-w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 px-2 text-sm font-bold transition hover:bg-white/20';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        aria-label={t('sound')}
        title={t('sound')}
        className={`${base} ${sfx ? '' : 'opacity-50'}`}
        onClick={() => {
          audio.init();
          audio.setSfx(!sfx);
          setSfx(!sfx);
          if (!sfx) audio.play('click');
        }}
      >
        <SpeakerIcon on={sfx} />
      </button>
      <button
        aria-label={t('music')}
        title={t('music')}
        className={`${base} text-lg ${mus ? '' : 'opacity-50 line-through'}`}
        onClick={() => {
          audio.init();
          audio.setMusic(!mus);
          setMus(!mus);
        }}
      >
        ♪
      </button>
    </div>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  return on ? <Volume2 size={18} /> : <VolumeX size={18} />;
}
