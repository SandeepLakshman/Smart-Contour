#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// =========================
// WiFi
// =========================
const char* WIFI_SSID = "Srinivas Rao";
const char* WIFI_PASSWORD = "[WIFI_PASSWORD]";

// =========================
// Backend
// =========================
const char* SERVER_URL = "http://192.168.0.159:5000/api/sensor-data";

// =========================
// FSR Pins
// =========================
const int FSR1_PIN = 34;
const int FSR2_PIN = 35;
const int FSR3_PIN = 32;
const int FSR4_PIN = 33;

const char* DEVICE_ID = "SMARTCONTOUR-001";

unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 500;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("================================");
  Serial.println("      SMARTCONTOUR ESP32");
  Serial.println("================================");

  analogReadResolution(12);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi Connected!");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
  Serial.println("SmartContour monitoring started.");
}

void loop() {
  int fsr1 = analogRead(FSR1_PIN);
  int fsr2 = analogRead(FSR2_PIN);

  Serial.print("FSR1: ");
  Serial.print(fsr1);
  Serial.print("   FSR2: ");
  Serial.println(fsr2);

  if (millis() - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = millis();
    sendSensorData(fsr1, fsr2);
  }

  delay(50);
}

void sendSensorData(int fsr1, int fsr2) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected!");
    WiFi.reconnect();
    return;
  }

  HTTPClient http;

  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<512> doc;

  doc["deviceId"] = DEVICE_ID;
  doc["timestamp"] = millis();

  JsonObject sensors = doc.createNestedObject("sensors");

  sensors["fsr1"] = fsr1;
  sensors["fsr2"] = fsr2;

  String jsonData;
  serializeJson(doc, jsonData);

  Serial.print("Sending: ");
  Serial.println(jsonData);

  int httpResponseCode = http.POST(jsonData);

  Serial.print("HTTP Response: ");

  if (httpResponseCode > 0) {
    Serial.println(httpResponseCode);
  } else {
    Serial.println("ERROR");
  }

  http.end();
}
