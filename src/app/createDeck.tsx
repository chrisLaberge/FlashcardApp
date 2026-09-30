import { router } from "expo-router";
import { useState } from "react";
import {
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { languages } from "../constants/languages";
import { addDeck } from "../database/database";

export default function CreateDeckScreen() {
    const [name, setName] = useState("");
    const [language, setLanguage] = useState(languages[1]);
    const [modalVisible, setModalVisible] = useState(false);
    const [search, setSearch] = useState("");

    const filteredLanguages = languages.filter((item) => {
        const query = search.toLowerCase();

        return (
            item.name.toLowerCase().includes(query) ||
            item.nativeName.toLowerCase().includes(query)
        );
    });

    const createDeck = async () => {
        if (!name.trim()) return;

        await addDeck(name.trim(), language.code);
        router.back();
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <Text style={styles.smallTitle}>NEW DECK</Text>

            <Text style={styles.title}>Create a Deck</Text>

            <Text style={styles.subtitle}>
                Choose a language and give your deck a name.
            </Text>

            <View style={styles.card}>
                <Text style={styles.label}>DECK NAME</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Beginner Chinese"
                    placeholderTextColor="#7c6f64"
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
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalBackground}>
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
                            placeholderTextColor="#7c6f64"
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
                                        <Text style={styles.optionName}>
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
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#282828",
        padding: 22,
        paddingTop: 55,
    },

    smallTitle: {
        color: "#d79921",
        fontSize: 13,
        fontWeight: "bold",
        letterSpacing: 2,
    },

    title: {
        color: "#ebdbb2",
        fontSize: 34,
        fontWeight: "bold",
        marginTop: 8,
    },

    subtitle: {
        color: "#a89984",
        fontSize: 15,
        marginTop: 5,
        marginBottom: 30,
    },

    card: {
        backgroundColor: "#3c3836",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#504945",
        padding: 20,
    },

    label: {
        color: "#d79921",
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: 1,
        marginBottom: 8,
        marginTop: 5,
    },

    input: {
        backgroundColor: "#282828",
        borderRadius: 9,
        borderWidth: 1,
        borderColor: "#504945",
        color: "#ebdbb2",
        padding: 15,
        fontSize: 16,
        marginBottom: 22,
    },

    languageButton: {
        backgroundColor: "#282828",
        borderWidth: 1,
        borderColor: "#504945",
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
        color: "#ebdbb2",
        fontSize: 16,
        fontWeight: "bold",
    },

    nativeName: {
        color: "#a89984",
        fontSize: 14,
        marginTop: 2,
    },

    arrow: {
        color: "#a89984",
        fontSize: 28,
    },

    bottom: {
        marginTop: "auto",
    },

    createButton: {
        backgroundColor: "#d79921",
        padding: 17,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 5,
    },

    createText: {
        color: "#282828",
        fontSize: 17,
        fontWeight: "bold",
    },

    cancelText: {
        color: "#a89984",
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
        backgroundColor: "#282828",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderColor: "#504945",
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
        color: "#ebdbb2",
        fontSize: 23,
        fontWeight: "bold",
    },

    modalSubtitle: {
        color: "#a89984",
        fontSize: 13,
        marginTop: 3,
    },

    closeButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#3c3836",
        alignItems: "center",
        justifyContent: "center",
    },

    closeText: {
        color: "#ebdbb2",
        fontSize: 27,
        lineHeight: 29,
    },

    searchInput: {
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#504945",
        borderRadius: 10,
        color: "#ebdbb2",
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
        backgroundColor: "#3c3836",
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

    optionName: {
        color: "#ebdbb2",
        fontSize: 16,
        fontWeight: "bold",
    },

    optionNative: {
        color: "#a89984",
        fontSize: 14,
        marginTop: 2,
    },

    check: {
        color: "#b8bb26",
        fontSize: 20,
        fontWeight: "bold",
        marginRight: 8,
    },

    pressed: {
        opacity: 0.6,
    },
});