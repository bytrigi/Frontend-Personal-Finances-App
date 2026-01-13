import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Modal, StatusBar, Animated, Keyboard, LayoutAnimation, UIManager } from 'react-native';
import axios from 'axios';
import Markdown from 'react-native-markdown-display';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://100.102.205.118:8000';
console.log("Conectando a:", API_URL);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- COMPONENTE: BARRA DE SONIDO QUE "BAILA" ---
const TalkingBar = ({ delay }) => {
  const heightAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(heightAnim, { toValue: Math.random() * 30 + 10, duration: 200, useNativeDriver: false }),
        Animated.timing(heightAnim, { toValue: 10, duration: 200, useNativeDriver: false }),
        Animated.timing(heightAnim, { toValue: Math.random() * 25 + 5, duration: 150, useNativeDriver: false }),
      ]).start(() => animate());
    };
    setTimeout(animate, delay);
  }, []);

  return <Animated.View style={[styles.waveBar, { height: heightAnim }]} />;
};

export default function App() {
  const formatDatePretty = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  // --- ESTADOS ---
  const [modalVisible, setModalVisible] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]); 
  const [loading, setLoading] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const [recording, setRecording] = useState();

  const [transactions, setTransactions] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true); 
  
  const flatListRef = useRef();
  const inputRef = useRef(null); 
  const micScale = useRef(new Animated.Value(1)).current; 

  useEffect(() => {
    fetchHistory();
    // Limpieza de seguridad al salir
    return () => {
      if (recording) { 
        try { recording.stopAndUnloadAsync(); } catch (e) {}
      }
    };
  }, []);

  const fetchHistory = async () => {
    setIsLoadingHistory(true); 
    try {
      const response = await axios.get(`${API_URL}/historial`);
      setTransactions(response.data.transactions);
    } catch (error) {
      console.error("Error cargando historial:", error);
    } finally {
      setIsLoadingHistory(false); 
    }
  };

  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const animateLayout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  // --- 1. FUNCIÓN PARA INICIAR GRABACIÓN REAL ---
  const startRecording = async () => {
    try {
      // LIMPIEZA PREVIA CRUCIAL (Evita el error "Only one Recording object...")
      if (recording) {
        try { await recording.stopAndUnloadAsync(); } catch (e) {}
        setRecording(undefined);
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      
      animateLayout();
      setIsRecording(true);
      
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  // --- 2. FUNCIÓN PARA PARAR Y ENVIAR AL SERVIDOR ---
  const stopRecording = async () => {
    if (!recording) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateLayout();
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI(); 
      setRecording(undefined);

      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      });

      const response = await axios.post(`${API_URL}/transcribir`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      animateLayout();
      setIsTranscribing(false);
      setPrompt(response.data.text);
      
      // Auto-focus para corregir si quieres
      setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 100);

    } catch (error) {
      console.error(error);
      setIsTranscribing(false);
      setPrompt("Error: No se pudo transcribir.");
    }
  };

  // --- MANEJADORES DE INTERFAZ ---
  const handleTextPress = () => {
    setModalVisible(true);
    setIsRecording(false);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 500);
  };

  const handleMicPressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(micScale, { toValue: 0.8, duration: 100, useNativeDriver: true }).start();
  };

  const handleMicPressOut = () => {
    Animated.timing(micScale, { toValue: 1, duration: 100, useNativeDriver: true }).start(() => {
      setModalVisible(true);
      setTimeout(() => {
        startRecording(); 
      }, 300);
    });
  };

  // --- NUEVO: MICRO INTERNO DEL CHAT ---
  const handleSmallMicPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // Vibración
    Keyboard.dismiss(); // Ocultamos teclado
    
    // Transición visual a barra negra
    animateLayout();
    setIsRecording(true); 
    
    // Iniciamos la grabación real con un pequeño delay para que la UI termine de moverse
    setTimeout(() => {
        startRecording();
    }, 300);
  };

  const handleStopBtnPress = () => {
    stopRecording(); 
  };

  const sendMessage = async () => {
    if (!prompt.trim()) return;
    
    // Si estaba grabando y le da a enviar, paramos todo limpio
    if (isRecording && recording) {
        try { await recording.stopAndUnloadAsync(); } catch (e) {}
        setRecording(undefined);
        setIsRecording(false);
    }
    if (isTranscribing) setIsTranscribing(false);

    const userMessage = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/chat`, { prompt: userMessage.content });
      const jarvisMessage = { role: 'jarvis', content: response.data.reply };
      setMessages(prev => [...prev, jarvisMessage]);
    } catch (error) {
      const errorMessage = { role: 'jarvis', content: "⚠️ Error conectando con el servidor." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Renders
  const renderChatMessage = ({ item }) => (
    <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.jarvisBubble]}>
      {item.role === 'user' ? <Text style={styles.userText}>{item.content}</Text> : <Markdown style={markdownStyles}>{item.content}</Markdown>}
    </View>
  );

  const renderTransactionItem = ({ item }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionIconContainer}><Text style={styles.transactionIcon}>{item.icon}</Text></View>
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionTitle}>{item.title}</Text>
        <Text style={styles.transactionDate}>{formatDatePretty(item.date)}</Text>
      </View>
      <Text style={[styles.transactionAmount, item.type === 'income' ? styles.amountPositive : styles.amountNegative]}>{item.amount}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mainContent}>
        
        {/* CABECERA */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Hola, Adrián 👋</Text>
          <View style={styles.card}>
             <Text style={styles.cardTitle}>Tu Saldo Total</Text>
             <Text style={styles.cardAmount}>567,31 €</Text>
             <View style={styles.row}>
                <Text style={styles.accountText}>🏦 Bancaria: 443,53€</Text>
                <Text style={styles.accountText}>🅿️ PayPal: 123,78€</Text>
             </View>
          </View>
        </View>

        {/* LISTA */}
        <Text style={styles.sectionTitle}>Últimos movimientos</Text>
        <FlatList
          data={transactions}
          renderItem={renderTransactionItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.transactionsList}
          showsVerticalScrollIndicator={false}
          refreshing={isLoadingHistory} 
          onRefresh={fetchHistory}
          ListEmptyComponent={!isLoadingHistory && (
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <Text style={{color: '#999', fontStyle: 'italic', fontSize: 16}}>No hay movimientos confirmados.</Text>
                <Text style={{color: '#CCC', fontSize: 12, marginTop: 5}}>(Desliza hacia abajo para recargar)</Text>
              </View>
          )}
        />

        {/* BOTÓN FLOTANTE HOME */}
        <View style={styles.chatTriggerButton}>
          <TouchableOpacity style={styles.textTriggerArea} onPress={handleTextPress} activeOpacity={0.7}>
            <Text style={styles.chatTriggerText}>Pregunta algo...</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.micTriggerArea} 
            onPressIn={handleMicPressIn}   
            onPressOut={handleMicPressOut} 
            activeOpacity={1} 
          >
            <Animated.View style={{ transform: [{ scale: micScale }] }}>
               <Feather name="mic" size={24} color="#FFF" />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL */}
      <Modal animationType="slide" transparent={false} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Asistente Financiero</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Feather name="chevron-down" size={32} color="#007AFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderChatMessage}
              keyExtractor={(_, index) => index.toString()}
              contentContainerStyle={styles.chatList}
            />

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
              
              {/* ZONA BARRA NEGRA (GRABANDO) */}
              {isRecording && (
                <View style={styles.audioBarContainer}>
                  <TouchableOpacity style={styles.audioButtonStop} onPress={handleStopBtnPress}>
                    <View style={styles.stopSquare} />
                  </TouchableOpacity>
                  <View style={styles.waveContainer}>
                     {/* Mantenemos estructura vertical para evitar el error de Strings */}
                     <TalkingBar delay={0} />
                     <TalkingBar delay={100} />
                     <TalkingBar delay={200} />
                     <TalkingBar delay={50} />
                     <TalkingBar delay={150} />
                     <TalkingBar delay={300} />
                     <TalkingBar delay={100} />
                     <TalkingBar delay={0} />
                  </View>
                  <View style={styles.audioButtonPlaceholder}>
                     <Feather name="arrow-up" size={24} color="#333" />
                  </View>
                </View>
              )}

              {/* ZONA TRANSCRIBIENDO */}
              {isTranscribing && (
                <View style={styles.audioBarContainer}>
                   <ActivityIndicator color="#FFF" style={{marginRight: 10}}/>
                   <Text style={{color: '#FFF', fontSize: 16, fontWeight: '500'}}>Transcribiendo...</Text>
                </View>
              )}

              {/* ZONA INPUT TEXTO NORMAL */}
              {!isRecording && !isTranscribing && (
                <View style={styles.inputWrapper}>
                  <View style={styles.inputContainer}>
                    <TextInput 
                      ref={inputRef}
                      style={styles.input} 
                      placeholder="Escribe aquí..." 
                      placeholderTextColor="#999" 
                      value={prompt} 
                      onChangeText={setPrompt} 
                      onSubmitEditing={sendMessage}
                      multiline={true} 
                    />
                    
                    {/* === MICROFONO INTERNO DEL CHAT === */}
                    <TouchableOpacity style={styles.micChatButton} onPress={handleSmallMicPress}>
                       <Feather name="mic" size={24} color="#999" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={loading}>
                      {loading ? <ActivityIndicator color="#FFF" /> : <Feather name="arrow-up" size={24} color="#FFF" />}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            </KeyboardAvoidingView>
          </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// --- ESTILOS ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  mainContent: { flex: 1, padding: 20 },
  headerSection: { marginBottom: 25, marginTop: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#000' },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15, shadowOffset: {width: 0, height: 4}, elevation: 5 },
  cardTitle: { fontSize: 14, color: '#666', marginBottom: 5 },
  cardAmount: { fontSize: 32, fontWeight: '800', marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  accountText: { fontSize: 13, color: '#555', fontWeight: '500' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15, color: '#333' },
  transactionsList: { paddingBottom: 80 },
  transactionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 16, marginBottom: 10 },
  transactionIconContainer: { width: 45, height: 45, backgroundColor: '#F0F0F3', borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  transactionIcon: { fontSize: 22 },
  transactionDetails: { flex: 1 },
  transactionTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  transactionDate: { fontSize: 13, color: '#999', marginTop: 2 },
  transactionAmount: { fontSize: 16, fontWeight: '700' },
  amountNegative: { color: '#FF3B30' },
  amountPositive: { color: '#34C759' },

  chatTriggerButton: { 
    position: 'absolute', 
    bottom: 30, 
    left: 20, 
    right: 20, 
    backgroundColor: '#000', 
    borderRadius: 35, 
    height: 60, 
    flexDirection: 'row', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOpacity: 0.3, 
    shadowRadius: 10, 
    shadowOffset: {width: 0, height: 5}, 
    elevation: 10 
  },
  textTriggerArea: { flex: 1, height: '100%', justifyContent: 'center', paddingLeft: 25 },
  chatTriggerText: { color: '#999', fontSize: 16, fontWeight: '500' },
  micTriggerArea: { paddingHorizontal: 25, height: '100%', justifyContent: 'center', alignItems: 'center' },

  modalContainer: { flex: 1, backgroundColor: '#F2F2F7' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', backgroundColor: '#FFF' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeButton: { padding: 5 },
  chatList: { paddingHorizontal: 15, paddingVertical: 20 },
  messageBubble: { padding: 15, borderRadius: 20, marginBottom: 10, maxWidth: '85%' },
  userBubble: { backgroundColor: '#007AFF', alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  jarvisBubble: { backgroundColor: '#FFF', alignSelf: 'flex-start', borderBottomLeftRadius: 5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  userText: { color: '#FFF', fontSize: 16 },

  inputWrapper: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E5EA', paddingHorizontal: 15, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 15 },
  inputContainer: { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 25, alignItems: 'center', paddingHorizontal: 5, paddingVertical: 5 },
  input: { flex: 1, fontSize: 16, maxHeight: 100, paddingHorizontal: 15, paddingTop: 8, paddingBottom: 8, color: '#000' },
  
  // Estilo del nuevo micro interno
  micChatButton: { padding: 5, marginRight: 5, justifyContent: 'center', alignItems: 'center' },
  
  sendButton: { backgroundColor: '#007AFF', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 5 },

  audioBarContainer: { backgroundColor: '#000', height: 100, borderTopLeftRadius: 20, borderTopRightRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 25, paddingBottom: 20 },
  audioButtonStop: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  stopSquare: { width: 14, height: 14, backgroundColor: '#FFF', borderRadius: 2 },
  audioButtonPlaceholder: { width: 45, height: 45, borderRadius: 25, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  waveContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40 },
  waveBar: { width: 4, backgroundColor: '#FFF', borderRadius: 2 },
});

const markdownStyles = {
  body: { fontSize: 15, color: '#333' },
  heading1: { fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  heading2: { fontSize: 18, fontWeight: 'bold', marginTop: 10, color: '#000' },
  strong: { fontWeight: 'bold', color: '#000' },
  list_item: { marginBottom: 5 },
};