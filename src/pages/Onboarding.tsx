import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useSettings } from '../store/settings';
import { ALL_CATEGORIES } from '../lib/defaults';
import { CATEGORY_META } from '../lib/catalog';
import type { Category } from '../lib/types';
import { Logo } from '../components/layout/Shell';
import { Button, cx, FieldError, Segmented } from '../components/ui/primitives';

export default function Onboarding() {
  const { settings, update, t } = useSettings();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.name);
  const [nameErr, setNameErr] = useState('');
  const [picked, setPicked] = useState<Category[]>(settings.favoriteCategories);
  const [catErr, setCatErr] = useState('');

  const finish = async () => {
    if (!picked.length) return setCatErr(t('onb_pick_err'));
    await update({ name: name.trim(), favoriteCategories: picked, onboarded: true });
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-bg">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute -bottom-40 -end-20 h-[380px] w-[380px] rounded-full bg-accent2/15 blur-[120px]" />
      </div>
      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-[max(24px,var(--safe-bottom))] pt-[max(24px,var(--safe-top))]">
        <div className="flex items-center justify-between">
          <Logo />
          <Segmented
            value={settings.language}
            onChange={(language) => update({ language })}
            options={[
              { value: 'en', label: 'EN' },
              { value: 'he', label: 'עב' },
            ]}
          />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <svg viewBox="0 0 320 80" className="mb-8 w-full" aria-hidden>
                  <defs>
                    <linearGradient id="pg" x1="0" x2="1">
                      <stop offset="0" stopColor="rgb(var(--accent))" />
                      <stop offset="1" stopColor="rgb(var(--accent-2))" />
                    </linearGradient>
                  </defs>
                  <path d="M0 40h90l14-26 22 52 18-40 12 14h164" fill="none" stroke="url(#pg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="420" className="animate-[pulseline_2.2s_ease-out_forwards]" style={{ strokeDashoffset: 420 }} />
                </svg>
                <h1 className="font-display text-[44px] font-bold leading-[1.02] text-ink">
                  {t('onb_title_1')}
                  <br />
                  <span className="text-gradient">{t('onb_title_2')}</span>
                </h1>
                <p className="mt-4 text-[16px] leading-relaxed text-muted">{t('onb_body')}</p>
              </motion.div>
            )}
            {step === 1 && (
              <motion.form
                key="s1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim().length > 30) return setNameErr(t('name_err_long'));
                  setStep(2);
                }}
              >
                <h2 className="font-display text-3xl font-bold text-ink">{t('onb_name_title')}</h2>
                <p className="mt-2 text-[15px] text-muted">{t('onb_name_body')}</p>
                <input
                  className="input mt-6 h-14 text-lg"
                  value={name}
                  autoFocus
                  maxLength={40}
                  autoComplete="given-name"
                  placeholder={t('name_placeholder')}
                  aria-label={t('name_label')}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameErr('');
                  }}
                />
                <FieldError>{nameErr}</FieldError>
                <button type="submit" className="hidden" />
              </motion.form>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <h2 className="font-display text-3xl font-bold text-ink">{t('onb_pick_title')}</h2>
                <p className="mt-2 text-[15px] text-muted">{t('onb_pick_body')}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {ALL_CATEGORIES.map((c) => {
                    const on = picked.includes(c);
                    const M = CATEGORY_META[c];
                    return (
                      <button
                        key={c}
                        aria-pressed={on}
                        onClick={() => {
                          setPicked((p) => (on ? p.filter((x) => x !== c) : [...p, c]));
                          setCatErr('');
                        }}
                        className={cx('relative flex h-28 flex-col justify-between rounded-3xl border p-4 text-start transition active:scale-95', on ? 'border-transparent' : 'hairline bg-surface')}
                        style={on ? { background: `linear-gradient(140deg, hsl(${M.hue} 85% 55% / 0.35), hsl(${M.hue + 40} 85% 45% / 0.15))`, boxShadow: `0 0 0 1.5px ${M.color}` } : undefined}
                      >
                        <M.icon className="h-6 w-6" style={{ color: M.color }} />
                        <span className="text-[15px] font-semibold text-ink">{t(M.label)}</span>
                        {on && (
                          <span className="absolute end-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black">
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <FieldError>{catErr}</FieldError>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-3">
          <div className="flex justify-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-accent' : 'w-1.5 bg-faint/40')} />
            ))}
          </div>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => {
              if (step === 1 && name.trim().length > 30) return setNameErr(t('name_err_long'));
              if (step < 2) setStep(step + 1);
              else void finish();
            }}
          >
            {step === 2 ? t('onb_start') : t('onb_continue')}
            <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          </Button>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="w-full py-2 text-[14px] font-semibold text-muted">
              {t('back')}
            </button>
          )}
          {step === 0 && (
            <button onClick={() => void update({ onboarded: true })} className="w-full py-2 text-[14px] font-semibold text-muted">
              {t('onb_skip')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
