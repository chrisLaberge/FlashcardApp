import { router } from "expo-router";
import { useEffect, useState, useMemo } from "react";
import { FlatList, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import Pressable from "../components/Pressable";
import KeyboardInsetView from "../components/KeyboardInsetView";
import { languages } from "../constants/languages";
import { addDeck, getDecks } from "../database/database";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

export default function CreateDeckScreen() {
    const t = useTheme();
    const styles = useMemo(() => makeStyles(t), [t]);
    const [name, setName] = useState("");
    const [language, setLanguage] = useState(languages[1]);
    const [modalVisible, setModalVisible] = useState(false);
    const [search, setSearch] = useState("");
    const [deckCount, setDeckCount] = useState(0);

    useEffect(() => {
        let alive = true;
        getDecks().then((decks) => { if (alive) setDeckCount(decks.length); }).catch(() => undefined);
        return () => { alive = false; };
    }, []);

    // Left empty, the deck is named after its place in the list: Deck 1, Deck 2...
    const defaultName = `Deck ${deckCount + 1}`;

    const filteredLanguages = languages.filter((item) => {
        const query = search.toLowerCase();

        return (
            item.name.toLowerCase().includes(query) ||
            item.nativeName.toLowerCase().includes(query)
        );
    });

    const createDeck = async () => {
        await addDeck(name.trim() || defaultName, language.code);
        router.back();
    };

    return (
        <KeyboardInsetView style={styles.container}>
            <Text style={styles.smallTitle}>NEW DECK</Text>

            <Text style={styles.title}>Create a Deck</Text>

            <Text style={styles.subtitle}>
                Choose a language and give your deck a name.
            </Text>

            <View style={styles.card}>
                <Text style={styles.label}>DECK NAME</Text>

                <TextInput
                    style={styles.input}
                    placeholder={defaultName}
                    placeholderTextColor={t.subtle}
                    value={name}
                    onChangeText={setName}
                />

                <Text style={styles.label}>LANGUAGE</Text>

                <Pressable
                    style={styles.languageButton}
                    onPress={() => setModalVisible(true)}
                >
                    <View style={styles.languageLeft}>
                        <Text style={styles.flag}>{language.flag}</Text>

                        <View>
                            <Text style={styles.languageName}>
                                {language.name}
                            </Text>

                            <Text style={styles.nativeName}>
                                {language.nativeName}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.arrow}>›</Text>
                </Pressable>
            </View>

            <View style={styles.bottom}>
                <Pressable
                    style={({ pressed }) => [
                        styles.createButton,
                        pressed && styles.pressed,
                    ]}
                    onPress={createDeck}
                >
                    <Text style={styles.createText}>Create Deck</Text>
                </Pressable>

                <Pressable
                    onPress={() => router.back()}
                    style={({ pressed }) => pressed && styles.pressed}
                >
                    <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
            </View>

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                statusBarTranslucent
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardInsetView style={styles.modalBackground}>
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>
                                    Choose Language
                                </Text>

                                <Text style={styles.modalSubtitle}>
                                    {filteredLanguages.length} languages
                                </Text>
                            </View>

                            <Pressable
                                onPress={() => {
                                    setModalVisible(false);
                                    setSearch("");
                                }}
                                style={styles.closeButton}
                            >
                                <Text style={styles.closeText}>×</Text>
                            </Pressable>
                        </View>

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search in English or native language..."
                            placeholderTextColor={t.subtle}
                            value={search}
                            onChangeText={setSearch}
                            autoFocus
                        />

                        <FlatList
                            data={filteredLanguages}
                            keyExtractor={(item) => item.code}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.list}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.languageOption,
                                        item.code === language.code &&
                                        styles.selectedOption,
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={() => {
                                        setLanguage(item);
                                        setModalVisible(false);
                                        setSearch("");
                                    }}
                                >
                                    <Text style={styles.optionFlag}>
                                        {item.flag}
                                    </Text>

                                    <View style={styles.optionText}>
                                        <Text style={styles.optionIgnore}>
                                            {item.name}
                                        </Text>

                                        <Text style={styles.optionNative}>
                                            {item.nativeName}
                                        </Text>
                                    </View>

                                    {item.code === language.code && (
                                        <Text style={styles.check}>✓</Text>
                                    )}
                                </Pressable>
                            )}
                        />
                    </View>
                </KeyboardInsetView>
            </Modal>
        </KeyboardInsetView>
    );
}

const makeStyles = (t: Palette) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: t.bg,
        padding: 22,
        paddingTop: 55,
    },

    smallTitle: {
        color: t.gold,
        fontSize: 13,
        fontWeight: "600",
        letterSpacing: 2,
    },

    title: {
        color: t.text,
        fontSize: 34,
        fontWeight: "600",
        marginTop: 8,
    },

    subtitle: {
        color: t.muted,
        fontSize: 15,
        marginTop: 5,
        marginBottom: 30,
    },

    card: {
        backgroundColor: t.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: t.surfaceHigh,
        padding: 20,
    },

    label: {
        color: t.gold,
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 1,
        marginBottom: 8,
        marginTop: 5,
    },

    input: {
        backgroundColor: t.bg,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: t.surfaceHigh,
        color: t.text,
        padding: 15,
        fontSize: 16,
        marginBottom: 22,
    },

    languageButton: {
        backgroundColor: t.bg,
        borderWidth: 1,
        borderColor: t.surfaceHigh,
        borderRadius: 10,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    languageLeft: {
        flexDirection: "row",
        alignItems: "center",
    },

    flag: {
        fontSize: 27,
        marginRight: 13,
    },

    languageName: {
        color: t.text,
        fontSize: 16,
        fontWeight: "600",
    },

    nativeName: {
        color: t.muted,
        fontSize: 14,
        marginTop: 2,
    },

    arrow: {
        color: t.muted,
        fontSize: 28,
    },

    bottom: {
        marginTop: "auto",
    },

    createButton: {
        backgroundColor: t.gold,
        padding: 17,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 5,
    },

    createText: {
        color: t.bg,
        fontSize: 17,
        fontWeight: "600",
    },

    cancelText: {
        color: t.muted,
        textAlign: "center",
        padding: 15,
        fontSize: 16,
    },

    modalBackground: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        justifyContent: "flex-end",
    },

    modal: {
        backgroundColor: t.bg,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderColor: t.surfaceHigh,
        height: "88%",
        paddingTop: 20,
    },

    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        marginBottom: 15,
    },

    modalTitle: {
        color: t.text,
        fontSize: 23,
        fontWeight: "600",
    },

    modalSubtitle: {
        color: t.muted,
        fontSize: 13,
        marginTop: 3,
    },

    closeButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: t.surface,
        alignItems: "center",
        justifyContent: "center",
    },

    closeText: {
        color: t.text,
        fontSize: 27,
        lineHeight: 29,
    },

    searchInput: {
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.surfaceHigh,
        borderRadius: 10,
        color: t.text,
        padding: 14,
        marginHorizontal: 20,
        marginBottom: 10,
        fontSize: 15,
    },

    list: {
        paddingHorizontal: 12,
        paddingBottom: 30,
    },

    languageOption: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 13,
        paddingHorizontal: 10,
        borderRadius: 10,
    },

    selectedOption: {
        backgroundColor: t.surface,
    },

    optionFlag: {
        fontSize: 27,
        width: 45,
        textAlign: "center",
    },

    optionText: {
        flex: 1,
        marginLeft: 10,
    },

    optionIgnore: {
        color: t.text,
        fontSize: 16,
        fontWeight: "600",
    },

    optionNative: {
        color: t.muted,
        fontSize: 14,
        marginTop: 2,
    },

    check: {
        color: t.green,
        fontSize: 20,
        fontWeight: "600",
        marginRight: 8,
    },

    pressed: {
        opacity: 0.6,
    },
});