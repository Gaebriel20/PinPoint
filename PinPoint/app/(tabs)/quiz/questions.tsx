import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, Platform,
  TouchableOpacity, ScrollView, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';

export default function QuizQuestions() {
  const { quizId, questions: questionsParam, noteTitle } = useLocalSearchParams();
  const initialQuestions: any[] = questionsParam ? JSON.parse(questionsParam as string) : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(new Array(initialQuestions.length).fill(''));

  if (initialQuestions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.emptyMsg}>No questions found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.emptyBack}>
          <Text style={styles.emptyBackText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentQuestion = initialQuestions[currentIndex];
  const currentAnswer = answers[currentIndex];
  const progress = ((currentIndex + 1) / initialQuestions.length) * 100;
  const isAnswered = currentAnswer.trim().length > 0;

  const handleSelectOption = (option: string) => {
    const updated = [...answers];
    updated[currentIndex] = option;
    setAnswers(updated);
  };

  const handleTextChange = (text: string) => {
    const updated = [...answers];
    updated[currentIndex] = text;
    setAnswers(updated);
  };

  const handleNext = () => {
    if (currentIndex < initialQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace({
        pathname: '/quiz/results',
        params: {
          quizId,
          questions: JSON.stringify(initialQuestions),
          answers: JSON.stringify(answers),
          noteTitle,
        }
      });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#6366F1" />
          <Text style={styles.backLabel}>{(noteTitle as string) || 'Quiz'}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>Question {currentIndex + 1} of {initialQuestions.length}</Text>
          <Text style={styles.percentText}>{Math.round(progress)}% Complete</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Question Card */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
          <Text style={styles.questionSub}>
            {currentQuestion.type === 'multiple_choice'
              ? 'Select the most appropriate answer based on historical achievements and cultural impact across all eras.'
              : 'Provide a concise identification answer based on the context.'}
          </Text>
        </View>

        {/* Interaction Area */}
        {currentQuestion.type === 'multiple_choice' && currentQuestion.options ? (
          <View style={styles.optionsList}>
            {currentQuestion.options.map((option: string, idx: number) => {
              const isSelected = currentAnswer === option;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => handleSelectOption(option)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {option}
                  </Text>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type your answer here..."
              placeholderTextColor="#94A3B8"
              value={currentAnswer}
              onChangeText={handleTextChange}
              multiline
            />
          </View>
        )}
      </ScrollView>

      {/* Navigation Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navBtn, styles.prevBtn, currentIndex === 0 && styles.btnDisabled]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
        >
          <Text style={styles.prevBtnText}>Prev</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navBtn, styles.nextBtn, !isAnswered && styles.btnDisabled]}
          onPress={handleNext}
          disabled={!isAnswered}
        >
          <Text style={styles.nextBtnText}>
            {currentIndex === initialQuestions.length - 1 ? 'Finish' : 'Next'}
          </Text>
        </TouchableOpacity>
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
  emptyMsg: { textAlign: 'center', marginTop: 100, color: '#64748B', fontSize: 16 },
  emptyBack: { alignSelf: 'center', marginTop: 20, padding: 12, backgroundColor: '#FFF', borderRadius: 12 },
  emptyBackText: { color: '#6366F1', fontWeight: '700' },

  topBar: { paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, alignSelf: 'flex-start',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, gap: 8
  },
  backLabel: { fontSize: 15, fontWeight: '700', color: '#6366F1' },

  progressSection: { paddingHorizontal: 24, marginBottom: 24 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressText: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  percentText: { fontSize: 13, fontWeight: '700', color: '#6366F1' },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: '#818CF8', borderRadius: 3 },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

  questionCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 28, marginBottom: 28,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 20, elevation: 3
  },
  questionText: { fontSize: 24, fontWeight: '900', color: '#0F172A', lineHeight: 32, marginBottom: 16 },
  questionSub: { fontSize: 14, color: '#64748B', lineHeight: 22 },

  optionsList: { gap: 14 },
  optionCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 1
  },
  optionCardSelected: { borderColor: '#818CF8', backgroundColor: '#EEF2FF' },
  optionText: { fontSize: 16, fontWeight: '700', color: '#334155', flex: 1, marginRight: 12 },
  optionTextSelected: { color: '#4F46E5' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  radioSelected: { backgroundColor: '#6366F1', borderColor: '#6366F1' },

  inputContainer: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, minHeight: 160, elevation: 1 },
  textInput: { fontSize: 16, color: '#1E293B', textAlignVertical: 'top', minHeight: 120 },

  footer: { flexDirection: 'row', paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 120 : 110, paddingTop: 16, gap: 16, backgroundColor: '#F0F9FA' },
  navBtn: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  prevBtn: { backgroundColor: '#EEF2FF' },
  nextBtn: { backgroundColor: '#4F46E5' },
  btnDisabled: { opacity: 0.5 },
  prevBtnText: { color: '#6366F1', fontSize: 16, fontWeight: '800' },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
