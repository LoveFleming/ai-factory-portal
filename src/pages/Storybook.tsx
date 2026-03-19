import React from "react";
import { Card } from "../components/ui/shared";

export default function Storybook() {
    return (
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
}
