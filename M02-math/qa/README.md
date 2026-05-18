# QA Assets

This folder is for user-centric testing instead of implementation-centric checking.

Use it when you want to answer:

- Can a real teacher or student finish the task quickly?
- Where does the product feel confusing even if it is technically correct?
- What should be tested first before classroom use?
- How can AI expand the checklist based on a user profile?

## Files

- `user-centric-regression-checklist.md`: manual regression checklist from a real user task perspective
- `ai-testcase-generator-prompt.md`: copyable prompt for AI-generated checklists and test cases

## Recommended Workflow

1. Pick a module and a real user profile.
2. Run the matching items in `user-centric-regression-checklist.md`.
3. Record issues as `bug`, `usability`, `complexity`, or `recovery`.
4. Use `ai-testcase-generator-prompt.md` to expand edge cases for that profile.
5. Turn repeated high-risk cases into regression checks or automated tests later.

## Issue Labels

- `bug`: wrong result, broken interaction, crash, state loss, wrong math
- `usability`: can finish, but users struggle to find or understand the path
- `complexity`: too many steps, too many concepts at once, heavy mental load
- `recovery`: hard to undo, reset, or get back after a mistake
