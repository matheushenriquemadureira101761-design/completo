/** Erro com mensagem que pode ir direto para a tela da pessoa. */
export class ErroApp extends Error {
  constructor(status, mensagem, codigo, extra = {}) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.extra = extra;
  }
}
