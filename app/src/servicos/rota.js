// Decide qual tela abrir conforme a situação da assinatura que o servidor devolve em GET /me.
export function telaDaSituacao(situacao) {
  switch (situacao?.estado) {
    case 'teste_terminou': return '/teste-terminou';
    case 'pausada': return '/acesso-pausado';
    case 'teste': case 'ativa': case 'vence_hoje': case 'atrasada': return '/inicio';
    default: return '/entrada';
  }
}
