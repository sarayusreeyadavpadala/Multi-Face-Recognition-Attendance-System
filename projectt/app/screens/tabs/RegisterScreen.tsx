import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert, TouchableOpacity, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRoute } from '@react-navigation/native';

interface Student {
  name: string;
  images: string[];
}

export default function RegisterScreen() {
  const [studentName, setStudentName] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [showCamera, setShowCamera] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // ✅ Get classroomName from navigation params
  const route = useRoute();
  const { classroomName } = route.params as { classroomName: string };

  const BACKEND_URL = "http://192.168.29.109:5000";

  const fetchStudents = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/students/${classroomName}`);
      const data = await response.json();
      if (response.ok) {
        setStudents(data.students.map((name: string) => ({ name, images: [] })));
      } else {
        console.log("Fetch error:", data.error);
      }
    } catch (error) {
      console.log("Error fetching students:", (error as Error).message);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const captureImage = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      setCapturedImages((prev) => [...prev, photo.uri].slice(0, 3));
      if (capturedImages.length + 1 >= 3) {
        Alert.alert('Info', 'You have captured 3 images. You can now register the student.');
      }
    }
  };

  const retakeImage = () => {
    setCapturedImages((prev) => prev.slice(0, -1));
  };

  const registerStudent = async () => {
    if (studentName.trim() === '') {
      Alert.alert('Error', 'Enter student name');
      return;
    }
    if (capturedImages.length !== 3) {
      Alert.alert('Error', 'Please capture exactly 3 images');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', studentName);
      formData.append('classroom', classroomName); // ✅ include classroom info

      capturedImages.forEach((uri, index) => {
        formData.append('images', {
          uri,
          type: 'image/jpeg',
          name: `${studentName}_${index + 1}.jpg`,
        } as any);
      });

      const response = await fetch(`${BACKEND_URL}/register/${classroomName}`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!response.ok) throw new Error('Failed to register student');

      Alert.alert('Success', `${studentName} registered successfully`);
      setStudents((prev) => [...prev, { name: studentName, images: capturedImages }]);
      setStudentName('');
      setCapturedImages([]);
      setShowCamera(false);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const deleteStudent = async (name: string, index: number) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete ${name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/students/${classroomName}/${name}`, {
                method: "DELETE",
              });
              const result = await response.json();
              if (!response.ok) throw new Error("Failed to delete student");

              setStudents((prev) => prev.filter((_, i) => i !== index));
              Alert.alert("Deleted", `${name} removed successfully`);
            } catch (error) {
              Alert.alert("Error", (error as Error).message);
            }
          },
        },
      ]
    );
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
            <Button title="Capture" onPress={captureImage} disabled={capturedImages.length >= 3} />
            <Button title="Retake Last" onPress={retakeImage} disabled={capturedImages.length === 0} />
            <Button title="Close Camera" color="red" onPress={() => setShowCamera(false)} />
          </View>
        </CameraView>
      ) : (
        <>
          <Text style={styles.title}>Classroom: {classroomName}</Text>
          <TextInput
            placeholder="Student Name"
            value={studentName}
            onChangeText={setStudentName}
            style={styles.input}
          />
          <Button title="Open Camera" onPress={() => setShowCamera(true)} />
          <Text style={{ marginVertical: 10 }}>Captured Images: {capturedImages.length}/3</Text>

          <View style={styles.previewContainer}>
            {capturedImages.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.previewImage} />
            ))}
          </View>

          <Button title="Register Student" onPress={registerStudent} />
        </>
      )}

      <Text style={{ marginTop: 20, fontSize: 18, fontWeight: 'bold' }}>Registered Students</Text>
      <FlatList
        data={students}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.studentCard}>
            <Text style={styles.studentName}>{item.name}</Text>
            <TouchableOpacity onPress={() => deleteStudent(item.name, index)}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#f2f2f2' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginBottom: 10, backgroundColor: '#fff' },
  camera: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  cameraControls: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 10 },
  previewContainer: { flexDirection: 'row', marginVertical: 10, flexWrap: 'wrap' },
  previewImage: { width: 100, height: 100, margin: 5, borderRadius: 8 },
  studentCard: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginVertical: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  studentName: { fontSize: 16, fontWeight: 'bold' },
  deleteText: { color: 'red', fontWeight: 'bold' },
});
