---
name: toolbelt
description: Offline everyday conversions and checks with the toolbelt CLI (a local Node script, nothing sent anywhere). Use it to count characters, words or tokens; diff texts or files (unified patch); format, validate or convert JSON, YAML, TOML, CSV, XML, SQL, .env and query strings; encode or decode Base64, URL, HTML entities, JWT; compute hashes and HMAC; generate UUIDs, ULIDs, passwords; test regexes; convert timestamps and time zones; explain cron expressions and list next runs; convert number bases, units, data sizes; convert colors and check WCAG contrast; compute CIDR subnets; check semver ranges; turn curl commands into code; compute VAT, French gross-to-net salary, loans and savings; roll dice or draw a Secret Santa. Also use it when the user mentions toolbelt, or to give them a prefilled toolbelt link for visual tools (images, timers, tuner, camera).
license: MIT
metadata:
  version: 1.0.0
---

# toolbelt

The tools of [toolbelt](https://maxgfr.github.io/toolbelt/) (139 everyday utilities) as one
dependency-free Node script. Everything runs locally: no network, no API key, no install. Prefer it
to improvising a one-off script for the conversions and checks listed in the description: the
results match the website's.

## Run it

```sh
node <skill-dir>/scripts/toolbelt.mjs <command> [input] [options]
```

`<skill-dir>` is the directory that contains this SKILL.md: use its absolute path (the skill is
installed away from the project, e.g. `.claude/skills/toolbelt/`, `~/.claude/skills/toolbelt/` or
`~/.agents/skills/toolbelt/`), never a path relative to the working directory. If you do not know
it: `ls -d {.,~}/{.claude,.agents,.codex,.cursor,.gemini}/skills/toolbelt 2>/dev/null`.
Needs Node 20 or later.

- **Input**: an argument, `--file <path>` (or `-f -`), or stdin. Quote arguments for the shell.
- **Output**: plain text; add `--json` for structured output. `--out <path>` writes to a file
  (needed for binary output).
- **Errors**: exit 1 with `error: …` on stderr for invalid input, exit 2 for a wrong option.
- `--lang fr|de` localizes messages that have translations (default: `LANG`, else English).
- `help` lists every command; `help <command>` (or `<command> --help`) gives options and examples.

## Common commands

```sh
T="node <skill-dir>/scripts/toolbelt.mjs"
$T counter --file draft.md                      # characters, words, lines, bytes, reading time
$T diff old.txt new.txt                         # unified patch; --format words|chars|lines|summary
$T json --file data.json                        # validate and pretty-print (errors give line:column)
$T convert --file config.yaml --to json         # JSON <-> YAML <-> TOML
$T csv --file people.csv                        # CSV -> JSON (JSON input -> CSV)
$T sql "select a,b from t where x=1"            # format SQL
$T base64 "hello" ; $T base64 -d "aGVsbG8="     # encode / decode
$T jwt "<token>"                                # header, payload, expiry
$T hash "abc" --algo sha256                     # or every algorithm at once; --file for files
$T uuid --count 3 ; $T password --length 24
$T regex "\d+" "a1 b22"                         # pattern, then text: matches and groups
$T timestamp 1700000000 --zone Europe/Paris     # any date or epoch, in any zone
$T cron "0 9 * * 1-5" --next 5                  # plain-language explanation + next runs
$T number-base ff --from 16                     # bases 2 to 36
$T units 10 km mi                               # length, mass, temperature, speed...
$T color "#0f766e" --bg white                   # all formats + WCAG / APCA contrast
$T cidr 192.168.1.10/24
$T semver 1.4.2 --range "^1.2.0"
$T curl-convert "curl -X POST https://api.example.com -d a=1" --to python
$T vat 100 --rate 20 ; $T salary 3000 ; $T loan 200000 --rate 3.5 --years 20
$T random 2d6+3 ; $T random santa Ann Bob Cid Dee --exclude "Ann,Bob"
```

`references/commands.md` documents every command, option and example; read it when a command or
option is not shown here.

## Find a tool

```sh
$T search json yaml      # any language: "mot de passe", "Zeitzone"
$T list --category data  # every tool with whether the CLI runs it
$T info jwt              # description, URL, CLI support, link keys
```

## Give the user a link instead

Some tools need a browser: images (convert, resize, favicon, colors), timers, metronome, tuner,
tone, camera and microphone test, screen test, signature, typing test, text to speech. Their
command prints the tool's URL. Also link to the site when the user would rather see the result
(side-by-side diff, color picker, JSON tree), with their input prefilled:

```sh
$T link diff --set-file a=old.txt --set-file b=new.txt
$T link json --set input='{"a":1}'
$T link color --set color='#ff6600'
```

The input travels in the URL fragment (`#/<tool>?s=…`, compressed), which browsers never send to a
server. `$T info <tool>` lists the keys a tool accepts. Do not put secrets in links.
