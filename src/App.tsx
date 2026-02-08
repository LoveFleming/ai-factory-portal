import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * AI Software Factory — UI Portal (Preview Demo)
 *
 * Home page is "Operations Center" style:
 * - Factory status summary
 * - Current runs
 * - Today's incidents
 * - Suggested next steps
 *
 * Notes:
 * - In-memory mock data only.
 * - Safety-first posture: external actions are blocked (Outbound Gate is MANUAL).
 */

type AppCategory = "Assets" | "Execution" | "Monitoring" | "Investigation" | "Settings";
type Risk = "safe" | "guarded" | "external";

type PortalApp = {
  id: string;
  title: string;
  category: AppCategory;
  description: string;
  tags: string[];
  risk: Risk;
};

type SkillEngine = "deterministic" | "cline";

type Skill = {
  id: string;
  title: string;
  codename: string;
  skills: string[];
  outputs: string[];
  engine: SkillEngine;
  risk: Risk;
  description: string;
};

type RunStatus = "queued" | "running" | "success" | "failed";

type Run = {
  id: string;
  title: string;
  createdAt: string;
  status: RunStatus;
  risk: Risk;
  engine: SkillEngine;
  logs: string[];
  aiJsonLines?: unknown[];
};

type FlowSpec = {
  id: string;
  name: string;
  description: string;
  dsl: string;
  nodes: Array<{ id: string; kind: "node" | "gate"; title: string; notes?: string }>;
};

type Runbook = {
  id: string;
  title: string;
  errorCodePrefix: string;
  updatedAt: string;
  summary: string;
};

type NodeConfig = {
  id: string;
  nodeType: string;
  owner: string;
  version: string;
  schemaSnippet: string;
};

type IncidentBundle = {
  id: string;
  createdAt: string;
  source: string;
  severity: "P1" | "P2" | "P3";
  summary: string;
};

function nowIso() {
  return new Date().toISOString();
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function randId() {
  return (
    Math.random().toString(16).slice(2) +
    Math.random().toString(16).slice(2) +
    Math.random().toString(16).slice(2)
  ).slice(0, 24);
}

function badgeClasses(risk: Risk) {
  if (risk === "safe") return "border-green-200 bg-green-50 text-green-700";
  if (risk === "guarded") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-700";
}

function statusClasses(s: RunStatus) {
  if (s === "success") return "bg-green-100 text-green-700";
  if (s === "failed") return "bg-red-100 text-red-700";
  if (s === "running") return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs", badgeClasses(risk))}>
      <span className="inline-block h-2 w-2 rounded-full bg-current opacity-60" />
      {risk}
    </span>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <pre className="overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
      {text}
    </pre>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="px-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</div>
      {children}
    </div>
  );
}

function NavItem({
  active,
  label,
  onClick,
  right,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm",
        active ? "bg-zinc-900 text-white" : "bg-white text-zinc-800 hover:bg-zinc-50"
      )}
    >
      <span className="truncate">{label}</span>
      {right}
    </button>
  );
}

function SelfTests() {
  // Small tests to catch regressions without adding a test runner.
  console.assert(shortId("1234567890") === "12345678", "shortId should return 8 chars");
  console.assert(!!safeJsonParse("{\"a\":1}"), "safeJsonParse should parse valid JSON");
  console.assert(safeJsonParse("nope") === null, "safeJsonParse should return null for invalid JSON");
  return null;
}

const APPS: PortalApp[] = [
  {
    id: "assets.orchestrator",
    title: "Orchestrator Viewer",
    category: "Assets",
    description: "Browse flows, visualize nodes/gates, inspect execution contracts and golden path.",
    tags: ["flow spec", "contracts", "viewer"],
    risk: "safe",
  },
  {
    id: "assets.runbooks",
    title: "Runbook Library",
    category: "Assets",
    description: "Search runbooks by error code, component, symptom. Keep troubleshooting closed-loop.",
    tags: ["error code", "RCA", "closed-loop"],
    risk: "safe",
  },
  {
    id: "assets.storybook",
    title: "Node Storybook",
    category: "Assets",
    description: "Preview low-code nodes as reusable building blocks (UI + contract + examples).",
    tags: ["storybook", "examples"],
    risk: "safe",
  },
  {
    id: "exec.skills",
    title: "Skill Center",
    category: "Execution",
    description: "Trigger skills (employees) like codegen, lint, gates. Runs stay in dev sandbox.",
    tags: ["skills", "jobs", "queue"],
    risk: "guarded",
  },
  {
    id: "exec.gates",
    title: "Gates & Lints",
    category: "Execution",
    description: "Run deterministic quality gates: contract compile, unit+coverage, e2e, runbook lint.",
    tags: ["Q1-Q4", "deterministic"],
    risk: "safe",
  },
  {
    id: "mon.report",
    title: "Monitoring Report Generator",
    category: "Monitoring",
    description: "Generate daily/weekly health reports from incident bundles / snapshots (sandbox copy).",
    tags: ["AI report", "observability"],
    risk: "guarded",
  },
  {
    id: "inv.rca",
    title: "Incident Investigator",
    category: "Investigation",
    description: "Load an incident bundle and ask AI employees to produce RCA draft + runbook patch.",
    tags: ["incident bundle", "RCA"],
    risk: "guarded",
  },
];

const SKILLS: Skill[] = [
  {
    id: "ai.spec",
    title: "Spec Writer",
    codename: "SpecScribe",
    skills: ["Extract user stories from requirements/legacy code", "Define API & Data contracts", "Draft flow specs"],
    outputs: ["spec.md", "flow.dsl", "contract.json"],
    engine: "cline",
    risk: "safe",
    description: "Specialized in transforming fuzzy requirements into technical specifications.",
  },
  {
    id: "ai.api",
    title: "API Designer",
    codename: "ApiForge",
    skills: ["REST resource design", "Error code cataloging (BIZ/SYS/ORCH)", "Versioning strategy", "Compatibility checks"],
    outputs: ["OpenAPI spec", "error_code_catalog.json", "breaking_change_report.md"],
    engine: "deterministic",
    risk: "safe",
    description: "Architects robust and consistent API interfaces.",
  },
  {
    id: "ai.contract",
    title: "Data Contract Guardian",
    codename: "ContractSentinel",
    skills: ["Schema validation", "Input/Output contract gating (Q1)", "Edge case coverage analysis"],
    outputs: ["contract_lint_report.json", "root_cause_analysis.txt", "fix_suggestions.md"],
    engine: "deterministic",
    risk: "safe",
    description: "Ensures data integrity and strict schema compliance.",
  },
  {
    id: "ai.unit",
    title: "Unit Test Assistant",
    codename: "UnitSmith",
    skills: ["Generate unit tests from spec", "Mock external dependencies", "Enforce Sonar/style guides"],
    outputs: ["*Test.ts / *Test.java", "test_case_list.md"],
    engine: "cline",
    risk: "safe",
    description: "Writes robust unit tests to verify component logic.",
  },
  {
    id: "ai.coverage",
    title: "Coverage Analyst",
    codename: "CoverageHawk",
    skills: ["Analyze JaCoCo/coverage reports", "Identify uncovered branches", "Generate minimal incremental test strategies"],
    outputs: ["coverage_gap_list.json", "path_to_100_percent.md"],
    engine: "deterministic",
    risk: "safe",
    description: "Hunts down untested code paths to ensure full coverage.",
  },
  {
    id: "ai.e2e",
    title: "E2E Runner",
    codename: "PlaywrightPilot",
    skills: ["Generate/Maintain E2E scripts", "Golden Path verification", "Regression testing strategy (Q3)"],
    outputs: ["playwright_scripts.ts", "failure_reproduction_steps.md", "flaky_test_report.json"],
    engine: "deterministic",
    risk: "safe",
    description: "Orchestrates end-to-end user journey tests.",
  },
  {
    id: "ai.runbook",
    title: "Runbook Maker",
    codename: "RunbookMedic",
    skills: ["Map error codes to runbooks", "Template troubleshooting steps", "Closed-loop updates (Q4)"],
    outputs: ["runbook.md", "runbook_fix_pr.md"],
    engine: "cline",
    risk: "safe",
    description: "Keeps operational knowledge bases up-to-date and actionable.",
  },
  {
    id: "ai.flow",
    title: "Flow Orchestrator Reviewer",
    codename: "FlowInspector",
    skills: ["Review flow spec/DSL", "Check node responsibility boundaries", "Highlight key risk points"],
    outputs: ["flow_review_comments.md", "observability_suggestions.json", "refactoring_list.md"],
    engine: "deterministic",
    risk: "safe",
    description: "Validates orchestration logic and architectural patterns.",
  },
  {
    id: "ai.rca",
    title: "Incident Investigator",
    codename: "RCA Detective",
    skills: ["Analyze incident bundles", "Correlate traces/logs/metrics", "Infer root causes and propose fixes"],
    outputs: ["rca_draft.md", "action_items.md", "runbook_patch.md"],
    engine: "cline",
    risk: "guarded",
    description: "Investigates production incidents to find root causes.",
  },
  {
    id: "ai.gatekeeper",
    title: "Safety Gatekeeper",
    codename: "OutboundGate",
    skills: ["Audit external interactions (PR/API)", "Manage allowlists/denylists", "Maintain audit trails"],
    outputs: ["approval_decision.json", "least_privilege_policy.json", "audit_log.json"],
    engine: "deterministic",
    risk: "external",
    description: "Guards the factory boundary and enforces safety policies.",
  },
];

const FLOWS: FlowSpec[] = [
  {
    id: "flow.hold-lot",
    name: "Hold Lot Orchestrator",
    description: "Example flow: query triggers → validate → call external hold registration → record execution.",
    dsl: `BLOCK:execute
  RUN queryTriggerRule E:PROPAGATE
  FOR_EACH triggerRules
    CALL queryCandidateLot E:LOGGER

BLOCK:queryCandidateLot
  RUN queryCandidateLot E:PROPAGATE
  FOR_EACH candidateLots
    COUNTER:candidateLotCounter
    CALL validateCandidateLot E:holdLotCounter,errorLogger

BLOCK:validateCandidateLot
  RUN queryLastInstruction
  BIZ queryLastInstruction : isGreaterThanZero
  THEN CALL requestTxHoldReg : ORCH-ERR
`,
    nodes: [
      { id: "n1", kind: "node", title: "queryTriggerRule", notes: "Reads rules from ES" },
      { id: "n2", kind: "node", title: "queryCandidateLot", notes: "Fetches candidate lots" },
      { id: "n3", kind: "node", title: "validateCandidateLot", notes: "BIZ checks; emits BIZ errors" },
      { id: "g1", kind: "gate", title: "Q2 Unit + Coverage", notes: "Must pass before PR" },
      { id: "g2", kind: "gate", title: "Q4 Runbook Lint", notes: "Error-code mapping required" },
    ],
  },
  {
    id: "flow.phase-giga",
    name: "Giga API Orchestrator",
    description: "Example: resolve phase via AfterService then query phase APIs (anti-corruption layer).",
    dsl: `BLOCK:execute
  CALL afterService.resolvePhase E:PROPAGATE
  CALL phaseApi.queryByLot E:PROPAGATE
  VALIDATE response.contract
  RECORD execution
`,
    nodes: [
      { id: "n1", kind: "node", title: "afterService.resolvePhase", notes: "Anti-corruption resolver" },
      { id: "n2", kind: "node", title: "phaseApi.queryByLot", notes: "External client" },
      { id: "g1", kind: "gate", title: "Q1 Contract Compile", notes: "Schema validate" },
      { id: "g2", kind: "gate", title: "Q3 E2E", notes: "Happy path" },
    ],
  },
];

const RUNBOOKS: Runbook[] = [
  { id: "rb.sys-http-timeout", title: "SYS_HTTP_TIMEOUT — outbound call timed out", errorCodePrefix: "SYS_HTTP_", updatedAt: nowIso(), summary: "Check endpoint health, retry policy, circuit breaker, and requestId correlation." },
  { id: "rb.biz-invalid-state", title: "BIZ_INVALID_STATE — business rule violation", errorCodePrefix: "BIZ_", updatedAt: nowIso(), summary: "Confirm input constraints, case status, and provide user-facing guidance." },
  { id: "rb.orch-external", title: "ORCH_EXTERNAL_ERROR — upstream returned error", errorCodePrefix: "ORCH_", updatedAt: nowIso(), summary: "Capture ExternalError fields, mask secrets, map to runbook, keep traceId." },
];



const INCIDENTS: IncidentBundle[] = [
  { id: "inc-2026-02-07-001", createdAt: nowIso(), source: "observability-snapshot", severity: "P2", summary: "Phase API intermittent 502; increased latency; user reports slow query." },
  { id: "inc-2026-02-06-003", createdAt: nowIso(), source: "oncall-digest", severity: "P3", summary: "Runbook missing for new error code SYS_HTTP_TLS_HANDSHAKE." },
];

function groupByCategory(apps: PortalApp[]) {
  const map = new Map<AppCategory, PortalApp[]>();
  for (const a of apps) {
    const cur = map.get(a.category) ?? [];
    cur.push(a);
    map.set(a.category, cur);
  }
  return map;
}

export default function App() {
  const [search, setSearch] = useState("");
  const [activeAppId, setActiveAppId] = useState<string>("home");

  const [selectedFlowId, setSelectedFlowId] = useState(FLOWS[0]?.id ?? "");
  const [runbookQuery, setRunbookQuery] = useState("");
  const [nodeQuery, setNodeQuery] = useState("");
  const [incidentQuery, setIncidentQuery] = useState("");

  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(INCIDENTS[0]?.id ?? null);
  const [viewingEmployee, setViewingEmployee] = useState<Skill | null>(null);

  const appGroups = useMemo(() => groupByCategory(APPS), []);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return APPS;
    return APPS.filter((a) => [a.title, a.description, a.category, a.tags.join(" ")].join(" ").toLowerCase().includes(q));
  }, [search]);

  const selectedFlow = useMemo(() => FLOWS.find((f) => f.id === selectedFlowId) ?? FLOWS[0], [selectedFlowId]);

  const runbooksFiltered = useMemo(() => {
    const q = runbookQuery.trim().toLowerCase();
    if (!q) return RUNBOOKS;
    return RUNBOOKS.filter((r) => [r.title, r.errorCodePrefix, r.summary].join(" ").toLowerCase().includes(q));
  }, [runbookQuery]);



  const incidentsFiltered = useMemo(() => {
    const q = incidentQuery.trim().toLowerCase();
    if (!q) return INCIDENTS;
    return INCIDENTS.filter((i) => [i.id, i.summary, i.source, i.severity].join(" ").toLowerCase().includes(q));
  }, [incidentQuery]);

  const selectedRun = useMemo(() => (selectedRunId ? runs.find((r) => r.id === selectedRunId) ?? null : null), [runs, selectedRunId]);

  const selectedIncident = useMemo(() => (selectedIncidentId ? INCIDENTS.find((i) => i.id === selectedIncidentId) ?? null : null), [selectedIncidentId]);

  const recentRuns = useMemo(() => [...runs].slice(0, 8), [runs]);

  const testedRef = useRef(false);
  useEffect(() => {
    if (!testedRef.current) {
      testedRef.current = true;
      SelfTests();
    }
  }, []);

  const runSkill = async (skill: Skill) => {
    const r: Run = {
      id: randId(),
      title: skill.title,
      createdAt: nowIso(),
      status: "queued",
      risk: skill.risk,
      engine: skill.engine,
      logs: [`[queue] queued: ${skill.id}`],
      aiJsonLines: [],
    };

    setRuns((xs) => [r, ...xs]);
    setSelectedRunId(r.id);
    setActiveAppId("exec.skills");

    const pushLog = (line: string) => {
      r.logs.push(line);
      setRuns((xs) => xs.map((x) => (x.id === r.id ? { ...r } : x)));
    };

    const finish = (status: RunStatus) => {
      r.status = status;
      pushLog(`[done] ${status}`);
      setRuns((xs) => xs.map((x) => (x.id === r.id ? { ...r } : x)));
    };

    if (skill.risk === "external") {
      pushLog("[policy] external access is LOCKED (requires Outbound Gate approval)");
      finish("failed");
      return;
    }

    r.status = "running";
    pushLog(`[start] engine=${skill.engine} risk=${skill.risk}`);

    const steps =
      skill.engine === "deterministic"
        ? ["validate inputs", "run tools", "collect artifacts", "record execution"]
        : ["load context", "plan patch", "generate diff", "suggest next gates", "record execution"];

    for (const s of steps) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 320));
      pushLog(`[step] ${s}`);
    }

    if (skill.engine === "cline") {
      const fail = Math.random() < 0.25;
      const ai = fail
        ? [
          { kind: "rca", rootCause: "Missing runbook mapping for new error code", evidence: ["rb missing", "lint failed"] },
          { kind: "next", actions: ["Add runbook stub", "Re-run Q4", "Open PR via Outbound Gate"] },
          { kind: "patch", files: ["runbooks/SYS_HTTP_TLS_HANDSHAKE.md"] },
        ]
        : [
          { kind: "summary", message: "Generated patch & suggested tests" },
          { kind: "patch", files: ["src/nodes/FooNode.ts", "src/nodes/__tests__/FooNode.test.ts"] },
        ];

      r.aiJsonLines = ai;
      pushLog("[AI] json lines emitted");
      setRuns((xs) => xs.map((x) => (x.id === r.id ? { ...r } : x)));
      finish(fail ? "failed" : "success");
      return;
    }

    finish("success");
  };

  const openApp = (id: string) => setActiveAppId(id);

  const currentAppTitle = useMemo(() => {
    if (activeAppId === "home") return "Dashboard";
    return APPS.find((a) => a.id === activeAppId)?.title ?? "Dashboard";
  }, [activeAppId]);

  const labelFor = (id: string) => {
    if (id === "home") return "Home";
    return APPS.find((a) => a.id === id)?.title ?? id;
  };

  const riskForApp = (id: string): Risk => {
    if (id === "home") return "safe";
    return APPS.find((a) => a.id === id)?.risk ?? "safe";
  };

  const nav = useMemo(() => {
    return {
      Assets: (appGroups.get("Assets") ?? []).map((a) => a.id),
      Execution: (appGroups.get("Execution") ?? []).map((a) => a.id),
      Monitoring: (appGroups.get("Monitoring") ?? []).map((a) => a.id),
      Investigation: (appGroups.get("Investigation") ?? []).map((a) => a.id),
    } as Record<AppCategory, string[]>;
  }, [appGroups]);

  // Operations Center metrics
  const todayIncidentCounts = useMemo(() => {
    const counts = { P1: 0, P2: 0, P3: 0 };
    for (const i of INCIDENTS) counts[i.severity] += 1;
    return counts;
  }, []);

  const runCounts = useMemo(() => {
    const c: Record<RunStatus, number> = { queued: 0, running: 0, success: 0, failed: 0 };
    for (const r of runs) c[r.status] += 1;
    return c;
  }, [runs]);

  const currentRuns = useMemo(() => runs.filter((r) => r.status === "queued" || r.status === "running").slice(0, 8), [runs]);
  const todayIncidents = useMemo(() => [...INCIDENTS].slice(0, 8), []);

  const suggestions = useMemo(() => {
    const next: Array<{
      id: string;
      title: string;
      desc: string;
      cta: { label: string; action: () => void };
      risk: Risk;
    }> = [];

    const failed = runs.find((r) => r.status === "failed");
    if (failed) {
      next.push({
        id: "sug.failed",
        title: "Fix failed run",
        desc: `A run failed: "${failed.title}". Open Skill Center to inspect logs and re-run a gate if needed.`,
        cta: { label: "Open Run Console", action: () => { setSelectedRunId(failed.id); setActiveAppId("exec.skills"); } },
        risk: "safe",
      });
    }

    const hasP1P2 = (todayIncidentCounts.P1 + todayIncidentCounts.P2) > 0;
    if (hasP1P2) {
      next.push({
        id: "sug.rca",
        title: "Run AI RCA for high severity incident",
        desc: "Analyze incident bundle in sandbox and draft RCA + runbook patch (no prod writes).",
        cta: { label: "Open Investigator", action: () => setActiveAppId("inv.rca") },
        risk: "guarded",
      });
    }

    const runbookGap = INCIDENTS.some((i) => i.summary.toLowerCase().includes("runbook missing"));
    if (runbookGap) {
      const runbookMaker = SKILLS.find((s) => s.id === "ai.runbook")!;
      next.push({
        id: "sug.q4",
        title: "Close runbook gaps (RunbookMedic)",
        desc: "Run Runbook Maker to catch missing error-code ↔ runbook mappings.",
        cta: { label: "Run RunbookMedic", action: () => { void runSkill(runbookMaker); } },
        risk: "safe",
      });
    }

    const codegen = SKILLS.find((s) => s.id === "ai.unit")!;
    next.push({
      id: "sug.codegen",
      title: "Generate tests from spec (UnitSmith)",
      desc: "Use Unit Test Assistant to draft tests and implementation.",
      cta: { label: "Run UnitSmith", action: () => { void runSkill(codegen); } },
      risk: "safe",
    });

    const gatekeeper = SKILLS.find((s) => s.id === "ai.gatekeeper")!;
    next.push({
      id: "sug.pr",
      title: "Prepare PR (OutboundGate)",
      desc: "External action is locked by default. This demonstrates manual approval workflow.",
      cta: { label: "Ask Gatekeeper", action: () => { void runSkill(gatekeeper); } },
      risk: "external",
    });

    return next.slice(0, 5);
  }, [runs, todayIncidentCounts.P1, todayIncidentCounts.P2, todayIncidentCounts.P3]);

  const renderOperationsCenter = () => {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm text-zinc-500">AI Software Factory</div>
              <div className="mt-1 text-2xl font-bold text-zinc-900">Dashboard</div>
              <div className="mt-2 text-sm text-zinc-600">
                One screen to understand factory posture, runs, incidents, and next best actions — all inside dev sandbox.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700">
                Environment: <span className="font-mono">DEV_SANDBOX</span>
              </span>
              <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs text-green-700">
                External access: <span className="font-semibold">LOCKED</span>
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800">
                Outbound Gate: <span className="font-semibold">MANUAL</span>
              </span>
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:col-span-2">
            <div className="text-xs text-zinc-500">Factory Health</div>
            <div className="mt-1 text-lg font-semibold">Healthy</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-500">Employees</div>
                <div className="mt-1 text-sm font-semibold">{SKILLS.length}</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-500">Assets</div>
                <div className="mt-1 text-sm font-semibold">{FLOWS.length + RUNBOOKS.length}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-zinc-500">Runs (today)</div>
            <div className="mt-1 text-lg font-semibold">{runs.length}</div>
            <div className="mt-3 space-y-1 text-xs text-zinc-600">
              <div className="flex justify-between"><span>queued</span><span className="font-mono">{runCounts.queued}</span></div>
              <div className="flex justify-between"><span>running</span><span className="font-mono">{runCounts.running}</span></div>
              <div className="flex justify-between"><span>success</span><span className="font-mono">{runCounts.success}</span></div>
              <div className="flex justify-between"><span>failed</span><span className="font-mono">{runCounts.failed}</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-zinc-500">Incidents (today)</div>
            <div className="mt-1 text-lg font-semibold">{INCIDENTS.length}</div>
            <div className="mt-3 space-y-1 text-xs text-zinc-600">
              <div className="flex justify-between"><span>P1</span><span className="font-mono">{todayIncidentCounts.P1}</span></div>
              <div className="flex justify-between"><span>P2</span><span className="font-mono">{todayIncidentCounts.P2}</span></div>
              <div className="flex justify-between"><span>P3</span><span className="font-mono">{todayIncidentCounts.P3}</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-zinc-500">Runbook Coverage</div>
            <div className="mt-1 text-lg font-semibold">92%</div>
            <div className="mt-3 text-xs text-zinc-600">
              Q4 will fail if any errorCode has no runbook mapping.
            </div>
            <button
              onClick={() => setActiveAppId("assets.runbooks")}
              className="mt-3 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              Open Runbooks
            </button>
          </div>
        </div>

        {/* Three columns */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card
            title="Current Runs"
            right={
              <button
                onClick={() => setActiveAppId("exec.skills")}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm hover:bg-zinc-50"
              >
                Open Skill Center
              </button>
            }
          >
            {currentRuns.length === 0 ? (
              <div className="text-sm text-zinc-500">No running/queued jobs. Trigger a skill to start work.</div>
            ) : (
              <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
                {currentRuns.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRunId(r.id);
                      setActiveAppId("exec.skills");
                    }}
                    className="flex w-full items-center justify-between gap-3 bg-white p-3 text-left hover:bg-zinc-50"
                  >
                    <div>
                      <div className="text-sm font-semibold">{r.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {fmtTime(r.createdAt)} · engine={r.engine} · risk={r.risk}
                      </div>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs", statusClasses(r.status))}>{r.status}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="Today Incidents" right={<span className="text-xs text-zinc-500">bundles</span>}>
            <div className="space-y-2">
              {todayIncidents.map((i) => (
                <button
                  key={i.id}
                  onClick={() => {
                    setSelectedIncidentId(i.id);
                    setActiveAppId("inv.rca");
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-left hover:bg-zinc-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{i.id}</div>
                      <div className="mt-1 text-xs text-zinc-600">{i.summary}</div>
                      <div className="mt-2 text-xs text-zinc-500">
                        {fmtTime(i.createdAt)} · source=<span className="font-mono">{i.source}</span>
                      </div>
                    </div>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700">
                      {i.severity}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Suggested Next Steps">
            <div className="space-y-3">
              {suggestions.map((s) => (
                <div key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{s.title}</div>
                      <div className="mt-1 text-xs text-zinc-600">{s.desc}</div>
                      <div className="mt-2">
                        <RiskBadge risk={s.risk} />
                      </div>
                    </div>
                    <button
                      onClick={s.cta.action}
                      className={cn(
                        "h-fit rounded-xl border px-3 py-2 text-xs shadow-sm hover:bg-zinc-50",
                        s.risk === "external" ? "border-red-200 bg-red-50 text-red-700" : "border-zinc-200 bg-white text-zinc-900"
                      )}
                    >
                      {s.cta.label}
                    </button>
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                <div className="font-semibold text-zinc-700">Safety-first rules (preview)</div>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>AI write actions are patch-only by default</li>
                  <li>External actions require manual Outbound Gate approval</li>
                  <li>All runs produce audit trails + artifacts</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Shortcuts */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {[
            { id: "assets.orchestrator", title: "Browse Orchestrators", desc: "Flow spec + nodes/gates viewer" },
            { id: "exec.gates", title: "Run Gates & Lints", desc: "Q1–Q4 deterministic pipeline" },
            { id: "mon.report", title: "Generate Monitoring Report", desc: "AI-assisted report from snapshots" },
            { id: "assets.orchestrator", title: "Browse Orchestrators", desc: "Flow spec + nodes/gates viewer" },
            { id: "exec.gates", title: "Run Gates & Lints", desc: "Q1–Q4 deterministic pipeline" },
            { id: "mon.report", title: "Generate Monitoring Report", desc: "AI-assisted report from snapshots" },
          ].map((x) => (
            <button
              key={x.id}
              onClick={() => setActiveAppId(x.id)}
              className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:bg-zinc-50"
            >
              <div className="text-sm font-semibold">{x.title}</div>
              <div className="mt-1 text-xs text-zinc-600">{x.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderOrchestratorViewer = () => {
    if (!selectedFlow) return <div className="text-sm text-zinc-500">No flow selected.</div>;

    return (
      <div className="space-y-4">
        <Card
          title="Flow Spec"
          right={
            <select
              value={selectedFlowId}
              onChange={(e) => setSelectedFlowId(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {FLOWS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          }
        >
          <div className="space-y-3">
            <div className="text-sm font-semibold text-zinc-900">{selectedFlow.name}</div>
            <div className="text-sm text-zinc-600">{selectedFlow.description}</div>
            <CodeBlock text={selectedFlow.dsl} />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Nodes & Gates">
            <div className="space-y-2">
              {selectedFlow.nodes.map((n) => (
                <div key={n.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {n.kind === "gate" ? "✅" : "🔩"} {n.title}
                      </div>
                      {n.notes ? <div className="mt-1 text-xs text-zinc-600">{n.notes}</div> : null}
                    </div>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] text-zinc-700">
                      {n.kind}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Execution Contract (Preview)">
            <div className="space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                <div className="font-semibold">Golden Path Contract</div>
                <div className="mt-1 font-mono">inputs → node input contract → node output contract → runner record</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="text-xs font-semibold text-zinc-700">Runbook linkage</div>
                <div className="mt-2 text-xs text-zinc-600">Every errorCode must map to runbook ID. Q4 fails if missing.</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="text-xs font-semibold text-zinc-700">Traceability</div>
                <div className="mt-2 text-xs text-zinc-600">traceId → execution record → ES → incident bundle snapshot</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderRunbooks = () => (
    <div className="space-y-4">
      <Card
        title="Runbook Library"
        right={
          <input
            value={runbookQuery}
            onChange={(e) => setRunbookQuery(e.target.value)}
            placeholder="Search by error code / keyword"
            className="w-64 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        }
      >
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
          {runbooksFiltered.map((rb) => (
            <div key={rb.id} className="bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{rb.title}</div>
                  <div className="mt-1 text-xs text-zinc-600">{rb.summary}</div>
                  <div className="mt-2 text-xs text-zinc-500">
                    prefix: <span className="font-mono">{rb.errorCodePrefix}</span> · updated {fmtTime(rb.updatedAt)}
                  </div>
                </div>
                <button className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm hover:bg-zinc-50">Open</button>
              </div>
            </div>
          ))}
          {!runbooksFiltered.length ? <div className="p-4 text-sm text-zinc-500">No results.</div> : null}
        </div>
      </Card>

      <Card title="Runbook Authoring (Preview)">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
          <div className="font-semibold">Suggested structure</div>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>errorCode · category · severity</li>
            <li>symptoms · quick checks · decision tree</li>
            <li>commands (sandbox-safe) · dashboards · logs to inspect</li>
            <li>fix steps · verification · rollback</li>
          </ul>
        </div>
      </Card>
    </div>
  );

  const renderStorybook = () => (
    <div className="space-y-4">
      <Card title="Node Storybook">
        <div className="space-y-3">
          <div className="text-sm text-zinc-700">A catalog of nodes with examples. This makes onboarding teachable.</div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {[
              { title: "HttpClientNode", example: "GET /phase-api by lotId", notes: "Shows retries/timeout schema; outputs ExternalError record." },
              { title: "RunbookLintGate", example: "Enforce errorCode→runbook mapping", notes: "Fails build if runbook missing." },
              { title: "AfterServiceNode", example: "Resolve phase from lotId", notes: "Anti-corruption adapter; caches results." },
              { title: "ExecutionRecordWriter", example: "Write traceId + steps to ES", notes: "Enables incident bundle snapshots." },
            ].map((x) => (
              <div key={x.title} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{x.title}</div>
                    <div className="mt-1 text-xs text-zinc-600">Example: {x.example}</div>
                    <div className="mt-2 text-xs text-zinc-500">{x.notes}</div>
                  </div>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] text-zinc-700">node</span>
                </div>
                <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">Preview panel (placeholder)</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );

  const renderSkillCenter = () => (
    <div className="space-y-4">
      {/* Top Section: Employees Grid */}
      <Card title="AI Employees">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          {SKILLS.map((s) => (
            <button
              key={s.id}
              onClick={(e) => {
                e.stopPropagation();
                setViewingEmployee(s);
              }}
              className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-left transition-all hover:bg-white hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-900">{s.title}</div>
                  <RiskBadge risk={s.risk} />
                </div>
                <div className="mt-1 text-xs text-zinc-500 line-clamp-2">{s.description}</div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-600 font-mono">
                  {s.codename}
                </span>
                <div
                  className="rounded-lg bg-zinc-900 px-2 py-1 text-[10px] text-white shadow-sm hover:bg-zinc-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    void runSkill(s);
                  }}
                >
                  Run
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Bottom Section: Console & History */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card
            title="Run Console"
            right={
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">selected</span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-mono text-zinc-700">
                  {selectedRun ? shortId(selectedRun.id) : "—"}
                </span>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
                  {selectedRun ? selectedRun.logs.join("\n") : "No run selected."}
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="text-xs text-zinc-500">Status</div>
                  <div className={cn("mt-1 inline-flex rounded-full px-3 py-1 text-xs", selectedRun ? statusClasses(selectedRun.status) : "bg-zinc-100 text-zinc-700")}>
                    {selectedRun?.status ?? "—"}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">Created</div>
                  <div className="mt-1 text-xs font-mono text-zinc-800">{selectedRun ? fmtTime(selectedRun.createdAt) : "—"}</div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="text-xs font-semibold text-zinc-700">Outbound Gate</div>
                  <div className="mt-2 text-xs text-zinc-600">External actions are blocked. Use manual approval to enable PR creation.</div>
                  <button disabled className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-500">
                    Approve & Open PR (disabled)
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="AI Inspector">
            <div className="h-48 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
              {!selectedRun?.aiJsonLines?.length ? (
                <div className="text-zinc-500">No AI output for this run (or deterministic run).</div>
              ) : (
                <div className="space-y-2">
                  {selectedRun.aiJsonLines.map((x, i) => (
                    <pre key={i} className="whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-2">
                      {JSON.stringify(x, null, 2)}
                    </pre>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div>
          <Card title="Runs History">
            <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
              {runs.length === 0 ? (
                <div className="p-4 text-sm text-zinc-500">No runs yet.</div>
              ) : (
                runs.slice(0, 12).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRunId(r.id)}
                    className={cn("flex w-full items-center justify-between gap-3 bg-white p-3 text-left hover:bg-zinc-50", selectedRunId === r.id && "bg-zinc-50")}
                  >
                    <div>
                      <div className="text-sm font-semibold">{r.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {fmtTime(r.createdAt)} · {r.engine}
                      </div>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs", statusClasses(r.status))}>{r.status}</span>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderGates = () => (
    <div className="space-y-4">
      <Card title="Gates & Lints">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {SKILLS.filter((s) => ["ai.contract", "ai.unit", "ai.coverage", "ai.e2e", "ai.runbook"].includes(s.id)).map((s) => (
            <div key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="mt-1 text-xs text-zinc-600">{s.description}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <RiskBadge risk={s.risk} />
                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-700">deterministic</span>
                  </div>
                </div>
                <button onClick={() => void runSkill(s)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm hover:bg-zinc-50">
                  Run
                </button>
              </div>
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                Output artifacts: junit.xml · jacoco.xml/html · e2e traces · lint report
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Quality Gate Policy (Preview)">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
          <div className="font-semibold">Default pipeline</div>
          <div className="mt-2 font-mono">Q1 → Q2 → Q3 → Q4 → (manual approval) → PR</div>
        </div>
      </Card>
    </div>
  );

  const renderMonitoring = () => (
    <div className="space-y-4">
      <Card title="Monitoring Report Generator">
        <div className="space-y-3">
          <div className="text-sm text-zinc-700">Generate reports from sandbox snapshots (not direct production write-access).</div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {["Daily On-call Digest", "Weekly Stability Report", "Top Error Codes + Runbook Coverage"].map((t) => (
              <div key={t} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{t}</div>
                    <div className="mt-1 text-xs text-zinc-600">Uses incident bundles + execution records.</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <RiskBadge risk="guarded" />
                      <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-700">AI-assisted</span>
                    </div>
                  </div>
                  <button
                    onClick={() => void runSkill(SKILLS.find((s) => s.id === "ai.rca")!)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm hover:bg-zinc-50"
                  >
                    Generate
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                  Output: markdown/pdf · charts · action items · runbook gaps
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );

  const renderRca = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="Incident Bundles"
          right={
            <input
              value={incidentQuery}
              onChange={(e) => setIncidentQuery(e.target.value)}
              placeholder="Search incidents"
              className="w-56 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          }
        >
          <div className="space-y-2">
            {incidentsFiltered.map((i) => (
              <button
                key={i.id}
                onClick={() => setSelectedIncidentId(i.id)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-left",
                  selectedIncidentId === i.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{i.id}</div>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700">{i.severity}</span>
                </div>
                <div className={cn("mt-1 text-xs", selectedIncidentId === i.id ? "text-zinc-200" : "text-zinc-600")}>{i.summary}</div>
              </button>
            ))}
            {!incidentsFiltered.length ? <div className="text-sm text-zinc-500">No results.</div> : null}
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card
            title="Investigation Workspace"
            right={
              <button
                onClick={() => void runSkill(SKILLS.find((s) => s.id === "ai.rca")!)}
                className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
              >
                Run AI RCA
              </button>
            }
          >
            {!selectedIncident ? (
              <div className="text-sm text-zinc-500">Select an incident bundle to inspect.</div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="text-sm font-semibold">{selectedIncident.id}</div>
                  <div className="mt-1 text-xs text-zinc-600">{selectedIncident.summary}</div>
                  <div className="mt-2 text-xs text-zinc-500">
                    source: <span className="font-mono">{selectedIncident.source}</span> · created {fmtTime(selectedIncident.createdAt)}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                    <div className="font-semibold">Bundle contents (preview)</div>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>logs (masked)</li>
                      <li>metrics (snapshot)</li>
                      <li>traces (sampled)</li>
                      <li>execution records</li>
                      <li>runbook coverage report</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
                    <div className="font-semibold text-zinc-700">Safety posture</div>
                    <div className="mt-2">AI can read bundle + propose patch. No production writes.</div>
                    <div className="mt-2">PR creation is external and must go through Outbound Gate.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="text-xs font-semibold text-zinc-700">Ask AI (preview)</div>
                  <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                    “Analyze the incident bundle, identify the most likely root cause, and propose a runbook patch + verification steps.”
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card title="Suggested Outputs">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {["RCA draft", "Runbook patch", "Verification plan"].map((t) => (
                <div key={t} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-sm font-semibold">{t}</div>
                  <div className="mt-2 text-xs text-zinc-600">Generated inside dev sandbox; reviewed before outbound.</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (activeAppId === "home") return renderOperationsCenter();
    if (activeAppId === "assets.orchestrator") return renderOrchestratorViewer();
    if (activeAppId === "assets.runbooks") return renderRunbooks();
    if (activeAppId === "assets.storybook") return renderStorybook();
    if (activeAppId === "exec.skills") return renderSkillCenter();
    if (activeAppId === "exec.gates") return renderGates();
    if (activeAppId === "mon.report") return renderMonitoring();
    if (activeAppId === "inv.rca") return renderRca();
    // Default fallback
    return renderSkillCenter();
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Top Header */}

      <div className="mx-auto flex max-w-7xl gap-4 p-4">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 space-y-6">
          <div className="mb-8 px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-950 text-white shadow-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-white"
                >
                  <path d="M2.25 21h19.5" />
                  <path d="M5.25 21V9.75H2.25l3.75-6 6 6v-3h7.5A2.25 2.25 0 0121.75 9v12" />
                  <path d="M12 21v-7.5" />
                  <path d="M16.5 21v-3.75" />
                  <path d="M9 12h.008v.008H9V12z" />
                  <path d="M9 15h.008v.008H9V15z" />
                  <path d="M9 18h.008v.008H9V18z" />
                  <path d="M16.5 12h.008v.008H16.5V12z" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight text-zinc-900">Factory Portal</div>
                <div className="text-xs font-medium text-zinc-500">AI Software Factory</div>
              </div>
            </div>

            <button
              onClick={() => setActiveAppId("home")}
              className={cn(
                "mt-6 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all",
                activeAppId === "home"
                  ? "bg-zinc-900 text-white shadow-md ring-1 ring-zinc-900/10"
                  : "bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 shadow-sm ring-1 ring-zinc-200"
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 opacity-70">
                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              Dashboard
            </button>
          </div>

          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
            {(Object.keys(nav) as AppCategory[]).map((cat) => (
              <SidebarSection key={cat} title={cat}>
                <div className="space-y-1">
                  {(nav[cat] ?? []).map((id) => {
                    const active = activeAppId === id;
                    const risk = riskForApp(id);
                    return (
                      <NavItem
                        key={id}
                        active={active}
                        label={labelFor(id)}
                        onClick={() => setActiveAppId(id)}
                        right={
                          <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", active ? "border-white/40 bg-white/10 text-white" : badgeClasses(risk))}>
                            {risk}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              </SidebarSection>
            ))}
          </div>


        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 space-y-4">


          {renderContent()}

          {/* Employee Detail Modal (CLI Style) */}
          {viewingEmployee && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setViewingEmployee(null)}>
              <div
                className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-700 bg-[#1e1e1e] font-mono text-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* CLI Header */}
                <div className="flex items-center justify-between border-b border-zinc-700 bg-[#2d2d2d] px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#ff5f56]" onClick={() => setViewingEmployee(null)} role="button" />
                    <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                    <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
                    <span className="ml-2 text-xs text-zinc-400">user@{viewingEmployee.codename.toLowerCase()}:~</span>
                  </div>
                  <div className="text-xs text-zinc-500">zsh</div>
                </div>

                {/* CLI Content */}
                <div className="p-6">
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 text-[#4af626]">
                        <span className="text-lg">➜</span>
                        <span className="text-lg font-bold">{viewingEmployee.codename}</span>
                        <span className="ml-2 rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                          {viewingEmployee.title}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-zinc-400 pl-6 border-l-2 border-zinc-700">
                        {viewingEmployee.description}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-bold text-[#ffbd2e]">Skills & Capabilities</div>
                      <ul className="space-y-1 pl-4">
                        {viewingEmployee.skills.map((skill, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-zinc-500">$</span>
                            <span>{skill}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-bold text-[#29b6f6]">Typical Outputs</div>
                      <div className="grid grid-cols-2 gap-2">
                        {viewingEmployee.outputs.map((out, i) => (
                          <div key={i} className="flex items-center gap-2 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                            </svg>
                            {out}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 text-xs text-zinc-600 animate-pulse">
                      _ cursor waiting for input...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pb-10 text-xs text-zinc-500">Preview demo: UI only. Next step is to replace mock runs with factoryd API + SSE streams.</div>
        </main>
      </div>
    </div>
  );
}
