import React, { useState, useEffect } from "react";
import { Card, cn } from "../components/ui/shared";
import { SKILLS } from "../data/mockData";
import OpenCodeConsole from "./OpenCodeConsole";

interface EmployeeWorkspaceProps {
    employeeId: string;
}

export default function EmployeeWorkspace({ employeeId }: EmployeeWorkspaceProps) {
    const employee = SKILLS.find((s) => s.id === employeeId);
    // Initially, select the first 2 skills as an example or all
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

    useEffect(() => {
        if (employee) {
            setSelectedSkills(employee.skills);
        }
    }, [employee]);

    if (!employee) {
        return <div className="p-4 text-red-500">Employee not found.</div>;
    }

    const toggleSkill = (skill: string) => {
        setSelectedSkills((prev) =>
            prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
        );
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 gap-2 relative">
            {/* Top panel: Employee header and skills */}
            <Card className="flex-1 overflow-y-auto min-h-0 p-4">
                <div className="flex gap-6 items-start">
                    {/* Left: Employee Photo */}
                    <div className="w-48 h-48 shrink-0 rounded-3xl overflow-hidden bg-orange-50/50 border border-orange-100 flex items-center justify-center p-4 shadow-sm">
                        <img
                            src={employee.imageUrl}
                            alt={employee.title}
                            className="w-full h-full object-contain drop-shadow-sm"
                        />
                    </div>
                    {/* Right: Details & Skills */}
                    <div className="flex flex-col gap-4 flex-1">
                        <h2 className="text-xl font-medium text-stone-800 tracking-tight">
                            Collaborating with {employee.codename} <span className="text-zinc-500 font-normal ml-2">({employee.title})</span>
                        </h2>
                        <p className="text-sm text-zinc-600 leading-relaxed max-w-2xl">{employee.description}</p>
                        <div className="mt-1">
                            <div className="font-semibold text-sm mb-3 text-zinc-800">Available Skills & Capabilities:</div>
                            <div className="flex flex-wrap gap-2">
                                {employee.skills.map((skill) => {
                                    const isSelected = selectedSkills.includes(skill);
                                    return (
                                        <label
                                            key={skill}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all",
                                                isSelected
                                                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                                                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500"
                                                checked={isSelected}
                                                onChange={() => toggleSkill(skill)}
                                            />
                                            <span className="font-medium">{skill}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Middle & Bottom panel: Large AI Console */}
            {/* OpenCodeConsole is fixed size, input at bottom */}
            <Card className="shrink-0 h-[450px] flex flex-col overflow-hidden p-0 border-0 bg-transparent shadow-none">
                <OpenCodeConsole selectedEmployee={employee} className="flex-1 overflow-hidden m-0" disableCard />
            </Card>
        </div>
    );
}
