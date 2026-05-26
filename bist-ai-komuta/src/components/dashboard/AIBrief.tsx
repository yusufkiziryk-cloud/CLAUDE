import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../common/Card';
import { colors } from '../../theme/colors';

export const AIBrief: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiBadge}>
            <Text style={styles.aiLabel}>AI</Text>
          </View>
          <Text style={styles.title}>GÜNLÜK KURUMSAL NOT</Text>
        </View>
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Text style={styles.toggle}>{expanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.summary} numberOfLines={expanded ? undefined : 3}>
        Mevcut veriler ışığında BIST genel eğilimi pozitif seyrediyor. Savunma ve teknoloji sektörleri momentum açısından öne çıkmakta. Bankacılıkta teknik teyit beklenmeli. Makro volatilite ortamında pozisyon boyutlandırması kritik önem taşıyor.
      </Text>

      {expanded && (
        <View style={styles.expanded}>
          <View style={styles.bulletSection}>
            <Text style={styles.bulletTitle}>Dikkat Edilecekler</Text>
            <Text style={styles.bullet}>• GARAN 118 TL desteği yakın takipte</Text>
            <Text style={styles.bullet}>• KOZAL RSI aşırı alım bölgesinde</Text>
            <Text style={styles.bullet}>• Kur oynaklığı bankacılık sektörünü etkileyebilir</Text>
          </View>
          <Text style={styles.disclaimer}>
            Bu içerik karar destek amaçlıdır. Yatırım tavsiyesi değildir.
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiBadge: {
    backgroundColor: colors.accent.purpleLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiLabel: { color: colors.accent.purple, fontSize: 11, fontWeight: '800' },
  title: { color: colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  toggle: { color: colors.text.muted, fontSize: 14 },
  summary: { color: colors.text.secondary, fontSize: 13, lineHeight: 20 },
  expanded: { gap: 10, marginTop: 4 },
  bulletSection: { gap: 4 },
  bulletTitle: { color: colors.text.primary, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  bullet: { color: colors.text.secondary, fontSize: 12, lineHeight: 18 },
  disclaimer: {
    color: colors.text.muted,
    fontSize: 10,
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
});
