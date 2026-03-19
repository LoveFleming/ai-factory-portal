import React from "react";
import { Card } from "../components/ui/shared";
import { cn } from "../utils";
import { DATA_CONTRACTS } from "../data/mockData";

export default function DataContracts() {
    return (
        <div className="space-y-4">
            <Card title="API Data Contracts">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {DATA_CONTRACTS.map((c) => (
                        <div key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-zinc-900">{c.id}</div>
                                    <div className="mt-1 text-xs text-zinc-600">
                                        <span className="font-mono">{c.service}</span> → <span className="font-mono">{c.consumer}</span>
                                    </div>
                                </div>
                                <div className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                                    c.status === "active" ? "bg-green-100 text-green-700" :
                                        c.status === "deprecated" ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-700"
                                )}>
                                    {c.status}
                                </div>
                            </div>

                            <div className="mt-3 text-xs text-zinc-500">
                                SLA: <span className="font-mono text-zinc-700">{c.sla}</span>
                            </div>

                            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-[10px] text-zinc-600 whitespace-pre-wrap">
                                {c.schema}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
