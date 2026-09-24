# MV Contadores — publicar a consulta online

Esta pasta contém somente os arquivos para enviar ao GitHub e publicar na Vercel. Consulta direta à API do IBPT, sem campo de valor e sem CSV incluído. A consulta real já foi validada no computador; a publicação na Vercel ainda precisa ser feita.

## 1. Enviar ao GitHub

Para evitar misturar versões, crie um novo repositório chamado `MVIBPT-online`.

No repositório, use **Add file → Upload files**. Envie o conteúdo desta pasta, preservando as subpastas. Não envie o ZIP fechado nem coloque tudo dentro de mais uma pasta.

Na raiz do repositório devem aparecer:

- api/
- dist/
- lib/
- scripts/
- package.json
- vercel.json
- .gitignore
- README.md

Confirme em **Commit changes**. Não é necessário ativar GitHub Pages: nesta configuração, a Vercel vai hospedar a página e a conexão juntas.

## 2. Publicar na Vercel

1. Acesse https://vercel.com/signup e crie sua conta. Você pode usar sua conta GitHub. Escolha um plano adequado ao uso profissional do escritório; consulte as condições e valores apresentados antes de contratar.
2. Acesse https://vercel.com/new e conecte o GitHub. Autorize acesso ao repositório `MVIBPT-online`.
3. Selecione esse repositório e clique em **Import**.
4. Se aparecer **Framework Preset**, selecione **Other**. Mantenha a pasta raiz do projeto. O arquivo vercel.json já define o comando de preparação e a pasta pública dist.
5. Na seção **Environment Variables**, cadastre:

| Nome | Valor |
| --- | --- |
| IBPT_TOKEN | Seu token do IBPT |
| IBPT_CNPJ | O CNPJ vinculado, sem pontuação |

Preencha esses valores somente na Vercel. Não os escreva em arquivos enviados ao GitHub. Não use prefixos públicos como NEXT_PUBLIC_.

6. Clique em **Deploy**.
7. Abra o endereço fornecido pela Vercel e teste uma consulta, por exemplo o NBS `123012200`, UF PA.

Se cadastrar ou alterar as variáveis após publicar, faça um **Redeploy** para aplicá-las. A hospedagem fará a consulta ao IBPT mesmo com seu computador desligado. As próximas alterações enviadas ao GitHub serão publicadas automaticamente pela integração.

## O que foi excluído

Não foram incluídos token, CNPJ cadastrado, arquivo .env, CSV, tabela convertida, atalhos Windows, servidor local ou arquivos de testes. A pasta antiga continua disponível para uso local.

## Funcionamento

A página chama a função api/consulta.js na mesma hospedagem. A função lê as credenciais privadas e consulta somente o domínio oficial do IBPT. Os resultados conferem código, UF, exceção e vigência; não há troca para uma tabela local em caso de falha.

Limitação operacional: o limite básico de consultas é por instância. Confira as cotas e as condições de uso da sua conta IBPT para disponibilização a terceiros.

Fonte: IBPT / Empresômetro — De Olho no Imposto: https://deolhonoimposto.ibpt.org.br/
Documentação de publicação: https://vercel.com/docs/getting-started-with-vercel#deploy-from-the-dashboard
Variáveis privadas: https://vercel.com/docs/environment-variables
