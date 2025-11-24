import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import RegisterScreen from './tabs/RegisterScreen';
import RecognizeScreen from './tabs/RecognizeScreen';
import AttendanceScreen from './tabs/AttendanceScreen';
import { RouteProp, useRoute } from '@react-navigation/native';

// Define type for route params
type ClassroomScreenRouteProp = RouteProp<{ params: { classroomName: string } }, 'params'>;

const Tab = createBottomTabNavigator();

export default function ClassroomScreen() {
  // Get classroom name passed from HomeScreen
  const route = useRoute<ClassroomScreenRouteProp>();
  const { classroomName } = route.params;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: any;
          if (route.name === 'Register') iconName = 'person-add';
          else if (route.name === 'Recognize') iconName = 'camera';
          else if (route.name === 'Attendance') iconName = 'clipboard';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* Pass classroomName to each tab as initialParams */}
      <Tab.Screen
        name="Register"
        component={RegisterScreen}
        initialParams={{ classroomName }}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Recognize"
        component={RecognizeScreen}
        initialParams={{ classroomName }}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        initialParams={{ classroomName }}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}
