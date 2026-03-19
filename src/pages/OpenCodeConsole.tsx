import React, { useState, useEffect } from "react";
import { Card, cn } from "../components/ui/shared";
import { createOpencodeClient } from "@opencode-ai/sdk/client";
import { Skill } from "../types";

interface OpenCodeConsoleProps {
    selectedEmployee?: Skill | null;
    className?: string;
    disableCard?: boolean;
}

export default function OpenCodeConsole({ selectedEmployee, className, disableCard }: OpenCodeConsoleProps) {
    const [openCodeSessionId, setOpenCodeSessionId] = useState<string | null>(null);
    const [openCodeMessages, setOpenCodeMessages] = useState<Array<{ role: "user" | "assistant"; text: string; id?: string }>>([]);
    const [openCodeInput, setOpenCodeInput] = useState("");
    const [isOpenCodeLoading, setIsOpenCodeLoading] = useState(false);

    // reset console when changing employees
    useEffect(() => {
        setOpenCodeMessages([]);
        setOpenCodeSessionId(null);
    }, [selectedEmployee]);

    const handleOpenCodeSubmit = async () => {
        if (!openCodeInput.trim() || isOpenCodeLoading) return;
        const inputText = openCodeInput.trim();
        setOpenCodeInput("");
        setOpenCodeMessages((msg) => [...msg, { role: "user", text: inputText, id: "user-" + Date.now() }]);
        setIsOpenCodeLoading(true);

        try {
            const client = createOpencodeClient({ baseUrl: "http://127.0.0.1:4096" });
            let sid = openCodeSessionId;

            if (!sid) {
                const title = selectedEmployee ? `Chat with ${selectedEmployee.codename}` : "Console Session";
                const session = await client.session.create({ body: { title } });
                if (!session.data) throw new Error("Failed to create session");
                sid = session.data.id;
                setOpenCodeSessionId(sid);
            }

            let isDone = false;
            const promptPromise = client.session.prompt({
                path: { id: sid },
                body: {
                    noReply: false,
                    system: selectedEmployee ? `You are ${selectedEmployee.codename}, a specialized AI employee (${selectedEmployee.title}).\n\nRole description: ${selectedEmployee.description}\n\nYour specific skills include:\n- ${selectedEmployee.skills.join('\n- ')}\n\nYou are expected to produce the following outputs:\n- ${selectedEmployee.outputs.join('\n- ')}\n\nStay in character and assist the user specifically using your skills and role boundaries.` : undefined,
                    parts: [{ type: "text", text: inputText }],
                },
            }).then(() => {
                isDone = true;
            }).catch((err) => {
                isDone = true;
                throw err;
            });

            const pollMessages = async () => {
                const msgs = await client.session.messages({ path: { id: sid } });
                if (msgs.data) {
                    setOpenCodeMessages((prev) => {
                        const next = [...prev];
                        for (const m of msgs.data) {
                            if (m.info?.role === "assistant") {
                                const textParts = m.parts.filter((p: any) => p.type === "text").map((p: any) => p.text);
                                if (textParts.length > 0) {
                                    const text = textParts.join("\\n");
                                    const existingIdx = next.findIndex((x) => x.id === m.info.id);
                                    if (existingIdx >= 0) {
                                        next[existingIdx].text = text;
                                    } else {
                                        next.push({ role: "assistant", text, id: m.info.id });
                                    }
                                }
                            }
                        }
                        return next;
                    });
                }
            };

            while (!isDone) {
                await pollMessages();
                await new Promise((res) => setTimeout(res, 500));
            }

            // One final fetch to ensure we have the complete message
            await pollMessages();
            await promptPromise;

        } catch (err: any) {
            setOpenCodeMessages((msg) => [...msg, { role: "assistant", text: `Error: ${err.message}` }]);
        } finally {
            setIsOpenCodeLoading(false);
        }
    };

    const content = (
        <>
            {!disableCard && (
                <div className="text-sm text-zinc-600">
                    {selectedEmployee ? selectedEmployee.description : "Welcome to the Open Code Console. Start collaborating with AI directly from here."}
                </div>
            )}
            <div className={cn("rounded-xl bg-[#1e1e1e] p-4 font-mono text-sm text-zinc-300 flex flex-col gap-4 min-h-0", className)}>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-2 min-h-0">
                    {openCodeMessages.length === 0 && (
                        <div className="text-zinc-500 italic">No messages yet. Send a prompt to start.</div>
                    )}
                    {openCodeMessages.map((msg, i) => (
                        <div key={i} className="flex gap-2">
                            <span className={msg.role === "user" ? "text-blue-400 font-bold" : "text-[#ffbd2e] font-bold"}>
                                {msg.role === "user" ? "USER" : "AGENT"}➜
                            </span>
                            <span className="whitespace-pre-wrap">{msg.text}</span>
                        </div>
                    ))}
                    {isOpenCodeLoading && (
                        <div className="flex gap-2">
                            <span className="text-[#ffbd2e] font-bold">AGENT➜</span>
                            <span className="animate-pulse text-zinc-500">_ computing...</span>
                        </div>
                    )}
                </div>
                <div className="flex items-start gap-2 border-t border-zinc-700 pt-4 shrink-0">
                    <span className="text-[#4af626] mt-0.5">➜</span>
                    <textarea
                        value={openCodeInput}
                        onChange={(e) => {
                            setOpenCodeInput(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleOpenCodeSubmit();
                                // Reset height after submit
                                e.currentTarget.style.height = "auto";
                            }
                        }}
                        disabled={isOpenCodeLoading}
                        placeholder={selectedEmployee ? `Type your prompt for ${selectedEmployee.codename}... (Shift+Enter for newline)` : "Type your prompt here... (Shift+Enter for newline)"}
                        className="flex-1 bg-transparent outline-none disabled:opacity-50 resize-none min-h-[24px] max-h-[120px] overflow-y-auto leading-normal py-0"
                        rows={1}
                    />
                </div>
            </div>
        </>
    );

    if (disableCard) {
        return <div className="flex-1 flex flex-col overflow-hidden">{content}</div>;
    }

    return (
        <Card title={selectedEmployee ? `Collaborating with ${selectedEmployee.codename}` : "Open Code Console"}>
            {content}
        </Card>
    );
}
