require("dotenv").config();
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

/**
 * domain: "backend" | "frontend" | "data" | "devops" | "general"
 * terms: matched on normalized text (lowercase, punctuation → spaces)
 */
const SKILL_CATALOG = [
  { id: "java", label: "Java", terms: ["java"], domain: "backend" },
  {
    id: "spring",
    label: "Spring / Spring Boot",
    terms: ["spring boot", "springboot", "spring framework", "spring mvc", "spring"],
    domain: "backend",
  },
  { id: "kotlin", label: "Kotlin", terms: ["kotlin"], domain: "backend" },
  { id: "hibernate", label: "Hibernate", terms: ["hibernate", "jpa"], domain: "backend" },
  { id: "maven", label: "Maven", terms: ["maven"], domain: "backend" },
  { id: "gradle", label: "Gradle", terms: ["gradle"], domain: "backend" },

  { id: "python", label: "Python", terms: ["python"], domain: "backend" },
  { id: "django", label: "Django", terms: ["django"], domain: "backend" },
  { id: "flask", label: "Flask", terms: ["flask"], domain: "backend" },
  { id: "fastapi", label: "FastAPI", terms: ["fastapi"], domain: "backend" },

  {
    id: "node",
    label: "Node.js",
    terms: ["node js", "nodejs", "node"],
    domain: "backend",
  },
  { id: "express", label: "Express", terms: ["express js", "express"], domain: "backend" },

  { id: "csharp", label: "C# / .NET", terms: ["c sharp", "csharp", "dotnet", "net core", "asp net"], domain: "backend" },
  { id: "go", label: "Go", terms: ["golang"], domain: "backend" },
  { id: "rust", label: "Rust", terms: ["rust"], domain: "backend" },
  { id: "php", label: "PHP", terms: ["php"], domain: "backend" },
  { id: "laravel", label: "Laravel", terms: ["laravel"], domain: "backend" },
  { id: "ruby", label: "Ruby", terms: ["ruby"], domain: "backend" },
  { id: "rails", label: "Ruby on Rails", terms: ["ruby on rails", "rails"], domain: "backend" },

  { id: "html", label: "HTML", terms: ["html5", "html"], domain: "frontend" },
  { id: "css", label: "CSS", terms: ["css3", "css"], domain: "frontend" },
  {
    id: "javascript",
    label: "JavaScript",
    terms: ["javascript", "ecmascript"],
    domain: "frontend",
  },
  { id: "typescript", label: "TypeScript", terms: ["typescript"], domain: "frontend" },
  {
    id: "react",
    label: "React",
    terms: ["react js", "reactjs", "react"],
    domain: "frontend",
  },
  { id: "vue", label: "Vue.js", terms: ["vue js", "vuejs", "vue"], domain: "frontend" },
  { id: "angular", label: "Angular", terms: ["angular"], domain: "frontend" },
  { id: "sass", label: "Sass/SCSS", terms: ["scss", "sass"], domain: "frontend" },
  { id: "tailwind", label: "Tailwind CSS", terms: ["tailwind"], domain: "frontend" },
  { id: "webpack", label: "Webpack", terms: ["webpack"], domain: "frontend" },

  {
    id: "sql",
    label: "SQL",
    terms: ["sql", "mysql", "postgresql", "postgres", "sqlite", "mssql", "tsql"],
    domain: "data",
  },
  { id: "mongodb", label: "MongoDB", terms: ["mongodb", "mongo"], domain: "data" },
  { id: "redis", label: "Redis", terms: ["redis"], domain: "data" },
  { id: "graphql", label: "GraphQL", terms: ["graphql"], domain: "general" },
  { id: "kafka", label: "Kafka", terms: ["kafka"], domain: "backend" },
  { id: "microservices", label: "Microservices", terms: ["microservices", "micro services"], domain: "backend" },

  { id: "docker", label: "Docker", terms: ["docker"], domain: "devops" },
  { id: "kubernetes", label: "Kubernetes", terms: ["kubernetes", "k8s"], domain: "devops" },
  { id: "aws", label: "AWS", terms: ["aws", "amazon web services", "ec2", "lambda", "s3"], domain: "devops" },
  { id: "gcp", label: "Google Cloud", terms: ["gcp", "google cloud"], domain: "devops" },
  { id: "azure", label: "Azure", terms: ["azure", "microsoft azure"], domain: "devops" },

  { id: "git", label: "Git", terms: ["github", "gitlab", "bitbucket", "git"], domain: "general" },
  { id: "linux", label: "Linux", terms: ["linux", "ubuntu", "centos"], domain: "devops" },
  { id: "rest", label: "REST APIs", terms: ["rest api", "restful", "rest"], domain: "general" },
];

const BACKEND_IDS = new Set(
  SKILL_CATALOG.filter((s) => s.domain === "backend").map((s) => s.id)
);
const FRONTEND_IDS = new Set(
  SKILL_CATALOG.filter((s) => s.domain === "frontend").map((s) => s.id)
);

function termToRegex(term) {
  const parts = term
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (parts.length === 0) return null;
  return new RegExp(`\\b${parts.join("\\s+")}\\b`, "i");
}

const SKILLS_WITH_REGEX = SKILL_CATALOG.map((skill) => ({
  ...skill,
  patterns: skill.terms.map(termToRegex).filter(Boolean),
}));

/**
 * Lowercase, normalize symbols, collapse whitespace for stable matching.
 */
function normalizeText(raw) {
  if (!raw || typeof raw !== "string") return "";
  let t = raw.toLowerCase();
  t = t.replace(/c#/g, "csharp").replace(/c\+\+/g, "cplusplus");
  t = t.replace(/node\.js/g, "node js").replace(/react\.js/g, "react js").replace(/vue\.js/g, "vue js");
  t = t.replace(/[^\w\s#+]/g, " ");
  t = t.replace(/[#+]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return ` ${t} `;
}

/**
 * @param {string} normalized — from normalizeText (padded with spaces)
 * @returns {Set<string>}
 */
function extractSkillIds(normalized) {
  const found = new Set();
  if (!normalized) return found;

  for (const skill of SKILLS_WITH_REGEX) {
    for (const re of skill.patterns) {
      re.lastIndex = 0;
      if (re.test(normalized)) {
        found.add(skill.id);
        break;
      }
    }
  }
  return found;
}

function labelForId(id) {
  const entry = SKILL_CATALOG.find((s) => s.id === id);
  return entry ? entry.label : id;
}

function countDomainHits(skillSet, idSet) {
  let n = 0;
  for (const id of skillSet) {
    if (idSet.has(id)) n += 1;
  }
  return n;
}

/**
 * Detect clear frontend vs backend (or inverse) misalignment.
 */
function describeDomainMismatch(jdSkills, resumeSkills) {
  const jdBack = countDomainHits(jdSkills, BACKEND_IDS);
  const jdFront = countDomainHits(jdSkills, FRONTEND_IDS);
  const resBack = countDomainHits(resumeSkills, BACKEND_IDS);
  const resFront = countDomainHits(resumeSkills, FRONTEND_IDS);

  const jdBackendHeavy = jdBack >= 2 && jdBack > jdFront;
  const jdFrontendHeavy = jdFront >= 2 && jdFront > jdBack;
  const resumeFrontendHeavy = resFront >= 2 && resFront > resBack;
  const resumeBackendHeavy = resBack >= 2 && resBack > resFront;

  if (jdBackendHeavy && resumeFrontendHeavy && resBack === 0) {
    return {
      note: "Your profile reads more like Frontend Development, while this job emphasizes Backend / JVM-style skills (e.g. Java, Spring).",
      roleHint: "Consider similar roles focused on React or UI engineering, or add backend projects using Java/Spring.",
    };
  }

  if (jdFrontendHeavy && resumeBackendHeavy && resFront === 0) {
    return {
      note: "Your profile reads more like Backend Development, while this job emphasizes Frontend skills (e.g. React, HTML/CSS).",
      roleHint: "Consider backend-oriented listings, or add frontend projects with React/Vue and modern CSS.",
    };
  }

  return null;
}

function computeScore(jdSkills, resumeSkills, matchedCount) {
  const required = jdSkills.size;
  if (required === 0) {
    if (resumeSkills.size === 0) return 22;
    return Math.min(55, 28 + resumeSkills.size * 6);
  }

  if (matchedCount === 0) {
    return Math.min(30, Math.max(10, 26 - Math.min(required, 10)));
  }

  return Math.round((matchedCount / required) * 100);
}

function buildAnalysisText(jdSkills, resumeSkills) {
  const jdList = [...jdSkills];
  const matchedIds = jdList.filter((id) => resumeSkills.has(id));
  const gaps = jdList.filter((id) => !resumeSkills.has(id));

  const score = computeScore(jdSkills, resumeSkills, matchedIds.length);
  const mismatch = describeDomainMismatch(jdSkills, resumeSkills);

  const strengthsLines =
    matchedIds.length > 0
      ? matchedIds.map((id) => `- ${labelForId(id)} (also in job description)`)
      : [];

  const gapsLines =
    gaps.length > 0
      ? gaps.map((id) => `- ${labelForId(id)}`)
      : jdSkills.size > 0
        ? ["- None — resume covers every skill detected in the job description"]
        : [
            "- Paste a job description with clearer tech keywords (Java, React, SQL, etc.)",
          ];

  const suggestionLines = [];

  if (mismatch) {
    suggestionLines.push(`- ${mismatch.note}`);
    suggestionLines.push(`- ${mismatch.roleHint}`);
  }

  if (gaps.length > 0) {
    const learnList = gaps.map(labelForId).join(", ");
    suggestionLines.push(`- Learn or document hands-on experience with: ${learnList}`);
    suggestionLines.push(
      `- Add 1–2 resume bullets per missing skill (course, project, or production use)`
    );
  }

  if (!mismatch && jdSkills.size > 0 && gaps.length === 0) {
    suggestionLines.push(
      `- Strengthen each listed skill with metrics (latency, scale, users, revenue impact)`
    );
  }

  if (jdSkills.size === 0) {
    suggestionLines.push(
      `- Include explicit tools and frameworks in the job text so overlap can be measured`
    );
  }

  if (suggestionLines.length === 0) {
    suggestionLines.push(`- Keep wording aligned with the posting for ATS and recruiter scans`);
  }

  return [
    `Match Score: ${score}%`,
    "",
    "Top Strengths:",
    ...strengthsLines,
    "",
    "Skill Gaps:",
    ...gapsLines,
    "",
    "Suggestions:",
    ...suggestionLines,
  ].join("\n");
}

const analyzeResume = (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;

    if (!resumeText || !jobDescription) {
      return res.status(400).json({
        error: "Both resumeText and jobDescription are required.",
      });
    }

    const jdNorm = normalizeText(jobDescription);
    const resumeNorm = normalizeText(resumeText);

    const jdSkills = extractSkillIds(jdNorm);
    const resumeSkills = extractSkillIds(resumeNorm);
    const analysis = buildAnalysisText(jdSkills, resumeSkills);

    res.json({ analysis });
  } catch (error) {
    console.error("Analyze error:", error);
    res.status(500).json({
      error: "Failed to analyze resume.",
    });
  }
};

app.post("/analyze", analyzeResume);
app.post("/api/analyze", analyzeResume);

app.get("/", (req, res) => res.send("Server running"));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
