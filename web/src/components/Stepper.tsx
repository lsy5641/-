export interface StepDef { key: string; label: string; done?: boolean }

export default function Stepper({ steps, current, onSelect }: {
  steps: StepDef[];
  current: string;
  onSelect: (key: string) => void;
}) {
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="stepper" aria-label="步骤">
      {steps.map((s, i) => {
        const state = i < idx || s.done ? 'done' : i === idx ? 'current' : 'todo';
        return (
          <li key={s.key} className={'step ' + state}>
            <button type="button" className="step-btn" aria-current={i === idx ? 'step' : undefined} onClick={() => onSelect(s.key)}>
              <span className="step-dot" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>
              <span className="step-label">{s.label}</span>
            </button>
            {i < steps.length - 1 && <span className="step-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}