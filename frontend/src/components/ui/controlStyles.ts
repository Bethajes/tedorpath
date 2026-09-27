export const CONTROL_BASE_CLASSES =
  'w-full rounded-lg border bg-white px-3 py-2.5 text-[0.95rem] text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50'

export const CONTROL_STATE_CLASSES = {
  idle: 'border-slate-300 hover:border-slate-400',
  invalid: 'border-red-400 focus:border-red-500',
}

export const controlClassName = (invalid: boolean) =>
  [
    CONTROL_BASE_CLASSES,
    invalid ? CONTROL_STATE_CLASSES.invalid : CONTROL_STATE_CLASSES.idle,
  ].join(' ')
