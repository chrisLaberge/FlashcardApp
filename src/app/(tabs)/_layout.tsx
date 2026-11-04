import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";

const ICONS = {
    index: "book",
    stats: "stats-chart",
    account: "person-circle",
} as const;

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: "#282828" },
                headerTintColor: "#ebdbb2",
                headerTitleStyle: { fontWeight: "bold" },
                tabBarStyle: { backgroundColor: "#282828", borderTopColor: "#3c3836" },
                tabBarActiveTintColor: "#fabd2f",
                tabBarInactiveTintColor: "#a89984",
                tabBarIcon: ({ color, size }) => (
                    <Ionicons name={ICONS[route.name as keyof typeof ICONS] ?? "ellipse"} size={size} color={color as string} />
                ),
            })}
        >
            <Tabs.Screen name="index" options={{ title: "Study" }} />
            <Tabs.Screen name="stats" options={{ title: "Progress" }} />
            <Tabs.Screen name="account" options={{ title: "Account" }} />
        </Tabs>
    );
}
