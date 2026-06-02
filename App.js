import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './lib/supabase';
import { isAdminUser } from './lib/adminConfig';
import {
  getStoredPrimaryPetId,
  setStoredPrimaryPetId,
} from './lib/primaryPetStorage';
import AuthScreen from './screens/authScreen';
import SearchScreen from './screens/SearchScreen';
import ProfileScreen from './screens/ProfileScreen';
import HelpScreen from './screens/helpScreen';
import AdminScreen from './screens/AdminScreen';
import ShopScreen from './screens/ShopScreen';
import AppUpdateManager from './components/AppUpdateManager';
import PushNotificationManager from './components/PushNotificationManager';
import {
  flushPendingNotificationTarget,
  navigationRef,
} from './lib/navigation';

const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [profileRefreshToken, setProfileRefreshToken] = useState(0);
  const [petsRefreshToken, setPetsRefreshToken] = useState(0);
  const [recentLostPetId, setRecentLostPetId] = useState(null);
  const [primaryPetId, setPrimaryPetId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadPrimaryPetId() {
      if (!session?.user?.id) {
        if (isMounted) {
          setPrimaryPetId(null);
        }
        return;
      }

      const storedPrimaryPetId = await getStoredPrimaryPetId(session.user.id);

      if (isMounted) {
        setPrimaryPetId(storedPrimaryPetId || null);
      }
    }

    loadPrimaryPetId();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!session?.user?.id) {
        if (isMounted) {
          setProfile(null);
        }
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
  }, [session, profileRefreshToken]);

  function handleProfileChanged() {
    setProfileRefreshToken((current) => current + 1);
  }

  function handlePetsChanged(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, 'recentLostPetId')) {
      setRecentLostPetId(options.recentLostPetId || null);
    }

    setPetsRefreshToken((current) => current + 1);
  }

  async function handlePrimaryPetChanged(petId) {
    const normalizedPetId = petId || null;
    setPrimaryPetId(normalizedPetId);

    if (session?.user?.id) {
      await setStoredPrimaryPetId(session.user.id, normalizedPetId);
    }
  }

  if (isInitializing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2e8b57" />
      </View>
    );
  }

  const showAdminTab = isAdminUser(session, profile);

  return (
    <>
      <AppUpdateManager />
      <PushNotificationManager session={session} />
      {!session ? (
        <AuthScreen />
      ) : (
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            flushPendingNotificationTarget();
          }}
        >
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarIcon: ({ color, size }) => {
                let iconName = 'ellipse';

                if (route.name === 'Search') iconName = 'home';
                else if (route.name === 'Help') iconName = 'help-circle';
                else if (route.name === 'Shop') iconName = 'bag-handle';
                else if (route.name === 'Profile') iconName = 'person';
                else if (route.name === 'Admin') iconName = 'shield-checkmark';

                return <Ionicons name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: '#2e8b57',
              tabBarInactiveTintColor: 'gray',
              tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
              tabBarStyle: { height: 68, paddingBottom: 8, paddingTop: 6 },
            })}
          >
            <Tab.Screen name="Search" options={{ title: 'მთავარი' }}>
              {(props) => (
                <SearchScreen
                  {...props}
                  session={session}
                  profile={profile}
                  petsRefreshToken={petsRefreshToken}
                  recentLostPetId={recentLostPetId}
                  primaryPetId={primaryPetId}
                  onPetsChanged={handlePetsChanged}
                />
              )}
            </Tab.Screen>
            <Tab.Screen
              name="Help"
              component={HelpScreen}
              options={{ title: 'დახმარება' }}
            />
            <Tab.Screen name="Shop" options={{ title: 'მაღაზია' }}>
              {() => <ShopScreen session={session} profile={profile} />}
            </Tab.Screen>
            <Tab.Screen name="Profile" options={{ title: 'პროფილი' }}>
              {() => (
                <ProfileScreen
                  session={session}
                  petsRefreshToken={petsRefreshToken}
                  primaryPetId={primaryPetId}
                  onPrimaryPetChanged={handlePrimaryPetChanged}
                  onPetsChanged={handlePetsChanged}
                  onProfileChanged={handleProfileChanged}
                />
              )}
            </Tab.Screen>

            {showAdminTab && (
              <Tab.Screen name="Admin" options={{ title: 'ადმინი' }}>
                {(props) => <AdminScreen {...props} session={session} profile={profile} />}
              </Tab.Screen>
            )}
          </Tab.Navigator>
        </NavigationContainer>
      )}
    </>
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
