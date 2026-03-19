import React, { useState, useMemo } from "react";
import { Card, CodeBlock } from "../components/ui/shared";
import { FLOWS } from "../data/mockData";

export default function OrchestratorViewer() {
    const [selectedFlowId, setSelectedFlowId] = useState(FLOWS[0]?.id ?? "");
    const selectedFlow = useMemo(() => FLOWS.find((f) => f.id === selectedFlowId) ?? FLOWS[0], [selectedFlowId]);

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
}
