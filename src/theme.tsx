import React, { createContext, useContext, useState } from "react";

export type ThemeId = "sunny" | "sky" | "calm-anger" | "calm-anxiety" | "calm-resignation";

interface ThemeInfo {
    id: ThemeId;
    label: string;
    icon: string;          // icon name for <Icon> component
    headerLabel: string;
    desc: string;          // tooltip description
    gradient: string;      // CSS gradient for header background
    accent: string;        // accent color
}

export const THEMES: Record<ThemeId, ThemeInfo> = {
    sunny: {
        id: "sunny", label: "陽光", icon: "sun",
        headerLabel: "My Factory", desc: "溫暖明亮",
        gradient: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #FDE68A 100%)",
        accent: "#F59E0B",
    },
    sky: {
        id: "sky", label: "藍天", icon: "cloud-sun",
        headerLabel: "My Factory", desc: "清澈開闊",
        gradient: "linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #93C5FD 100%)",
        accent: "#3B82F6",
    },
    "calm-anger": {
        id: "calm-anger", label: "舒緩生氣", icon: "calm-anger",
        headerLabel: "My Factory", desc: "薰衣草紫 — 降低攻擊性，舒緩憤怒",
        gradient: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 50%, #DDD6FE 100%)",
        accent: "#7C3AED",
    },
    "calm-anxiety": {
        id: "calm-anxiety", label: "舒緩焦慮", icon: "calm-anxiety",
        headerLabel: "My Factory", desc: "鼠尾草綠 — 大自然色系，穩定神經系統",
        gradient: "linear-gradient(135deg, #059669 0%, #6EE7B7 50%, #D1FAE5 100%)",
        accent: "#059669",
    },
    "calm-resignation": {
        id: "calm-resignation", label: "舒緩無奈", icon: "calm-resignation",
        headerLabel: "My Factory", desc: "暖珊瑚橘 — 溫暖包容，軟化無力感",
        gradient: "linear-gradient(135deg, #F97316 0%, #FB923C 50%, #FED7AA 100%)",
        accent: "#EA580C",
    },
};

interface ThemeContextType {
    theme: ThemeId;
    info: ThemeInfo;
    setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "sunny",
    info: THEMES.sunny,
    setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeId] = useState<ThemeId>(() => {
        try {
            const stored = localStorage.getItem("ai-factory-theme") as ThemeId;
            return (stored && THEMES[stored]) ? stored : "sunny";
        }
        catch { return "sunny"; }
    });

    const setTheme = (id: ThemeId) => {
        setThemeId(id);
        try { localStorage.setItem("ai-factory-theme", id); } catch {}
    };

    React.useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, info: THEMES[theme] ?? THEMES.sunny, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
