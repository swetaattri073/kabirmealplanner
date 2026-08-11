import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { colors, radii } from '../src/theme';

type Msg = { role: 'user' | 'assistant'; text: string };

export default function ChatScreen() {
  const { activeToddler } = useAuth();
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'assistant',
      text: 'Ask about meals, picky eating, or nutrition for your toddler.',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const data = await api.chat({
        message: text,
        toddler_id: activeToddler?.ref,
      });
      const reply =
        data.reply || data.message || data.response || 'Sorry, I could not answer that.';
      setMsgs((m) => [...m, { role: 'assistant', text: reply }]);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: e?.message || 'Chat is unavailable right now.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Ask LittleBowl" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <FlatList
          data={msgs}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.user : styles.assistant,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' && { color: colors.white },
                ]}
              >
                {item.text}
              </Text>
            </View>
          )}
        />
        <View style={styles.composer}>
          <Field
            label="Message"
            value={input}
            onChangeText={setInput}
            placeholder="e.g. Ideas for iron-rich dinner?"
          />
          <Button label="Send" onPress={send} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 8 },
  bubble: {
    maxWidth: '88%',
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 10,
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontFamily: 'Nunito_400Regular',
    color: colors.text,
  },
  composer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
