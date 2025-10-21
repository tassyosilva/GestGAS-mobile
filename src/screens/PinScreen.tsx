import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { storageService } from '../services/storageService';

interface Props {
    mode: 'create' | 'verify';
    onSuccess: () => void;
    onCancel?: () => void;
}

export default function PinScreen({ mode, onSuccess, onCancel }: Props) {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState<'enter' | 'confirm'>('enter');
    const [loading, setLoading] = useState(false);

    const handleNumberPress = (num: string) => {
        if (mode === 'create' && step === 'enter') {
            if (pin.length < 4) {
                setPin(pin + num);
                if (pin.length === 3) {
                    setTimeout(() => setStep('confirm'), 300);
                }
            }
        } else if (mode === 'create' && step === 'confirm') {
            if (confirmPin.length < 4) {
                const newConfirmPin = confirmPin + num;
                setConfirmPin(newConfirmPin);
                if (newConfirmPin.length === 4) {
                    setTimeout(() => handleCreatePin(pin, newConfirmPin), 300);
                }
            }
        } else if (mode === 'verify') {
            if (pin.length < 4) {
                const newPin = pin + num;
                setPin(newPin);
                if (newPin.length === 4) {
                    setTimeout(() => handleVerifyPin(newPin), 300);
                }
            }
        }
    };

    const handleBackspace = () => {
        if (mode === 'create' && step === 'confirm') {
            setConfirmPin(confirmPin.slice(0, -1));
        } else {
            setPin(pin.slice(0, -1));
        }
    };

    const handleCreatePin = async (pinToSave: string, confirmation: string) => {
        if (pinToSave !== confirmation) {
            Alert.alert('Erro', 'Os PINs não coincidem. Tente novamente.');
            setPin('');
            setConfirmPin('');
            setStep('enter');
            return;
        }

        setLoading(true);
        try {
            await storageService.setPin(pinToSave);
            Alert.alert('Sucesso', 'PIN criado com sucesso!', [
                { text: 'OK', onPress: onSuccess }
            ]);
        } catch (error) {
            console.error('Erro ao criar PIN:', error);
            Alert.alert('Erro', 'Não foi possível criar o PIN. Tente novamente.');
            setPin('');
            setConfirmPin('');
            setStep('enter');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyPin = async (pinToVerify: string) => {
        setLoading(true);
        try {
            const savedPin = await storageService.getPin();
            if (savedPin === pinToVerify) {
                onSuccess();
            } else {
                Alert.alert('Erro', 'PIN incorreto. Tente novamente.');
                setPin('');
            }
        } catch (error) {
            console.error('Erro ao verificar PIN:', error);
            Alert.alert('Erro', 'Não foi possível verificar o PIN.');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const currentPin = step === 'confirm' ? confirmPin : pin;
    const title = mode === 'create'
        ? (step === 'enter' ? 'Criar PIN de Acesso' : 'Confirmar PIN')
        : 'Digite seu PIN';
    const subtitle = mode === 'create'
        ? (step === 'enter' ? 'Digite 4 números' : 'Digite novamente')
        : 'Para acessar o aplicativo';

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {onCancel && (
                <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
            )}

            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <View style={styles.pinDisplay}>
                {[0, 1, 2, 3].map((index) => (
                    <View
                        key={index}
                        style={[
                            styles.pinDot,
                            currentPin.length > index && styles.pinDotFilled,
                        ]}
                    />
                ))}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1976d2" />
                </View>
            ) : (
                <View style={styles.keypad}>
                    {[
                        ['1', '2', '3'],
                        ['4', '5', '6'],
                        ['7', '8', '9'],
                        ['', '0', 'back'],
                    ].map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.keypadRow}>
                            {row.map((key) => {
                                if (key === '') {
                                    return <View key="empty" style={styles.keypadButton} />;
                                }
                                if (key === 'back') {
                                    return (
                                        <TouchableOpacity
                                            key="back"
                                            style={styles.keypadButton}
                                            onPress={handleBackspace}
                                        >
                                            <Ionicons name="backspace-outline" size={28} color="#333" />
                                        </TouchableOpacity>
                                    );
                                }
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        style={styles.keypadButton}
                                        onPress={() => handleNumberPress(key)}
                                    >
                                        <Text style={styles.keypadButtonText}>{key}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                </View>
            )}

            {mode === 'verify' && onCancel && (
                <TouchableOpacity style={styles.forgotButton} onPress={onCancel}>
                    <Text style={styles.forgotButtonText}>Esqueci meu PIN</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1976d2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        padding: 8,
        zIndex: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 60,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#e3f2fd',
    },
    pinDisplay: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 60,
        gap: 20,
    },
    pinDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#fff',
        backgroundColor: 'transparent',
    },
    pinDotFilled: {
        backgroundColor: '#fff',
    },
    loadingContainer: {
        height: 400,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keypad: {
        width: '80%',
        maxWidth: 350,
    },
    keypadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    keypadButton: {
        width: 75,
        height: 75,
        borderRadius: 37.5,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    keypadButtonText: {
        fontSize: 28,
        fontWeight: '600',
        color: '#333',
    },
    forgotButton: {
        marginTop: 30,
        padding: 12,
    },
    forgotButtonText: {
        color: '#e3f2fd',
        fontSize: 16,
        textDecorationLine: 'underline',
    },
});