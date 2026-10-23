import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ChatFab } from '../../src/components/ChatFab';
import { colors } from '../../src/theme';

/** Tab bar content height (icons + labels) excluding bottom safe-area padding. */
const TAB_BAR_CONTENT_HEIGHT = 56;

function HomeIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primary : colors.textMuted;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V9.5z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? color + '20' : 'none'}
      />
    </Svg>
  );
}

function LogIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primary : colors.textMuted;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2a10 10 0 100 20 10 10 0 000-20z"
        stroke={color}
        strokeWidth={2}
        fill={focused ? color + '15' : 'none'}
      />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 16h8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M7 12h2M15 12h2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function PlanIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primary : colors.textMuted;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
        stroke={color}
        strokeWidth={2}
        fill={focused ? color + '15' : 'none'}
      />
      <Path d="M8 2v4M16 2v4M4 9h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 13h3M8 17h5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function NutritionIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primary : colors.textMuted;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
        stroke={color}
        strokeWidth={2}
        fill={focused ? color + '15' : 'none'}
      />
      <Path d="M12 6v6l4.5 2.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 14l2-4 2 3 2-5 2 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MoreIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.primary : colors.textMuted;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 13a1 1 0 100-2 1 1 0 000 2zM6 13a1 1 0 100-2 1 1 0 000 2zM18 13a1 1 0 100-2 1 1 0 000 2z"
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </Svg>
  );
}

function TabIconWrap({ children, focused }: { children: React.ReactNode; focused: boolean }) {
  if (focused) {
    return (
      <View style={iconStyles.activeWrap}>
        <View style={iconStyles.activeDot} />
        {children}
      </View>
    );
  }
  return <View style={iconStyles.wrap}>{children}</View>;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + bottomPad;

  return (
    <View style={layoutStyles.root}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
        tabBarButton: (props) => (
          <Pressable
            {...(props as any)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          />
        ),
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: 4,
          elevation: 8,
          shadowColor: '#6366f1',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIconWrap focused={focused}><HomeIcon focused={focused} /></TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ focused }) => (
            <TabIconWrap focused={focused}><LogIcon focused={focused} /></TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => (
            <TabIconWrap focused={focused}><PlanIcon focused={focused} /></TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarIcon: ({ focused }) => (
            <TabIconWrap focused={focused}><NutritionIcon focused={focused} /></TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => (
            <TabIconWrap focused={focused}><MoreIcon focused={focused} /></TabIconWrap>
          ),
        }}
      />
    </Tabs>
    <ChatFab />
    </View>
  );
}

const layoutStyles = StyleSheet.create({
  root: { flex: 1 },
});

const iconStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  activeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  activeDot: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
