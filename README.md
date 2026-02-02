````markdown
# AI ThreatMail

AI ThreatMail é uma aplicação web para **análise e classificação de emails suspeitos**, desenvolvida como **Projeto Final do CTeSP em Cibersegurança**.

O sistema combina:
- classificação automática do conteúdo textual (Machine Learning local),
- análise opcional de anexos com serviços de *Threat Intelligence*,
- autenticação segura e histórico de análises por utilizador,
- geração de relatórios técnicos explicativos.

O objetivo é **apoiar a decisão humana**, não substituí-la.

---

## Requisitos

Antes de iniciar, garante que tens instalado no teu sistema:

- **Node.js 18+** (recomendado Node.js 20)
- **PostgreSQL 13+** a correr em localhost
- **npm**

---

## Clonar o Projeto

```bash
git clone <url-do-repositorio>
cd ai-threatmail
````

---

## Instalar Dependências

```bash
npm install
```

---

## Base de Dados (PostgreSQL em localhost)

### Criar a base de dados

Acede ao PostgreSQL (psql, pgAdmin ou outro cliente) e cria a base de dados:

```sql
CREATE DATABASE ai_threatmail;
```

Certifica-te de que:

* o PostgreSQL está a correr
* conheces o utilizador, password e porta (normalmente 5432)

---

## Variáveis de Ambiente

### Criar ficheiro `.env.local`

Na raiz do projeto, cria o ficheiro `.env.local` com o seguinte conteúdo:

```env
# Base de Dados (OBRIGATÓRIO)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_threatmail?schema=public"

# Autenticação (OBRIGATÓRIO)
NEXTAUTH_SECRET="coloca_aqui_uma_string_longa_e_aleatoria"

# Groq (OBRIGATÓRIO para geração de relatórios)
GROQ_API_KEY="a_tua_api_key"
GROQ_MODEL_8B="llama-3.1-8b-instant"
GROQ_MODEL_70B="llama-3.1-70b-versatile"

# Threat Intelligence (OPCIONAL)
# Usa apenas UM provider, conforme escolhido no onboarding
VIRUSTOTAL_API_KEY=""
METADEFENDER_API_KEY=""

# Machine Learning local (OPCIONAL)
# Por defeito é usado: model/model.json
PERCEPTRON_MODEL_PATH=""
```

---

## Prisma ORM (Configuração da Base de Dados)

O projeto utiliza:

* **PostgreSQL** como sistema de gestão de base de dados
* **Prisma ORM** como camada de abstração

### Criar tabelas e migrations

```bash
npx prisma migrate dev --name init
```

### Gerar o Prisma Client

```bash
npx prisma generate
```

### Comandos úteis do Prisma

```bash
npx prisma studio        # Interface gráfica da base de dados
npx prisma migrate status
npx prisma migrate reset # ATENÇÃO: apaga todos os dados
```

---

## Modelo de Machine Learning (Opcional)

O sistema utiliza um **modelo local de perceptron com feature hashing** para classificar o conteúdo textual do email.

* Dataset: `dataset/emails.csv`
* Modelo: `model/model.json`

### Treinar / recriar o modelo

```bash
npx tsx scripts/train-perceptron.ts
```

Se quiseres usar um caminho diferente para o modelo, define no `.env.local`:

```env
PERCEPTRON_MODEL_PATH="/caminho/para/model.json"
```

---

## Executar a Aplicação

```bash
npm run dev
```

Abrir no browser:

```
http://localhost:3000
```

---

## Fluxo de Utilização

1. Registar utilizador / fazer login
2. Realizar **onboarding**:

   * escolher provider de malware
   * escolher modelo Groq
3. Criar nova análise:

   * título
   * assunto
   * corpo do email
   * anexos (opcional)
4. Aguardar processamento
5. Consultar relatório final e histórico

---

## Arquitetura (Resumo)

* **Frontend**: Next.js
* **Backend / API**: Next.js API Routes
* **Base de Dados**: PostgreSQL
* **ORM**: Prisma
* **Autenticação**: NextAuth (JWT)
* **Machine Learning**: Perceptron local
* **Threat Intelligence**: VirusTotal ou MetaDefender

Toda a lógica sensível é executada **exclusivamente no servidor**.

---

## Segurança Aplicada

* Autenticação baseada em JWT
* Sessões com expiração automática
* Controlo de acesso por utilizador
* Validação *server-side* de todas as operações
* Hashing seguro de palavras-passe
* Integridade de anexos através de hashing

---

## Problemas Comuns

### Prisma não liga à base de dados

* Confirma se o PostgreSQL está ativo
* Verifica `DATABASE_URL`
* Reexecuta:

```bash
npx prisma migrate dev
npx prisma generate
```

### Modelo ML não encontrado

* Confirma se existe `model/model.json`
* Ou define `PERCEPTRON_MODEL_PATH`
* Recria com:

```bash
npx tsx scripts/train-perceptron.ts
```

---

## Contexto Académico

Projeto desenvolvido no âmbito do **Curso Técnico Superior Profissional (CTeSP) em Cibersegurança**, com foco na aplicação prática de:

* deteção de ameaças,
* análise de risco,
* segurança aplicacional,
* apoio à decisão.

---

## Autor

**Luiz Henrique Guterres Paiva**
CTeSP em Cibersegurança

Projeto académico com fins educativos e de portfólio profissional.

---

## Licença

Projeto disponibilizado exclusivamente para fins educativos.

```
- ou validar se bate **exatamente** com o teu `.env` real
```
