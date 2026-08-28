SIGRAF GESTAO - COM BANCO DE DADOS SQLITE
=========================================

O QUE MUDOU
- O sistema roda em um servidor Node.js.
- Os dados sao gravados em SQLite no arquivo data/sigraf.sqlite.
- Clientes, servicos, vendas, caixa e configuracoes sao sincronizados com o servidor.
- O login e validado no servidor por variavel de ambiente.

COMO RODAR NO SERVIDOR
1. Instale o Node.js 20 ou superior.
2. Abra o terminal dentro desta pasta.
3. Configure os usuarios pela variavel SIGRAF_USERS.
4. Execute:

   npm install
   SIGRAF_USERS="usuario1:senha1,usuario2:senha2" npm start

5. Acesse no navegador:

   http://localhost:3000

VARIAVEIS
- PORT: porta do servidor. Exemplo: PORT=3001
- SIGRAF_USERS: lista de usuarios no formato usuario:senha,usuario:senha
- SIGRAF_SESSION_SECRET: segredo usado para assinar sessoes. Use uma frase longa e unica.
- DATA_DIR: pasta onde o banco sera salvo.
- DB_PATH: caminho completo do arquivo SQLite.

EXEMPLO COM PM2
PORT=3001 SIGRAF_USERS="usuario1:senha1,usuario2:senha2" SIGRAF_SESSION_SECRET="troque-por-um-segredo-longo" pm2 start server.js --name siqgraf
pm2 save

BACKUP
O banco fica em data/sigraf.sqlite.
Faca backup desse arquivo regularmente.
Tambem e possivel exportar e restaurar JSON pela tela de Configuracoes.

PUBLICAR EM SERVIDOR PROPRIO
Use um gerenciador de processo como PM2, systemd ou painel da hospedagem para manter o servidor rodando continuamente.

RECURSOS
- Login.
- Dashboard.
- Cadastro, edicao e exclusao de clientes.
- Servicos e acompanhamento de status.
- Venda de materiais.
- Entrada e saida de caixa.
- Lancamentos automaticos de servicos e vendas no caixa.
- Relatorios por periodo.
- Exportacao CSV.
- Backup e restauracao em JSON.
- Layout responsivo.
