import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validate = () => {
    setErrorMsg('');
    if (!name.trim()) return "Name is required.";
    if (!email.trim() || !email.includes('@')) return "Please enter a valid email address.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  };

  async function signUpWithEmail() {
    const error = validate();
    if (error) {
      setErrorMsg(error);
      return;
    }
    
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: name.trim(),
        }
      }
    });

    if (signUpError) {
      setErrorMsg(signUpError.message);
    } else {
      // Supabase auto-logs in if email confirmation is disabled. We sign out immediately.
      await supabase.auth.signOut();
      alert('Sign up successful! Please sign in.');
      router.replace('/(auth)/sign-in');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <Text style={styles.welcomeText}>Join PinPoint</Text>
          <Text style={styles.subtitle}>Create your account to start your learning journey.</Text>
        </View>

        <View style={styles.formContainer}>
          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#FF4B4B" />
              <Text selectable style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
            />
          </View>

          <Text style={[styles.label, { marginTop: 20 }]}>Email</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="hello@example.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <Text style={[styles.label, { marginTop: 20 }]}>Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#999" style={styles.inputIconRight} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { marginTop: 20 }]}>Confirm Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#999" style={styles.inputIconRight} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.button} onPress={signUpWithEmail} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Signing up...' : 'Sign Up'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity><Text style={styles.linkText}>Sign In</Text></TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF4F4',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  headerContainer: {
    marginBottom: 40,
    marginTop: 40,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  formContainer: {
    gap: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderCurve: 'continuous',
  },
  errorText: {
    color: '#FF4B4B',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    height: 56,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  inputIcon: {
    marginRight: 12,
  },
  inputIconRight: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#333',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#8A7DFF',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    boxShadow: '0 4px 12px rgba(138, 125, 255, 0.3)',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 15,
  },
  linkText: {
    color: '#8A7DFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
