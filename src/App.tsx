import React, { useEffect, useMemo, useRef, useState } from "react";
import { createOpencodeClient } from "@opencode-ai/sdk/client";

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
import OrchestratorViewer from "./pages/OrchestratorViewer";
import Runbooks from "./pages/Runbooks";
import DataContracts from "./pages/DataContracts";
import Storybook from "./pages/Storybook";
import AICrew from "./pages/AICrew";
import Gates from "./pages/Gates";
import Monitoring from "./pages/Monitoring";
import Rca from "./pages/Rca";
import EmployeeWorkspace from "./pages/EmployeeWorkspace";
import { Card, RiskBadge, CodeBlock, SidebarSection, NavItem } from "./components/ui/shared";
import { AppCategory, PortalApp, SkillEngine, Skill, RunStatus, Run, FlowSpec, Runbook, IncidentBundle, DataContract, Risk } from "./types";
import { nowIso, fmtTime, cn, shortId, safeJsonParse, randId, badgeClasses, statusClasses } from "./utils";
import { APPS, SKILLS, FLOWS, RUNBOOKS, INCIDENTS, DATA_CONTRACTS } from "./data/mockData";



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
  const [openTabs, setOpenTabs] = useState<string[]>(["home"]);

  const openApp = (id: string) => {
    setOpenTabs((prev) => {
      if (!prev.includes(id)) return [...prev, id];
      return prev;
    });
    setActiveAppId(id);
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
      engine: skill.engine,
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
    pushLog(`[start] engine=${skill.engine} risk=${skill.risk}`);

    if (skill.engine === "opencode") {
      pushLog("[step] init Open Code client");
      try {
        const client = createOpencodeClient({ baseUrl: "http://127.0.0.1:4096" });

        pushLog("[step] create session");
        const session = await client.session.create({ body: { title: skill.title } });
        if (!session.data) throw new Error("Failed to create session - no data returned");
        pushLog(`[opencode] session created: ${session.data.id}`);

        pushLog(`[step] send "hello world" prompt to agent`);
        const result = await client.session.prompt({
          path: { id: session.data.id },
          body: {
            noReply: true,
            parts: [
              {
                type: "text",
                text: skill.codename === "SpecScribe" ? "hello world" : `Run skill ${skill.codename}`
              }
            ]
          }
        });

        pushLog(`[opencode] prompt accepted. Waiting for completion...`);

        // Wait until session is idle/completed
        let isDone = false;
        while (!isDone) {
          await new Promise(res => setTimeout(res, 1000));
          const statusRes = await client.session.status({});
          // The API returns an object where keys are session IDs and values are status objects
          if (statusRes.data && (statusRes.data as any)[session.data.id]?.type === "idle") {
            isDone = true;
          }
        }

        // Fetch messages
        const msgs = await client.session.messages({ path: { id: session.data.id } });
        let aiOutput = "No messages found.";
        if (msgs.data && msgs.data.length > 0) {
          const lastMsg = msgs.data[msgs.data.length - 1];
          const textParts = lastMsg.parts.filter(p => p.type === "text").map((p: any) => p.text);
          aiOutput = textParts.join("\n");
        }

        r.aiJsonLines = [{ kind: "opencode-result", output: aiOutput }];
        pushLog(`[opencode] session completed. Result read.`);
        setRuns((xs) => xs.map((x) => (x.id === r.id ? { ...r } : x)));
        // Also push the actual output to logs if desired
        pushLog(`[opencode output]\n${aiOutput}`);
        finish("success");
      } catch (err: any) {
        pushLog(`[opencode error] ${err.message}`);
        r.aiJsonLines = [{ kind: "error", error: err.message || "Failed to connect to OpenCode CLI backend" }];
        finish("failed");
      }
      return;
    }

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



  const currentAppTitle = useMemo(() => {
    if (activeAppId.startsWith("employee.")) {
      const empId = activeAppId.slice(9);
      const emp = SKILLS.find(s => s.id === empId);
      return emp ? emp.title : "Employee Workspace";
    }
    if (activeAppId === "home") return "Dashboard";
    return APPS.find((a) => a.id === activeAppId)?.title ?? "Dashboard";
  }, [activeAppId]);

  const labelFor = (id: string) => {
    if (id.startsWith("employee.")) {
      const empId = id.slice(9);
      const emp = SKILLS.find(s => s.id === empId);
      return emp ? emp.codename : id;
    }
    if (id === "home") return "Dashboard";
    return APPS.find((a) => a.id === id)?.title ?? id;
  };

  const riskForApp = (id: string): Risk => {
    if (id.startsWith("employee.")) {
      const empId = id.slice(9);
      const emp = SKILLS.find(s => s.id === empId);
      return emp ? emp.risk : "safe";
    }
    if (id === "home") return "safe";
    return APPS.find((a) => a.id === id)?.risk ?? "safe";
  };

  const nav = useMemo(() => {
    return {
      Overview: ["home"],
      Workbench: (appGroups.get("Assets") ?? []).map((a) => a.id),
      "AI Collaboration": (appGroups.get("Execution") ?? []).map((a) => a.id),
      "Ops Console": [
        ...(appGroups.get("Monitoring") ?? []),
        ...(appGroups.get("Investigation") ?? []),
      ].map((a) => a.id),
    } as Record<string, string[]>;
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

  const renderContent = () => {
    if (activeAppId === "home") return <OperationsCenter runs={runs} setActiveAppId={openApp} setSelectedRunId={setSelectedRunId} setSelectedIncidentId={setSelectedIncidentId} runSkill={runSkill} todayIncidentCounts={todayIncidentCounts} runCounts={runCounts} currentRuns={currentRuns} todayIncidents={todayIncidents} suggestions={suggestions} />;
    if (activeAppId === "assets.orchestrator") return <OrchestratorViewer />;
    if (activeAppId === "assets.runbooks") return <Runbooks />;
    if (activeAppId === "assets.contracts") return <DataContracts />;
    if (activeAppId === "assets.storybook") return <Storybook />;
    if (activeAppId === "exec.skills") return <AICrew runSkill={runSkill} openApp={openApp} />;
    if (activeAppId === "exec.gates") return <Gates runSkill={runSkill} />;
    if (activeAppId === "mon.report") return <Monitoring runSkill={runSkill} />;
    if (activeAppId === "inv.rca") return <Rca selectedIncidentId={selectedIncidentId} setSelectedIncidentId={setSelectedIncidentId} runSkill={runSkill} />;
    if (activeAppId.startsWith("employee.")) {
      const employeeId = activeAppId.slice(9);
      return <EmployeeWorkspace employeeId={employeeId} />;
    }
    return <AICrew runSkill={runSkill} openApp={openApp} />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-stone-900 font-sans selection:bg-blue-100">
      {/* Top Header */}
      <header className="h-14 flex items-center justify-between bg-white border-b border-zinc-200 px-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button className="p-2 -ml-2 rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="text-lg font-bold tracking-tight text-blue-700 italic" style={{ fontFamily: "cursive, sans-serif" }}>
            ~MY FACTORY~
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-zinc-200 flex-shrink-0 overflow-y-auto flex flex-col py-2">
          <div className="flex flex-col">
            {(Object.keys(nav) as string[]).map((cat) => (
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
                        onClick={() => openApp(id)}
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
        <main className="flex-1 overflow-y-auto bg-zinc-50 flex flex-col">

          {/* Tabs */}
          <div className="flex w-full items-end gap-1 overflow-x-auto bg-zinc-100 px-4 pt-2 border-b border-zinc-200">
            {openTabs.map((tabId) => {
              const isActive = activeAppId === tabId;
              return (
                <div
                  key={tabId}
                  onClick={() => openApp(tabId)}
                  className={cn(
                    "group relative flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm transition-all border-t border-l border-r border-transparent rounded-t-md",
                    isActive
                      ? "bg-white text-blue-600 font-medium border-zinc-200 -mb-px pb-[9px]"
                      : "bg-transparent text-zinc-600 hover:bg-zinc-200/50"
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
                        "flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-zinc-200",
                        isActive ? "text-zinc-400 hover:text-red-500" : "text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-500"
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

          <div className="flex-1 w-full px-6 py-2 flex flex-col min-h-0 bg-zinc-50">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
