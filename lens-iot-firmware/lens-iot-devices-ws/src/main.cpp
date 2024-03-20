#include <Arduino.h>

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <singleLEDLibrary.h>

sllib led(2);

const char *wifi_network_ssid = "lens-iot Controller AP";
const char *wifi_network_password = "123456789";

WebSocketsClient webSocket;

String mac = (String)WiFi.macAddress();
int clientId = -1;
String state = "Off";
String states[2] = {"Off", "On"};

void sendDeviceData()
{
  if (clientId > -1)
  {
    StaticJsonDocument<256> dataRes;
    char buff[256];
    dataRes["req"] = "deviceData";
    dataRes["clientId"] = clientId;
    dataRes["macAddr"] = mac;
    dataRes["state"] = state;
    serializeJson(dataRes, buff);
    webSocket.sendTXT(buff);
  }
}

void parsePayload(uint8_t *payload)
{
  StaticJsonDocument<512> payloadBody;
  String body = (char *)payload;
  deserializeJson(payloadBody, payload);
  const char *req = payloadBody["req"];
  char clientIndex[] = "clientId";
  char setState[] = "setState";
  char ping[] = "ping";

  // char deviceData[] = "deviceData";
  if (strcmp(req, clientIndex) == 0)
  {
    clientId = payloadBody["clientId"];
  }
  else if (strcmp(req, setState) == 0)
  {
    const char *stateChar = payloadBody["state"];
    state = stateChar;
  }
  else if (strcmp(req, ping) == 0)
  {
    sendDeviceData();
  }
}



void stateBehaviour()
{
  if (state == "Off")
  {
    led.setOffSingle();
  }
  else if (state == "On")
  {
    led.setOnSingle();
  }
    else if (state == "Speed1")
    {
      led.breathSingle(1500);
    }
    else if (state == "Speed2")
    {
      led.breathSingle(500);
    }
    else if (state == "Speed3")
    {
      led.breathSingle(150);
    }
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
  switch (type)
  {
  case WStype_DISCONNECTED:
    Serial.printf("\n[WSc] Disconnected!\n");
    break;
  case WStype_CONNECTED:
  {
    Serial.printf("\n[WSc] Connected to url: %s\n", payload);
    led.setFlickerSingle();
  }
  break;
  case WStype_TEXT:
    Serial.printf("\n[WSc] get text: %s\n", payload);
    parsePayload(payload);
    break;
  case WStype_PING:
    // pong will be send automatically
    Serial.printf("[WSc] get ping\n");
    break;
  case WStype_PONG:
    // answer to a ping we send
    Serial.printf("[WSc] get pong\n");
    break;
  }
}

void setup()
{
  Serial.begin(9600, SERIAL_8N1);
  WiFi.mode(WIFI_STA);
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

  webSocket.begin("192.168.1.1", 81, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop()
{
  webSocket.loop();
  stateBehaviour();
  led.update();
}