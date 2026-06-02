import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { APP_TAB_ROUTES } from '../lib/pushNotifications';
import { approveLostPetAlert } from '../lib/lostPetAlerts';

const destinationOptions = [
  { label: 'არცერთი', value: '' },
  { label: 'ძებნა', value: 'Search' },
  { label: 'დახმარება', value: 'Help' },
  { label: 'მაღაზია', value: 'Shop' },
  { label: 'პროფილი', value: 'Profile' },
  { label: 'ივენთები', value: 'Events' },
  { label: 'კლინიკები', value: 'Clinics' },
  { label: 'ადმინი', value: 'Admin' },
];

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('ka-GE');
}

export default function AdminPushManager({ visible }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [lostPetRequests, setLostPetRequests] = useState([]);
  const [approvingRequestId, setApprovingRequestId] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('all');
  const [targetUserId, setTargetUserId] = useState('');
  const [targetScreen, setTargetScreen] = useState('');

  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible]);

  async function loadHistory(withRefresh = false) {
    if (withRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const [historyResult, lostPetResult] = await Promise.all([
      supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('lost_pet_alert_requests')
        .select('id, created_at, pets(id, name, breed, location, short_code, photo_url)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    if (historyResult.error || lostPetResult.error) {
      Alert.alert('ნოტიფიკაციები', historyResult.error?.message || lostPetResult.error?.message);
    } else {
      setHistory(historyResult.data || []);
      setLostPetRequests(lostPetResult.data || []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  async function approveRequest(requestId) {
    setApprovingRequestId(requestId);
    const { data, error } = await approveLostPetAlert(requestId);
    setApprovingRequestId(null);

    if (error) {
      return Alert.alert('დადასტურება ვერ მოხერხდა', error.message);
    }

    await loadHistory(true);
    Alert.alert(
      'შეტყობინება გაგზავნილია',
      `წარმატებული token-ები: ${data?.sentCount ?? 0}, შეცდომები: ${data?.failedCount ?? 0}`
    );
  }

  async function sendNotification() {
    if (!title.trim()) {
      return Alert.alert('ნოტიფიკაციები', 'სათაური სავალდებულოა.');
    }

    if (!body.trim()) {
      return Alert.alert('ნოტიფიკაციები', 'ტექსტი სავალდებულოა.');
    }

    if (targetType === 'user' && !targetUserId.trim()) {
      return Alert.alert(
        'ნოტიფიკაციები',
        'კონკრეტულ მომხმარებელზე გასაგზავნად ჩაწერე მისი user id.'
      );
    }

    if (targetScreen && !APP_TAB_ROUTES.includes(targetScreen)) {
      return Alert.alert('ნოტიფიკაციები', 'არჩეული ეკრანი არასწორია.');
    }

    setSending(true);

    const payload = {
      title: title.trim(),
      body: body.trim(),
      targetType,
      targetUserId: targetType === 'user' ? targetUserId.trim() : null,
      data: targetScreen ? { screen: targetScreen } : {},
    };

    const { data, error } = await supabase.functions.invoke(
      'send-push-notification',
      {
        body: payload,
      }
    );

    setSending(false);

    if (error) {
      Alert.alert('გაგზავნა ვერ მოხერხდა', error.message);
      return;
    }

    setTitle('');
    setBody('');
    setTargetType('all');
    setTargetUserId('');
    setTargetScreen('');
    await loadHistory(true);

    Alert.alert(
      'გაგზავნილია',
      `მზადაა. წარმატებული ტოკენები: ${data?.sentCount ?? 0}, შეცდომები: ${
        data?.failedCount ?? 0
      }`
    );
  }

  if (!visible) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2e8b57" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>დასადასტურებელი დაკარგული ცხოველები</Text>
        <Text style={styles.subtitle}>
          საერთო შეტყობინება მხოლოდ შენი დადასტურების შემდეგ გაეგზავნება მომხმარებლებს.
        </Text>
        {!lostPetRequests.length ? (
          <Text style={styles.empty}>დასადასტურებელი მოთხოვნა არ არის.</Text>
        ) : (
          lostPetRequests.map((item) => (
            <View key={item.id} style={styles.requestItem}>
              <Text style={styles.historyTitle}>{item.pets?.name || 'ცხოველი'}</Text>
              <Text style={styles.historyBody}>
                {[item.pets?.breed, item.pets?.location].filter(Boolean).join(' • ') || 'დამატებითი ინფორმაცია არ არის'}
              </Text>
              <Text style={styles.historyMeta}>Pet ID: {item.pets?.short_code || '-'}</Text>
              <TouchableOpacity
                style={styles.approveButton}
                onPress={() => approveRequest(item.id)}
                disabled={approvingRequestId === item.id}
              >
                <Text style={styles.approveButtonText}>
                  {approvingRequestId === item.id
                    ? 'იგზავნება...'
                    : 'დადასტურება და ყველასთვის გაგზავნა'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Push ნოტიფიკაციები</Text>
            <Text style={styles.subtitle}>
              iPhone-ზე და შემდეგ Android-ზე გაგზავნა აქედან შეძლებ.
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => loadHistory(true)}>
            <Text style={styles.refreshButtonText}>{refreshing ? '...' : 'განახლება'}</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="სათაური"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor="#92a29c"
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="შეტყობინების ტექსტი"
          value={body}
          onChangeText={setBody}
          multiline
          placeholderTextColor="#92a29c"
        />

        <Text style={styles.label}>ვის გაეგზავნოს</Text>
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segment, targetType === 'all' && styles.segmentActive]}
            onPress={() => setTargetType('all')}
          >
            <Text
              style={[
                styles.segmentText,
                targetType === 'all' && styles.segmentTextActive,
              ]}
            >
              ყველას
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, targetType === 'user' && styles.segmentActive]}
            onPress={() => setTargetType('user')}
          >
            <Text
              style={[
                styles.segmentText,
                targetType === 'user' && styles.segmentTextActive,
              ]}
            >
              ერთ მომხმარებელს
            </Text>
          </TouchableOpacity>
        </View>

        {targetType === 'user' && (
          <TextInput
            style={styles.input}
            placeholder="მომხმარებლის UUID"
            value={targetUserId}
            onChangeText={setTargetUserId}
            placeholderTextColor="#92a29c"
          />
        )}

        <Text style={styles.label}>დაჭერისას სად გადავიდეს</Text>
        <View style={styles.chips}>
          {destinationOptions.map((option) => (
            <TouchableOpacity
              key={option.value || 'none'}
              style={[
                styles.chip,
                targetScreen === option.value && styles.chipActive,
              ]}
              onPress={() => setTargetScreen(option.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  targetScreen === option.value && styles.chipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendNotification}
          disabled={sending}
        >
          <Text style={styles.sendButtonText}>
            {sending ? 'იგზავნება...' : 'გაგზავნა'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>ბოლო გაგზავნები</Text>
        {!history.length ? (
          <Text style={styles.empty}>ჯერჯერობით არაფერია გაგზავნილი.</Text>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyItem}>
              <Text style={styles.historyTitle}>{item.title}</Text>
              <Text style={styles.historyBody}>{item.body}</Text>
              <Text style={styles.historyMeta}>
                სტატუსი: {item.status} • წარმატებული: {item.sent_count} • შეცდომა:{' '}
                {item.failed_count}
              </Text>
              <Text style={styles.historyMeta}>
                შექმნა: {formatDate(item.created_at)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  content: {
    paddingBottom: 120,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16352c',
  },
  subtitle: {
    color: '#6a7d76',
    marginTop: 4,
    lineHeight: 18,
  },
  refreshButton: {
    marginLeft: 12,
    backgroundColor: '#eff5f2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  refreshButtonText: {
    color: '#16352c',
    fontWeight: '800',
  },
  label: {
    color: '#4d625b',
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f8f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#16352c',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  segmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  segment: {
    width: '48%',
    backgroundColor: '#f5f8f6',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#16352c',
  },
  segmentText: {
    color: '#51655e',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#fff',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    backgroundColor: '#eff5f2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#16352c',
  },
  chipText: {
    color: '#486057',
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#fff',
  },
  sendButton: {
    backgroundColor: '#2e8b57',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  empty: {
    color: '#6a7d76',
    textAlign: 'center',
    paddingVertical: 24,
    fontWeight: '700',
  },
  historyItem: {
    borderTopWidth: 1,
    borderTopColor: '#edf2ef',
    paddingTop: 14,
    marginTop: 14,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16352c',
  },
  historyBody: {
    color: '#50645d',
    marginTop: 6,
    lineHeight: 20,
  },
  historyMeta: {
    color: '#81918c',
    marginTop: 6,
    fontSize: 12,
  },
  requestItem: {
    borderTopWidth: 1,
    borderTopColor: '#edf2ef',
    paddingTop: 14,
    marginTop: 14,
  },
  approveButton: {
    backgroundColor: '#2e8b57',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
});
