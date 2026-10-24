import { describe, expect, it } from "bun:test";
import { parse } from "yaml";
import { parseRun, runArgs, serviceName, toCompose, tokenize } from "./logic";

function compose(src: string) {
  const r = toCompose(src);
  if (!r.ok) throw new Error(`tokenize failed at line ${r.line}`);
  return {
    ...r,
    doc: parse(r.yaml) as { services: Record<string, Record<string, unknown>> } & Record<
      string,
      unknown
    >,
  };
}

describe("docker-compose: tokenizer", () => {
  it("handles quotes, escapes and continuations", () => {
    const t = tokenize(`docker run -e "A=hello world" -e 'B=$HOME' -e C=a\\ b \\\n  nginx`);
    expect(t).toEqual({
      ok: true,
      commands: [["docker", "run", "-e", "A=hello world", "-e", "B=$HOME", "-e", "C=a b", "nginx"]],
    });
    expect(tokenize('echo "say \\"hi\\" \\$x"')).toEqual({
      ok: true,
      commands: [["echo", 'say "hi" $x']],
    });
    expect(tokenize("a ''")).toEqual({ ok: true, commands: [["a", ""]] });
    expect(tokenize('a=b"c d"e')).toEqual({ ok: true, commands: [["a=bc de"]] });
  });

  it("splits commands and skips comments", () => {
    const t = tokenize(
      "# setup\ndocker pull x && docker run x; echo done # end\r\ndocker run y | tee",
    );
    expect(t.ok && t.commands).toEqual([
      ["docker", "pull", "x"],
      ["docker", "run", "x"],
      ["echo", "done"],
      ["docker", "run", "y"],
      ["tee"],
    ]);
  });

  it("supports PowerShell and cmd line continuations", () => {
    expect(tokenize("docker run `\n  -d nginx")).toEqual({
      ok: true,
      commands: [["docker", "run", "-d", "nginx"]],
    });
    expect(tokenize("docker run ^\r\n  -d nginx")).toEqual({
      ok: true,
      commands: [["docker", "run", "-d", "nginx"]],
    });
  });

  it("reports an unclosed quote with its line", () => {
    expect(tokenize("docker run \\\n -e 'oops nginx")).toEqual({ ok: false, line: 2 });
    expect(toCompose('docker run -e "x')).toEqual({ ok: false, line: 1 });
  });
});

describe("docker-compose: run options", () => {
  it("finds the run arguments", () => {
    expect(runArgs(["sudo", "docker", "container", "run", "x"])).toEqual(["x"]);
    expect(runArgs(["DOCKER_HOST=x", "podman", "run", "x"])).toEqual(["x"]);
    expect(runArgs(["docker", "ps"])).toBeNull();
  });

  it("parses clustered short flags, inline values and the command", () => {
    const r = parseRun([
      "-dit",
      "-p8080:80",
      "-e=A=1",
      "--name=web",
      "-v",
      "/a:/b",
      "nginx:1.25",
      "nginx",
      "-g",
      "daemon off;",
    ]);
    expect(r.options).toEqual([
      { name: "detach", value: null },
      { name: "interactive", value: null },
      { name: "tty", value: null },
      { name: "publish", value: "8080:80" },
      { name: "env", value: "A=1" },
      { name: "name", value: "web" },
      { name: "volume", value: "/a:/b" },
    ]);
    expect(r.image).toBe("nginx:1.25");
    expect(r.args).toEqual(["nginx", "-g", "daemon off;"]);
    expect(r.unknown).toEqual([]);
  });

  it("guesses whether an unknown flag takes a value", () => {
    expect(parseRun(["--frobnicate", "x", "nginx"])).toMatchObject({
      image: "nginx",
      unknown: ["--frobnicate"],
    });
    expect(parseRun(["--frobnicate", "nginx"])).toMatchObject({ image: "nginx" });
    expect(parseRun(["-Z", "nginx"]).unknown).toEqual(["-Z"]);
  });

  it("names services after the image", () => {
    expect(serviceName("ghcr.io/acme/Web_App:1.2@sha256:abc")).toBe("web_app");
    expect(serviceName("postgres")).toBe("postgres");
    expect(serviceName("")).toBe("app");
  });
});

describe("docker-compose: compose file", () => {
  it("converts a typical command", () => {
    const { doc, yaml, warnings } = compose(`docker run -d --name my-db --restart unless-stopped \\
  -p 5432:5432 -e POSTGRES_PASSWORD=secret -e TZ \\
  --env-file ./db.env -v pgdata:/var/lib/postgresql/data -v ./init:/docker-entrypoint-initdb.d:ro \\
  --network backend -l com.example.team=data postgres:16 postgres -c max_connections=200`);
    expect(warnings).toEqual([]);
    expect(doc.services["my-db"]).toEqual({
      image: "postgres:16",
      container_name: "my-db",
      restart: "unless-stopped",
      ports: ["5432:5432"],
      environment: ["POSTGRES_PASSWORD=secret", "TZ"],
      env_file: ["./db.env"],
      volumes: ["pgdata:/var/lib/postgresql/data", "./init:/docker-entrypoint-initdb.d:ro"],
      networks: ["backend"],
      labels: ["com.example.team=data"],
      command: ["postgres", "-c", "max_connections=200"],
    });
    expect(doc.volumes).toEqual({ pgdata: {} });
    expect(doc.networks).toEqual({ backend: { external: true } });
    expect(yaml).toContain('      - "5432:5432"');
    expect(yaml).not.toContain("version:");
  });

  it("maps -it, --rm (as a comment), entrypoint, host network and more", () => {
    const { doc, yaml } = compose(
      "docker run --rm -it --entrypoint /bin/sh --network host -w /app -u 1000:1000 --privileged --init --cap-add NET_ADMIN --add-host db:10.0.0.2 --ulimit nofile=1024:2048 --memory 512m --cpus 1.5 --log-opt max-size=10m --health-cmd 'curl -f localhost' --health-retries 3 --gpus all alpine",
    );
    const s = doc.services.alpine ?? {};
    expect(s).toMatchObject({
      stdin_open: true,
      tty: true,
      entrypoint: "/bin/sh",
      network_mode: "host",
      working_dir: "/app",
      user: "1000:1000",
      privileged: true,
      init: true,
      cap_add: ["NET_ADMIN"],
      extra_hosts: ["db:10.0.0.2"],
      ulimits: { nofile: { soft: 1024, hard: 2048 } },
      mem_limit: "512m",
      cpus: 1.5,
      logging: { options: { "max-size": "10m" } },
      healthcheck: { test: ["CMD-SHELL", "curl -f localhost"], retries: 3 },
      deploy: {
        resources: {
          reservations: { devices: [{ driver: "nvidia", count: "all", capabilities: ["gpu"] }] },
        },
      },
    });
    expect(yaml).toContain("  # --rm: compose keeps stopped containers");
    expect(yaml).toContain('"docker compose run --rm alpine"');
    expect(
      toCompose("docker run --rm x", { rmNote: "--rm : SERVICE" }).ok &&
        toCompose("docker run --rm x", { rmNote: "--rm : SERVICE" }),
    ).toMatchObject({
      yaml: expect.stringContaining("# --rm : x"),
    });
  });

  it("turns several commands into several services, with unique names", () => {
    const { doc, services, warnings } = compose(
      "docker run -d redis\ndocker run -d redis:7\nls -la\ndocker run -d",
    );
    expect(services).toEqual(["redis", "redis-2"]);
    expect(doc.services["redis-2"]?.image).toBe("redis:7");
    expect(warnings.map((w) => w.code)).toEqual(["notRun", "noImage"]);
  });

  it("supports --mount and keeps Windows paths out of named volumes", () => {
    const { doc } = compose(
      'docker run --mount type=volume,source=cache,target=/cache --mount type=bind,src=/etc/x,dst=/x,readonly -v "C:\\data:/data" app',
    );
    expect(doc.services.app?.volumes).toEqual([
      { type: "volume", source: "cache", target: "/cache" },
      { type: "bind", source: "/etc/x", target: "/x", read_only: true },
      "C:\\data:/data",
    ]);
    expect(doc.volumes).toEqual({ cache: {} });
  });

  it("warns about flags compose cannot express", () => {
    const { warnings } = compose("docker run -P --cidfile /tmp/id --network-alias x --weird nginx");
    expect(warnings).toEqual([
      { code: "unsupported", subject: "--weird", service: "nginx" },
      { code: "publishAll", subject: "-P", service: "nginx" },
      { code: "unsupported", subject: "--cidfile", service: "nginx" },
      { code: "unsupported", subject: "--network-alias", service: "nginx" },
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(toCompose("")).toEqual({ ok: true, yaml: "", services: [], warnings: [] });
    expect(toCompose("  \n# only a comment\n")).toEqual({
      ok: true,
      yaml: "",
      services: [],
      warnings: [],
    });
  });
});
