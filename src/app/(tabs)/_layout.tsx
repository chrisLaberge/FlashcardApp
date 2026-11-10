import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { useTheme } from "../../theme/ThemeProvider";

const ICONS = {
    index: "book",
    library: "library",
    pet: "paw",
    stats: "stats-chart",
    account: "person-circle",
} as const;

export default function TabsLayout() {
    const t = useTheme();
    return (
        <Tabs
            screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: t.bg },
                headerShadowVisible: false,
                headerTintColor: t.text,
                headerTitleStyle: { fontWeight: "600" },
                tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.surfaceHigh, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0 },
                tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
                tabBarActiveTintColor: t.yellow,
                tabBarInactiveTintColor: t.muted,
                tabBarIcon: ({ color, size }) => (
                    <Ionicons name={ICONS[route.name as keyof typeof ICONS] ?? "ellipse"} size={size} color={color as string} />
                ),
            })}
        >
            <Tabs.Screen name="index" options={{ title: "Study" }} />
            <Tabs.Screen name="library" options={{ title: "Library" }} />
            <Tabs.Screen name="pet" options={{ title: "Pet" }} />
            <Tabs.Screen name="stats" options={{ title: "Progress" }} />
            <Tabs.Screen name="account" options={{ title: "Account" }} />
        </Tabs>
    );
}
