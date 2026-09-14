import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import {
    deleteCard,
    getCardProgress,
    getCards,
    resetCardProgress,
    updateCard,
} from "../database/database";

import { CardProgress } from "../models/CardProgress";

export default function EditCardScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const cardId = Number(id);

    const [front, setFront] = useState("");
    const [back, setBack] = useState("");
    const [progress, setProgress] = useState<CardProgress>();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);

    useEffect(() => {
        const loadCard = async () => {
            const cards = await getCards();

            const card = cards.find(
                (card) => card.id === cardId
            );

            if (card) {
                setFront(card.front);
                setBack(card.back);
            }

            const cardProgress = await getCardProgress(cardId);

            if (cardProgress) {
                setProgress(cardProgress);
            }
        };

        loadCard();
    }, [cardId]);

    const saveChanges = async () => {
        await updateCard(cardId, front, back);
        router.back();
    };

    const removeCard = async () => {
        await deleteCard(cardId);
        router.back();
    };

    const resetCard = async () => {
        await resetCardProgress(cardId);
        const cardProgress = await getCardProgress(cardId);

        if (cardProgress) {
            setProgress(cardProgress);
        }

    };


    return (
        <View style={styles.container}>
            <Text style={styles.title}>Edit Card</Text>

            <View style={styles.form}>
                <Text style={styles.label}>Front</Text>

                <TextInput
                    style={styles.input}
                    value={front}
                    onChangeText={setFront}
                    placeholder="Enter the word or phrase"
                    placeholderTextColor="#a89984"
                />

                <Text style={styles.label}>Back</Text>

                <TextInput
                    style={styles.input}
                    value={back}
                    onChangeText={setBack}
                    placeholder="Enter the meaning"
                    placeholderTextColor="#a89984"
                />

                <Pressable
                    style={({ pressed }) => [
                        styles.saveButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={saveChanges}
                >
                    <Text style={styles.saveButtonText}>
                        Save Changes
                    </Text>
                </Pressable>
            </View>

            <View style={styles.progressSection}>
                <Text style={styles.sectionTitle}>
                    Learning Progress
                </Text>

                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {progress?.reviewCount ?? 0}
                        </Text>

                        <Text style={styles.statLabel}>
                            Level
                        </Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {formatTimeRemaining(
                                progress?.nextReviewAt
                            )}
                        </Text>

                        <Text style={styles.statLabel}>
                            Next Review
                        </Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {progress?.mastered ? "Yes" : "No"}
                        </Text>

                        <Text style={styles.statLabel}>
                            Mastered
                        </Text>
                    </View>
                </View>
            </View>

            <Pressable
                style={({ pressed }) => [
                    styles.resetButton,
                    pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowResetModal(true)}
            >
                <Text style={styles.resetButtonText}>
                    Reset Card
                </Text>
            </Pressable>

            <Pressable
                style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowDeleteModal(true)}
            >
                <Text style={styles.deleteButtonText}>
                    Delete Card
                </Text>
            </Pressable>

            <Modal
                visible={showResetModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowResetModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>
                            Reset Card Progress?
                        </Text>

                        <Text style={styles.modalText}>
                            This will reset this card's learning progress
                            back to the beginning.
                        </Text>

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={styles.cancelButton}
                                onPress={() => setShowResetModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>
                                    Cancel
                                </Text>
                            </Pressable>

                            <Pressable
                                style={styles.resetConfirmButton}
                                onPress={async () => {
                                    await resetCard();
                                    setShowResetModal(false);
                                }}
                            >
                                <Text style={styles.resetConfirmText}>
                                    Reset
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>
                            Delete Card?
                        </Text>

                        <Text style={styles.modalText}>
                            Are you sure you want to permanently delete
                            this card?
                        </Text>

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={styles.cancelButton}
                                onPress={() => setShowDeleteModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>
                                    Cancel
                                </Text>
                            </Pressable>

                            <Pressable
                                style={styles.deleteConfirmButton}
                                onPress={async () => {
                                    await removeCard();
                                }}
                            >
                                <Text style={styles.deleteConfirmText}>
                                    Delete
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>


        </View>
    );
}

function formatTimeRemaining(nextReviewAt?: number): string {
    if (!nextReviewAt) {
        return "Now";
    }

    const remaining = nextReviewAt - Date.now();

    if (remaining <= 0) {
        return "Now";
    }

    const minutes = Math.ceil(remaining / (60 * 1000));

    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.ceil(minutes / 60);

    if (hours < 24) {
        return `${hours} hr`;
    }

    const days = Math.ceil(hours / 24);

    return `${days} day${days === 1 ? "" : "s"}`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#282828",
        padding: 20,
        paddingTop: 40,
    },

    title: {
        color: "#ebdbb2",
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 30,
    },

    form: {
        gap: 4,
    },

    label: {
        color: "#ebdbb2",
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 8,
    },

    input: {
        backgroundColor: "#3c3836",
        color: "#ebdbb2",
        fontSize: 18,
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#504945",
        marginBottom: 16,
    },

    saveButton: {
        backgroundColor: "#d79921",
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 8,
    },

    saveButtonText: {
        color: "#282828",
        fontSize: 17,
        fontWeight: "bold",
    },

    progressSection: {
        marginTop: 30,
    },

    sectionTitle: {
        color: "#ebdbb2",
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 12,
    },

    statsContainer: {
        flexDirection: "row",
        gap: 10,
    },

    statCard: {
        flex: 1,
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#504945",
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: "center",
    },

    statNumber: {
        color: "#d79921",
        fontSize: 21,
        fontWeight: "bold",
        marginBottom: 5,
    },

    statLabel: {
        color: "#a89984",
        fontSize: 13,
        textAlign: "center",
    },

    deleteButton: {
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#cc241d",
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 30,
    },

    deleteButtonText: {
        color: "#cc241d",
        fontSize: 17,
        fontWeight: "bold",
    },

    resetButton: {
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#5992b1",
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 30,
    },

    resetButtonText: {
        color: "#5992b1",
        fontSize: 17,
        fontWeight: "bold",
    },

    buttonPressed: {
        opacity: 0.7,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        justifyContent: "center",
        alignItems: "center",
    },

    modal: {
        width: "85%",
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#504945",
        borderRadius: 15,
        padding: 22,
    },

    modalTitle: {
        color: "#ebdbb2",
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 10,
    },

    modalText: {
        color: "#a89984",
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 24,
    },

    modalButtons: {
        flexDirection: "row",
        gap: 10,
    },

    cancelButton: {
        flex: 1,
        backgroundColor: "#504945",
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    cancelButtonText: {
        color: "#ebdbb2",
        fontSize: 16,
        fontWeight: "bold",
    },

    resetConfirmButton: {
        flex: 1,
        backgroundColor: "#5992b1",
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    resetConfirmText: {
        color: "#282828",
        fontSize: 16,
        fontWeight: "bold",
    },

    deleteConfirmButton: {
        flex: 1,
        backgroundColor: "#cc241d",
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    deleteConfirmText: {
        color: "#ebdbb2",
        fontSize: 16,
        fontWeight: "bold",
    },
});