import { ALGORITHM_VERSION, SCALE_VERSION } from "./analyze";
import { decodeMaidata } from "./decode";
import type { ScoreRequest, ScoreResponse, ScoreSuccess } from "./protocol";
import { scoreJson, mountRadar, renderChartView } from "./render";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const results = $<HTMLElement>("results");
const status = $<HTMLElement>("status");
const errors = $<HTMLElement>("errors");
const dropZone = $<HTMLElement>("drop-zone");
const fileInput = $<HTMLInputElement>("file-input");
const pasteWrap = $<HTMLElement>("paste-wrap");
const pasteArea = $<HTMLTextAreaElement>("paste-area");
const pasteToggle = $<HTMLButtonElement>("paste-toggle");

const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});
let requestId = 0;
let batch: ScoreSuccess | null = null;
let activeSlot = 0;
let sourceLabel = "";

$<HTMLElement>("footer-versions").textContent =
  `${ALGORITHM_VERSION} · ${SCALE_VERSION}`;

function setStatus(message: string, kind: "" | "error" | "busy" = "") {
  status.textContent = message;
  status.className = `status${kind ? ` is-${kind}` : ""}`;
}

function showErrors(list: readonly { difficulty: string; message: string }[]) {
  errors.replaceChildren(
    ...list.map((entry) => {
      const item = document.createElement("p");
      item.className = "error-item";
      const label = document.createElement("b");
      label.textContent = entry.difficulty;
      const text = document.createElement("span");
      text.textContent = entry.message;
      item.append(label, text);
      return item;
    }),
  );
}

function beginInput() {
  const id = ++requestId;
  batch = null;
  $("empty-state").hidden = true;
  results.hidden = true;
  results.replaceChildren();
  errors.replaceChildren();
  return id;
}

function score(text: string, label: string, id = beginInput()) {
  if (id !== requestId) return;
  sourceLabel = label;
  const trimmed = text.trim();
  if (!trimmed) {
    setStatus("内容是空的，先放进一份 maidata 吧。", "error");
    return;
  }
  setStatus(`正在解析 ${label} …`, "busy");
  errors.replaceChildren();
  worker.postMessage({ id, text } satisfies ScoreRequest);
}

worker.onmessage = (event: MessageEvent<ScoreResponse>) => {
  const response = event.data;
  if (response.id !== requestId) return;
  if (!response.ok) {
    batch = null;
    setStatus(response.message, "error");
    return;
  }
  if (!response.charts.length) {
    batch = null;
    setStatus("这份文件里没有能算出的普通谱。", "error");
    showErrors(response.errors);
    return;
  }
  batch = response;
  // Default to the hardest chart present — that is what most people want to see.
  activeSlot = response.charts.at(-1)!.slot;
  paint();
  const warned = response.errors.length
    ? `，${response.errors.length} 张失败`
    : "";
  setStatus(`已解析 ${response.charts.length} 张普通谱${warned}。`);
  showErrors(response.errors);
  results.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

worker.onerror = () => {
  beginInput();
  setStatus("分析引擎未能完成运行，请刷新页面后重试。", "error");
};

function jumpToAxis(axis: string) {
  const card = results.querySelector<HTMLElement>(
    `[data-axis="${CSS.escape(axis)}"]`,
  );
  if (!card) return;
  if (card instanceof HTMLDetailsElement) card.open = true;
  card.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
  card.classList.add("is-active");
  window.setTimeout(() => card.classList.remove("is-active"), 1400);
}

function paint() {
  if (!batch) return;
  const analysis =
    batch.charts.find((chart) => chart.slot === activeSlot) ??
    batch.charts.at(-1)!;
  activeSlot = analysis.slot;
  results.hidden = false;
  results.innerHTML = renderChartView(analysis, {
    charts: batch.charts,
    slots: batch.slots,
    activeSlot,
    sourceLabel,
  });
  mountRadar($<HTMLElement>("radar-host"), analysis, jumpToAxis);

  results
    .querySelectorAll<HTMLButtonElement>(".tab[data-slot]")
    .forEach((tab) => {
      tab.addEventListener("click", () => {
        activeSlot = Number(tab.dataset.slot);
        paint();
        results.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  results.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((row) => {
    row.addEventListener("click", () => {
      const axis = analysis.axes[Number(row.dataset.jump)]?.axis;
      if (axis) jumpToAxis(axis);
    });
  });
  results
    .querySelectorAll<HTMLAnchorElement>("[data-window]")
    .forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const panel = results.querySelector<HTMLDetailsElement>(
          `#windows-${link.dataset.window}`,
        );
        if (panel) {
          panel.open = true;
          panel.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      });
    });
  results
    .querySelector<HTMLButtonElement>("#copy-json")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const exportedBatch = batch;
      const exportId = requestId;
      if (!exportedBatch) return;
      try {
        await navigator.clipboard.writeText(scoreJson(exportedBatch.charts));
        if (exportId !== requestId || !button.isConnected) return;
        button.textContent = "已复制 ✓";
      } catch {
        if (exportId !== requestId || !button.isConnected) return;
        const fallback = results.querySelector<HTMLElement>("#json-fallback");
        const field =
          results.querySelector<HTMLTextAreaElement>("#json-output");
        if (fallback && field && batch) {
          field.value = scoreJson(exportedBatch.charts);
          fallback.hidden = false;
          field.select();
        }
        button.textContent = "请复制下方已选中的 JSON";
      }
      window.setTimeout(() => {
        button.textContent = "复制 JSON";
      }, 1800);
    });
  results
    .querySelector<HTMLButtonElement>("#reset-view")
    ?.addEventListener("click", () => {
      beginInput();
      fileInput.value = "";
      pasteArea.value = "";
      pasteWrap.hidden = true;
      pasteToggle.textContent = "粘贴文本";
      setStatus("");
      $("empty-state").hidden = false;
      errors.replaceChildren();
      dropZone.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
}

async function readFile(file: File) {
  const id = beginInput();
  setStatus(`正在读取 ${file.name} …`, "busy");
  try {
    const text = decodeMaidata(new Uint8Array(await file.arrayBuffer()));
    score(text, file.name, id);
  } catch (error) {
    if (id !== requestId) return;
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
}

// ---- 输入：文件、拖放、粘贴 ----
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void readFile(file);
  fileInput.value = "";
});

for (const type of ["dragenter", "dragover"]) {
  dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
}
for (const type of ["dragleave", "drop"]) {
  dropZone.addEventListener(type, () =>
    dropZone.classList.remove("is-dragging"),
  );
}
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = (event as DragEvent).dataTransfer?.files?.[0];
  if (file) void readFile(file);
});
// Dropping outside the zone should not navigate away from the page.
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());

pasteToggle.addEventListener("click", () => {
  const open = pasteWrap.hidden;
  pasteWrap.hidden = !open;
  pasteToggle.textContent = open ? "收起粘贴框" : "粘贴文本";
});
$<HTMLButtonElement>("paste-run").addEventListener("click", () =>
  score(pasteArea.value, "粘贴的谱面"),
);
$<HTMLButtonElement>("paste-clear").addEventListener("click", () => {
  pasteArea.value = "";
});
