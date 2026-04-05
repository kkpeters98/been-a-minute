import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, SafeAreaView, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Linking } from 'react-native';
import { useState, useEffect } from 'react';

const USER_ID = '0f648430-04f9-4012-806b-f0806445ed6f';
const API = 'http://10.0.0.153:3000';

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
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCadence, setNewCadence] = useState('30');
  const [selectedContact, setSelectedContact] = useState(null);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  const searchContacts = async (text) => {
    setQuery(text);
    try {
      const res = await fetch(`${API}/contacts/search?user_id=${USER_ID}&q=${text}`);
      const data = await res.json();
      setContacts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { searchContacts(''); }, []);

  const checkIn = async (contact) => {
    try {
      await fetch(`${API}/contacts/${contact.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: USER_ID, method: 'manual' }),
      });
      searchContacts(query);
      setSelectedContact(null);
    } catch (err) {
      console.error(err);
    }
  };

  const addContact = async () => {
    if (!newName.trim()) return;
    try {
      await fetch(`${API}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: USER_ID,
          name: newName.trim(),
          phone: newPhone.trim(),
          cadence_days: parseInt(newCadence) || 30,
        }),
      });
      setShowAdd(false);
      setNewName(''); setNewPhone(''); setNewCadence('30');
      searchContacts('');
    } catch (err) {
      console.error(err);
    }
  };

  const generateMessage = async (contact) => {
    setGenerating(true);
    setGeneratedMessage('');
    try {
      const res = await fetch(`${API}/messages/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: USER_ID, contact_id: contact.id }),
      });
      const data = await res.json();
      setGeneratedMessage(data.message);
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
  };

  const openIMessage = (contact, message) => {
    const phone = contact.phone?.replace(/\D/g, '');
    const url = phone
      ? `sms:${phone}&body=${encodeURIComponent(message)}`
      : `sms:&body=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Been a Minute</Text>
          <Text style={styles.subtitle}>Stay close to the people that matter</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

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
          <TouchableOpacity style={styles.card} onPress={() => { setSelectedContact(item); setGeneratedMessage(''); }}>
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
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No contacts yet — add one!</Text>}
      />

      {/* Contact Action Sheet */}
      <Modal visible={!!selectedContact} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            {selectedContact && (
              <>
                <View style={styles.contactHeader}>
                  <View style={styles.avatarLarge}>
                    <Text style={styles.avatarLargeText}>{selectedContact.name[0].toUpperCase()}</Text>
                  </View>
                  <Text style={styles.modalName}>{selectedContact.name}</Text>
                  <Text style={styles.modalTime}>{getDaysLabel(selectedContact)}</Text>
                </View>

                {generatedMessage ? (
                  <View style={styles.messageBox}>
                    <Text style={styles.messageText}>{generatedMessage}</Text>
                    <View style={styles.messageActions}>
                      <TouchableOpacity style={styles.regenerateBtn} onPress={() => generateMessage(selectedContact)}>
                        <Text style={styles.regenerateBtnText}>↻ Regenerate</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.sendBtn} onPress={() => openIMessage(selectedContact, generatedMessage)}>
                        <Text style={styles.sendBtnText}>Send in iMessage →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.generateBtn}
                    onPress={() => generateMessage(selectedContact)}
                    disabled={generating}
                  >
                    {generating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.generateBtnText}>✨ Generate message</Text>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.checkInBtn} onPress={() => checkIn(selectedContact)}>
                  <Text style={styles.checkInBtnText}>✓ Log check-in</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedContact(null)}>
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Contact Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add contact</Text>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} placeholder="Fiona" value={newName} onChangeText={setNewName} autoFocus />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} placeholder="555-1234" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />
            <Text style={styles.label}>Reach out every (days)</Text>
            <TextInput style={styles.input} placeholder="30" value={newCadence} onChangeText={setNewCadence} keyboardType="number-pad" />
            <TouchableOpacity style={styles.saveBtn} onPress={addContact}>
              <Text style={styles.saveBtnText}>Add contact</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8', paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#aaa', marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
  search: { backgroundColor: '#fff', borderRadius: 14, padding: 14, fontSize: 15, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#555' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  timeText: { fontSize: 13, color: '#888' },
  empty: { textAlign: 'center', color: '#bbb', marginTop: 60, fontSize: 15 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  contactHeader: { alignItems: 'center', marginBottom: 24 },
  avatarLarge: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarLargeText: { fontSize: 28, fontWeight: '700', color: '#555' },
  modalName: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  modalTime: { fontSize: 14, color: '#aaa', marginTop: 4 },
  generateBtn: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  messageBox: { backgroundColor: '#f8f8f8', borderRadius: 14, padding: 16, marginBottom: 12 },
  messageText: { fontSize: 15, color: '#1a1a1a', lineHeight: 22 },
  messageActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  regenerateBtn: { flex: 1, backgroundColor: '#eee', borderRadius: 10, padding: 10, alignItems: 'center' },
  regenerateBtnText: { fontSize: 13, color: '#555', fontWeight: '600' },
  sendBtn: { flex: 2, backgroundColor: '#2ecc71', borderRadius: 10, padding: 10, alignItems: 'center' },
  sendBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  checkInBtn: { backgroundColor: '#f0f0f0', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  checkInBtnText: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  cancelBtn: { alignItems: 'center', padding: 8 },
  cancelBtnText: { color: '#aaa', fontSize: 15 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#f8f8f8', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a' },
  saveBtn: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});