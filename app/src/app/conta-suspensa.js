import { View } from 'react-native';
import Tela from '../componentes/Tela';
import { Botao, Texto, Titulo } from '../componentes/ui';
import { abrirSuporte } from '../componentes/Assinar';

export default function ContaSuspensa() {
  return (
    <Tela>
      <View style={{ gap: 14, alignItems: 'center' }}>
        <Titulo>Conta suspensa</Titulo>
        <Texto centro>Sua conta foi suspensa por descumprir os Termos de Uso, depois de uma análise da nossa equipe. Se você acha que foi um engano, fale com o suporte.</Texto>
      </View>
      <Botao titulo="Falar com o suporte" aoTocar={abrirSuporte} />
    </Tela>
  );
}
