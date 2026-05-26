import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { colors } from '../theme/colors';
import { RootStackParamList, TabParamList } from '../types';

import { DashboardScreen } from '../screens/DashboardScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { StocksScreen } from '../screens/StocksScreen';
import { AlarmsScreen } from '../screens/AlarmsScreen';
import { AIScreen } from '../screens/AIScreen';
import { StockDetailScreen } from '../screens/StockDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TabIcon = ({ label, emoji, focused }: { label: string; emoji: string; focused: boolean }) => (
  <View style={tabIconStyles.container}>
    <Text style={[tabIconStyles.emoji, focused && tabIconStyles.emojiActive]}>{emoji}</Text>
    <Text style={[tabIconStyles.label, focused && tabIconStyles.labelActive]}>{label}</Text>
  </View>
);

const tabIconStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 2 },
  emoji: { fontSize: 20, opacity: 0.5 },
  emojiActive: { opacity: 1 },
  label: { fontSize: 10, color: colors.text.muted, fontWeight: '600' },
  labelActive: { color: colors.accent.blue },
});

const TAB_ICONS: Record<string, string> = {
  Dashboard: '⬛',
  Portfolio: '📊',
  Stocks: '📈',
  Alarms: '🔔',
  AI: '🤖',
};

const TAB_LABELS: Record<string, string> = {
  Dashboard: 'Komuta',
  Portfolio: 'Portföy',
  Stocks: 'Hisseler',
  Alarms: 'Alarmlar',
  AI: 'AI',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon
            label={TAB_LABELS[route.name]}
            emoji={TAB_ICONS[route.name]}
            focused={focused}
          />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="Stocks" component={StocksScreen} />
      <Tab.Screen name="Alarms" component={AlarmsScreen} />
      <Tab.Screen name="AI" component={AIScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="StockDetail"
          component={StockDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
