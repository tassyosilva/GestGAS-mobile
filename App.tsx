import React from 'react';
import ConfiguracaoInicialScreen from './src/screens/ConfiguracaoInicialScreen';

export default function App() {
  return (
    <ConfiguracaoInicialScreen
      onConfigComplete={() => console.log('Configuração completa!')}
    />
  );
}