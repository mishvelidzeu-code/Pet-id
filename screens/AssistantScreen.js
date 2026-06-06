import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AssistantScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.assistantCard}>
          <View style={styles.glowPrimary} />
          <View style={styles.glowSecondary} />

          <View style={styles.iconShell}>
            <View style={styles.iconInner}>
              <Ionicons name="sparkles" size={38} color="#ffffff" />
            </View>
          </View>

          <Text style={styles.eyebrow}>PET ID</Text>
          <Text style={styles.title}>ასისტენტი</Text>
          <Text style={styles.description}>
            მალე აქ დაემატება ჭკვიანი ასისტენტი, რომელიც დაგეხმარება ცხოველის მოვლის,
            პასპორტის, კლინიკების, სასტუმროების, ტაქსისა და პროდუქტების შერჩევაში.
          </Text>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.86}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#16352c" />
            <Text style={styles.actionText}>ჩატი მალე დაემატება</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            AI ასისტენტმა შეიძლება დაუშვას შეცდომები. ჯანმრთელობის საკითხებზე საბოლოო
            რჩევისთვის მიმართეთ ვეტერინარს.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f3f7f5',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 86,
  },
  assistantCard: {
    minHeight: 520,
    borderRadius: 34,
    backgroundColor: '#123a30',
    paddingHorizontal: 24,
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#0f241d',
    shadowOpacity: 0.24,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  glowPrimary: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(98, 230, 166, 0.2)',
    top: -82,
    right: -78,
  },
  glowSecondary: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    bottom: -78,
    left: -74,
  },
  iconShell: {
    width: 104,
    height: 104,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  iconInner: {
    width: 74,
    height: 74,
    borderRadius: 26,
    backgroundColor: '#2e8b57',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#9ed8bd',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    marginTop: 14,
    color: '#d7e8df',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButton: {
    marginTop: 24,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 210,
  },
  actionText: {
    marginLeft: 9,
    color: '#16352c',
    fontSize: 15,
    fontWeight: '900',
  },
  note: {
    marginTop: 22,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
