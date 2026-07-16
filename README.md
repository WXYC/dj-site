# DJ Site Claude Refactoring Kit

Copy the contents of this archive into the root of the `dj-site` repository.

The resulting structure should be:

```text
dj-site/
  CLAUDE.md
  .claude/
    rules/
      integrations.md
      hooks.md
      tests.md
      nextjs-boundaries.md
    skills/
      refactor-slice/
        SKILL.md
  docs/
    architecture/
      FABLE_REFACTOR_CENSUS_PROMPT.md
      REFACTOR_SLICE_TEMPLATE.md
```

## Suggested Use

1. Commit these files before beginning the refactoring campaign.
2. Start a new Fable session.
3. Paste the prompt from `docs/architecture/FABLE_REFACTOR_CENSUS_PROMPT.md`.
4. Review and save the resulting census.
5. Use `docs/architecture/REFACTOR_SLICE_TEMPLATE.md` for one bounded slice at a time.
6. Tell Claude or Fable to use the `refactor-slice` skill for each implementation task.

Adjust the `paths` frontmatter in `.claude/rules/` if the repository uses directories other than `src/` or `app/`.
