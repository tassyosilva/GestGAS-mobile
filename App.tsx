import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { testStorage, testAuth } from './src/test-services';

export default function App() {
  useEffect(() => {
    // Executar testes quando o app carregar
    runTests();
  }, []);

  const runTests = async () => {
    try {
      await testStorage();
      await testAuth();
      console.log('✅ Todos os testes concluídos!');
    } catch (error) {
      console.error('❌ Erro nos testes:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Testando Serviços...</Text>
      <Text style={styles.info}>Abra o console para ver os resultados</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  info: {
    fontSize: 14,
    color: '#666',
  },
});