import { useState } from 'react';
import { Lock, Star, Trophy, Swords, Timer, Skull } from 'lucide-react';
import { HEROES, MODES, STAGES, heroById, type Mode } from '../game/constants';
import { L, t, useLang, type Key } from '../game/i18n';
import { formatNum } from '../game/render';
import { load } from '../game/storage';
import { audio } from '../game/audio';
import { HeroPortrait } from './HeroPortrait';
import { Modal } from './ui';

export const MODE_ICON: Record<Mode, typeof Trophy> = { campaign: Trophy, versus: Swords, score: Timer, survival: Skull };
export const MODE_KEY: Record<Mode, Key> = { campaign: 'mCampaign', versus: 'mVersus', score: 'mScore', survival: 'mSurvival' };

export function ScoresModal({ onClose, initial = 'score' }: { onClose: () => void; initial?: Mode }) {
  useLang();
  const [mode, setMode] = useState<Mode>(initial);
  const list = load().scores[mode];
  const medal = ['text-[#ffd23f]', 'text-[#d6dcf5]', 'text-[#e0975a]'];
  return (
    <Modal title={t('scores')} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap gap-2">
        {MODES.map((m) => {
          const Icon = MODE_ICON[m];
          return (
            <button
              key={m}
              onClick={() => {
                audio.play('click');
                setMode(m);
              }}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                mode === m ? 'border-[#ffe66b] bg-[#ffe66b]/20 text-[#ffe66b]' : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <Icon size={16} /> {t(MODE_KEY[m])}
            </button>
          );
        })}
      </div>
      {list.length === 0 ? (
        <p className="py-10 text-center text-white/60">{t('noScores')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          {list.map((e, i) => (
            <div key={e.id} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 ? 'bg-white/[0.04]' : 'bg-white/[0.08]'}`}>
              <span className={`w-7 text-center text-xl font-bold ${medal[i] || 'text-white/50'}`}>{i + 1}</span>
              <HeroPortrait hero={heroById(e.hero as never)} size={36} />
              <span className="w-14 text-lg font-bold tracking-wider">{e.name}</span>
              <span className="flex-1 truncate text-sm text-white/55">{e.detail}</span>
              <span className="text-xl font-bold tabular-nums text-[#ffe66b]">{formatNum(e.score)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function HowToModal({ onClose }: { onClose: () => void }) {
  useLang();
  const rules: Key[] = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
  return (
    <Modal title={t('howto')} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold tracking-widest text-[#7fe9ff] uppercase">{t('rules')}</h3>
          <ol className="space-y-2.5">
            {rules.map((k, i) => (
              <li key={k} className="flex gap-3 text-[15px] leading-snug text-white/85">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffe66b] text-sm font-bold text-[#2a1060]">{i + 1}</span>
                <span>{t(k)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-bold tracking-widest text-[#7fe9ff] uppercase">{t('keyboard')}</h3>
            <ul className="space-y-1.5 rounded-2xl bg-white/5 p-3 text-sm text-white/85">
              {(['kbMove', 'kbRot', 'kbDrop', 'kbSkill', 'kbOther'] as Key[]).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold tracking-widest text-[#7fe9ff] uppercase">{t('touch')}</h3>
            <ul className="space-y-1.5 rounded-2xl bg-white/5 p-3 text-sm text-white/85">
              {(['tMove', 'tRot', 'tDrop', 'tSkill'] as Key[]).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <h3 className="mt-5 mb-2 text-sm font-bold tracking-widest text-[#7fe9ff] uppercase">{t('heroes')}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {HEROES.map((h) => (
          <div key={h.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5">
            <HeroPortrait hero={h} size={56} />
            <div className="text-sm leading-tight">
              <div className="font-bold" style={{ color: h.light }}>
                {h.name}
              </div>
              <div className="text-white/70">
                <b className="text-white/90">{L(h.passive.name)}:</b> {L(h.passive.desc)}
              </div>
              <div className="text-white/70">
                <b className="text-white/90">{L(h.active.name)}:</b> {L(h.active.desc)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function StagesModal({ onClose, onStart }: { onClose: () => void; onStart: (stage: number) => void }) {
  useLang();
  const s = load();
  return (
    <Modal title={t('select')} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAGES.map((st) => {
          const locked = st.id > s.unlocked;
          const rec = s.campaign[st.id];
          const hero = heroById(st.hero);
          const boss = st.id === STAGES.length;
          return (
            <button
              key={st.id}
              disabled={locked}
              onClick={() => {
                audio.play('click');
                onStart(st.id);
              }}
              className={`group relative flex flex-col items-center rounded-2xl border p-3 text-center transition ${
                locked ? 'cursor-not-allowed border-white/10 bg-white/[0.03] opacity-55' : 'border-white/20 bg-white/[0.07] hover:-translate-y-1 hover:bg-white/15'
              } ${boss ? 'ring-2 ring-[#ff4d6d]/60' : ''}`}
              style={!locked ? { boxShadow: `0 0 0 0 ${hero.color}`, borderColor: `rgba(${hero.rgb},0.5)` } : undefined}
            >
              <span className="absolute top-2 left-3 text-xs font-bold text-white/50">#{st.id}</span>
              <div className={locked ? 'opacity-30 grayscale' : ''}>
                <HeroPortrait hero={hero} size={84} />
              </div>
              <div className="text-lg leading-none font-bold">{st.name}</div>
              <div className="mt-1 min-h-8 text-xs leading-tight text-white/55">{L(st.tagline)}</div>
              <div className="mt-2 flex gap-0.5">
                {[1, 2, 3].map((i) => (
                  <Star key={i} size={16} className={rec && rec.stars >= i ? 'fill-[#ffd23f] text-[#ffd23f]' : 'text-white/25'} />
                ))}
              </div>
              {rec && <div className="mt-1 text-xs text-[#ffe66b] tabular-nums">{formatNum(rec.best)}</div>}
              {locked && <Lock className="absolute top-2 right-2 text-white/70" size={18} />}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
