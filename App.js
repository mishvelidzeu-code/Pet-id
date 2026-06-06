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
import AssistantScreen from './screens/AssistantScreen';
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
              tabBarIcon: ({ color, focused }) => {
                let iconName = 'ellipse';

                if (route.name === 'Search') iconName = 'home';
                else if (route.name === 'Help') iconName = 'help-buoy';
                else if (route.name === 'Assistant') iconName = 'sparkles';
                else if (route.name === 'Shop') iconName = 'id-card';
                else if (route.name === 'Profile') iconName = 'person';
                else if (route.name === 'Admin') iconName = 'shield-checkmark';

                return (
                  <View
                    style={[
                      styles.tabIconWrap,
                      route.name === 'Assistant' && styles.assistantTabIconWrap,
                      focused && styles.tabIconWrapActive,
                      route.name === 'Assistant' && focused && styles.assistantTabIconWrapActive,
                    ]}
                  >
                    <Ionicons
                      name={iconName}
                      size={route.name === 'Assistant' ? 24 : focused ? 22 : 20}
                      color={route.name === 'Assistant' ? '#ffffff' : color}
                    />
                  </View>
                );
              },
              tabBarActiveTintColor: '#16352c',
              tabBarInactiveTintColor: '#7b8d86',
              tabBarLabelStyle: styles.tabBarLabel,
              tabBarItemStyle: styles.tabBarItem,
              tabBarStyle: styles.tabBar,
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
            <Tab.Screen
              name="Assistant"
              component={AssistantScreen}
              options={{ title: 'ასისტენტი' }}
            />
            <Tab.Screen name="Shop" options={{ title: 'პასპორტი' }}>
              {(props) => (
                <ShopScreen
                  {...props}
                  session={session}
                  petsRefreshToken={petsRefreshToken}
                  onPetsChanged={handlePetsChanged}
                />
              )}
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
  tabBar: {
    height: 76,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e3ebe6',
    shadowColor: '#0f241d',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 16,
  },
  tabBarItem: {
    borderRadius: 18,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 2,
  },
  tabIconWrap: {
    width: 38,
    height: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    backgroundColor: '#e7f4ee',
  },
  assistantTabIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: '#16352c',
    marginTop: -28,
    shadowColor: '#16352c',
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 10,
  },
  assistantTabIconWrapActive: {
    backgroundColor: '#2e8b57',
  },
});
