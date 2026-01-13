# AI Personal Finances App - Asistente de Finanzas Personales con Inteligencia Artificial👋

Este es un proyecto de **Expo** creado con `create-expo-app` que funciona como una aplicación de finanzas personales con un asistente inteligente. La aplicación permite gestionar transacciones, visualizar saldos y comunicarse con un asistente financiero mediante texto o voz.

## 🚀 Características Principales

*   **Asistente Inteligente:** Interfaz de chat interactiva que utiliza procesamiento de lenguaje natural para responder consultas financieras.
*   **Interacción por Voz:** Soporte para grabación de audio y transcripción en tiempo real para facilitar el registro de datos.
*   **Gestión de Transacciones:** Visualización detallada de los últimos movimientos, incluyendo iconos, categorías y montos.
*   **Visualización de Saldo:** Pantalla principal con el resumen del saldo total y desglose por cuentas (Bancaria, PayPal, etc.).
*   **Experiencia de Usuario Enriquecida:**
    *   **Retroalimentación Háptica:** Uso de vibraciones para mejorar la interacción con botones y pestañas.
    *   **Animaciones Dinámicas:** Barras de sonido animadas que reaccionan durante la grabación de voz.
    *   **Soporte Multitema:** Adaptación automática entre temas claro y oscuro.
    *   **Renderizado de Markdown:** Los mensajes del asistente soportan formato Markdown para una mejor legibilidad.

## 🛠️ Tecnologías Utilizadas

El proyecto utiliza un stack moderno basado en **React Native** y el ecosistema de **Expo**:

*   **Framework:** Expo (v54.0.31) con soporte para arquitectura nueva.
*   **Lenguaje:** TypeScript para un desarrollo con tipado seguro.
*   **Navegación:** Expo Router para navegación basada en archivos.
*   **Comunicación:** Axios para peticiones a la API del servidor.
*   **Multimedia:** `expo-av` para el manejo de audio y grabación.
*   **UI/UX:** `expo-haptics`, `react-native-reanimated`, y `@expo/vector-icons`.

## 📂 Estructura del Proyecto

```text
├── app/                # Rutas y pantallas principales (File-based routing)
├── assets/             # Imágenes, iconos y fuentes
├── components/         # Componentes reutilizables (ThemedView, IconSymbol, etc.)
├── constants/          # Definiciones de temas y colores
├── hooks/              # Hooks personalizados (useColorScheme, useThemeColor)
└── scripts/            # Scripts de utilidad para el proyecto
```

## ⚙️ Configuración e Instalación

1.  **Instalar dependencias:**
    ```bash
    npm install
    ```

2.  **Configurar variables de entorno:**
    La aplicación se conecta a una API externa. Asegúrate de configurar la URL base en el archivo correspondiente (por defecto apunta a `http://100.102.205.118:8000`).

3.  **Iniciar la aplicación:**
    ```bash
    npx expo start
    ```

    Puedes ejecutarla en los siguientes entornos:
    *   **Android:** `npm run android`
    *   **iOS:** `npm run ios`
    *   **Web:** `npm run web`

## 🧹 Reiniciar el Proyecto

Si deseas comenzar con una base limpia y mover el código de ejemplo a una carpeta de referencia, ejecuta:
```bash
npm run reset-project
```
Este script moverá los directorios actuales a `/app-example` y creará un nuevo directorio `/app` en blanco.

---

**Metáfora para entender el proyecto:** Imagina que el asistente de IA es como un **bibliotecario contable** que no solo guarda tus libros de gastos, sino que también puede escucharte cuando le hablas y escribir notas por ti, asegurándose de que siempre sepas cuánto dinero hay en cada estante de tu biblioteca financiera.
