// Form controls with the app's look. All of them are controlled (value + onChange).
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

const INPUT =
  'w-full rounded-xl border border-transparent bg-panel px-4 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary disabled:opacity-50';

/** Label + control + help/error text. */
export function Field({ label, help, error, children, htmlFor }: { label?: string; help?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-primary uppercase">
          {label}
        </label>
      )}
      {children}
      {help && <p className="text-xs text-muted">{help}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  help?: ReactNode;
  error?: string;
  value: string | number;
  onChange: (value: string) => void;
}
export function TextField({ label, help, error, value, onChange, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <Field label={label} help={help} error={error} htmlFor={id}>
      <input id={id} {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={cx(INPUT, className)} />
    </Field>
  );
}

/** Number input that reports a number (or undefined when empty). */
export function NumberField({ label, help, value, onChange, ...rest }: Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & { value: number | undefined | null; onChange: (value: number | undefined) => void }) {
  return (
    <TextField
      {...rest}
      label={label}
      help={help}
      type="number"
      value={value ?? ''}
      onChange={(v) => onChange(v === '' ? undefined : Number(v))}
    />
  );
}

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  label?: string;
  help?: ReactNode;
  value: string;
  onChange: (value: string) => void;
}
export function TextArea({ label, help, value, onChange, className, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <textarea id={id} rows={3} {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={cx(INPUT, 'resize-y', className)} />
    </Field>
  );
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label?: string;
  help?: ReactNode;
  value: string | number;
  options: Array<{ value: string | number; label: string }>;
  onChange: (value: string) => void;
}
export function Select({ label, help, value, options, onChange, className, ...rest }: SelectProps) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <select id={id} {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={cx(INPUT, className)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

interface SwitchProps {
  label: string;
  help?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}
/** A toggle row: text on the left, switch on the right. */
export function Switch({ label, help, checked, onChange, disabled }: SwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {help && <div className="text-xs text-muted">{help}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40',
          checked ? 'bg-primary' : 'bg-muted/40',
        )}
      >
        <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  );
}

export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (c: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[rgb(var(--primary))]" />
      {label}
    </label>
  );
}

/** Date (or date-time) input; value is "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm". */
export function DateField({ label, value, onChange, withTime, min, max }: { label?: string; value: string; onChange: (v: string) => void; withTime?: boolean; min?: string; max?: string }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <input id={id} type={withTime ? 'datetime-local' : 'date'} value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} className={INPUT} />
    </Field>
  );
}
