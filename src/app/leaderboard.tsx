import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useUser } from "../hooks/useUser";
import { ApiError, getLeaderboard, type LeaderboardEntry, type Period } from "../services/social";
import { syncStats } from "../services/syncStats";

export default function LeaderboardScreen() {
    const user = useUser();
    const [period, setPeriod] = useState<Period>("week");
    const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
    const [error, setError] = useState("");
    const [needsProfile, setNeedsProfile] = useState(false);

    const load = useCallback(async (which: Period) => {
        setError("");
        try {
            // Upload first so your own row is up to date; a failed upload should not hide the board.
            await syncStats().catch(() => null);
            setEntries(await getLeaderboard(which));
            setNeedsProfile(false);
        } catch (e) {
            if (e instanceof ApiError && e.status === 404) setNeedsProfile(true);
            else setError(e instanceof Error ? e.message : String(e));
            setEntries([]);
        }
    }, []);

    useFocusEffect(useCallback(() => { if (user) void load(period); }, [user, period, load]));

    if (user === undefined) return <View style={[s.container, s.center]}><ActivityIndicator color="#83a598" /></View>;

    if (!user || needsProfile) {
        return (
            <View style={[s.container, s.center]}>
                <Text style={s.heading}>{user ? "Set up your profile" : "Sign in to see the leaderboard"}</Text>
                <Pressable style={s.button} onPress={() => router.push(user ? "/friends" : "/account")}>
                    <Text style={s.buttonText}>{user ? "Choose a username" : "Sign in"}</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={s.container}>
            <View style={s.toggle}>
                {(["week", "all"] as const).map((p) => (
                    <Pressable key={p} style={[s.tab, period === p && s.tabOn]} onPress={() => { setEntries(null); setPeriod(p); }}>
                        <Text style={[s.tabText, period === p && s.tabTextOn]}>{p === "week" ? "This week" : "All time"}</Text>
                    </Pressable>
                ))}
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            {entries === null ? (
                <ActivityIndicator color="#83a598" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(e) => e.uid}
                    contentContainerStyle={{ gap: 8, paddingBottom: 60 }}
                    ListEmptyComponent={<Text style={s.muted}>Nothing here yet.</Text>}
                    ListFooterComponent={
                        entries.length <= 1 ? (
                            <Pressable onPress={() => router.push("/friends")}>
                                <Text style={s.link}>Add friends to compete</Text>
                            </Pressable>
                        ) : undefined
                    }
                    renderItem={({ item }) => (
                        <View style={[s.row, item.isMe && s.me]}>
                            <Text style={s.rank}>{item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : item.rank === 3 ? "🥉" : item.rank}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={s.name} numberOfLines={1}>{item.username}{item.isMe ? " (you)" : ""}</Text>
                                <Text style={s.muted}>Level {item.level} · {item.currentStreak} 🔥</Text>
                            </View>
                            <Text style={s.xp}>{item.xp.toLocaleString("en-US")} XP</Text>
                        </View>
                    )}
                />
            )}

            <Pressable onPress={() => router.push("/friends")}><Text style={s.link}>Friends</Text></Pressable>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#282828", padding: 20 },
    center: { alignItems: "center", justifyContent: "center", gap: 14 },
    heading: { color: "#ebdbb2", fontSize: 18, fontWeight: "600" },
    toggle: { flexDirection: "row", backgroundColor: "#3c3836", borderRadius: 12, padding: 4, marginBottom: 14 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
    tabOn: { backgroundColor: "#504945" },
    tabText: { color: "#a89984", fontWeight: "600" },
    tabTextOn: { color: "#ebdbb2" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#3c3836", borderRadius: 12, padding: 14 },
    me: { borderWidth: 1, borderColor: "#fabd2f" },
    rank: { color: "#ebdbb2", fontSize: 20, width: 34, textAlign: "center" },
    name: { color: "#ebdbb2", fontSize: 16, fontWeight: "600" },
    muted: { color: "#a89984", fontSize: 13, textAlign: "center" },
    xp: { color: "#b8bb26", fontSize: 16, fontWeight: "bold" },
    link: { color: "#83a598", textAlign: "center", fontSize: 14, paddingVertical: 10 },
    error: { color: "#fb4934", textAlign: "center", marginBottom: 10 },
    button: { backgroundColor: "#b8bb26", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24 },
    buttonText: { color: "#282828", fontSize: 16, fontWeight: "bold" },
});
