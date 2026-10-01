/** Logic-level UI regression checks. Minimal DOM/Worker stubs intentionally do
 * not claim browser rendering, layout, clipboard permission, or screen-reader QA. */
import { build } from "esbuild";
import assert from "node:assert/strict";
import vm from "node:vm";
const compiled = await build({ entryPoints: ["src/main.ts"], bundle: true, format: "iife", define: { "import.meta.url": '"http://localhost/main.ts"' }, write: false, plugins: [{ name: "mock-dom-deps", setup(b) {
  b.onResolve({ filter: /^\.\/(analyze|render|samples)$/ }, (args) => ({ path: args.path, namespace: "mock" }));
  b.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({ contents: args.path === "./analyze" ? "export const ALGORITHM_VERSION='test', SCALE_VERSION='test';" : args.path === "./samples" ? "export const SAMPLES=[{label:'a',note:'b',text:'sample'}];" : "export const cliJson=charts=>JSON.stringify(charts);export const mountRadar=()=>{};export const renderChartView=()=>'<result>';" }));
} }] });
class Element {
  constructor(id = "") {
    this.id = id;
    this.hidden = false;
    this.value = "";
    this.listeners = {};
    this.attrs = {};
    this.children = [];
    this.dataset = {};
    this.classes = /* @__PURE__ */ new Set();
    this.classList = { add: (x) => this.classes.add(x), remove: (x) => this.classes.delete(x) };
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }
  dispatch(type, event = {}) {
    for (const f of this.listeners[type] ?? []) f({ currentTarget: this, key: "", preventDefault() {
    }, ...event });
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  append(...e) {
    this.children.push(...e);
  }
  replaceChildren(...e) {
    this.children = e;
    this.rendered = false;
  }
  focus() {
    focused = this;
  }
  select() { this.selected = true; }
  scrollIntoView() {
  }
  click() {
    this.dispatch("click");
  }
  set innerHTML(v) {
    this.html = v;
    this.rendered = true;
    for (const id of ["copy-json", "reset-view", "json-fallback", "json-output"]) elements[id] = new Element(id);
    this.tabs = [2, 5].map((slot) => {
      const e = new Element();
      e.dataset.slot = String(slot);
      return e;
    });
    this.rows = [new Element()];
    this.rows[0].dataset.jump = "0";
  }
  querySelector(sel) {
    if (sel.startsWith("#")) return elements[sel.slice(1)];
    if (sel.startsWith("[data-axis=")) return axis;
    if (sel.startsWith(".tab[data-slot=")) return this.tabs.find(tab => sel.includes(`"${tab.dataset.slot}"`));
    return null;
  }
  querySelectorAll(sel) {
    return sel.startsWith(".tab") ? this.tabs : sel.startsWith("[data-jump]") ? this.rows : [];
  }
}
class Details extends Element {
  open = false;
}
let focused;
const elements = {};
for (const id of ["results", "status", "errors", "drop-zone", "file-input", "paste-wrap", "paste-area", "paste-toggle", "sample-list", "footer-versions", "paste-run", "paste-clear"]) elements[id] = new Element(id);
elements["paste-wrap"].hidden = true;
const axis = new Details();
let worker;
const calls = [];
let clipboard;
class Worker {
  constructor() {
    worker = this;
  }
  postMessage(x) {
    calls.push(x);
  }
}
const ctx = { console, URL, TextDecoder, Uint8Array, HTMLDetailsElement: Details, Worker, document: { getElementById: (id) => elements[id], createElement: (tag) => new Element(tag) }, window: { setTimeout() {
}, addEventListener() {
} }, matchMedia: () => ({ matches: true }), CSS: { escape: (x) => x }, navigator: { clipboard: { async writeText(s) {
  clipboard = s;
} } } };
vm.runInNewContext(compiled.outputFiles[0].text, ctx);
const response = (id) => ({ data: { id, ok: true, charts: [{ slot: 2, axes: [{ axis: "\u952E\u76D8" }] }, { slot: 5, axes: [{ axis: "\u952E\u76D8" }] }], slots: [{ slot: 2 }, { slot: 5 }], errors: [] } });
const sample = elements["sample-list"].children[0];
sample.click();
const first = calls.at(-1).id;
worker.onmessage(response(first));
assert.equal(elements.results.hidden, false);
elements["copy-json"].click();
await new Promise(resolve => setImmediate(resolve));
assert.equal(JSON.parse(clipboard).length, 2);
const writeText = ctx.navigator.clipboard.writeText;
ctx.navigator.clipboard.writeText = async () => { throw new Error("permission denied"); };
elements["copy-json"].click();
await new Promise(resolve => setImmediate(resolve));
assert.equal(elements["json-fallback"].hidden, false);
assert.equal(JSON.parse(elements["json-output"].value).length, 2);
assert.equal(elements["json-output"].selected, true);
ctx.navigator.clipboard.writeText = writeText;
elements["paste-toggle"].click();
assert.equal(elements["paste-wrap"].hidden, false);
assert.equal(focused, elements["paste-area"]);
elements["paste-area"].value = "";
elements["paste-run"].click();
assert.equal(elements.results.hidden, true);
assert.ok(elements.status.className.includes("error"));
worker.onmessage(response(first));
assert.equal(elements.results.hidden, true, "stale response ignored after empty input");
sample.click();
worker.onmessage(response(calls.at(-1).id));
elements["reset-view"].click();
assert.equal(elements.results.hidden, true);
assert.equal(elements["paste-wrap"].hidden, true);
assert.equal(focused, elements["drop-zone"]);
const prev = calls.at(-1).id;
worker.onmessage(response(prev));
assert.equal(elements.results.hidden, true, "reset invalidates requests");
let resolveFile;
elements["file-input"].files = [{ name: "slow.txt", arrayBuffer: () => new Promise((r) => resolveFile = r) }];
elements["file-input"].dispatch("change");
sample.click();
const latest = calls.at(-1).id;
resolveFile(new TextEncoder().encode("old").buffer);
await Promise.resolve();
await Promise.resolve();
assert.equal(calls.at(-1).id, latest, "old upload cannot supersede new sample");
worker.onmessage(response(latest));
elements.results.rows[0].click();
assert.equal(axis.open, true);
assert.ok(axis.classes.has("is-active"));
elements.results.tabs[0].click();
assert.equal(elements.results.hidden, false);
assert.equal(focused, elements.results.tabs[0]);
elements["paste-area"].value = "bad";
elements["paste-run"].click();
worker.onmessage({ data: { id: calls.at(-1).id, ok: false, message: "bad input" } });
assert.equal(elements.results.hidden, true);
assert.equal(elements.status.textContent, "bad input");
console.log("PASS simulated-DOM UI: samples, copy JSON and permission fallback, keyboard focus, paste toggle/empty error, stale response rejection, reset invalidation, upload race, axis expansion, difficulty switch, failed parse state. Not a real browser/render test.");
