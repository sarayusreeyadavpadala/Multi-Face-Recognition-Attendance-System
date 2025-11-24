import React, { useEffect, useState } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Modal, TextInput, Button, StyleSheet, Alert 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './types/navigation';  // ✅ Make sure this path is correct

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// Replace this with your backend IP or localhost
const BASE_URL = "http://192.168.29.109:5000/api/classrooms";

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [classrooms, setClassrooms] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [className, setClassName] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);

  // Fetch classrooms from backend
  const fetchClassrooms = async () => {
    try {
      const response = await axios.get(BASE_URL);
      setClassrooms(response.data);
    } catch (error) {
      console.error("Error fetching classrooms:", error);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  // Create or edit classroom
  const addOrEditClassroom = async () => {
    if (className.trim() === '') return;

    try {
      if (editingName) {
        await axios.put(`${BASE_URL}/${encodeURIComponent(editingName)}`, { name: className });
      } else {
        await axios.post(BASE_URL, { name: className });
      }

      fetchClassrooms();
      setClassName('');
      setEditingName(null);
      setModalVisible(false);
    } catch (error) {
      console.error("Error saving classroom:", error);
    }
  };

  const editClassroom = (name: string) => {
    setEditingName(name);
    setClassName(name);
    setModalVisible(true);
  };

  const deleteClassroom = (name: string) => {
    Alert.alert(
      'Delete Classroom',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${BASE_URL}/${encodeURIComponent(name)}`);
              fetchClassrooms();
            } catch (error) {
              console.error("Error deleting classroom:", error);
            }
          }
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: string }) => (
    <View style={styles.classCard}>
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={() => navigation.navigate('Classroom', { classroomName: item })}  // ✅ Pass name to Classroom screen
      >
        <Text style={styles.classTitle}>{item}</Text>
      </TouchableOpacity>
      <View style={styles.actionIcons}>
        <TouchableOpacity onPress={() => editClassroom(item)}>
          <Ionicons name="create-outline" size={22} color="green" style={styles.icon} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteClassroom(item)}>
          <Ionicons name="trash-outline" size={22} color="red" style={styles.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={classrooms}
        keyExtractor={(item) => item}
        renderItem={renderItem}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditingName(null);
          setClassName('');
          setModalVisible(true);
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <TextInput
              placeholder="Enter Classroom Name"
              value={className}
              onChangeText={setClassName}
              style={styles.input}
            />
            <Button
              title={editingName ? "Save Changes" : "Add Classroom"}
              onPress={addOrEditClassroom}
            />
            <Button title="Cancel" color="red" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    margin: 8,
    borderRadius: 10,
    elevation: 2,
  },
  classTitle: { fontSize: 18, fontWeight: 'bold' },
  actionIcons: { flexDirection: 'row', marginLeft: 10 },
  icon: { marginLeft: 12 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#007bff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  modalContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBox: { backgroundColor: '#fff', padding: 20, borderRadius: 10, width: '80%' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginBottom: 10 },
});
