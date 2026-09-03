export function Toggle(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      className={`relative inline-flex h-[18px] w-[34px] shrink-0 items-center rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50 ${
        props.checked ? 'bg-success-deep' : 'bg-fill-2'
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-bone shadow transition-all duration-200 ${
          props.checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}
