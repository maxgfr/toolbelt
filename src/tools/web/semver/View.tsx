import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, Field, Output, Panel, Stats, TextBox, Toggle } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import { Badge, Empty } from "../_ui";
import {
  compare,
  type DiffKind,
  diff,
  format,
  formatRange,
  inc,
  maxSatisfying,
  parse,
  parseRange,
  RELEASES,
  type Release,
  satisfies,
  validPreId,
} from "./logic";

const T = {
  version: l("Version", "Version", "Version"),
  valid: l("Valid SemVer", "SemVer valide", "Gültige SemVer-Version"),
  invalid: l(
    "Not a valid SemVer version",
    "Version SemVer invalide",
    "Keine gültige SemVer-Version",
  ),
  invalidHint: l(
    "Expected MAJOR.MINOR.PATCH, optionally -prerelease and +build: 1.4.0, 2.0.0-rc.1+sha.5114f85.",
    "Attendu : MAJEUR.MINEUR.CORRECTIF, avec éventuellement -prérelease et +build : 1.4.0, 2.0.0-rc.1+sha.5114f85.",
    "Erwartet wird MAJOR.MINOR.PATCH, optional mit -Vorabversion und +Build: 1.4.0, 2.0.0-rc.1+sha.5114f85.",
  ),
  major: l("Major", "Majeure", "Major"),
  minor: l("Minor", "Mineure", "Minor"),
  patch: l("Patch", "Correctif", "Patch"),
  prerelease: l("Prerelease", "Prérelease", "Vorabversion"),
  build: l("Build", "Build", "Build"),
  bump: l("Bump", "Incrémenter", "Hochzählen"),
  preid: l("Prerelease identifier", "Identifiant de prérelease", "Kennung der Vorabversion"),
  preidHint: l(
    "e.g. alpha, beta, rc — optional",
    "par ex. alpha, beta, rc — facultatif",
    "z. B. alpha, beta, rc – optional",
  ),
  badPreid: l(
    "Letters, digits and hyphens only.",
    "Lettres, chiffres et tirets seulement.",
    "Nur Buchstaben, Ziffern und Bindestriche.",
  ),
  compare: l("Compare", "Comparer", "Vergleichen"),
  a: l("Version A", "Version A", "Version A"),
  b: l("Version B", "Version B", "Version B"),
  swap: l("Swap", "Inverser", "Tauschen"),
  differs: l("Differs by", "Diffère par", "Unterschied:"),
  same: l("Same precedence", "Même priorité", "Gleiche Rangfolge"),
  range: l("Range check", "Vérifier une plage", "Bereich prüfen"),
  rangeLabel: l("Range", "Plage", "Bereich"),
  rangeHint: l(
    "^1.2.3, ~1.2, 1.x, >=1.0.0 <2.0.0, 1.2.3 - 2.3.4, … || …",
    "^1.2.3, ~1.2, 1.x, >=1.0.0 <2.0.0, 1.2.3 - 2.3.4, … || …",
    "^1.2.3, ~1.2, 1.x, >=1.0.0 <2.0.0, 1.2.3 - 2.3.4, … || …",
  ),
  badRange: l("Not a valid range.", "Plage invalide.", "Kein gültiger Bereich."),
  includePre: l("Include prereleases", "Inclure les prereleases", "Vorabversionen einbeziehen"),
  normalized: l("Means", "Signifie", "Bedeutet"),
  versions: l(
    "Versions to test (one per line)",
    "Versions à tester (une par ligne)",
    "Zu testende Versionen (eine pro Zeile)",
  ),
  matches: l("Satisfies", "Satisfait", "Erfüllt"),
  noMatch: l("Does not satisfy", "Ne satisfait pas", "Erfüllt nicht"),
  notVersion: l("not a version", "pas une version", "keine Version"),
  max: l("Highest match", "Plus haute correspondance", "Höchster Treffer"),
  noVersions: l(
    "Add versions above to test them.",
    "Ajoute des versions ci-dessus pour les tester.",
    "Füge oben Versionen hinzu, um sie zu testen.",
  ),
};

const DIFF_L: Record<NonNullable<DiffKind>, L10n> = {
  major: l("major version", "version majeure", "Major-Version"),
  minor: l("minor version", "version mineure", "Minor-Version"),
  patch: l("patch", "correctif", "Patch"),
  prerelease: l("prerelease", "prérelease", "Vorabversion"),
  build: l(
    "build metadata only (same precedence)",
    "métadonnées de build seulement (même priorité)",
    "nur Build-Metadaten (gleiche Rangfolge)",
  ),
};

const RELEASE_L: Record<Release, L10n> = {
  major: l(
    "major — breaking changes",
    "major — changements incompatibles",
    "major – inkompatible Änderungen",
  ),
  minor: l("minor — new features", "minor — nouvelles fonctionnalités", "minor – neue Features"),
  patch: l("patch — bug fixes", "patch — corrections", "patch – Fehlerbehebungen"),
  premajor: l("premajor", "premajor", "premajor"),
  preminor: l("preminor", "preminor", "preminor"),
  prepatch: l("prepatch", "prepatch", "prepatch"),
  prerelease: l(
    "prerelease — next prerelease",
    "prerelease — prérelease suivante",
    "prerelease – nächste Vorabversion",
  ),
};

export default function Semver() {
  const version = useToolState("version", "1.4.2-beta.3+exp.sha.5114f85");
  const preid = useToolState("preid", "beta");
  const a = useToolState("a", "1.10.0");
  const b = useToolState("b", "1.9.3");
  const range = useToolState("range", "^1.2.0 || ~2.1");
  const includePre = useToolState("includePre", false);
  const list = useToolState("list", "1.1.9\n1.2.0\n1.8.3\n1.9.0-rc.1\n2.0.0\n2.1.7\n2.2.0");

  const ver = useComputed(() => parse(version.value));
  const pa = useComputed(() => parse(a.value));
  const pb = useComputed(() => parse(b.value));
  const rng = useComputed(() => parseRange(range.value, includePre.value));
  const tested = useComputed(() =>
    list.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => {
        const p = parse(text);
        return {
          text,
          v: p,
          ok: p && rng.value ? satisfies(p, rng.value, includePre.value) : false,
        };
      }),
  );
  const best = useComputed(() => {
    const r = rng.value;
    if (!r) return null;
    const vs = tested.value.flatMap((t) => (t.v ? [t.v] : []));
    return maxSatisfying(vs, r, includePre.value);
  });

  const v = ver.value;
  const goodPreid = validPreId(preid.value.trim());
  const c = pa.value && pb.value ? compare(pa.value, pb.value) : null;
  const d = pa.value && pb.value ? diff(pa.value, pb.value) : null;

  return (
    <>
      <Panel title={tr(T.version)}>
        <div class="semver-version">
          <input
            class="input mono"
            value={version.value}
            aria-label={tr(T.version)}
            aria-invalid={!!version.value.trim() && !v}
            spellcheck={false}
            autocomplete="off"
            placeholder="1.4.2-beta.3+build.5"
            onInput={(e) => {
              version.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
          {version.value.trim() &&
            (v ? (
              <Badge kind="ok">{tr(T.valid)}</Badge>
            ) : (
              <Badge kind="bad">{tr(T.invalid)}</Badge>
            ))}
        </div>
        {version.value.trim() && !v && <p class="muted small">{tr(T.invalidHint)}</p>}
        {v && (
          <>
            <Stats
              items={[
                { label: tr(T.major), value: v.major },
                { label: tr(T.minor), value: v.minor },
                { label: tr(T.patch), value: v.patch },
                { label: tr(T.prerelease), value: v.prerelease.join(".") || "—" },
                { label: tr(T.build), value: v.build.join(".") || "—" },
              ]}
            />
            <Field
              label={tr(T.preid)}
              hint={goodPreid ? tr(T.preidHint) : tr(T.badPreid)}
              class="semver-preid"
            >
              <input
                class="input mono"
                value={preid.value}
                aria-invalid={!goodPreid}
                spellcheck={false}
                onInput={(e) => {
                  preid.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{tr(T.bump)}</th>
                    <th>{tr(T.version)}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {RELEASES.map((r) => {
                    const next = format(inc(v, r, goodPreid ? preid.value.trim() : ""));
                    return (
                      <tr key={r}>
                        <td>{tr(RELEASE_L[r])}</td>
                        <td class="mono">{next}</td>
                        <td class="num">
                          <CopyButton text={next} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <Panel title={tr(T.compare)}>
        <div class="semver-compare">
          <Field label={tr(T.a)}>
            <input
              class="input mono"
              value={a.value}
              aria-invalid={!!a.value.trim() && !pa.value}
              spellcheck={false}
              onInput={(e) => {
                a.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          <div class="semver-op" aria-live="polite">
            {c === null ? "?" : c < 0 ? "<" : c > 0 ? ">" : "="}
          </div>
          <Field label={tr(T.b)}>
            <input
              class="input mono"
              value={b.value}
              aria-invalid={!!b.value.trim() && !pb.value}
              spellcheck={false}
              onInput={(e) => {
                b.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
        </div>
        <div class="row">
          {c !== null && (
            <span class="small">
              {d && d !== "build" ? (
                <>
                  {tr(T.differs)} <strong>{tr(DIFF_L[d])}</strong>
                </>
              ) : d === "build" ? (
                tr(DIFF_L.build)
              ) : (
                tr(T.same)
              )}
            </span>
          )}
          <span class="spacer" />
          <Button
            size="sm"
            variant="ghost"
            icon="swap"
            onClick={() => {
              [a.value, b.value] = [b.value, a.value];
            }}
          >
            {tr(T.swap)}
          </Button>
        </div>
      </Panel>

      <Panel title={tr(T.range)}>
        <Field label={tr(T.rangeLabel)} hint={tr(T.rangeHint)}>
          <input
            class="input mono"
            value={range.value}
            aria-invalid={!rng.value}
            spellcheck={false}
            autocomplete="off"
            onInput={(e) => {
              range.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        <Toggle
          checked={includePre.value}
          onChange={(x) => {
            includePre.value = x;
          }}
          label={tr(T.includePre)}
        />
        {rng.value ? (
          <Output label={tr(T.normalized)} value={formatRange(rng.value)} />
        ) : (
          <p class="error-note">{tr(T.badRange)}</p>
        )}
        <div class="grid-2">
          <TextBox
            label={tr(T.versions)}
            value={list.value}
            onInput={(x) => {
              list.value = x;
            }}
            rows={8}
            files={false}
          />
          <div class="stack">
            {tested.value.length === 0 && <Empty>{tr(T.noVersions)}</Empty>}
            {rng.value && tested.value.length > 0 && (
              <ul class="semver-results">
                {tested.value.map((t, i) => (
                  <li key={`${t.text}-${i}`}>
                    <span class="mono">{t.text}</span>
                    {!t.v ? (
                      <Badge kind="warn">{tr(T.notVersion)}</Badge>
                    ) : t.ok ? (
                      <Badge kind="ok">{tr(T.matches)}</Badge>
                    ) : (
                      <Badge kind="bad">{tr(T.noMatch)}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {best.value && <Output label={tr(T.max)} value={format(best.value)} />}
          </div>
        </div>
      </Panel>
    </>
  );
}
