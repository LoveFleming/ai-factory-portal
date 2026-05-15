import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, cn } from "../components/ui/shared";
import { SKILLS } from "../data/mockData";
import { Skill, CrewSkill, RequiredInput, buildSystemPrompt } from "../types";
import TerminalConsole from "../components/TerminalConsole";
import Icon from "../components/Icon";

interface ModelOption {
    id: string;
    name: string;
    current: boolean;
}

interface ConvSummary {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    model: string;
}

interface Props {
    employeeId: string;
}

function buildInitialMessage(inputs: RequiredInput[], data: Record<string, string>, skillIds: string[]): string {
    const lines: string[] = [];
    lines.push("## 📄 Source");
    for (const input of inputs) {
        const val = data[input.id]?.trim();
        if (val) lines.push(`**${input.label}:** ${val}`);
    }
    lines.push("---");
    lines.push("Please start working based on the above information.");
    return lines.join("\n");
}

export default function EmployeeWorkspaceV2({ employeeId }: Props) {
    const employee = SKILLS.find((s) => s.id === employeeId);
    const [enabledSkills, setEnabledSkills] = useState<Record<string, boolean>>({});
    const [consoleKey, setConsoleKey] = useState(0);
    const [systemPrompt, setSystemPrompt] = useState("");
    const [chatStarted, setChatStarted] = useState(false);
    const [taskInput, setTaskInput] = useState("");
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [models, setModels] = useState<ModelOption[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [permissionMode, setPermissionMode] = useState<string>("yolo");
    const [selectedCli, setSelectedCli] = useState<string>("qwen");
    const [installedClis, setInstalledClis] = useState<Record<string, { installed: boolean; name: string }>>({});
    const [conversations, setConversations] = useState<ConvSummary[]>([]);
    const [cliTab, setCliTab] = useState<"console" | "logs" | "preview">("console");
    const [showPromptPreview, setShowPromptPreview] = useState(false);

    useEffect(() => {
        fetch("http://127.0.0.1:4097/api/models")
            .then(r => r.json())
            .then(data => {
                const list: ModelOption[] = data.models || [];
                setModels(list);
                const current = list.find((m: ModelOption) => m.current);
                if (current) setSelectedModel(current.id);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetch("http://127.0.0.1:4097/api/clis")
            .then(r => r.json())
            .then(data => setInstalledClis(data))
            .catch(() => {});
    }, []);

    // Initialize skills
    useEffect(() => {
        if (!employee) return;
        const initial: Record<string, boolean> = {};
        employee.skills.forEach(s => { initial[s.id] = s.enabled; });
        setEnabledSkills(initial);
        setChatStarted(false);
        setFormData({});
    }, [employee]);

    const loadConversations = useCallback(() => {
        if (!employee) return;
        fetch(`http://127.0.0.1:4097/api/conversations/${employee.id}`)
            .then(r => r.json())
            .then(data => setConversations(data.conversations || []))
            .catch(() => {});
    }, [employee]);

    useEffect(() => { loadConversations(); }, [loadConversations]);

    const selectedSkillIds = useMemo(() => {
        return Object.entries(enabledSkills).filter(([_, v]) => v).map(([k]) => k);
    }, [enabledSkills]);

    const effectiveCli = useMemo(() => {
        if (!employee) return "qwen";
        for (const id of selectedSkillIds) {
            const sk = employee.skills.find(s => s.id === id);
            if (sk?.cli) return sk.cli;
        }
        return selectedCli;
    }, [employee, selectedSkillIds, selectedCli]);

    const effectiveModel = useMemo(() => {
        if (!employee) return selectedModel;
        for (const id of selectedSkillIds) {
            const sk = employee.skills.find(s => s.id === id);
            if (sk?.model) return sk.model;
        }
        return selectedModel;
    }, [employee, selectedSkillIds, selectedModel]);

    const effectiveApprovalMode = useMemo(() => {
        if (!employee) return permissionMode;
        for (const id of selectedSkillIds) {
            const sk = employee.skills.find(s => s.id === id);
            if (sk?.approvalMode) return sk.approvalMode;
        }
        return permissionMode;
    }, [employee, selectedSkillIds, permissionMode]);

    const handleStartTask = () => {
        if (!employee || !taskInput.trim()) return;
        const prompt = buildSystemPrompt(employee, selectedSkillIds);
        setSystemPrompt(prompt);
        setFormData(prev => ({ ...prev, task: taskInput.trim() }));
        setConsoleKey(prev => prev + 1);
        setChatStarted(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleStartTask();
        }
    };

    const stats = [
        { label: "指派任務", value: "12", icon: "chat" as const, color: "text-blue-500" },
        { label: "完成任務", value: "8", icon: "check" as const, color: "text-emerald-500" },
    ];

    const quickActions = [
        { label: "建立新任務", icon: "plus" as const, desc: "開一個新的 CLI session" },
        { label: "建立新 Skill", icon: "lightning" as const, desc: "擴充員工能力" },
        { label: "匯出對話紀錄", icon: "save" as const, desc: "存成 Markdown" },
    ];

    if (!employee) return <div className="p-8 text-stone-400">Employee not found</div>;

    const allSkills = employee.skills || [];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ===== Main Content ===== */}
            <div className="flex-1 flex flex-col overflow-y-auto p-2 sm:p-3 gap-2 sm:gap-2.5 min-w-0 min-h-0">

                {/* --- Profile Banner --- */}
                <Card className="overflow-hidden border border-blue-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row bg-gradient-to-r from-blue-50 via-white to-indigo-50">
                        {/* Photo */}
                        <div className="w-full sm:w-40 md:w-52 shrink-0 flex items-center justify-center p-3 max-h-[160px] sm:max-h-none">
                            <img
                                src={employee.imageUrl}
                                alt={employee.title}
                                className="w-full h-full object-contain drop-shadow-lg"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                        {/* Info */}
                        <div className="flex-1 py-2 sm:py-3 px-3 sm:px-4 flex flex-col justify-center min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xl sm:text-2xl font-bold text-stone-800">{employee.codename || employee.title}</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">AI 員工</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-stone-600 mb-1 sm:mb-2">
                                <Icon name="gear" size={14} className="text-blue-500" />
                                <span className="font-medium text-sm">{employee.title}</span>
                            </div>
                            <p className="text-sm text-stone-500 mb-2 line-clamp-2 hidden sm:block">{employee.rolePrompt?.split("。")[0]}</p>
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-emerald-600 font-medium">在線上</span>
                            </div>
                        </div>
                        {/* Skills + Actions — hidden on small, visible md+ */}
                        <div className="hidden md:flex flex-[2] py-3 pr-4 pl-2 flex-col justify-center gap-2.5 min-w-0">
                            <div className="bg-white/70 rounded-xl p-3 border border-blue-100">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                                        <Icon name="lightning" size={12} className="text-white" />
                                    </div>
                                    <span className="text-sm font-bold text-stone-700">Skills</span>
                                    <span className="text-[10px] text-stone-400 ml-auto">{selectedSkillIds.length}/{allSkills.length} 已選</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {allSkills.map(sk => (
                                        <button
                                            key={sk.id}
                                            onClick={() => setEnabledSkills(prev => ({ ...prev, [sk.id]: !prev[sk.id] }))}
                                            className={cn(
                                                "text-sm font-medium px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 whitespace-nowrap",
                                                enabledSkills[sk.id]
                                                    ? "bg-blue-500 text-white border-blue-500 shadow-sm shadow-blue-200"
                                                    : "bg-white text-stone-600 border-stone-200 hover:border-blue-400 hover:bg-blue-50"
                                            )}
                                        >
                                            <Icon name={enabledSkills[sk.id] ? "check" : "gear"} size={12} />
                                            {sk.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowPromptPreview(!showPromptPreview)}
                                    className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-stone-200 text-stone-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <Icon name="document" size={14} /> 提示詞
                                </button>
                                <button
                                    onClick={() => { setConsoleKey(prev => prev + 1); setChatStarted(true); }}
                                    className="flex-1 px-3 py-2 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-blue-200"
                                >
                                    <Icon name="rocket" size={14} /> 開始
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* --- Mobile Skills row (visible < md) --- */}
                <Card className="md:hidden overflow-hidden border border-blue-100 shadow-sm">
                    <div className="p-2.5 flex flex-wrap gap-1.5 items-center">
                        <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center mr-1">
                            <Icon name="lightning" size={10} className="text-white" />
                        </div>
                        {allSkills.map(sk => (
                            <button
                                key={sk.id}
                                onClick={() => setEnabledSkills(prev => ({ ...prev, [sk.id]: !prev[sk.id] }))}
                                className={cn(
                                    "text-xs font-medium px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 whitespace-nowrap",
                                    enabledSkills[sk.id]
                                        ? "bg-blue-500 text-white border-blue-500"
                                        : "bg-white text-stone-600 border-stone-200"
                                )}
                            >
                                {sk.name}
                            </button>
                        ))}
                        <button
                            onClick={() => { setConsoleKey(prev => prev + 1); setChatStarted(true); }}
                            className="ml-auto px-3 py-1 rounded-lg text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1"
                        >
                            <Icon name="rocket" size={11} /> 開始
                        </button>
                    </div>
                </Card>

                {/* --- CLI Console --- */}
                <Card className="flex-1 min-h-[280px] sm:min-h-[400px] flex flex-col border border-blue-100/60 shadow-sm overflow-hidden">
                    {/* Console header */}
                    <div className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-blue-50 bg-blue-50/40 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                                <span className="text-white text-[10px] font-black">O</span>
                            </div>
                            <span className="font-bold text-blue-900 text-sm truncate">
                                {effectiveCli === 'claude' ? 'Claude Code' : effectiveCli === 'opencode' ? 'OpenCode' : 'Qwen'} CLI
                            </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                            <select
                                value={permissionMode}
                                onChange={e => setPermissionMode(e.target.value)}
                                className="px-1.5 py-1 rounded-lg border border-blue-100 text-[11px] text-blue-700 bg-white"
                                title="Approval Mode"
                            >
                                <option value="default">Default</option>
                                <option value="auto-edit">Auto-Edit</option>
                                <option value="yolo">YOLO</option>
                                <option value="plan">Plan</option>
                            </select>
                            <select
                                value={selectedCli}
                                onChange={e => setSelectedCli(e.target.value)}
                                className="px-1.5 py-1 rounded-lg border border-blue-100 text-[11px] text-blue-700 bg-white"
                                title="CLI Engine"
                            >
                                {Object.entries(installedClis).map(([key, info]: [string, any]) => (
                                    <option key={key} value={key} disabled={!info.installed}>
                                        {info.name} {info.installed ? '' : '(未安裝)'}
                                    </option>
                                ))}
                            </select>
                            {models.length > 0 && (
                                <select
                                    value={selectedModel}
                                    onChange={e => setSelectedModel(e.target.value)}
                                    className="hidden sm:block px-1.5 py-1 rounded-lg border border-blue-100 text-[11px] text-blue-700 bg-white max-w-[140px] truncate"
                                >
                                    {models.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name.length > 20 ? m.name.slice(0, 20) + '...' : m.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <button
                                onClick={() => setShowPromptPreview(!showPromptPreview)}
                                className="hidden sm:flex px-2 py-1 rounded-lg border border-blue-100 text-[11px] text-blue-600 hover:bg-blue-50 transition-colors items-center gap-1"
                            >
                                <Icon name="document" size={11} /> Prompt
                            </button>
                        </div>
                    </div>

                    {/* Console tabs */}
                    <div className="flex border-b border-blue-50 px-2 sm:px-4">
                        {(["console", "logs", "preview"] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setCliTab(tab)}
                                className={cn(
                                    "px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px",
                                    cliTab === tab
                                        ? "border-blue-500 text-blue-600"
                                        : "border-transparent text-blue-300 hover:text-blue-500"
                                )}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Terminal */}
                    <div className="flex-1 min-h-0">
                        {cliTab === "console" ? (
                            <TerminalConsole
                                key={`terminal-${consoleKey}`}
                                cwd={undefined}
                                cli={effectiveCli}
                                model={effectiveModel || undefined}
                                approvalMode={effectiveApprovalMode}
                                systemPrompt={undefined}
                                initialPrompt={chatStarted ? [
                                    systemPrompt ? `# System Instructions\n${systemPrompt}` : '',
                                    taskInput ? `# Task\n${taskInput}` : '',
                                ].filter(Boolean).join('\n\n') : undefined}
                            />
                        ) : cliTab === "logs" ? (
                            <div className="h-full flex items-center justify-center text-blue-300 text-sm bg-slate-900">
                                <div className="text-center">
                                    <Icon name="document" size={24} className="mx-auto mb-2 opacity-30" />
                                    <p>Logs will appear here</p>
                                </div>
                            </div>
                        ) : (
                            showPromptPreview && systemPrompt ? (
                                <div className="h-full overflow-auto p-4 bg-blue-50/30">
                                    <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">{systemPrompt}</pre>
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-blue-300 text-sm bg-blue-50/30">
                                    <div className="text-center">
                                        <Icon name="document" size={24} className="mx-auto mb-2 opacity-30" />
                                        <p>Start a task to preview prompt</p>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </Card>
            </div>

            {/* ===== Right Sidebar ===== */}
            <div className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-blue-50 bg-white/80 overflow-y-auto p-2 sm:p-3 flex flex-col gap-2 sm:gap-2.5 max-h-[260px] lg:max-h-none">

                {/* Overview Stats */}
                <Card className="p-2 sm:p-3 border border-blue-50 shadow-sm">
                    <h3 className="font-bold text-blue-900 text-sm mb-0.5">概覽</h3>
                    <p className="text-[10px] text-blue-300 mb-2">今日工作概要</p>
                    <div className="grid grid-cols-2 gap-2">
                        {stats.map(s => (
                            <div key={s.label} className="bg-blue-50/50 rounded-xl p-2 sm:p-3 text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                    <Icon name={s.icon} size={12} className={s.color} />
                                    <span className="text-lg font-bold text-blue-900">{s.value}</span>
                                </div>
                                <span className="text-[10px] text-blue-400">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Quick Actions */}
                <Card className="p-2 sm:p-3 border border-blue-50 shadow-sm">
                    <h3 className="font-bold text-blue-900 text-sm mb-2">快速操作</h3>
                    <div className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible">
                        {quickActions.map(a => (
                            <button
                                key={a.label}
                                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-blue-50 transition-colors text-left group shrink-0 lg:shrink"
                            >
                                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                    <Icon name={a.icon} size={14} className="text-blue-500" />
                                </div>
                                <div className="min-w-0 hidden sm:block">
                                    <div className="text-xs font-medium text-blue-800">{a.label}</div>
                                    <div className="text-[10px] text-blue-400">{a.desc}</div>
                                </div>
                                <span className="text-xs font-medium text-blue-800 sm:hidden">{a.label}</span>
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Recent Conversations */}
                <Card className="p-2 sm:p-3 border border-blue-50 shadow-sm flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                        <h3 className="font-bold text-blue-900 text-sm">最近對話</h3>
                        <span className="text-[10px] text-blue-500 cursor-pointer hover:text-blue-700">查看全部</span>
                    </div>
                    {conversations.length === 0 ? (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between py-1.5 border-b border-blue-50">
                                <span className="text-xs text-blue-700/60 truncate">如何建立新的微服務？</span>
                                <span className="text-[10px] text-blue-300 ml-2">10:15</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-blue-50">
                                <span className="text-xs text-blue-700/60 truncate">工廠的部署流程是什麼？</span>
                                <span className="text-[10px] text-blue-300 ml-2">昨天</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                                <span className="text-xs text-blue-700/60 truncate">如何設定權限與角色？</span>
                                <span className="text-[10px] text-blue-300 ml-2">昨天</span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {conversations.slice(0, 3).map(c => (
                                <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-blue-50 last:border-0">
                                    <span className="text-xs text-blue-700/60 truncate flex-1">{c.title}</span>
                                    <span className="text-[10px] text-blue-300 shrink-0 ml-2">
                                        {new Date(c.updatedAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Quote — pinned to bottom */}
                <Card className="p-3 sm:p-4 border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm relative overflow-hidden mt-auto hidden sm:block">
                    <div className="absolute top-2 right-3 text-5xl text-blue-200/40 font-serif">"</div>
                    <p className="text-sm text-stone-600 italic leading-relaxed relative z-10">
                        導入創新，萬機皆服務，萬事皆連結。
                    </p>
                    <p className="text-[10px] text-blue-400 mt-2 font-medium">— AI Software Factory</p>
                </Card>
            </div>
        </div>
    );
}
