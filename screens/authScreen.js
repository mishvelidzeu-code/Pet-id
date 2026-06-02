import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { ensureProfileRow } from '../lib/profileService';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); // სახელის და გვარის state
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  async function withTimeout(promise, message, timeoutMs = 15000) {
    let timeoutId;

    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(message));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  // პროფილის სინქრონიზაცია დამატებითი მონაცემებით (სახელი, ტელეფონი)
  async function syncProfileAfterAuth(user, additionalData = {}) {
    if (!user) return;

    try {
      const { error } = await ensureProfileRow(user, additionalData);
      if (error) {
        console.log('Profile sync error after auth:', error);
      }
    } catch (error) {
      console.log('Profile sync exception after auth:', error);
    }
  }

  async function signInWithEmail() {
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ ელ-ფოსტა და პაროლი.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        }),
        'შესვლას ზედმეტად დიდხანს სჭირდება. შეამოწმე ინტერნეტი და სცადე თავიდან.'
      );

      if (error) {
        Alert.alert('შეცდომა', error.message);
        return;
      }

      if (data?.user) {
        void syncProfileAfterAuth(data.user);
      }
    } catch (error) {
      Alert.alert('შესვლა ვერ მოხერხდა', error.message || 'გთხოვთ სცადოთ თავიდან.');
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithEmail() {
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const normalizedFullName = fullName.trim();

    if (!normalizedFullName) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ სახელი და გვარი.');
      return;
    }

    if (!normalizedPhone) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ ტელეფონის ნომერი.');
      return;
    }

    if (!normalizedEmail || !password) {
      Alert.alert('შეცდომა', 'გთხოვთ შეიყვანოთ ელ-ფოსტა და პაროლი.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email: normalizedEmail,
          password,
        }),
        'რეგისტრაციას ზედმეტად დიდხანს სჭირდება. შეამოწმე ინტერნეტი და სცადე თავიდან.'
      );

      if (error) {
        Alert.alert('შეცდომა', error.message);
        return;
      }

      // ვაგზავნით როგორც ტელეფონს, ისე სახელს და გვარს
      const profileData = {
        full_name: normalizedFullName,
        phone_number: normalizedPhone
      };

      if (data?.user && data?.session) {
        void syncProfileAfterAuth(data.user, profileData);
      } else if (data?.user) {
        void syncProfileAfterAuth(data.user, profileData);
        Alert.alert('წარმატება', 'რეგისტრაცია დასრულდა. თუ საჭირო იქნება, ელ-ფოსტა დაადასტურე.');
        setIsRegisterMode(false);
      }
    } catch (error) {
      Alert.alert('რეგისტრაცია ვერ მოხერხდა', error.message || 'გთხოვთ სცადოთ თავიდან.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.authContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.authShell}
      >
        <View style={styles.authCard}>
          <Text style={styles.mainTitle}>Georgian Pets</Text>
          <Text style={styles.subTitle}>
            {isRegisterMode ? 'შექმენი ახალი ანგარიში' : 'შედი სისტემაში ან დარეგისტრირდი'}
          </Text>

          {/* სახელი და გვარი ჩანს მხოლოდ რეგისტრაციისას */}
          {isRegisterMode && (
            <TextInput
              style={styles.authInput}
              placeholder="სახელი და გვარი"
              value={fullName}
              onChangeText={setFullName}
              autoCorrect={false}
              placeholderTextColor="#aaa"
              textContentType="name"
            />
          )}

          {/* ტელეფონი ჩანს მხოლოდ რეგისტრაციისას */}
          {isRegisterMode && (
            <TextInput
              style={styles.authInput}
              placeholder="ტელეფონის ნომერი"
              value={phone}
              onChangeText={setPhone}
              autoCorrect={false}
              placeholderTextColor="#aaa"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />
          )}

          <TextInput
            style={styles.authInput}
            placeholder="ელ-ფოსტა"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor="#aaa"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <TextInput
            style={styles.authInput}
            placeholder="პაროლი"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCorrect={false}
            placeholderTextColor="#aaa"
            textContentType="password"
          />

          {isRegisterMode ? (
            <>
              <TouchableOpacity
                style={[styles.mainBtn, loading && styles.mainBtnDisabled]}
                onPress={signUpWithEmail}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.mainBtnText}>
                  {loading ? 'გთხოვთ დაელოდოთ...' : 'რეგისტრაცია'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.outlineBtn, loading && styles.outlineBtnDisabled]}
                onPress={() => setIsRegisterMode(false)}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.outlineBtnText}>შესვლის გვერდზე დაბრუნება</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.mainBtn, loading && styles.mainBtnDisabled]}
                onPress={signInWithEmail}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.mainBtnText}>
                  {loading ? 'გთხოვთ დაელოდოთ...' : 'შესვლა'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.outlineBtn, loading && styles.outlineBtnDisabled]}
                onPress={() => setIsRegisterMode(true)}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.outlineBtnText}>რეგისტრაცია</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    backgroundColor: '#f4f6f9',
    padding: 20,
  },
  authShell: {
    flex: 1,
    justifyContent: 'center',
  },
  authCard: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  mainTitle: {
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    color: '#2e8b57',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subTitle: {
    fontSize: 15,
    color: '#777',
    textAlign: 'center',
    marginBottom: 35,
    fontWeight: '500',
  },
  authInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: '#eef0f2',
    padding: 18,
    borderRadius: 16,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  mainBtn: {
    backgroundColor: '#2e8b57',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#2e8b57',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
    marginTop: 10,
  },
  mainBtnDisabled: {
    opacity: 0.7,
  },
  mainBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  outlineBtn: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2e8b57',
    marginTop: 15,
  },
  outlineBtnDisabled: {
    opacity: 0.6,
  },
  outlineBtnText: {
    color: '#2e8b57',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
