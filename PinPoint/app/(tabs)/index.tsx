import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Platform, ActivityIndicator, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

type Note = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

export default function LandingPage() {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Audio Recorder Setup
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notes:', error.message);
      } else {
        setNotes(data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotes();

      const subscription = supabase
        .channel('public:notes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
          fetchNotes();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }, [])
  );

  const isFormValid = title.trim() !== '' && subject.trim().length >= 100;

  const handleMicPress = async () => {
    if (recorderState.isRecording) {
      await recorder.stop();
      setIsTranscribing(true);

      try {
        const formData = new FormData();

        if (!recorder.uri) {
          alert('Recording failed: No audio URI found.');
          setIsTranscribing(false);
          return;
        }

        if (Platform.OS === 'web') {
          const fetchResponse = await fetch(recorder.uri);
          const blob = await fetchResponse.blob();
          formData.append('file', blob, 'audio.webm');
        } else {
          formData.append('file', {
            uri: recorder.uri,
            name: 'audio.m4a',
            type: 'audio/m4a'
          } as any);
        }

        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch('https://rxmzlciusnnqsqukxpjt.supabase.co/functions/v1/transcribe', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: formData
        });

        const result = await response.json();
        if (result.text) {
          setSubject((prev) => prev + (prev ? ' ' : '') + result.text);
        } else {
          alert(result.error || 'Failed to transcribe audio.');
        }
      } catch (e: any) {
        alert('Transcription failed: ' + e.message);
      }
      setIsTranscribing(false);
    } else {
      try {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          alert('Microphone permission required to use speech-to-text.');
          return;
        }
        
        // Ensure iOS allows recording
        if (Platform.OS === 'ios') {
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        }

        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch (err: any) {
        console.error("Recording start error:", err);
        alert('Failed to start microphone: ' + err.message);
      }
    }
  };

  const handleAddNote = async () => {
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in to add a note.");
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('notes')
      .insert([
        {
          user_id: user.id,
          title: title.trim(),
          content: subject.trim()
        }
      ])
      .select()
      .single();

    if (error) {
      alert('Error saving note: ' + error.message);
    } else if (data) {
      setNotes([data, ...notes]);
      setTitle('');
      setSubject('');

      // Automatically generate quiz in the background
      (async () => {
        try {
          const { data: result, error: invokeError } = await supabase.functions.invoke('generate-quiz', {
            body: { content: data.content }
          });
          
          if (!invokeError && result.questions) {
            await supabase
              .from('quizzes')
              .insert([{ note_id: data.id, generated_questions: result.questions }]);
          }
        } catch (e) {
          console.error('Auto quiz generation failed:', e);
        }
      })();
    }
    setIsSubmitting(false);
  };

  const executeDelete = async (noteId: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      if (error) throw error;
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (e: any) {
      alert('Error deleting note: ' + e.message);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to delete this note and its associated quizzes?")) {
        executeDelete(noteId);
      }
    } else {
      Alert.alert(
        "Delete Note",
        "Are you sure you want to delete this note and its associated quizzes?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => executeDelete(noteId) }
        ]
      );
    }
  };

  const isInputDisabled = recorderState.isRecording || isTranscribing || isSubmitting;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity>
            <Ionicons name="menu" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PinPoint</Text>
          <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={20} color="#FF4B4B" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputSection}>
          <TextInput
            style={styles.inputTitle}
            placeholder="Title here"
            value={title}
            onChangeText={setTitle}
            editable={!isInputDisabled}
            placeholderTextColor="#999"
          />

          <View style={styles.subjectContainer}>
            <TextInput
              style={styles.inputSubject}
              placeholder="Subject here (minimum 100 characters)"
              value={subject}
              onChangeText={setSubject}
              multiline
              editable={!isInputDisabled}
              placeholderTextColor="#999"
            />

            <View style={styles.subjectActions}>
              <TouchableOpacity
                style={[styles.micButton, recorderState.isRecording && styles.micButtonRecording]}
                onPress={handleMicPress}
                disabled={isTranscribing || isSubmitting}
              >
                {isTranscribing ? (
                  <ActivityIndicator color="#8A7DFF" size="small" />
                ) : (
                  <Ionicons name={recorderState.isRecording ? "stop" : "mic"} size={20} color={recorderState.isRecording ? "#FFF" : "#8A7DFF"} />
                )}
              </TouchableOpacity>
              <Text style={[styles.charCount, subject.length >= 100 ? styles.charCountValid : null]}>
                {subject.length}/100
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addButton, !isFormValid && styles.addButtonDisabled]}
          onPress={handleAddNote}
          disabled={!isFormValid || isInputDisabled}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#8A7DFF" />
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color={isFormValid ? "#8A7DFF" : "#A0A0A0"} style={styles.addIcon} />
              <Text style={[styles.addButtonText, !isFormValid && styles.addButtonTextDisabled]}>Add Note</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>My Notes</Text>

        {loading ? (
          <ActivityIndicator color="#8A7DFF" style={{ marginTop: 20 }} />
        ) : notes.length === 0 ? (
          <Text style={styles.emptyText}>No notes yet. Create your first note above!</Text>
        ) : (
          <View style={styles.notesList}>
            {notes.map(note => (
              <TouchableOpacity key={note.id} style={styles.noteCard} onPress={() => setSelectedNote(note)}>
                <View style={styles.noteHeader}>
                  <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
                  <TouchableOpacity onPress={() => handleDeleteNote(note.id)} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={20} color="#FF4B4B" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.notePreview} numberOfLines={2}>{note.content}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Full Note Modal */}
      <Modal
        visible={!!selectedNote}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedNote(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalDate}>
                {selectedNote ? new Date(selectedNote.created_at).toLocaleDateString() : ''}
              </Text>
              <TouchableOpacity onPress={() => setSelectedNote(null)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalTitle}>{selectedNote?.title}</Text>
              <Text style={styles.modalText}>{selectedNote?.content}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EAF4F4',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
    letterSpacing: -0.5,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputTitle: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 18,
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  subjectContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 18,
    minHeight: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  inputSubject: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingRight: 12,
    textAlignVertical: 'top',
    minHeight: 120,
    lineHeight: 24,
  },
  subjectActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0EFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonRecording: {
    backgroundColor: '#FF4B4B',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: 8,
  },
  charCountValid: {
    color: '#34C759',
  },
  addButton: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    borderCurve: 'continuous',
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  addButtonDisabled: {
    backgroundColor: '#F9F9F9',
    boxShadow: 'none',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  addIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: '#8A7DFF',
    fontSize: 17,
    fontWeight: '700',
  },
  addButtonTextDisabled: {
    color: '#A0A0A0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333',
    marginBottom: 20,
  },
  emptyText: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 20,
  },
  notesList: {
    gap: 16,
  },
  noteCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  noteTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginRight: 12,
  },
  deleteButton: {
    padding: 2,
    marginLeft: 8,
  },
  notePreview: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: 'continuous',
    height: '85%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalDate: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 26,
  },
});
