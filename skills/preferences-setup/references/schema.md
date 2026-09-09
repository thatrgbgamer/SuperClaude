# Preferences schema (reference copy)

Condensed for this skill's own use. If this folder is still inside the full SuperClaude repo, `docs/PREFERENCES.md` is the canonical, more detailed version — prefer it when available. This copy exists so the skill still works if someone installs just this one folder on its own.

All groups and all keys are optional. Write only what the user actually specified; leave the rest out.

```yaml
identity:
  name: string
  timezone: string          # IANA name, e.g. America/Chicago
  locale: string             # e.g. en-US, en-GB
  units: metric | imperial
  date_format: string        # e.g. YYYY-MM-DD
  spelling: us | uk

voice:
  formality: casual | neutral | formal
  verbosity: terse | balanced | detailed
  humor: none | light | frequent
  emoji: never | rare | frequent
  hedging: low | medium | high
  person: first | third

formatting:
  style: prose | bullets | mixed
  heading_depth: shallow | deep
  tables: avoid | when-helpful | prefer
  code_fence_language_tags: true | false
  banned_phrases: [string, ...]
  max_length:
    chat: integer | null       # words
    document: integer | null   # words

stack:
  languages: [string, ...]
  package_managers: [string, ...]
  test_frameworks: [string, ...]
  os: string
  shell: string
  editor: string
  container_runtime: string
  cloud_provider: string

workflow:
  commit_convention: string
  branch_naming: string
  pr_style: string
  review_depth: light | standard | thorough
  run_tests_before_proposing: true | false
  confirm_before_creating_files: true | false

content:
  platforms: [string, ...]
  audience: string
  brand_voice_file: string     # path

privacy:
  never_include: [string, ...]
  redact: true | false
  placeholders_for_names_locations: true | false

safety:
  confirm_before_network_calls: true | false
  confirm_before_installing_packages: true | false
  # No key here disables confirmation before a destructive filesystem
  # operation — that confirmation is not something preferences control.

notes: string   # free text
```

## The boundary (short version)

Never write, and never let a filled-in value imply, that preferences can: suppress disagreement or error reporting, make an unverified claim look established, grant elevated permissions, disable destructive-operation confirmation, or tell a skill to ignore repo conventions or Claude's own guidelines. Full rationale: `docs/PREFERENCES.md` "Hard limits," or `shared/preferences-loader.md` if that's the only other file available.
