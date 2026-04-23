# Karpathy-Inspired Coding Guidelines
# Source: github.com/forrestchang/andrej-karpathy-skills (MIT License)
# Derived from Andrej Karpathy's observations on LLM coding pitfalls.
#
# Tradeoff: These guidelines bias toward caution over speed.
# For trivial tasks, use judgment. Don't apply full rigor to simple one-liners.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State your assumptions explicitly before writing any code.
- If uncertain, ask. If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so before implementing the complex one.
- Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

**Addresses:** Wrong assumptions, hidden confusion, missing tradeoffs.

---

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No design patterns applied prematurely.
- Prefer 100 lines over 1000 lines when both solve the problem.
- Don't clean up, refactor, or "improve" code that isn't part of the task.
- Simple code can be refactored later when complexity is actually needed.

**Addresses:** Overcomplication, bloated abstractions, premature optimization.

---

## 3. Surgical Changes

Only touch what the task requires. Nothing else.

- Change only the lines that directly address the reported issue or request.
- Do not reformat, rename, retype, or restructure code that is orthogonal to the task.
- Do not remove comments or code you don't fully understand as a side effect.
- Minimal diffs — every changed line should be explainable by the task.
- If you notice something unrelated that should be fixed, flag it separately rather than fixing it silently.

**Addresses:** Unintended side effects, orthogonal edits, touching code you shouldn't.

---

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform imperative instructions into declarable goals with verification:

- "Add validation" → "Write tests, then make them pass"
- "Fix the bug" → "Reproduce it, then fix, then confirm it's gone"
- "Refactor X" → "Ensure behaviour is identical before and after"

Don't tell yourself what to do — define what done looks like, then verify.

**Addresses:** Vague completion, no verification, drifting from the actual goal.

---

## AudioScope Project Context

These principles apply to all work on this project. Specific notes:

- **compare.js** is the Netlify serverless function — changes here affect live API calls. Apply Surgical Changes strictly.
- **index.html** is self-contained (CSS + JS inline). Think Before Coding before any edit — the file is large and changes can have wide visual impact.
- **Prompt engineering** in `buildSpecPrompt()` and `buildUrlPrompt()` is delicate. State your reasoning before modifying prompts.
- **Ad slot IDs** (`REPLACE_*_SLOT_ID`) are placeholders — never replace with fabricated values, always flag to the user.
- When adding features (e.g., "Add Another Component"), use Goal-Driven Execution: define what the feature should do and how to verify it works before writing code.
