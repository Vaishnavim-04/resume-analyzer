import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.mjs";

const analyzeBtn = document.getElementById("analyzeBtn");
const jobDescriptionEl = document.getElementById("jobDescription");
const resumeTextEl = document.getElementById("resumeText");
const resumePdfInput = document.getElementById("resumePdf");
const pickPdfBtn = document.getElementById("pickPdfBtn");
const pdfFileLabel = document.getElementById("pdfFileLabel");
const pdfStatusEl = document.getElementById("pdfStatus");

const analysisPlaceholder = document.getElementById("analysisPlaceholder");
const analysisLoading = document.getElementById("analysisLoading");
const analysisContent = document.getElementById("analysisContent");
const matchScoreBox = document.getElementById("matchScoreBox");
const scoreRing = document.getElementById("scoreRing");
const matchScoreValue = document.getElementById("matchScoreValue");
const emptySkillsHint = document.getElementById("emptySkillsHint");
const strengthTags = document.getElementById("strengthTags");
const gapTags = document.getElementById("gapTags");
const strengthTagsEmpty = document.getElementById("strengthTagsEmpty");
const gapTagsEmpty = document.getElementById("gapTagsEmpty");
const strengthsList = document.getElementById("strengthsList");
const suggestionsList = document.getElementById("suggestionsList");
const resultMessage = document.getElementById("resultMessage");

/** @type {number | null} */
let scoreAnimFrame = null;

function setPdfStatus(message, kind) {
  pdfStatusEl.textContent = message || "";
  pdfStatusEl.classList.remove("is-error", "is-success");
  if (kind === "error") pdfStatusEl.classList.add("is-error");
  if (kind === "success") pdfStatusEl.classList.add("is-success");
}

function hideAnalysisUi() {
  analysisPlaceholder.hidden = true;
  analysisLoading.hidden = true;
  analysisContent.hidden = true;
  resultMessage.hidden = true;
}

function showLoading() {
  hideAnalysisUi();
  analysisLoading.hidden = false;
  analyzeBtn.setAttribute("aria-busy", "true");
}

function clearResultMessageClasses() {
  resultMessage.classList.remove(
    "result-message--error",
    "result-message--info",
    "result-message--validation"
  );
}

function showMessage(text, variant) {
  hideAnalysisUi();
  clearResultMessageClasses();
  resultMessage.textContent = text;
  resultMessage.hidden = false;
  if (variant === "validation") {
    resultMessage.classList.add("result-message--validation");
  } else if (variant === "info") {
    resultMessage.classList.add("result-message--info");
  } else {
    resultMessage.classList.add("result-message--error");
  }
}

function validateInputs(jobDescription, resumeText) {
  if (!jobDescription) {
    return "Add a job description so we can compare it to your resume.";
  }
  if (!resumeText) {
    return "Add your resume text (or upload a PDF) before analyzing.";
  }
  return null;
}

/**
 * @param {string} text
 */
function parseAnalysisText(text) {
  if (!text || typeof text !== "string") return null;

  const scoreMatch = text.match(/Match Score:\s*(\d+)\s*%/i);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

  const idxStrengths = text.indexOf("Top Strengths:");
  const idxGaps = text.indexOf("Skill Gaps:");
  const idxSugg = text.indexOf("Suggestions:");

  if (idxStrengths === -1 || idxGaps === -1 || idxSugg === -1) {
    return null;
  }

  const strengths = text
    .slice(idxStrengths + "Top Strengths:".length, idxGaps)
    .trim();
  const gaps = text.slice(idxGaps + "Skill Gaps:".length, idxSugg).trim();
  const suggestions = text.slice(idxSugg + "Suggestions:".length).trim();

  return { score, strengths, gaps, suggestions };
}

function blockToListItems(block) {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^-\s*/.test(line))
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

const NO_MATCH_STRENGTHS_MSG =
  "Your resume currently does not match key skills required for this role.";

function isNoiseLine(s) {
  const t = s.toLowerCase();
  return (
    t === "—" ||
    t.includes("none —") ||
    /\bnone\b.*\bskill/i.test(t) ||
    /no overlapping/i.test(t) ||
    /no tracked/i.test(t) ||
    /does not match key skills required/i.test(t) ||
    /could not detect/i.test(t) ||
    /paste more specific/i.test(t) ||
    /every skill detected/i.test(t)
  );
}

/** Short label for chips: strip trailing parenthetical. */
function chipLabel(raw) {
  return raw.replace(/\s*\([^)]*\)\s*$/g, "").trim() || raw;
}

/**
 * @param {HTMLElement} container
 * @param {string[]} labels
 * @param {number} staggerMs
 */
function renderChips(container, labels, staggerMs) {
  container.replaceChildren();
  labels.forEach((label, i) => {
    const span = document.createElement("span");
    span.className = "tag-chip";
    span.textContent = label;
    span.style.animationDelay = `${i * staggerMs}ms`;
    container.appendChild(span);
  });
}

function fillList(ul, items) {
  ul.replaceChildren();
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "—";
    ul.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  }
}

/**
 * Green >70, yellow 40–70, red <40
 * @param {number | null} score
 */
function scoreTierClass(score) {
  if (score == null || Number.isNaN(score)) return "score-display--mid";
  if (score > 70) return "score-display--high";
  if (score >= 40) return "score-display--mid";
  return "score-display--low";
}

function applyScoreTier(score) {
  matchScoreBox.classList.remove(
    "score-display--high",
    "score-display--mid",
    "score-display--low"
  );
  matchScoreBox.classList.add(scoreTierClass(score));
}

function cancelScoreAnimation() {
  if (scoreAnimFrame != null) {
    cancelAnimationFrame(scoreAnimFrame);
    scoreAnimFrame = null;
  }
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

/**
 * Animate ring and label from 0 to targetScore (ms).
 * @param {number | null} targetScore
 * @param {number} durationMs
 */
function animateScoreTo(targetScore, durationMs = 1200) {
  cancelScoreAnimation();

  if (targetScore == null || Number.isNaN(targetScore)) {
    matchScoreValue.textContent = "—";
    scoreRing.style.setProperty("--progress", "0");
    applyScoreTier(null);
    return;
  }

  const final = Math.min(100, Math.max(0, targetScore));
  applyScoreTier(final);

  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / durationMs);
    const eased = easeOutCubic(t);
    const current = Math.round(final * eased);
    scoreRing.style.setProperty("--progress", String(current));
    matchScoreValue.textContent = `${current}%`;
    if (t < 1) {
      scoreAnimFrame = requestAnimationFrame(frame);
    } else {
      scoreRing.style.setProperty("--progress", String(final));
      matchScoreValue.textContent = `${final}%`;
      scoreAnimFrame = null;
    }
  }

  scoreRing.style.setProperty("--progress", "0");
  matchScoreValue.textContent = "0%";
  scoreAnimFrame = requestAnimationFrame(frame);
}

function updateSkillsInsight(strengthItems, gapItems, strengthChips, gapChips) {
  const strengthsAllNoise =
    strengthItems.length === 0 || strengthItems.every(isNoiseLine);
  const gapsAllNoise = gapItems.length === 0 || gapItems.every(isNoiseLine);

  const showHint =
    strengthChips.length === 0 &&
    gapChips.length === 0 &&
    strengthsAllNoise &&
    gapsAllNoise;

  emptySkillsHint.hidden = !showHint;
}

function renderAnalysis(text) {
  analysisLoading.hidden = true;

  const parsed = parseAnalysisText(text);

  if (!parsed) {
    const body = text?.trim()
      ? `We couldn’t split this into sections. Raw output:\n\n${text}`
      : "The server returned an empty or unreadable analysis.";
    showMessage(body, "info");
    return;
  }

  hideAnalysisUi();
  analysisContent.hidden = false;

  const strengthItems = blockToListItems(parsed.strengths);
  const gapItems = blockToListItems(parsed.gaps);

  const strengthChips = strengthItems
    .filter((s) => !isNoiseLine(s))
    .map(chipLabel);
  const gapChips = gapItems.filter((s) => !isNoiseLine(s)).map(chipLabel);

  renderChips(strengthTags, strengthChips, 45);
  renderChips(gapTags, gapChips, 45);

  const hasMatchingStrengths = strengthChips.length > 0;

  strengthTagsEmpty.textContent = NO_MATCH_STRENGTHS_MSG;
  strengthTagsEmpty.hidden = hasMatchingStrengths;
  gapTagsEmpty.hidden = gapChips.length > 0;

  if (hasMatchingStrengths) {
    fillList(strengthsList, strengthItems);
  } else {
    strengthsList.replaceChildren();
  }
  fillList(suggestionsList, blockToListItems(parsed.suggestions));

  updateSkillsInsight(strengthItems, gapItems, strengthChips, gapChips);

  animateScoreTo(parsed.score, 1100);
}

async function extractTextFromPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const parts = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    if (line.trim()) parts.push(line.trim());
  }

  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

pickPdfBtn.addEventListener("click", () => resumePdfInput.click());

resumePdfInput.addEventListener("change", async (event) => {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    setPdfStatus("That file isn’t a PDF — please pick a .pdf file.", "error");
    pdfFileLabel.hidden = true;
    input.value = "";
    return;
  }

  pickPdfBtn.disabled = true;
  setPdfStatus("Reading your PDF…");
  pdfFileLabel.textContent = file.name;
  pdfFileLabel.hidden = false;

  try {
    const text = await extractTextFromPdf(file);
    if (!text) {
      setPdfStatus(
        "We couldn’t extract text (it may be image-only). Paste the text instead.",
        "error"
      );
    } else {
      resumeTextEl.value = text;
      setPdfStatus("Resume loaded successfully", "success");
    }
  } catch (err) {
    console.error(err);
    setPdfStatus(
      "Something went wrong reading the PDF. Try another file or paste text.",
      "error"
    );
  } finally {
    pickPdfBtn.disabled = false;
    input.value = "";
  }
});

analyzeBtn.addEventListener("click", async () => {
  const jobDescription = jobDescriptionEl.value.trim();
  const resumeText = resumeTextEl.value.trim();

  const validationError = validateInputs(jobDescription, resumeText);
  if (validationError) {
    showMessage(validationError, "validation");
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing…";
  showLoading();

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobDescription, resumeText }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }

    renderAnalysis(data.analysis);
  } catch (error) {
    analysisLoading.hidden = true;
    showMessage(error.message, "error");
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Resume";
    analyzeBtn.removeAttribute("aria-busy");
  }
});
