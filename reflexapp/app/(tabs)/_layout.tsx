import { Tabs } from 'expo-router';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Palette } from '../../constants/colors';

function TabIcon({ emoji, focused, label }: { emoji: string; focused: boolean; label: string }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:      false,
        tabBarStyle:      styles.tabBar,
        tabBarBackground: () => (
          <BlurView
            tint="dark"
            intensity={70}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarShowLabel:   false,
        tabBarActiveTintColor:   Palette.sage,
        tabBarInactiveTintColor: Palette.slateMid,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" focused={focused} label="Ana Sayfa" />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🦶" focused={focused} label="Harita" />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🤖" focused={focused} label="Asistan" />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⏱" focused={focused} label="Seanslar" />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" focused={focused} label="İlerleme" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position:         'absolute',
    borderTopWidth:   0,
    backgroundColor:  'transparent',
    elevation:        0,
    height:           Platform.OS === 'ios' ? 88 : 65,
    paddingBottom:    Platform.OS === 'ios' ? 28 : 8,
  },
  tabItem: {
    alignItems:  'center',
    gap:         2,
    paddingTop:  4,
  },
  tabEmoji: {
    fontSize: 22,
    opacity:  0.5,
  },
  tabEmojiActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize:  9,
    color:     Palette.slateMid,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: Palette.sage,
  },
});
