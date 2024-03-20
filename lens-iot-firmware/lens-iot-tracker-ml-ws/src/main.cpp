// Wireless
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
// Client
// #include <HTTPClient.h>
// tensorflow lite
#include <TensorFlowLite_ESP32.h>
#include "tensorflow/lite/micro/micro_error_reporter.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "tensorflow/lite/micro/all_ops_resolver.h"
// Trained model
#include "model.h"
// Accelerometer
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>

// Model parameters
#define NUM_SAMPLES 119
#define THRESHOLD 3
int samples = 0;

int clientId = -1;

// Wi-Fi params
const char *wifi_network_ssid = "lens-iot Controller AP"; // set to router SSID
const char *wifi_network_password = "123456789";
/* const char *wifi_network_ssid = "lens-iot Controller AP"; // set to router SSID
const char *wifi_network_password = "123456789";        // set to router password */

// Client
// String serverName = "http://192.168.1.1/tracker";

WebSocketsClient webSocket;

// Accelerometer related params
Adafruit_MPU6050 mpu;
float ax;
float ay;
float az;
float baseAx;
float baseAy;
float baseAz;

// timing related params
unsigned long startMillis;
unsigned long currentMillis;
unsigned long period = 0;

// tensorflow and gesture parameters
tflite::ErrorReporter *tflErrorReporter;
tflite::AllOpsResolver tflOpsResolver;
const tflite::Model *tflModel = nullptr;
tflite::MicroInterpreter *tflInterpreter = nullptr;
TfLiteTensor *tflInputTensor = nullptr;
TfLiteTensor *tflOutputTensor = nullptr;
constexpr int tensorArenaSize = 100 * 1024;
byte tensorArena[tensorArenaSize];
const char *GESTURES[] = {
    "down",
    "left",
    "right",
    "up"};
#define NUM_GESTURES 4

// Wi-Fi funtion
void WiFiStationConnected(WiFiEvent_t event, WiFiEventInfo_t info)
{
  Serial.println("Connected to AP successfully!");
}
void WiFiStationDisconnected(WiFiEvent_t event, WiFiEventInfo_t info)
{
  clientId = -1;
  Serial.println("Disconnected from WiFi access point");
  Serial.println("Trying to Reconnect");
  WiFi.begin(wifi_network_ssid, wifi_network_password); // Retry connecting to router
  delay(5000);
}
// load the model
void init_tensorflow()
{
  Serial.println("Initialing Tensorflow Lite..");
  // get the TFL representation of the model byte array
  tflModel = tflite::GetModel(model);
  if (tflModel->version() != TFLITE_SCHEMA_VERSION)
  {
    Serial.println("Model schema mismatch!");
    while (1)
      ;
  }

  static tflite::MicroErrorReporter micro_error_reporter;
  tflErrorReporter = &micro_error_reporter;

  static tflite::MicroInterpreter static_interpreter(
      tflModel, tflOpsResolver, tensorArena, tensorArenaSize, tflErrorReporter);

  tflInterpreter = &static_interpreter;

  // Allocate memory for the model's input and output tensors
  TfLiteStatus allocate_status = tflInterpreter->AllocateTensors();
  if (allocate_status != kTfLiteOk)
  {
    TF_LITE_REPORT_ERROR(tflErrorReporter, "AllocateTensors() failed");
    return;
  }
  // Get pointers for the model's input and output tensors
  tflInputTensor = tflInterpreter->input(0);
  tflOutputTensor = tflInterpreter->output(0);
  Serial.println("Tensorflow initialized");
}

// recenter the acceleration values
void calibrate_sensor()
{
  float totX, totY, totZ;
  sensors_event_t a, g, temp;

  for (int i = 0; i < 10; i++)
  {
    mpu.getEvent(&a, &g, &temp);
    totX = totX + a.acceleration.x;
    totY = totY + a.acceleration.y;
    totZ = totZ + a.acceleration.z;
  }
  baseAx = totX / 10;
  baseAy = totY / 10;
  baseAz = totZ / 10;
}

void parsePayload(uint8_t *payload)
{
  StaticJsonDocument<512> payloadBody;
  String body = (char *)payload;
  deserializeJson(payloadBody, payload);
  const char *req = payloadBody["req"];
  char calibrate[] = "calibrate";
  char client[] = "clientId";
  // char deviceData[] = "deviceData";
  if (strcmp(req, calibrate) == 0)
  {
    calibrate_sensor();
  }
  else if (strcmp(req, client) == 0)
  {
    clientId = payloadBody["clientId"];
  }
}

void sendGesture(String gesture)
{
  StaticJsonDocument<128> gestureRes;
  char buff[128];
  gestureRes["req"] = "gesture";
  gestureRes["gesture"] = gesture;
  serializeJson(gestureRes, buff);
  webSocket.sendTXT(buff);
}

void sendTrackerId()
{
  char *buff = "{\"req\":\"trackerId\"}";
  webSocket.sendTXT(buff);
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
    sendTrackerId();
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

void setup(void)
{
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  WiFi.onEvent(WiFiStationDisconnected, WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
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

  Serial.println("Adafruit MPU6050 test!");

  if (!mpu.begin())
  {
    Serial.println("Failed to find MPU6050 chip");
    while (1)
    {
      delay(10);
    }
  }
  Serial.println("MPU6050 Found!");

  // Set Accelaration Range
  mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
  calibrate_sensor();
  Serial.println("");

  init_tensorflow();

  delay(100);
  /*   WiFi.disconnect(true);
    delay(1000); */
  // Network setup
}

boolean detectMovement()
{
  float totAcc = fabs(ax) + fabs(ay) + fabs(az);
  return totAcc > THRESHOLD;
}

/* int httpGETRequest(const char *serverName)
{
  WiFiClient client;
  HTTPClient http;

  // Your Domain name with URL path or IP address with path
  http.begin(client, serverName);

  // Send HTTP POST request
  int httpResponseCode = http.GET();
  http.getString();
  http.end();

  return httpResponseCode;
} */

void loop()
{
  webSocket.loop();
  currentMillis = millis();
  if (currentMillis - startMillis >= period)
  {
    if (WiFi.status() == WL_CONNECTED)
    {
      if (period != 0)
      {
        digitalWrite(LED_BUILTIN, LOW);
        period = 0;
      }

      sensors_event_t a, g, temp;
      mpu.getEvent(&a, &g, &temp);

      samples = 0;
      ax = a.acceleration.x - baseAx;
      ay = a.acceleration.y - baseAy;
      az = a.acceleration.z - baseAz;
      if (!detectMovement())
      {
        delay(10);
        return;
      }
      while (samples < NUM_SAMPLES)
      {
        // Read samples
        mpu.getEvent(&a, &g, &temp);
        ax = a.acceleration.x - baseAx;
        ay = a.acceleration.y - baseAy;
        az = a.acceleration.z - baseAz;
        tflInputTensor->data.f[samples * 3 + 0] = (ax + 4.0) / 8.0;
        tflInputTensor->data.f[samples * 3 + 1] = (ay + 4.0) / 8.0;
        tflInputTensor->data.f[samples * 3 + 2] = (az + 4.0) / 8.0;

        samples++;
      }
      if (samples == NUM_SAMPLES)
      {
        TfLiteStatus invokeStatus = tflInterpreter->Invoke();
        if (invokeStatus != kTfLiteOk)
        {
          Serial.println("Invoke failed!");
          return;
        }

        for (int i = 0; i < NUM_GESTURES; i++)
        {
          if (tflOutputTensor->data.f[i] > 0.9)
          {
            if (clientId > -1)
            {
              sendGesture(GESTURES[i]);
            }
            /*             Serial.println();
                        String serverPath = serverName + "?gesture=" + GESTURES[i];
                        int httpResponseCode = httpGETRequest(serverPath.c_str());
                        if (httpResponseCode == 200)
                        {
                          Serial.println("normal send");
                        }
                        else if (httpResponseCode == 250)
                        {
                          Serial.println("now calibrate in 10s");
                        } */
            startMillis = currentMillis;
            period = 1000;
            digitalWrite(LED_BUILTIN, HIGH);
          }
        }
        return;
      }
    }
  }
  if (WiFi.status() == WL_DISCONNECTED)
  {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(250);
    digitalWrite(LED_BUILTIN, LOW);
    delay(250);
  }
  delayMicroseconds(10);
}