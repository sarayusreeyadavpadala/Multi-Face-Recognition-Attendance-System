import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert, ActivityIndicator, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';

type ClassroomRouteProp = RouteProp<RootStackParamList, 'Classroom'>;

export default function RecognizeScreen() {
  const route = useRoute<ClassroomRouteProp>();
  const { classroomName } = route.params; // get classroom name
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<{ count: number; names: string[] } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const captureImage = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setCapturedImage(photo.uri);
      setShowCamera(false);
    }
  };

  const retakeImage = () => {
    setCapturedImage(null);
    setAttendanceResult(null);
    setShowCamera(true);
  };

  const sendToBackend = async () => {
    if (!capturedImage) return;

    try {
      setLoading(true);
      setAttendanceResult(null);

      const formData = new FormData();
      formData.append("file", {
        uri: capturedImage,
        name: "photo.jpg",
        type: "image/jpeg",
      } as any);

      // Send classroom name as query param
      const response = await fetch(`http://192.168.29.109:5000/recognize/${encodeURIComponent(classroomName)}`, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to connect to backend");
      }

      const result = await response.json();
      setAttendanceResult(result);

    } catch (error: any) {
      Alert.alert("Error", error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>We need your permission to use the camera</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showCamera ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraControls}>
            <Button title="Capture" onPress={captureImage} />
            <Button title="Close" color="red" onPress={() => setShowCamera(false)} />
          </View>
        </CameraView>
      ) : (
        <>
          {!capturedImage && !attendanceResult && (
            <Button title="Open Camera" onPress={() => setShowCamera(true)} />
          )}

          {capturedImage && !attendanceResult && !loading && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
              <View style={styles.actionButtons}>
                <Button title="Retake" onPress={retakeImage} color="orange" />
                <Button title="Confirm & Send" onPress={sendToBackend} />
              </View>
            </View>
          )}

          {loading && (
            <View style={{ marginTop: 20 }}>
              <ActivityIndicator size="large" color="blue" />
              <Text>Processing attendance...</Text>
            </View>
          )}

          {attendanceResult && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>Attendance Marked</Text>
              <Text>{attendanceResult.count} students present</Text>
              <Text style={styles.resultNames}>{attendanceResult.names.join(", ")}</Text>
              <Button title="Take Another Picture" onPress={retakeImage} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
  camera: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  cameraControls: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 20 },
  previewContainer: { alignItems: 'center', marginTop: 20 },
  previewImage: { width: 250, height: 250, marginBottom: 10, borderRadius: 10 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '80%', marginTop: 10 },
  resultContainer: { marginTop: 20, alignItems: 'center' },
  resultTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  resultNames: { marginTop: 5, fontStyle: 'italic', textAlign: 'center' },
});
