// framework
import React, { useEffect, useState, useRef } from "react";
import {
  Image,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TextInput,
  Button,
} from "react-native";
import { Entypo } from "@expo/vector-icons";
import { FontAwesome } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Feather } from "@expo/vector-icons";

// expo
import { Camera } from "expo-camera";
// tensorflow
import * as tf from "@tensorflow/tfjs";
import { cameraWithTensors } from "@tensorflow/tfjs-react-native";

// model
import * as mobilenet from "@tensorflow-models/mobilenet";

// camera
const TensorCamera = cameraWithTensors(Camera);

/* import { LogBox } from "react-native";
LogBox.ignoreLogs(["Asyncstorage: ..."]); // Ignore log notification by message
LogBox.ignoreAllLogs(); */

export default function App(props) {
  const [tfReady, setTfReady] = useState(false); // tensorflow
  const [model, setModel] = useState(false); // model

  const [detectObj, setDetectObj] = useState(null);
  const stateRef = useRef();
  stateRef.current = detectObj;
  const [controlObj, setControlObj] = useState(true);
  const stateBool = useRef();
  stateBool.current = controlObj;

  const [wsIp, changeWsIp] = useState("192.168.169.72");
  const wsRef = useRef();
  wsRef.current = wsIp;

  const [buttonColorUp, setButtonColorUp] = useState(pallete.highlight);
  const [buttonColorDown, setButtonColorDown] = useState(pallete.highlight);
  const [buttonColorLeft, setButtonColorLeft] = useState(pallete.highlight);
  const [buttonColorRight, setButtonColorRight] = useState(pallete.highlight);
  const [displayText, setDisplayText] = useState("loading models");
  const { styles } = useStyle();
  const [serverMessages, setServerMessages] = useState([]);
  const [serverState, setServerState] = useState("Loading...");
  const [connArray, setConnArray] = useState(null);
  const [deviceArray, setDeviceArray] = useState([]);
  const [leftCont, setLeftCont] = useState(null);
  const [mainCont, setMainCont] = useState(null);
  const [rightCont, setRightCont] = useState(null);
  function parsePayload(data) {
    var payload = JSON.parse(data);
    var req = payload.req;
    if (req == "gesture") {
      handleGesture(payload.gesture);
    } else if (req == "devices") {
      var newPayload = JSON.parse(payload.devices);
      if (newPayload == null) {
        setDeviceArray([]);
      } else {
        for (var j = 0; j < newPayload.length; j++) {
          for (var i = 0; i < deviceStoredList.length; i++) {
            if (newPayload[j].macAddr == deviceStoredList[i].mac) {
              newPayload[j].name = deviceStoredList[i].name;
              newPayload[j].states = deviceStoredList[i].states;
              newPayload[j].keywords = deviceStoredList[i].keywords;
              newPayload[j].icon = deviceStoredList[i].icon;
            }
          }
        }
        setDeviceArray(newPayload);
      }
    }
  }

  function toggleColor(setButtonColor) {
    function revert() {
      setButtonColor(pallete.highlight);
    }
    setButtonColor(pallete.active);
    setTimeout(revert, 750);
  }
  function handleGesture(data) {
    var array = stateRef.current;
    if (data == "up") {
      toggleColor(setButtonColorUp);
    } else if (data == "down") {
      toggleColor(setButtonColorDown);
    } else if (data == "left") {
      if (array != null) {
        var newMainItem, newLeftItem, newRightItem;
        var curIndex = array.states.indexOf(array.state);
        if (curIndex > 0) {
          newMainItem = array.states[curIndex - 1];
          newRightItem = array.states[curIndex];
          array.state = newMainItem;
          setDetectObj(array);
          if (curIndex > 1) {
            newLeftItem = array.states[curIndex - 2];
          } else {
            newLeftItem = "";
          }

          setMainCont(newMainItem);
          setRightCont(newRightItem);
          setLeftCont(newLeftItem);

          var buff = {
            req: "state",
            client: array.clientId,
            state: newMainItem,
          };
          ws.send(JSON.stringify(buff));
        }
      }

      toggleColor(setButtonColorLeft);
    } else if (data == "right") {
      if (array != null) {
        var newMainItem, newLeftItem, newRightItem;
        var curIndex = array.states.indexOf(array.state);
        if (curIndex < array.states.length - 1) {
          newMainItem = array.states[curIndex + 1];
          newLeftItem = array.states[curIndex];
          array.state = newMainItem;
          setDetectObj(array);
          if (curIndex < array.states.length - 2) {
            newRightItem = array.states[curIndex + 2];
          } else {
            newRightItem = "";
          }

          setMainCont(newMainItem);
          setRightCont(newRightItem);
          setLeftCont(newLeftItem);

          var buff = {
            req: "state",
            client: array.clientId,
            state: newMainItem,
          };
          ws.send(JSON.stringify(buff));
        }
      }

      toggleColor(setButtonColorRight);
    }
  }

  function ServerAddInput() {
    return (
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          height: "auto",
          width: "100%",
        }}
      >
        <View
          style={{
            width: "80%",
            height: "100%",
          }}
        >
          <TextInput
            style={{
              color: pallete["mid-orange"],
              fontWeight: "bold",
              textAlignVertical: "center",
              textAlign: "center",
              fontSize: 20,
              backgroundColor: pallete["light-orange"],
            }}
            onChangeText={changeWsIp}
            value={wsIp}
            margin={0}
          />
        </View>
        <View
          style={{
            width: "20%",
            height: "85%",
          }}
        >
          <Button
            onPress={setWS}
            titleStyle={{
              color: pallete["dark-orange"] /* 
    fontSize: 30,
    fontStyle: 'italic', */,
            }}
            title="Set WS"
            color={pallete["mid-orange"]}
          />
        </View>
      </View>
    );
  }

  function setWS() {
    var address = "ws://" + wsRef.current + ":81/";
    ws.close();
    ws = useRef(new WebSocket(address)).current;
  }

  function calibrateTracker() {
    var buff = {
      req: "calibrate",
    };
    ws.send(JSON.stringify(buff));
  }

  // server
  var ws = useRef(new WebSocket("ws://" + wsRef.current + ":81/")).current;
  React.useEffect(() => {
    const serverMessagesList = [];
    ws.onopen = () => {
      setServerState("Connected to the server");
      var buff = {
        req: "remoteId",
      };
      ws.send(JSON.stringify(buff));
    };
    ws.onclose = (e) => {
      setServerState("Disconnected. Check internet or server.");
    };
    ws.onerror = (e) => {
      setServerState(e.message);
    };
    ws.onmessage = (e) => {
      setServerMessages(e.data);
      parsePayload(e.data);
    };
  }, []);
  // load tensorflow and download model
  useEffect(() => {
    let checkTf = async () => {
      await tf.ready();
      const model = await mobilenet.load();
      setModel(model);
      setTfReady(true);
    };
    checkTf();
  }, []);

  // camera permissions
  const [hasPermission, setHasPermission] = useState(null);
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);
  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  // predict object from camera stream
  let AUTORENDER = true;
  var handler = setTimeout(clearList, 20000);
  function clearList() {
    setControlObj(true);
  }
  async function handleCameraStream(images, updatePreview, gl) {
    const loop = async () => {
      if (!AUTORENDER) {
        updatePreview();
      }
      const imageTensor = images.next().value;
      const prediction = await model.classify(imageTensor);
      const highestPropPred = prediction[0];
      const surity = Math.round(highestPropPred.probability * 100);
      // set the name of recognised object
      if (surity > 30) {
        for (var i = 0; i < deviceArray.length; i++) {
          var objects = highestPropPred.className.split(", ");
          const result = objects.some((val) =>
            deviceArray[i].keywords.includes(val)
          );
          if (result) {
            setDetectObj(deviceArray[i]);
            setConnArray(i);
            handler.refresh;
            setControlObj(false);
          }
        }
      } else {
        if (controlObj) {
          setDetectObj(null);
        }
      }
      tf.dispose([imageTensor]);

      if (!AUTORENDER) {
        gl.endFrameEXP();
      }
      requestAnimationFrame(loop);
    };

    loop();
  }

  function TfCamera() {
    if (tfReady) {
      return (
        <View style={styles.tensorCameraView}>
          <TensorCamera
            // Standard Camera props
            style={styles.tensorCamera}
            type={Camera.Constants.Type.back}
            // Tensor related props
            cameraTextureHeight={1200}
            cameraTextureWidth={1600}
            resizeHeight={200}
            resizeWidth={152}
            resizeDepth={3}
            onReady={handleCameraStream}
            autorender={true}
          />
        </View>
      );
    } else {
      return (
        <View style={styles.loadingCameraView}>
          <Entypo name="camera" size={24} color={pallete.icons} />
        </View>
      );
    }
  }

  function MasterBlock() {
    if (detectObj != null) {
      var Icon = detectObj.icon[0];

      if (stateBool.current) {
        var curIndex = detectObj.states.indexOf(detectObj.state);
        setMainCont(detectObj.states[curIndex]);
        if (curIndex > 0) {
          setLeftCont(detectObj.states[curIndex - 1]);
        }
        if (curIndex < detectObj.states.length - 2) {
          setRightCont(detectObj.states[curIndex + 1]);
        }
      }

      return (
        <View style={styles.master}>
          <View style={styles.masterContent}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                height: "30%",
                width: "100%",
              }}
            >
              <View
                style={{
                  width: "85%",
                  height: "100%",
                  backgroundColor: pallete["mid-orange"],
                  borderTopLeftRadius: 20,
                  /* flex: 1,
                  flexDirection: "row", */
                  alignItems: "flex-start",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontWeight: "bold",
                    color: pallete["dark-orange"],
                    fontSize: 17,
                    paddingLeft: 20,
                  }}
                >
                  {detectObj.name}
                </Text>
              </View>
              <View
                style={{
                  width: "15%",
                  height: "100%",
                  backgroundColor: pallete["mid-orange"],
                  borderTopRightRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name="camera"
                  size={22}
                  color={pallete["dark-orange"]}
                />
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                backgroundColor: pallete["light-orange"],
                height: "70%",
                borderBottomRightRadius: 20,
                borderBottomLeftRadius: 20,
              }}
            >
              <View
                style={{
                  width: "30%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={detectObj.icon[1]}
                  size={48}
                  color={detectObj.icon[2]}
                />
              </View>
              <View
                style={{
                  width: "70%",
                  height: "100%",
                  alignContent: "center",
                  justifyContent: "space-evenly",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#DF7861",
                      fontSize: 24,
                      paddingRight: 10,
                    }}
                  >
                    {leftCont}
                  </Text>
                  <Text
                    style={{
                      fontWeight: "bold",
                      color: "#DF7861",
                      fontSize: 24,
                      borderWidth: 2,
                      borderColor: "#DF7861",
                      borderRadius: 20,
                      paddingRight: 10,
                      paddingLeft: 10,
                    }}
                  >
                    {mainCont}
                  </Text>
                  <Text
                    style={{
                      color: "#DF7861",
                      fontSize: 24,
                      paddingLeft: 10,
                    }}
                  >
                    {rightCont}
                  </Text>
                </View>

                <Text
                  style={{
                    color: pallete["mid-orange"],
                    fontSize: 15 /* 
                          paddingRight: 10 */,
                  }}
                >
                  {detectObj.macAddr}
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    } else {
      return (
        <View style={styles.master}>
          <View style={styles.masterContent}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                height: "30%",
                width: "100%",
              }}
            >
              <View
                style={{
                  width: "85%",
                  height: "100%",
                  backgroundColor: pallete["bg-dark"],
                  borderTopLeftRadius: 20,
                  /* flex: 1,
                  flexDirection: "row", */
                  alignItems: "flex-start",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontWeight: "bold",
                    color: pallete["dark-blue"],
                    fontSize: 17,
                    paddingLeft: 20,
                  }}
                >
                  No device detected
                </Text>
              </View>
              <View
                style={{
                  width: "15%",
                  height: "100%",
                  backgroundColor: pallete["bg-dark"],
                  borderTopRightRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name="camera-off"
                  size={22}
                  color={pallete["dark-blue"]}
                />
              </View>
            </View>

            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                height: "70%",
                width: "100%",
              }}
            >
              <MaterialCommunityIcons
                name="cube-scan"
                size={48}
                color={pallete["bg-dark"]}
              />
              <Text
                style={{
                  color: pallete["dark-blue"],
                }}
              >
                Point the device towards smart appliance
              </Text>
            </View>
          </View>
        </View>
      );
    }
  }
  function StackBlocks() {
    if (deviceArray != null) {
      return (
        <View
          style={{
            height: "50%",
            width: "100%",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            paddingLeft: 10,
          }}
        >
          {deviceArray.map((element, i) => {
            if (element.name != null) {
              var Icon = element.icon[0];
              return (
                <View
                  key={i}
                  style={{
                    height: "40%",
                    width: "47%",
                    backgroundColor: pallete["bg-light"],
                    borderRadius: 20,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "40%",
                      width: "100%",
                    }}
                  >
                    <Text
                      style={{
                        color: pallete["dark-blue"],
                        fontSize: 18,
                        paddingRight: 10,
                      }}
                    >
                      {element.name}
                    </Text>
                    <FontAwesome
                      name="circle"
                      size={10}
                      color={pallete["light-green"]}
                    />
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                    }}
                  >
                    <View
                      style={{
                        width: "30%",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "flex-start",
                      }}
                    >
                      <Icon
                        name={element.icon[1]}
                        size={24}
                        color={element.icon[2]}
                      />
                    </View>
                    <View
                      key={i}
                      style={{
                        width: "70%",
                        height: "100%",
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "bold",
                          color: pallete.highlight,
                          fontSize: 17 /* 
                          paddingRight: 10 */,
                        }}
                      >
                        {element.state}
                      </Text>
                      <Text
                        style={{
                          color: pallete["bg-dark"],
                          fontSize: 11 /* 
                          paddingRight: 10 */,
                        }}
                      >
                        {element.macAddr}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }
          })}
        </View>
      );
    } else {
      return (
        <View
          style={{
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontWeight: "bold",
              color: pallete["dark-blue"],
              fontSize: 17,
            }}
          >
            No devices found
          </Text>
        </View>
      );
    }
  }

  return (
    <View style={styles.screen}>
      {/* <ServerAddInput /> */}
      <View
        style={{
          height: 32,
          width: "100%",
        }}
      ></View>
      <View style={styles.title}>
        <Image
          source={require("./assets/splash.png")}
          style={{ width: 150, height: 150 }}
        />
      </View>
      <View style={styles.devicesView}>
        <MasterBlock />
        <View>
          <StackBlocks />
        </View>
      </View>
      <View style={styles.controlsView}>
        <View>
          <View style={styles.controlsItems}></View>
          <View style={styles.controlsItems}>
            <MaterialCommunityIcons
              name="arrow-down-left"
              size={60}
              color={buttonColorLeft}
            />
          </View>
          <View style={styles.controlsItems}></View>
        </View>
        <View>
          <View style={styles.controlsItems}>
            <FontAwesome
              name="angle-double-up"
              size={60}
              color={buttonColorUp}
            />
          </View>
          <View style={styles.controlsItems}>
            <TfCamera />
          </View>
          <View style={styles.controlsItems}>
            <FontAwesome
              name="angle-double-down"
              size={60}
              color={buttonColorDown}
            />
          </View>
        </View>
        <View>
          <View style={styles.controlsItems}></View>
          <View style={styles.controlsItems}>
            <MaterialCommunityIcons
              name="arrow-down-right"
              size={60}
              color={buttonColorRight}
            />
          </View>
          <View style={styles.controlsItems}>
            <Button
              onPress={calibrateTracker}
              title="Cal"
              titleStyle={{
                color: pallete["dark-blue"] /* 
    fontSize: 30,
    fontStyle: 'italic', */,
              }}
              color={pallete["bg-dark"]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyle = () => {
  const dimensions = useWindowDimensions();

  const styles = StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: "center",
    },
    title: {
      height: dimensions.height * 0.05,
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
      borderBottomRightRadius: 20,
      borderBottomLeftRadius: 20,
      backgroundColor: pallete["bg-light"],
    },
    devicesView: {
      width: "100%",
      backgroundColor: "#fff",
      alignSelf: "stretch",
      flex: 1,
    },
    master: {
      marginTop: 5,
      marginBottom: 5,
      height: "20%",
      width: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    masterContent: {
      backgroundColor: pallete["bg-light"],
      alignSelf: "stretch",
      flex: 1,
      margin: 10,
      borderRadius: 20,
    },
    stack: {
      height: "60%",
      width: "100%",
      display: "flex",
      borderWidth: 1,
      borderColor: "#ff0",
      justifyContent: "center",
      alignItems: "center",
    },
    controlsView: {
      height: dimensions.height * 0.4,
      width: "100%",
      backgroundColor: pallete["bg-light"],
      position: "absolute",
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      borderTopRightRadius: 20,
      borderTopLeftRadius: 20,
    },
    controlsItems: {
      width: dimensions.width * 0.3,
      height: dimensions.width * 0.3,
      marginBottom: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    tensorCameraView: {
      borderRadius: 7,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: pallete.highlight,
    },
    tensorCamera: {
      zIndex: -10,
      width: dimensions.width * 1.05 * 0.2,
      height: dimensions.height * 0.7 * 0.2,
    },
    loadingCameraView: {
      width: dimensions.width * 1.05 * 0.2,
      height: dimensions.height * 0.7 * 0.2,
      backgroundColor: pallete["bg-light"],
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 7,
      borderWidth: 2,
      borderColor: pallete.highlight,
    },
  });
  return { styles };
};

const pallete = {
  "bg-light": "#EEF1FF",
  /* 'icons' : '#AAC4FF', */
  icons: "#B1B2FF",
  highlight: "#B1B2FF",
  "bg-dark": "#AAC4FF",
  active: "#F6AE84",
  "dark-blue": "#1450A3",
  "dark-orange": "#6C3428",
  "mid-orange": "#f6ae84",
  "light-orange": "#FAF0D7",
  "light-green": "#98D8AA",
  "bit-dark-blue": "#7091F5",
};

const deviceStoredList = [
  {
    name: "Washing machine",
    icon: [MaterialCommunityIcons, "washing-machine", pallete["bg-dark"]],
    mac: "",
    keywords: ["washer", "automatic washer", "washing machine"],
    state: "Off",
    states: ["Off", "Wash", "Dry"],
  },
  {
    name: "Space heater",
    icon: [Entypo, "air", "orange"],
    mac: "84:0D:8E:BC:E7:B5",
    keywords: ["space heater"],
    state: false,
    states: ["On", "Off"],
  },
  {
    name: "Smart Plug",
    icon: "",
    mac: "",
    keywords: ["switch", "electric switch", "electrical switch"],
    state: false,
    states: ["On", "Off"],
  },
  {
    name: "Pedestal fan",
    icon: [MaterialCommunityIcons, "fan", pallete["bit-dark-blue"]],
    mac: "F4:CF:A2:52:EF:62",
    keywords: ["electric fan", "blower", "fan"],
    state: false,
    states: ["Off", "Speed1", "Speed2", "Speed3"],
  },
];
