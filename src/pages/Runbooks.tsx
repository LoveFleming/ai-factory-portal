import React, { useState, useMemo } from "react";
import { Card } from "../components/ui/shared";
import { fmtTime } from "../utils";
import { RUNBOOKS } from "../data/mockData";

export default function Runbooks() {
    const [runbookQuery, setRunbookQuery] = useState("");

    const runbooksFiltered = useMemo(() => {
        const q = runbookQuery.trim().toLowerCase();
        if (!q) return RUNBOOKS;
        return RUNBOOKS.filter((r) => [r.title, r.errorCodePrefix, r.summary].join(" ").toLowerCase().includes(q));
    }, [runbookQuery]);

    return (
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
}
