import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './lib/supabase';
import { isAdminUser } from './lib/adminConfig';
import AuthScreen from './screens/authScreen';
import SearchScreen from './screens/SearchScreen';
import ProfileScreen from './screens/ProfileScreen';
import ClinicsScreen from './screens/clinicsScreen';
import EventsScreen from './screens/iventsScreen';
import HelpScreen from './screens/helpScreen';
import AdminScreen from './screens/AdminScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setIsInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!session?.user?.id) {
        if (isMounted) setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (isMounted) {
        setProfile(error ? null : data);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [session]);

  if (isInitializing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2e8b57" />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  const showAdminTab = isAdminUser(session, profile);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => {
            let iconName = 'ellipse';

            if (route.name === 'Search') iconName = 'search';
            else if (route.name === 'Clinics') iconName = 'medical';
            else if (route.name === 'Events') iconName = 'calendar';
            else if (route.name === 'Help') iconName = 'help-circle';
            else if (route.name === 'Admin') iconName = 'shield-checkmark';
            else if (route.name === 'Profile') iconName = 'person';

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#2e8b57',
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: { height: 60, paddingBottom: 10 },
        })}
      >
        <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'ძებნა' }} />
        <Tab.Screen name="Clinics" component={ClinicsScreen} options={{ title: 'კლინიკები' }} />
        <Tab.Screen name="Events" component={EventsScreen} options={{ title: 'ივენთები' }} />
        <Tab.Screen name="Help" component={HelpScreen} options={{ title: 'დახმარება' }} />
        {showAdminTab && (
          <Tab.Screen name="Admin" options={{ title: 'ადმინი' }}>
            {() => <AdminScreen session={session} profile={profile} />}
          </Tab.Screen>
        )}
        <Tab.Screen name="Profile" options={{ title: 'პროფილი' }}>
          {() => <ProfileScreen session={session} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f6f9',
  },
});
