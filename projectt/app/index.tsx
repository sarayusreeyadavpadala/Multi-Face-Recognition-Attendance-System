import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import ClassroomScreen from './screens/ClassroomScreen';

export type RootStackParamList = {
  Home: undefined;
  Classroom: { classroomName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
      <Stack.Navigator>
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ title:'Home', headerShown: true }} />
        <Stack.Screen 
          name="Classroom" 
          component={ClassroomScreen} 
          options={({ route }) => ({ title: route.params.classroomName })}
        />
      </Stack.Navigator>
  );
}
