import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('შეცდომა', error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) Alert.alert('შეცდომა', error.message);
    else Alert.alert('წარმატება', 'რეგისტრაცია წარმატებულია!');
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.authContainer}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{flex: 1, justifyContent: 'center'}}
      >
        <View style={styles.authCard}>
          <Text style={styles.mainTitle}>DOG ID 🐾</Text>
          <Text style={styles.subTitle}>შედით სისტემაში ან დარეგისტრირდით</Text>
          
          <TextInput 
            style={styles.authInput} 
            placeholder="ელ-ფოსტა" 
            value={email} 
            onChangeText={setEmail} 
            autoCapitalize="none" 
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
            placeholderTextColor="#aaa"
          />
          
          <TouchableOpacity style={styles.mainBtn} onPress={signInWithEmail} disabled={loading}>
            <Text style={styles.mainBtnText}>{loading ? 'გთხოვთ დაელოდოთ...' : 'შესვლა'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={signUpWithEmail} disabled={loading}>
            <Text style={styles.outlineBtnText}>რეგისტრაცია</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ==========================================
// სტილები მხოლოდ ავტორიზაციის ეკრანისთვის
// ==========================================
const styles = StyleSheet.create({
  authContainer: { 
    flex: 1, 
    backgroundColor: '#f4f6f9', 
    padding: 20 
  },
  authCard: { 
    backgroundColor: '#fff', 
    padding: 30, 
    borderRadius: 28, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 20, 
    elevation: 5 
  },
  mainTitle: { 
    fontSize: 34, 
    fontWeight: '800', 
    textAlign: 'center', 
    color: '#2e8b57', 
    marginBottom: 8, 
    letterSpacing: 1 
  },
  subTitle: { 
    fontSize: 15, 
    color: '#777', 
    textAlign: 'center', 
    marginBottom: 35, 
    fontWeight: '500' 
  },
  authInput: { 
    backgroundColor: '#f8f9fa', 
    borderWidth: 1.5, 
    borderColor: '#eef0f2', 
    padding: 18, 
    borderRadius: 16, 
    marginBottom: 15, 
    fontSize: 16, 
    color: '#333' 
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
    marginTop: 10 
  },
  mainBtnText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16, 
    letterSpacing: 0.5 
  },
  outlineBtn: { 
    backgroundColor: '#fff', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#2e8b57', 
    marginTop: 15 
  },
  outlineBtnText: { 
    color: '#2e8b57', 
    fontWeight: 'bold', 
    fontSize: 16 
  }
});