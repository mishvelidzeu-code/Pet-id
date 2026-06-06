import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBookingRequest } from '../lib/bookingService';

const emptyForm = {
  requester_name: '',
  phone: '',
  note: '',
};

export default function BookingRequestModal({
  visible,
  business,
  session = null,
  profile = null,
  onClose,
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm({
        requester_name: profile?.full_name || '',
        phone: profile?.phone_number || '',
        note: '',
      });
      setSaving(false);
    }
  }, [profile, visible]);

  async function submit() {
    if (!business?.business_id) {
      Alert.alert('დაჯავშნა', 'ამ ობიექტზე დაჯავშნა ჯერ არ არის ჩართული.');
      return;
    }

    if (!form.requester_name.trim()) {
      Alert.alert('დაჯავშნა', 'შეიყვანე სახელი.');
      return;
    }

    if (!form.phone.trim()) {
      Alert.alert('დაჯავშნა', 'შეიყვანე ტელეფონის ნომერი.');
      return;
    }

    setSaving(true);

    const { error } = await createBookingRequest({
      business_id: business.business_id,
      requester_id: session?.user?.id || null,
      requester_name: form.requester_name,
      phone: form.phone,
      note: form.note,
    });

    setSaving(false);

    if (error) {
      Alert.alert('დაჯავშნა ვერ გაიგზავნა', error.message || 'სცადე თავიდან.');
      return;
    }

    Alert.alert('მოთხოვნა გაგზავნილია', 'პარტნიორი დაგიკავშირდება დასადასტურებლად.');
    onClose?.();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.eyebrow}>{business?.name || 'ობიექტი'}</Text>
              <Text style={styles.title}>დაჯავშნის მოთხოვნა</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color="#16352c" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            value={form.requester_name}
            onChangeText={(value) => setForm((current) => ({ ...current, requester_name: value }))}
            placeholder="სახელი"
            placeholderTextColor="#8ca097"
          />
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))}
            placeholder="ტელეფონი"
            placeholderTextColor="#8ca097"
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={form.note}
            onChangeText={(value) => setForm((current) => ({ ...current, note: value }))}
            placeholder="რა სერვისი გინდა, როდის გჭირდება, ცხოველის ზომა და სხვა დეტალები"
            placeholderTextColor="#8ca097"
            multiline
          />

          <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>გაგზავნა</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 24, 19, 0.42)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d8e3de',
    marginBottom: 18,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  eyebrow: { color: '#2e8b57', fontSize: 12, fontWeight: '900' },
  title: { marginTop: 4, color: '#16352c', fontSize: 24, fontWeight: '900' },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#eef4f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe9e4',
    backgroundColor: '#f7fbf9',
    color: '#16352c',
    paddingHorizontal: 14,
    marginBottom: 10,
    fontWeight: '700',
  },
  noteInput: { minHeight: 104, paddingTop: 13, textAlignVertical: 'top' },
  submitButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#16352c',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
});
