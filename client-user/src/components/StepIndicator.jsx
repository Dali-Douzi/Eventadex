const STEP_LABELS = {
  personal: 'Personal Info',
  session:  'Session',
  payment:  'Payment',
  review:   'Review',
};

/**
 * Props:
 *   steps   – string[] e.g. ['personal', 'session', 'review']
 *   current – number (0-based index of the active step)
 */
export default function StepIndicator({ steps, current }) {
  return (
    <div>
      <div className="step-indicator">
        {steps.map((step, i) => {
          const state = i < current ? 'completed' : i === current ? 'active' : 'pending';
          return (
            <div key={step} className="step-item">
              <div className="step-row">
                {/* Left connector line (skip for first item) */}
                {i > 0 && (
                  <div className={`step-line${i <= current ? ' completed' : ''}`} />
                )}

                {/* Bubble */}
                <div className={`step-bubble ${state}`}>
                  {i < current ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="3" width="13" height="13">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : i + 1}
                </div>

                {/* Right connector line (skip for last item) */}
                {i < steps.length - 1 && (
                  <div className={`step-line${i < current ? ' completed' : ''}`} />
                )}
              </div>

              {/* Label below */}
              <span className={`step-label ${state}`}>
                {STEP_LABELS[step] || step}
              </span>
            </div>
          );
        })}
      </div>

      {/* "Step X of N" counter */}
      <p className="step-counter">
        Step {current + 1} of {steps.length} — <strong>{STEP_LABELS[steps[current]] || steps[current]}</strong>
      </p>
    </div>
  );
}
