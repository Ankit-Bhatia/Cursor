/* eslint-disable no-alert */
const STORAGE_KEY = "vc_salesforce_prompt_template_v1";

const $ = (id) => document.getElementById(id);

// Persona-based restrictions
const PERSONA_RESTRICTIONS = {
  "Business Analyst": {
    workProducts: ["Story"],
    artifacts: ["Flow", "Object"],
  },
  "Architect": {
    workProducts: ["Design"],
    artifacts: ["LWC", "Apex", "Flow", "Object"],
  },
  "Developer": {
    workProducts: ["Build", "Story", "Design"],
    artifacts: ["LWC", "Apex", "TestClass", "Flow", "Object"],
  },
};

// Standard constraints that are always applied
const STANDARD_CONSTRAINTS = [
  "No hardcoded record IDs, profile IDs, or endpoint URLs. Use metadata, Custom Metadata/Settings, Named Credentials, and labels where appropriate.",
  "Be governor-limit aware and bulk-safe (especially for Apex and record-triggered automation).",
  "Follow Salesforce best practices and the org's established patterns and naming conventions.",
  "Prefer secure-by-default design: least privilege, CRUD/FLS, sharing, input validation, and safe error messages.",
];

function nowIsoDate() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function safe(v) {
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

function bulletsFromTextarea(text) {
  const raw = safe(text);
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*[-*]\s?/, "").trim())
    .filter(Boolean);
}

function joinBullets(items) {
  if (!items || items.length === 0) return "- (none provided)";
  return items.map((x) => `- ${x}`).join("\n");
}

function buildArtifactChecklist(artifacts) {
  if (!artifacts || artifacts.length === 0) return [];
  
  const allChecklists = [];
  const seen = new Set();
  
  artifacts.forEach((artifact) => {
    let checklist = [];
    switch (artifact) {
      case "LWC":
        checklist = [
          "Use Lightning Design System patterns; ensure accessibility (ARIA, keyboard navigation).",
          "Prefer Lightning Data Service where appropriate; otherwise call Apex via @wire / imperative calls with clear error states.",
          "Follow LWC best practices: small components, clear public APIs, tracked state, avoid unnecessary rerenders.",
          "Security: enforce CRUD/FLS in Apex, sanitize user input, avoid exposing sensitive fields.",
          "Testing: include Jest tests for UI logic where useful and Apex tests for server-side behavior.",
          "Performance: avoid N+1 call patterns; cache read-only data where appropriate; minimize DOM work.",
        ];
        break;
      case "Apex":
        checklist = [
          "Bulk-safe, governor-limit aware, no SOQL/DML in loops.",
          "CRUD/FLS enforcement and sharing model alignment (with sharing / without sharing justified).",
          "Use service-layer patterns; keep triggers thin (if triggers are involved).",
          "Use Named Credentials for callouts; handle retries/timeouts; surface errors safely.",
          "Use meaningful exceptions, logs (as appropriate), and deterministic behavior.",
          "Provide clear unit test strategy and test data setup.",
        ];
        break;
      case "TestClass":
        checklist = [
          "Deterministic tests with clear arrange/act/assert; assert outcomes, not implementation details.",
          "Use realistic test data; prefer factory methods; avoid SeeAllData unless explicitly required.",
          "Cover success and failure paths; validate exceptions/messages when relevant.",
          "Exercise bulk behavior (200 records) where applicable.",
          "Validate security behavior (sharing, CRUD/FLS) if part of requirements.",
        ];
        break;
      case "Flow":
        checklist = [
          "Choose the right flow type (screen/record-triggered/scheduled/autolaunched) based on requirements.",
          "Use clear naming conventions; document inputs/outputs; avoid hardcoding IDs.",
          "Design for performance: minimize queries/loops; prefer Get Records with selective filters.",
          "Use fault paths; user-friendly error handling; avoid data loss and partial updates.",
          "Use subflows for reuse; keep flows maintainable; include versioning notes.",
        ];
        break;
      case "Object":
        checklist = [
          "Model for reporting, scale, and maintainability; choose lookup vs master-detail intentionally.",
          "Define field types, validation rules, record types, page layouts, and automation boundaries.",
          "Plan security: OWD, role hierarchy effects, sharing rules, permission sets, FLS.",
          "Consider data lifecycle, ownership, audit fields, and integration identifiers.",
          "Avoid redundant automation; define where logic lives (Flow vs Apex) and why.",
        ];
        break;
    }
    
    checklist.forEach((item) => {
      if (!seen.has(item)) {
        seen.add(item);
        allChecklists.push(item);
      }
    });
  });
  
  return allChecklists;
}

function artifactName(artifact) {
  switch (artifact) {
    case "LWC":
      return "Lightning Web Component (LWC)";
    case "Apex":
      return "Apex";
    case "TestClass":
      return "Apex Test Class";
    case "Flow":
      return "Flow";
    case "Object":
      return "Object / Data Model";
    default:
      return artifact;
  }
}

function artifactNames(artifacts) {
  if (!artifacts || artifacts.length === 0) return "(none selected)";
  return artifacts.map(artifactName).join(", ");
}

function workProductGuidance(workProduct) {
  switch (workProduct) {
    case "Story":
      return {
        outcomes: [
          "A well-formed story with title, narrative, scope, assumptions, acceptance criteria, and out-of-scope items.",
          "A validation checklist (security/perf/governor limits/testing/UX).",
          "Explicit dependencies and questions if information is missing.",
        ],
        outputFormat: [
          "Title",
          "Narrative (As a / I want / So that)",
          "In scope / Out of scope",
          "Acceptance Criteria (bullet list)",
          "Non-functional requirements",
          "Dependencies & Risks",
          "Open Questions",
        ],
      };
    case "Design":
      return {
        outcomes: [
          "A technical design with components, data model, automation boundaries, and integration approach.",
          "Trade-offs, risks, and mitigations.",
          "A build plan with sequencing and test strategy.",
        ],
        outputFormat: [
          "Context & Goals",
          "Assumptions",
          "Proposed Solution (components + responsibilities)",
          "Data Model / Security Model",
          "Automation & Integration",
          "Error Handling / Observability",
          "Testing Strategy",
          "Risks & Alternatives",
          "Implementation Plan",
        ],
      };
    case "Build":
    default:
      return {
        outcomes: [
          "Correct, production-ready implementation artifacts aligned to Salesforce best practices.",
          "Explanation of key decisions and how they meet constraints/guardrails.",
          "A test plan (and tests where applicable).",
        ],
        outputFormat: [
          "Overview",
          "Implementation (code / metadata)",
          "Configuration steps (if any)",
          "Testing (unit + manual)",
          "Notes / Trade-offs",
        ],
      };
  }
}

function orgModeGuidance(orgMode, knownComponents, knownIntegrations, orgComplexity) {
  if (orgMode === "ExistingOrg") {
    const discoveryItems = [];
    if (knownComponents) discoveryItems.push(`Known components: ${knownComponents}`);
    if (knownIntegrations) discoveryItems.push(`Known integrations: ${knownIntegrations}`);
    if (orgComplexity) discoveryItems.push(`Org complexity: ${orgComplexity}`);
    
    return {
      contextAddendum: [
        "This is an existing Salesforce org (Brownfield). Before building anything, you MUST first propose an inventory/analysis plan to understand the current state and avoid duplicating functionality.",
        "You MUST identify existing components that can be reused or extended, and you MUST call out dependencies/impacts.",
        ...(discoveryItems.length > 0 ? [""].concat(discoveryItems) : []),
      ],
      firstStep: [
        "Step 0 (Discovery): list exactly what you need to inspect (objects/fields, flows, LWCs, Apex classes, permission sets, sharing model, managed packages, naming conventions, integrations) and the questions you must answer before implementation.",
        "If any information is missing or ambiguous, first list clarifying questions and assumptions before writing any code.",
        "Only after discovery should you propose the solution and generate code/metadata.",
      ],
    };
  }
  return {
    contextAddendum: [
      "This is a greenfield build for the described scope. You may propose sensible defaults, but you MUST label assumptions and keep them minimal.",
    ],
    firstStep: [
      "Step 0 (Clarifying Questions & Assumptions): if any information is missing or ambiguous, first list clarifying questions and assumptions before writing any code.",
      "Only proceed with clearly stated assumptions after listing what's missing.",
    ],
  };
}

function buildPrompt(modelInputs) {
  const persona = safe(modelInputs.persona);
  const artifacts = modelInputs.artifacts || [];
  const workProduct = safe(modelInputs.workProduct);
  const orgMode = safe(modelInputs.orgMode);

  const goal = safe(modelInputs.goal);
  const objects = safe(modelInputs.objects);
  const users = safe(modelInputs.users);
  const requirements = bulletsFromTextarea(modelInputs.requirements);
  const customConstraints = bulletsFromTextarea(modelInputs.constraints);
  const allConstraints = [...STANDARD_CONSTRAINTS, ...customConstraints];
  const existingComponents = safe(modelInputs.existingComponents);
  const knownIntegrations = safe(modelInputs.knownIntegrations);
  const orgComplexity = safe(modelInputs.orgComplexity);
  const orgDetails = safe(modelInputs.orgDetails);
  const integration = safe(modelInputs.integration);
  const outputStyle = safe(modelInputs.outputStyle);

  const artifactChecklist = buildArtifactChecklist(artifacts);
  const work = workProductGuidance(workProduct);
  const org = orgModeGuidance(orgMode, existingComponents, knownIntegrations, orgComplexity);

  const baseGuardrails = [
    "Do NOT invent org-specific names/IDs. If missing, ask questions or state assumptions explicitly.",
    "If requirements conflict, call out the conflict and propose options rather than guessing.",
    "If any information is missing or ambiguous, first list clarifying questions and assumptions before writing any code.",
    "If you cannot safely proceed, output clarifying questions instead of code.",
    "Do not explain the prompt back to me or talk about being an AI. Go straight to the engineering spec.",
    "Output must be copy/paste ready and organized using clear headings and checklists.",
  ];

  const salesforceGuardrails = [
    "Explain how the solution aligns with Salesforce best practices and what trade-offs were made.",
  ];

  const outputStyleNote =
    outputStyle === "Jira"
      ? "Format the output to be Jira-ready (concise headings + acceptance criteria)."
      : outputStyle === "Engineering"
        ? "Format the output as an engineering spec with crisp sections and decision logs."
        : "Format the output in Markdown with clear headings and bullet lists.";

  const prompt = [
    `You are a senior Salesforce ${persona} and an expert AI pair-programmer.`,
    "",
    "## Role",
    `Act as a Salesforce ${persona}. Your goal is to help produce a high-quality ${workProduct} for: ${artifactNames(artifacts)}.`,
    "",
    "## Context",
    `- Date: ${nowIsoDate()}`,
    `- Artifact type(s): ${artifactNames(artifacts)}`,
    `- Work product: ${workProduct}`,
    `- Org mode: ${orgMode === "ExistingOrg" ? "Existing Org (Brownfield - analyze first)" : "Greenfield (build from scratch)"}`,
    `- Goal: ${goal || "(not provided)"}`,
    `- Primary object(s): ${objects || "(not provided)"}`,
    `- Users/personas: ${users || "(not provided)"}`,
    "",
    "### Requirements",
    joinBullets(requirements),
    "",
    orgDetails ? "### Org details\n" + orgDetails : "",
    integration ? "### Data / integration\n" + integration : "",
    orgMode === "ExistingOrg"
      ? [
          existingComponents ? `### Known components (Apex/Flows/LWCs)\n${existingComponents}` : "",
          knownIntegrations ? `### Known integrations\n${knownIntegrations}` : "",
          orgComplexity ? `### Org complexity notes\n${orgComplexity}` : "",
        ]
          .filter(Boolean)
          .join("\n\n") || "### Existing org context\n(none provided)"
      : "",
    "",
    "## Constraints",
    joinBullets(allConstraints),
    "",
    "## Guardrails",
    joinBullets([...baseGuardrails, ...salesforceGuardrails, ...artifactChecklist]),
    "",
    "## Outcomes (definition of done)",
    joinBullets(work.outcomes),
    "",
    "## Process",
    joinBullets(org.firstStep),
    "",
    "## Output format",
    `- ${outputStyleNote}`,
    "- Use exactly the following section headings in this order:",
    ...work.outputFormat.map((x, i) => `  ${i + 1}. ${x}`),
    "",
    "## Required final checks",
    joinBullets([
      "Confirm you met the goal and each requirement.",
      "List any assumptions and open questions.",
      "List security considerations (CRUD/FLS/sharing/PII).",
      "List testing approach (unit + manual).",
      "If generating code/metadata, ensure naming is consistent and all referenced fields/objects are defined.",
    ]),
  ]
    .filter((x) => x !== "")
    .join("\n");

  return prompt.trim() + "\n";
}

function getSelectedArtifacts() {
  const checkboxes = document.querySelectorAll('#artifactGroup input[type="checkbox"]:checked');
  const selected = Array.from(checkboxes).map((cb) => cb.value);
  // Ensure at least one is selected
  if (selected.length === 0) {
    const firstCheckbox = document.querySelector('#artifactGroup input[type="checkbox"]');
    if (firstCheckbox) {
      firstCheckbox.checked = true;
      return [firstCheckbox.value];
    }
  }
  return selected;
}

function readStateFromUI() {
  const orgModeRadio = document.querySelector('input[name="orgMode"]:checked');
  return {
    persona: $("persona").value,
    artifacts: getSelectedArtifacts(),
    workProduct: $("workProduct").value,
    orgMode: orgModeRadio ? orgModeRadio.value : "Greenfield",
    goal: $("goal").value,
    objects: $("objects").value,
    users: $("users").value,
    requirements: $("requirements").value,
    existingComponents: $("existingComponents").value,
    knownIntegrations: $("knownIntegrations") ? $("knownIntegrations").value : "",
    orgComplexity: $("orgComplexity") ? $("orgComplexity").value : "",
    constraints: $("constraints").value,
    outputStyle: $("outputStyle").value,
    orgDetails: $("orgDetails").value,
    integration: $("integration").value,
  };
}

function writeStateToUI(state) {
  const s = state || {};
  $("persona").value = s.persona || "Developer";
  
  // Handle artifacts - support both old single select format and new multiselect
  const artifacts = s.artifacts || (s.artifact ? [s.artifact] : ["LWC"]);
  document.querySelectorAll('#artifactGroup input[type="checkbox"]').forEach((cb) => {
    cb.checked = artifacts.includes(cb.value);
  });
  
  $("workProduct").value = s.workProduct || "Build";
  
  // Handle org mode - support both old select and new radio buttons
  const orgMode = s.orgMode || "Greenfield";
  const orgModeRadio = document.querySelector(`input[name="orgMode"][value="${orgMode}"]`);
  if (orgModeRadio) {
    orgModeRadio.checked = true;
  }
  
  $("goal").value = s.goal || "";
  $("objects").value = s.objects || "";
  $("users").value = s.users || "";
  $("requirements").value = s.requirements || "";
  $("existingComponents").value = s.existingComponents || "";
  if ($("knownIntegrations")) $("knownIntegrations").value = s.knownIntegrations || "";
  if ($("orgComplexity")) $("orgComplexity").value = s.orgComplexity || "";
  $("constraints").value = s.constraints || "";
  $("outputStyle").value = s.outputStyle || "Markdown";
  $("orgDetails").value = s.orgDetails || "";
  $("integration").value = s.integration || "";
}

function updateExistingOrgVisibility() {
  const orgModeRadio = document.querySelector('input[name="orgMode"]:checked');
  const isExisting = orgModeRadio && orgModeRadio.value === "ExistingOrg";
  if ($("existingOrgFields")) {
    $("existingOrgFields").hidden = !isExisting;
  }
}

function updatePersonaBasedFilters() {
  const persona = $("persona").value;
  const restrictions = PERSONA_RESTRICTIONS[persona] || PERSONA_RESTRICTIONS["Developer"];

  // Update work product options
  const workProductSelect = $("workProduct");
  const currentValue = workProductSelect.value;
  const options = workProductSelect.querySelectorAll("option");
  
  options.forEach((option) => {
    const isAllowed = restrictions.workProducts.includes(option.value);
    option.hidden = !isAllowed;
    option.disabled = !isAllowed;
  });

  // If current selection is not allowed, select the first allowed option
  if (!restrictions.workProducts.includes(currentValue)) {
    workProductSelect.value = restrictions.workProducts[0];
  }

  // Update artifact checkboxes
  const artifactCheckboxes = document.querySelectorAll('#artifactGroup input[type="checkbox"]');
  let hasSelectedAllowed = false;

  artifactCheckboxes.forEach((checkbox) => {
    const isAllowed = restrictions.artifacts.includes(checkbox.value);
    const label = checkbox.closest("label.checkbox");
    
    if (label) {
      label.style.display = isAllowed ? "flex" : "none";
    }
    
    // Uncheck if not allowed
    if (!isAllowed && checkbox.checked) {
      checkbox.checked = false;
    }
    
    // Track if any allowed artifact is selected
    if (isAllowed && checkbox.checked) {
      hasSelectedAllowed = true;
    }
  });

  // If no allowed artifacts are selected, select the first allowed one
  if (!hasSelectedAllowed && restrictions.artifacts.length > 0) {
    const firstAllowed = document.querySelector(`#artifactGroup input[type="checkbox"][value="${restrictions.artifacts[0]}"]`);
    if (firstAllowed) {
      firstAllowed.checked = true;
    }
  }
}

function renderReadonlyConstraints() {
  const container = $("readonlyConstraints");
  container.innerHTML = STANDARD_CONSTRAINTS.map(
    (constraint) => `<div class="constraints-readonly__item">${constraint}</div>`
  ).join("");
}

function updatePrompt() {
  updateExistingOrgVisibility();
  updatePersonaBasedFilters();
  const state = readStateFromUI();
  const prompt = buildPrompt(state);
  $("output").value = prompt;

  const artifactText = state.artifacts && state.artifacts.length > 0 
    ? artifactNames(state.artifacts) 
    : "(none selected)";
  const orgModeText = state.orgMode === "ExistingOrg" ? "Brownfield" : "Greenfield";
  const meta = `${state.persona} • ${artifactText} • ${orgModeText} • ${state.workProduct}`;
  $("promptMeta").textContent = meta;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

async function copyPrompt() {
  const text = $("output").value || "";
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback
    $("output").focus();
    $("output").select();
    document.execCommand("copy");
  }
}

function downloadPrompt() {
  const state = readStateFromUI();
  const artifactPart = state.artifacts && state.artifacts.length > 0
    ? state.artifacts.join("-").toLowerCase()
    : "none";
  const nameParts = [
    "prompt",
    artifactPart,
    state.orgMode === "ExistingOrg" ? "existing-org" : "greenfield",
    state.workProduct.toLowerCase(),
  ];
  const filename = `${nameParts.join("_")}.md`;
  const blob = new Blob([$("output").value || ""], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  writeStateToUI({
    persona: "Developer",
    artifacts: ["LWC"],
    workProduct: "Build",
    orgMode: "Greenfield",
    goal: "",
    objects: "",
    users: "",
    requirements: "",
    existingComponents: "",
    knownIntegrations: "",
    orgComplexity: "",
    constraints: "",
    outputStyle: "Markdown",
    orgDetails: "",
    integration: "",
  });
  updatePersonaBasedFilters();
  updatePrompt();
}

function toggleHelpModal() {
  const modal = $("helpModal");
  modal.hidden = !modal.hidden;
  if (!modal.hidden) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
}

function init() {
  renderReadonlyConstraints();
  
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    saved = null;
  }
  if (saved) writeStateToUI(saved);
  
  // Apply persona-based filters before generating prompt
  updatePersonaBasedFilters();
  updatePrompt();

  const inputs = [
    "persona",
    "workProduct",
    "goal",
    "objects",
    "users",
    "requirements",
    "existingComponents",
    "knownIntegrations",
    "orgComplexity",
    "constraints",
    "outputStyle",
    "orgDetails",
    "integration",
  ];
  for (const id of inputs) {
    const el = $(id);
    if (el) {
      el.addEventListener("input", updatePrompt);
      el.addEventListener("change", updatePrompt);
    }
  }

  // Persona change should trigger filter update immediately
  $("persona").addEventListener("change", () => {
    updatePersonaBasedFilters();
    updatePrompt();
  });

  // Handle artifact checkboxes
  document.querySelectorAll('#artifactGroup input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", updatePrompt);
  });

  // Handle org mode radio buttons
  document.querySelectorAll('input[name="orgMode"]').forEach((radio) => {
    radio.addEventListener("change", updatePrompt);
  });

  $("btnCopy").addEventListener("click", copyPrompt);
  $("btnCopy2").addEventListener("click", copyPrompt);
  $("btnDownload").addEventListener("click", downloadPrompt);
  $("btnReset").addEventListener("click", resetAll);
  $("btnHelp").addEventListener("click", toggleHelpModal);
  $("btnCloseHelp").addEventListener("click", toggleHelpModal);
  
  // Close modal when clicking overlay
  $("helpModal").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal__overlay")) {
      toggleHelpModal();
    }
  });
  
  // Close modal with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("helpModal").hidden) {
      toggleHelpModal();
    }
  });
}

document.addEventListener("DOMContentLoaded", init);

