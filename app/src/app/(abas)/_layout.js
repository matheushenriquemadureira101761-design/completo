import { Tabs } from 'expo-router/js-tabs';
import { Icone } from '../../componentes/icones';
import { cor, fonte } from '../../tema';

// Barra de baixo: Início, Buscar, Pedidos, Anunciar, Conta (forma A).
const ABAS = [
  ['inicio', 'Início'], ['buscar', 'Buscar'], ['pedidos', 'Pedidos'], ['anunciar', 'Anunciar'], ['conta', 'Conta'],
];

export default function LayoutAbas() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: cor.dourado,
      tabBarInactiveTintColor: '#7F9384',
      tabBarStyle: { backgroundColor: '#0B2013', borderTopColor: cor.borda, borderTopWidth: 1, minHeight: 64, paddingTop: 6 },
      tabBarLabelStyle: { fontFamily: fonte.media, fontSize: 12 },
      sceneStyle: { backgroundColor: cor.folha },
    }}>
      {ABAS.map(([nome, titulo]) => (
        <Tabs.Screen key={nome} name={nome} options={{ title: titulo, tabBarIcon: ({ color }) => <Icone nome={nome} cor={color} t={24} /> }} />
      ))}
    </Tabs>
  );
}
