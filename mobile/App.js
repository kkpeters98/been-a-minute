import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { useState, useEffect } from 'react';

const USER_ID = '0f648430-04f9-4012-806b-f0806445ed6f';

const GROUP_COLORS = {
  'Close circle': '#FF6B6B',
  'Family': '#FF9F43',
  'Friends': '#54A0FF',
  'Work': '#5F27CD',
};

function getDaysAgo(dateString) {
  if (!dateString) return null;
  const diff = Date.now() - new Date(dateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getDaysLabel(contact) {
  const days = getDaysAgo(contact.last_contacted_at);
  if (days === null) return 'Never reached out';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function getUrgencyColor(contact) {
  const days = getDaysAgo(contact.last_contacted_at);
  if (days === null || days > contact.cadence_days) return '#FF6B6B';
  if (days > contact.cadence_days * 0.75) return '#FF9F43';
  return '#2ecc71';
}

export default function App() {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState([]);

  const searchContacts = async (text) => {
    setQuery(text);
    try {
      const res = await fetch(`http://10.0.0.153:3000/contacts/search?user_id=${USER_ID}&q=${text}`);
      const data = await res.json();
      setContacts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    searchContacts('');
  }, []);

  const checkIn = async (contact) => {
    try {
      await fetch(`http://10.0.0.153:3000/contacts/${contact.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: USER_ID, method: 'manual' }),
      });
      searchContacts(query);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Been a Minute</Text>
      <Text style={styles.subtitle}>Stay close to the people that matter</Text>

      <TextInput
        style={styles.search}
        placeholder="🔍  Search contacts..."
        placeholderTextColor="#aaa"
        value={query}
        onChangeText={searchContacts}
      />

      <FlatList
        data={contacts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}</Text>
                {item.group_name && (
                  <View style={[styles.badge, { backgroundColor: GROUP_COLORS[item.group_name] || '#888' }]}>
                    <Text style={styles.badgeText}>{item.group_name}</Text>
                  </View>
                )}
              </View>
              <View style={styles.timeRow}>
                <View style={[styles.dot, { backgroundColor: getUrgencyColor(item) }]} />
                <Text style={styles.timeText}>{getDaysLabel(item)}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.checkInBtn} onPress={() => checkIn(item)}>
              <Text style={styles.checkInText}>✓</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No contacts yet!</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8', paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '800', marginTop: 20, color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#aaa', marginBottom: 20, marginTop: 4 },
  search: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#555' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  timeText: { fontSize: 13, color: '#888' },
  checkInBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2ecc71',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#bbb', marginTop: 60, fontSize: 15 },
});