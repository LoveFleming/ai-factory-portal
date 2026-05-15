import Icon from "./components/Icon";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

import OperationsCenter from "./pages/OperationsCenter";

import OrchestratorOverview from "./pages/OrchestratorOverview";
import OrchestratorWorkspace from "./pages/OrchestratorWorkspace";
import { ORCHESTRATORS } from "./data/mockOrchestrators";



import AICrew from "./pages/AICrew";
import FactoryDocument from "./pages/FactoryDocument";
import Gates from "./pages/Gates";
import Monitoring from "./pages/Monitoring";
import Rca from "./pages/Rca";
import EmployeeWorkspace from "./pages/EmployeeWorkspace";
import EmployeeWorkspaceV2 from "./pages/EmployeeWorkspaceV2";
import FactoryStandards from "./pages/FactoryStandards";

import { Card, RiskBadge, CodeBlock, SidebarSection, NavItem } from "./components/ui/shared";
import { AppCategory, PortalApp, Skill, RunStatus, Run, FlowSpec, Runbook, IncidentBundle, DataContract, Risk } from "./types";
import { ThemeProvider, useTheme, THEMES, ThemeId } from "./theme";
import { nowIso, fmtTime, cn, shortId, safeJsonParse, randId, badgeClasses, statusClasses } from "./utils";
import { APPS, FLOWS, RUNBOOKS, INCIDENTS, DATA_CONTRACTS } from "./data/mockData";



function groupByCategory(apps: PortalApp[]) {
  const map = new Map<AppCategory, PortalApp[]>();
  for (const a of apps) {
    const cur = map.get(a.category) ?? [];
    cur.push(a);
    map.set(a.category, cur);
  }
  return map;
}

function AppInner() {
  const [search, setSearch] = useState("");
  const [activeAppId, setActiveAppId] = useState<string>("home");
  const [openTabs, setOpenTabs] = useState<string[]>(["home"]);
  const [instanceCounter, setInstanceCounter] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Dynamic crew data (loaded from API)
  const [crew, setCrew] = useState<Skill[]>([]);
  const loadCrew = useCallback(async () => {
    try {
      const resp = await fetch("http://127.0.0.1:4097/api/crew");
      if (resp.ok) {
        const data = await resp.json();
        setCrew(data);
      }
    } catch { /* fallback to empty */ }
  }, []);

  useEffect(() => { loadCrew(); }, [loadCrew]);

  // Legacy alias for compatibility
  const SKILLS = crew;

  const openApp = (id: string) => {
    setOpenTabs((prev) => {
      if (!prev.includes(id)) return [...prev, id];
      return prev;
    });
    setActiveAppId(id);
  };

  // Open a new employee workspace instance — always creates a fresh tab
  const openEmployee = (employeeId: string) => {
    const instanceId = `emp.${instanceCounter}`;
    setInstanceCounter((c) => c + 1);
    const tabId = `employee.${employeeId}#${instanceId}`;
    setOpenTabs((prev) => [...prev, tabId]);
    setActiveAppId(tabId);
  };

  const closeTab = (id: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== id);
      if (activeAppId === id) {
        setActiveAppId(next.length > 0 ? next[next.length - 1] : "home");
      }
      return next;
    });
  };

  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(INCIDENTS[0]?.id ?? null);

  const appGroups = useMemo(() => groupByCategory(APPS), []);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return APPS;
    return APPS.filter((a) => [a.title, a.description, a.category, a.tags.join(" ")].join(" ").toLowerCase().includes(q));
  }, [search]);

  const recentRuns = useMemo(() => [...runs].slice(0, 8), [runs]);



  const runSkill = async (skill: Skill) => {
    const r: Run = {
      id: randId(),
      title: skill.title,
      createdAt: nowIso(),
      status: "queued",
      risk: skill.risk,
      engine: "qwen",
      logs: [`[queue] queued: ${skill.id}`],
      aiJsonLines: [],
    };

    setRuns((xs) => [r, ...xs]);
    setSelectedRunId(r.id);
    openApp("exec.skills");

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
    pushLog(`[start] risk=${skill.risk}`);

    const steps = ["load context", "plan patch", "generate diff", "suggest next gates", "record execution"];

    for (const s of steps) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 320));
      pushLog(`[step] ${s}`);
    }

    {
      const ai = [
        { kind: "summary", message: "Generated patch & suggested tests" },
        { kind: "patch", files: ["src/nodes/FooNode.ts", "src/nodes/__tests__/FooNode.test.ts"] },
      ];

      r.aiJsonLines = ai;
      pushLog("[AI] json lines emitted");
      setRuns((xs) => xs.map((x) => (x.id === r.id ? { ...r } : x)));
      finish("success");
      return;
    }

    finish("success");
  };



  const currentAppTitle = useMemo(() => {
    if (activeAppId.startsWith("employee.")) {
      const [empPart] = activeAppId.split("#");
      const empId = empPart.slice(9);
      const emp = SKILLS.find(s => s.id === empId);
      return emp ? emp.title : "Employee Workspace";
    }
    if (activeAppId.startsWith("api.")) {
       return `API: ${activeAppId.slice(4)}`;
    }
    if (activeAppId === "home") return "Dashboard";
    if (activeAppId.startsWith("orch.")) {
        const [, , oId] = activeAppId.split(".");
        const o = ORCHESTRATORS.find(o => o.id === oId);
        return o ? o.name : "Orchestrator Workspace";
    }
    if (activeAppId === "factory.tour") return "Quick Tour";
    if (activeAppId === "factory.standards") return "Standards";
    if (activeAppId === "factory.manifesto") return "Constitution";
    if (activeAppId === "factory.crew") return "AI Crew";
    if (activeAppId === "home") return "Dashboard";
    return APPS.find((a) => a.id === activeAppId)?.title ?? "Dashboard";
  }, [activeAppId]);

  const labelFor = (id: string) => {
    if (id.startsWith("employee.")) {
      const [empPart] = id.split("#");
      const empId = empPart.slice(9);
      const emp = SKILLS.find(s => s.id === empId);
      return emp ? emp.codename : empId;
    }
    if (id.startsWith("api.")) {
      return id.slice(4);
    }
    if (id === "home") return "Dashboard";
    if (id.startsWith("orch.")) {
        const [, , oId] = id.split(".");
        const o = ORCHESTRATORS.find(o => o.id === oId);
        return o ? o.name : id;
    }
    if (id === "factory.tour") return "Quick Tour";
    if (id === "factory.standards") return "Standards";
    if (id === "factory.manifesto") return "Constitution";
    if (id === "factory.crew") return "AI Crew";
    if (id === "home") return "Dashboard";
    return APPS.find((a) => a.id === id)?.title ?? id;
  };

  const riskForApp = (id: string): Risk => {
    if (id.startsWith("employee.")) {
      const [empPart] = id.split("#");
      const empId = empPart.slice(9);
      const emp = SKILLS.find(s => s.id === empId);
      return emp ? emp.risk : "safe";
    }
    if (id.startsWith("api.")) return "safe";
    if (id.startsWith("orch.")) {
        const [, , oId] = id.split(".");
        const o = ORCHESTRATORS.find(o => o.id === oId);
        return o?.status === 'active' ? "safe" : o?.status === 'draft' ? "guarded" : "external";
    }
    if (id === "home") return "safe";
    if (id === "home") return "safe";
    if (id === "factory.tour") return "safe";
    if (id === "factory.standards") return "safe";
    if (id === "factory.manifesto") return "safe";
    if (id === "factory.crew") return "safe";
    return APPS.find((a) => a.id === id)?.risk ?? "safe";
  };

  const nav = useMemo(() => {
    return {
      "Factory": ["factory.tour", "factory.manifesto", "factory.standards", "factory.crew"],
    } as Record<string, string[]>;
  }, []);

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
        cta: { label: "Open Run Console", action: () => { setSelectedRunId(failed.id); openApp("exec.skills"); } },
        risk: "safe",
      });
    }

    const hasP1P2 = (todayIncidentCounts.P1 + todayIncidentCounts.P2) > 0;
    if (hasP1P2) {
      next.push({
        id: "sug.rca",
        title: "Run AI RCA for high severity incident",
        desc: "Analyze incident bundle in sandbox and draft RCA + runbook patch (no prod writes).",
        cta: { label: "Open Investigator", action: () => openApp("inv.rca") },
        risk: "guarded",
      });
    }

    const runbookGap = INCIDENTS.some((i) => i.summary.toLowerCase().includes("runbook missing"));
    if (runbookGap) {
      const runbookMaker = SKILLS.find((s) => s.id === "ai.runbook");
      if (runbookMaker) {
      next.push({
        id: "sug.q4",
        title: "Close runbook gaps (RunbookMedic)",
        desc: "Run Runbook Maker to catch missing error-code ↔ runbook mappings.",
        cta: { label: "Run RunbookMedic", action: () => { void runSkill(runbookMaker); } },
        risk: "safe",
      });
      }
    }

    const codegen = SKILLS.find((s) => s.id === "ai.unit");
    if (codegen) {
    next.push({
      id: "sug.codegen",
      title: "Generate tests from spec (UnitSmith)",
      desc: "Use Unit Test Assistant to draft tests and implementation.",
      cta: { label: "Run UnitSmith", action: () => { void runSkill(codegen); } },
      risk: "safe",
    });
    }

    const gatekeeper = SKILLS.find((s) => s.id === "ai.gatekeeper");
    if (gatekeeper) {
    next.push({
      id: "sug.pr",
      title: "Prepare PR (OutboundGate)",
      desc: "External action is locked by default. This demonstrates manual approval workflow.",
      cta: { label: "Ask Gatekeeper", action: () => { void runSkill(gatekeeper); } },
      risk: "external",
    });
    }

    return next.slice(0, 5);
  }, [runs, todayIncidentCounts.P1, todayIncidentCounts.P2, todayIncidentCounts.P3, crew]);

  const renderTab = (tabId: string) => {
    if (tabId === "home") return <OperationsCenter
        runs={runs}
        setActiveAppId={setActiveAppId}
        setSelectedRunId={setSelectedRunId}
        setSelectedIncidentId={setSelectedIncidentId}
        runSkill={runSkill}
        todayIncidentCounts={todayIncidentCounts}
        runCounts={runCounts}
        currentRuns={currentRuns}
        todayIncidents={todayIncidents}
        suggestions={suggestions}
      />;
    if (tabId === "factory.tour") return <FactoryDocument file="quick-tour" headerIcon="factory" headerTitle="AI Software Factory" headerSub="快速導覽 — 5 分鐘理解工廠如何運作" />;
    if (tabId.startsWith("orch.")) {
      const [, domain, orchId] = tabId.split(".");
      return <OrchestratorWorkspace domain={domain} orchId={orchId} />;
    }
    if (tabId === "factory.manifesto") return <FactoryDocument file="constitution" headerIcon="scroll" headerTitle="Constitution" headerSub="工廠意法 — 核心原則與價值" />;
    if (tabId === "factory.standards") return <FactoryDocument file="standards" headerIcon="ruler" headerTitle="Standards" headerSub="工程標準與規範" />;
    if (tabId === "factory.crew") return <AICrew openEmployee={openEmployee} onCrewChanged={loadCrew} />;
    if (tabId === "exec.skills") return <AICrew openEmployee={openEmployee} onCrewChanged={loadCrew} />;
    if (tabId === "exec.gates") return <Gates runSkill={runSkill} />;
    if (tabId === "mon.report") return <Monitoring runSkill={runSkill} />;
    if (tabId === "inv.rca") return <Rca selectedIncidentId={selectedIncidentId} setSelectedIncidentId={setSelectedIncidentId} runSkill={runSkill} />;
    if (tabId.startsWith("employee.")) {
      const [empPart] = tabId.split("#");
      const employeeId = empPart.slice(9);
      return employeeId === "ai.guide"
        ? <EmployeeWorkspaceV2 employeeId={employeeId} />
        : <EmployeeWorkspace employeeId={employeeId} />;
    }
    return <AICrew openEmployee={openEmployee} onCrewChanged={loadCrew} />;
  };

  const { info: themeInfo, theme, setTheme } = useTheme();

  return (
    <div className="h-screen flex flex-col bg-orange-50/40 text-stone-800 font-sans selection:bg-amber-200 overflow-hidden">
      {/* Top Header */}
      <header className="h-14 flex items-center justify-between px-4 shrink-0 z-10" style={{ background: themeInfo.gradient }}>
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 -ml-2 rounded-full text-white/80 hover:bg-white/20 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="text-lg font-bold tracking-tight text-white drop-shadow-sm" style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
            {themeInfo.headerLabel}
          </div>
        </div>
        {/* Theme switcher */}
        <div className="flex items-center gap-1">
          {(Object.keys(THEMES) as ThemeId[]).map(id => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className={cn(
                "w-7 h-7 rounded-full text-sm flex items-center justify-center transition-all",
                theme === id ? "bg-white/30 ring-2 ring-white" : "hover:bg-white/20"
              )}
              title={THEMES[id].label + (THEMES[id].desc ? ' — ' + THEMES[id].desc : '')}
            >
              <Icon name={THEMES[id].icon} size={20} />
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={cn("bg-white border-r border-stone-200 flex-shrink-0 overflow-y-auto flex flex-col py-2 transition-all duration-200", sidebarOpen ? "w-64" : "w-0 border-r-0 overflow-hidden")}>
          <div className="flex flex-col">
            {(Object.keys(nav) as string[]).map((cat) => {
              const domTitle = cat;
              return (
              <SidebarSection key={cat} title={domTitle}>
                <div className="space-y-1">
                  {(nav[cat] ?? []).map((id) => {
                    const active = activeAppId === id;
                    return (
                      <NavItem
                        key={id}
                        active={active}
                        label={labelFor(id)}
                        onClick={() => openApp(id)}
                      />
                    );
                  })}
                </div>
              </SidebarSection>
            );
            })}
          </div>


        </aside>

        {/* Main */}
        <main className="flex-1 overflow-hidden bg-orange-50/40 flex flex-col">

          {/* Tabs */}
          <div className="flex w-full items-end gap-1 overflow-x-auto bg-stone-100 px-4 pt-2 border-b border-stone-200" style={{ scrollbarWidth: 'none' }}>
            {openTabs.map((tabId) => {
              const isActive = activeAppId === tabId;
              return (
                <div
                  key={tabId}
                  onClick={() => openApp(tabId)}
                  className={cn(
                    "group relative flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm transition-all border-t border-l border-r border-transparent rounded-t-md",
                    isActive
                      ? "bg-white text-orange-600 font-medium border-stone-200 -mb-px pb-[9px] shadow-sm"
                      : "bg-transparent text-stone-500 hover:bg-stone-200/50"
                  )}
                >
                  <span className="truncate whitespace-nowrap">{labelFor(tabId)}</span>
                  {tabId !== "home" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tabId);
                      }}
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-orange-200",
                        isActive ? "text-stone-400 hover:text-rose-500" : "text-stone-400 opacity-0 group-hover:opacity-100 hover:text-rose-500"
                      )}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex-1 w-full py-2 flex flex-col min-h-0 overflow-hidden bg-orange-50/20 relative">
            {openTabs.map((tabId) => (
              <div
                key={tabId}
                className="absolute inset-0"
                style={{
                  visibility: activeAppId === tabId ? "visible" : "hidden",
                  pointerEvents: activeAppId === tabId ? "auto" : "none",
                }}
              >
                {renderTab(tabId)}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
    return (
        <ThemeProvider>
            <AppInner />
        </ThemeProvider>
    );
}
