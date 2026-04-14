import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Linking, ScrollView
} from 'react-native';
import { useState, useEffect } from 'react';
import * as Contacts from 'expo-contacts';

const USER_ID = '0f648430-04f9-4012-806b-f0806445ed6f';
const API = 'https://been-a-minute.onrender.com';

const AVATAR_COLORS = ['#FFB3C6', '#FFD6A5', '#CAFFBF', '#A0C4FF', '#BDB2FF', '#FFC6FF', '#9BF6FF', '#FDFFB6'];
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const GROUP_COLORS = {
  'Close circle': '#FF6B6B',
  'Family':       '#FF9F43',
  'Friends':      '#54A0FF',
  'Work':         '#5F27CD',
};

function getDaysAgo(dateString) {
  if (!dateString) return null;
  return Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
}

function getTimeLabel(contact) {
  const days = getDaysAgo(contact.last_contacted_at);
  if (days === null) return "haven't connected yet";
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days`;
  if (days < 30) { const w = Math.floor(days / 7); return `${w} ${w === 1 ? 'week' : 'weeks'}`; }
  if (days < 365) { const m = Math.floor(days / 30); return `${m} ${m === 1 ? 'month' : 'months'}`; }
  const y = Math.floor(days / 365); return `${y} ${y === 1 ? 'year' : 'years'}`;
}

function getUrgencyColor(contact) {
  const days = getDaysAgo(contact.last_contacted_at);
  if (days === null || days > contact.cadence_days) return '#FF8A80';
  if (days > contact.cadence_days * 0.75) return '#FFD180';
  return '#B9F6CA';
}

function getUrgencyRatio(contact) {
  const days = getDaysAgo(contact.last_contacted_at);
  if (days === null) return Infinity;
  return days / (contact.cadence_days || 30);
}

// Softer check-in action labels
const CHECKIN_ACTIONS = [
  { label: 'we caught up', value: 'caught_up' },
  { label: 'thinking of them', value: 'thinking' },
  { label: 'sent some love', value: 'sent_love' },
  { label: 'reached out', value: 'reached_out' },
  { label: 'still close', value: 'still_close' },
];

export default function App() {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showCheckinMenu, setShowCheckinMenu] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState([]);
  const [phoneQuery, setPhoneQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCadence, setNewCadence] = useState('30');
  const [newGroupId, setNewGroupId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    searchContacts('');
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API}/contacts/groups/list`);
      const data = await res.json();
      setGroups(data);
    } catch (err) {
      console.error(err);
    }
  };

  const searchContacts = async (text) => {
    setQuery(text);
    try {
      const res = await fetch(`${API}/contacts/search?user_id=${USER_ID}&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      const sorted = [...data].sort((a, b) => getUrgencyRatio(b) - getUrgencyRatio(a));
      setContacts(sorted);
    } catch (err) {
      console.error(err);
    }
  };

  const openContactPicker = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      alert("To import contacts, allow Been a Minute to access your contacts in Settings.");
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
    });
    const withPhones = data
      .filter(c => c.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    setPhoneContacts(withPhones);
    setPhoneQuery('');
    setShowContactPicker(true);
  };

  const pickPhoneContact = (contact) => {
    setNewName(contact.name);
    const phone = contact.phoneNumbers?.[0]?.number || '';
    setNewPhone(phone);
    setShowContactPicker(false);
    setShowAdd(true);
  };

  const checkIn = async (contact, method = 'manual') => {
    try {
      await fetch(`${API}/contacts/${contact.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: USER_ID, method }),
      });
      searchContacts(query);
      setSelectedContact(null);
      setShowCheckinMenu(false);
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
          group_id: newGroupId,
        }),
      });
      setShowAdd(false);
      setNewName(''); setNewPhone(''); setNewCadence('30'); setNewGroupId(null);
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

  const filteredPhoneContacts = phoneContacts.filter(c =>
    c.name?.toLowerCase().includes(phoneQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>been a minute</Text>
          <Text style={styles.subtitle}>a soft check on the people you care about</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder="search..."
        placeholderTextColor="#bbb"
        value={query}
        onChangeText={searchContacts}
      />

      <FlatList
        data={contacts}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => { setSelectedContact(item); setGeneratedMessage(''); }}>
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
              <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}</Text>
                {item.group_name && (
                  <View style={[styles.badge, { backgroundColor: (GROUP_COLORS[item.group_name] || '#888') + '22' }]}>
                    <Text style={[styles.badgeText, { color: GROUP_COLORS[item.group_name] || '#888' }]}>{item.group_name}</Text>
                  </View>
                )}
              </View>
              <View style={styles.timeRow}>
                <View style={[styles.dot, { backgroundColor: getUrgencyColor(item) }]} />
                <Text style={styles.timeText}>{getTimeLabel(item)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>no one here yet</Text>
            <Text style={styles.emptySubtitle}>add someone you want to stay close to</Text>
          </View>
        }
      />

      {/* ── Contact detail sheet ── */}
      <Modal visible={!!selectedContact} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            {selectedContact && (
              <>
                <View style={styles.contactHeader}>
                  <View style={[styles.avatarLarge, { backgroundColor: getAvatarColor(selectedContact.name) }]}>
                    <Text style={styles.avatarLargeText}>{selectedContact.name[0].toUpperCase()}</Text>
                  </View>
                  <Text style={styles.modalName}>{selectedContact.name}</Text>
                  <Text style={styles.modalTime}>{getTimeLabel(selectedContact)}</Text>
                  {selectedContact.group_name && (
                    <View style={[styles.badge, { backgroundColor: (GROUP_COLORS[selectedContact.group_name] || '#888') + '22', marginTop: 8 }]}>
                      <Text style={[styles.badgeText, { color: GROUP_COLORS[selectedContact.group_name] || '#888' }]}>{selectedContact.group_name}</Text>
                    </View>
                  )}
                </View>

                {generatedMessage ? (
                  <View style={styles.messageBox}>
                    <Text style={styles.messageText}>{generatedMessage}</Text>
                    <View style={styles.messageActions}>
                      <TouchableOpacity style={styles.regenerateBtn} onPress={() => generateMessage(selectedContact)}>
                        <Text style={styles.regenerateBtnText}>try again</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.sendBtn} onPress={() => openIMessage(selectedContact, generatedMessage)}>
                        <Text style={styles.sendBtnText}>send it →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.generateBtn} onPress={() => generateMessage(selectedContact)} disabled={generating}>
                    {generating ? <ActivityIndicator color="#1a1a1a" /> : <Text style={styles.generateBtnText}>✦ write me something to say</Text>}
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.checkInBtn} onPress={() => setShowCheckinMenu(true)}>
                  <Text style={styles.checkInBtnText}>mark a moment</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedContact(null)}>
                  <Text style={styles.cancelBtnText}>close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Check-in action menu ── */}
      <Modal visible={showCheckinMenu} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>what happened?</Text>
            <Text style={styles.checkinSubtitle}>no pressure — even a small moment counts</Text>
            {CHECKIN_ACTIONS.map(action => (
              <TouchableOpacity
                key={action.value}
                style={styles.checkinOption}
                onPress={() => checkIn(selectedContact, action.value)}
              >
                <Text style={styles.checkinOptionText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCheckinMenu(false)}>
              <Text style={styles.cancelBtnText}>nevermind</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add contact modal ── */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>add someone</Text>

            {/* Import from phone */}
            <TouchableOpacity style={styles.importBtn} onPress={openContactPicker}>
              <Text style={styles.importBtnText}>import from contacts</Text>
            </TouchableOpacity>

            <Text style={styles.orDivider}>or enter manually</Text>

            <Text style={styles.label}>name</Text>
            <TextInput style={styles.input} placeholder="fiona" placeholderTextColor="#ccc" value={newName} onChangeText={setNewName} />
            <Text style={styles.label}>phone (optional)</Text>
            <TextInput style={styles.input} placeholder="555-1234" placeholderTextColor="#ccc" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />

            <Text style={styles.label}>circle</Text>
            <View style={styles.groupRow}>
              {groups.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.groupChip, newGroupId === g.id && { backgroundColor: GROUP_COLORS[g.name] || '#888', borderColor: GROUP_COLORS[g.name] || '#888' }]}
                  onPress={() => setNewGroupId(newGroupId === g.id ? null : g.id)}
                >
                  <Text style={[styles.groupChipText, newGroupId === g.id && { color: '#fff' }]}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>reach out every __ days</Text>
            <TextInput style={styles.input} placeholder="30" placeholderTextColor="#ccc" value={newCadence} onChangeText={setNewCadence} keyboardType="number-pad" />

            <TouchableOpacity style={styles.saveBtn} onPress={addContact}>
              <Text style={styles.saveBtnText}>add them</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAdd(false); setNewName(''); setNewPhone(''); setNewGroupId(null); }}>
              <Text style={styles.cancelBtnText}>cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Phone contact picker ── */}
      <Modal visible={showContactPicker} animationType="slide" transparent>
        <SafeAreaView style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>your contacts</Text>
            <TouchableOpacity onPress={() => setShowContactPicker(false)}>
              <Text style={styles.pickerClose}>done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.pickerSearch}
            placeholder="search..."
            placeholderTextColor="#bbb"
            value={phoneQuery}
            onChangeText={setPhoneQuery}
            autoFocus
          />
          <FlatList
            data={filteredPhoneContacts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerRow} onPress={() => pickPhoneContact(item)}>
                <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
                  <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.pickerName}>{item.name}</Text>
                  {item.phoneNumbers?.[0] && (
                    <Text style={styles.pickerPhone}>{item.phoneNumbers[0].number}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>no contacts found</Text>}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8', paddingHorizontal: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#bbb', marginTop: 3 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '300', marginTop: -1 },

  search: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, marginBottom: 16, color: '#1a1a1a', borderWidth: 1, borderColor: '#F0F0F0' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  timeText: { fontSize: 13, color: '#aaa' },

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#ccc', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#ddd' },
  empty: { textAlign: 'center', color: '#bbb', marginTop: 40 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 44 },
  contactHeader: { alignItems: 'center', marginBottom: 24 },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarLargeText: { fontSize: 28, fontWeight: '600', color: '#1a1a1a' },
  modalName: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', letterSpacing: -0.3 },
  modalTime: { fontSize: 14, color: '#bbb', marginTop: 4 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 6, letterSpacing: -0.3 },
  checkinSubtitle: { fontSize: 13, color: '#bbb', marginBottom: 20 },

  generateBtn: { backgroundColor: '#F5F5F3', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  generateBtnText: { color: '#1a1a1a', fontSize: 15, fontWeight: '600' },
  messageBox: { backgroundColor: '#F9F9F7', borderRadius: 14, padding: 16, marginBottom: 10 },
  messageText: { fontSize: 15, color: '#1a1a1a', lineHeight: 23 },
  messageActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  regenerateBtn: { flex: 1, backgroundColor: '#eee', borderRadius: 10, padding: 10, alignItems: 'center' },
  regenerateBtnText: { fontSize: 13, color: '#888', fontWeight: '500' },
  sendBtn: { flex: 2, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 10, alignItems: 'center' },
  sendBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  checkInBtn: { backgroundColor: '#F5F5F3', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  checkInBtnText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },

  checkinOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F3' },
  checkinOptionText: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },

  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelBtnText: { color: '#ccc', fontSize: 14 },

  label: { fontSize: 12, fontWeight: '500', color: '#bbb', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FAFAF8', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a', borderWidth: 1, borderColor: '#F0F0F0' },
  saveBtn: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  importBtn: { backgroundColor: '#F0F0FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  importBtnText: { color: '#5F27CD', fontSize: 15, fontWeight: '600' },
  orDivider: { textAlign: 'center', color: '#ccc', fontSize: 13, marginVertical: 14 },

  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  groupChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#fff' },
  groupChipText: { fontSize: 13, color: '#888', fontWeight: '500' },

  pickerContainer: { flex: 1, backgroundColor: '#FAFAF8' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  pickerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  pickerClose: { fontSize: 16, color: '#5F27CD', fontWeight: '600' },
  pickerSearch: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1a1a1a', borderWidth: 1, borderColor: '#F0F0F0', marginBottom: 8 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 12 },
  pickerName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  pickerPhone: { fontSize: 13, color: '#aaa', marginTop: 2 },
});
