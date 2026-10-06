import assert from "node:assert/strict";
import { updateJobFocus } from "../tools/shared/job-focus.js";

let active;
const control = () => ({ focus() { active = this; } });
const run = control(), cancel = control(), output = control(), unrelated = control();
for (const action of [run, output]) {
  active = action;
  updateJobFocus(active, run, cancel, true, output);
  assert.equal(active, cancel, "Starting either job leaves its cancellation control focused");
  for (const completion of ["success", "error", "cancelled"]) {
    active = cancel;
    updateJobFocus(active, run, cancel, false, output);
    assert.equal(active, run, `The hidden cancel control returns focus after ${completion}`);
  }
}
for (const busy of [true, false]) {
  active = unrelated;
  updateJobFocus(active, run, cancel, busy, output);
  assert.equal(active, unrelated, "Background progress does not steal focus from navigation or editing");
}
updateJobFocus(null, run, cancel, true, output);
assert.equal(active, unrelated, "An unfocused page is not focused unsolicited");
console.log("Job keyboard focus regression passed.");
