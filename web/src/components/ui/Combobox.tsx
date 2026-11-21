import { useEffect, useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import { Field } from './Fields';

interface ComboboxProps<T extends string> {
  label?: string;
  options: Array<{ value: T; label: string }>;
  value: T | '';
  onChange: (value: T | '') => void;
  placeholder?: string;
  /** Allow typing a value that is not in the list (used for free text such as a new tag). */
  allowCustom?: boolean;
}

/** A text box with a filtered list underneath. */
export function Combobox<T extends string>({ label, options, value, onChange, placeholder, allowCustom }: ComboboxProps<T>) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => setText(selected?.label ?? (allowCustom ? value : '')), [selected?.label, value, allowCustom]);
  useEffect(() => {
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const shown = options.filter((o) => o.label.toLowerCase().includes(text.toLowerCase())).slice(0, 50);
  return (
    <Field label={label}>
      <div ref={root} className="relative">
        <input
          value={text}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (allowCustom) onChange(e.target.value as T);
            else if (e.target.value === '') onChange('');
          }}
          className="w-full rounded-xl bg-panel px-4 py-2.5 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-primary"
        />
        {open && shown.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-line bg-bg py-1 shadow-xl">
            {shown.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={cx('w-full px-4 py-2 text-left text-sm hover:bg-panel', o.value === value && 'text-primary')}
                  onClick={() => {
                    onChange(o.value);
                    setText(o.label);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
