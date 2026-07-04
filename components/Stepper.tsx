export type StepId = 'details' | 'consent' | 'otp';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'consent', label: 'Consent' },
  { id: 'otp', label: 'OTP' },
];

export default function Stepper({ current }: { current: StepId }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
      {STEPS.map((step, i) => {
        const state =
          i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <span
              aria-current={state === 'current' ? 'step' : undefined}
              className={
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ' +
                (state === 'done'
                  ? 'bg-primary text-ink'
                  : state === 'current'
                    ? 'bg-ink text-primary'
                    : 'bg-canvas text-mute')
              }
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span
              className={
                'hidden text-sm sm:block ' +
                (state === 'current'
                  ? 'font-semibold text-ink'
                  : 'text-bodytext')
              }
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="h-px flex-1 bg-mute/40 sm:mx-1" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
