import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../src/AuthContext';
import { LogoHero } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { colors } from '../src/theme';

export default function RegisterScreen() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (password !== confirm) {
      Alert.alert('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await signup(email.trim(), password, name.trim() || undefined);
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Registration failed', e?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <LogoHero />
          <Text style={styles.h}>Create account</Text>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 8 characters"
          />
          <Field
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />
          <Button label="Create account" onPress={onSubmit} loading={loading} />
          <Link href="/login" style={styles.link}>
            Already have an account? Sign in
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 24, paddingTop: 48 },
  h: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  link: {
    marginTop: 16,
    textAlign: 'center',
    color: colors.primary,
    fontFamily: 'Nunito_700Bold',
  },
});
