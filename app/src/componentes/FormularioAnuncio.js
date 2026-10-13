import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import Tela from './Tela';
import { Botao, Campo, Escolha, Rotulo, Mensagem, Texto } from './ui';
import { Icone } from './icones';
import { urlCompleta } from './marketplace';
import CalendarioDisponibilidade from './CalendarioDisponibilidade';
import { api } from '../servicos/api';
import { exigirConta } from '../servicos/gate';
import { tratarErroDeAcesso } from '../servicos/erros';
import { buscarCidades } from '../lib/validacao';
import { cor, fonte } from '../tema';

const CATS = [
  { valor: 'maquinas', nome: 'Máquinas', exemplo: 'Ex.: Trator 110 cv com operador' },
  { valor: 'implementos', nome: 'Implementos', exemplo: 'Ex.: Plantadeira 13 linhas' },
  { valor: 'fretes', nome: 'Fretes', exemplo: 'Ex.: Frete graneleiro bitrem' },
  { valor: 'servicos', nome: 'Serviços', exemplo: 'Ex.: Aplicação com drone' },
];
const SUGESTOES = {
  maquinas: ['Com operador', 'Sem operador', '4x4', 'Diesel incluso', 'Revisado', 'Ar-condicionado'],
  implementos: ['Com trator', 'Só o implemento', 'Entrega na fazenda', 'Revisado'],
  fretes: ['Graneleiro', 'Bitrem', 'Rodotrem', 'Boiadeiro', 'Carga seca', 'Seguro de carga'],
  servicos: ['Com equipamento próprio', 'Atende fim de semana', 'Emite nota fiscal', 'Mão de obra especializada'],
};
const UNIDADES = [{ valor: 'hora', rotulo: 'Hora' }, { valor: 'hectare', rotulo: 'Hectare' }, { valor: 'km', rotulo: 'Km' }, { valor: 'dia', rotulo: 'Dia' }, { valor: 'servico', rotulo: 'Serviço' }];
const RAIOS = [30, 50, 100, 200, 500];
const MAX_FOTOS = 6;

/** "1.234,56" → 123456 centavos */
const paraCentavos = (t) => { const d = String(t).replace(/\D/g, ''); return d ? Number(d) : null; };
const mascaraDinheiro = (centavos) => (centavos == null ? '' : (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

async function prepararFoto(uri) {
  // Reduz para 1280 px de largura e comprime: sobe rápido mesmo com sinal fraco no campo.
  const ctx = ImageManipulator.manipulate(uri).resize({ width: 1280 });
  const img = await ctx.renderAsync();
  const r = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return { uri: r.uri, base64: r.base64 };
}

/**
 * Formulário de anúncio. Sem `anuncioId`: cria um anúncio novo. Com `anuncioId`: carrega e edita (fotos incluídas).
 */
export default function FormularioAnuncio({ anuncioId = null }) {
  const editando = Boolean(anuncioId);
  const [me, setMe] = useState(null);
  const [categoria, setCategoria] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [comPreco, setComPreco] = useState('sim');
  const [centavos, setCentavos] = useState(null);
  const [unidade, setUnidade] = useState('hora');
  const [caracteristicas, setCaracteristicas] = useState([]);
  const [outra, setOutra] = useState('');
  const [cidade, setCidade] = useState(null);
  const [buscaCidade, setBuscaCidade] = useState('');
  const [raio, setRaio] = useState(100);
  const [disponibilidade, setDisponibilidade] = useState({ modo: 'consulta', datas: [] });
  const [removidas, setRemovidas] = useState([]);
  const [carregado, setCarregado] = useState(!editando);
  const [fotos, setFotos] = useState([]);
  const [enviando, setEnviando] = useState(null);
  const [erro, setErro] = useState(null);

  useFocusEffect(useCallback(() => {
    if (editando) return;
    api('/me').then((m) => { setMe(m); setCidade((c) => c ?? { nome: m.usuario.cidade, uf: m.usuario.uf }); }).catch(tratarErroDeAcesso);
  }, [editando]));

  // Edição: preenche o formulário com o anúncio como está hoje.
  useEffect(() => {
    if (!editando) return;
    let vivo = true;
    api(`/anuncios/${anuncioId}`).then((a) => {
      if (!vivo) return;
      if (!a.meu) { setErro('Só quem publicou pode editar este anúncio.'); return; }
      setCategoria(a.categoria); setTitulo(a.titulo); setDescricao(a.descricao ?? '');
      setComPreco(a.precoCentavos == null ? 'nao' : 'sim'); setCentavos(a.precoCentavos ?? null); setUnidade(a.unidadeCodigo ?? 'hora');
      setCaracteristicas(a.caracteristicas ?? []); setCidade({ nome: a.cidade, uf: a.uf }); setRaio(a.raioKm);
      // Compatibilidade com formato antigo (disponivelEm) + novo formato (disponibilidade).
      if (a.disponibilidade?.modo) setDisponibilidade({ modo: a.disponibilidade.modo, datas: a.disponibilidade.datas || [] });
      else if (a.disponivelEm) setDisponibilidade({ modo: 'datas', datas: [a.disponivelEm] });
      else setDisponibilidade({ modo: 'consulta', datas: [] });
      setFotos(a.fotos.map((f) => ({ id: f.id, uri: urlCompleta(f.url) })));
      setCarregado(true);
    }).catch(async (e) => { if (vivo && !(await tratarErroDeAcesso(e))) setErro(e.message); });
    return () => { vivo = false; };
  }, [editando, anuncioId]);

  const raios = useMemo(() => [...new Set([...RAIOS, raio])].sort((x, y) => x - y), [raio]);
  const sugestoesCidade = useMemo(() => (cidade ? [] : buscarCidades(buscaCidade, 5)), [buscaCidade, cidade]);
  const alternar = (c) => setCaracteristicas((l) => (l.includes(c) ? l.filter((x) => x !== c) : l.length >= 10 ? l : [...l, c]));
  const adicionarOutra = () => { const t = outra.trim(); if (t && !caracteristicas.includes(t) && caracteristicas.length < 10) setCaracteristicas([...caracteristicas, t.slice(0, 40)]); setOutra(''); };

  async function escolherFoto(origem) {
    if (fotos.length >= MAX_FOTOS) return;
    const pedir = origem === 'camera' ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { granted } = await pedir();
    if (!granted) { setErro(origem === 'camera' ? 'Para tirar foto, permita o uso da câmera nas configurações do celular.' : 'Para escolher fotos, permita o acesso às fotos nas configurações do celular.'); return; }
    const abrir = origem === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const r = await abrir({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: origem !== 'camera', selectionLimit: MAX_FOTOS - fotos.length });
    if (r.canceled) return;
    try {
      const prontas = await Promise.all(r.assets.slice(0, MAX_FOTOS - fotos.length).map((a) => prepararFoto(a.uri)));
      setFotos((f) => [...f, ...prontas].slice(0, MAX_FOTOS));
    } catch { setErro('Não deu para preparar a foto. Tente outra.'); }
  }

  const falta = [];
  if (!categoria) falta.push('categoria');
  if (titulo.trim().length < 5) falta.push('título');
  if (comPreco === 'sim' && !centavos) falta.push('preço');
  if (!cidade) falta.push('cidade');
  const pronto = falta.length === 0;

  async function publicar() {
    // Visitante é redirecionado pro cadastro antes de publicar.
    if (!(await exigirConta('publicar um anúncio'))) return;
    setErro(null);
    const dados = {
      categoria, titulo: titulo.trim(), descricao: descricao.trim(),
      precoCentavos: comPreco === 'sim' ? centavos : null, unidade: comPreco === 'sim' ? unidade : null,
      caracteristicas, cidade: cidade.nome, uf: cidade.uf, raioKm: raio,
      disponibilidade,
    };
    try {
      let id = anuncioId;
      if (editando) {
        setEnviando('Salvando...');
        await api(`/anuncios/${id}`, { metodo: 'PUT', corpo: dados });
        for (const fotoId of removidas) await api(`/anuncios/${id}/fotos/${fotoId}`, { metodo: 'DELETE' });
        setRemovidas([]);
      } else {
        setEnviando('Publicando o anúncio...');
        ({ id } = await api('/anuncios', { metodo: 'POST', corpo: dados }));
      }
      const novas = fotos.filter((f) => !f.id);
      for (let i = 0; i < novas.length; i++) {
        setEnviando(`Enviando foto ${i + 1} de ${novas.length}...`);
        await api(`/anuncios/${id}/fotos`, { metodo: 'POST', corpo: { base64: novas[i].base64 } });
      }
      if (editando) { router.replace(`/anuncio/${id}`); return; }
      setCategoria(null); setTitulo(''); setDescricao(''); setCentavos(null); setCaracteristicas([]); setFotos([]); setDisponibilidade({ modo: 'consulta', datas: [] });
      router.push(`/anuncio/${id}`);
    } catch (e) {
      if (!(await tratarErroDeAcesso(e))) setErro(e.message);
    } finally { setEnviando(null); }
  }

  return (
    <Tela compacto titulo={editando ? 'Editar anúncio' : 'Anunciar'} subtitulo={editando ? 'As mudanças aparecem na hora para quem procura' : me && !me.usuario.fornecedor ? 'Ao publicar, sua conta também vira fornecedor' : 'Ofereça máquinas, implementos, fretes ou serviços'}>
      {editando && <Botao tipo="link" titulo="Voltar sem salvar" aoTocar={() => router.back()} />}
      {!carregado ? (erro ? <Mensagem>{erro}</Mensagem> : <ActivityIndicator color={cor.dourado} />) : (<>
      <View style={{ gap: 8 }}>
        <Rotulo>O que você vai oferecer?</Rotulo>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {CATS.map((c) => {
            const ativo = categoria === c.valor;
            return (
              <Pressable key={c.valor} onPress={() => { setCategoria(c.valor); setCaracteristicas([]); }} accessibilityRole="radio" accessibilityState={{ checked: ativo }}
                style={[estilos.cat, ativo && { borderColor: cor.dourado, backgroundColor: '#24452F' }]}>
                <Icone nome={c.valor} cor={ativo ? cor.dourado : cor.textoApagado} t={30} sw={1.8} />
                <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>{c.nome}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Campo rotulo="Título do anúncio" placeholder={CATS.find((c) => c.valor === categoria)?.exemplo ?? 'Ex.: Trator 110 cv com operador'} value={titulo} onChangeText={setTitulo} maxLength={80} />
      <Campo rotulo="Descrição (opcional)" placeholder="Conte o estado, o que está incluso, como funciona o atendimento..." value={descricao} onChangeText={setDescricao}
        multiline maxLength={1500} style={{ minHeight: 110, textAlignVertical: 'top' }} />

      <View style={{ gap: 8 }}>
        <Rotulo>Preço</Rotulo>
        <Escolha opcoes={[{ valor: 'sim', rotulo: 'Informar preço' }, { valor: 'nao', rotulo: 'Sob consulta' }]} valor={comPreco} aoMudar={setComPreco} />
      </View>
      {comPreco === 'sim' && (
        <View style={{ gap: 10 }}>
          <Campo rotulo="Valor (R$)" placeholder="0,00" keyboardType="number-pad" value={mascaraDinheiro(centavos)} onChangeText={(t) => setCentavos(paraCentavos(t))} />
          <Rotulo>Cobrado por</Rotulo>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {UNIDADES.map((u) => (
              <Pressable key={u.valor} onPress={() => setUnidade(u.valor)} style={[estilos.pilula, unidade === u.valor && estilos.pilulaOn]} accessibilityRole="radio" accessibilityState={{ checked: unidade === u.valor }}>
                <Text style={[estilos.pilulaTexto, unidade === u.valor && { color: '#14361F' }]}>{u.rotulo}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {categoria && (
        <View style={{ gap: 8 }}>
          <Rotulo>Características (toque para marcar)</Rotulo>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...SUGESTOES[categoria], ...caracteristicas.filter((c) => !SUGESTOES[categoria].includes(c))].map((c) => {
              const on = caracteristicas.includes(c);
              return (
                <Pressable key={c} onPress={() => alternar(c)} style={[estilos.pilula, on && estilos.pilulaOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                  <Text style={[estilos.pilulaTexto, on && { color: '#14361F' }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={outra} onChangeText={setOutra} onSubmitEditing={adicionarOutra} placeholder="Outra característica (ex.: 110 cv)" placeholderTextColor={cor.textoApagado}
              maxLength={40} style={estilos.outra} accessibilityLabel="Outra característica" />
            <Pressable onPress={adicionarOutra} style={estilos.add} accessibilityRole="button" accessibilityLabel="Adicionar característica"><Icone nome="anunciar" cor={cor.dourado} t={24} /></Pressable>
          </View>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Rotulo>Cidade do anúncio</Rotulo>
        {cidade ? (
          <View style={estilos.cidade}>
            <Icone nome="pin" cor={cor.ok} t={18} />
            <Text style={{ flex: 1, fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>{cidade.nome} - {cidade.uf}</Text>
            <Pressable onPress={() => { setCidade(null); setBuscaCidade(''); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Trocar cidade"><Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.dourado }}>Trocar</Text></Pressable>
          </View>
        ) : (
          <>
            <Campo placeholder="Digite a cidade" value={buscaCidade} onChangeText={setBuscaCidade} autoCorrect={false} accessibilityLabel="Cidade do anúncio" />
            {sugestoesCidade.map((c) => (
              <Pressable key={c.nome + c.uf} onPress={() => setCidade(c)} style={estilos.sugestao} accessibilityRole="button">
                <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>{c.nome}</Text>
                <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>{c.estadoUf}</Text>
              </Pressable>
            ))}
          </>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <Rotulo>Até onde você atende?</Rotulo>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {raios.map((r) => (
            <Pressable key={r} onPress={() => setRaio(r)} style={[estilos.pilula, { flex: 1, paddingHorizontal: 0, alignItems: 'center' }, raio === r && estilos.pilulaOn]} accessibilityRole="radio" accessibilityState={{ checked: raio === r }}>
              <Text style={[estilos.pilulaTexto, raio === r && { color: '#14361F' }]}>{r} km</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <CalendarioDisponibilidade valor={disponibilidade} aoMudar={setDisponibilidade} />

      <View style={{ gap: 8 }}>
        <Rotulo>Fotos ({fotos.length} de {MAX_FOTOS})</Rotulo>
        <Texto suave style={{ fontSize: 13, lineHeight: 19 }}>Anúncios com foto recebem muito mais pedidos. Mostre o equipamento inteiro, de dia.</Texto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {fotos.map((f, i) => (
            <View key={f.id ? `s${f.id}` : f.uri} style={{ width: 96, height: 96 }}>
              <Image source={{ uri: f.uri }} style={{ width: 96, height: 96, borderRadius: 12 }} accessibilityLabel={`Foto ${i + 1}`} />
              <Pressable onPress={() => { if (f.id) setRemovidas((r) => [...r, f.id]); setFotos(fotos.filter((x) => x !== f)); }} style={estilos.tirar} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Tirar foto ${i + 1}`}><Icone nome="x" cor="#fff" t={14} sw={3} /></Pressable>
              {i === 0 && <Text style={estilos.capa}>Capa</Text>}
            </View>
          ))}
        </View>
        {fotos.length < MAX_FOTOS && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => escolherFoto('galeria')} style={estilos.fotoBtn} accessibilityRole="button"><Icone nome="galeria" cor={cor.dourado} t={22} /><Text style={estilos.fotoTexto}>Da galeria</Text></Pressable>
            <Pressable onPress={() => escolherFoto('camera')} style={estilos.fotoBtn} accessibilityRole="button"><Icone nome="camera" cor={cor.dourado} t={22} /><Text style={estilos.fotoTexto}>Tirar foto</Text></Pressable>
          </View>
        )}
      </View>

      {erro && <Mensagem>{erro}</Mensagem>}
      <Botao titulo={enviando ?? (editando ? 'Salvar alterações' : 'Publicar anúncio')} aoTocar={publicar} desligado={!pronto || !!enviando} />
      {!pronto && <Texto suave centro style={{ fontSize: 13, marginTop: -6 }}>Para {editando ? 'salvar' : 'publicar'}, falta: {falta.join(', ')}.</Texto>}
      </>)}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cat: { flexBasis: '47%', flexGrow: 1, minHeight: 92, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: cor.borda, backgroundColor: cor.campo, gap: 8, justifyContent: 'center' },
  pilula: { minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo, justifyContent: 'center' },
  pilulaOn: { backgroundColor: cor.dourado, borderColor: cor.dourado },
  pilulaTexto: { fontFamily: fonte.forte, fontSize: 14, color: cor.textoSuave },
  outra: { flex: 1, minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo, color: cor.texto, fontFamily: fonte.normal, fontSize: 15 },
  add: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center' },
  cidade: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: cor.ok, backgroundColor: cor.campo },
  sugestao: { minHeight: 52, padding: 12, borderRadius: 12, backgroundColor: cor.campo, borderWidth: 1, borderColor: cor.borda },
  dia: { width: 56, minHeight: 64, borderRadius: 12, borderWidth: 1.5, borderColor: cor.borda, backgroundColor: cor.campo, alignItems: 'center', justifyContent: 'center' },
  tirar: { position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  capa: { position: 'absolute', left: 4, bottom: 4, backgroundColor: cor.dourado, color: '#14361F', fontFamily: fonte.forte, fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  fotoBtn: { flex: 1, minHeight: 56, borderRadius: 14, borderWidth: 1.5, borderColor: cor.dourado, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  fotoTexto: { fontFamily: fonte.forte, fontSize: 15, color: cor.dourado },
});
