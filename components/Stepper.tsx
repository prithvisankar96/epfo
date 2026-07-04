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
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
                (state === 'done'
                  ? 'bg-brand-600 text-white'
                  : state === 'current'
                    ? 'border-2 border-brand-600 bg-white text-brand-700'
                    : 'border border-neutral-300 bg-white text-neutral-400')
              }
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span
              className={
                'hidden text-sm sm:block ' +
                (state === 'current'
                  ? 'font-semibold text-neutral-900'
                  : 'text-neutral-500')
              }
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="h-px flex-1 bg-neutral-200 sm:mx-1"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
