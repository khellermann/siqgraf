SIGRAF GESTAO - COM BANCO DE DADOS SQLITE
=========================================

ACESSO INICIAL
Usuario: admin
Senha: sigraf123

O QUE MUDOU
- O sistema agora roda em um servidor Node.js.
- Os dados sao gravados em SQLite no arquivo data/sigraf.sqlite.
- A tela continua usando localStorage como fallback se a API nao estiver disponivel.
- Clientes, servicos, vendas, caixa, configuracoes e login sao sincronizados com o servidor.

COMO RODAR NO SERVIDOR
1. Instale o Node.js 20 ou superior.
2. Abra o terminal dentro desta pasta.
3. Execute:

   npm install
   npm start

4. Acesse no navegador:

   http://localhost:3000

VARIAVEIS OPCIONAIS
- PORT: porta do servidor. Exemplo: PORT=8080
- DATA_DIR: pasta onde o banco sera salvo.
- DB_PATH: caminho completo do arquivo SQLite.

EXEMPLO NO WINDOWS POWERSHELL
$env:PORT=8080
npm start

EXEMPLO NO LINUX
PORT=8080 npm start

BACKUP
O banco fica em data/sigraf.sqlite.
Faca backup desse arquivo regularmente.
Tambem e possivel exportar e restaurar JSON pela tela de Configuracoes.

PUBLICAR EM SERVIDOR PROPRIO
Use um gerenciador de processo como PM2, systemd ou painel da hospedagem para manter:

npm start

rodando continuamente.

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
- Alteracao do usuario e senha.
- Layout responsivo.
