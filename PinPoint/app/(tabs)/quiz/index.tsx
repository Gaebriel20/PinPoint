import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  Platform, TouchableOpacity, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useFocusEffect, router } from 'expo-router';

type Note = { id: string; title: string; content: string; created_at: string; };
type QuizData = { id: string; note_id: string; generated_questions: any[]; };
type Attempt = { quiz_id: string; score: number; created_at: string; };
type StatusResult = { text: string; type: string; score?: number };

export default function QuizDashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, QuizData>>({});
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [loading, setLoading] = useState(true);
  const [assessingNoteId, setAssessingNoteId] = useState<string | null>(null);
  const [insufficientContextIds, setInsufficientContextIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: notesData } = await supabase
        .from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (notesData) setNotes(notesData);

      const { data: quizzesData } = await supabase.from('quizzes').select('*');
      const quizzesMap: Record<string, QuizData> = {};
      if (quizzesData) quizzesData.forEach(q => { quizzesMap[q.note_id] = q; });
      setQuizzes(quizzesMap);

      const { data: attemptsData } = await supabase
        .from('quiz_attempts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      const attemptsMap: Record<string, Attempt[]> = {};
      if (attemptsData) {
        attemptsData.forEach(a => {
          if (!attemptsMap[a.quiz_id]) attemptsMap[a.quiz_id] = [];
          attemptsMap[a.quiz_id].push(a);
        });
      }
      setAttempts(attemptsMap);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const handleTakeQuiz = async (note: Note, existingQuiz?: QuizData) => {
    if (insufficientContextIds.has(note.id)) { 
      alert("This note doesn't have enough content to generate a quiz. Please add at least 30 words to this note.");
      return; 
    }

    if (existingQuiz) {
      router.push({
        pathname: '/quiz/questions',
        params: { quizId: existingQuiz.id, questions: JSON.stringify(existingQuiz.generated_questions), noteTitle: note.title }
      });
      return;
    }

    setAssessingNoteId(note.id);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('generate-quiz', {
        body: { content: note.content }
      });
      
      if (invokeError) {
        // Try to extract the specific error message from the response body
        let msg = invokeError.message;
        try {
          const body = await invokeError.context.json();
          if (body && body.error) msg = body.error;
        } catch (e) {
          // If body is not JSON, use the default message
        }
        alert('Error: ' + msg);
        setAssessingNoteId(null);
        return;
      }

      if (result.error === 'insufficient_context') {
        setInsufficientContextIds(prev => new Set(prev).add(note.id));
        alert("Note is too short! We need a bit more information (about 30 words) to create a meaningful quiz for you.");
      } else if (result.questions) {
        const { data: newQuiz } = await supabase
          .from('quizzes').insert([{ note_id: note.id, generated_questions: result.questions }]).select().single();
        if (newQuiz) {
          router.push({
            pathname: '/quiz/questions',
            params: { quizId: newQuiz.id, questions: JSON.stringify(result.questions), noteTitle: note.title }
          });
        }
      } else {
        alert('Failed to generate quiz. ' + (result.error || 'Please try again.'));
      }
    } catch (error: any) {
      alert('Error generating quiz: ' + error.message);
    } finally {
      setAssessingNoteId(null);
    }
  };

  const getStatusDisplay = (noteId: string): StatusResult => {
    const quiz = quizzes[noteId];
    if (!quiz) return { text: 'New content available', type: 'new' };

    const quizAttempts = attempts[quiz.id];
    if (!quizAttempts || quizAttempts.length === 0) return { text: 'Not started', type: 'pending' };

    const latestAttempt = quizAttempts[0];
    if (latestAttempt.score >= 100) return { text: 'Completed', type: 'completed' };

    const attemptDate = new Date(latestAttempt.created_at);
    const diffDays = Math.ceil(Math.abs(Date.now() - attemptDate.getTime()) / (1000 * 60 * 60 * 24));
    const label = diffDays <= 3 ? `Last played ${diffDays}d ago` : `${latestAttempt.score}%`;
    return { text: label, type: 'progress', score: latestAttempt.score };
  };

  const getIconForTitle = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('program') || t.includes('code')) return 'code-slash';
    if (t.includes('history')) return 'time';
    if (t.includes('math') || t.includes('calculus')) return 'calculator';
    if (t.includes('french') || t.includes('vocab') || t.includes('language')) return 'globe';
    return 'document-text';
  };

  const inProgressCount = Object.keys(quizzes).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.menuBtn}>
            <Ionicons name="menu" size={24} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PinPoint</Text>
          <TouchableOpacity style={styles.profileButton}>
            <Ionicons name="person" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroTitle}>My Quizzes</Text>
            <Text style={styles.heroSubtitle}>{inProgressCount} quizzes in progress</Text>
          </View>
          <View style={styles.heroIconBox}>
            <Ionicons name="sparkles" size={24} color="#6366F1" />
          </View>
        </View>

        {/* List Section */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#6366F1" size="large" />
          </View>
        ) : notes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Create a note to see your quizzes here!</Text>
          </View>
        ) : (
          <View style={styles.quizList}>
            {notes.map(note => {
              const status = getStatusDisplay(note.id);
              const isAssessing = assessingNoteId === note.id;
              const isInsufficient = insufficientContextIds.has(note.id);
              const quiz = quizzes[note.id];
              const isProgress = status.type === 'progress';
              const iconName = getIconForTitle(note.title);

              return (
                <TouchableOpacity
                  key={note.id}
                  style={[styles.card, isProgress && styles.cardProgress]}
                  onPress={() => handleTakeQuiz(note, quiz)}
                  disabled={isAssessing}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconContainer, isProgress && styles.iconContainerActive]}>
                    <Ionicons name={iconName as any} size={20} color={isProgress ? '#FFF' : '#94A3B8'} />
                  </View>

                  <View style={styles.info}>
                    <Text style={[styles.cardTitle, isProgress && styles.cardTitleActive]} numberOfLines={1}>
                      {note.title || 'Untitled'}
                    </Text>
                    
                    {isInsufficient ? (
                      <Text style={styles.insufficientLabel}>More detail needed</Text>
                    ) : isProgress ? (
                      <View style={styles.progressWrapper}>
                        <View style={styles.barBg}>
                          <View style={[styles.barFill, { width: `${status.score}%` }]} />
                        </View>
                        <Text style={styles.pctText}>{status.score}%</Text>
                      </View>
                    ) : (
                      <Text style={styles.statusLabel}>{status.text}</Text>
                    )}
                  </View>

                  <View style={styles.action}>
                    {isAssessing ? (
                      <ActivityIndicator size="small" color="#6366F1" />
                    ) : (
                      <Ionicons name="pencil" size={18} color="#CBD5E1" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F9FA',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  menuBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  profileButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },

  heroCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#1A1A2E', marginBottom: 4 },
  heroSubtitle: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  heroIconBox: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },

  loadingBox: { marginTop: 100, alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 80, opacity: 0.6 },
  emptyText: { textAlign: 'center', color: '#64748B', fontSize: 15, marginTop: 16, maxWidth: 220 },

  quizList: { gap: 16 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardProgress: {
    borderColor: '#C7D2FE',
    backgroundColor: '#FFF',
    shadowColor: '#6366F1',
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  iconContainer: {
    width: 50, height: 50, borderRadius: 15,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 16,
  },
  iconContainerActive: { backgroundColor: '#6366F1' },
  
  info: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  cardTitleActive: { color: '#6366F1' },
  statusLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  insufficientLabel: { fontSize: 13, color: '#EAB308', fontWeight: '700' },

  progressWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barBg: { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, maxWidth: 100 },
  barFill: { height: 6, backgroundColor: '#6366F1', borderRadius: 3 },
  pctText: { fontSize: 12, fontWeight: '800', color: '#6366F1' },

  action: { paddingLeft: 8 },
});
