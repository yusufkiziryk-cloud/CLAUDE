import { Tabs } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Feather } from '@expo/vector-icons'

const ORANGE = '#ea580c'
const INACTIVE = '#64748b'

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: ORANGE,
      tabBarInactiveTintColor: INACTIVE,
      tabBarStyle: {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
        paddingBottom: 8,
        paddingTop: 8,
        height: 65,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginTop: 2 },
      headerStyle: { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
      headerTintColor: isDark ? '#f1f5f9' : '#0f172a',
      headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      headerShadowVisible: false,
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Bugün',
        tabBarIcon: ({ color }) => <Feather name="sun" size={22} color={color} />,
        headerTitle: 'LifeTrack',
      }} />
      <Tabs.Screen name="capture" options={{
        title: 'Ekle',
        tabBarIcon: ({ color }) => <Feather name="plus-circle" size={22} color={color} />,
        headerTitle: 'Hızlı Ekle',
      }} />
      <Tabs.Screen name="journal" options={{
        title: 'Günlük',
        tabBarIcon: ({ color }) => <Feather name="book-open" size={22} color={color} />,
        headerTitle: "Bugünün Günlüğü",
      }} />
      <Tabs.Screen name="habits" options={{
        title: 'Alışkanlık',
        tabBarIcon: ({ color }) => <Feather name="zap" size={22} color={color} />,
        headerTitle: 'Alışkanlıklar',
      }} />
      <Tabs.Screen name="insights" options={{
        title: 'Zeka',
        tabBarIcon: ({ color }) => <Feather name="cpu" size={22} color={color} />,
        headerTitle: 'AI Hafıza',
      }} />
    </Tabs>
  )
}
