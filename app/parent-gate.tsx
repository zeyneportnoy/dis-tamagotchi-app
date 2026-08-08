import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Screen, Text, BackButton, spacing } from '@/design-system';
import { StyleSheet, View } from 'react-native';
import { createParentChallenge } from '@/features/parent-gate/challenge';

export default function ParentGateScreen() {
  const { t } = useTranslation();
  const challenge = useMemo(() => createParentChallenge(), []);
  const [answer, setAnswer] = useState('');
  const [incorrect, setIncorrect] = useState(false);

  const submit = () => {
    if (Number(answer) === challenge.answer) return router.replace('/(parent)');
    setIncorrect(true);
    setAnswer('');
  };

  return (
    <Screen testID="parent-gate-screen">
      <View style={styles.back}>
        <BackButton testID="detail-back-button" />
      </View>
      <Text variant="title">{t('parentGate.title')}</Text>
      <Text>{t('parentGate.question', challenge)}</Text>
      <Input
        accessibilityLabel={t('parentGate.answerLabel')}
        keyboardType="number-pad"
        onChangeText={(value) => {
          setAnswer(value);
          setIncorrect(false);
        }}
        value={answer}
      />
      {incorrect ? <Text>{t('parentGate.incorrect')}</Text> : null}
      <Button label={t('parentGate.submit')} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { left: spacing.lg, position: 'absolute', top: spacing.xl + spacing.lg },
});
