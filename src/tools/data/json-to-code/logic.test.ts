import { describe, expect, it } from "bun:test";
import { infer, merge } from "../_infer";
import { type CodeOptions, camel, type Lang, pascalId, snake, toCode, words } from "./logic";

const base: CodeOptions = { lang: "go", rootName: "Root", java: "record", python: "dataclass" };
const gen = (value: unknown, lang: Lang, more: Partial<CodeOptions> = {}) =>
  toCode(value, { ...base, lang, ...more });

const SAMPLE = {
  id: 1,
  firstName: "Zoé",
  "zip-code": "69001",
  price: 2.5,
  users: [
    { id: 1, email: "a@b.c", score: null },
    { id: 2, score: 3.5 },
  ],
};

describe("json-to-code: names", () => {
  it("splits and converts keys", () => {
    expect(words("firstName")).toEqual(["first", "Name"]);
    expect(words("HTTPServer_url")).toEqual(["HTTP", "Server", "url"]);
    expect(words("café-crème")).toEqual(["cafe", "creme"]);
    expect(camel("first_name")).toBe("firstName");
    expect(camel("ID")).toBe("id");
    expect(snake("firstName")).toBe("first_name");
    expect(pascalId("user_id", true)).toBe("UserID");
    expect(pascalId("user_id")).toBe("UserId");
    expect(camel("2fa")).toBe("field2fa");
    expect(snake("€")).toBe("field");
  });

  it("tells integers from other numbers, and merges them", () => {
    expect(infer(1, "x", { ints: true })).toEqual({ k: "integer" });
    expect(infer(1.5, "x", { ints: true })).toEqual({ k: "number" });
    expect(infer(1e20, "x", { ints: true })).toEqual({ k: "number" });
    expect(merge(infer(1, "x", { ints: true }), infer(1.5, "x", { ints: true }))).toEqual({
      k: "number",
    });
  });
});

describe("json-to-code: languages", () => {
  it("Go: exported fields, json tags, pointers and omitempty", () => {
    const go = gen(SAMPLE, "go");
    expect(go).toStartWith("package main\n\ntype Root struct {\n");
    expect(go).toContain('\tID        int64   `json:"id"`');
    expect(go).toContain('\tZipCode   string  `json:"zip-code"`');
    expect(go).toContain('\tUsers     []User  `json:"users"`');
    expect(go).toContain('\tEmail *string  `json:"email,omitempty"`');
    expect(go).toContain('\tScore *float64 `json:"score"`');
  });

  it("Rust: serde renames, Option and raw identifiers", () => {
    const rs = gen({ ...SAMPLE, type: "x" }, "rust");
    expect(rs).toStartWith("use serde::{Deserialize, Serialize};");
    expect(rs).toContain('    #[serde(rename = "firstName")]\n    pub first_name: String,');
    expect(rs).toContain("    pub r#type: String,");
    expect(rs).toContain(
      '    #[serde(default, skip_serializing_if = "Option::is_none")]\n    pub email: Option<String>,',
    );
    expect(rs).toContain("    pub score: Option<f64>,");
    expect(rs).toContain("    pub users: Vec<User>,");
  });

  it("Kotlin: data classes with @SerialName and defaults for missing keys", () => {
    const kt = gen(SAMPLE, "kotlin");
    expect(kt).toContain("import kotlinx.serialization.SerialName");
    expect(kt).toContain('    @SerialName("zip-code") val zipCode: String,');
    expect(kt).toContain("    val email: String? = null,");
    expect(kt).toContain("    val score: Double?,");
    expect(kt).toContain("@Serializable\ndata class User(");
  });

  it("Java: records or POJOs, boxed nullable types", () => {
    const rec = gen(SAMPLE, "java");
    expect(rec).toContain("public record Root(\n    long id,");
    expect(rec).toContain('@JsonProperty("zip-code") String zipCode');
    expect(rec).toContain("record User(\n    long id,\n    String email,\n    Double score\n) {}");
    expect(rec).toContain("import java.util.List;");
    const pojo = gen({ ok: true, n: 1 }, "java", { java: "pojo" });
    expect(pojo).toContain("    private boolean ok;");
    expect(pojo).toContain("    public boolean isOk() {");
    expect(pojo).toContain("    public void setN(long n) {");
    expect(pojo).not.toContain("import");
  });

  it("C#: positional records with JsonPropertyName", () => {
    const cs = gen(SAMPLE, "csharp");
    expect(cs).toContain('[property: JsonPropertyName("zip-code")] string ZipCode');
    expect(cs).toContain('[property: JsonPropertyName("score")] double? Score');
    expect(cs).toContain("using System.Collections.Generic;");
    // A property cannot have its record's name.
    expect(gen({ item: { item: 1 } }, "csharp")).toContain("long ItemValue");
  });

  it("Python: dataclasses (defaults last) and Pydantic aliases", () => {
    const dc = gen({ a: null, b: 1, mixed: [1, "x"] }, "python");
    expect(dc).toContain("from dataclasses import dataclass");
    expect(dc).toContain("    b: int\n    mixed: list[int | str]\n    a: Any = None");
    const pd = gen(SAMPLE, "python", { python: "pydantic" });
    expect(pd).toContain("from pydantic import BaseModel, ConfigDict, Field");
    expect(pd).toContain('    first_name: str = Field(alias="firstName")');
    expect(pd).toContain("    model_config = ConfigDict(populate_by_name=True)");
    // Dependencies come first.
    expect(pd.indexOf("class User")).toBeLessThan(pd.indexOf("class Root"));
    expect(gen({ class: 1 }, "python")).toContain('    class_: int  # JSON key: "class"');
  });

  it("Swift: Codable structs, CodingKeys only when needed, JSONValue for mixed values", () => {
    const sw = gen(SAMPLE, "swift");
    expect(sw).toContain('        case zipCode = "zip-code"');
    expect(sw).toContain("    let email: String?");
    expect(sw).not.toContain("enum JSONValue");
    expect(gen({ a: 1 }, "swift")).not.toContain("CodingKeys");
    expect(gen({ m: [1, "x"] }, "swift")).toContain("enum JSONValue: Codable");
  });

  it("Dart: classes with fromJson and toJson", () => {
    const dt = gen(SAMPLE, "dart");
    expect(dt).toContain("  final double price;");
    expect(dt).toContain("        price: (json['price'] as num).toDouble(),");
    expect(dt).toContain(
      "        users: (json['users'] as List<dynamic>).map((e) => User.fromJson(e as Map<String, dynamic>)).toList(),",
    );
    expect(dt).toContain("        'users': users.map((e) => e.toJson()).toList(),");
    expect(dt).toContain("        email: json['email'] as String?,");
    expect(gen({ "it's": "$" }, "dart")).toContain("json['it\\'s']");
  });

  it("handles non-object roots, empty input shapes and identical shapes", () => {
    expect(gen([{ a: 1 }], "go", { rootName: "list" })).toContain("type List []ListItem");
    expect(gen([1, 2], "rust")).toContain("pub type Root = Vec<i64>;");
    expect(gen("x", "swift")).toContain("typealias Root = String");
    expect(gen({}, "kotlin")).toBe(
      "import kotlinx.serialization.json.JsonObject\n\ntypealias Root = JsonObject\n",
    );
    expect(gen([], "python")).toContain("Root = list[Any]");
    const shared = gen({ from: { lat: 1 }, to: { lat: 2 } }, "go");
    expect(shared.match(/struct \{/g)?.length).toBe(2);
    expect(shared).toContain("To   From");
  });

  it("never names a class after a built-in type", () => {
    expect(gen({ string: { a: 1 } }, "kotlin")).toContain("val string: String2");
    expect(gen({ data: { a: 1 } }, "swift")).toContain("let data: Data2");
  });

  it("renames clashing identifiers", () => {
    const go = gen({ a_b: 1, "a-b": 2 }, "go");
    expect(go).toContain("AB ");
    expect(go).toContain("AB2 ");
  });
});
