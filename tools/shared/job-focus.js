// Carry keyboard focus across controls that become disabled or hidden during a job.
export function updateJobFocus(focused, run, cancel, busy, exportAction = run) {
  if (busy && (focused === run || focused === exportAction)) cancel.focus();
  else if (!busy && focused === cancel) run.focus();
}
