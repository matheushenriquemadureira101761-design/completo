import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking, ActivityIndicator, useWindowDimensions, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Botao, Mensagem } from '../../componentes/ui';
import { Icone, IconeWhatsApp } from '../../componentes/icones';
import { FotoAnuncio, Nota, Selo, Estrelas, distanciaTexto } from '../../componentes/marketplace';
import { api } from '../../servicos/api';
import { tratarErroDeAcesso } from '../../servicos/erros';
import { exigirConta } from '../../servicos/gate';
import { cor, fonte } from '../../tema';

export default function DetalheAnuncio() {
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [a, setA] = useState(null);
  const [erro, setErro] = useState(null);
  const [foto, setFoto] = useState(0);
  const [abrindoWhats, setAbrindoWhats] = useState(false);

  useFocusEffect(useCallback(() => {
    api(`/anuncios/${id}`).then(setA).catch(async (e) => { if (!(await tratarErroDeAcesso(e))) setErro(e.message); });
  }, [id]));

  async function whatsapp() {
    if (!(await exigirConta('falar com o fornecedor'))) return;
    setAbrindoWhats(true);
    try { const r = await api(`/anuncios/${id}/contato`, { metodo: 'POST' }); await Linking.openURL(r.link); } catch (e) { setErro(e.message); } finally { setAbrindoWhats(false); }
  }

  if (erro && !a) return <View style={{ flex: 1, backgroundColor: cor.folha, padding: 24, paddingTop: insets.top + 60, gap: 16 }}><Mensagem>{erro}</Mensagem><Botao titulo="Voltar" aoTocar={() => router.back()} /></View>;
  if (!a) return <View style={{ flex: 1, backgroundColor: cor.folha, justifyContent: 'center' }}><ActivityIndicator color={cor.dourado} size="large" /></View>;

  const alturaFoto = Math.round(width * 0.72);
  return (
    <View style={{ flex: 1, backgroundColor: cor.folha }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View>
          {a.fotos.length ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setFoto(Math.round(e.nativeEvent.contentOffset.x / width))}>
              {a.fotos.map((f) => <FotoAnuncio key={f.id} url={f.url} categoria={a.categoria} largura={width} altura={alturaFoto} raio={0} />)}
            </ScrollView>
          ) : <FotoAnuncio categoria={a.categoria} largura={width} altura={alturaFoto} raio={0} />}
          <Pressable onPress={() => router.back()} style={[estilos.redondo, { top: insets.top + 10, left: 16 }]} accessibilityRole="button" accessibilityLabel="Voltar"><Icone nome="voltar" cor="#fff" t={22} /></Pressable>
          {a.fotos.length > 1 && (
            <View style={[estilos.pontos, { bottom: 34 }]} accessibilityLabel={`Foto ${foto + 1} de ${a.fotos.length}`}>
              {a.fotos.map((f, i) => <View key={f.id} style={[estilos.ponto, i === foto && { width: 18, backgroundColor: cor.dourado }]} />)}
            </View>
          )}
        </View>

        <View style={estilos.folha}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonte.titulo, fontSize: 22, lineHeight: 27, color: cor.texto }} accessibilityRole="header">{a.titulo}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icone nome="pin" cor={cor.textoApagado} t={14} />
              <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>{a.cidade} - {a.uf}{a.distanciaKm != null ? ` · ${distanciaTexto(a.distanciaKm)} de você` : ''}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ fontFamily: fonte.titulo, fontSize: 26, color: cor.texto }}>{a.preco}<Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}> {a.unidade}</Text></Text>
            <Selo texto={a.disponibilidade} />
          </View>
          {a.caracteristicas.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {a.caracteristicas.map((c) => <View key={c} style={estilos.etiqueta}><Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.textoSuave }}>{c}</Text></View>)}
            </View>
          )}
          {a.descricao ? <Text style={{ fontFamily: fonte.normal, fontSize: 15, lineHeight: 23, color: cor.textoSuave }}>{a.descricao}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icone nome="rota" cor={cor.textoApagado} t={16} />
            <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}>Atende até {a.raioKm} km de {a.cidade}</Text>
          </View>

          <View style={estilos.fornecedor}>
            <View style={estilos.avatar}><Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.ok }}>{a.fornecedor.iniciais}</Text></View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>{a.fornecedor.nome}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Nota nota={a.fornecedor.nota} avaliacoes={a.fornecedor.avaliacoes} />
                <Text style={{ fontFamily: fonte.normal, fontSize: 12, color: cor.textoApagado }}>na AGROVINC desde {a.fornecedor.desde}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icone nome="escudo" cor={cor.ok} t={14} />
                <Text style={{ fontFamily: fonte.media, fontSize: 12, color: cor.ok }}>WhatsApp confirmado</Text>
              </View>
            </View>
          </View>
          {a.comentarios?.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.texto }} accessibilityRole="header">O que dizem os clientes</Text>
              {a.comentarios.map((c, i) => (
                <View key={i} style={estilos.comentario}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Estrelas nota={c.nota} />
                    <Text style={{ fontFamily: fonte.normal, fontSize: 12, color: cor.textoApagado }}>{c.nome} · {c.quando}</Text>
                  </View>
                  <Text style={{ fontFamily: fonte.normal, fontSize: 14, lineHeight: 21, color: cor.textoSuave }}>{c.comentario}</Text>
                </View>
              ))}
            </View>
          )}
          {a.emAnalise && <Mensagem>Este anúncio está em análise pela nossa equipe por causa de denúncias e não aparece para ninguém até a análise terminar.</Mensagem>}
          {!a.meu && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <Botao tipo="link" titulo="Denunciar anúncio" aoTocar={() => router.push(`/denunciar/${a.id}`)} />
              <Botao tipo="link" titulo="Bloquear fornecedor" aoTocar={() => router.push({ pathname: `/bloquear/${a.fornecedor.id}`, params: { nome: a.fornecedor.nome } })} />
            </View>
          )}
          {erro && <Mensagem>{erro}</Mensagem>}
        </View>
      </ScrollView>

      <View style={[estilos.barra, { paddingBottom: insets.bottom + 12 }]}>
        {a.meu ? (
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ fontFamily: fonte.media, fontSize: 13, color: cor.dourado, textAlign: 'center' }}>Este anúncio é seu</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Botao tipo="contorno" titulo="Meus anúncios" aoTocar={() => router.push('/meus-anuncios')} /></View>
              <View style={{ flex: 1 }}><Botao titulo="Editar" aoTocar={() => router.push(`/editar-anuncio/${a.id}`)} /></View>
            </View>
          </View>
        ) : (
          <>
            <Pressable onPress={whatsapp} disabled={abrindoWhats} style={estilos.whats} accessibilityRole="button" accessibilityLabel="Chamar o fornecedor no WhatsApp">
              {abrindoWhats ? <ActivityIndicator color={cor.ok} /> : <IconeWhatsApp />}
            </Pressable>
            <View style={{ flex: 1 }}><Botao titulo="Pedir orçamento" aoTocar={() => router.push(`/orcamento/${a.id}`)} /></View>
          </>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  redondo: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(14,39,23,0.85)', alignItems: 'center', justifyContent: 'center' },
  pontos: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  folha: { marginTop: -18, backgroundColor: cor.folha, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 14 },
  etiqueta: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo, justifyContent: 'center' },
  fornecedor: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: cor.ok, backgroundColor: cor.aviso, alignItems: 'center', justifyContent: 'center' },
  barra: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 12, backgroundColor: '#0B2013', borderTopWidth: 1, borderTopColor: cor.borda },
  comentario: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, backgroundColor: cor.campo, gap: 6 },
  whats: { width: 56, height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.aviso, alignItems: 'center', justifyContent: 'center' },
});
