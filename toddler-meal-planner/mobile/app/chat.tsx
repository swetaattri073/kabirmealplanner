import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { api } from '../src/api';
import { useAuth } from '../src/AuthContext';
import {
  clearChatSession,
  getChatCount,
  getChatSession,
  incrementChatCount,
  setChatSession,
} from '../src/storage';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Screen } from '../src/components/ui';
import { colors, radii } from '../src/theme';

const GUEST_LIMIT = 5;
const USER_DAILY_LIMIT = 20;

type Msg = { role: 'user' | 'assistant'; text: string };

// The server may answer with a flat string or an OpenAI-style {role, content}
// object; anything non-string reaching a <Text> child crashes the renderer.
const replyText = (data: any): string => {
  const candidate = data?.reply ?? data?.message ?? data?.response;
  if (typeof candidate === 'string') return candidate;
  if (typeof candidate?.content === 'string') return candidate.content;
  return 'Sorry, I could not answer that.';
};

const SUGGESTIONS = [
  'What iron-rich foods can I give?',
  'Ideas for picky eaters',
  'Is honey safe for my toddler?',
  'Healthy breakfast ideas',
  'How much milk should a 2-year-old drink?',
];

export default function ChatScreen() {
  const { activeToddler, user, authenticated } = useAuth();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatAvailable, setChatAvailable] = useState<boolean | null>(null);
  const [summary, setSummary] = useState('');
  const [dailyCount, setDailyCount] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(authenticated ? USER_DAILY_LIMIT : GUEST_LIMIT);
  const [limitReached, setLimitReached] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isGuest = !authenticated;
  const toddlerRef = activeToddler?.ref ?? null;

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setMsgs([]);
      setSummary('');
    }, 15 * 60 * 1000);
  }, []);

  // Restore the conversation for this toddler. getChatSession drops anything
  // older than the 15 minute idle window, so a stale thread never comes back.
  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    (async () => {
      const session = await getChatSession(toddlerRef);
      if (cancelled) return;
      setMsgs(session.messages);
      setSummary(session.summary);
      setHydrated(true);
      if (session.messages.length) resetIdleTimer();
    })();
    return () => {
      cancelled = true;
    };
  }, [toddlerRef, resetIdleTimer]);

  // Emptying state is also how the idle timeout expires a thread, so treating
  // "nothing left" as a delete keeps the timer from needing its own cleanup.
  useEffect(() => {
    if (!hydrated) return;
    if (!msgs.length && !summary) {
      clearChatSession(toddlerRef);
      return;
    }
    setChatSession(toddlerRef, { messages: msgs, summary });
  }, [hydrated, toddlerRef, msgs, summary]);

  // The server owns the allowance and counts per device, so a reinstall can't
  // reset it. The on-device tally is only a fallback for builds pointed at a
  // backend that predates server-side metering.
  const applyUsage = useCallback(
    (usage: any, fallbackCount?: number) => {
      const max =
        typeof usage?.limit === 'number' ? usage.limit : isGuest ? GUEST_LIMIT : USER_DAILY_LIMIT;
      const count = typeof usage?.count === 'number' ? usage.count : fallbackCount ?? 0;
      setDailyLimit(max);
      setDailyCount(count);
      setLimitReached(count >= max);
    },
    [isGuest],
  );

  useEffect(() => {
    (async () => {
      try {
        const [health, chatCount] = await Promise.all([
          api.chatHealth().catch(() => ({ available: true })),
          getChatCount(),
        ]);
        setChatAvailable(health?.available !== false && health?.enabled !== false);
        applyUsage(health?.usage, chatCount.count);
      } catch {
        setChatAvailable(false);
      }
    })();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [isGuest, applyUsage]);

  const compactHistory = useCallback(async (messages: Msg[]) => {
    if (messages.length <= 10) return;
    const older = messages.slice(0, messages.length - 6);
    try {
      const res = await api.chatSummarize({
        messages: older.map((m) => ({ role: m.role, content: m.text })),
        existing_summary: summary,
      });
      if (res?.summary) {
        setSummary(res.summary);
        setMsgs(messages.slice(messages.length - 6));
      }
    } catch {}
  }, [summary]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;

    const limit = dailyLimit;
    if (dailyCount >= limit) {
      setLimitReached(true);
      if (isGuest) {
        setMsgs((m) => [
          ...m,
          {
            role: 'assistant',
            text: `You've reached the ${limit}-message limit for guest users today. Sign in or create an account to get ${USER_DAILY_LIMIT} messages per day!`,
          },
        ]);
      } else {
        setMsgs((m) => [
          ...m,
          {
            role: 'assistant',
            text: `You've reached your daily limit of ${limit} messages. Premium users will have unlimited access — stay tuned!`,
          },
        ]);
      }
      return;
    }

    setInput('');
    const newMsgs: Msg[] = [...msgs, { role: 'user', text: msg }];
    setMsgs(newMsgs);
    setLoading(true);
    resetIdleTimer();

    const local = await incrementChatCount();
    setDailyCount(local.count);
    if (local.count >= limit) setLimitReached(true);

    try {
      const data = await api.chat({
        message: msg,
        toddler_id: activeToddler?.ref,
        summary: summary || undefined,
        messages: newMsgs.slice(-8).map((m) => ({ role: m.role, content: m.text })),
      });
      applyUsage(data?.usage, local.count);
      const updated = [...newMsgs, { role: 'assistant' as const, text: replyText(data) }];
      setMsgs(updated);
      compactHistory(updated);
    } catch (e: any) {
      if (e?.status === 429) {
        applyUsage(e?.body?.usage, local.count);
        setLimitReached(true);
      }
      setMsgs([
        ...newMsgs,
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
        {/* Premium banner */}
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#ec4899'] as [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.premiumBanner}
        >
          <Text style={styles.premiumIcon}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumTitle}>AI Chat Assistant</Text>
            <Text style={styles.premiumSub}>
              Free during early access. Will become a premium feature.
            </Text>
          </View>
        </LinearGradient>

        {/* Usage counter */}
        <View style={styles.usageBar}>
          <Text style={styles.usageText}>
            {dailyCount}/{dailyLimit} messages today
            {isGuest ? ' (guest)' : ''}
          </Text>
          {isGuest && (
            <Pressable onPress={() => router.push('/login')} hitSlop={8}>
              <Text style={styles.usageLink}>Sign in for more</Text>
            </Pressable>
          )}
        </View>

        {limitReached && (
          <View style={styles.limitBanner}>
            <Text style={styles.limitText}>
              {isGuest
                ? `Guest limit reached (${dailyLimit}/day). Sign in or register for ${USER_DAILY_LIMIT} messages per day.`
                : `Daily limit reached (${dailyLimit}/day). Premium users will have unlimited access.`}
            </Text>
            {isGuest && (
              <View style={styles.limitActions}>
                <Pressable style={styles.limitBtn} onPress={() => router.push('/login')}>
                  <Text style={styles.limitBtnText}>Sign in</Text>
                </Pressable>
                <Pressable style={styles.limitBtn} onPress={() => router.push('/register')}>
                  <Text style={styles.limitBtnText}>Register</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {chatAvailable === false && (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableText}>
              Chat is currently unavailable. Please try again later.
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={msgs}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={[styles.list, msgs.length === 0 && styles.listEmpty]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatIcon}>🤖</Text>
              <Text style={styles.emptyChatTitle}>Ask me anything!</Text>
              <Text style={styles.emptyChatSub}>
                I can help with meals, picky eating, nutrition, food safety, and toddler feeding tips.
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} style={styles.suggestionChip} onPress={() => send(s)}>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.user : styles.assistant,
              ]}
            >
              {item.role === 'assistant' && (
                <Text style={styles.botAvatar}>🤖</Text>
              )}
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
          ListFooterComponent={
            loading ? (
              <View style={[styles.bubble, styles.assistant]}>
                <Text style={styles.botAvatar}>🤖</Text>
                <Text style={styles.thinkingText}>Thinking...</Text>
              </View>
            ) : null
          }
        />

        <View style={styles.composer}>
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about meals, nutrition..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              maxLength={500}
              onSubmitEditing={() => send()}
              returnKeyType="send"
              editable={chatAvailable !== false && !limitReached}
            />
            <Pressable
              style={[styles.sendBtn, (!input.trim() || loading || limitReached) && styles.sendBtnDisabled]}
              onPress={() => send()}
              disabled={!input.trim() || loading || limitReached}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  premiumIcon: { fontSize: 24 },
  premiumTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#ffffff',
  },
  premiumSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  usageBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.bgTertiary,
  },
  usageText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  usageLink: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: colors.primary,
  },
  limitBanner: {
    padding: 14,
    backgroundColor: 'rgba(234,179,8,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(234,179,8,0.3)',
  },
  limitText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#92400e',
    textAlign: 'center',
    lineHeight: 18,
  },
  limitActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
  },
  limitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  limitBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: colors.white,
  },
  unavailable: {
    padding: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  unavailableText: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.danger,
    textAlign: 'center',
  },
  list: { padding: 16, paddingBottom: 8 },
  listEmpty: { flex: 1, justifyContent: 'center' },
  emptyChat: {
    alignItems: 'center',
    padding: 20,
  },
  emptyChatIcon: { fontSize: 48, marginBottom: 12 },
  emptyChatTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: colors.text,
    marginBottom: 8,
  },
  emptyChatSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.bgTertiary,
  },
  suggestionText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: colors.primary,
  },
  bubble: {
    maxWidth: '88%',
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 10,
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  botAvatar: {
    fontSize: 14,
    marginBottom: 4,
  },
  bubbleText: {
    fontFamily: 'Nunito_400Regular',
    color: colors.text,
    lineHeight: 22,
  },
  thinkingText: {
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  composer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  sendBtnDisabled: {
    backgroundColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: {
    color: '#ffffff',
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
  },
});
