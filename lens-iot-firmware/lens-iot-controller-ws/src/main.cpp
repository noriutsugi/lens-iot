#include <Arduino.h>

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

IPAddress IP(192, 168, 1, 1);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);

#define WIFI_RECONNECT_TIME 2000

const char *wifi_network_ssid = "BEACON-M";
const char *wifi_network_password = "beacon432111";
const char *soft_ap_ssid = "lens-iot Controller AP";
const char *soft_ap_password = "123456789";

WebSocketsServer webSocket = WebSocketsServer(81);

int remoteId = -1;
int trackerId = -1;

//
String devicesList = "[]";
unsigned long startPingTime, currentMillis;
unsigned long pingTimeout = 2000;
bool pingTrig = false;

unsigned long startLoopTime;
unsigned long loopTimeout = 5000;
///

void WiFiStationDisconnected(WiFiEvent_t event, WiFiEventInfo_t info)
{
  Serial.println("Disconnected from WiFi access point");
  Serial.println("Trying to Reconnect");
  WiFi.begin(wifi_network_ssid, wifi_network_password);
  delay(WIFI_RECONNECT_TIME);
}

String assignClientId(uint8_t num)
{
  StaticJsonDocument<256> assignClientIdReq;
  char buff[256];
  assignClientIdReq["req"] = "clientId";
  assignClientIdReq["clientId"] = num;
  serializeJson(assignClientIdReq, buff);
  return (String)buff;
}

unsigned long pingDevices()
{
  StaticJsonDocument<256> pingDevicesReq;
  char buff[256];
  pingDevicesReq["req"] = "ping";
  serializeJson(pingDevicesReq, buff);
  webSocket.broadcastTXT(buff);
  pingTrig = true;
  return millis();
}

void setDevice(int cliendId, String state)
{
  StaticJsonDocument<256> setStateReq;
  char buff[256];
  setStateReq["req"] = "setState";
  setStateReq["state"] = state;
  serializeJson(setStateReq, buff);
  webSocket.sendTXT(cliendId, buff);
}

void addToList(String buff)
{
  int listLen = devicesList.length();
  String unit = devicesList.substring(1, listLen - 1);
  if (listLen > 4)
  {
    unit += ",";
  }
  devicesList = "[" + unit + buff + "]";
}

void sendDeviceList(int remote)
{
  if (pingTrig && (remote > -1))
  {
    pingTrig = false;
    StaticJsonDocument<2048> devices;
    char buff[2048];
    devices["req"] = "devices";
    devices["devices"] = devicesList;
    serializeJson(devices, buff);
    webSocket.sendTXT(remote, buff);
    devicesList = "[]";
  }
}

void parsePayload(uint8_t *payload, uint8_t num)
{
  StaticJsonDocument<512> payloadBody;
  String body = (char *)payload;
  deserializeJson(payloadBody, payload);
  const char *req = payloadBody["req"];
  char deviceData[] = "deviceData";
  char remoteIndex[] = "remoteId";
  char pingReq[] = "pingReq";
  char gesture[] = "gesture";
  char state[] = "state";
  char calibrate[] = "calibrate";
  char trackerIndex[] = "trackerId";
  
  // char deviceData[] = "deviceData";
  if (strcmp(req, deviceData) == 0)
  {
    char buff[512];
    payloadBody.remove(0);
    serializeJson(payloadBody, buff);
    addToList((String)buff);
  }
  else if (strcmp(req, remoteIndex) == 0)
  {
    remoteId = num;
  }
  else if (strcmp(req, trackerIndex) == 0)
  {
    trackerId = num;
  }
  else if (strcmp(req, pingReq) == 0)
  {
    pingDevices();
    sendDeviceList(remoteId);
  }
  else if (strcmp(req, state) == 0)
  {
    StaticJsonDocument<128> stateRes;
    char buff[128];
    int targetClient = payloadBody["client"];
    const char *desiredState = payloadBody["state"];
    setDevice(targetClient, (String)desiredState);
  }
  else if (strcmp(req, gesture) == 0)
  {
    if (remoteId > -1)
    {
      StaticJsonDocument<128> gestureRes;
      char buff[128];
      const char *detectedGesture = payloadBody["gesture"];
      gestureRes["req"] = "gesture";
      gestureRes["gesture"] = (String)detectedGesture;
      serializeJson(gestureRes, buff);
      webSocket.sendTXT(remoteId, buff);
    }
  } else if (strcmp(req, calibrate) == 0)
  {
    if (trackerId > -1) {
          char *buff = "{\"req\": \"calibrate\"}";
          webSocket.sendTXT(trackerId, buff);
    }
  }
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length)
{

  StaticJsonDocument<512> reqJson;
  switch (type)
  {
  case WStype_DISCONNECTED:
    Serial.printf("\n[%u] Disconnected!\n", num);
    break;
  case WStype_CONNECTED:
  {
    IPAddress ip = webSocket.remoteIP(num);
    Serial.printf("\n[%u] Connected from %d.%d.%d.%d url: %s\n", num, ip[0], ip[1], ip[2], ip[3], payload);
    char buff[256];
    assignClientId(num).toCharArray(buff, 256);
    webSocket.sendTXT(num, buff);
  }
  break;
  case WStype_TEXT:
    Serial.printf("\n[%u] get Text: %s\n", num, payload);
    parsePayload(payload, num);
    break;
  case WStype_ERROR:
  case WStype_FRAGMENT_TEXT_START:
  case WStype_FRAGMENT_BIN_START:
  case WStype_FRAGMENT:
  case WStype_FRAGMENT_FIN:
    break;
  }
}

void setup()
{
  Serial.begin(115200, SERIAL_8N1);
  /* WiFi.disconnect(true);
  delay(1000); */
  WiFi.onEvent(WiFiStationDisconnected, WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAPConfig(IP, gateway, subnet);
  WiFi.softAP(soft_ap_ssid, soft_ap_password);
  Serial.print("AP Created with IP Gateway ");
  Serial.println(WiFi.softAPIP());
  WiFi.begin(wifi_network_ssid, wifi_network_password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("STA connected to: ");
  Serial.print(WiFi.gatewayIP());
  Serial.print(" with local IP: ");
  Serial.println(WiFi.localIP());

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop()
{
  webSocket.loop();
  currentMillis = millis();
  if (currentMillis - startLoopTime >= loopTimeout)
  {
    pingDevices();
    sendDeviceList(remoteId);
    startLoopTime = currentMillis;
  }
}