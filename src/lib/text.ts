/**
 * Text sanitisation for operator-entered fields.
 *
 * Ported verbatim from `stripInvisibles` / `hasInvisibles` in the production
 * app. The character set is not arbitrary: these are the marks that ride along
 * when text is pasted out of a PDF, Word or a bank statement, and they are
 * invisible everywhere a human would look while still breaking every
 * comparison downstream.
 *
 *   U+202A–U+202E  bidirectional embedding and override
 *   U+2066–U+2069  bidirectional isolates
 *   U+200B–U+200F  zero-width space/non-joiner/joiner, LTR/RTL marks
 *   U+FEFF         byte order mark
 *   U+00A0         non-breaking space — folded to a normal space, not removed
 *
 * Why it matters here: a TFN, ABN or BSB pasted with a zero-width space in it
 * looks perfectly correct on screen and fails validation, or worse, saves and
 * then silently fails to match in a payment file. The production app's CSV
 * exporter counts how many fields it had to clean at export time and warns the
 * operator to go back and re-save the record — cleaning on the way in is what
 * stops that happening.
 */

const INVISIBLE = /[‪-‮⁦-⁩​-‏﻿]/g
const INVISIBLE_OR_NBSP = /[‪-‮⁦-⁩​-‏﻿ ]/

/**
 * Remove invisible formatting characters, fold non-breaking spaces to normal
 * ones, and trim. Null and undefined become an empty string.
 */
export function stripInvisibles(value: unknown): string {
  return String(value ?? "")
    .replace(INVISIBLE, "")
    .replace(/ /g, " ")
    .trim()
}

/**
 * Whether a value carries anything `stripInvisibles` would remove or fold.
 *
 * Used to tell the operator their input was cleaned, rather than changing it
 * silently — pasted data being quietly rewritten is how you end up doubting
 * what is actually stored.
 */
export function hasInvisibles(value: unknown): boolean {
  return INVISIBLE_OR_NBSP.test(String(value ?? ""))
}

/** `stripInvisibles`, but an empty result becomes null rather than "". */
export function stripToNull(value: unknown): string | null {
  return stripInvisibles(value) || null
}
