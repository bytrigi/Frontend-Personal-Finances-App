import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Modal, StatusBar, Animated, Keyboard, LayoutAnimation, UIManager, Dimensions, Image } from 'react-native';
import axios from 'axios';
import Markdown from 'react-native-markdown-display';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const LOGO_SANTANDER = require('./assets/santander_logo.png'); 
const LOGO_PAYPAL = require('./assets/paypal_logo.png');
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://100.70.100.112:8000';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');
const MENU_WIDTH = width * 0.75; 

// --- COMPONENTES VISUALES ---
const HamburgerIcon = ({ isOpen, animation }) => {
  const top = animation.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const bottom = animation.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const opacity = animation.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const rotateTop = animation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });
  const rotateBottom = animation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-45deg'] });
  const lineStyle = { height: 2, width: 24, backgroundColor: '#000', borderRadius: 1, position: 'absolute' };
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={[lineStyle, { top: 6, transform: [{ translateY: top }, { rotate: rotateTop }] }]} />
      <Animated.View style={[lineStyle, { opacity }]} />
      <Animated.View style={[lineStyle, { bottom: 6, transform: [{ translateY: bottom }, { rotate: rotateBottom }] }]} />
    </View>
  );
};

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

const AnimatedItem = ({ children, index }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current; 
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay: index * 100, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay: index * 100, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
};

// --- COMPONENTE: FORMULARIO DE GASTO (AVANZADO) ---
const ExpenseForm = ({ data, onConfirm }) => {
    const isIncome = data.tipo === 'income';
    
    const [concepto, setConcepto] = useState(data.concepto || "Nuevo movimiento");
    const [cantidad, setCantidad] = useState((data.cantidad || 0).toString());
    const [categoria, setCategoria] = useState(data.categoria || "Otros");
    const [cuenta, setCuenta] = useState(data.cuenta_nombre || "Bancaria");
    const [notas, setNotas] = useState(data.anotaciones || "");
    
    // Campos Financieros Avanzados
    const [plazos, setPlazos] = useState((data.plazos || 1).toString());
    const [interes, setInteres] = useState((data.interes || 0).toString());
    
    const [isConfirmed, setIsConfirmed] = useState(false);

    // Cálculo en tiempo real de la cuota
    const calcCuota = () => {
        const c = parseFloat(cantidad) || 0;
        const p = parseInt(plazos) || 1;
        const i = parseFloat(interes) || 0;
        if (p === 1 && i === 0) return null; // No mostrar si es pago único sin interés
        
        const totalConInteres = c * (1 + (i / 100));
        const cuota = totalConInteres / p;
        return { total: totalConInteres.toFixed(2), mensual: cuota.toFixed(2) };
    };

    const infoFinanciera = calcCuota();

    const handleConfirm = () => {
        setIsConfirmed(true);
        const hoy = new Date().toISOString().split('T')[0];
        
        const payload = {
            tipo: data.tipo || 'expense',
            concepto: concepto,
            cantidad: parseFloat(cantidad) || 0.0,
            fecha: data.fecha || hoy,
            cuenta_nombre: cuenta,
            categoria: isIncome ? 'Ingreso' : categoria,
            status: isIncome ? "Recibido" : "Pagado",
            anotaciones: notas,
            plazos: parseInt(plazos) || 1,
            interes: parseFloat(interes) || 0.0
        };
        console.log("Payload:", payload);
        onConfirm(payload);
    };

    if (isConfirmed) {
        return (
            <View style={[styles.confirmationBubble, isIncome ? {backgroundColor: '#E8F5E9'} : {backgroundColor: '#FFEBEE'}]}>
                <Feather name="check-circle" size={20} color={isIncome ? "#34C759" : "#FF3B30"} />
                <Text style={[styles.confirmationText, isIncome ? {color: '#2E7D32'} : {color: '#C62828'}]}>
                    ¡Enviado!
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.formContainer}>
            <Text style={[styles.formHeader, {color: isIncome ? '#34C759' : '#FF3B30'}]}>
                {isIncome ? 'NUEVO INGRESO' : 'NUEVO GASTO'}
            </Text>

            {/* Asunto */}
            <View style={styles.formRow}>
                <Text style={styles.formLabel}>Asunto:</Text>
                <TextInput style={styles.formInput} value={concepto} onChangeText={setConcepto} />
            </View>
            
            {/* Importe y Cuenta */}
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={[styles.formRow, {flex: 1}]}>
                    <Text style={styles.formLabel}>Importe:</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <TextInput 
                            style={[styles.formInput, {fontWeight: 'bold', flex: 1}]} 
                            value={cantidad} onChangeText={setCantidad} keyboardType="numeric"
                        />
                        <Text style={{marginLeft: 5, color: '#666'}}>€</Text>
                    </View>
                </View>
                <View style={[styles.formRow, {flex: 1}]}>
                    <Text style={styles.formLabel}>Cuenta:</Text>
                    <TextInput style={styles.formInput} value={cuenta} onChangeText={setCuenta} />
                </View>
            </View>

            {/* Solo Gastos: Categoría y Financiación */}
            {!isIncome && (
                <>
                    <View style={styles.formRow}>
                        <Text style={styles.formLabel}>Categoría:</Text>
                        <TextInput style={styles.formInput} value={categoria} onChangeText={setCategoria} />
                    </View>

                    {/* Fila de Financiación */}
                    <View style={{flexDirection: 'row', gap: 10, backgroundColor: '#F2F2F7', padding: 8, borderRadius: 8, marginBottom: 10}}>
                        <View style={{flex: 1}}>
                            <Text style={styles.formLabel}>Plazos:</Text>
                            <TextInput 
                                style={[styles.formInput, {backgroundColor: '#FFF'}]} 
                                value={plazos} onChangeText={setPlazos} keyboardType="number-pad" 
                            />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.formLabel}>Interés %:</Text>
                            <TextInput 
                                style={[styles.formInput, {backgroundColor: '#FFF'}]} 
                                value={interes} onChangeText={setInteres} keyboardType="numeric" 
                            />
                        </View>
                    </View>

                    {/* Info Calculada */}
                    {infoFinanciera && (
                        <View style={{marginBottom: 10, padding: 5}}>
                            <Text style={{fontSize: 12, color: '#666'}}>
                                Total a pagar: <Text style={{fontWeight: 'bold'}}>{infoFinanciera.total}€</Text>
                            </Text>
                            <Text style={{fontSize: 12, color: '#000', fontWeight: 'bold'}}>
                                Cuota mensual: {infoFinanciera.mensual}€ / mes
                            </Text>
                        </View>
                    )}
                </>
            )}

            <View style={styles.formRow}>
                <Text style={styles.formLabel}>Notas:</Text>
                <TextInput style={styles.formInput} value={notas} onChangeText={setNotas} multiline />
            </View>

            <View style={styles.formActions}>
                <TouchableOpacity 
                    style={[styles.confirmButton, isIncome ? {backgroundColor: '#34C759'} : {backgroundColor: '#000'}]} 
                    onPress={handleConfirm}>
                    <Text style={styles.confirmButtonText}>Confirmar</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default function App() {
  const formatDatePretty = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  const [modalVisible, setModalVisible] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recording, setRecording] = useState();
  const [transactions, setTransactions] = useState([]);
  const [balances, setBalances] = useState([]); 
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const menuAnimation = useRef(new Animated.Value(0)).current; 
  const iconAnimation = useRef(new Animated.Value(0)).current; 
  const flatListRef = useRef();
  const inputRef = useRef(null);
  const micScale = useRef(new Animated.Value(1)).current;

  // --- FETCHING ---
  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/historial`);
      setTransactions(response.data.transactions);
    } catch (error) { console.error("Error historial:", error); }
  };

  const fetchBalances = async () => {
    try {
      const response = await axios.get(`${API_URL}/balance`);
      setBalances(response.data.accounts);
    } catch (error) { console.error("Error saldos:", error); }
  };

  const refreshAll = async () => {
      setIsLoadingHistory(true);
      await Promise.all([fetchHistory(), fetchBalances()]);
      setIsLoadingHistory(false);
  };

  useEffect(() => {
    refreshAll();
    let ws = null;
    let isMounted = true; 
    const connectWebSocket = () => {
        if (!isMounted) return;
        const wsUrl = API_URL.replace('http', 'ws') + '/ws';
        ws = new WebSocket(wsUrl);
        ws.onmessage = (e) => {
            if (e.data === 'REFRESH') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                refreshAll();
            }
        };
        ws.onclose = () => { if (isMounted) setTimeout(connectWebSocket, 3000); };
    };
    connectWebSocket();
    return () => { isMounted = false; if (ws) ws.close(); };
  }, []);

  useEffect(() => { if (flatListRef.current) flatListRef.current.scrollToEnd({ animated: true }); }, [messages]);
  const animateLayout = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  // --- MENU & AUDIO ---
  const toggleMenu = () => {
    const toValue = isMenuOpen ? 0 : 1;
    Animated.parallel([
      Animated.timing(menuAnimation, { toValue, duration: 300, useNativeDriver: true }),
      Animated.timing(iconAnimation, { toValue, duration: 300, useNativeDriver: true }),
    ]).start();
    setIsMenuOpen(!isMenuOpen);
  };
  const closeMenu = () => { if (isMenuOpen) toggleMenu(); };

  const startRecording = async () => {
    try {
      if (recording) { try { await recording.stopAndUnloadAsync(); } catch (e) {} setRecording(undefined); }
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(newRecording);
      animateLayout();
      setIsRecording(true);
    } catch (err) { }
  };

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
      formData.append('file', { uri: uri, type: 'audio/m4a', name: 'audio.m4a' });
      const response = await axios.post(`${API_URL}/transcribir`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      animateLayout();
      setIsTranscribing(false);
      setPrompt(response.data.text);
      setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 100);
    } catch (error) { setIsTranscribing(false); setPrompt("Error transcripción"); }
  };

  const handleTextPress = () => { setModalVisible(true); setIsRecording(false); setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 500); };
  const handleMicPressIn = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Animated.timing(micScale, { toValue: 0.8, duration: 100, useNativeDriver: true }).start(); };
  const handleMicPressOut = () => { Animated.timing(micScale, { toValue: 1, duration: 100, useNativeDriver: true }).start(() => { setModalVisible(true); setTimeout(() => { startRecording(); }, 300); }); };
  const handleSmallMicPress = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Keyboard.dismiss(); animateLayout(); setIsRecording(true); setTimeout(() => { startRecording(); }, 300); };

  // --- LOGICA CHAT ---
  const sendMessage = async () => {
    if (!prompt.trim()) return;
    if (isRecording) { try { await recording.stopAndUnloadAsync(); } catch (e) {} setRecording(undefined); setIsRecording(false); }
    if (isTranscribing) setIsTranscribing(false);

    const userMessage = { role: 'user', content: prompt };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setPrompt('');
    setLoading(true);

    try {
      const apiHistory = newHistory.filter(msg => !msg.content.includes('"accion": "draft_gasto"')).map(msg => ({ role: msg.role === 'jarvis' ? 'assistant' : msg.role, content: msg.content }));
      const response = await axios.post(`${API_URL}/chat`, { messages: apiHistory });
      setMessages(prev => [...prev, { role: 'jarvis', content: response.data.reply }]);
    } catch (error) { setMessages(prev => [...prev, { role: 'jarvis', content: "⚠️ Error servidor." }]); } 
    finally { setLoading(false); }
  };

  const handleConfirmExpense = async (finalData) => {
      try {
          const res = await axios.post(`${API_URL}/accion`, finalData);
          if (res.data.status === 'ok') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) { console.error(e); }
  };

  const renderChatMessage = ({ item }) => {
    let draftData = null;
    if (item.role === 'jarvis' && item.content.includes('"accion": "draft_gasto"')) {
        try {
            const parsed = JSON.parse(item.content);
            if (parsed.accion === 'draft_gasto') draftData = parsed.datos;
        } catch (e) {}
    }
    if (draftData) return <View style={[styles.messageBubble, styles.jarvisBubble, {backgroundColor: 'transparent', padding: 0, shadowOpacity: 0}]}><ExpenseForm data={draftData} onConfirm={handleConfirmExpense} /></View>;
    return <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.jarvisBubble]}>{item.role === 'user' ? <Text style={styles.userText}>{item.content}</Text> : <Markdown style={markdownStyles}>{item.content}</Markdown>}</View>;
  };

  const renderTransactionItem = ({ item, index }) => (
    <AnimatedItem index={index}>
        <View style={styles.transactionItem}>
          <View style={styles.transactionIconContainer}><Text style={styles.transactionIcon}>{item.icon}</Text></View>
          <View style={styles.transactionDetails}>
            <Text style={styles.transactionTitle}>{item.title}</Text>
            <Text style={styles.transactionDate}>{formatDatePretty(item.date)}</Text>
          </View>
          <Text style={[styles.transactionAmount, item.type === 'income' ? styles.amountPositive : styles.amountNegative]}>{item.amount}</Text>
        </View>
    </AnimatedItem>
  );

  const menuTranslateX = menuAnimation.interpolate({ inputRange: [0, 1], outputRange: [-MENU_WIDTH, 0] });
  const overlayOpacity = menuAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mainContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}><HamburgerIcon isOpen={isMenuOpen} animation={iconAnimation} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Bienvenido, username</Text>
          <View style={{ width: 24 }} /> 
        </View>
        <View style={styles.headerSection}>
          <Text style={styles.sectionTitle}>Tu saldo actual</Text>
          <View style={styles.card}>
             {balances.length === 0 && isLoadingHistory ? <ActivityIndicator color="#999" size="small" /> : balances.map((account, index) => {
                  let logo = null;
                  const nameLower = account.name.toLowerCase();
                  if (nameLower.includes('paypal')) logo = LOGO_PAYPAL;
                  else if (nameLower.includes('bancaria') || nameLower.includes('santander')) logo = LOGO_SANTANDER;
                  return (
                    <View key={account.id} style={[styles.row, { marginTop: index > 0 ? 15 : 0 }]}>
                        {logo ? <Image source={logo} style={styles.bankLogo} resizeMode="contain" /> : <Text style={{fontSize: 24}}>🏦</Text>}
                        <View style={{marginLeft: 10}}><Text style={styles.accountLabel}>{account.name}</Text><Text style={styles.accountAmount}>{account.balance}</Text></View>
                    </View>
                  );
                })
             }
          </View>
        </View>
        <Text style={styles.sectionTitle}>Últimos movimientos</Text>
        {isLoadingHistory && transactions.length === 0 ? <View style={{ marginTop: 50, alignItems: 'center' }}><ActivityIndicator size="large" color="#000" /></View> : <FlatList data={transactions} renderItem={renderTransactionItem} keyExtractor={item => item.id} contentContainerStyle={styles.transactionsList} showsVerticalScrollIndicator={false} refreshing={isLoadingHistory} onRefresh={refreshAll} ListEmptyComponent={<Text style={{color: '#999', alignSelf: 'center', marginTop: 20}}>Sin movimientos.</Text>} />}
        <View style={styles.chatTriggerButton}>
          <TouchableOpacity style={styles.textTriggerArea} onPress={handleTextPress} activeOpacity={0.7}><Text style={styles.chatTriggerText}>Pregunta algo...</Text></TouchableOpacity>
          <TouchableOpacity style={styles.micTriggerArea} onPressIn={handleMicPressIn} onPressOut={handleMicPressOut} activeOpacity={1}><Animated.View style={{ transform: [{ scale: micScale }] }}><Feather name="mic" size={24} color="#FFF" /></Animated.View></TouchableOpacity>
        </View>
      </View>
      <Animated.View style={[styles.menuOverlay, { opacity: overlayOpacity }]} pointerEvents={isMenuOpen ? 'auto' : 'none'}><TouchableOpacity style={{ flex: 1 }} onPress={closeMenu} /></Animated.View>
      <Animated.View style={[styles.sideMenuContainer, { transform: [{ translateX: menuTranslateX }] }]}><SafeAreaView style={{ flex: 1 }}><TouchableOpacity onPress={closeMenu} style={styles.closeMenuButton}><Feather name="x" size={24} color="#000" /></TouchableOpacity><View style={styles.profileSection}><View style={styles.profileImagePlaceholder} /><Text style={styles.profileName}>username</Text></View><View style={styles.menuItemsContainer}>{['Gastos', 'Planes de ahorro', 'Inversiones', 'Perfil', 'Datos Personales', 'Configuración', 'Ayuda'].map((item, index) => (<TouchableOpacity key={index} style={styles.menuItem} onPress={closeMenu}><Text style={styles.menuItemText}>{item}</Text></TouchableOpacity>))}</View></SafeAreaView></Animated.View>
      <Modal animationType="slide" transparent={false} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Asistente Financiero</Text><TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}><Feather name="chevron-down" size={32} color="#007AFF" /></TouchableOpacity></View>
            <FlatList ref={flatListRef} data={messages} renderItem={renderChatMessage} keyExtractor={(_, index) => index.toString()} contentContainerStyle={styles.chatList} />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
              {isRecording && (<View style={styles.audioBarContainer}><TouchableOpacity style={styles.audioButtonStop} onPress={() => stopRecording()}><View style={styles.stopSquare} /></TouchableOpacity><View style={styles.waveContainer}><TalkingBar delay={0} /><TalkingBar delay={100} /><TalkingBar delay={200} /><TalkingBar delay={50} /><TalkingBar delay={150} /></View><View style={styles.audioButtonPlaceholder}><Feather name="arrow-up" size={24} color="#333" /></View></View>)}
              {isTranscribing && (<View style={styles.audioBarContainer}><ActivityIndicator color="#FFF" style={{marginRight: 10}}/><Text style={{color: '#FFF', fontSize: 16, fontWeight: '500'}}>Transcribiendo...</Text></View>)}
              {!isRecording && !isTranscribing && (<View style={styles.inputWrapper}><View style={styles.inputContainer}><TextInput ref={inputRef} style={styles.input} placeholder="Escribe aquí..." placeholderTextColor="#999" value={prompt} onChangeText={setPrompt} onSubmitEditing={sendMessage} multiline={true} /><TouchableOpacity style={styles.micChatButton} onPress={handleSmallMicPress}><Feather name="mic" size={24} color="#999" /></TouchableOpacity><TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={loading}>{loading ? <ActivityIndicator color="#FFF" /> : <Feather name="arrow-up" size={24} color="#FFF" />}</TouchableOpacity></View></View>)}
            </KeyboardAvoidingView>
          </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  mainContent: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  menuButton: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  headerSection: { marginBottom: 25 },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15, shadowOffset: {width: 0, height: 4}, elevation: 5 },
  row: { flexDirection: 'row', alignItems: 'center' },
  bankLogo: { width: 35, height: 35 },
  accountLabel: { fontSize: 12, color: '#666', fontWeight: '600', textTransform: 'uppercase' },
  accountAmount: { fontSize: 18, fontWeight: 'bold', color: '#000' },
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
  chatTriggerButton: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#000', borderRadius: 35, height: 60, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width: 0, height: 5}, elevation: 10 },
  textTriggerArea: { flex: 1, height: '100%', justifyContent: 'center', paddingLeft: 25 },
  chatTriggerText: { color: '#999', fontSize: 16, fontWeight: '500' },
  micTriggerArea: { paddingHorizontal: 25, height: '100%', justifyContent: 'center', alignItems: 'center' },
  menuOverlay: { position: 'absolute', top: 0, left: 0, width: width, height: height, backgroundColor: '#000', zIndex: 10 },
  sideMenuContainer: { position: 'absolute', top: 0, left: 0, width: MENU_WIDTH, height: height, backgroundColor: '#F2F2F7', zIndex: 20, padding: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, shadowColor: "#000", shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  closeMenuButton: { alignSelf: 'flex-start', padding: 10 },
  profileSection: { alignItems: 'center', marginBottom: 40, marginTop: 10 },
  profileImagePlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#D9D9D9', marginBottom: 10 },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  menuItemsContainer: { flex: 1 },
  menuItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  menuItemText: { fontSize: 18, fontWeight: '600', color: '#000' },
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
  micChatButton: { padding: 5, marginRight: 5, justifyContent: 'center', alignItems: 'center' },
  sendButton: { backgroundColor: '#007AFF', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 5 },
  audioBarContainer: { backgroundColor: '#000', height: 100, borderTopLeftRadius: 20, borderTopRightRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 25, paddingBottom: 20 },
  audioButtonStop: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  stopSquare: { width: 14, height: 14, backgroundColor: '#FFF', borderRadius: 2 },
  audioButtonPlaceholder: { width: 45, height: 45, borderRadius: 25, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  waveContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40 },
  waveBar: { width: 4, backgroundColor: '#FFF', borderRadius: 2 },
  // ESTILOS NUEVOS PARA EL FORM
  formContainer: { backgroundColor: '#E5E5EA', padding: 20, borderRadius: 15, width: 280 },
  formHeader: { fontSize: 14, fontWeight: '900', marginBottom: 15, letterSpacing: 1 },
  formRow: { marginBottom: 10 },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 4, textTransform: 'uppercase' },
  formInput: { backgroundColor: '#FFF', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, fontSize: 16, color: '#000', borderWidth: 1, borderColor: '#D1D1D6' },
  formDate: { fontSize: 12, color: '#8E8E93', marginTop: 5, textAlign: 'right', fontStyle: 'italic' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, gap: 10 },
  confirmButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  confirmButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  confirmationBubble: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 15, gap: 10 },
  confirmationText: { fontWeight: 'bold' }
});

const markdownStyles = {
  body: { fontSize: 15, color: '#333' },
  heading1: { fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  heading2: { fontSize: 18, fontWeight: 'bold', marginTop: 10, color: '#000' },
  strong: { fontWeight: 'bold', color: '#000' },
  list_item: { marginBottom: 5 },
};