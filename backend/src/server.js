import { config } from './config.js';
import { criarApp } from './app.js';
import { migrar } from './migrar.js';
import { iniciarRotinas } from './jobs/rotinas.js';
import { whatsappConfigurado } from './services/mensagens/whatsapp.js';

await migrar();
criarApp().listen(config.porta, () => {
  console.log(`AGROVINC rodando na porta ${config.porta}`);
  if (!whatsappConfigurado()) console.log('WhatsApp em MODO SIMULAÇÃO: as mensagens aparecem aqui no terminal. Preencha WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID no .env.');
  if (config.modoTeste) console.log('MODO_TESTE ligado: códigos aparecem na resposta da API e dá para simular pagamentos. Desligue em produção.');
});
iniciarRotinas();
