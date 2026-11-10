import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Avatar from "../components/Avatar";
import BannerView from "../components/pet/BannerView";
import { PersonPet } from "../components/pet/PersonPet";
import PetView from "../components/pet/PetView";
import KeyboardInsetView from "../components/KeyboardInsetView";
import { AVATARS } from "../constants/avatars";
import { useUser } from "../hooks/useUser";
import {
    acceptRequest, deleteMyData, getFriends, getProfile, removeFriend, removeRequest, requestFriend, saveUsername, setAvatar, setShowGlobal,
    type Friends, type Person, type Profile,
} from "../services/social";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export default function FriendsScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const user = useUser();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [friends, setFriends] = useState<Friends>({ friends: [], incoming: [], outgoing: [] });
    const [username, setUsername] = useState("");
    const [code, setCode] = useState("");
    const [editingName, setEditingName] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");

    const load = useCallback(async () => {
        try {
            const mine = await getProfile();
            setProfile(mine);
            if (mine) setFriends(await getFriends());
        } catch (error) {
            setNotice(message(error));
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { if (user) void load(); }, [user, load]));

    const run = async (action: () => Promise<unknown>, after?: () => void) => {
        if (busy) return;
        setBusy(true);
        setNotice("");
        try {
            await action();
            after?.();
            await load();
        } catch (error) {
            setNotice(message(error));
        } finally {
            setBusy(false);
        }
    };

    // For settings: the screen changes at once and the server is told in the background. If that fails, the change is undone and why is shown.
    const quick = (change: Partial<Profile>, send: () => Promise<unknown>) => {
        if (!profile) return;
        const before = profile;
        setProfile({ ...profile, ...change });
        send().catch((error: unknown) => {
            setProfile(before);
            setNotice(message(error));
        });
    };

    if (user === undefined) return <View style={[s.container, s.center]}><ActivityIndicator color={t.blue} /></View>;

    if (!user) {
        return (
            <View style={[s.container, s.center]}>
                <Text style={s.heading}>Sign in to add friends</Text>
                <Text style={s.muted}>Sign in to use friends and the leaderboard.</Text>
                <Pressable style={[s.button, s.primary]} onPress={() => router.push("/account")}>
                    <Text style={s.primaryText}>Sign in</Text>
                </Pressable>
            </View>
        );
    }

    if (loading) return <View style={[s.container, s.center]}><ActivityIndicator color={t.blue} /></View>;

    if (!profile || editingName) {
        return (
            <KeyboardInsetView style={[s.container, s.center]}>
                <Text style={s.heading}>{profile ? "Change username" : "Pick a username"}</Text>
                <Text style={s.muted}>3 to 20 letters, numbers or _. Friends and the leaderboard see it, never your email.</Text>
                <TextInput
                    style={s.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="username"
                    placeholderTextColor={t.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                />
                {notice ? <Text style={s.error}>{notice}</Text> : null}
                <Pressable
                    style={[s.button, s.primary]}
                    disabled={busy}
                    onPress={() => run(() => saveUsername(username), () => { setEditingName(false); setUsername(""); })}
                >
                    {busy ? <ActivityIndicator color={t.bg} /> : <Text style={s.primaryText}>Save</Text>}
                </Pressable>
                {profile ? (
                    <Pressable onPress={() => { setEditingName(false); setNotice(""); }}><Text style={s.link}>Cancel</Text></Pressable>
                ) : null}
            </KeyboardInsetView>
        );
    }

    const shareCode = () =>
        Share.share({ message: `Add me on StompaCard! My friend code is ${profile.friendCode}` }).catch(() => undefined);

    const confirmRemove = (person: Person) =>
        Alert.alert("Remove friend?", `${person.username} will no longer see you on their leaderboard.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: () => run(() => removeFriend(person.uid)) },
        ]);

    const confirmDelete = () =>
        Alert.alert(
            "Delete my online data?",
            "This removes your username, friends and uploaded stats from the server. Your decks and progress on this phone are not touched.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => run(deleteMyData, () => setFriends({ friends: [], incoming: [], outgoing: [] })) },
            ],
        );

    return (
        <KeyboardInsetView style={{ flex: 1 }}>
        <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <View style={s.card}>
                <BannerView id={profile.banner} style={s.hero}>
                    <Avatar avatar={profile.avatar} name={profile.username} size={72} />
                    {profile.pet ? (
                        <View style={s.heroPet}>
                            <PetView level={profile.level} look={{ hat: profile.pet.hat, glasses: profile.pet.glasses, scarf: profile.pet.scarf }} size={84} animated={false} />
                        </View>
                    ) : null}
                </BannerView>
                <Text style={s.muted}>Your friend code</Text>
                <Text style={s.code} selectable>{profile.friendCode.slice(0, 4)}-{profile.friendCode.slice(4)}</Text>
                <View style={s.row}>
                    <Pressable style={[s.smallButton, s.primary]} onPress={shareCode}><Text style={s.primaryText}>Share</Text></Pressable>
                    <Pressable style={[s.smallButton, s.secondary]} onPress={() => { setUsername(profile.username); setEditingName(true); }}>
                        <Text style={s.secondaryText}>@{profile.username}</Text>
                    </Pressable>
                </View>
            </View>

            <View style={s.card}>
                <Text style={s.heading}>Profile picture</Text>
                <View style={s.avatarGrid}>
                    {AVATARS.map((a) => (
                        <Pressable
                            key={a}
                            onPress={() => quick({ avatar: a }, () => setAvatar(a))}
                            hitSlop={6}
                            style={[s.avatarOption, profile.avatar === a && s.avatarOn]}
                            accessibilityLabel={`Use ${a} as your picture`}
                        >
                            <Text style={s.avatarEmoji}>{a}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            <View style={[s.card, s.switchCard]}>
                <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.heading}>Global leaderboard</Text>
                    <Text style={s.muted}>Show my username, level and XP to everyone</Text>
                </View>
                <Switch
                    value={profile.showGlobal}
                    onValueChange={(value) => quick({ showGlobal: value }, () => setShowGlobal(value))}
                    trackColor={{ true: t.green, false: t.surfaceHigh }}
                />
            </View>

            <View style={s.card}>
                <Text style={s.heading}>Add a friend</Text>
                <TextInput
                    style={s.input}
                    value={code}
                    onChangeText={setCode}
                    placeholder="Their friend code"
                    placeholderTextColor={t.subtle}
                    autoCapitalize="characters"
                    autoCorrect={false}
                />
                <Pressable
                    style={[s.button, s.primary]}
                    disabled={busy}
                    onPress={() =>
                        run(async () => {
                            const status = await requestFriend(code);
                            setNotice(status === "friends" ? "You're now friends!" : "Request sent. They need to accept it.");
                        }, () => setCode(""))
                    }
                >
                    <Text style={s.primaryText}>Send request</Text>
                </Pressable>
                {notice ? <Text style={notice.includes("!") || notice.startsWith("Request sent") ? s.ok : s.error}>{notice}</Text> : null}
            </View>

            {friends.incoming.length > 0 && (
                <View style={s.card}>
                    <Text style={s.heading}>Requests</Text>
                    {friends.incoming.map((p) => (
                        <View key={p.uid} style={s.personRow}>
                            <View style={s.nameWithPicture}><Avatar avatar={p.avatar} name={p.username} size={34} /><Text style={s.name}>{p.username}</Text><PersonPet pet={p.pet} level={p.level} size={34} /></View>
                            <View style={s.row}>
                                <Pressable style={[s.smallButton, s.primary]} onPress={() => run(() => acceptRequest(p.uid))}><Text style={s.primaryText}>Accept</Text></Pressable>
                                <Pressable style={[s.smallButton, s.secondary]} onPress={() => run(() => removeRequest(p.uid))}><Text style={s.secondaryText}>Decline</Text></Pressable>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            <View style={s.card}>
                <Text style={s.heading}>Friends ({friends.friends.length})</Text>
                {friends.friends.length === 0 && <Text style={s.muted}>No friends yet.</Text>}
                {friends.friends.map((p) => (
                    <Pressable key={p.uid} style={s.personRow} onLongPress={() => confirmRemove(p)}>
                        <View style={s.nameWithPicture}><Avatar avatar={p.avatar} name={p.username} size={34} /><Text style={s.name}>{p.username}</Text><PersonPet pet={p.pet} level={p.level} size={34} /></View>
                        <Text style={s.muted}>Level {p.level} · {p.currentStreak} 🔥</Text>
                    </Pressable>
                ))}
                {friends.friends.length > 0 && <Text style={s.hint}>Hold a friend to remove them</Text>}
            </View>

            {friends.outgoing.length > 0 && (
                <View style={s.card}>
                    <Text style={s.heading}>Waiting for them</Text>
                    {friends.outgoing.map((p) => (
                        <View key={p.uid} style={s.personRow}>
                            <View style={s.nameWithPicture}><Avatar avatar={p.avatar} name={p.username} size={34} /><Text style={s.name}>{p.username}</Text><PersonPet pet={p.pet} level={p.level} size={34} /></View>
                            <Pressable onPress={() => run(() => removeRequest(p.uid))}><Text style={s.link}>Cancel</Text></Pressable>
                        </View>
                    ))}
                </View>
            )}

            <Pressable onPress={() => router.push("/leaderboard")}><Text style={s.link}>Open the leaderboard</Text></Pressable>
            <Pressable onPress={confirmDelete}><Text style={s.danger}>Delete my online data</Text></Pressable>
        </ScrollView>
        </KeyboardInsetView>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    nameWithPicture: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
    avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
    avatarOption: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceHigh, borderWidth: 2, borderColor: "transparent" },
    avatarOn: { borderColor: t.yellow },
    avatarEmoji: { fontSize: 28 },
    hero: { height: 120, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 14 },
    heroPet: { marginTop: 8 },
    container: { flex: 1, backgroundColor: t.bg, padding: 20 },
    content: { gap: 14, paddingBottom: 60 },
    switchCard: { flexDirection: "row", alignItems: "center", gap: 12 },
    center: { alignItems: "center", justifyContent: "center", gap: 14 },
    card: { backgroundColor: t.surface, borderRadius: 14, padding: 16, gap: 10 },
    heading: { color: t.text, fontSize: 18, fontWeight: "600" },
    muted: { color: t.muted, fontSize: 13 },
    hint: { color: t.subtle, fontSize: 12, textAlign: "center" },
    code: { color: t.yellow, fontSize: 32, fontWeight: "bold", letterSpacing: 4 },
    input: { backgroundColor: t.bg, color: t.text, borderRadius: 10, padding: 14, fontSize: 16, alignSelf: "stretch" },
    button: { borderRadius: 10, paddingVertical: 14, alignItems: "center", alignSelf: "stretch" },
    smallButton: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
    primary: { backgroundColor: t.green },
    primaryText: { color: t.bg, fontSize: 15, fontWeight: "bold" },
    secondary: { backgroundColor: t.surfaceHigh },
    secondaryText: { color: t.text, fontSize: 15, fontWeight: "600" },
    row: { flexDirection: "row", gap: 10, alignItems: "center" },
    personRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, gap: 10 },
    name: { color: t.text, fontSize: 16, fontWeight: "600", flexShrink: 1 },
    link: { color: t.blue, textAlign: "center", fontSize: 14, paddingVertical: 4 },
    danger: { color: t.red, textAlign: "center", fontSize: 13, paddingVertical: 8 },
    error: { color: t.red, fontSize: 14, textAlign: "center" },
    ok: { color: t.green, fontSize: 14, textAlign: "center" },
});
