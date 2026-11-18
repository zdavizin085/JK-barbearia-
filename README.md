# JK Barbearia — agendamento

Site preto/dourado com agendamento e integração com WhatsApp Cloud API.

## Executar localmente

1. Instale Node.js 20+.
2. Copie `.env.example` para `.env` e defina uma senha longa em `ADMIN_TOKEN`.
3. Execute `npm install` e `npm start`.
4. Abra http://localhost:3000; painel: http://localhost:3000/admin.html.

## Publicar

Use hospedagem Node.js com **disco persistente** (VPS, ou serviço com volume persistente), configure as variáveis de ambiente e execute `npm start`. Configure domínio próprio e HTTPS no provedor. **Não use hospedagem estática**, porque a API precisa executar no servidor. O banco `bookings.sqlite` é criado na pasta do projeto; para produção, mantenha essa pasta em volume persistente e faça backups. Em plataformas com filesystem efêmero, migre para banco gerenciado antes de publicar.

## WhatsApp automático

1. Configure uma conta WhatsApp Business Platform (Cloud API) no Meta for Developers/WhatsApp Manager e obtenha `WA_PHONE_NUMBER_ID` e `WA_ACCESS_TOKEN` do **número remetente**. O número do barbeiro é destinatário (`BUSINESS_WHATSAPP=5585921541651`).
2. Crie e obtenha aprovação de **dois modelos de mensagem utilitária**, idioma `pt_BR`, com exatamente **4 parâmetros de texto no corpo**, nesta ordem:
   - `WA_TEMPLATE_BARBER`: nome do cliente, serviço, data/hora, telefone do cliente.
   - `WA_TEMPLATE_CLIENT`: nome do cliente, serviço, data/hora, nome da barbearia.
3. Configure nomes exatos dos modelos em `.env`. Para envio fora da janela de atendimento, modelos aprovados são necessários. No modo de teste da Meta, só destinatários autorizados recebem mensagens.
4. Faça um teste real com números autorizados. Confira permissões, faturamento e políticas vigentes da Meta.

O agendamento é salvo mesmo quando a API do WhatsApp falha; o status de envio fica no painel. Para produção de maior escala, adicione fila persistente e reenvio de notificações, webhook de status de entrega, monitoramento, limite de requisições e recuperação segura de acesso.

## Limitações e ajustes necessários

- **Cada reserva ocupa 30 minutos**, independentemente do serviço; antes de operar, implemente durações reais e bloqueio de intervalos sobrepostos, se algum serviço ultrapassar 30 minutos.
- O site não envia aviso automático de cancelamento; o barbeiro precisa avisar o cliente manualmente.
- Não há pagamento online, login de clientes ou reagendamento.
- Ajuste preços, endereço, fotos, política de privacidade e identidade visual final.
- O painel usa senha enviada por cabeçalho HTTPS; use uma senha forte e não a compartilhe.
- Confirme autorização/consentimento para mensagens e siga a LGPD e políticas do WhatsApp.
