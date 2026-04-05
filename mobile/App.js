import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { useState } from 'react';

const USER_ID = '0f648430-04f9-4012-806b-f0806445ed6f'; // your UUID from earlier

export default function App() {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState([]);

  const searchContacts = async (text) => {
    setQuery(text);
    if (text.length < 1) return setContacts([]);
    try {
      const res = await fetch(`http://10.0.0.153:3000/contacts/search?user_id=${USER_ID}&q=${text}`);
      const data = await res.json();
      setContacts(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Been a Minute</Text>
      <TextInput
        style={styles.search}
        placeholder="Search contacts..."
        value={query}
        onChangeText={searchContacts}
      />
      <FlatList
        data={contacts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.contact}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.sub}>{item.cadence_days} day cadence</Text>
          </TouchableOpacity>
        )}
      />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 20, marginBottom: 16 },
  search: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16 },
  contact: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, color: '#888', marginTop: 2 },
});