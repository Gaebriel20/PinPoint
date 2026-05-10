import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, Platform,
  TouchableOpacity, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../../lib/supabase';

export default function QuizResults() {
  const { quizId, questions: questionsParam, answers: answersParam, noteTitle } = useLocalSearchParams();
  const questions: any[] = questionsParam ? JSON.parse(questionsParam as string) : [];
  const answers: string[] = answersParam ? JSON.parse(answersParam as string) : [];

  const [saving, setSaving] = useState(true);

  let correctCount = 0;
  const results = questions.map((q, i) => {
    const userAns = (answers[i] || '').toString().trim().toLowerCase();
    const correctAns = (q.answer || '').toString().trim().toLowerCase();
    const isCorrect =
      userAns === correctAns ||
      (q.type === 'identification' && correctAns.includes(userAns) && userAns.length > 3);
    if (isCorrect) correctCount++;
    return { ...q, userAnswer: answers[i], isCorrect };
  });

  const total = questions.length;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const isPerfect = correctCount === total;
  const passed = percentage >= 70;

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !quizId) return;
        const { data: attempt, error: aErr } = await supabase
          .from('quiz_attempts')
          .insert([{ user_id: user.id, quiz_id: quizId, score: percentage }])
          .select().single();
        if (attempt && !aErr) {
          const answerInserts = results.map(r => ({
            attempt_id: attempt.id,
            question: r.question,
            user_answer: r.userAnswer || '',
            correct_answer: r.answer,
            is_correct: r.isCorrect,
          }));
          await supabase.from('quiz_answers').insert(answerInserts);
        }
      } catch (err) {
        console.error('Error saving quiz results:', err);
      } finally {
        setSaving(false);
      }
    })();
  }, []);

  const handleRetry = () => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    router.replace({
      pathname: '/quiz/questions',
      params: { quizId, questions: JSON.stringify(shuffled), noteTitle }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons name="menu" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PinPoint</Text>
        <TouchableOpacity style={styles.profileBtn}>
          <Ionicons name="person" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreTop}>
            <Text style={styles.scoreLabel}>FINAL SCORE</Text>
            <View style={styles.trophyBox}>
              <Ionicons name="trophy" size={40} color="rgba(255,255,255,0.3)" />
            </View>
          </View>
          <Text style={styles.scoreValue}>{correctCount}/{total}</Text>
          <Text style={styles.scoreMsg}>
            {isPerfect ? 'Perfect Score!' : passed ? 'Great Job!' : 'Keep Practicing!'}
          </Text>
        </View>

        {/* History */}
        <Text style={styles.sectionTitle}>Question History</Text>
        <View style={styles.historyCard}>
          {results.map((res, idx) => (
            <View key={idx} style={[styles.historyRow, idx < results.length - 1 && styles.rowBorder]}>
              <View style={styles.historyLeft}>
                <View style={[styles.statusIcon, res.isCorrect ? styles.iconBgCorrect : styles.iconBgWrong]}>
                  <Ionicons 
                    name={res.isCorrect ? "checkmark" : "close"} 
                    size={16} 
                    color={res.isCorrect ? "#10B981" : "#EF4444"} 
                  />
                </View>
                <Text style={styles.historyText} numberOfLines={1}>
                  {idx + 1}. {res.question}
                </Text>
              </View>
              <Text style={[styles.badge, res.isCorrect ? styles.badgeCorrect : styles.badgeWrong]}>
                {res.isCorrect ? 'Correct' : 'Incorrect'}
              </Text>
            </View>
          ))}

          <TouchableOpacity style={styles.viewAll}>
            <Text style={styles.viewAllText}>View All {total} Questions</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {saving ? (
          <ActivityIndicator color="#6366F1" size="large" />
        ) : (
          <>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryText}>Retry Quiz</Text>
              <Ionicons name="refresh" size={18} color="#FFF" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/quiz')}>
              <Text style={styles.homeText}>Back to Home</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F9FA',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16
  },
  menuBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  scoreCard: {
    backgroundColor: '#8B8FF8', borderRadius: 28, padding: 32, alignItems: 'center',
    marginBottom: 32, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 8
  },
  scoreTop: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 8 },
  scoreLabel: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 1.5, opacity: 0.9 },
  trophyBox: { width: 64, height: 64, position: 'absolute', right: -10, top: -10 },
  scoreValue: { fontSize: 72, fontWeight: '900', color: '#FFF', letterSpacing: -2 },
  scoreMsg: { fontSize: 18, color: '#FFF', fontWeight: '700', marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginBottom: 16 },
  historyCard: {
    backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 3
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  statusIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  iconBgCorrect: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  iconBgWrong: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  historyText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#334155' },
  badge: { fontSize: 12, fontWeight: '800' },
  badgeCorrect: { color: '#10B981' },
  badgeWrong: { color: '#EF4444' },

  viewAll: { alignItems: 'center', paddingVertical: 20 },
  viewAllText: { color: '#6366F1', fontSize: 14, fontWeight: '800' },

  footer: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 120 : 110, paddingTop: 16, gap: 14 },
  retryBtn: { backgroundColor: '#4F46E5', height: 58, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  retryText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  homeBtn: { backgroundColor: '#FFF', height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0' },
  homeText: { color: '#6366F1', fontSize: 16, fontWeight: '800' },
});
