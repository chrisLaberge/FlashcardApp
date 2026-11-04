import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useUser } from "../hooks/useUser";
import { ApiError, getGlobalLeaderboard, getLeaderboard, type GlobalBoard, type LeaderboardEntry, type Period } from "../services/social";
import { syncStats } from "../services/syncStats";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

export default function LeaderboardScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const user = useUser();
    const [scope, setScope] = useState<"friends" | "global">("friends");
    const [period, setPeriod] = useState<Period>("week");
    const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
    const [global, setGlobal] = useState<GlobalBoard | null>(null);
    const [error, setError] = useState("");
    const [needsProfile, setNeedsProfile] = useState(false);

    const load = useCallback(async (which: Period, where: "friends" | "global") => {
        setError("");
        try {
            // Upload first so your own row is up to date; a failed upload should not hide the board.
            await syncStats().catch(() => null);
            if (where === "global") {
                setGlobal(await getGlobalLeaderboard(which));
            } else {
                setEntries(await getLeaderboard(which));
            }
            setNeedsProfile(false);
        } catch (e) {
            if (e instanceof ApiError && e.status === 404) setNeedsProfile(true);
            else setError(e instanceof Error ? e.message : String(e));
            setEntries([]);
            setGlobal({ entries: [], me: { visible: true, xp: 0, rank: null } });
        }
    }, []);

    useFocusEffect(useCallback(() => { if (user) void load(period, scope); }, [user, period, scope, load]));

    if (user === undefined) return <View style={[s.container, s.center]}><ActivityIndicator color={t.blue} /></View>;

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
                {(["friends", "global"] as const).map((w) => (
                    <Pressable key={w} style={[s.tab, scope === w && s.tabOn]} onPress={() => { setEntries(null); setGlobal(null); setScope(w); }}>
                        <Text style={[s.tabText, scope === w && s.tabTextOn]}>{w === "friends" ? "Friends" : "🌍 Global"}</Text>
                    </Pressable>
                ))}
            </View>

            <View style={s.toggle}>
                {(["week", "all"] as const).map((p) => (
                    <Pressable key={p} style={[s.tab, period === p && s.tabOn]} onPress={() => { setEntries(null); setGlobal(null); setPeriod(p); }}>
                        <Text style={[s.tabText, period === p && s.tabTextOn]}>{p === "week" ? "This week" : "All time"}</Text>
                    </Pressable>
                ))}
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            {scope === "global" ? (
                global === null ? (
                    <ActivityIndicator color={t.blue} style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={global.entries}
                        keyExtractor={(e) => e.uid}
                        contentContainerStyle={{ gap: 8, paddingBottom: 60 }}
                        ListEmptyComponent={<Text style={s.muted}>No one has earned XP {period === "week" ? "this week" : "yet"}. Be the first!</Text>}
                        ListFooterComponent={
                            !global.me.visible ? (
                                <Pressable onPress={() => router.push("/friends")}>
                                    <Text style={s.link}>You are hidden from this board. Change it in Friends.</Text>
                                </Pressable>
                            ) : global.me.rank !== null && !global.entries.some((e) => e.isMe) ? (
                                <View style={[s.row, s.me]}>
                                    <Text style={s.rank}>#{global.me.rank}</Text>
                                    <Text style={[s.name, { flex: 1 }]}>You</Text>
                                    <Text style={s.xp}>{global.me.xp.toLocaleString("en-US")} XP</Text>
                                </View>
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
                )
            ) : entries === null ? (
                <ActivityIndicator color={t.blue} style={{ marginTop: 40 }} />
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

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 20 },
    center: { alignItems: "center", justifyContent: "center", gap: 14 },
    heading: { color: t.text, fontSize: 18, fontWeight: "600" },
    toggle: { flexDirection: "row", backgroundColor: t.surface, borderRadius: 12, padding: 4, marginBottom: 10 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
    tabOn: { backgroundColor: t.surfaceHigh },
    tabText: { color: t.muted, fontWeight: "600" },
    tabTextOn: { color: t.text },
    row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surface, borderRadius: 12, padding: 14 },
    me: { borderWidth: 1, borderColor: t.yellow },
    rank: { color: t.text, fontSize: 20, width: 34, textAlign: "center" },
    name: { color: t.text, fontSize: 16, fontWeight: "600" },
    muted: { color: t.muted, fontSize: 13, textAlign: "center" },
    xp: { color: t.green, fontSize: 16, fontWeight: "bold" },
    link: { color: t.blue, textAlign: "center", fontSize: 14, paddingVertical: 10 },
    error: { color: t.red, textAlign: "center", marginBottom: 10 },
    button: { backgroundColor: t.green, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24 },
    buttonText: { color: t.bg, fontSize: 16, fontWeight: "bold" },
});
