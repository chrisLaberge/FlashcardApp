import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import { useTheme } from "../../theme/ThemeProvider";

const ICONS = {
    index: "book",
    library: "library",
    stats: "stats-chart",
    account: "person-circle",
} as const;

export default function TabsLayout() {
    const t = useTheme();
    return (
        <Tabs
            screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: t.bg },
                headerTintColor: t.text,
                headerTitleStyle: { fontWeight: "bold" },
                tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.surface },
                tabBarActiveTintColor: t.yellow,
                tabBarInactiveTintColor: t.muted,
                tabBarIcon: ({ color, size }) => (
                    <Ionicons name={ICONS[route.name as keyof typeof ICONS] ?? "ellipse"} size={size} color={color as string} />
                ),
            })}
        >
            <Tabs.Screen name="index" options={{ title: "Study" }} />
            <Tabs.Screen name="library" options={{ title: "Library" }} />
            <Tabs.Screen name="stats" options={{ title: "Progress" }} />
            <Tabs.Screen name="account" options={{ title: "Account" }} />
        </Tabs>
    );
}
